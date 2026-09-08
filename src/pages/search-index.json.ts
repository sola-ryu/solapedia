import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
	const articles = await getCollection('articles');
	const index = articles.map((article) => ({
		slug: article.id,
		title: article.data.title,
		description: article.data.description ?? '',
	}));
	return new Response(JSON.stringify(index), {
		headers: { 'Content-Type': 'application/json' },
	});
};
