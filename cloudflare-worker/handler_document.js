export class DocumentHandler {

    constructor(releases) {
        this.releases = releases;
    }

    async handle(request, release) {
        const targetRelease = release === 'latest' ? await this.releases.latest() : release;
        return await this.releases.respondWithDocumentationOf(request, targetRelease);
    }

}