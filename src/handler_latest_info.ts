import type { Environment } from './common';
import type { Releases } from './releases';

export class LatestInfoHandler {
   constructor(private releases: Releases) {}

   public async handle(request: Request, env: Environment, type: string): Promise<Response> {
      const release = await this.releases.latest(request, env);
      switch (type) {
         case 'json':
            return new Response(JSON.stringify({ name: release }), {
               status: 200,
               headers: {
                  'Cache-Control': `public, max-age=60, immutable`,
                  'Content-Type': 'application/json',
               },
            });
         default:
            return new Response(release, {
               status: 200,
               headers: {
                  'Cache-Control': `public, max-age=60, immutable`,
                  'Content-Type': 'text/plain',
               },
            });
      }
   }
}
