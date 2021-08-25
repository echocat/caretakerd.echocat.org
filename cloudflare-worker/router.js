import {getAssetFromKV, NotFoundError} from '@cloudflare/kv-asset-handler'

export class Router {

    constructor() {
        this.onNotFound = (request) => this._defaultOnNotFound(request);
        this._rules = [{
            regexp: /^\/(latest|v[^/]+)\/download\/([^/]+)$/,
            handler: async (request, match) => await this.onDownload(request, match[1], match[2]),
        }, {
            regexp: /^\/latest\.(json|txt)$/,
            handler: async (request, match) => await this.onLatestInfo(request, match[1]),
        }, {
            regexp: /^\/(latest|v[^/]+)(|\.html?|\/(?:|index\.html?|caretakerd\.html?))$/,
            handler: async (request, match) => await this._onDocument(request, match[1], match[2]),
        }, {
            regexp: /^\/all(|\.html?|\/(?:|index\.html?))$/,
            handler: async (request, match) => await this._onAll(request, match[1]),
        }, {
            regexp: /^\/(|(?:index\.html?|caretakerd\.html?))$/,
            handler: async (request, match) => await this._onIndex(request, match[1]),
        }];
    }

    async onDownload(request, release, file) {
        console.log(`fallback.onDownload(url="${request.url}", release="${release}", file="${file}")`);
        return await this.onNotFound(request);
    }

    async onLatestInfo(request, type) {
        console.log(`fallback.onLatestInfo(url="${request.url}", type="${type}")`);
        return await this.onNotFound(request);
    }

    async onDocument(request, release) {
        console.log(`fallback.onDocument(url="${request.url}", release="${release}")`);
        return await this.onNotFound(request);
    }

    async onAll(request) {
        console.log(`fallback.onAll(url="${request.url}")`);
        return await this.onNotFound(request);
    }

    async onIndex(request) {
        console.log(`fallback.onIndex(url="${request.url}")`);
        return await this.onNotFound(request);
    }

    async _onDocument(request, release, subPath) {
        if (subPath !== '/') {
            return this._redirect(request, `/${release}/`, 301);
        }
        return await this.onDocument(request, release);
    }

    async _onAll(request, subPath) {
        if (subPath !== '/') {
            return this._redirect(request, '/all/', 301);
        }
        return await this.onAll(request);
    }

    async _onIndex(request, subPath) {
        if (subPath !== '') {
            return this._redirect(request, '', 301);
        }
        return await this.onIndex(request);
    }

    async _redirect(request, newPath, status) {
        const url = new URL(request.url);
        url.pathname = newPath;
        return Response.redirect(url.toString(), status);
    }

    async handle(event) {
        const request = event.request;
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return await this._respondWithError(request, 405, 'Method not allowed', `The request method ${request.method} is not allowed for this resource.`);
        }

        const url = new URL(request.url);
        const {pathname} = url;

        for (const rule of this._rules) {
            const match = pathname.match(rule.regexp);
            if (match) {
                return rule.handler(request, match);
            }
        }

        try {
            const response = await getAssetFromKV(event);
            response.headers.set('Cache-Control', `public, max-age=3600, immutable`)
            return response;
        } catch (e) {
            if (e instanceof NotFoundError) {
                return await this.onNotFound(request);
            } else {
                throw e;
            }
        }
    }

    async _defaultOnNotFound(request) {
        return await this._respondWithError(request, 404, 'Not found', 'The resource you requested cannot be found.');
    }

    async _respondWithError(request, statusCode, status, message) {
        const html = errorHtmlTemplate
            .replaceAll('%%statusCode%%', statusCode)
            .replaceAll('%%status%%', status)
            .replaceAll('%%message%%', message);
        return new Response(html, {
            status: statusCode,
            statusText: status,
            headers: {
                "content-type": "text/html;charset=UTF-8",
            },
        });
    }

}

const errorHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, minimal-ui">
    <title>caretakerd - %%statusCode%% %%status%%</title>
    <link href="/styles/markdown.css" media="all" rel="stylesheet" />
    <link href="/styles/root.css" media="all" rel="stylesheet" />
</head>
<body>
<article class="markdown-body">
    <h1>%%statusCode%% %%status%%</h1>
    <p>%%message%%</p>
    <p><a href="/">Return to our homepage.</a></p>
</article>
</body>
</html>`;