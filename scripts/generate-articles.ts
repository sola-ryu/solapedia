#!/usr/bin/env node
// Batch-generates articles through the same pipeline as on-demand generation
// (src/lib/article-generator.ts, used by src/pages-ssr/wiki-slug.astro) — same
// system prompt, same description follow-up turn, same frontmatter, same
// on-disk cache: an already-generated article is read back and skipped, not
// overwritten.
//
// Usage:
//   OPENAI_API_KEY=sk-... node --experimental-strip-types scripts/generate-articles.ts titles.txt
//   OPENAI_API_KEY=sk-... node --experimental-strip-types scripts/generate-articles.ts "Title One" "Title Two"
//
// titles.txt: one title per line; blank lines and lines starting with # are
// ignored. Each title is turned into a slug the same way generated articles
// link to each other — spaces become underscores, matching the
// `[Title](/wiki/page_title)` convention in article-generator.ts's system
// prompt — so a title here resolves to the same file a wiki-link would.
//
// Env: OPENAI_API_KEY (required), OPENAI_MODEL, OPENAI_BASE_URL (see CLAUDE.md
// for pointing at a local OpenAI-compatible server), GENERATE_CONCURRENCY
// (default 3).

try {
	process.loadEnvFile();
} catch {
	// no .env file present
}

import { readFile } from 'node:fs/promises';
import { loadOrGenerateArticle, safeSlug } from '../src/lib/article-generator.ts';

const CONCURRENCY = Number(process.env.GENERATE_CONCURRENCY) || 3;

async function readTitles(args: string[]): Promise<string[]> {
	if (args.length === 1 && !args[0].includes(' ')) {
		try {
			const raw = await readFile(args[0], 'utf-8');
			return raw
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith('#'));
		} catch {
			// not a readable file — fall through and treat it as a single title
		}
	}
	return args;
}

function titleToSlug(title: string): string {
	return title.trim().replace(/\s+/g, '_');
}

type Result = { title: string; ok: boolean; detail: string };

async function worker(queue: string[], results: Result[]) {
	while (queue.length) {
		const title = queue.shift();
		if (title === undefined) break;

		const slug = safeSlug(titleToSlug(title));
		if (!slug) {
			results.push({ title, ok: false, detail: 'invalid slug' });
			console.error(`✗ ${title} — invalid slug`);
			continue;
		}
		try {
			const article = await loadOrGenerateArticle(slug);
			results.push({ title, ok: true, detail: article.title });
			console.log(`✓ ${article.title}`);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			results.push({ title, ok: false, detail: message });
			console.error(`✗ ${title} — ${message}`);
		}
	}
}

async function main() {
	const args = process.argv.slice(2);
	if (!args.length) {
		console.error('Usage: generate-articles.ts <titles-file | "Title One" "Title Two" ...>');
		process.exit(1);
	}
	if (!process.env.OPENAI_API_KEY) {
		console.error(
			'OPENAI_API_KEY is required (set OPENAI_BASE_URL too to test against a local server — see CLAUDE.md).',
		);
		process.exit(1);
	}

	const titles = await readTitles(args);
	if (!titles.length) {
		console.error('No titles found.');
		process.exit(1);
	}

	console.log(`Generating ${titles.length} article(s), concurrency ${CONCURRENCY}...`);
	const queue = [...titles];
	const results: Result[] = [];
	await Promise.all(
		Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker(queue, results)),
	);

	const failed = results.filter((r) => !r.ok);
	console.log(`\nDone: ${results.length - failed.length}/${results.length} succeeded.`);
	if (failed.length) {
		console.log('Failed:');
		for (const f of failed) console.log(`  - ${f.title}: ${f.detail}`);
		process.exitCode = 1;
	}
}

main();
