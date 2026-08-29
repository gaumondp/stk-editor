# Keyboard shortcuts, visible save state, and Japanese localization

## Scope

Add platform-aware keyboard shortcut labels to the existing custom menus, a save button that signals unsaved work, and a complete Japanese interface translation.

## Decisions

- Use `⌘` labels on macOS and `Ctrl+` labels on Windows and Linux.
- Support `⌘Q` / `Ctrl+Q` to quit the application. The existing unsaved-work guard remains authoritative before closing.
- Show New, Open, Save, Save as, Undo, Redo, Close kit, and Quit shortcuts in the Kit menu.
- Add a top-bar Save button. It remains available for explicit saves and uses the green success treatment while the project is dirty.
- Add the `ja` locale for every existing interface and help key. In the language selector, label the choices `English`, `Français`, and `Japanese`; the last label intentionally remains English so a tester can recover the language choice.
- State the three localized interface languages in the README.

## Validation

- Unit coverage for Japanese translations and locale persistence.
- Browser coverage for shortcut labels, platform-independent save behavior, and the visible dirty-save state.
- Run Svelte checks, the Vitest suite, and focused critical Playwright tests.
