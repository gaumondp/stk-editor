# S03 — .STK compilation

Status: partial (core compile + validate + profile-driven WAV build exist; gaps below).
Scope: §12, §4.2, §12.4, file_format.md.

## Scope

Compile a validated `Project` → binary `.STK` kit file loadable by SmplTrek
firmware 3.2. Uses the device profile for all layout constants. Output is
**separate** from the JSON project (S02).

## Pipeline (compile.rs)

```
validate(project) → [errors → abort]
resolve_source(pad sample) → PathBuf (or None → silence)
compile_wav(path, mono) → device WAV bytes (48 kHz / 16-bit PCM + cue/LIST)
build_stk(profile, project, wavs) → Vec<u8>
atomic write: tmp → rename
```

### Device WAV format (build_wav)
- RIFF/WAVE, PCM, 48000 Hz, 16-bit, mono (or stereo if `mono=false`).
- Pre-data chunks: `cue` (20 B) + `LIST adtl labl` (18 B) + `Tempo: 000.0` (16 B).
- `data` chunk: 1 s of PCM per pad (48000 frames @ mono, 96000 @ stereo).
- Missing/empty pad → 1 s of silence (synth_silence).

### STK structure (build_stk)
- Magic: `VDK0PR\0 ` (8 B).
- KTDT chunk (4228 B): 15 active-pad entries × 280 B (path 256 B + params).
  - Path = `internal_audio_root(kit_name) + "/" + fileName (no .wav) + ".wav\0"`
  - Params: volume (u8), pan (u8, -64..63 biased), pitch (i32 cents), fx_send (u8).
- ISDT chunks before each WAV (index + size).
- Global volume footer @ offset 4208 (0x64 = 100).
- WAVs concatenated with 2-byte alignment.

## Validation (do_validate_profile)
- Kit name: profile `validate_kit_name` (length, ASCII, no . / \).
- Per active pad: `validate_params` (volume 0–100, pan -64..63, pitch ±1200, fx 0–127).
- Assigned pad must resolve to existing file (resolved_path → original_path).
- Special pad (16) must be empty.

## CLI / Tauri command
`cmd_compile(project, outputPath, mono, overwrite) → CompileReport`
- `outputPath`: destination `.stk` file.
- `mono`: downmix to mono (default true, device requirement).
- `overwrite`: allow replacing existing file.

## Gaps / TODOs
- [ ] Verify KTDT/ISDT layout against **3 real .STK files** + `stk_writer` reference
  (firmware 3.2). Current constants from reverse-engineering; must audit.
- [ ] Max sample length per pad? (STK header field suggests max ~4 MB but device
  RAM may cap lower). Add `max_sample_bytes` to profile if needed.
- [ ] Per-kit audio size limit (sum of WAVs) — add profile field if device
  enforces.
- [ ] Stereo compilation path (mono=false) — test on device; may be rejected.
- [ ] Progress callback for large kits (UI busy state already in S05).
- [ ] Unit tests: validate fixture projects against profile; golden .STK byte
  compare (S19).

## Acceptance
- `cargo test` compiles and validates a valid project → .STK loads on SmplTrek 3.2.
- Invalid kit name / params / missing file → typed errors (no panic).
- Special pad assignment → error.
- Overwrite flag respected; atomic write (no partial .STK on crash).
- CompileReport: output_path, bytes, pads_filled, warnings.