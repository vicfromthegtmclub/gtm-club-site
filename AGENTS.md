# GTM Club site

Static site for GTM Club. Zero dependencies. `scripts/build.mjs` reads the
content files and writes plain HTML into `dist/`. Netlify and Vercel both run
the build on every push to `main`.

## Verify before committing

Always run the build and confirm it succeeds before staging anything:

```bash
npm run build
```

It prints `Built 5 pages, N assets, N upcoming events`. If the count of pages or
assets drops unexpectedly, something broke. `npm run dev` serves `dist/` on
localhost:3000 for a visual check.

## Where things live

| Path | Purpose |
|---|---|
| `content/skills/<slug>/SKILL.md` | One library asset. Frontmatter drives the card, body becomes the detail page. `source:` sets the source facet (`Member` if omitted, `Lemskills` for the imported lemlist set); `kind:` sets the type facet |
| `content/skills/<slug>/tool.html` | Optional. With `kind: Tool`, this self-contained page is served verbatim as the asset's detail page (no markdown render, no zip). The card still links to it |
| `content/events/*.md` | One event each. Past dates are filtered out at build time |
| `content/data/site.json` | Copy for Manifesto, Paths, Community, the Apply/Circle links, the footer socials, and the library `searchSynonyms` map |
| `src/assets/styles.css` | All styling. Design tokens are CSS variables at the top; light theme overrides under `:root[data-theme="light"]` |
| `src/assets/fonts/` | Druk Wide + Helvetica Now, subset to Latin. Regenerate with `scripts/fonts.sh` |
| `src/assets/filter.js` | Client-side search + filtering for the library grid (a text query plus the type and source facets, all combined with AND) |
| `src/assets/theme.js` | Light/dark nav toggle. Persists the choice in the `gtm-theme` localStorage key |
| `scripts/build.mjs` | Page templates and build logic |
| `vercel.json` | Vercel build config and the immutable cache headers on `/assets/*` |
| `api/*.js` | Vercel serverless functions (**Vercel only**, not Netlify). No npm deps; they call the KV REST API with `fetch`. `log-domain` records domains from the matrix tool; `domains` reads them back behind `?key=<LOG_SECRET>` |
| `dist/` | Generated. Never edit, never commit |

## Adding a library asset

Whenever you add an asset to the library, it is not done until it is browsable
and searchable. Run this checklist:

1. **Create `content/skills/<slug>/SKILL.md`** with full frontmatter:
   - `title` — sentence case, acronyms kept (e.g. "ICP definer").
   - `kind` — `Skill`, `Repo`, `Tool`, `Sequence`, `Prompt` or `Dataset`. Sets
     the type facet, so a new kind adds a filter chip automatically.
   - `description` — one crisp line, no em dashes. This is the card copy **and**
     the main search signal, so make it descriptive.
   - `source` — `Member` (default, GTM Club / member built) or `Lemskills`, etc.
   - `author`, `meta` (optional), `updated` (`YYYY-MM-DD`, sorts newest first).
2. **For a `Tool`**, also add `tool.html`: self-contained, GTM Club design
   tokens, a `← Library` link back to `/library/`, and the `gtm-theme`
   localStorage sync (read on load, persist on toggle) so it matches the site.
   Check it on mobile: give any two-column grid `minmax(0, 1fr)` tracks and
   `min-width: 0` so wide content cannot force horizontal scroll, and gate any
   `position: sticky` panel to desktop or it will overlap the stacked content.
3. **Make it findable.** The card's hidden `data-search` string is built from
   title, description, kind, source and author, so a good title and description
   already make it searchable. Then add likely alternate words and typos to
   `searchSynonyms` in `content/data/site.json` (key = what a user types, value =
   what to also match), so the asset surfaces under natural queries.
4. **Build and verify.** Run `npm run build`, confirm the asset count went up,
   and search the running site for a couple of natural queries to confirm the
   new asset appears (and only when it should).

## Rules

- **No dependencies.** The build uses only the Node standard library (zipping is
  done in `scripts/zip.mjs`, no external `zip` binary). Do not add npm packages
  or a framework without being asked.
- **Cards render server-side.** Every asset must exist in the HTML at build
  time. JS is for filtering only. Do not move rendering to the client, it breaks
  SEO, which is the point of the library.
- **CSS and JS are fingerprinted.** `styles.css`, `filter.js` and `theme.js` are
  content-hashed by `fingerprint()` in `build.mjs` and referenced through the
  emitted hrefs. Never hardcode `/assets/styles.css` (or similar). `vercel.json`
  marks `/assets/*` immutable for a year, so an un-fingerprinted asset would
  strand returning visitors on a stale copy. Any new CSS/JS must go through
  `fingerprint()` the same way.
- **Design tokens are fixed.** Colours, fonts and radii come from the original
  Claude Design system. Change them only when asked, and change the CSS variable
  rather than a call site.
- **No em dashes in site copy.** Use commas or a full stop.
- **Sentence case in UI copy.** Uppercase is applied via CSS, not typed.
- Content changes go in `content/`. Only reach into `scripts/build.mjs` when the
  page structure itself needs to change.

## Theming

Light and dark are driven by `data-theme` on `<html>`, default `dark`. The
choice lives in the `gtm-theme` localStorage key and is applied before paint by
a tiny inline script in `<head>` to avoid a flash. Only the colour tokens flip
(`:root[data-theme="light"]` in `styles.css`); type and layout are shared. The
nav toggle and every Tool page read and write the same key, so they stay in
sync. Default stays dark unless asked otherwise.

## Deploys

Both **Netlify and Vercel** build from `main` (Vercel via `vercel.json`), so a
push to `main` publishes to production on both. Push any other branch and
Netlify builds it to its own preview URL, which is the safe way to review
anything structural. Rollback is Netlify, Deploys, pick a previous one, Publish
deploy.

The submit form is Netlify Forms. The form must stay in the static HTML with
`data-netlify="true"`, `name="asset"`, and the hidden `form-name` field, or
detection breaks silently.
