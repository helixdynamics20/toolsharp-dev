# ToolSharp.dev

Ten free, client-side developer tools any backend developer can reach for — connection strings, cron expressions, JWTs, GUIDs, regex, JSON config, Base64, and text diffing. A few lean into .NET/SQL Server specifics since that's where the ideas came from, but nothing here requires knowing .NET to use. Static HTML/CSS/JS, plus one small serverless function for the share-pad tool.

**Live at:** [toolsharp.dev](https://toolsharp.dev)

## What's here

```
/
├── index.html                          # homepage — directory listing of all tools
├── 404.html                            # custom not-found page
├── favicon.svg
├── LICENSE                             # MIT
├── css/style.css                       # shared design system (incl. dark mode)
├── js/theme.js                         # dark mode toggle, persisted via localStorage
├── assets/og-image.jpg                 # social share preview image
├── api/share.js                        # Vercel serverless function backing share-pad (Upstash Redis)
├── robots.txt
├── sitemap.xml
└── tools/
    ├── connection-string-builder.html  # SQL Server connection string builder + parser
    ├── cron-builder.html               # Hangfire / Quartz.NET cron builder + explainer
    ├── jwt-decoder.html                # JWT header/payload decoder
    ├── guid-formatter.html             # GUID generator + .NET format converter
    ├── regex-tester.html               # regex tester mapped to RegexOptions
    ├── appsettings-validator.html      # appsettings.json validator + formatter + auto-repair
    ├── json-formatter.html             # generic JSON validator, formatter, minifier + auto-repair
    ├── diff-checker.html               # side-by-side text/code diff with word-level highlighting
    ├── base64-converter.html           # Base64 encoder/decoder (UTF-8 safe, URL-safe variant)
    └── share-pad.html                  # short-link text sharing (backed by api/share.js)
```

Every tool except share-pad runs entirely in the browser — nothing sent to a server. share-pad is the one exception: it needs a tiny backend to make short links possible (see below).

## share-pad needs Upstash configured on Vercel

`api/share.js` stores shared text in Upstash Redis via its REST API. For this to work in production, two environment variables must be set in the Vercel project (Settings → Environment Variables):

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Get these from an Upstash account (free tier is enough) → create a Redis database → REST API section has both values. Without them, `/api/share` returns a 500 and share-pad will show an error when creating a link — every other tool is unaffected.

## Deployment status

- ✅ Hosted on Vercel, connected to the GitHub repo (push to `main` auto-deploys)
- ✅ Custom domain `toolsharp.dev` live with SSL (via Spaceship DNS → Vercel)
- ✅ Verified in Google Search Console, `sitemap.xml` submitted
- ✅ Submitted to Bing Webmaster Tools
- ⚠️ share-pad requires the Upstash env vars above to be set on Vercel before it'll work live

Redeploying is just `git push` — Vercel picks it up automatically, no manual steps needed.

## License

MIT — see `LICENSE`. Use it, fork it, ship your own version; credit is appreciated but not enforced beyond what the license requires.

## Adding a new tool

One `.html` file per tool in `/tools/`, reuse `css/style.css`, add an entry to `index.html`'s directory listing and to `sitemap.xml`.
