import type { Environment } from './common';
import type { Releases } from './releases';

export class DocumentHandler {
   constructor(private releases: Releases) {}

   public async handle(request: Request, env: Environment, release: string): Promise<Response> {
      const targetRelease = release === 'latest' ? await this.releases.latest(request, env) : release;
      return await this.releases.respondWithDocumentationOf(request, env, targetRelease);
   }
}
