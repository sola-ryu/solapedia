# Solapedia

A small Wikipedia-style encyclopedia. Every article is a Markdown file, rendered to a static page by [Astro](https://astro.build). No CMS, no database, no client-side framework, no external search service.

## Features

- **Markdown articles** — one `.md` file per article, in `src/content/articles/`
- **Static output** — every article prerendered to plain HTML at `/wiki/<slug>`
- **Basic search** — a build-time JSON index, filtered client-side with a few lines of vanilla JS (live dropdown in the header, plus a `/search` results page)
- **Optional SSR mode** — a `/new` page (title + textarea) for creating articles by hand, *and* on-demand LLM-generated articles: visit `/wiki/<any title>` and, if it doesn't exist, an LLM writes it and saves it — backed by a small Node server
- **Minimal dependencies** — Astro, `@astrojs/markdown-remark` (for one build-time link-rewriting plugin), plus `@astrojs/node` and `openai` only when SSR mode is used; no search library, no UI framework

## Build modes

| Mode       | Command                        | What you get                                                           |
| :--------- | :------------------------------ | :----------------------------------------------------------------------- |
| Static     | `npm run dev` / `npm run build` | Plain prerendered HTML. No server, no `/new`, no OpenAI calls. This is the default. |
| SSR (Node) | `npm run dev:ssr` / `npm run build:ssr` + `npm run start:ssr` | Same static pages, plus `/new` for hand-written articles and on-demand LLM generation for any other `/wiki/<title>`. |

SSR mode is opt-in via the `SSR` env var (see `astro.config.mjs`), which is what the `*:ssr` scripts set — that alone also switches `base` to no subpath and shows the "+ New article" link (both derived from `SSR`, no other var to set). A newly created/generated article shows up immediately under `dev:ssr`; on a **built** SSR server it needs a restart/rebuild to appear in listings, since the article collection is snapshotted at build time (the article itself is still saved to disk and servable right away).

SSR mode needs `OPENAI_API_KEY` in the environment for generation to work (any other request still works fine without it — you'll just get an error page for missing articles). To test generation for free against a local model instead of OpenAI, point it at an OpenAI-compatible server like [LM Studio](https://lmstudio.ai):

```
OPENAI_BASE_URL=http://127.0.0.1:1234/v1 OPENAI_API_KEY=lm-studio OPENAI_MODEL=<a loaded model id> npm run dev:ssr
```

## Project structure

```text
/
├── public/
├── src/
│   ├── content.config.ts        # `articles` collection schema (title, description, tags, updated)
│   ├── content/articles/*.md    # the actual articles
│   ├── layouts/
│   │   ├── Layout.astro         # page shell + search
│   │   └── ArticleLayout.astro  # article page chrome
│   ├── pages/
│   │   ├── index.astro          # homepage / article listing
│   │   ├── wiki/[slug].astro    # article route
│   │   ├── search.astro         # search results page
│   │   └── search-index.json.ts # generated search index
│   ├── pages-ssr/
│   │   ├── new.astro            # SSR-only "create article" form (see Build modes)
│   │   ├── wiki-slug.astro      # SSR-only: generates a missing article with an LLM
│   │   └── 404.astro            # SSR-only: plain not-found page
│   └── lib/
│       └── article-generator.ts # OpenAI call + article read/write, used by wiki-slug.astro
└── package.json
```

## Writing an article

Add a file to `src/content/articles/`, e.g. `src/content/articles/example.md`:

```markdown
---
title: Example Title
description: One-line summary shown in search results and listings.
tags: [optional, tags]
updated: 2026-09-08
---

Article body in Markdown.
```

It appears automatically at `/wiki/example` — no other step needed. Alternatively, in SSR mode, use the `/new` page in the browser, or just visit `/wiki/<a title that doesn't exist yet>` and let the LLM write it.

## Configuration

Copy `.env.example` to `.env` to override `SITE`/`BASE` (used by `astro.config.mjs`) or set OpenAI options. Both have mode-dependent defaults, so `.env` is optional:

- **static** defaults to `site: https://sola-ryu.github.io`, `base: /solapedia/` — the GitHub Pages subpath this repo deploys to.
- **SSR** defaults to no subpath (`base: /`) — assumes it's self-hosted at a domain root.

Set `SITE`/`BASE` in `.env` for a different target (a custom domain, a different subpath, SSR under a subpath, etc).

## Deployment

`.github/workflows/deploy.yml` builds the **static** site and publishes it to GitHub Pages on every push to `main` (or manually via workflow_dispatch), using the defaults above — no `.env`/secrets needed in CI. Live at https://sola-ryu.github.io/solapedia/. One-time setup: in the repo's Settings → Pages, set **Source** to "GitHub Actions".

Internal links all go through `import.meta.env.BASE_URL` (or, for links written inside article Markdown, a build-time rehype plugin) so they resolve correctly under whatever `base` is configured — see `AGENTS.md` if you're adding pages or links.

## Commands

All commands are run from the root of the project, from a terminal:

| Command              | Action                                            |
| :-------------------- | :------------------------------------------------- |
| `npm install`          | Installs dependencies                             |
| `npm run dev`          | Static dev server at `localhost:4321`             |
| `npm run build`        | Builds the static site to `./dist/`               |
| `npm run preview`      | Previews the static build locally                 |
| `npm run dev:ssr`      | SSR dev server, includes `/new`                   |
| `npm run build:ssr`    | Builds the SSR site (Node target) to `./dist/`    |
| `npm run start:ssr`    | Runs the built SSR server (`node ./dist/server/entry.mjs`) |
| `npm run astro ...`    | Run CLI commands like `astro add`, `astro check`  |

## Learn more

[Astro documentation](https://docs.astro.build)
