# Changelog

All notable changes to STK Forge are documented in this file.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Release notes for version 1.0.0 will be added when that release is ready.

## [Unreleased]

### Added

- Open a compiled `.stk` kit directly from the welcome screen for read-only inspection or extraction.
- Inspect a selected SmplTrek SD-card directory locally and read-only to list projects, presets, and WAV files.
- Initial public-release preparation.

### Fixed

- Compiled-kit inspection and output now match the official SmplTrek `VDK0` header and first embedded `ISDT` record.

### Changed

- Windows builds now produce a portable `.exe` without an installer.
- Incompatible WAV filenames are struck through in the Audio Explorer while remaining previewable and assignable.
- Core Kit commands now show platform-aware keyboard equivalents, including Cmd/Ctrl+Q to quit safely.
- The top-bar Save button turns green while a kit has unsaved changes.
- The complete interface and bundled help are now available in Japanese.
- macOS `⌘Q` now reaches the documented Tauri `AppHandle::exit(0)` process exit after the unsaved-changes guard; choosing Discard then closes the app.
