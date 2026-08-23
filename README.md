# ToolSharp.dev

Ten free, client-side developer tools any backend developer can reach for — connection strings, cron expressions, JWTs, GUIDs, regex, JSON config, Base64, and serverless text sharing. A few lean into .NET/SQL Server specifics since that's where the ideas came from, but nothing here requires knowing .NET to use. Pure static HTML/CSS/JS — no build step, no backend, no dependencies to install.

**Live at:** [toolsharp.dev](https://toolsharp.dev)

## What's here

```
/
├── index.html                          # homepage — directory listing of all tools
├── css/style.css                       # shared design system
├── robots.txt
├── sitemap.xml
└── tools/
    ├── connection-string-builder.html  # SQL Server connection string builder + parser
    ├── cron-builder.html               # Hangfire / Quartz.NET cron builder + explainer
    ├── jwt-decoder.html                # JWT header/payload decoder
    ├── guid-formatter.html             # GUID generator + .NET format converter
    ├── regex-tester.html               # regex tester mapped to RegexOptions
    ├── appsettings-validator.html      # appsettings.json validator + formatter
    ├── json-formatter.html             # generic JSON validator, formatter, minifier
    ├── diff-checker.html               # line-by-line text/code diff
    ├── base64-converter.html           # Base64 encoder and decoder
    └── share-pad.html                  # client-side serverless text sharing tool
```

Every tool runs entirely in the browser. Nothing is sent to a server — this matters both for user trust (people paste connection strings and JWTs into these tools) and for hosting cost (this can run on a free static host forever).

## Deployment status

- ✅ Hosted on Vercel, connected to the GitHub repo (push to `main` auto-deploys)
- ✅ Custom domain `toolsharp.dev` live with SSL (via Spaceship DNS → Vercel)
- ✅ Verified in Google Search Console, `sitemap.xml` submitted (7 pages discovered)
- ✅ Submitted to Bing Webmaster Tools

Redeploying is just `git push` — Vercel picks it up automatically, no manual steps needed.

## Getting indexed

Indexing is already submitted (see above) — Google/Bing typically take 1-2 weeks to fully index a new domain. Check Search Console's Coverage report periodically; no action needed while waiting.

## Getting the first real traffic (months 1-3)

Dev tools don't grow via SEO alone early on — they grow by being useful enough that developers link to them. Since the tools span both general-purpose (JWT, regex, GUID) and .NET-flavored (connection strings, cron, appsettings.json) use cases, there's more than one community worth posting in. In order of effort:

1. **Post once per relevant community — not the same post copy-pasted everywhere.** r/dotnet or r/csharp for the .NET-specific angle ("cron builder for Hangfire/Quartz, connection string builder..."); r/webdev or r/programming for the general-purpose tools (JWT decoder, regex tester, GUID formatter). Be upfront that you built it — dev communities are fine with that if the tool is genuinely useful and each post is tailored to that community rather than identical spam.
2. **Answer one Stack Overflow question per tool, where genuinely relevant**, and link the tool only if it directly solves the asker's problem better than a text answer would.
3. **GitHub README of a related open-source project** (if you have one, or contribute a small doc PR) — a "useful tools" section linking out is a legitimate, low-effort backlink.
4. Skip paid ads entirely at this stage — the audience is small and specific enough that organic + community placement outperforms spend.

## Adding monetization (once there's consistent traffic — don't rush this)

- Apply for Google AdSense once you're seeing steady daily sessions (rough guideline: 100+/day). A single unobtrusive ad slot below the tool, not interrupting the tool itself.
- Once you have repeat visitors, consider a small "Pro" tier ($3-5/mo) for things like: saving a history of generated connection strings/cron expressions locally, or removing ads. This needs a backend + auth + payments (Stripe), which is a meaningfully bigger step than the current MVP — only worth it once the free tools have proven there's a returning audience.

## Adding more tools later

Keep the same pattern: one `.html` file per tool in `/tools/`, reuse `css/style.css`, add an entry to `index.html`'s directory listing and to `sitemap.xml`. Good next candidates, in rough order of search demand: a Base64 encoder/decoder, a timestamp/epoch converter, a URL encoder/decoder, a Markdown previewer, a `.gitignore` generator, and an HTTP status code reference.
