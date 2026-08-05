# GTM Club site

The five Claude Design pages, ported to a plain static site: Manifesto, Library,
Paths, Events, Community, plus the submission flow. No framework, no
dependencies. Node reads the content files and writes HTML.

**New here? Read DEPLOY.md instead.** It has the step-by-step for getting this
live and changing things afterwards. This file is the technical reference.

## Content lives in three places

- `content/skills/` one folder per library asset, `SKILL.md` plus any extras
- `content/events/` one markdown file per event, past ones drop off automatically
- `content/data/site.json` copy for Manifesto, Paths and Community

## Run it locally

```bash
npm run dev      # builds, then serves dist/ on http://localhost:3000
npm run build    # just build into dist/
```

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Vercel, Add New, Project, import the repo
3. Vercel reads `vercel.json`, so leave the build settings alone
4. Deploy

Every push to `main` rebuilds and redeploys. Pull requests get their own preview
URL, which is how you review a submitted asset before it goes live.

## Add an asset

Create a folder under `content/skills/` and drop a `SKILL.md` in it:

```
content/skills/your-asset-name/
  SKILL.md
  references/          (anything else the skill needs)
```

```markdown
---
title: Cold email refiner
kind: Skill              # Skill, Repo, Sequence, Prompt, Dataset
description: One line. This is the card text and the meta description.
meta: 505 installs       # the small grey text bottom-left of the card
author: Vic
repo: https://...        # optional, adds a View source button
updated: 2026-07-24      # drives sort order and the "2d ago" label
draft: true              # optional, keeps it out of the build
---

## What it does

Markdown body. Becomes the detail page.
```

Commit, push, done. The build:

- writes `/library/` with every card pre-rendered in the HTML
- writes `/library/your-asset-name/` as a real indexable page
- zips the whole folder to `/library/your-asset-name/your-asset-name.zip`,
  with the folder inside, which is the shape Claude expects on upload
- regenerates `sitemap.xml`, `robots.txt` and `assets/library.json`
- adds any new `kind` to the filter bar and the submit form automatically

Filter types are derived from the content. You never edit a list by hand.

## Submissions

`/submit/` posts to `api/submit.js`, which stores the entry in Vercel KV and
redirects to `/submit/thanks/`. Read them at `/api/submissions?key=<LOG_SECRET>`
(`&format=csv` for a dump). File uploads are not stored; the form takes a link.

File uploads count against your plan's form storage, so if people start sending
large datasets, switch the file field for a link field.

## Fonts

Druk Wide Bold and Helvetica Now Text (400, 500, 700) are installed in
`src/assets/fonts/`, subset to Latin plus the punctuation the design uses.
Four files, 56KB total, down from 5.7MB of source. Druk and Helvetica 400 are
preloaded in the `<head>` so the display headline does not flash Arial Black
first.

You only need to touch this if you add a weight or a glyph the subset dropped
(anything past Latin-1: Cyrillic, Greek, extended accents, new symbols):

```bash
pip install fonttools brotli
./scripts/fonts.sh /path/to/original/font/folder
```

Edit the `RANGES` line in `scripts/fonts.sh` to widen coverage.

One thing to check before this goes public: Helvetica Now arrived as a webfont
kit (eot, woff, woff2), which normally means a web licence is already in place.
Druk arrived as a desktop `.ttf`, and desktop licences usually do not cover
self-hosting or converting to woff2. Worth confirming with whoever bought it,
since a public site is exactly the case those licences carve out. If the answer
is no, Archivo Expanded is the closest free substitute: change `--display` in
`styles.css`.

## Other pages

`Paths`, `Events`, `Community` and `Manifesto` are in the nav but not built
yet. They port the same way: the markup is already static, only the repeated
lists need the `sc-for` loop turned into a `.map()`.
