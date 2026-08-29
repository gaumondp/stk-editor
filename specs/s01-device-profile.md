# S01 — Device profile (SmplTrek 3.2)

Purpose: isolate every hardware constant so other Sonicware devices can be
added without touching core code.

## Scope
`DeviceProfile` trait (dynamic dispatch) exposing:
- identity: `id`, `firmware`, `name`
- pads: count, active pads, special/reserved pads (16 → track function)
- audio constraints: target rate/bits/allowed channel counts, internal audio
  root layout (`internal_audio_root(kit_title)`), max path bytes
- naming: min/max kit name length + `validate_kit_name`
- per-sample parameter ranges: `validate_params(volume, pan, fx_send, …)`
- SD roots: `sd_root_folders()` (full tree) vs `sd_hardware_folders()`
  (device-supported subset)

Registered via `known_profile(id, firmware)`.

## Current state
`src-tauri/src/profile.rs` defines the trait + `SmplTrek32` + registry.
Used by compile and export. **UI still hardcodes 16 pads / 4×4 / pad-16 rule**
in `DeviceView.svelte` `PAWS` (see S06).

## Key requirements
- `SmplTrek32` constants must be verified against **3 real `.STK` files** +
  `stk_writer` source before release (TODO: format audit).
- Validation failures produce user-readable errors naming the constraint
  ("kit name must be 3–20 chars" etc.).
- Firmware version is part of the profile key: (id, firmware) pair; an unknown
  pair is a compile error, not a fallback.
- Profile must be serialisable enough for the diagnostics report (S14).

## Open decisions
- Exact SmplTrek 3.2 audio constants (48 kHz mono confirmed? max sample length?
  max per-kit audio size?) — pending format audit of reference `.STK`s.

## Acceptance
- `known_profile("smpltrek","3.2")` → full profile; unknown pair → typed error.
- Unit tests for every `validate_*` (bounds + error text).
- Compile + export + UI all sourced from the profile object.
