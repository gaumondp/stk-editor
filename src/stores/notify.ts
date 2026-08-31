// Short success/error toasts (spec §5, §12 step 10).
import { writable } from 'svelte/store';

export type NotifyKind = 'info' | 'success' | 'warn' | 'error';
export interface Toast {
	id: number;
	kind: NotifyKind;
	msg: string;
	ts: number;
}

let seq = 1;
const toasts = writable<Toast[]>([]);

/**
 * Pushes a toast onto the stack (keeping at most three) and schedules its removal.
 *
 * @param kind The toast severity: `'info'`, `'success'`, `'warn'`, or `'error'`.
 * @param msg The message to display.
 * @param ttl Milliseconds before auto-dismiss; `0` or less keeps it until removed. Defaults to `3500`.
 */
export function notify(kind: NotifyKind, msg: string, ttl = 3500) {
	const id = seq++;
	toasts.update((t) => [...t.slice(-2), { id, kind, msg, ts: Date.now() }].slice(-3));
	if (ttl > 0) setTimeout(() => toasts.update((t) => t.filter((x) => x.id !== id)), ttl);
}

/**
 * Shows a success toast with the default lifetime.
 *
 * @param m The message to display.
 */
export function success(m: string) {
	notify('success', m);
}
/**
 * Shows an error toast with an extended (6s) lifetime.
 *
 * @param m The message to display.
 */
export function error(m: string) {
	notify('error', m, 6000);
}
/**
 * Shows a warning toast with a 5s lifetime.
 *
 * @param m The message to display.
 */
export function warn(m: string) {
	notify('warn', m, 5000);
}

export { toasts };
