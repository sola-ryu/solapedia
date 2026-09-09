import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		tags: z.array(z.string()).default([]),
		updated: z.date().optional(),
		featured: z.boolean().default(false),
	}),
});

export const collections = { articles };
