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
| `content/skills/<slug>/SKILL.md` | One library asset. Frontmatter drives the card, body becomes the detail page |
| `content/events/*.md` | One event each. Past dates are filtered out at build time |
| `content/data/site.json` | Copy for Manifesto, Paths, Community, plus the Apply and Circle links |
| `src/assets/styles.css` | All styling. Design tokens are CSS variables at the top |
| `src/assets/fonts/` | Druk Wide + Helvetica Now, subset to Latin. Regenerate with `scripts/fonts.sh` |
| `src/assets/filter.js` | Client-side filtering for the library grid |
| `scripts/build.mjs` | Page templates and build logic |
| `dist/` | Generated. Never edit, never commit |

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
