# caretakerd.echocat.org

Source files for the frontend of [caretakerd.echocat.org](https://caretakerd.echocat.org) website.

* [Deployment](#Deployment)
* [Contributing](#contributing)
* [License](#license)

## Deployment

### Requirements

1. [Wrangler installed](https://developers.cloudflare.com/workers/cli-wrangler/install-update)
2. [Wrangler authorized against our Cloudflare account](https://developers.cloudflare.com/workers/cli-wrangler/authentication#using-commands)

### Local development

```bash
$ wrangler dev 
```

[More details.](https://developers.cloudflare.com/workers/cli-wrangler/commands#dev)

### Publish changes

1. Ensure everything works in [local development](#local-development).
2. Commit/Push the latest changes to git.
3. [Publish the changes](https://developers.cloudflare.com/workers/cli-wrangler/commands#publish)
   ```bash
   $ wrangler publish
   ```

## Contributing

This is an open source project by [echocat](https://echocat.org).
So if you want to make this project even better, you can contribute to this project on [Github](https://github.com/echocat/caretakerd.echocat.org)
by [fork us](https://github.com/echocat/caretakerd.echocat.org/fork).

If you commit code to this project, you have to accept that this code will be released under the [license](#license) of this project.

## License

See the [LICENSE](LICENSE) file.
