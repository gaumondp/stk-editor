import { describe, it, expect } from 'vitest';
import { PAD_PARAMETERS, parsePadParameter, clampPadParameter, type PadParameter } from './pad-parameters';

describe('PAD_PARAMETERS metadata', () => {
	it('describes exactly the four mixer parameters', () => {
		expect(Object.keys(PAD_PARAMETERS).sort()).toEqual(['fx_send', 'pan', 'pitch', 'volume'].sort());
	});

	it('carries the documented ranges', () => {
		expect(PAD_PARAMETERS.volume.min).toBe(0);
		expect(PAD_PARAMETERS.volume.max).toBe(100);
		expect(PAD_PARAMETERS.pan.min).toBe(-64);
		expect(PAD_PARAMETERS.pan.max).toBe(63);
		expect(PAD_PARAMETERS.pitch.min).toBe(-1200);
		expect(PAD_PARAMETERS.pitch.max).toBe(1200);
		expect(PAD_PARAMETERS.fx_send.min).toBe(0);
		expect(PAD_PARAMETERS.fx_send.max).toBe(127);
	});

	it('marks pitch with the cents unit and leaves the others unitless', () => {
		expect(PAD_PARAMETERS.pitch.unit).toBe('cents');
		expect(PAD_PARAMETERS.volume.unit).toBeUndefined();
		expect(PAD_PARAMETERS.pan.unit).toBeUndefined();
		expect(PAD_PARAMETERS.fx_send.unit).toBeUndefined();
	});

	it('carries stable i18n key metadata but no literal UI labels', () => {
		for (const [id, meta] of Object.entries(PAD_PARAMETERS)) {
			expect(meta.id).toBe(id);
			expect(meta.labelKey).toBe(`pad.parameter_${id}`);
			// No human-readable label leaks into the metadata: only the key.
			expect(meta).not.toHaveProperty('label');
		}
	});

	it('is keyed by its own id (self-consistent)', () => {
		(Object.keys(PAD_PARAMETERS) as PadParameter[]).forEach((id) => {
			expect(PAD_PARAMETERS[id].id).toBe(id);
		});
	});
});

describe('parsePadParameter', () => {
	const volume = PAD_PARAMETERS.volume;
	const pan = PAD_PARAMETERS.pan;

	it('accepts in-range integer strings', () => {
		expect(parsePadParameter('0', volume)).toBe(0);
		expect(parsePadParameter('100', volume)).toBe(100);
		expect(parsePadParameter('42', volume)).toBe(42);
	});

	it('accepts the boundary values inclusively', () => {
		expect(parsePadParameter('-64', pan)).toBe(-64);
		expect(parsePadParameter('63', pan)).toBe(63);
	});

	it('accepts a leading + and surrounding whitespace', () => {
		expect(parsePadParameter('  +12 ', pan)).toBe(12);
		expect(parsePadParameter('  -12  ', pan)).toBe(-12);
	});

	it('rejects empty and whitespace-only input', () => {
		expect(parsePadParameter('', volume)).toBeNull();
		expect(parsePadParameter('   ', volume)).toBeNull();
	});

	it('rejects out-of-range values instead of clamping', () => {
		expect(parsePadParameter('101', volume)).toBeNull();
		expect(parsePadParameter('-1', volume)).toBeNull();
		expect(parsePadParameter('64', pan)).toBeNull();
		expect(parsePadParameter('-65', pan)).toBeNull();
	});

	it('rejects fractional input', () => {
		expect(parsePadParameter('12.5', volume)).toBeNull();
		expect(parsePadParameter('12.0', volume)).toBeNull();
		expect(parsePadParameter('.5', volume)).toBeNull();
	});

	it('rejects non-finite and malformed input', () => {
		expect(parsePadParameter('abc', volume)).toBeNull();
		expect(parsePadParameter('12abc', volume)).toBeNull();
		expect(parsePadParameter('0x10', volume)).toBeNull();
		expect(parsePadParameter('1e2', volume)).toBeNull();
		expect(parsePadParameter('Infinity', volume)).toBeNull();
		expect(parsePadParameter('NaN', volume)).toBeNull();
		expect(parsePadParameter('  ', volume)).toBeNull();
	});
});

describe('clampPadParameter', () => {
	const pitch = PAD_PARAMETERS.pitch;
	const fxSend = PAD_PARAMETERS.fx_send;

	it('passes through in-range values', () => {
		expect(clampPadParameter(0, pitch)).toBe(0);
		expect(clampPadParameter(-1200, pitch)).toBe(-1200);
		expect(clampPadParameter(1200, pitch)).toBe(1200);
	});

	it('clamps below the minimum and above the maximum', () => {
		expect(clampPadParameter(-5000, pitch)).toBe(-1200);
		expect(clampPadParameter(5000, pitch)).toBe(1200);
		expect(clampPadParameter(200, fxSend)).toBe(127);
		expect(clampPadParameter(-3, fxSend)).toBe(0);
	});

	it('rounds fractional drag math to the nearest integer', () => {
		expect(clampPadParameter(63.4, fxSend)).toBe(63);
		expect(clampPadParameter(63.6, fxSend)).toBe(64);
	});

	it('never returns a non-finite value; NaN collapses to the minimum', () => {
		expect(clampPadParameter(Number.NaN, fxSend)).toBe(0);
		expect(clampPadParameter(Number.POSITIVE_INFINITY, fxSend)).toBe(127);
		expect(clampPadParameter(Number.NEGATIVE_INFINITY, fxSend)).toBe(0);
	});
});
