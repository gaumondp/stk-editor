# Changelog

All notable changes to STK Forge are documented in this file.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
