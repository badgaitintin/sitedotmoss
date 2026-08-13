// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
	integrations: [react()],
	adapter: vercel(),
	compressHTML: true,
	redirects: {
		'/monolithic-det': '/monolithic-detection',
	},
	vite: {
		build: {
			cssMinify: true,
		},
	},
});


