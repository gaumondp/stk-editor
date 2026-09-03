// WAV reading and normalization to the device-required format:
// 48 kHz, 16-bit linear PCM, mono or stereo (spec §12 / file_format.md §5).
//
// Hand-rolled minimal RIFF/WAVE parser — no external audio dependency.
// Supports PCM (8/16/24/32-bit) and IEEE float (32/64-bit).

use std::path::Path;

use crate::stk_format::{read_le_u16, read_le_u32};

const TARGET_RATE: u32 = 48000;

#[derive(Debug, Clone, Default)]
pub struct AudioInfo {
     /// Sample rate in Hz, as declared in the WAV `fmt ` chunk.
     pub sample_rate: u32,
      /// Channel count (1 = mono, 2 = stereo, ...).
      pub channels: u16,
       /// Bit depth per sample (8/16/24/32 PCM, or 32/64 IEEE float).
       pub bits: u16,
        /// Number of sample frames (samples per channel).
        pub frames: u64,
         /// Playback duration in milliseconds, derived from frames / sample_rate.
         pub duration_ms: u64
}

#[derive(Clone, Copy, PartialEq)]
enum SampleKind {
     Pcm,
      Float
}

struct Parsed {
     spec: AudioInfo,
      samples: Vec<f32>, // interleaved, normalized to [-1, 1]
}

/// Parse a full WAV into header info + normalized interleaved f32 samples.
fn parse_wav(bytes: &[u8]) -> Result<Parsed, String> {
      if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err("not a RIFF/WAVE file".into());
       }

      let mut i = 12usize;
      let mut sample_rate = 44100u32;
      let mut channels = 2u16;
      let mut bits = 16u16;
      let mut kind = SampleKind::Pcm;
      let mut data: Vec<u8> = Vec::new();
      let mut found_data = false;
      let mut found_fmt = false;

       while i + 8 <= bytes.len() {
       let id = &bytes[i..i + 4];
        // Chunk size comes straight from the file; a hostile value must never
        // index past the buffer. read_le_u32 is bounds-checked, and the range
        // is validated with get() before any body slice is taken.
        let size = match read_le_u32(bytes, i + 4) {
          Some(s) => s as usize,
          None => break,
        };
        let body_start = i + 8;
        let body = match body_start
          .checked_add(size)
          .and_then(|end| bytes.get(body_start..end))
        {
          Some(b) => b,
          None => break,
        };

       match id {
        b"fmt " => {
          let audio_format = read_le_u16(body, 0).unwrap_or(1);
          if let Some(v) = read_le_u16(body, 2) {
           channels = v;
            }
          if let Some(v) = read_le_u32(body, 4) {
           sample_rate = v;
            }
          if let Some(v) = read_le_u16(body, 14) {
           bits = v;
             }
          // Only linear PCM (1) and IEEE float (3) are decodable. Anything
          // else — ADPCM, µ-law/A-law, MP3-in-WAV, other compressed tags —
          // would be silently misread as PCM garbage. Reject it explicitly so
          // the file is reported unreadable, never decoded to noise.
          // WAVE_FORMAT_EXTENSIBLE (0xFFFE) carries the real format tag in the
          // first two bytes of its SubFormat GUID, at offset 24 of the fmt body.
          let effective_format = if audio_format == 0xFFFE {
            match read_le_u16(body, 24) {
              Some(sub) => sub,
              None => return Err(
                "WAVE_FORMAT_EXTENSIBLE without a readable SubFormat".into()
              ),
            }
          } else {
            audio_format
          };
          match effective_format {
            1 => kind = SampleKind::Pcm,
            3 => kind = SampleKind::Float,
            other => return Err(format!(
              "unsupported WAV format tag: {other} (compressed or non-PCM)"
            )),
          }
          found_fmt = true;
          }
        b"data" => {
          data = body.to_vec();
          found_data = true;
            }
        _ => {} // skip LIST, cue, fact, etc.
          }
        // chunks are word-aligned; stop rather than wrap on overflow
        i = match i.checked_add(8 + size + (size & 1)) {
          Some(next) => next,
          None => break,
        };
        }

      if !found_fmt {
        return Err("no fmt chunk in WAV".into());
        }
      if !found_data {
        return Err("no data chunk in WAV".into());
        }

      let ch = channels.max(1) as u64;
      let samples = decode(&data, bits, kind)?;
      let frames = (samples.len() / ch as usize).max(1);
      let info = AudioInfo {
        sample_rate,
        channels,
        bits,
        frames: frames as u64,
        duration_ms: if sample_rate > 0 {
          ((frames as f64 / sample_rate as f64) * 1000.0) as u64
         } else {
          0
          }
       };
      Ok(Parsed { spec: info, samples })
}

