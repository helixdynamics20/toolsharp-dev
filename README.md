# ToolSharp.dev — MVP

Six free, client-side developer tools for the .NET/C# ecosystem. Pure static HTML/CSS/JS — no build step, no backend, no dependencies to install.

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
    └── appsettings-validator.html      # appsettings.json validator + formatter
```

Every tool runs entirely in the browser. Nothing is sent to a server — this matters both for user trust (people paste connection strings and JWTs into these tools) and for hosting cost (this can run on a free static host forever).

## Deploy it (free, ~10 minutes)

**Easiest: Vercel**
1. Push this folder to a new GitHub repo.
2. Go to vercel.com → New Project → import the repo.
3. Framework preset: "Other" (it's static HTML, no build command needed).
4. Deploy. You'll get a `*.vercel.app` URL immediately.
5. Buy a domain (e.g. `toolsharp.dev` — check availability, adjust the name if taken) and add it in Vercel's domain settings. ~$10-15/year on Namecheap or Porkbun.

**Alternative: Netlify or GitHub Pages** — same idea, drag-and-drop the folder or connect the repo. Either works fine for a static site like this.

**Before going live**, do a find-and-replace on `toolsharp.dev` across all files (canonical URLs, sitemap.xml, robots.txt) if you pick a different domain name.

## Getting indexed (weeks 1-4)

1. Submit the site in Google Search Console (add property → verify via DNS TXT record → submit `sitemap.xml`).
2. Do the same in Bing Webmaster Tools — smaller volume but near-zero effort since it accepts the same sitemap.
3. Don't touch anything for ~2 weeks. Watch Search Console's Coverage report to confirm all 7 pages get indexed.

## Getting the first real traffic (months 1-3)

Dev tools don't grow via SEO alone early on — they grow by being useful enough that developers link to them. In order of effort:

1. **Post once, in the right place.** A single Reddit post in r/dotnet or r/csharp along the lines of "made a few small .NET tools I kept needing — connection string builder, cron builder for Hangfire/Quartz, etc." Be upfront that you built it; dev communities are fine with that if the tool is actually useful and you're not spamming multiple subreddits with the same post.
2. **Answer one Stack Overflow question per tool, where genuinely relevant**, and link the tool only if it directly solves the asker's problem better than a text answer would.
3. **GitHub README of a related open-source project** (if you have one, or contribute a small doc PR) — a "useful tools" section linking out is a legitimate, low-effort backlink.
4. Skip paid ads entirely at this stage — the audience is small and specific enough that organic + community placement outperforms spend.

## Adding monetization (once there's consistent traffic — don't rush this)

- Apply for Google AdSense once you're seeing steady daily sessions (rough guideline: 100+/day). A single unobtrusive ad slot below the tool, not interrupting the tool itself.
- Once you have repeat visitors, consider a small "Pro" tier ($3-5/mo) for things like: saving a history of generated connection strings/cron expressions locally, or removing ads. This needs a backend + auth + payments (Stripe), which is a meaningfully bigger step than the current MVP — only worth it once the free tools have proven there's a returning audience.

## Adding more tools later

Keep the same pattern: one `.html` file per tool in `/tools/`, reuse `css/style.css`, add an entry to `index.html`'s directory listing and to `sitemap.xml`. Good next candidates, in rough order of search demand: a Base64 encoder/decoder, a timestamp/epoch converter, a `.gitignore` generator for .NET projects, an HTTP status code reference with .NET-specific notes (e.g. which ones `ProblemDetails` maps to by default).
