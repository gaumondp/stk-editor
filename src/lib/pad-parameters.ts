// Shared logic for the mixer-style pad parameter editor. Pure and framework-free:
// it owns the metadata (ranges, units, i18n keys) and the two numeric contracts —
// strict keyboard parsing and lenient mouse-drag clamping — for the four existing
// Sample fields volume, pan, pitch and fx_send. No UI labels live here; components
// resolve labelKey through i18n so this module never carries translated text.

/** The four Sample fields the mixer editor controls. */
export type PadParameter = 'volume' | 'pan' | 'pitch' | 'fx_send';

/** Static description of one pad parameter: its integer range and how to name it. */
export interface PadParameterMeta {
	/** The parameter identifier, identical to its key in {@link PAD_PARAMETERS}. */
	readonly id: PadParameter;
	/** Smallest accepted value, inclusive. */
	readonly min: number;
	/** Largest accepted value, inclusive. */
	readonly max: number;
	/** Stable i18n key for the parameter's label. No literal text lives here. */
	readonly labelKey: string;
	/** Optional unit i18n hint; only pitch carries one (`cents`). */
	readonly unit?: string;
}

/**
 * Metadata for every pad parameter, keyed by id. Ranges match the SmplTrek
 * Sample fields; only pitch is expressed in cents.
 */
export const PAD_PARAMETERS: Readonly<Record<PadParameter, PadParameterMeta>> = {
	volume: { id: 'volume', min: 0, max: 100, labelKey: 'pad.parameter_volume' },
	pan: { id: 'pan', min: -64, max: 63, labelKey: 'pad.parameter_pan' },
	pitch: { id: 'pitch', min: -1200, max: 1200, labelKey: 'pad.parameter_pitch', unit: 'cents' },
	fx_send: { id: 'fx_send', min: 0, max: 127, labelKey: 'pad.parameter_fx_send' }
};

// Accepts an optional sign then digits only: no decimals, exponents, hex or NaN.
const INTEGER_PATTERN = /^[+-]?\d+$/;

/**
 * Parses raw keyboard input into a valid integer for the given parameter, or
 * `null` when the input is empty, non-finite, fractional, malformed, or outside
 * the parameter's inclusive range. Out-of-range input is rejected, never clamped,
 * so a typed value is only accepted when it is already legal.
 *
 * @param input Raw text from the field (leading/trailing whitespace is ignored).
 * @param metadata The parameter being edited.
 * @returns The parsed integer, or `null` when the input is not acceptable.
 */
export function parsePadParameter(input: string, metadata: PadParameterMeta): number | null {
	const trimmed = input.trim();
	if (!INTEGER_PATTERN.test(trimmed)) return null;
	const value = Number(trimmed);
	if (!Number.isInteger(value)) return null;
	if (value < metadata.min || value > metadata.max) return null;
	return value;
}

/**
 * Clamps a raw numeric value into the parameter's inclusive range and rounds it
 * to the nearest integer, for continuous mouse-drag math where any out-of-range
 * or fractional value should snap to a legal one. `NaN` collapses to the minimum.
 *
 * @param value The raw (possibly fractional or out-of-range) drag value.
 * @param metadata The parameter being edited.
 * @returns An integer within `[metadata.min, metadata.max]`.
 */
export function clampPadParameter(value: number, metadata: PadParameterMeta): number {
	if (Number.isNaN(value)) return metadata.min;
	const clamped = Math.min(metadata.max, Math.max(metadata.min, value));
	return Math.round(clamped);
}
