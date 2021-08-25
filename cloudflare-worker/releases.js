import {Octokit} from "@octokit/core";
import {paginateRest} from "@octokit/plugin-paginate-rest";

const MyOctokit = Octokit.plugin(paginateRest);
// noinspection JSUnresolvedVariable
const octokit = new MyOctokit({
    auth: GITHUB_ACCESS_TOKEN,
});

const oneMinuteInSeconds = 60;
const oneHourInSeconds = oneMinuteInSeconds * 60;
const oneDayInSeconds = oneHourInSeconds * 24;
const oneYearInSeconds = oneDayInSeconds * 365;

const maxRetrieveTries = 25;
const cacheKvSettings = {
    expirationTtl: oneHourInSeconds,
};
// noinspection JSUnresolvedVariable
const cacheKv = CACHE;
const documentationFilename = 'caretakerd.html';


export class Releases {

    constructor(organization, repository, router) {
        this.organization = organization;
        this.repository = repository;
        this.router = router;
    }

    async respondWithDocumentationOf(request, release) {
        let content = await cacheKv.get(`documentation-${release}`, {
            cacheTtl: oneHourInSeconds
        });
        if (!content) {
            const url = `https://github.com/${this.organization}/${this.repository}/releases/download/${release}/${documentationFilename}`;
            console.log(`Need to download documentation: ${url}`);
            const response = await fetch(url, {
                redirect: 'follow',
            });
            if (response.status === 404) {
                return this.router.onNotFound(request);
            }
            if (response.status !== 200) {
                throw `Unexpected return code received while retrieving '${url}': ${response.status} - ${response.statusText}`;
            }
            content = await this._responseBodyToString(response.body);
            await cacheKv.put(`documentation-${release}`, content);
        }
        const ttl = release === 'latest' ? oneMinuteInSeconds : oneYearInSeconds;
        return new Response(content, {
            status: 200,
            headers: {
                'Cache-Control': `public, max-age=${ttl}, immutable`,
                'Content-Type': 'text/html;charset=utf8',
            }
        });
    }

    async _responseBodyToString(body) {
        let reader = body.getReader();
        let utf8Decoder = new TextDecoder();
        let nextChunk;

        let resultStr = '';

        while (!(nextChunk = await reader.read()).done) {
            let partialData = nextChunk.value;
            resultStr += utf8Decoder.decode(partialData);
        }

        return resultStr;
    }

    async respondWithFileDownloadFor(request, release, file) {
        const url = `https://github.com/${this.organization}/${this.repository}/releases/download/${release}/${file}`;
        return Response.redirect(url, 301);
    }

    async latest() {
        for (let i = 0; i < maxRetrieveTries; i++) {
            const result = await cacheKv.get('latestRelease', {
                cacheTtl: oneHourInSeconds
            });
            if (result) {
                return result;
            }
            await this._retrieveReleases();
        }
        throw `Was not able to retrieve the latest release after ${maxRetrieveTries} tries.`;
    }

    async all() {
        for (let i = 0; i < maxRetrieveTries; i++) {
            const plain = await cacheKv.get('allReleases', {
                cacheTtl: oneHourInSeconds
            });
            if (plain) {
                return JSON.parse(plain);
            }
            await this._retrieveReleases();
        }
        throw `Was not able to retrieve the all releases after ${maxRetrieveTries} tries.`;
    }

    async _retrieveReleases() {
        let latest = null;
        const releases = [];
        for await(const response of octokit.paginate.iterator('GET /repos/{owner}/{repo}/releases', {
            owner: this.organization,
            repo: this.repository,
            per_page: 5,
        })) {
            for (const release of response.data) {
                if (release.draft === false) {
                    if (release.prerelease === false && latest === null) {
                        latest = release.name;
                    }
                    releases.push({
                        name: release.name,
                        pre: release.prerelease,
                    });
                }
            }
        }

        if (!latest) {
            throw 'There is no latest version are available.';
        }

        await cacheKv.put('latestRelease', latest, cacheKvSettings);
        await cacheKv.put('allReleases', JSON.stringify(releases), cacheKvSettings);
    }

}

