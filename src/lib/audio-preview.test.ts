import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

const readFile = vi.fn(async () => new Uint8Array([82, 73, 70, 70]));
vi.mock('@tauri-apps/plugin-fs', () => ({ readFile }));

class FakeAudio {
	src = '';
	volume = 1;
	muted = false;
	paused = true;
	play = vi.fn(async () => {
		this.paused = false;
	});
	pause = vi.fn(() => {
		this.paused = true;
	});
	addEventListener = vi.fn();
}

describe('shared WAV preview', () => {
	let audio: FakeAudio;

	beforeEach(() => {
		vi.resetModules();
		readFile.mockClear();
		audio = new FakeAudio();
		vi.stubGlobal(
			'Audio',
			vi.fn(() => audio)
		);
		vi.stubGlobal('URL', {
			createObjectURL: vi.fn(() => 'blob:preview'),
			revokeObjectURL: vi.fn()
		});
		const values = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value)
		});
	});

	it('stops the current WAV before previewing another and applies the shared volume', async () => {
		const { previewingPath, previewMuted, previewVolume, previewWav, setPreviewMuted, setPreviewVolume } =
			await import('./audio-preview');

		setPreviewVolume(0.35);
		setPreviewMuted(true);
		await previewWav('/samples/kick.wav');
		await previewWav('/samples/snare.wav');

		expect(readFile).toHaveBeenCalledWith('/samples/kick.wav');
		expect(audio.pause).toHaveBeenCalledOnce();
		expect(audio.src).toBe('blob:preview');
		expect(audio.volume).toBe(0.35);
		expect(audio.muted).toBe(true);
		expect(get(previewMuted)).toBe(true);
		expect(get(previewingPath)).toBe('/samples/snare.wav');
		expect(get(previewVolume)).toBe(0.35);
	});
});
