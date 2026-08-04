# GTM Club site

Static site for GTM Club. Zero dependencies. `scripts/build.mjs` reads the
content files and writes plain HTML into `dist/`. Netlify runs the build on
every push to `main`.

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
| `content/data/site.json` | Copy for Manifesto, Paths, Community, plus the Apply and Circle links |
| `src/assets/styles.css` | All styling. Design tokens are CSS variables at the top |
| `src/assets/fonts/` | Druk Wide + Helvetica Now, subset to Latin. Regenerate with `scripts/fonts.sh` |
| `src/assets/filter.js` | Client-side search + filtering for the library grid (a text query plus the type and source facets, all combined with AND) |
| `scripts/build.mjs` | Page templates and build logic |
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
- **Design tokens are fixed.** Colours, fonts and radii come from the original
  Claude Design system. Change them only when asked, and change the CSS variable
  rather than a call site.
- **No em dashes in site copy.** Use commas or a full stop.
- **Sentence case in UI copy.** Uppercase is applied via CSS, not typed.
- Content changes go in `content/`. Only reach into `scripts/build.mjs` when the
  page structure itself needs to change.

## Deploys

Push to `main` publishes to production. Push any other branch and Netlify builds
it to its own preview URL, which is the safe way to review anything structural.
Rollback is Netlify, Deploys, pick a previous one, Publish deploy.

The submit form is Netlify Forms. The form must stay in the static HTML with
`data-netlify="true"`, `name="asset"`, and the hidden `form-name` field, or
detection breaks silently.
