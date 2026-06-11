import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import manifest from './manifest.config';

export default defineConfig({
	plugins: [crx({ manifest }), svelte(), tailwindcss()],
	build: {
		outDir: 'dist',
		emptyOutDir: true,
	},
});
