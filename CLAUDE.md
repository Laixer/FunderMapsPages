# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static marketing site for FunderMaps (Dutch foundation-risk / asset-management product). A multi-page Parcel build of plain HTML pages enhanced with AlpineJS, Tailwind v4, SCSS, and Glide.js carousels.

## Commands

Package manager is **pnpm 11**. Node ≥ 20. Pinned via `packageManager` in `package.json`. (Earlier note about pnpm failing on DO App Platform is no longer accurate — DO's Node buildpack does ship pnpm now and detects `pnpm-lock.yaml` correctly.)

- `pnpm install` — install dependencies.
- `pnpm start` — dev server on `http://localhost:8000` with HMR. Only the HTML entries listed in `package.json` are served (`index.html`, `artikelen.html`, `apps*.html`, `media-library.html`, `more-info.html`, `nationaal-herstelregister.html`, `privacy-statement.html`, `terms-conditions.html`, plus the static `llms.txt` / `llms-full.txt` / `robots.txt` / `sitemap.xml`). **Adding a new top-level page requires adding it to the `start` script** — Parcel will not pick it up otherwise.
- `pnpm build` — production build of `index.html` (plus the static text/xml files) into `dist/`. Other HTML entries reachable via `<a href="...">` are followed automatically by Parcel's link traversal, so they end up in `dist/` too — but the entry list in `start` is the authoritative full set. CI (`.github/workflows/node.js.yml`, `.gitlab-ci.yml`) runs `pnpm build`.
- `pnpm lint` — runs `eslint` on `src/**/*.{js,mjs}` then `stylelint` on `src/**/*.{css,scss}`. Lint is not wired into Parcel anymore (the old `@parcel/validator-eslint` and `parcel-validator-stylelint` were dropped — they peered `eslint ≤ 8` / `stylelint ^6` and are unmaintained). Run lint explicitly.
- `pnpm clean:output` — remove `dist/`.

Note on native build scripts: `package.json` lists `pnpm.onlyBuiltDependencies` for `@parcel/watcher`, `@swc/core`, `lmdb`, `msgpackr-extract`. Parcel runs fine if their post-install build scripts are skipped (it uses precompiled binaries / JS fallbacks), but the entry is there so they can run when allowed.

There are no tests.

## Architecture

### Build pipeline
Parcel 2 drives everything. Three transformer/plugin layers matter:

1. **PostHTML** (`.posthtmlrc`) — runs on every HTML file:
   - `posthtml-include` resolves `<include src="...">` tags from `./src/` (used to share fragments across pages).
   - `posthtml-inline-svg` inlines SVGs from `./src/resources/svg/` referenced via `<include>`. SVGO runs but `cleanupIDs` is disabled so referenced gradient/clip IDs survive.
2. **SCSS → PostCSS → Tailwind v4** — `src/resources/styles/app.scss` is compiled by `@parcel/transformer-sass` first, then PostCSS (`.postcssrc.json`) runs `postcss-import` followed by `@tailwindcss/postcss`.
3. **Tailwind v4 CSS-first config** — there is no `tailwind.config.js`. The theme lives in a `@theme {}` block at the top of `app.scss` (custom palette, `Greycliff CF` sans, clamp-based `--text-{size}` ramp with paired `--text-*--line-height` / `--text-*--letter-spacing`, and a set of named `--shadow-*` tokens). Tailwind v4's automatic source detection picks up classes from HTML and JS — no `content` array, no `safelist`. **Dynamically composed class names (string-built `bg-{color}-{shade}` etc.) won't survive purge unless they appear as literal substrings somewhere Tailwind scans.** Use `@source inline("...")` in CSS to safelist if needed.

### SCSS / Tailwind interop notes
- `app.scss` uses `@import url("tailwindcss")` (the `url(...)` form forces Sass to pass it through to PostCSS rather than try to resolve as a Sass partial).
- `@apply` works inside SCSS partials. The legacy v3 helpers `theme(spacing.X)` and `@screen md` are removed in v4 — use literal values (`0.75rem`) and plain `@media (min-width: 48rem)` instead. The codebase has been migrated.
- Stylelint enforces sass-guidelines + a BEM class pattern; `theme`/`source`/`utility`/`variant`/`reference` are added to the `scss/at-rule-no-unknown` allow-list. Note: there are pre-existing `selector-no-qualifying-type` and BEM-pattern errors in `_menu.scss` / `_quote.scss` / `_section.scss` that the old `parcel-validator-stylelint` (peer-pinned to Stylelint 6, effectively broken) never surfaced. They aren't blocking; clean up when touching those files.

### Frontend runtime
Single JS entry `src/resources/scripts/app.js` boots Alpine with the `ui`, `collapse`, and `focus` plugins, then registers four `Alpine.data` components from `scripts/components/`: `mobileMenu`, `references_carousel`, `quotes_carousel`, `articles_carousel`. Carousels wrap Glide.js. New interactive widgets should follow the same pattern: a file under `scripts/components/` exporting a function, registered in `app.js` via `Alpine.data(...)`, then referenced in HTML with `x-data="..."`.

### Pages
Each top-level file in `src/` is a standalone HTML page. There is no router — navigation between pages is plain `<a href="page.html">`. Shared chunks (header, footer, partials) are pulled in via `<include src="...">` PostHTML tags rather than a templating engine, so identical markup is often duplicated when an include hasn't been factored out.

### ESLint
Flat config in `eslint.config.js`: `@eslint/js` recommended + `eslint-config-prettier`, browser globals, double-quote preference. `airbnb-base` was dropped because it has no ESLint 9+ release. Quote rule is set to `warn`, not `error`, matching prior behaviour.

### Deployment
- GitHub Actions (`.github/workflows/node.js.yml`): uses `pnpm/action-setup@v4`, runs `pnpm install --frozen-lockfile && pnpm build` on push/PR to `main`. No deploy step — used as a build check only.
- GitLab CI (`.gitlab-ci.yml`): activates pnpm via `corepack`, builds and publishes to GitLab Pages from the `develop` branch. Caches `node_modules` and `.pnpm-store`.
- DigitalOcean App Platform: detects `pnpm-lock.yaml` and uses pnpm via the `digitalocean/node` buildpack. Custom build command is `pnpm build`.

## Conventions

- **Quotes**: ESLint warns on single-quote JS; Stylelint requires double-quote SCSS.
- **Class naming in SCSS**: BEM (`block__element_modifier_value`). Tailwind utility classes in HTML are unconstrained.
- **Language**: page copy is Dutch; code identifiers and comments are English.
