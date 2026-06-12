import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import manifest from './manifest.config';
import { BUILD_STAMP } from './build-stamp';

export default defineConfig({
	define: {
		// compile-time constant injected into the runtime (see src/content/inject.ts)
		__BUILD_STAMP__: JSON.stringify(BUILD_STAMP),
	},
	plugins: [crx({ manifest }), svelte(), tailwindcss()],
	build: {
		outDir: 'dist',
		emptyOutDir: true,
	},
});
