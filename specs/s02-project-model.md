# S02 — Project model, JSON format, save/load

Status: partial (models + save/open/migrate done; field & behavior gaps below).
Scope: §11, §14.1, §21, §23.

## Scope

`Project` (Rust `models.rs`, mirrored in `src/lib/commands.ts`) is the single
source of truth. JSON (UTF-8, 2-space indent, sorted keys by BTreeMap) is the
canonical, portable, editable format. It is **separate** from `.STK`.

## Contract (JSON schema v1)

```jsonc
{
  "format": "smpltrek-kit-project",   // must match PROJECT_FORMAT
  "fmtVersion": 1,                     // fmt_version
  "appVersion": "x.y.z",
  "device": { "profile": "smpltrek", "firmware": "3.2" },
  "kit": {
    "name": "MY_KIT",
    "pads": {                          // BTreeMap<u8, Sample>, keys 1..=16
      "1": {
        "id": "kick-808",              // stable sample id (relink/match key)
        "fileName": "Kick_808.wav",
        "resolvedPath": "samples/Kick_808.wav",   // abs or relative, optional
        "originalPath": "/abs/original/location", // NEVER overwritten by relink
        "sha256": "…",                 // optional
        "meta": { "durationMs": 250, "sampleRate": 48000,
                  "bits": 16, "channels": 1, "byteSize": 24000 },
        "volume": 100, "pan": 0, "pitch": 0, "fxSend": 0, "note": null
      }
    },
    "notes": ""
  },
  "compile": { "lastCompiled": "…", "outputPath": "…", "target": "…" },
  "prefs": { "copySamples": true, "sdProfile": "full" }
}
```

Fields required by §11.2 but **missing today → add**:

- `kit.pads.<n>` metadata display fields: duration + metadata are present
  (`meta`) ✔; user note per project ✔ (`kit.notes`).
- `originalFileName` (display name survives rename) — optional, add if needed.
- `formatVersion` naming: keep `fmtVersion` (= 1) — document the alias.

## Save/load rules

- Save: write UTF-8 JSON atomically (temp file + rename), never auto-compile.
- Save As: write to new path, switch `projectPath`, update recents.
- Open: parse, check `format == "smpltrek-kit-project"`, run `migrate` for
  lower `fmtVersion`; unknown `fmtVersion` → refuse with explicit error.
- Corrupt/unknown-`format` JSON → error, project untouched, no crash.
- Relative paths resolve against the project file's directory (stored as given);
  absolute paths used as-is. Both must round-trip unchanged on save (S17 tests).
- Missing-file state on open: resolved path absent → pad flagged missing;
  `originalPath` preserved (S07 handles search/relink).
- Every mutation of: kit name, sample assignment/removal, relink, notes,
  prefs, pad params → dirty flag + undo snapshot (S11).

## Acceptance

- Round-trip: load → save → byte-identical structure (no field loss).
- Bad-format / unknown-version / corrupt JSON all produce typed errors
  (see fixture set in S19).
- Opening a project with missing files does not lose data and marks state.
- `migrate(v0→v1)` covered by a test with a fixture.
