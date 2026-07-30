# Getting the site live, and keeping it that way

Everything you need, in order. No terminal required.

---

## Part 1: put the code on GitHub

**1.1** Create an account at github.com if you don't have one.

**1.2** Click the **+** at the top right, then **New repository**.

**1.3** Name it `gtm-club-site`. Public or private both work. Do **not** tick
"Add a README file", you already have one. Click **Create repository**.

**1.4** Unzip `gtm-club-site.zip` on your computer and open the folder. You
should see exactly this:

```
content/     scripts/     src/
netlify.toml     package.json     README.md     DEPLOY.md
```

**1.5** On the empty GitHub repo page, click the **uploading an existing file**
link.

**1.6** Select everything **inside** the unzipped folder and drag it into the
browser. Not the folder itself, its contents. `netlify.toml` must end up at the
top level of the repo or Netlify won't find the build settings.

The uploader accepts folders, so `content/`, `scripts/` and `src/` go in whole,
subfolders and all.

**1.7** Scroll down, click **Commit changes**.

**1.8** Check the repo homepage. If you see `netlify.toml` in the file list,
you're good. If you see a single folder instead, everything is one level too
deep. Fix it in Part 2.4 rather than re-uploading.

---

## Part 2: connect Netlify

**2.1** Sign up at netlify.com. Choose **Sign up with GitHub**.

**2.2** Click **Add new project**, then **Import an existing project**, then
**GitHub**. Authorise access.

**2.3** Pick `gtm-club-site` from the list.

**2.4** The build command and publish directory fill themselves in from
`netlify.toml`. Leave them alone. **Only** if step 1.8 showed everything nested
one level deep, set **Base directory** to the folder name.

**2.5** Click **Deploy**. First build takes a couple of minutes.

**2.6** Open the URL Netlify gives you. Check three things:

- The headline renders in Druk Wide, not Arial Black. If it's Arial Black, the
  font files didn't make it into the upload. Check `src/assets/fonts/` in the
  repo has four `.woff2` files.
- All five nav links work.
- `/library/` shows three sample assets.

If the build fails, open **Deploys**, click the failed one, and read the log.
The error is almost always a missing file from the upload.

---

## Part 3: clean up

**3.1** Delete the old drag-and-drop site: open it in Netlify, **Project
configuration**, scroll to the bottom, **Delete project**.

**3.2** Rename the new site: **Project configuration**, **Change site name**.
Gives you `gtmclub.netlify.app`.

**3.3** Custom domain, if you have one: **Domain management**, **Add a domain**.
Netlify walks you through the DNS records and issues HTTPS automatically.

---

## Part 4: turn on the submission form

Netlify only detects the form after the first successful deploy, so this has to
come last.

**4.1** Go to **Forms**. You should see a form called `asset`.

**4.2** Open it, then **Settings and usage**, **Form notifications**, **Add
notification**, **Email notification**. Enter your address.

**4.3** Test it. Go to `/submit/` on the live site, fill it in, submit. The
entry should appear under **Forms** within a few seconds.

Want submissions in Notion instead? Same menu, pick **Outgoing webhook** and
paste an n8n webhook URL.

---

## Part 5: changing things later

Every change follows the same shape: edit a file on GitHub, commit, wait about a
minute, refresh the site.

To edit any file: open it in the repo, click the pencil icon, make the change,
click **Commit changes** at the bottom.

### Add an asset to the library

**Add file**, then **Create new file**. In the filename box type
`content/skills/your-asset-name/SKILL.md`. Typing the slash creates the folder.
Then paste:

```markdown
---
title: Cold email refiner
kind: Skill
description: One line. This is the card text and the meta description.
meta: 505 installs
author: Vic
updated: 2026-07-30
---

## What it does

Markdown here. This becomes the detail page.
```

`kind` can be anything. Invent a new one and it appears in the filter bar and
the submit dropdown automatically. `draft: true` keeps it hidden.

If the asset has extra files, use **Add file**, **Upload files** and drag the
whole folder in instead. Everything in the folder gets zipped for download.

### Add an event

Same idea, in `content/events/`. Name the file by date so the folder stays
readable:

```markdown
---
date: 2026-09-15
title: "Teardown: outbound for fintech"
kind: Live
detail: Three sequences pulled apart live.
link: https://circle.so/your-event
---
```

Events in the past disappear from the page on the next build. You never have to
delete them.

### Change copy on Manifesto, Paths or Community

All of it lives in `content/data/site.json`. Beliefs, tracks, modules, house
rules, the team, the Apply and Circle links. Edit the text between the quotes.

One rule with JSON: no trailing comma after the last item in a list. If the
build fails after editing this file, that's the first thing to check.

### Change design or layout

`src/assets/styles.css` for colours, spacing and type. Colours are at the top as
CSS variables, change one line and it applies everywhere.

`scripts/build.mjs` for page structure.

---

## Part 6: not breaking the live site

For anything bigger than a copy tweak, use a branch. In the GitHub editor,
before committing, choose **Create a new branch for this commit**. Netlify
builds every branch to its own URL, so you can look at the change before it goes
public. Merge when you're happy.

If something does break: Netlify, **Deploys**, pick the last good one, **Publish
deploy**. Instant rollback.

---

## What's where

| Path | What it holds |
|---|---|
| `content/skills/` | One folder per library asset |
| `content/events/` | One file per event |
| `content/data/site.json` | Copy for Manifesto, Paths, Community |
| `src/assets/styles.css` | All styling |
| `src/assets/fonts/` | Druk Wide and Helvetica Now, subset |
| `scripts/build.mjs` | Turns all of the above into HTML |
| `netlify.toml` | Build settings and cache headers |
| `dist/` | Build output. Never edit, never commit |

## Working locally, optional

Only if you want to preview before pushing. Install Node.js from nodejs.org,
then in the project folder:

```bash
npm run dev
```

Opens at localhost:3000.
