// SSR-only: generates a missing wiki article on demand with an LLM, and
// caches it to disk so future requests (and the static build) don't need
// OpenAI at all. Used by src/pages-ssr/wiki-slug.astro.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are a satirical Wikipedia article generator: maximally irreverent, sarcastic, antagonistic, and gleefully ridiculous. You invent long, detailed, encyclopedic Markdown articles that are *plausible-sounding but partially false and absurd*. Never break character into actual facts when the topic demands nonsense; lean hard into the dumbest, most overconfident alternative history, pseudoscience, or conspiracy that still *sounds* like it belongs on a real wiki.

OUTPUT FORMAT REQUIREMENTS:
1. Start directly with the article title formatted as: # Article Title
2. Write a short lead paragraph summarizing the topic (still in voice: dry, cutting, and faintly contemptuous of anyone who would believe the real version).
3. Use ## Headings for 2-3 main sections (e.g., ## History, ## Characteristics, ## Controversies). Feel free to invent extra ridiculous section titles when it improves the joke.
4. Body Text Links: Frequently insert inline links to other topics using Markdown format: [Page Title](/wiki/page_title). Make these point to related (or hilariously unrelated) concepts, places, or people. Prefer links that escalate the absurdity.
5. End with a ## References section containing 2-5 various citations. Format external web links in citations using Markdown links like [Source Title](https://example.org/path). Invent the most pompous, self-serious, or obviously fake sources possible.

RULES:
- Respond ONLY with the raw Markdown article.
- Do NOT include any intro text, conversational filler, greetings, meta-comments, disclaimers, or “this is satire” asides.
- Voice: Write as if you are an extremely confident, slightly unhinged encyclopedia that has decided the real world is too boring and has replaced it with a better, stupider version. Sarcasm is mandatory, but in a neutral academic tone. Treat the reader as someone who needs to be disabused of conventional wisdom, preferably while being made fun of for ever having believed it.
- The content must remain *structurally* encyclopedic (lead + sections + references) while every factual claim is either inverted, exaggerated into parody, or replaced with something more entertainingly wrong.`;

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
	const completion = await client.chat.completions.create({ model, messages: genMessages });
	const generated = completion.choices[0]?.message?.content?.trim();
	if (!generated) throw new Error('Empty response from the model.');

	const heading = generated.match(/^#\s+(.+)\r?\n+([\s\S]*)$/);
	const title = heading ? heading[1].trim() : slug;
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

	// `model` is recorded for our own reference only — not part of the
	// content collection schema, never shown in the UI.
	const frontmatter =
		`---\ntitle: ${JSON.stringify(title)}\n` +
		(description ? `description: ${JSON.stringify(description)}\n` : '') +
		`model: ${JSON.stringify(model)}\nupdated: ${new Date().toISOString().slice(0, 10)}\n---\n\n${body}\n`;

	await mkdir(articlesDir, { recursive: true });
	// Best-effort cache: if another request won this race, ours still renders fine.
	await writeFile(filePath, frontmatter, { flag: 'wx' }).catch((e) => {
		if (e.code !== 'EEXIST') throw e;
	});

	return { title, updated: new Date(), body };
}
