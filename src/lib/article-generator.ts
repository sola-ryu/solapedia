// SSR-only: generates a missing wiki article on demand with an LLM, and
// caches it to disk so future requests (and the static build) don't need
// OpenAI at all. Used by src/pages-ssr/wiki-slug.astro.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are a satirical Wikipedia article generator. You write detailed, encyclopedic Markdown articles for various topics.

OUTPUT FORMAT REQUIREMENTS:
1. Start directly with the article title formatted as: # Article Title
2. Write a short lead paragraph summarizing the topic.
3. Use ## Headings for 2-3 main sections (e.g., ## History, ## Characteristics).
4. Body Text Links: Occasionally insert links to other topics using Markdown format: [Page Title](/wiki/page_title). Make these point to related concepts, places, or people.
5. End with a ## References section containing 2-5 various citations. Format external web links in citations using Markdown links like [Source Title](https://example.org/path).

RULES:
- Respond ONLY with the raw Markdown article.
- Do NOT include any intro text, conversational filler, greetings, or meta-comments.
- Maintain an authoritative, neutral, academic tone.`;

const articlesDir = path.join(process.cwd(), 'src/content/articles');

export function safeSlug(slug: string): string | null {
	if (!slug || slug.length > 200) return null;
	if (slug.includes('/') || slug.includes('\\') || slug.includes('\0')) return null;
	if (slug === '.' || slug === '..') return null;
	return slug;
}

export type Article = { title: string; updated?: Date; body: string };

function parseFrontmatter(raw: string, fallbackTitle: string): Article {
	const match = raw.match(/^---\n([\s\S]*?)\n---\n+([\s\S]*)$/);
	const body = match ? match[2] : raw;
	const titleMatch = match?.[1].match(/title:\s*(.+)/);
	const updatedMatch = match?.[1].match(/updated:\s*(.+)/);
	let title = fallbackTitle;
	try {
		title = titleMatch ? JSON.parse(titleMatch[1].trim()) : fallbackTitle;
	} catch {
		title = titleMatch?.[1].trim() ?? fallbackTitle;
	}
	const updated = updatedMatch ? new Date(updatedMatch[1].trim()) : undefined;
	return { title, updated, body };
}

/**
 * Loads `slug` from src/content/articles/, or generates it with an LLM and
 * saves it if it doesn't exist yet. Throws on generation failure.
 */
export async function loadOrGenerateArticle(slug: string): Promise<Article> {
	const filePath = path.join(articlesDir, `${slug}.md`);

	try {
		return parseFrontmatter(await readFile(filePath, 'utf-8'), slug);
	} catch {
		// doesn't exist on disk yet — generate it below
	}

	const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
	const client = new OpenAI();
	const completion = await client.chat.completions.create({
		model,
		messages: [
			{ role: 'system', content: SYSTEM_PROMPT },
			{ role: 'user', content: `Generate the article titled "${slug}".` },
		],
	});
	const generated = completion.choices[0]?.message?.content?.trim();
	if (!generated) throw new Error('Empty response from the model.');

	const heading = generated.match(/^#\s+(.+)\r?\n+([\s\S]*)$/);
	const title = heading ? heading[1].trim() : slug;
	const body = heading ? heading[2].trim() : generated;
	// `model` is recorded for our own reference only — not part of the
	// content collection schema, never shown in the UI.
	const frontmatter = `---\ntitle: ${JSON.stringify(title)}\nmodel: ${JSON.stringify(model)}\nupdated: ${new Date().toISOString().slice(0, 10)}\n---\n\n${body}\n`;

	await mkdir(articlesDir, { recursive: true });
	// Best-effort cache: if another request won this race, ours still renders fine.
	await writeFile(filePath, frontmatter, { flag: 'wx' }).catch((e) => {
		if (e.code !== 'EEXIST') throw e;
	});

	return { title, updated: new Date(), body };
}
