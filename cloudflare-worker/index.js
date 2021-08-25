import {Releases} from "./releases";
import {Router} from "./router";
import {DocumentHandler} from "./handler_document";
import {DownloadHandler} from "./handler_download";
import {AllHandler} from "./handler_all";

const router = new Router();
const releases = new Releases('echocat', 'caretakerd', router);
const documentHandler = new DocumentHandler(releases);
const downloadHandler = new DownloadHandler(releases);
const allHandler = new AllHandler(releases);

router.onDocument = async (request, release) => documentHandler.handle(request, release);
router.onIndex = async (request) => documentHandler.handle(request, 'latest');
router.onDownload = async (request, release, file) => downloadHandler.handle(request, release, file);
router.onAll = async (request) => allHandler.handle(request);

addEventListener("fetch", async event => {
    event.respondWith(router.handle(event));
});
