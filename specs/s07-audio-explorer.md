# S07 — Audio explorer

Status: partial (AudioExplorer.svelte core exists; gaps below). Scope: §10.

## Scope

Left-aside panel for browsing workstation WAV folders and feeding pads.
List, search, sort, filter, prelisten, drag-to-pad.

## UI contract
- **Folder selector**: native dialog (Tauri `dialog.open`); remembers last folder
  per session; auto-loads project's sample folder on packaged project open (S09).
- **File list**: virtualized (or simple) rows, columns:
  - Name (with extension)
  - Duration (s, 1 decimal, localized)
  - Size (human-readable)
  - Status dot: 🟢 compatible / 🟡 warning / 🔴 error
  - Play/preview button (double-click row also works)
- **Search**: live substring filter on name (case-insensitive).
- **Sort**: name ↑↓ / duration ↑↓ / date modified ↑↓ (mtime).
- **Filter**: V1 = WAV only; non-WAV shown with error status (not hidden).
- **Prelisten**: double-click row / click play button / Space on focused row.
  - Single engine (shared with pads, S06).
  - Auto-stop on new play.
  - Currently-playing row highlighted.
- **Drag to pad**: HTML5 DnD, `text/plain` = absolute path.
  - Extend to `application/x-file` for OS drag (S06).

## Audio compatibility (V1)
`compatible` iff: RIFF/WAVE, PCM or IEEE float, 8–32/64-bit, mono or stereo,
readable. Anything else → row flagged with reason:
- "not a WAV"
- "unsupported codec" (e.g. MP3 in WAV container)
- "5.1 channels" (>2)
- "corrupt / truncated"

## Tauri commands
- `cmd_list_wavs(dir) → AudioFile[]` — called on folder select + refresh.
- `cmd_audio_meta(path) → AudioFile` — called on demand (prelisten, tooltip).

## AudioFile type (commands.ts)
```ts
interface AudioFile {
  name: string;           // file name with ext
  path: string;           // absolute path
  ext: string;            // "wav"
  size: number;           // bytes
  duration_ms: number;
  sample_rate: number;
  channels: number;
  bits: number;
  compatible: boolean;
  warning?: string;       // if !compatible
}
```

## Rules
- Explorer **never** modifies or deletes files.
- Refresh button / auto-rescan on folder change (debounced 500 ms).
- Unreadable directory → error toast, list shows last good state or empty
  with message.
- All labels via `tr()` (S11).
- Durations formatted via `Intl.NumberFormat` (locale-aware).
- Keyboard: ↑/↓ navigate, Enter/Space prelisten, Escape stop.

## Gaps / TODOs
- [ ] Virtualized list for 10k+ files (currently simple array).
- [ ] Date-modified sort (mtime) — currently only name/size/duration.
- [ ] Column resize / reorder / hide (V1.1).
- [ ] Recursive scan toggle (currently flat only).
- [ ] Preview waveform thumbnail (canvas, V1.1).
- [ ] Recently used folders dropdown (persisted in app prefs).
- [ ] Keyboard shortcut: `E` focus explorer, `/` focus search.

## Acceptance
- Mixed folder (WAV + MP3 + FLAC + corrupt) → all listed, compat flags correct.
- Search narrows list live (< 50 ms on 1k files).
- Sorts stable; date sort uses mtime.
- Prelisten plays/stops/auto-stops; no audio glitches.
- Drag from explorer row to pad → assigns (S06 contract).
- Refresh picks up new/deleted files without restart.