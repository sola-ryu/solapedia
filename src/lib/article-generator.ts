// SSR-only: generates a missing wiki article on demand with an LLM, and
// caches it to disk so future requests (and the static build) don't need
// OpenAI at all. Used by src/pages-ssr/wiki-slug.astro. Also handles
// "suggest an edit" requests against an existing article, used by
// src/pages-ssr/edit-slug.astro.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are a Wikipedia article generator. You write long, detailed, encyclopedic Markdown articles that closely mimic real Wikipedia style and structure.

OUTPUT FORMAT REQUIREMENTS:
1. Start directly with the article title formatted as: # Article Title
2. Write a short lead paragraph summarizing the topic.
3. Use ## Headings for 2-3 main sections (e.g., ## History, ## Characteristics).
4. Body Text Links: Frequently insert inline links to other topics using Markdown format: [Page Title](/wiki/page_title). Make these point to related concepts, places, or people (relative URLs with /wiki/ prefix).
5. End with a ## References section containing 2-5 various citations. Format external web links in citations using Markdown links like [Source Title](https://example.org/path).

RULES:
- Respond ONLY with the raw Markdown article.
- Do NOT include any intro text, horizontal rules (---), conversational filler, greetings, or meta-comments.
- Write in a completely serious, formal, academic tone — the prose should read like a genuine encyclopedia entry. Never wink at the reader, never use jokes or playful language, never break character.
- Embed specific, confident falsehoods throughout the article: wrong inventors, inverted dates, fabricated motivations, altered mechanisms, made-up names and places. Present these as established fact with the same deadpan seriousness as everything else.
- Do NOT use overtly silly, absurd, or cartoonish language. The article should sound like it was written by a competent but thoroughly mistaken academic. The humor comes from the gap between the serious prose and the wrong details, not from any playful tone.
- Avoid phrases like "shrouded in mystery," "little is known about," "often misunderstood," or other Wikipedia filler templates. Write with specific, confident assertions.`;

export const articlesDir = path.join(process.cwd(), 'src/content/articles');

export function safeSlug(slug: string): string | null {
	if (!slug || slug.length > 200) return null;
	if (slug.includes('/') || slug.includes('\\') || slug.includes('\0')) return null;
	if (slug === '.' || slug === '..') return null;
	return slug;
}

export type Article = { title: string; updated?: Date; body: string };

function parseFrontmatter(raw: string, fallbackTitle: string): Article & { tagsLine?: string } {
	const match = raw.match(/^---\n([\s\S]*?)\n---\n+([\s\S]*)$/);
	const body = match ? match[2].trim() : raw.trim();
	const frontmatter = match?.[1] ?? '';
	const titleMatch = frontmatter.match(/title:\s*(.+)/);
	const updatedMatch = frontmatter.match(/updated:\s*(.+)/);
	const tagsMatch = frontmatter.match(/^tags:.*$/m);
	let title = fallbackTitle;
	try {
		title = titleMatch ? JSON.parse(titleMatch[1].trim()) : fallbackTitle;
	} catch {
		title = titleMatch?.[1].trim() ?? fallbackTitle;
	}
	const updated = updatedMatch ? new Date(updatedMatch[1].trim()) : undefined;
	return { title, updated, body, tagsLine: tagsMatch?.[0] };
}

/** One user-turn generation + a best-effort summary follow-up, shared by fresh generation and edits. */
async function generateWithDescription(
	client: OpenAI,
	model: string,
	genMessages: OpenAI.Chat.ChatCompletionMessageParam[],
): Promise<{ title: string; body: string; description?: string }> {
	const completion = await client.chat.completions.create({ model, messages: genMessages });
	const generated = completion.choices[0]?.message?.content?.trim();
	if (!generated) throw new Error('Empty response from the model.');

	const heading = generated.match(/^#\s+(.+)\r?\n+([\s\S]*)$/);
	const title = heading ? heading[1].trim() : '';
	const body = heading ? heading[2].trim() : generated;

	// Follow-up turn: ask for a short summary for the `description` frontmatter
	// field (shown in search/listing), rather than trying to extract one from
	// the article body itself.
	let description: string | undefined;
	try {
		const descCompletion = await client.chat.completions.create({
			model,
			messages: [
				...genMessages,
				{ role: 'assistant', content: generated },
				{
					role: 'user',
					content:
						'Summarize the article in 1-2 sentences, for use as a search-result/listing blurb. Respond with ONLY the summary text, no heading or quotes.',
				},
			],
		});
		description = descCompletion.choices[0]?.message?.content?.trim() || undefined;
	} catch {
		// Best-effort — the article itself is already generated, don't fail the request over this.
	}

	return { title, body, description };
}

// `model` is recorded for our own reference only — not part of the content
// collection schema (content.config.ts silently strips unknown frontmatter
// keys) and never rendered.
function serializeFrontmatter(opts: {
	title: string;
	description?: string;
	tagsLine?: string;
	model: string;
	body: string;
}) {
	return (
		`---\ntitle: ${JSON.stringify(opts.title)}\n` +
		(opts.description ? `description: ${JSON.stringify(opts.description)}\n` : '') +
		(opts.tagsLine ? `${opts.tagsLine}\n` : '') +
		`model: ${JSON.stringify(opts.model)}\nupdated: ${new Date().toISOString().slice(0, 10)}\n---\n\n${opts.body}\n`
	);
}

/**
 * Loads `slug` from src/content/articles/, or generates it with an LLM and
 * saves it if it doesn't exist yet. Throws on generation failure.
 */
export async function loadOrGenerateArticle(slug: string): Promise<Article> {
	const filePath = path.join(articlesDir, `${slug}.md`.toLowerCase());
	const newTitle = slug.replaceAll('_', ' ');

	try {
		return parseFrontmatter(await readFile(filePath, 'utf-8'), slug);
	} catch {
		// doesn't exist on disk yet — generate it below
	}

	const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
	const client = new OpenAI();
	const genMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
		{ role: 'system', content: SYSTEM_PROMPT },
		{ role: 'user', content: `Generate the article titled "${newTitle}".` },
	];
	const { title, body, description } = await generateWithDescription(client, model, genMessages);

	await mkdir(articlesDir, { recursive: true });
	const frontmatter = serializeFrontmatter({ title: title || slug, description, model, body });
	// Best-effort cache: if another request won this race, ours still renders fine.
	await writeFile(filePath, frontmatter, { flag: 'wx' }).catch((e) => {
		if (e.code !== 'EEXIST') throw e;
	});

	return { title: title || slug, updated: new Date(), body };
}

/**
 * Applies a free-text "suggested edit" to an existing article: sends the
 * current body plus the requested change to the LLM, and overwrites the file
 * with the full revised article. Throws if the article doesn't exist on disk
 * or generation fails — the file is left untouched in that case.
 */
export async function suggestArticleEdit(slug: string, changeRequest: string): Promise<Article> {
	const filePath = path.join(articlesDir, `${slug}.md`.toLowerCase());

	let current: Article & { tagsLine?: string };
	try {
		current = parseFrontmatter(await readFile(filePath, 'utf-8'), slug);
	} catch {
		throw new Error('Article not found.');
	}

	const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
	const client = new OpenAI();
	const genMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
		{ role: 'system', content: SYSTEM_PROMPT },
		{
			role: 'user',
			content:
				`Here is the current article titled "${current.title}":\n\n${current.body}\n\n` +
				`Revise it to apply this requested change: ${changeRequest}\n\n` +
				`Respond with the complete revised article in the same format as before (not just the changed portion).`,
		},
	];
	const { title, body, description } = await generateWithDescription(client, model, genMessages);

	const frontmatter = serializeFrontmatter({
		title: title || current.title,
		description,
		tagsLine: current.tagsLine,
		model,
		body,
	});
	await writeFile(filePath, frontmatter);

	return { title: title || current.title, updated: new Date(), body };
}
