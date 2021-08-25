package main

import (
	"flag"
	"github.com/labstack/echo"
	"github.com/labstack/echo/middleware"
	"github.com/labstack/gommon/log"
	"regexp"
)

var (
	welcomeAliases       = regexp.MustCompile(`^/(?:index\.html?|caretakerd\.html?)$`)
	documentationAliases = regexp.MustCompile(`^/(latest|v[^/]+)/(?:|index\.html?|caretakerd\.html?)$`)
	cache                *iCache
)

func main() {
	flag.Parse()

	e := echo.New()
	e.HTTPErrorHandler = httpErrorHandler
	e.HideBanner = true
	e.HidePort = true
	e.Logger.SetLevel(log.INFO)
	e.Use(middleware.Logger())
	e.Use(middleware.RequestID())
	e.Pre(static)
	e.Pre(normalizeURIs)

	cache = newCache(e.Logger)

	e.GET("/", welcome)
	e.GET("/:version", documentation)
	e.GET("/:version/download/:file", download)
	e.GET("/sitemap.xml", sitemap)
	e.GET("/all", all)

	e.Logger.Fatal(e.Start(":8080"))
}
