# SD Card Reader — Design

## Approved visual specification

The user selected mockup A. Add a full-width **Lire une carte SD** button with a vector SD-card icon in the pad action column in `src/components/DeviceView.svelte`. It appears directly below **Masquer les positions suggérées**, separated from the preceding controls by exactly 24 px. The visual treatment uses the existing `--bg-*`, `--fg`, `--line`, and `--accent-*` tokens and works in every interface scale. It must not use an emoji icon.

## User flow

1. The user clicks **Lire une carte SD**.
2. The native directory picker accepts either the card volume root or its `SmplTrek` directory.
3. Rust normalizes the selected path to `SmplTrek`, validates it, and reads only its contents.
4. A modal overlay above the workspace displays the result. It can be closed without changing the current kit.

## Reader contract

A valid selected source contains a `SmplTrek` directory with the expected top-level `Pool`, `Preset`, and `Project` directories. The report contains:

- the selected `SmplTrek` path and validity state;
- project count and project names from `Project/`;
- preset counts grouped as `Audio/Drum`, `Audio/Inst`, and `Kit`;
- every `.wav` file below `SmplTrek`, listed with its relative path.

The reader is read-only. The Svelte frontend invokes one typed Rust command; it does not receive broad filesystem permissions.

## Failure behavior

If the selected path does not resolve to `SmplTrek`, the overlay states that the selected folder is not a SmplTrek card and lets the user choose another folder. Missing expected top-level directories produce an incomplete-card status while preserving safely discovered information.

## Implementation and verification boundaries

- Add localized interface text in English, French, and Japanese.
- Cover valid, missing-root, and incomplete layouts in Rust tests.
- Cover button location, directory selection, and overlay rendering in Playwright.
- Verify the built desktop application visually after automated validation. Native card detection or read success will not be claimed without a real user-selected card or directory.
