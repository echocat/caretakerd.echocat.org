export class DownloadHandler {

    constructor(releases) {
        this.releases = releases;
    }

    async handle(request, release, file) {
        const targetRelease = release === 'latest' ? await this.releases.latest() : release;
        return await this.releases.respondWithFileDownloadFor(request, targetRelease, file);
    }

}