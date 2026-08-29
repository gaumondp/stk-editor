// Short success/error toasts (spec §5, §12 step 10).
import { writable } from 'svelte/store';

export type NotifyKind = 'info' | 'success' | 'warn' | 'error';
export interface Toast {
     id: number;
      kind: NotifyKind;
       msg: string;
        ts: number
}

let seq = 1;
const toasts = writable<Toast[]>([]);

export function notify(kind: NotifyKind, msg: string, ttl = 3500) {
     const id = seq++;
     toasts.update((t) => [...t.slice(-2), { id, kind, msg, ts: Date.now() }].slice(-3));
     if (ttl > 0)
       setTimeout(
        () => toasts.update((t) => t.filter((x) => x.id !== id)),
        ttl
          );
     }

export function success(m: string) {
     notify('success', m);
      }
export function error(m: string) {
     notify('error', m, 6000);
      }
export function warn(m: string) {
     notify('warn', m, 5000);
      }

export { toasts };
