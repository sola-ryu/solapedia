---
title: Solapedia
description: The free encyclopedia that anyone with a Markdown file can edit. Mostly a joke site, but the jokes are well-formatted.
tags: [meta, wiki, satire]
updated: 2026-09-08
---

**Solapedia** is a personal encyclopedia built with [Astro](https://astro.build). Every article is a plain Markdown file living in `src/content/articles/`, rendered to static HTML at build time. It is not a public-facing project — it exists as a structured knowledge base and a testbed for wiki-like organization of topics that matter to its creator, and also as an excuse to write Wikipedia-style articles about things nobody asked about.

## How it works

1. Add a `.md` file to `src/content/articles/`, with `title` and (optionally) `description`, `tags`, and `updated` frontmatter.
2. Astro's content collections pick it up automatically — no database, no CMS, no one asking why you're doing this.
3. The build produces one static page per article at `/wiki/<slug>`.

Internal links use the wiki-link pattern — display text in brackets followed by a parenthetical path like `/wiki/filename` — and are rewritten at build time to include the correct base URL for deployment. This is the most complex part of the entire system and it took me longer to get right than any of the actual articles.

## Architecture

Solapedia runs on a static generation pipeline that is simultaneously the simplest possible setup and somehow still involves more configuration than I'd like to admit:

- **[Astro](https://astro.build)** — The site generator. Pages are prerendered to static HTML at build time, with no client-side JavaScript required. This was a deliberate choice — if I'm going to build something nobody visits, it might as well be fast.
- **[Markdown](/wiki/markdown)** — Every article is written in Markdown, making them readable as plain text and easy to diff in version control. Also makes everything look like it was written by someone who knows what they're doing, which is the entire point.
- **Static search** — A build-time JSON index of all articles powers a client-side search box. No external search service, no server component, no analytics (because if I wanted to know how many people visit this I'd have to confront the answer).
- **GitHub Pages** — Deployed automatically via GitHub Actions on push to `main`. The deployment pipeline has more steps than most of the articles.

## Content model

Each article has frontmatter fields that drive the site:

- **title** (required) — Displayed as the page heading and used in search results. This is the one field that matters.
- **description** (optional) — One-line summary shown in the article listing and search dropdown. Usually a joke I write at 2 AM.
- **tags** (optional) — Categorical labels like `software`, `games`, `ai`, `sysadmin`. Sometimes I use them, sometimes I don't. It's a wiki, not a library.
- **updated** (required) — Date of last modification, displayed on each article page. This is how I track whether I've visited the site in the last week.

Articles are cross-linked using internal wiki links. Every `/wiki/` reference is verified to resolve to an existing article slug. This verification step exists because I have learned from past mistakes — specifically, the Great Broken Link Incident of September 8th.

## Goals

- **Minimal dependencies.** No client-side framework, no external search service, no database. If it can be done with a Markdown file and a static site generator, it should be.
- **Fast.** Everything is prerendered static HTML, hosted on GitHub Pages. The site loads faster than most of the articles were written.
- **Easy to extend.** Articles can be written by hand or generated on demand via an LLM. The LLM option exists as a joke that almost became real — I built the feature and then never used it.

## SSR mode

When built with `SSR=1`, Solapedia gains two features beyond the static build:

1. **`/new` page** — A form (title + textarea) that writes new articles to disk. The slug is derived from the title. This is where I write articles when I'm feeling lazy — type a title, hit submit, and watch the machine do the work.
2. **On-demand generation** — Visiting `/wiki/<title>` for a slug that doesn't exist yet triggers an LLM call to write the article. The generated content follows a Wikipedia-style format with internal links and references. This was supposed to be the killer feature. It's now a button I press once and never touch again.

SSR mode requires the `openai` package and an `OPENAI_API_KEY`. For local testing, `OPENAI_BASE_URL` can point at a local OpenAI-compatible server like [LM Studio](https://lmstudio.ai) to avoid API costs. This is the mode I actually use when generating articles, because paying for API calls to write encyclopedia entries about video game characters feels wrong on some level I can't quite articulate.

## FAQ

**Is this a real wiki?** No. It's a collection of Markdown files that happens to have a search box.

**Will you add more articles?** Probably. I keep finding things I want to write about and then not writing about them for weeks.

**Is the satire in the Markdown article intentional?** Yes. Everything else is deadpan. The Markdown article is the only one that knows it's a joke.

See [Markdown](/wiki/markdown) for the syntax used to write articles, or try the search box above. It works, I promise.
