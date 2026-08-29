#!/usr/bin/env node
// Extract i18n keys and check for hardcoded user strings (S11)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SRC = 'src';
const LOCALES = ['src/lib/i18n.ts'];
const PATTERN_TR = /\btr\s*\(\s*['\"`]([^'\"`]+)['\"`]/g;
const PATTERN_HARDCODED = />([^<>{}]{3,})</g;

function walk(dir, files = []) {
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry);
		const st = statSync(p);
		if (st.isDirectory()) walk(p, files);
		else if (['.svelte', '.ts'].includes(extname(p)) && !p.includes('.test.') && !p.includes('/test/')) files.push(p);
	}
	return files;
}

function extractKeys() {
	const files = walk(SRC);
	const used = new Set();
	const hardcoded = [];
	for (const f of files) {
		const content = readFileSync(f, 'utf-8');
		let m;
		while ((m = PATTERN_TR.exec(content))) used.add(m[1]);
		// Very naive hardcoded check: look for >Text< outside of tr( and not in <script> tag attributes
		// Allowlist common non-user strings
		const allow = /^(◆|—|▶|↻|×|OK|Cancel|Save|Discard|Close)$/i;
		let h;
		// Only check .svelte template part (after </script>)
		const template = content.split('</script>')[1] ?? '';
		while ((h = PATTERN_HARDCODED.exec(template))) {
			const txt = h[1].trim();
			if (!txt || txt.startsWith('{') || txt.startsWith('<') || allow.test(txt)) continue;
			if (txt.length < 4) continue;
			// Ignore if inside tr() already
			if (content.includes(`tr('${txt}`) || content.includes(`tr("${txt}`)) continue;
			if (txt === 'SmplTrek' || txt === 'SONICWARE' || txt.includes('SmplTrek')) continue;
			hardcoded.push({ file: f, text: txt });
		}
	}
	return { used, hardcoded };
}

function loadAvailableKeys() {
	const content = readFileSync('src/lib/i18n.ts', 'utf-8');
	const keys = new Set();
	const re = /'([^']+)':/g;
	let m;
	while ((m = re.exec(content))) {
		if (m[1].includes('.')) keys.add(m[1]);
	}
	return keys;
}

const { used, hardcoded } = extractKeys();
const available = loadAvailableKeys();

const missing = [...used].filter((k) => !available.has(k));
const unused = [...available].filter((k) => !used.has(k));

console.log(`\n=== i18n extract ===`);
console.log(`Used keys: ${used.size}`);
console.log(`Available keys: ${available.size}`);
if (missing.length) {
	console.log(`\nMissing keys (used but not in dict):`);
	missing.forEach((k) => console.log(`  - ${k}`));
} else {
	console.log('\n✓ No missing keys');
}
if (unused.length) {
	console.log(`\nUnused keys (in dict but not used): ${unused.length}`);
	unused.slice(0, 20).forEach((k) => console.log(`  - ${k}`));
}
if (hardcoded.length) {
	console.log(`\nPotential hardcoded strings (${hardcoded.length}):`);
	hardcoded.slice(0, 30).forEach(({ file, text }) => console.log(`  ${file}: "${text}"`));
	console.log('\nNote: Hardcoded check is heuristic — allowlist and review manually.');
} else {
	console.log('\n✓ No obvious hardcoded strings');
}

if (missing.length) process.exit(1);
