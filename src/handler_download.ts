import {Environment} from './common';
import {Releases} from './releases';

export class DownloadHandler {
    constructor(private releases: Releases) {}

    public async handle(request: Request, env: Environment, release: string, file: string): Promise<Response> {
        const targetRelease = release === 'latest' ? await this.releases.latest(request, env) : release;
        return await this.releases.respondWithFileDownloadFor(request, env, targetRelease, file);
    }
}
