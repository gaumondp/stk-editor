# S04 — Audio processing (WAV)

Status: partial (wav.rs normalizer + metadata + build_wav exist; gaps below).
Scope: §10.1, §12.2, §21.

## Scope

All audio I/O for V1:
- Read WAV metadata (info for explorer, compatibility check).
- Normalize arbitrary WAV → device PCM (48 kHz / 16-bit, mono/stereo).
- Build device WAV with mandatory pre-data chunks (cue + LIST + tempo).

## WAV normalization (wav.rs → normalize)

**Input**: any readable WAV (RIFF/WAVE), PCM or IEEE float, 8–32/64-bit,
mono → 8 channels, any sample rate.

**Output**: `Vec<i16>` interleaved PCM at 48000 Hz, target channels (1 or 2).

### Pipeline
1. `parse_wav(bytes)` → parse RIFF chunks, locate `fmt ` + `data`, validate.
2. Decode per `SampleKind`: PCM_8, PCM_16, PCM_24, PCM_32, FLOAT_32, FLOAT_64.
   - 8-bit unsigned → bias + sign-extend to i16.
   - 24-bit → sign-extend 3-byte little-endian to i32 → i16.
   - Float → scale ±1.0 → i16.
3. `mix` / `downmix` to target channels:
   - stereo → mono: (L+R)/2.
   - N-ch → stereo: first two channels, or downmix N→2.
   - N-ch → mono: average all.
4. Resample to 48000 Hz (linear interpolation; quality adequate for 1-shot
   drum samples). `TARGET_RATE = 48000`.
5. `clamp` to i16 range.

## Metadata (read_wav_info / AudioFile)
Returned for each file in explorer + on relink capture:
- `duration_ms`, `sample_rate`, `bits`, `channels`, `byte_size`.
- `compatible` = (sample_rate == 48000) && (bits == 16) && (channels ≤ 2).
- `warning` string if incompatible (shown in explorer row).

## Device WAV build (build_wav)
Called by compiler for each pad's resolved source:
- Takes normalized `pcm: &[i16]` + `channels` (1 or 2).
- Writes RIFF/WAVE with:
  - `fmt ` (16 B): PCM, 48000, channels, 16-bit.
  - `cue` (20 B): fixed pattern (loop marker at frame 0).
  - `LIST adtl labl` (18 B): label "1" (cue point index).
  - `Tempo: 000.0\0\0` (16 B): fixed tempo tag.
  - `data` chunk: PCM payload.

## Compatibility rules (V1)
| Input | Result |
|---|---|
| 48 kHz / 16-bit / mono or stereo | compatible (no conversion) |
| Other rate / bit depth / channels | converted, warning shown |
| Non-WAV / corrupt / unsupported codec | error row, not playable |
| > 64-bit / > 8 channels | error |

## Tauri commands
- `cmd_list_wavs(dir) → AudioFile[]` — list + meta for explorer.
- `cmd_audio_meta(path) → AudioFile` — single file detail (relink, prel).

## Gaps / TODOs
- [ ] Resample quality: linear interp is fast but audible on long samples;
  consider `rubato` or `samplerate` crate for V1.1.
- [ ] Max file size / duration limit? (Device RAM ~128 MB total; per-sample
  cap unknown). Add profile field if needed (S01).
- [ ] Loudness normalization (optional) — not in V1.
- [ ] Test corpus: fixture WAVs covering all SampleKind + channel combos
  (S19).
- [ ] Memory: `normalize` loads full file; large files → streaming decode.

## Acceptance
- `normalize(path, mono)` returns 48 kHz i16 PCM for all supported inputs.
- Metadata matches `ffprobe` / `soxi` for test fixtures.
- Incompatible files flagged with actionable warning (not silent failure).
- Device WAV (`build_wav`) passes `wav.rs::parse_wav` round-trip.
- Explorer list shows correct duration/size/compat for 50+ mixed files < 200 ms.