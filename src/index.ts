// @ts-expect-error
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
import type { ExecutionContext } from '@cloudflare/workers-types';
import type { Environment } from './common';
import { AllHandler } from './handler_all';
import { DocumentHandler } from './handler_document';
import { DownloadHandler } from './handler_download';
import { LatestInfoHandler } from './handler_latest_info';
import { Releases } from './releases';
import { Router } from './router';

const assetManifest = JSON.parse(manifestJSON);

const router = new Router(assetManifest);
const releases = new Releases('echocat', 'caretakerd', router);
const documentHandler = new DocumentHandler(releases);
const downloadHandler = new DownloadHandler(releases);
const allHandler = new AllHandler(releases);
const latestInfoHandler = new LatestInfoHandler(releases);

router.onDocument = async (request, env, release) => await documentHandler.handle(request, env, release);
router.onIndex = async (request, env) => await documentHandler.handle(request, env, 'latest');
router.onDownload = async (request, env, release, file) => await downloadHandler.handle(request, env, release, file);
router.onAll = async (request, env) => await allHandler.handle(request, env);
router.onLatestInfo = async (request, env, type) => await latestInfoHandler.handle(request, env, type);

export const handler = {
   async fetch(request: Request, env: Environment, ctx: ExecutionContext): Promise<Response> {
      return await router.handle(request, env, ctx);
   },
};

export default handler as ExportedHandler<Environment>;
