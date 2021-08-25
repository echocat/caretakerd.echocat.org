import {Releases} from "./releases";
import {Router} from "./router";
import {DocumentHandler} from "./handler_document";
import {DownloadHandler} from "./handler_download";
import {AllHandler} from "./handler_all";
import {LatestInfoHandler} from "./handler_latest_info";

const router = new Router();
const releases = new Releases('echocat', 'caretakerd', router);
const documentHandler = new DocumentHandler(releases);
const downloadHandler = new DownloadHandler(releases);
const allHandler = new AllHandler(releases);
const latestInfoHandler = new LatestInfoHandler(releases);

router.onDocument = async (request, release) => documentHandler.handle(request, release);
router.onIndex = async (request) => documentHandler.handle(request, 'latest');
router.onDownload = async (request, release, file) => downloadHandler.handle(request, release, file);
router.onAll = async (request) => allHandler.handle(request);
router.onLatestInfo = async (request, type) => latestInfoHandler.handle(request, type);

addEventListener("fetch", async event => {
    event.respondWith(router.handle(event));
});
