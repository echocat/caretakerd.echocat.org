package main

import (
	"fmt"
	"github.com/labstack/echo"
	"mime"
	"net/http"
	"os"
	"path"
	"strings"
	"time"
)

func init() {
	_ = mime.AddExtensionType(".html", "text/html")
	_ = mime.AddExtensionType(".htm", "text/htm")
	_ = mime.AddExtensionType(".css", "text/css")
}

func static(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		p := c.Request().URL.Path
		if strings.HasPrefix(p, "/_/") {
			return next(c)
		}
		if f, err := blobs.Open(p); os.IsNotExist(err) {
			return next(c)
		} else if err != nil {
			return err
		} else if fi, err := f.Stat(); err != nil {
			return err
		} else if fi.IsDir() {
			return next(c)
		} else {
			resp := c.Response()
			resp.Header().Set("Cache-Control", "public, max-age=900")
			http.ServeContent(resp, c.Request(), path.Base(p), time.Time{}, f)
			return nil
		}
	}
}

func normalizeURIs(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) (err error) {
		req := c.Request()

		if req.Method == "GET" {
			if welcomeAliases.MatchString(req.RequestURI) {
				return c.Redirect(http.StatusMovedPermanently, "/")
			}
			if documentationAliases.MatchString(req.RequestURI) {
				return c.Redirect(http.StatusMovedPermanently, documentationAliases.ReplaceAllString(req.RequestURI, "/$1"))
			}
		}

		return next(c)
	}
}

func httpErrorHandler(err error, c echo.Context) {
	var (
		code = http.StatusInternalServerError
		msg  interface{}
	)

	if he, ok := err.(*echo.HTTPError); ok {
		code = he.Code
		msg = he.Message
		if he.Internal != nil {
			msg = fmt.Sprintf("%v, %v", err, he.Internal)
		}
	} else {
		msg = http.StatusText(code)
	}
	if _, ok := msg.(string); ok {
		msg = echo.Map{"message": msg}
	}

	// Send response
	if !c.Response().Committed {
		if c.Request().Method == echo.HEAD { // Issue #608
			err = c.NoContent(code)
		} else {
			err = c.JSON(code, msg)
		}
		if err != nil {
			c.Logger().Error(err)
		}
	}
}
