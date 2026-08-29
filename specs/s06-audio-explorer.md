# S06 — Audio file explorer

Status: partial (`AudioExplorer.svelte` core exists; gaps below). Scope: §10.

## Scope

Panel that lets the user browse a folder of WAV files on the workstation and
feed the pads (select dir, list, search, sort, filter, prelisten, drag to pad).

## Contract (file list)

Visible columns per file: name, extension, duration, size (sort adds size),
status dot (compatible / warning / error), play/preview affordance.

Features:

- Select a folder (dialog); remembers last folder per session; auto-loads the
  project's sample folder when opening a packaged project (S09).
- Display: `*.wav` (case-insensitive), name, extension, duration (s, 1 decimal),
  size.
- Search by name (substring, live, case-insensitive).
- Sort: name / duration / date — **add `date` (mtime) sort option** (today:
  name|size|duration; spec says name + date).
- Filter by extension (V1: WAV only; other formats shown as incompatible
  with clear error state, not silently hidden — decision: show+flag).
- Prelisten: double-click (or click dot) plays; second play stops; Space
  toggles; auto-stop when another file starts; currently-playing row indicated.
- Drag a row to a pad (HTML5 DnD, `text/plain` path payload; extend to
  `application/x-file` per S05).

## Audio compatibility check (V1)

Compatible iff: RIFF/WAVE, PCM/float, 8–32/64-bit, mono or stereo,
readable size. Anything else → row flagged with reason (e.g. "not a WAV",
"5.1 channels", "unsupported codec"). The `wav.rs` normalizer defines the
truth; explorer rows call `audio_meta` for each file.

## Rules

- Explorer never modifies or deletes files.
- Refresh button / rescan on folder change; unreadable dir → error toast,
  list kept or cleared with message (no crash).
- All labels i18n; durations localized format.

## Acceptance

- §22: list a folder of mixed WAV/non-WAV; search finds subset; sorts stable;
  incompatible files visibly flagged; preview works and is interruptible;
  drag from explorer to pad assigns (S05 contract).
