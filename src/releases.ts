import {Octokit} from '@octokit/rest';
import {Environment} from './common';
import {Router} from './router';

const oneMinuteInSeconds = 60;
const oneHourInSeconds = oneMinuteInSeconds * 60;
const oneDayInSeconds = oneHourInSeconds * 24;
const oneYearInSeconds = oneDayInSeconds * 365;

const maxRetrieveTries = 25;
const cacheKvSettings = {
    expirationTtl: oneHourInSeconds,
};
const documentationFilename = 'caretakerd.html';

export class Releases {
    constructor(
        private organization: string,
        private repository: string,
        private router: Router,
    ) {}

    public async respondWithDocumentationOf(request: Request, env: Environment, release: string): Promise<Response> {
        let content = await env.CACHE.get(`documentation-${release}`, {
            cacheTtl: oneHourInSeconds,
        });
        if (!content) {
            const url = `https://github.com/${this.organization}/${this.repository}/releases/download/${release}/${documentationFilename}`;
            console.log(`Need to download documentation: ${url}`);
            const response = await fetch(url, {
                redirect: 'follow',
            });
            if (response.status === 404) {
                return await this.router.onNotFound(request, env);
            }
            if (response.status !== 200) {
                throw `Unexpected return code received while retrieving '${url}': ${response.status} - ${response.statusText}`;
            }
            content = await this._responseBodyToString(response.body!);
            await env.CACHE.put(`documentation-${release}`, content);
        }
        const ttl = release === 'latest' ? oneMinuteInSeconds : oneYearInSeconds;
        return new Response(content, {
            status: 200,
            headers: {
                'Cache-Control': `public, max-age=${ttl}, immutable`,
                'Content-Type': 'text/html;charset=utf8',
            },
        });
    }

    async _responseBodyToString(body: ReadableStream<any>) {
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

    public async respondWithFileDownloadFor(_request: Request, _env: Environment, release: string, file: string): Promise<Response> {
        const url = `https://github.com/${this.organization}/${this.repository}/releases/download/${release}/${file}`;
        return Response.redirect(url, 301);
    }

    async latest(request: Request, env: Environment): Promise<string> {
        for (let i = 0; i < maxRetrieveTries; i++) {
            const result = await env.CACHE.get('latestRelease', {
                cacheTtl: oneHourInSeconds,
            });
            if (result) {
                return result;
            }
            await this._retrieveReleases(request, env);
        }
        throw `Was not able to retrieve the latest release after ${maxRetrieveTries} tries.`;
    }

    async all(request: Request, env: Environment) {
        for (let i = 0; i < maxRetrieveTries; i++) {
            const plain = await env.CACHE.get('allReleases', {
                cacheTtl: oneHourInSeconds,
            });
            if (plain) {
                return JSON.parse(plain);
            }
            await this._retrieveReleases(request, env);
        }
        throw `Was not able to retrieve the all releases after ${maxRetrieveTries} tries.`;
    }

    async _retrieveReleases(_request: Request, env: Environment) {
        const octokit = new Octokit({
            auth: env.GITHUB_ACCESS_TOKEN,
        });
        let latest = null;
        const releases = [];
        for await (const response of octokit.paginate.iterator('GET /repos/{owner}/{repo}/releases', {
            owner: this.organization,
            repo: this.repository,
            per_page: 5,
        })) {
            for (const release of response.data) {
                if (!release.draft) {
                    if (!release.prerelease && latest === null) {
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

        await env.CACHE.put('latestRelease', latest, cacheKvSettings);
        await env.CACHE.put('allReleases', JSON.stringify(releases), cacheKvSettings);
    }
}
