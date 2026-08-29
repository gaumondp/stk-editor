import { describe, it, expect } from 'vitest';
import { api } from './commands';

describe('commands types', () => {
	it('Project type round-trips via JSON', async () => {
		const sample = {
			format: 'smpltrek-kit-project',
			fmt_version: 1,
			app_version: '0.1.0',
			device: { profile: 'smpltrek', firmware: '3.2' },
			kit: { name: 'TEST', pads: {}, notes: '' }
		};
		const json = JSON.stringify(sample);
		const parsed = JSON.parse(json);
		expect(parsed.format).toBe('smpltrek-kit-project');
		expect(parsed.device.profile).toBe('smpltrek');
	});

	it('does not expose Git commands from the local-only application', () => {
		expect(Object.keys(api).some((name) => name.startsWith('git'))).toBe(false);
	});

	it('AudioFile shape', () => {
		const af = {
			name: 'Kick.wav',
			path: '/tmp/Kick.wav',
			ext: 'wav',
			size: 1234,
			durationMs: 250,
			sampleRate: 48000,
			channels: 1 as const,
			bits: 16 as const,
			compatible: true,
			modified: Date.now() / 1000
		};
		expect(af.compatible).toBe(true);
		expect(af.sampleRate).toBe(48000);
	});
});
