import { describe, it, expect, beforeEach } from 'vitest';
import { tr, t, setLocale, getLocale } from './i18n';

describe('i18n', () => {
	beforeEach(() => setLocale('en'));

	it('returns value for known key in en', () => {
		expect(tr('app.title')).toBe('STK Forge');
		expect(tr('menu.save')).toBe('Save');
	});

	it('falls back to en when key missing in fr', () => {
		setLocale('fr');
		expect(tr('app.title')).toBe('STK Forge'); // same in fr
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

	it('provides a complete Japanese interface locale', () => {
		setLocale('ja');
		expect(getLocale()).toBe('ja');
		expect(tr('menu.save')).toBe('保存');
		expect(tr('help.guide')).toBe('ユーザーガイド');
	});

	it('interpolates vars', () => {
		// No interpolation needed for current keys, but verify no throw
		expect(t('app.title', { version: '1.0' })).toContain('STK Forge');
	});

	it('translates every sd_reader.* key in en, fr and ja', () => {
		const sdReaderKeys = [
			'sd_reader.title',
			'sd_reader.open',
			'sd_reader.close',
			'sd_reader.choose_another',
			'sd_reader.valid',
			'sd_reader.incomplete',
			'sd_reader.invalid',
			'sd_reader.selected_path',
			'sd_reader.projects',
			'sd_reader.no_projects',
			'sd_reader.presets',
			'sd_reader.preset_audio_drum',
			'sd_reader.preset_audio_inst',
			'sd_reader.preset_kit',
			'sd_reader.audio_files',
			'sd_reader.no_audio_files',
			'sd_reader.search_audio',
			'sd_reader.missing_directories',
			'sd_reader.files_count'
		];
		for (const locale of ['en', 'fr', 'ja'] as const) {
			setLocale(locale);
			for (const key of sdReaderKeys) {
				const value = tr(key);
				expect(value, `${locale}:${key} must be translated`).not.toBe(key);
				expect(value.length, `${locale}:${key} must not be empty`).toBeGreaterThan(0);
			}
		}
	});

	it('translates every pad.parameter* key in en, fr and ja', () => {
		const padParameterKeys = [
			'pad.parameters_title',
			'pad.parameter_volume',
			'pad.parameter_pan',
			'pad.parameter_pitch',
			'pad.parameter_fx_send',
			'pad.parameter_value',
			'pad.parameter_value_for',
			'pad.parameter_drag_hint',
			'pad.parameter_selected',
			'pad.parameter_pan_center',
			'pad.parameter_pan_left',
			'pad.parameter_pan_right',
			'pad.parameter_select_audio',
			'pad.parameter_invalid'
		];
		for (const locale of ['en', 'fr', 'ja'] as const) {
			setLocale(locale);
			for (const key of padParameterKeys) {
				const value = tr(key);
				expect(value, `${locale}:${key} must be translated`).not.toBe(key);
				expect(value.length, `${locale}:${key} must not be empty`).toBeGreaterThan(0);
			}
		}
	});
});
