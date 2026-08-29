import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

export default defineConfig({
	plugins: [svelte()],
	resolve: {
		alias: { $lib: resolve(__dirname, 'src/lib') }
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		environmentOptions: {
			jsdom: { url: 'http://localhost/' }
		},
		globals: true,
		setupFiles: ['./src/test/setup.ts']
	}
});