/// Decode interleaved raw bytes into normalized f32 samples.
fn decode(data: &[u8], bits: u16, kind: SampleKind) -> Result<Vec<f32>, String> {
      let bytes_per = match bits {
       8 => 1,
        16 => 2,
        24 => 3,
        32 => 4,
        64 => 8,
        b => return Err(format!("unsupported bit depth: {b}"))
       };
      let total = data.len() / bytes_per;
      let mut out = Vec::with_capacity(total);
      for k in 0..total {
        // take() is the shared bounds-checked slice: total is derived from
        // data.len()/bytes_per so every range is valid, but routing through it
        // means a future miscalculation degrades to skipping, never a panic.
        match crate::stk_format::take(data, k * bytes_per, bytes_per) {
          Some(b) => out.push(decode_one(b, bits, kind)),
          None => break,
        }
       }
      Ok(out)
}

fn decode_one(b: &[u8], bits: u16, kind: SampleKind) -> f32 {
       match bits {
        8 => {
          let v = b[0] as i32 - 128;
          v as f32 / 32768.0
          }
        16 => {
          let v = i16::from_le_bytes([b[0], b[1]]);
          if kind == SampleKind::Float {
            f32::from_bits(v as u32)
            } else {
            v as f32 / 32768.0
             }
          }
        24 => {
          let v = (b[0] as i32) | ((b[1] as i32) << 8) | ((b[2] as i32) << 16);
          sign_extend24(v) as f32 / 8388608.0
        }
        32 => {
          let raw = i32::from_le_bytes([b[0], b[1], b[2], b[3]]);
          if kind == SampleKind::Float {
            f32::from_bits(raw as u32)
            } else if raw.abs() > 32767 {
            raw as f32 / 65536.0
            } else {
            raw as f32 / 32768.0
            }
          }
        64 => {
          let raw = u64::from_le_bytes([
            b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]
           ]);
          f64::from_bits(raw) as f32
          }
        _ => 0.0
        }
}

fn sign_extend24(v: i32) -> i32 {
       if v & 0x0080_0000 != 0 {
        v | !0x00FF_FFFF
        } else {
        v & 0x00FF_FFFF
        }
}

/// Parse the WAV header only (fast) and return audio info.
pub fn read_wav_info(path: &Path) -> Result<AudioInfo, String> {
       let bytes = std::fs::read(path).map_err(|e| path_err(path, e))?;
      Ok(parse_wav(&bytes)?.spec)
}

/// Parse WAV bytes for STK inspector (public wrapper).
pub fn parse_wav_for_inspect(bytes: &[u8]) -> Result<AudioInfo, String> {
      Ok(parse_wav(bytes)?.spec)
}

/// Read a WAV and return interleaved 16-bit PCM frames + info, normalizing to
/// 48 kHz / 16-bit PCM. `mono` selects the final channel count (1 or 2).
///
/// SOURCE-FILE INVARIANT: the source file at `path` is only ever READ
/// (`std::fs::read`). This function never writes to it. The normalized samples
/// are returned to the caller (the compiler embeds them in the `.stk`); the
/// original WAV on disk is guaranteed untouched.
pub fn normalize(path: &Path, mono: bool) -> Result<(Vec<i16>, AudioInfo), String> {
      let bytes = std::fs::read(path).map_err(|e| path_err(path, e))?;
      let parsed = parse_wav(&bytes)?;
      let info = parsed.spec;
      let src_ch = info.channels.max(1) as u64;
      let frames = (parsed.samples.len() / src_ch as usize).max(1) as u64;

       // de-interleave to per-channel f32 buffers
      let mut per = vec![Vec::with_capacity(frames as usize); src_ch as usize];
      for (i, &s) in parsed.samples.iter().enumerate() {
        let c = i as u64 % src_ch;
        per[c as usize].push(s);
       }

       // mix down / up to target channel count
      let target_ch: u64 = if mono { 1 } else { 2 };
      let mixed = mix(&per, target_ch);

       // resample to 48 kHz
      let ratio = info.sample_rate.max(1) as f64 / TARGET_RATE as f64;
      let out_len = if ratio.abs() < f64::EPSILON {
        frames
       } else {
        ((frames as f64 / ratio) as u64).max(1)
        };

      let mut out = Vec::with_capacity((out_len * target_ch) as usize);
       for c in 0..target_ch {
         let ch = &mixed[c as usize];
        for i in 0..out_len {
          let pos = i as f64 * ratio;
          let idx = pos as usize;
          let frac = (pos - idx as f64) as f32;
          let a = ch.get(idx).copied().unwrap_or(0.0);
          let b = ch.get(idx + 1).copied().unwrap_or(a);
          out.push(clamp(a + (b - a) * frac));
          }
       }

      Ok((out, info))
}

