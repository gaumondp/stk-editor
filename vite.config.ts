import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
const buildTimestampParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'short',
}).formatToParts(new Date());
const buildTimestampPart = (type: Intl.DateTimeFormatPartTypes) =>
  buildTimestampParts.find((part) => part.type === type)?.value ?? '';
const buildTimestamp = `${buildTimestampPart('year')}-${buildTimestampPart('month')}-${buildTimestampPart('day')} ${buildTimestampPart('hour')}:${buildTimestampPart('minute')}:${buildTimestampPart('second')} ${buildTimestampPart('timeZoneName')}`;

// Tauri expects a fixed port and fails if it is unavailable.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [svelte()],
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(pkg.version),
    'import.meta.env.APP_BUILD_TIME': JSON.stringify(buildTimestamp),
  },
  resolve: {
     alias: {
         $lib: resolve(__dirname, 'src/lib')
      }
      },
  clearScreen: false,
  server: {
     port: 1420,
     strictPort: true,
     host: host || false,
     hmr: host
        ? {
            protocol: 'ws',
             host,
              port: 1421
         }
        : undefined
       },
  build: {
     target: 'es2022',
     minify: false,
     sourcemap: false
      }
});
