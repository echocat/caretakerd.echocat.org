package main

import (
	"context"
	"flag"
	"fmt"
	"github.com/echocat/slf4g"
	"github.com/google/go-github/github"
	"github.com/labstack/echo"
	"golang.org/x/oauth2"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func newCache() *iCache {
	result := iCache{
		lastUpdate:   time.Now(),
		root:         flag.String("cache", envString("CACHE_ROOT", "var/cache"), "Location where cache is stored"),
		refreshEvery: flag.Duration("refreshEvery", envDuration("REFRESH_EVERY", time.Hour*1), "Refresh latest versions in this interval"),
		githubToken:  flag.String("githubToken", envString("GITHUB_TOKEN", ""), "Optional token to access GitHub."),
	}
	result.init()
	return &result
}

type iCache struct {
	lastUpdate    time.Time
	latestVersion string
	root          *string
	refreshEvery  *time.Duration
	githubToken   *string
}

func (instance *iCache) init() {
	if err := os.MkdirAll(*instance.root, 0755); err != nil {
		log.WithError(err).
			With("root", *instance.root).
			Fatal("Cannot create root.")
	}

	file := filepath.Join(*instance.root, "latest.version")
	f, err := os.Open(file)
	if err != nil {
		if os.IsNotExist(err) {
			log.With("file", file).
				Warnf("File which contains the latest version does not exist." +
					" Can currently only serve 404." +
					" Cache will be tried to updated as soon as possible.")
		} else {
			log.With("file", file).
				WithError(err).
				Fatal("Cannot read file")
			os.Exit(1)
		}
	} else {
		buf, err := ioutil.ReadAll(f)
		if err != nil {
			log.With("file", file).
				WithError(err).
				Fatal("Cannot read file")
			os.Exit(1)
		}
		instance.latestVersion = strings.TrimSpace(string(buf))
		log.With("release", instance.latestVersion).
			Infof("Last latest cached version was.")
	}

	go func() {
		for {
			err := instance.refresh()
			if err != nil {
				log.WithError(err).
					With("retryIn", *instance.refreshEvery).
					Warn("Problem while try to refresh; will retry.")
			}
			time.Sleep(*instance.refreshEvery)
		}
	}()
}

func (instance *iCache) newGithubClient() *github.Client {
	if len(*instance.githubToken) <= 0 {
		return github.NewClient(nil)
	}
	ctx := context.Background()
	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: *instance.githubToken},
	)
	tc := oauth2.NewClient(ctx, ts)
	return github.NewClient(tc)
}

func (instance *iCache) refresh() error {
	client := instance.newGithubClient()

	err := instance.refreshLatestVersion(client)
	if err != nil {
		return err
	}

	lo := github.ListOptions{}
	for {
		releases, resp, err := client.Repositories.ListReleases(context.Background(), "echocat", "caretakerd", &lo)
		if err != nil {
			return fmt.Errorf("could not refresh versions: %v", err)
		}
		lo.Page = resp.NextPage
		for _, release := range releases {
			err := instance.refreshVersionByRelease(client, *release)
			if err != nil {
				return err
			}
		}
		if resp.NextPage <= 0 {
			break
		}
	}

	instance.lastUpdate = time.Now()
	log.With("release", instance.latestVersion).
		Info("Refreshed.")
	return nil
}

func (instance *iCache) refreshLatestVersion(client *github.Client) error {
	latest, _, err := client.Repositories.GetLatestRelease(context.Background(), "echocat", "caretakerd")
	if err != nil {
		return fmt.Errorf("could not refresh latest version: %v", err)
	}

	instance.latestVersion = *latest.Name
	path := filepath.Join(*instance.root, "latest.version")
	err = ioutil.WriteFile(path, []byte(*latest.Name), 644)
	if err != nil {
		return fmt.Errorf("could not refresh latest version: %v", err)
	}

	return nil
}

func (instance *iCache) refreshVersionByRelease(client *github.Client, release github.RepositoryRelease) error {
	for _, asset := range release.Assets {
		if asset.Name != nil && asset.ID != nil && asset.BrowserDownloadURL != nil && (*asset.Name) == "caretakerd.html" {
			return instance.refreshVersionByReleaseAsset(client, release, asset)
		}
	}
	log.With("release", *release.Name).Infof("Release does not contain a 'caretakerd.html'.")
	return nil
}

func (instance *iCache) refreshVersionByReleaseAsset(client *github.Client, release github.RepositoryRelease, asset github.ReleaseAsset) error {
	versionPath := filepath.Join(*instance.root, *release.Name)
	documentationPath := filepath.Join(versionPath, *asset.Name)

	fi, err := os.Stat(documentationPath)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	if asset.Size != nil && fi != nil {
		if fi.Size() == int64(*asset.Size) {
			log.With("asset", *asset.Name).
				With("release", *release.Name).
				Debug("Asset of version already up to date.")
			return nil
		}
		log.With("asset", *asset.Name).
			With("release", *release.Name).
			With("expectedSize", *asset.Size).
			With("existingSize", fi.Size()).
			Info("Asset of version already exists but seems to out of date." +
				" Existing file size does not match expected.")
	}

	err = os.MkdirAll(versionPath, 755)
	if err != nil {
		return err
	}

	resp, err := http.Get(*asset.BrowserDownloadURL)
	if err != nil {
		return fmt.Errorf("could not download asset #%d of version '%s' from %s: %v", *asset.ID, *release.Name, *asset.BrowserDownloadURL, err)
	}
	defer closeSilently(resp.Body)

	dst, err := os.OpenFile(documentationPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 644)
	if err != nil {
		return fmt.Errorf("could not open output for asset #%d of version '%s': %v", *asset.ID, *release.Name, err)
	}
	defer closeSilently(dst)

	_, err = io.Copy(dst, resp.Body)
	if err != nil {
		return fmt.Errorf("could not download asset #%d of version '%s': %v", *asset.ID, *release.Name, err)
	}

	log.With("asset", *asset.Name).
		With("release", *release.Name).
		Info("Download successfully asset of version.")
	return nil
}

func (instance *iCache) serve(c echo.Context, name string) error {
	p := filepath.Join(*instance.root, name)
	f, err := os.Open(p)
	if os.IsNotExist(err) {
		return echo.ErrNotFound
	}
	if err != nil {
		return err
	}
	defer closeSilently(f)

	fi, err := os.Stat(p)
	if err != nil {
		return err
	}

	resp := c.Response()
	resp.Header().Set("Cache-Control", "public, max-age=900")
	http.ServeContent(resp, c.Request(), fi.Name(), fi.ModTime(), f)
	return nil
}

func (instance *iCache) versions() (versions, error) {
	fis, err := ioutil.ReadDir(*instance.root)
	if err != nil {
		return versions{}, fmt.Errorf("could not retrieve list of files for cache directory '%s': %v", *instance.root, err)
	}

	var versions versions
	for _, fi := range fis {
		if fi.IsDir() {
			if strings.HasPrefix(fi.Name(), "v") {
				versions = append(versions, version{
					Name:         fi.Name(),
					Url:          fmt.Sprintf("https://caretakerd.echocat.org/%s/", fi.Name()),
					Latest:       fi.Name() == instance.latestVersion,
					LastModified: fi.ModTime(),
				})
			}
		}
	}
	return versions, nil
}
