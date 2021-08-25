const template = `<!DOCTYPE html>
<html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, minimal-ui">
    <title>caretakerd - versions</title>
    <link href="/styles/markdown.css" media="all" rel="stylesheet" />
    <link href="/styles/root.css" media="all" rel="stylesheet" />
</head>
<body>
<article class="markdown-body">
    <h1>caretakerd releases</h1>
    <ul>
        %%releases%%
    </ul>
</article>
</body>
</html>`;

export class AllHandler {

    constructor(releases) {
        this.releases = releases;
    }

    async handle(request) {
        let releasesHtml = '';
        const latest = await this.releases.latest();
        for (const release of await this.releases.all()) {
            releasesHtml += `<li><a href="/${encodeURIComponent(release.name)}/">${escape(release.name)}</a>`;
            if (release.name === latest) {
                releasesHtml += ` <span class="hint">Latest</span>`;
            }
            releasesHtml += `</li>`;
        }

        const html = template
            .replaceAll('%%releases%%', releasesHtml);
        return new Response(html, {
            headers: {
                "content-type": "text/html;charset=UTF-8",
            },
        });
    }

}