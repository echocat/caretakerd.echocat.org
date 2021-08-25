export class LatestInfoHandler {

    constructor(releases) {
        this.releases = releases;
    }

    async handle(request, type) {
        const release = await this.releases.latest();
        switch (type) {
            case 'json':
                return new Response(JSON.stringify({name: release}), {
                    status: 200,
                    headers: {
                        'Cache-Control': `public, max-age=60, immutable`,
                        'Content-Type': 'application/json',
                    }
                });
            default:
                return new Response(release, {
                    status: 200,
                    headers: {
                        'Cache-Control': `public, max-age=60, immutable`,
                        'Content-Type': 'text/plain',
                    }
                });
        }
    }

}