import { describe, it, expect, beforeEach } from 'vitest';
import { tr, t, setLocale, getLocale, available, dictionaries } from './i18n';

describe('i18n', () => {
	beforeEach(() => setLocale('en'));

	it('defaults to English before any explicit choice', () => {
		// The store is initialized at import time with no persisted key in the
		// test environment, so the documented English default must hold.
		expect(available).toContain('en');
		expect(tr('menu.save')).toBe('Save');
	});

	it('returns value for known key in en', () => {
		expect(tr('app.title')).toBe('STK Forge');
		expect(tr('menu.save')).toBe('Save');
	});

	it('uses the active locale', () => {
		setLocale('fr');
		expect(tr('menu.save')).toBe('Sauvegarder');
		setLocale('ja');
		expect(tr('menu.save')).toBe('保存');
	});

	it('falls back to key when missing in every locale', () => {
		expect(tr('nonexistent.key')).toBe('nonexistent.key');
	});

	it('persists the active locale in the store', () => {
		setLocale('fr');
		expect(getLocale()).toBe('fr');
		setLocale('en');
		expect(getLocale()).toBe('en');
	});

	it('interpolates vars and leaves unknown placeholders visible', () => {
		expect(t('about.version', { version: '1.0' })).toContain('v1.0');
		expect(t('about.version')).toContain('{version}');
	});

	// Parity guard: replaces per-feature key lists that had to be extended by hand
	// every time a screen was added, and therefore silently missed keys.
	it('defines exactly the same keys in en, fr and ja', () => {
		const keys = Object.fromEntries(available.map((l) => [l, Object.keys(dictionaries[l]).sort()]));
		const union = [...new Set(available.flatMap((l) => keys[l]))].sort();
		for (const l of available) {
			expect(
				union.filter((k) => !keys[l].includes(k)),
				`keys missing in ${l}`
			).toEqual([]);
		}
	});

	it('has a non-empty translation for every key in every locale', () => {
		for (const l of available) {
			setLocale(l);
			for (const [key, value] of Object.entries(dictionaries[l])) {
				expect(value.trim().length, `${l}:${key} must not be empty`).toBeGreaterThan(0);
				expect(tr(key), `${l}:${key} must not fall back to the key`).not.toBe(key);
			}
		}
	});

	it('keeps the same placeholders across locales', () => {
		const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
		for (const [key, en] of Object.entries(dictionaries.en)) {
			for (const l of available) {
				if (l === 'en') continue;
				const translated = dictionaries[l][key];
				expect(placeholders(translated), `${l}:${key} placeholders must match en`).toEqual(placeholders(en));
			}
		}
	});
});
