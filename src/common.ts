import type { KVNamespace } from '@cloudflare/workers-types';
export interface Environment {
   GITHUB_ACCESS_USER: string;
   GITHUB_ACCESS_TOKEN: string;
   CACHE: KVNamespace;
   __STATIC_CONTENT: any;
}