/// Mix N channels down/up to `target_ch` channels (each is a per-frame buffer).
fn mix(per_channel: &[Vec<f32>], target_ch: u64) -> Vec<Vec<f32>> {
      let n = per_channel.len();
      // An empty data chunk yields zero channels; return empty target buffers
      // instead of indexing per_channel[0] and panicking.
      if n == 0 {
        return (0..target_ch).map(|_| Vec::new()).collect();
      }
      let mut out: Vec<Vec<f32>> = (0..target_ch)
            .map(|_| Vec::with_capacity(per_channel[0].len()))
            .collect();

      for c in 0..target_ch {
        let src = if c == 0 {
          if n == 1 {
            per_channel[0].clone()
           } else if target_ch == 1 {
            downmix(per_channel)
            } else {
            per_channel[0].clone()
            }
            } else {
            per_channel.get(c as usize).cloned().unwrap_or_else(|| per_channel[0].clone())
            };
         out[c as usize] = src;
          }
      out
}

fn downmix(per_channel: &[Vec<f32>]) -> Vec<f32> {
      if per_channel.is_empty() {
        return Vec::new();
      }
      let frames = per_channel[0].len();
      let mut out = Vec::with_capacity(frames);
      for i in 0..frames {
        let mut s = 0.0f32;
        for ch in per_channel.iter() {
          s += ch.get(i).copied().unwrap_or(0.0);
          }
        out.push(s / per_channel.len() as f32);
        }
      out
}

fn clamp(v: f32) -> i16 {
        if v > 32767.0 {
          32767
          } else if v < -32768.0 {
           -32768
           } else {
          v.round() as i16
          }
}

