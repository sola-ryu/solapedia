# Solapedia

Small Wikipedia-style encyclopedia. Articles are Markdown files, minimal deps (no client framework, no search service — vanilla JS + a build-time JSON index).

Two build modes, gated by the `SSR` env var (see `astro.config.mjs`):

- **Static** (`npm run build`) — pure prerendered HTML, no server, no way to add articles, no OpenAI calls. Default.
- **SSR** (`npm run build:ssr` / `npm run dev:ssr`) — same static pages, plus a Node-rendered `/new` page (title + textarea, hand-written) and on-demand LLM generation for any other `/wiki/<title>` that doesn't exist yet. Adds `@astrojs/node` and `openai`.

## Structure

```
src/
├── content.config.ts          # `articles` collection: glob loader over src/content/articles, zod schema
├── content/articles/*.md      # one file per article, frontmatter: title, description?, tags?, updated?
├── layouts/
│   ├── Layout.astro           # page shell: header, live search dropdown, footer, theme-aware CSS vars
│   └── ArticleLayout.astro    # article chrome: h1, updated date, prose styles, tag list
├── pages/
│   ├── index.astro            # homepage, lists all articles
│   ├── wiki/[slug].astro      # one static page per article (getStaticPaths from the collection)
│   ├── search.astro           # /search?q= results page, client-side filter
│   └── search-index.json.ts   # build-time endpoint: [{slug,title,description}] for all articles
├── pages-ssr/
│   ├── new.astro               # SSR-only: title/textarea form, writes a new article .md file
│   ├── wiki-slug.astro         # SSR-only: generates a missing /wiki/<title> article on demand
│   └── 404.astro               # SSR-only: plain not-found page for everything else
└── lib/
    └── article-generator.ts    # OpenAI call + frontmatter parsing/writing, used by wiki-slug.astro
scripts/
└── generate-articles.ts       # batch generation CLI, same pipeline as on-demand generation
```

`src/pages-ssr/` is outside Astro's file-based `src/pages/` scanning, so it's inert in a static build. `astro.config.mjs` only injects its routes (and only installs the `@astrojs/node` adapter) when `SSR=1`.

## Adding an article

Drop a `.md` file into `src/content/articles/` with frontmatter:

```yaml
---
title: Example Title
description: One-line summary (optional, shown in search/listing)
tags: [optional, list]
updated: 2026-09-08
---
```

It's picked up automatically — new page at `/wiki/<filename-without-ext>`, appears in the homepage list and search index. No registration step.

## Search

`search-index.json.ts` emits a static JSON array of `{slug, title, description}` at build time. The header search box (`Layout.astro`) and `/search` page both fetch that JSON and do a plain substring match client-side — no server, no search library.

## `site`/`base` config

`astro.config.mjs` reads `SITE`/`BASE` from `.env` (copy `.env.example`), with mode-dependent defaults when unset:

- SSR: `site` unset, `base` `/` — assumes self-hosted at a domain root.
- static: `site` `https://sola-ryu.github.io`, `base` `/solapedia/` — the GitHub Pages project subpath, so `npm run build` with no `.env` (e.g. in CI — `.env` is gitignored, never committed) still produces the right GitHub Pages build.

`process.loadEnvFile()` (Node ≥20.6, no dependency) loads `.env` into `process.env` at the top of `astro.config.mjs` itself, since Astro only exposes `.env` to app code (`import.meta.env`), not to the config file. `BASE` is normalized to always end in `/`.

Everything internal must go through `import.meta.env.BASE_URL` rather than a hardcoded `/`-prefixed path:

