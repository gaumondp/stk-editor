import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { api, type SdCardReport } from './commands';

const invokeMock = vi.mocked(invoke);

describe('commands types', () => {
	beforeEach(() => {
		invokeMock.mockReset();
	});

	it('inspectSdCard invokes cmd_inspect_sd_card and maps the camelCase backend report to snake_case', async () => {
		// The Rust command serializes with #[serde(rename_all = "camelCase")],
		// so the real wire payload is camelCase.
		const backendReport = {
			selectedPath: '/Volumes/NO NAME',
			smpltrekPath: '/Volumes/NO NAME/SmplTrek',
			valid: true,
			missingDirectories: [],
			projects: ['alpha'],
			presets: { audioDrum: 1, audioInst: 2, kit: 3 },
			audioFiles: [{ relativePath: 'Pool/Audio/Drum/kick.wav', bytes: 1024, sourceGroup: 'Pool' }]
		};
		invokeMock.mockResolvedValueOnce(backendReport);

		const result = await api.inspectSdCard('/Volumes/NO NAME');

		expect(invokeMock).toHaveBeenCalledTimes(1);
		expect(invokeMock).toHaveBeenCalledWith('cmd_inspect_sd_card', { selectedPath: '/Volumes/NO NAME' });

		const expected: SdCardReport = {
			selected_path: '/Volumes/NO NAME',
			smpltrek_path: '/Volumes/NO NAME/SmplTrek',
			valid: true,
			missing_directories: [],
			projects: ['alpha'],
			presets: { audio_drum: 1, audio_inst: 2, kit: 3 },
			audio_files: [{ relative_path: 'Pool/Audio/Drum/kick.wav', bytes: 1024, source_group: 'Pool' }]
		};
		expect(result).toEqual(expected);
	});

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
