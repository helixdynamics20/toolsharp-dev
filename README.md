# ToolSharp.dev

22 free, client-side developer tools any backend developer can reach for — connection strings, cron expressions, JWTs, GUIDs, regex, JSON/XML/SQL/CSV formatting, hashing, Base64, QR codes, and text diffing — plus 8 reference guides on the syntax and failure modes behind them. A few tools and guides lean into .NET/SQL Server specifics since that's where the ideas came from, but nothing here requires knowing .NET to use. Static HTML/CSS/JS, plus one small serverless function for the share-pad tool.

**Live at:** [toolsharp.dev](https://toolsharp.dev)

## What's here

```
/
├── index.html                          # homepage — directory listing of all tools
├── 404.html                            # custom not-found page
├── privacy-policy.html                 # analytics/cookies/advertising disclosure
├── favicon.svg
├── manifest.json                       # PWA manifest
├── service-worker.js                   # offline caching (network-first, version-pruning)
├── LICENSE                             # MIT
├── css/style.css                       # shared design system (incl. dark mode)
├── js/                                 # one file per tool, plus shared theme.js/utils.js
├── assets/
│   ├── icons/                          # PWA icons
│   └── og/                             # per-tool and per-guide social share images
├── scripts/generate-guide-og.js        # regenerates guide OG images (needs Playwright, not a project dep)
├── api/share.mjs                       # Vercel serverless function backing share-pad (Upstash Redis)
├── robots.txt
├── sitemap.xml
├── build.js                            # minifies HTML/CSS/JS + bundles vendored libs into dist/
├── tools/                              # 22 tools — see index.html for the full list with descriptions
└── guides/                             # 8 reference guides — see guides/index.html
```

Every tool except share-pad runs entirely in the browser — nothing typed into a tool is ever sent to a server. share-pad is the one exception: its optional 6-digit code mode needs a tiny backend to make short links possible (see below); its offline-link mode doesn't touch a server at all.

## share-pad needs Upstash configured on Vercel

`api/share.mjs` stores shared text in Upstash Redis via its REST API. For this to work in production, two environment variables must be set in the Vercel project (Settings → Environment Variables):

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Get these from an Upstash account (free tier is enough) → create a Redis database → REST API section has both values. Without them, `/api/share` returns a 500 and share-pad will show an error when creating a link — every other tool is unaffected.

## Deployment status

- ✅ Hosted on Vercel, connected to the GitHub repo (push to `main` auto-deploys)
  - **IMPORTANT:** In Vercel Project Settings, set the **Build Command** to `npm run build` and **Output Directory** to `dist`. Vercel will install dependencies, build/minify the files, and serve the minified output from `dist`.
- ✅ Custom domain `toolsharp.dev` live with SSL (via Spaceship DNS → Vercel)
- ✅ Verified in Google Search Console, `sitemap.xml` submitted
- ✅ Submitted to Bing Webmaster Tools
- ✅ Security headers (CSP, HSTS, frame-ancestors, etc.) set in `vercel.json`
- ⚠️ share-pad requires the Upstash env vars above to be set on Vercel before it'll work live

Redeploying is just `git push` — Vercel picks it up automatically, no manual steps needed.

## License

MIT — see `LICENSE`. Use it, fork it, ship your own version; credit is appreciated but not enforced beyond what the license requires.

## Adding a new tool

One `.html` file per tool in `/tools/`, reuse `css/style.css`, add an entry to `index.html`'s directory listing and to `sitemap.xml`.