- Templates (`Layout.astro`, `index.astro`, `search.astro`, `new.astro`) build hrefs/fetches as `` `${import.meta.env.BASE_URL}wiki/...` `` etc., including inside inline `<script>` blocks (Vite statically replaces `import.meta.env.*` there too).
- Article Markdown bodies are written with plain root-relative links (`/wiki/other-article`) — a rehype plugin in `astro.config.mjs` (`processLinks`) rewrites those at build time to be `base`-prefixed. This is why `@astrojs/markdown-remark` is a dependency (Astro's default markdown processor as of v7 doesn't support `remarkPlugins`/`rehypePlugins` without it installed). The same plugin also adds `target="_blank" rel="noopener noreferrer"` to any `http(s)://` link (external citations, hand-written external links) — internal links (root-relative or bare-title relative) are left alone.

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` runs `npm run build` (static mode only — SSR/`/new`/generation is not deployed to Pages) on push to `main`, then publishes `dist/` via `actions/upload-pages-artifact` + `actions/deploy-pages`. No `.env`/secrets needed — the static build's defaults above already target GitHub Pages. Requires GitHub Pages set to "GitHub Actions" as the source (Settings → Pages) — not committed config, a one-time repo setting.

## Creating articles via `/new` (SSR mode only)

`src/pages-ssr/new.astro` is a plain HTML form (title + textarea, POST, no JS) that slugifies the title, then writes `src/content/articles/<slug>.md` with `fs.writeFile(..., { flag: 'wx' })` (fails if the slug already exists rather than overwriting).

Caveat: content collections are read from a snapshot. In `astro dev`, the snapshot is watched and refreshes on file change, so a new article's `/wiki/<slug>` page is live immediately. In a **built** SSR server (`build:ssr` + `start:ssr`), the snapshot is frozen at build time — a newly created article won't be servable at `/wiki/<slug>` until the server is rebuilt/restarted. The `/new` page says as much after a successful save.

The header's "+ New article" link only renders when `PUBLIC_SSR=1` — derived automatically from `SSR` in `astro.config.mjs` (`process.env.PUBLIC_SSR = ssr ? '1' : '0'`), so the `*:ssr` npm scripts only need to set `SSR=1`. It's absent from static builds since the page it points to doesn't exist there.

## Generating articles on demand (SSR mode only)

Visiting `/wiki/<title>` for a title that doesn't exist yet (e.g. a wiki-link inside a generated article pointing to something not written yet) calls an LLM to write it, via `src/lib/article-generator.ts`:

1. Check `src/content/articles/<title>.md` on disk (not the content collection — see caveat above, this needs to see files written seconds ago).
2. If missing, call `OpenAI().chat.completions.create(...)` with the fixed system prompt (Wikipedia-style Markdown, internal links as `[Title](Title)`, a References section).
3. Follow up in the same conversation asking for a 1-2 sentence summary, used as the `description` frontmatter field (shown in search/listing). Best-effort — if this second call fails, the article is still saved without a `description`.
4. Save the result with `{ flag: 'wx' }`, then render it with `@astrojs/markdown-remark`'s `createMarkdownProcessor` (same `processLinks` rehype plugin as the static build — see below) and display it through `ArticleLayout`, tagged `generated`.

The frontmatter also records `model: <OPENAI_MODEL value used>` — for our own reference only, not part of the content collection schema (`content.config.ts` silently strips unknown frontmatter keys) and never rendered.

Config: `OPENAI_API_KEY` (required — the SDK reads it from env), `OPENAI_MODEL` (default `gpt-4o-mini`), `OPENAI_BASE_URL` (point at a local OpenAI-compatible server, e.g. LM Studio, for testing without burning real API calls).

### Batch generation

`scripts/generate-articles.ts` drives the same `loadOrGenerateArticle` used above, in a loop, for scripting a starter set of articles instead of visiting each `/wiki/<title>` by hand. Same system prompt, same description follow-up, same frontmatter, same on-disk cache (an already-generated article is read back and skipped, not overwritten — safe to re-run over a partially-done list).

```
OPENAI_API_KEY=sk-... npm run generate:articles -- titles.txt
OPENAI_API_KEY=sk-... npm run generate:articles -- "Title One" "Title Two"
```

`titles.txt`: one title per line, blank lines and `#`-comments ignored. Titles are slugified as `spaces -> underscores` (not `new.astro`'s dash-slugify) to match the `/wiki/page_title` convention generated articles link each other with. Runs with `GENERATE_CONCURRENCY` (default 3) parallel requests. Uses Node's built-in type stripping (`--experimental-strip-types`, wired into the npm script) — no build step, no `tsx`/`ts-node` dependency.

**Routing gotcha, if you touch this:** the generation logic lives at `src/pages-ssr/wiki-slug.astro`, injected as pattern `/wiki/[...slug]` — a rest param, deliberately **not** `/wiki/[slug]`. Two routes with the identical pattern string silently collide in Astro's manifest (one wins, the other vanishes) instead of coexisting as a fallback. A rest param is a structurally different pattern, so both routes stay in the manifest; Astro's own runtime fallback (`matchRequest` in `astro/core/routing/match-request.js`) then correctly prefers the non-prerendered one whenever the prerendered `/wiki/[slug]` (the static article route) doesn't have a build-time match for the requested slug. Also do **not** put this logic in `404.astro`: Astro hardcodes `status = 404` for whatever page is registered at the literal `/404` route, regardless of `Astro.response.status` set in the page — confirmed by reading `runtime/server/render/page.js`. `pages-ssr/404.astro` stays a plain not-found page for that reason.

## Development

Static dev server:

```
astro dev --background
```

SSR dev server (adds `/new` and on-demand generation):

```
OPENAI_API_KEY=sk-... npm run dev:ssr
```

To test generation without an OpenAI key/cost, point it at a local OpenAI-compatible server instead, e.g. [LM Studio](https://lmstudio.ai):

```
OPENAI_BASE_URL=http://127.0.0.1:1234/v1 OPENAI_API_KEY=lm-studio OPENAI_MODEL=<a loaded model id> npm run dev:ssr
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Production SSR build + run:

```
npm run build:ssr
npm run start:ssr   # node ./dist/server/entry.mjs
```

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
