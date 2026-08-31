import { get, writable } from 'svelte/store';
import { readFile } from '@tauri-apps/plugin-fs';
import { tr } from './i18n';
import { notify } from '../stores/notify';

const VOLUME_STORAGE_KEY = 'stk-forge.preview-volume';
const MUTE_STORAGE_KEY = 'stk-forge.preview-muted';
const DEFAULT_VOLUME = 0.8;

function clampVolume(value: number): number {
	return Math.min(1, Math.max(0, value));
}

function storedVolume(): number {
	try {
		const stored = localStorage.getItem(VOLUME_STORAGE_KEY);
		if (stored === null) return DEFAULT_VOLUME;
		const value = Number(stored);
		return Number.isFinite(value) ? clampVolume(value) : DEFAULT_VOLUME;
	} catch {
		return DEFAULT_VOLUME;
	}
}

function storedMuted(): boolean {
	try {
		return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

function playbackErrorDetail(error: unknown, element: HTMLAudioElement): string {
	if (element.error) return `MediaError ${element.error.code}`;
	if (error instanceof DOMException) return error.name;
	if (error instanceof Error) return error.name;
	return 'unknown error';
}

let audio: HTMLAudioElement | null = null;
let previewUrl: string | null = null;

export const previewingPath = writable<string | null>(null);
export const previewVolume = writable(storedVolume());
export const previewMuted = writable(storedMuted());

function releasePreviewUrl(): void {
	if (previewUrl) URL.revokeObjectURL(previewUrl);
	previewUrl = null;
}

function player(): HTMLAudioElement {
	if (audio) return audio;
	audio = new Audio();
	audio.volume = get(previewVolume);
	audio.muted = get(previewMuted);
	audio.addEventListener('ended', () => {
		releasePreviewUrl();
		previewingPath.set(null);
	});
	return audio;
}

/** Sets the shared preview volume and remembers it for the next launch. */
export function setPreviewVolume(value: number): void {
	const volume = clampVolume(value);
	previewVolume.set(volume);
	if (audio) audio.volume = volume;
	try {
		localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
	} catch {
		// Preview remains usable when browser storage is unavailable.
	}
}

/** Mutes or unmutes the shared preview and remembers the choice. */
export function setPreviewMuted(value: boolean): void {
	previewMuted.set(value);
	if (audio) audio.muted = value;
	try {
		localStorage.setItem(MUTE_STORAGE_KEY, String(value));
	} catch {
		// Preview remains usable when browser storage is unavailable.
	}
}

/** Stops the one active WAV preview, if any. */
export function stopPreview(): void {
	if (audio) {
		audio.pause();
		audio.currentTime = 0;
	}
	releasePreviewUrl();
	previewingPath.set(null);
}

/** Starts a WAV preview or stops it when the same file is already playing. */
export async function previewWav(path: string): Promise<void> {
	const element = player();
	if (get(previewingPath) === path && !element.paused) {
		stopPreview();
		return;
	}
	if (get(previewingPath)) stopPreview();

	try {
		const bytes = await readFile(path);
		previewUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
		element.src = previewUrl;
		element.volume = get(previewVolume);
		element.muted = get(previewMuted);
		await element.play();
		previewingPath.set(path);
	} catch (error) {
		releasePreviewUrl();
		previewingPath.set(null);
		notify('error', `${tr('explorer.preview_error')} (${playbackErrorDetail(error, element)})`);
	}
}
