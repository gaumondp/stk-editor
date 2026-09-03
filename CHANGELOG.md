# Changelog

All notable changes to STK Forge are documented in this file.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-09-03

Clearer WAV compatibility: the Audio Explorer now shows a three-state status pill instead of striking through filenames, and compiling a kit no longer fails silently on a file it cannot read.

### Added

- Each WAV in the Audio Explorer carries a colored status pill — 🟢 **Ready** (already 48 kHz / 16-bit, copied untouched), 🟡 **Will be converted** (readable but a different format, converted on compile), 🔴 **Incompatible** (cannot be decoded) — with a per-file tooltip showing the source-to-target detail.
- An always-visible compatibility legend beneath the column options explains the pill colors and notes that they reflect a read analysis of the file, not a guarantee the conversion will succeed.
- Compiling a kit that contains an unreadable WAV now opens a dialog naming each affected file and the pads that would be left empty, offering **Compile without them** or **Cancel**. Choosing to compile without them suffixes the proposed file name with `-incomplete` so the result is obvious.

### Changed

- The WAV parser now explicitly rejects compressed and non-PCM formats (ADPCM, µ-law, and similar) as incompatible instead of decoding them to noise.

### Fixed

- Incompatible WAV filenames are no longer struck through; the harsh strike-through treatment is replaced by the status pill.

### Security

- The guarantee that source WAV files are never modified is now enforced by an automated test: each source file is verified byte-for-byte identical after a compile. Conversion happens in memory and is written only into the compiled `.stk` or the SD-card export.

## [0.2.0] - 2026-09-02

First beta release with downloadable builds: a universal macOS `.dmg` and a Windows installer, both unsigned. See the README for the one-time steps macOS and Windows require on first launch.

### Added

- Open a compiled `.stk` kit directly from the welcome screen for read-only inspection or extraction.
- Inspect a selected SmplTrek SD-card directory locally and read-only to list projects, presets, and WAV files.
- Escape now closes every dialog. On the unsaved-changes prompt it maps to Cancel, never to Discard.

### Fixed

- Compiled-kit inspection and output now match the official SmplTrek `VDK0` header and first embedded `ISDT` record.
- A malformed `.wav` or a truncated `.stk` no longer crashes inspection: both are reported as invalid instead.
- The interface now always starts in English. A previous build let the host system language override that choice, so a French or Japanese machine could not stay in English.
- The pad list is no longer duplicated in the keyboard tab order, and each row announces its assigned file rather than repeating the pad number.

### Changed

- Windows builds now ship an installer, replacing the earlier portable `.exe`.
- Incompatible WAV filenames are struck through in the Audio Explorer while remaining previewable and assignable.
- Core Kit commands now show platform-aware keyboard equivalents, including Cmd/Ctrl+Q to quit safely.
- The top-bar Save button turns green while a kit has unsaved changes.
- The complete interface and bundled help are now available in Japanese.
- macOS `⌘Q` now reaches the documented Tauri `AppHandle::exit(0)` process exit after the unsaved-changes guard; choosing Discard then closes the app.