fn path_err(path: &Path, e: std::io::Error) -> String {
        format!("cannot read '{}': {e}", path.display())
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn sign_extend_24_positive() {
		assert_eq!(sign_extend24(0x000001), 1);
		assert_eq!(sign_extend24(0x7FFFFF), 8388607);
	}

	#[test]
	fn sign_extend_24_negative() {
		assert_eq!(sign_extend24(0x800000), -8388608);
		assert_eq!(sign_extend24(0xFFFFFF), -1);
	}

	#[test]
	fn decode_16_pcm() {
		let v = decode_one(&[0x00, 0x40], 16, SampleKind::Pcm); // 0x4000 = 16384 -> 0.5
		assert!((v - 0.5).abs() < 0.001);
	}

	#[test]
	fn decode_8_pcm() {
		let v = decode_one(&[128], 8, SampleKind::Pcm);
		assert!(v.abs() < 0.01);
	}

	#[test]
	fn clamp_range() {
		assert_eq!(clamp(40000.0), 32767);
		assert_eq!(clamp(-40000.0), -32768);
		assert_eq!(clamp(100.3), 100);
	}

	#[test]
	fn mix_mono_from_stereo() {
		let per = vec![vec![1.0, 1.0], vec![-1.0, -1.0]];
		let out = mix(&per, 1);
		assert_eq!(out.len(), 1);
		assert!((out[0][0]).abs() < 0.01);
	}

	#[test]
	fn downmix_average() {
		let per = vec![vec![1.0], vec![-1.0], vec![0.5]];
		let out = downmix(&per);
		assert!((out[0] - (0.5 / 3.0)).abs() < 0.01);
	}

	#[test]
	fn parse_wav_rejects_non_riff() {
		assert!(parse_wav(b"NOTAWAV").is_err());
	}

	#[test]
	fn parse_wav_truncated_does_not_panic() {
		// A RIFF/WAVE header that declares a fmt chunk far larger than the
		// bytes actually present. Must return Err (no data chunk), not panic.
		let mut w = Vec::new();
		w.extend_from_slice(b"RIFF");
		w.extend_from_slice(&0xFFFF_FFFFu32.to_le_bytes()); // absurd RIFF size
		w.extend_from_slice(b"WAVE");
		w.extend_from_slice(b"fmt ");
		w.extend_from_slice(&0xFFFF_FFFFu32.to_le_bytes()); // absurd chunk size
		w.extend_from_slice(&[1, 0, 1, 0]); // only 4 bytes of the claimed body
		let res = parse_wav(&w);
		assert!(res.is_err(), "truncated WAV must error, not panic");
	}

	#[test]
	fn parse_wav_zero_length_data_chunk() {
		// Valid header + fmt + a data chunk of size 0. Yields zero frames and
		// must not panic in decode/mix/downmix.
		let mut w = Vec::new();
		w.extend_from_slice(b"RIFF");
		w.extend_from_slice(&36u32.to_le_bytes());
		w.extend_from_slice(b"WAVE");
		w.extend_from_slice(b"fmt ");
		w.extend_from_slice(&16u32.to_le_bytes());
		w.extend_from_slice(&1u16.to_le_bytes()); // PCM
		w.extend_from_slice(&1u16.to_le_bytes()); // mono
		w.extend_from_slice(&48000u32.to_le_bytes());
		w.extend_from_slice(&96000u32.to_le_bytes());
		w.extend_from_slice(&2u16.to_le_bytes());
		w.extend_from_slice(&16u16.to_le_bytes());
		w.extend_from_slice(b"data");
		w.extend_from_slice(&0u32.to_le_bytes()); // empty data
		let parsed = parse_wav(&w).expect("empty data chunk should parse");
		assert!(parsed.samples.is_empty(), "no samples from empty data");
		// mix/downmix over the empty channel set must not panic.
		assert_eq!(mix(&[], 1).len(), 1);
		assert!(downmix(&[]).is_empty());
	}

	#[test]
	fn parse_wav_minimal_silence_via_build() {
		// Minimal valid WAV (RIFF + fmt + data) without cue/LIST
		let pcm = vec![0i16; 48];
		let data_bytes = (pcm.len() * 2) as u32;
		let mut w = Vec::new();
		w.extend_from_slice(b"RIFF");
		w.extend_from_slice(&(36 + data_bytes).to_le_bytes());
		w.extend_from_slice(b"WAVE");
		w.extend_from_slice(b"fmt ");
		w.extend_from_slice(&16u32.to_le_bytes());
		w.extend_from_slice(&1u16.to_le_bytes()); // PCM
		w.extend_from_slice(&1u16.to_le_bytes()); // mono
		w.extend_from_slice(&48000u32.to_le_bytes());
		w.extend_from_slice(&(48000 * 2u32).to_le_bytes());
		w.extend_from_slice(&2u16.to_le_bytes());
		w.extend_from_slice(&16u16.to_le_bytes());
		w.extend_from_slice(b"data");
		w.extend_from_slice(&data_bytes.to_le_bytes());
		for s in &pcm {
			w.extend_from_slice(&s.to_le_bytes());
		}
		let parsed = parse_wav(&w).unwrap();
		assert_eq!(parsed.spec.sample_rate, 48000);
		assert_eq!(parsed.spec.channels, 1);
		assert_eq!(parsed.spec.bits, 16);
	}

	#[test]
	fn read_real_wav_fixtures() {
		let fixtures_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures/drums");
		if !fixtures_dir.exists() {
			eprintln!("Skipping real fixture test: fixtures directory not found at {:?}", fixtures_dir);
			return;
		}
		let entries = std::fs::read_dir(&fixtures_dir).unwrap();
		let mut count = 0;
		for entry in entries.flatten() {
			let path = entry.path();
			if path.extension().and_then(|s| s.to_str()) == Some("wav") {
				let info = read_wav_info(&path).unwrap_or_else(|e| panic!("Failed to parse {}: {}", path.display(), e));
				assert!(info.sample_rate > 0, "Sample rate should be > 0 for {}", path.display());
				assert!(info.bits > 0, "Bit depth should be > 0 for {}", path.display());
				assert!(info.channels > 0, "Channels should be > 0 for {}", path.display());
				assert!(info.duration_ms > 0, "Duration should be > 0 for {}", path.display());
				count += 1;
			}
		}
		assert!(count > 0, "Should find at least one WAV file in fixtures");
		eprintln!("Parsed {} real WAV fixtures successfully", count);
	}
}
