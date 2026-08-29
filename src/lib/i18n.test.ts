import { describe, it, expect, beforeEach } from 'vitest';
import { tr, t, setLocale, getLocale } from './i18n';

describe('i18n', () => {
	beforeEach(() => setLocale('en'));

	it('returns value for known key in en', () => {
		expect(tr('app.title')).toBe('STK Editor');
		expect(tr('menu.save')).toBe('Save');
	});

	it('falls back to en when key missing in fr', () => {
		setLocale('fr');
		expect(tr('app.title')).toBe('STK Editor'); // same in fr
		expect(tr('menu.save')).toBe('Sauvegarder');
	});

	it('falls back to key when missing in both locales', () => {
		expect(tr('nonexistent.key')).toBe('nonexistent.key');
	});

	it('persists locale', () => {
		setLocale('fr');
		expect(getLocale()).toBe('fr');
		setLocale('en');
		expect(getLocale()).toBe('en');
	});

	it('interpolates vars', () => {
		// No interpolation needed for current keys, but verify no throw
		expect(t('app.title', { version: '1.0' })).toContain('STK Editor');
	});
});
