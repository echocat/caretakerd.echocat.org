import {getAssetFromKV, NotFoundError} from '@cloudflare/kv-asset-handler';
import {ExecutionContext} from '@cloudflare/workers-types';
import {Environment} from './common';

// @ts-ignore
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
const assetManifest = JSON.parse(manifestJSON);

interface Rule {
    regexp: RegExp;
    handler: (request: Request, env: Environment, match: RegExpMatchArray) => Promise<Response>;
}

export class Router {
    private readonly _rules: Rule[] = [
        {
            regexp: /^\/(latest|v[^/]+)\/download\/([^/]+)$/,
            handler: async (request, env, match) => await this.onDownload(request, env, match[1], match[2]),
        },
        {
            regexp: /^\/latest\.(json|txt)$/,
            handler: async (request, env, match) => await this.onLatestInfo(request, env, match[1]),
        },
        {
            regexp: /^\/(latest|v[^/]+)(|\.html?|\/(?:|index\.html?|caretakerd\.html?))$/,
            handler: async (request, env, match) => await this._onDocument(request, env, match[1], match[2]),
        },
        {
            regexp: /^\/all(|\.html?|\/(?:|index\.html?))$/,
            handler: async (request, env, match) => await this._onAll(request, env, match[1]),
        },
        {
            regexp: /^\/(|(?:index\.html?|caretakerd\.html?))$/,
            handler: async (request, env, match) => await this._onIndex(request, env, match[1]),
        },
    ];

    constructor() {}

    public onNotFound: (request: Request, env: Environment) => Promise<Response> = async (request, env) => {
        return await this._defaultOnNotFound(request, env);
    };

    public onDownload: (request: Request, env: Environment, release: string, file: string) => Promise<Response> = async (request, env, release, file) => {
        console.log(`fallback.onDownload(url="${request.url}", release="${release}", file="${file}")`);
        return await this.onNotFound(request, env);
    };

    public onLatestInfo: (request: Request, env: Environment, type: string) => Promise<Response> = async (request, env, type) => {
        console.log(`fallback.onLatestInfo(url="${request.url}", type="${type}")`);
        return await this.onNotFound(request, env);
    };

    public onDocument: (request: Request, env: Environment, type: string) => Promise<Response> = async (request, env, release) => {
        console.log(`fallback.onDocument(url="${request.url}", release="${release}")`);
        return await this.onNotFound(request, env);
    };

    public onAll: (request: Request, env: Environment, type?: string) => Promise<Response> = async (request, env) => {
        console.log(`fallback.onAll(url="${request.url}")`);
        return await this.onNotFound(request, env);
    };

    public onIndex: (request: Request, env: Environment, type?: string) => Promise<Response> = async (request, env) => {
        console.log(`fallback.onIndex(url="${request.url}")`);
        return await this.onNotFound(request, env);
    };

    private async _onDocument(request: Request, env: Environment, release: string, subPath: string): Promise<Response> {
        if (subPath !== '/') {
            return await this._redirect(request, env, `/${release}/`, 301);
        }
        return await this.onDocument(request, env, release);
    }

    private async _onAll(request: Request, env: Environment, subPath: string): Promise<Response> {
        if (subPath !== '/') {
            return await this._redirect(request, env, '/all/', 301);
        }
        return await this.onAll(request, env);
    }

    private async _onIndex(request: Request, env: Environment, subPath: string): Promise<Response> {
        if (subPath !== '') {
            return await this._redirect(request, env, '', 301);
        }
        return await this.onIndex(request, env);
    }

    private async _redirect(request: Request, _: Environment, newPath: string, status: number): Promise<Response> {
        const url = new URL(request.url);
        url.pathname = newPath;
        return Response.redirect(url.toString(), status);
    }

    public async handle(request: Request, env: Environment, ctx: ExecutionContext) {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return await this._respondWithError(request, env, 405, 'Method not allowed', `The request method ${request.method} is not allowed for this resource.`);
        }

        const url = new URL(request.url);
        const {pathname} = url;

        for (const rule of this._rules) {
            const match = pathname.match(rule.regexp);
            if (match) {
                return rule.handler(request, env, match);
            }
        }

        try {
            const response = await getAssetFromKV(
                {
                    request: request,
                    waitUntil: promise => ctx.waitUntil(promise),
                },
                {
                    ASSET_NAMESPACE: env.__STATIC_CONTENT,
                    ASSET_MANIFEST: assetManifest,
                },
            );
            response.headers.set('Cache-Control', `public, max-age=3600, immutable`);
            return response;
        } catch (e) {
            if (e instanceof NotFoundError) {
                return await this.onNotFound(request, env);
            } else {
                throw e;
            }
        }
    }

    private async _defaultOnNotFound(request: Request, env: Environment): Promise<Response> {
        return await this._respondWithError(request, env, 404, 'Not found', 'The resource you requested cannot be found.');
    }

    private async _respondWithError(_request: Request, _env: Environment, statusCode: number, status: string, message: string) {
        const html = errorHtmlTemplate.replaceAll('%%statusCode%%', `${statusCode}`).replaceAll('%%status%%', status).replaceAll('%%message%%', message);
        return new Response(html, {
            status: statusCode,
            statusText: status,
            headers: {
                'content-type': 'text/html;charset=UTF-8',
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
