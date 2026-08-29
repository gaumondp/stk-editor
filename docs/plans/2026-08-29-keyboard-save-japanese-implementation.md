# Keyboard shortcuts, visible save state, and Japanese localization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make core file commands discoverable and consistent across desktop platforms, expose unsaved work through a visible Save button, and localize the full interface in Japanese.

**Architecture:** Keep command behavior in `App.svelte` and its existing store functions. `TopBar.svelte` displays platform-aware shortcut hints and derives Save styling from the existing `dirty` store. `i18n.ts` remains the single source for interface strings and locale persistence.

**Tech Stack:** Svelte 5, Svelte stores, TypeScript, Vitest, Playwright, Tauri 2.

---

### Task 1: Prove locale and menu expectations

**Files:**
- Modify: `src/lib/i18n.test.ts`
- Modify: `tests/e2e/critical.spec.ts`

**Step 1:** Add tests expecting `ja` to persist and translate visible menu/help keys; expect the language selector to offer `Japanese`.

**Step 2:** Run `pnpm test src/lib/i18n.test.ts` and the targeted Playwright test. Expected: failure because `ja` is absent.

### Task 2: Add the complete Japanese locale

**Files:**
- Modify: `src/lib/i18n.ts`

**Step 1:** Add a Japanese dictionary matching every English key, including help topics and descriptions.

**Step 2:** Extend locale types, system/persisted locale validation, `available`, and the dictionary map to include `ja`.

**Step 3:** Run `pnpm test src/lib/i18n.test.ts`. Expected: pass.

### Task 3: Add visible command equivalents and Save state

**Files:**
- Modify: `src/App.svelte`
- Modify: `src/components/TopBar.svelte`

**Step 1:** Add test coverage for the dirty Save button and menu shortcut labels.

**Step 2:** Run the targeted browser test. Expected: failure because the control and labels do not exist.

**Step 3:** Add `⌘`/`Ctrl+` presentation based on the host platform; annotate New, Open, Save, Save as, Undo, Redo, Close kit, and Quit.

**Step 4:** Add a Save button that invokes `saveKit()` and uses the existing green success palette while `$dirty` is true.

**Step 5:** Add `⌘Q`/`Ctrl+Q` to request native window closing; rely on the existing close-request guard to protect unsaved changes.

**Step 6:** Run targeted Playwright tests. Expected: pass.

### Task 4: Document and release

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Step 1:** State that English, French, and Japanese are available in the feature list.

**Step 2:** Record the shortcuts, Save-state indicator, and Japanese localization under `Unreleased`.

**Step 3:** Run `pnpm check`, `pnpm test`, and `pnpm exec playwright test tests/e2e/critical.spec.ts`.

**Step 4:** Stage only the feature, test, documentation, and plan files; commit with the project’s commit convention.
