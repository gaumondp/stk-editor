// STK archive inspector — pre-manipulation diagnostics with EN/FR messages.
// Validates SmplTrek fw 3.2 .STK structure (spec s03, file_format.md).

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::stk_format::{
	read_le_u32, take, ENTRY_SIZE, FIRST_ISDT_OFFSET, HEADER_FILE_SIZE_ADJUSTMENT, HEADER_SIZE,
	KTDT_SIZE, KTDT_TAG, PATH_FIELD,
};

const OFFICIAL_MAGIC: &[u8; 4] = crate::stk_format::VDK0_MAGIC;
const LEGACY_MAGIC: &[u8; 8] = b"VDK0PR \0";

/// One pad's decoded parameters and validation state, as read from a `.STK`
/// KTDT block during inspection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StkPadInfo {
	/// 1-based pad number (1..=16).
	pub pad: u8,
	/// Internal audio path stored in the archive for this pad.
	pub path: String,
	/// Playback volume (device range 0..=100).
	pub volume: u8,
	/// Stereo pan (device range -64..=63).
	pub pan: i8,
	/// Pitch offset in cents (device range ±1200).
	pub pitch: i32,
	/// FX send level (device range 0..=127).
	pub fx_send: u8,
	/// True when every field is within its device-valid range.
	pub valid: bool,
	/// Per-pad, locale-formatted warnings gathered during validation.
	pub warnings: Vec<String>,
}

/// Full diagnostic report produced by [`inspect`] for a `.STK` archive.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StkInspectReport {
	/// Path that was inspected.
	pub path: String,
	/// Overall verdict: no errors and header + KTDT both intact.
	pub valid: bool,
	/// Total file size in bytes.
	pub bytes: u64,
	/// True when the 32-byte main header passes all fixed-field checks.
	pub header_ok: bool,
	/// True when the KTDT tag and size are correct and the body is present.
	pub ktdt_ok: bool,
	/// Number of pad slots in the archive (always 16 for fw 3.2).
	pub pads_total: usize,
	/// Number of pads carrying a real (non-placeholder) sample.
	pub pads_filled: usize,
	/// Decoded per-pad details.
	pub pads: Vec<StkPadInfo>,
	/// Blocking, locale-formatted errors (any entry makes the archive invalid).
	pub errors: Vec<String>,
	/// Non-blocking, locale-formatted warnings.
	pub warnings: Vec<String>,
	/// Informational, locale-formatted notes (e.g. pad-fill summary).
	pub info: Vec<String>,
}

fn tr(key: &str, locale: &str) -> String {
	let fr = locale.to_lowercase().starts_with("fr");
	match key {
		"err_not_found" => if fr { "Fichier introuvable".into() } else { "File not found".into() },
		"err_empty" => if fr { "Fichier vide".into() } else { "File is empty".into() },
		"err_magic" => if fr { "En-tête invalide — attendu 'VDK0' avec la taille officielle SmplTrek".into() } else { "Invalid header — expected official SmplTrek VDK0 layout".into() },
		"err_header_fields" => if fr { "Champs fixes de l'en-tête invalides".into() } else { "Invalid fixed header fields".into() },
		"err_truncated_header" => if fr { "Fichier tronqué — en-tête incomplet (32 octets attendus)".into() } else { "Truncated file — header incomplete (32 bytes expected)".into() },
		"err_kdtd_tag" => if fr { "Tag KTDT manquant".into() } else { "Missing KTDT tag".into() },
		"err_kdtd_size" => if fr { format!("KTDT taille invalide — attendu {KTDT_SIZE}, trouvé {key}") } else { format!("KTDT invalid size — expected {KTDT_SIZE}, got {key}") },
		"err_kdtd_body" => if fr { "Corps KTDT tronqué (4228 octets)".into() } else { "KTDT body truncated (4228 bytes)".into() },
		"err_no_data" => if fr { "Aucune section audio trouvée".into() } else { "No audio section found".into() },
		"warn_empty_pad_path" => if fr { "Chemin vide pour pad rempli".into() } else { "Empty path for filled pad".into() },
		"warn_path_not_ascii" => if fr { "Chemin contient des caractères non-ASCII".into() } else { "Path contains non-ASCII characters".into() },
		"warn_vol" => if fr { "Volume hors bornes 0–100".into() } else { "Volume out of range 0–100".into() },
		"warn_pan" => if fr { "Pan hors bornes -64..63".into() } else { "Pan out of range -64..63".into() },
		"warn_pitch" => if fr { "Pitch hors bornes ±1200".into() } else { "Pitch out of range ±1200".into() },
		"warn_fx" => if fr { "FX send hors bornes 0–127".into() } else { "FX send out of range 0–127".into() },
		"warn_isdt" => if fr { "Bloc ISDT manquant ou corrompu".into() } else { "Missing or corrupt ISDT block".into() },
		"warn_wav" => if fr { "WAV invalide ou non-PCM".into() } else { "Invalid or non-PCM WAV".into() },
		"warn_wav_rate" => if fr { "WAV non 48 kHz — sera converti".into() } else { "WAV not 48 kHz — will be converted".into() },
		"warn_wav_bits" => if fr { "WAV non 16-bit".into() } else { "WAV not 16-bit".into() },
		"info_ok" => if fr { "Archive STK valide (fw 3.2)".into() } else { "STK archive valid (fw 3.2)".into() },
		"info_pads" => if fr { "Pads remplis".into() } else { "Pads filled".into() },
		_ => key.to_string(),
	}
}

fn read_le32(b: &[u8]) -> u32 {
	// Bounds-checked: a short slice reads as 0 rather than panicking. Callers
	// that need to distinguish absence use the shared take()/read_le_u32.
	crate::stk_format::read_le_u32(b, 0).unwrap_or(0)
}

fn has_valid_header(data: &[u8]) -> bool {
	// The official layout stores (file_len - 360) at offset 4. For files
	// shorter than the 360-byte container overhead that subtraction would
	// underflow, so guard it with checked_sub before comparing.
	let official = take(data, 0, 4) == Some(OFFICIAL_MAGIC.as_slice())
		&& match data.len().checked_sub(HEADER_FILE_SIZE_ADJUSTMENT) {
			Some(expected) => read_le_u32(data, 4) == Some(expected as u32),
			None => false,
		};
	official || take(data, 0, 8) == Some(LEGACY_MAGIC.as_slice())
}

pub fn inspect(path: &str, locale: &str) -> Result<StkInspectReport, String> {
	let p = Path::new(path);
	if !p.exists() {
		return Err(tr("err_not_found", locale));
	}
	let data = std::fs::read(p).map_err(|e| format!("{}: {e}", tr("err_not_found", locale)))?;
	let bytes = data.len() as u64;
	if data.is_empty() {
		return Err(tr("err_empty", locale));
	}

	let mut errors: Vec<String> = Vec::new();
	let mut warnings: Vec<String> = Vec::new();
	let mut info: Vec<String> = Vec::new();

	let (header_ok, ktdt_ok) = inspect_header(&data, locale, &mut errors, &mut warnings);

	let (pads, pads_filled) = inspect_ktdt_pads(&data, locale, &mut warnings);

	inspect_audio_section(&data, locale, &mut errors, &mut warnings, &mut info);

	let valid = errors.is_empty() && header_ok && ktdt_ok;
	if valid && warnings.is_empty() {
		info.push(tr("info_ok", locale));
	}
	info.push(format!("{}: {pads_filled}/15", tr("info_pads", locale)));

	Ok(StkInspectReport {
		path: path.to_string(),
		valid,
		bytes,
		header_ok,
		ktdt_ok,
		pads_total: 16,
		pads_filled,
		pads,
		errors,
		warnings,
		info,
	})
}

/// Validate the 32-byte main header and the presence of the KTDT body,
/// recording any problems into `errors`/`warnings`. Returns
/// `(header_ok, ktdt_ok)`.
fn inspect_header(
	data: &[u8],
	locale: &str,
	errors: &mut Vec<String>,
	warnings: &mut Vec<String>,
) -> (bool, bool) {
	let mut header_ok = true;
	let mut ktdt_ok = true;

	// Header checks
	if data.len() < HEADER_SIZE {
		errors.push(tr("err_truncated_header", locale));
		header_ok = false;
	} else {
		if !has_valid_header(data) {
			errors.push(tr("err_magic", locale));
			header_ok = false;
		}
		if data[8..12] != [0; 4]
			|| read_le32(&data[12..16]) != 0x10
			|| data[24..28] != [0; 4]
			|| read_le32(&data[28..32]) != 1
		{
			errors.push(tr("err_header_fields", locale));
			header_ok = false;
		}
		if &data[16..20] != KTDT_TAG {
			errors.push(tr("err_kdtd_tag", locale));
			header_ok = false;
		}
		let ksize = read_le32(&data[20..24]) as usize;
		if ksize != KTDT_SIZE {
			warnings.push(format!("{}: {ksize}", tr("err_kdtd_size", locale)));
			ktdt_ok = false;
		}
	}

	if data.len() < HEADER_SIZE + KTDT_SIZE {
		errors.push(tr("err_kdtd_body", locale));
		ktdt_ok = false;
	}

	(header_ok, ktdt_ok)
}

/// Decode the 15 real pad entries from the KTDT block (plus the reserved pad
/// 16), gathering per-pad warnings into `warnings`. Returns the pad list and
/// the count of pads carrying a real sample.
fn inspect_ktdt_pads(
	data: &[u8],
	locale: &str,
	warnings: &mut Vec<String>,
) -> (Vec<StkPadInfo>, usize) {
	let mut pads: Vec<StkPadInfo> = Vec::new();
	let mut pads_filled = 0usize;

	if data.len() >= HEADER_SIZE + KTDT_SIZE {
		let ktdt = &data[HEADER_SIZE..HEADER_SIZE + KTDT_SIZE];
		for i in 0..15 {
			let off = i * ENTRY_SIZE;
			if off + PATH_FIELD > ktdt.len() {
				break;
			}
			let raw_path = &ktdt[off..off + PATH_FIELD];
			let nul = raw_path.iter().position(|&b| b == 0).unwrap_or(PATH_FIELD);
			let path_str = String::from_utf8_lossy(&raw_path[..nul]).to_string();

			let vol = ktdt.get(off + PATH_FIELD).copied().unwrap_or(0);
			let pan_raw = ktdt.get(off + PATH_FIELD + 1).copied().unwrap_or(0);
			let pan = pan_raw as i8;
			let pitch = if off + PATH_FIELD + 8 <= ktdt.len() {
				i32::from_le_bytes([
					ktdt[off + PATH_FIELD + 4],
					ktdt[off + PATH_FIELD + 5],
					ktdt[off + PATH_FIELD + 6],
					ktdt[off + PATH_FIELD + 7],
				])
			} else {
				0
			};
			let fx = ktdt.get(off + PATH_FIELD + 16).copied().unwrap_or(0);

			let mut pwarns = Vec::new();
			let mut valid = true;

			if path_str.is_empty() {
				pwarns.push(tr("warn_empty_pad_path", locale));
				valid = false;
			}
			if !path_str.is_ascii() {
				pwarns.push(tr("warn_path_not_ascii", locale));
			}
			if vol > 100 {
				pwarns.push(tr("warn_vol", locale));
				valid = false;
			}
			if (pan as i16) < -64 || (pan as i16) > 63 {
				pwarns.push(tr("warn_pan", locale));
				valid = false;
			}
			if !( -1200..=1200).contains(&pitch) {
				pwarns.push(tr("warn_pitch", locale));
				valid = false;
			}
			if fx > 127 {
				pwarns.push(tr("warn_fx", locale));
				valid = false;
			}

			// Consider pad filled if path contains a real filename (not "sample.wav" placeholder with empty source)
			let is_filled = !path_str.is_empty() && !path_str.ends_with("sample.wav");
			if is_filled {
				pads_filled += 1;
			}

			pads.push(StkPadInfo {
				pad: (i + 1) as u8,
				path: path_str,
				volume: vol,
				pan,
				pitch,
				fx_send: fx,
				valid,
				warnings: pwarns.clone(),
			});
			warnings.extend(pwarns);
		}
		// Pad 16 is reserved / disabled — add synthetic entry for completeness
		pads.push(StkPadInfo {
			pad: 16,
			path: String::new(),
			volume: 0,
			pan: 0,
			pitch: 0,
			fx_send: 0,
			valid: true,
			warnings: vec![],
		});
	}

	(pads, pads_filled)
}

/// Walk the audio section, counting ISDT records and best-effort validating
/// each embedded WAV (sample rate / bit depth / RIFF integrity). Records any
/// findings into `errors`/`warnings` and a summary line into `info`.
fn inspect_audio_section(
	data: &[u8],
	locale: &str,
	errors: &mut Vec<String>,
	warnings: &mut Vec<String>,
	info: &mut Vec<String>,
) {
	// Audio section validation — look for ISDT + WAV pattern
	if data.len() > HEADER_SIZE + KTDT_SIZE {
		let audio = &data[HEADER_SIZE + KTDT_SIZE..];
		if audio.is_empty() {
			errors.push(tr("err_no_data", locale));
		} else {
			// The first ISDT belongs to sample 1 but is embedded in KTDT; the
			// remaining records live in the audio section before samples 2–15.
			let embedded_first_isdt =
				take(data, HEADER_SIZE + FIRST_ISDT_OFFSET, 4) == Some(b"ISDT".as_slice());
			let isdt_count = audio.windows(4).filter(|w| w == b"ISDT").count()
				+ if embedded_first_isdt { 1 } else { 0 };
			if isdt_count < 15 {
				warnings.push(format!("{} (found {isdt_count}, expected 15)", tr("warn_isdt", locale)));
			}
			// Validate each embedded WAV (best-effort via parse_wav)
			let mut offset = 0usize;
			let mut wav_idx = 0usize;
			while offset + 8 < audio.len() && wav_idx < 16 {
				// Skip 2-byte padding + ISDT (16 bytes) if present
				if offset + 2 < audio.len() && &audio[offset..offset + 2] == b"\0\0" {
					offset += 2;
				}
				if offset + 16 < audio.len() && &audio[offset..offset + 4] == b"ISDT" {
					offset += 16;
				}
				if offset + 12 >= audio.len() {
					break;
				}
				if &audio[offset..offset + 4] != b"RIFF" {
					warnings.push(format!("Pad {}: {}", wav_idx + 1, tr("warn_wav", locale)));
					break;
				}
				// Find data chunk size to advance
				let riff_size = read_le32(&audio[offset + 4..offset + 8]) as usize;
				let wav_end = offset + 8 + riff_size;
				if wav_end > audio.len() {
					errors.push(format!("Pad {}: truncated WAV", wav_idx + 1));
					break;
				}
				let wav_bytes = &audio[offset..wav_end];
				// Validate via wav parser
				if let Ok(info_wav) = crate::wav::parse_wav_for_inspect(wav_bytes) {
					if info_wav.sample_rate != 48000 {
						warnings.push(format!("Pad {}: {}", wav_idx + 1, tr("warn_wav_rate", locale)));
					}
					if info_wav.bits != 16 {
						warnings.push(format!("Pad {}: {}", wav_idx + 1, tr("warn_wav_bits", locale)));
					}
				} else {
					warnings.push(format!("Pad {}: {}", wav_idx + 1, tr("warn_wav", locale)));
				}
				offset = wav_end;
				// Align to 2-byte boundary
				if offset & 1 == 1 {
					offset += 1;
				}
				wav_idx += 1;
				if offset >= audio.len() {
					break;
				}
			}
			info.push(format!("Audio section: {} WAV(s) found", wav_idx));
		}
	}
}

// ── Safe extraction of a third-party .stk into an editable kit ──────────────
//
// Reverses the exact layout written by `compile::build_stk`:
//   [32B header] [4228B KTDT: 15 × 280B pad entries] [audio: WAVs separated by
//   0x00 0x00 + a 16B ISDT record before every WAV after the first].
//
// The source `.stk` is only ever READ (`std::fs::read`); every byte written
// goes to the caller-chosen destination. WAVs land under `samples/`, a JSON
// companion in the canonical `Project` shape is written at the kit root, and an
// `extraction.json` manifest records provenance. Original source paths, notes
// and edit history are NOT recoverable from a compiled `.stk` — the manifest
// says so explicitly.

/// Per-pad summary of what extraction produced.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedPad {
	/// 1-based pad number.
	pub pad: u8,
	/// Name of the WAV written under `samples/`, or `None` if the pad was empty.
	pub wav_file: Option<String>,
	/// Size of the extracted WAV in bytes (0 when no WAV was written).
	pub bytes: u64,
	/// Playback volume copied from the archive.
	pub volume: u8,
	/// Stereo pan copied from the archive.
	pub pan: i8,
	/// Pitch offset copied from the archive.
	pub pitch: i32,
	/// FX send level copied from the archive.
	pub fx_send: u8,
}

/// Result of a successful extraction.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StkExtractReport {
	/// Source `.stk` path that was read (never modified).
	pub source: String,
	/// SHA-256 of the source bytes, for provenance.
	pub source_sha256: String,
	/// Destination directory the kit was written into.
	pub dest_dir: String,
	/// Path of the canonical `Project` JSON companion written at the kit root.
	pub json_path: String,
	/// Path of the `extraction.json` provenance manifest.
	pub manifest_path: String,
	/// Kit name (from the caller or derived from the source file stem).
	pub kit_name: String,
	/// Number of WAV files written under `samples/`.
	pub wavs_written: usize,
	/// Per-pad extraction details.
	pub pads: Vec<ExtractedPad>,
	/// Human-readable note about what a `.stk` cannot restore.
	pub note: String,
}

fn tr_ex(key: &str, locale: &str) -> String {
	let fr = locale.to_lowercase().starts_with("fr");
	match key {
		"err_invalid" => if fr {
			"STK invalide — extraction refusée. Corrigez les erreurs d'abord.".into()
		} else {
			"Invalid STK — extraction refused. Fix the errors first.".into()
		},
		"err_dest_not_empty" => if fr {
			"Le dossier de destination doit être vide ou inexistant".into()
		} else {
			"Destination directory must be empty or not exist".into()
		},
		"err_dest_is_file" => if fr {
			"La destination existe déjà en tant que fichier".into()
		} else {
			"Destination already exists as a file".into()
		},
		"note" => if fr {
			"Kit extrait d'un .stk compilé. Les WAV et paramètres de pad sont \
			 reconstruits depuis l'archive. Les chemins d'origine, notes et \
			 l'historique d'édition ne peuvent pas être récupérés depuis un .stk."
				.into()
		} else {
			"Kit extracted from a compiled .stk. WAVs and pad parameters are \
			 reconstructed from the archive. Original source paths, notes and \
			 edit history cannot be recovered from a .stk."
				.into()
		},
		_ => key.to_string(),
	}
}

fn sha256_hex(data: &[u8]) -> String {
	crate::stk_format::sha256_hex(data)
}

/// Sanitize a pad filename derived from an untrusted embedded path. Strips any
/// directory components and traversal so a crafted `.stk` can never write
/// outside `samples/`.
fn safe_wav_name(embedded_path: &str, pad: u8) -> String {
	let stem = Path::new(embedded_path)
		.file_name()
		.map(|n| n.to_string_lossy().into_owned())
		.filter(|n| !n.is_empty() && n != "." && n != "..")
		.unwrap_or_default();
	let cleaned: String = stem
		.chars()
		.filter(|c| *c != '/' && *c != '\\' && *c != '\0')
		.collect();
	if cleaned.is_empty() {
		format!("pad{pad:02}.wav")
	} else if cleaned.to_lowercase().ends_with(".wav") {
		cleaned
	} else {
		format!("{cleaned}.wav")
	}
}

/// Split the audio section into per-pad WAV byte ranges, mirroring `build_stk`.
fn split_wavs(audio: &[u8]) -> Vec<Vec<u8>> {
	let mut wavs = Vec::new();
	let mut offset = 0usize;
	while offset + 12 <= audio.len() {
		// Skip inter-WAV 2-byte padding (present before every WAV after the first).
		if offset + 2 <= audio.len() && &audio[offset..offset + 2] == b"\0\0" {
			offset += 2;
		}
		// Skip a 16-byte ISDT record if present.
		if offset + 16 <= audio.len() && &audio[offset..offset + 4] == b"ISDT" {
			offset += 16;
		}
		if offset + 12 > audio.len() || &audio[offset..offset + 4] != b"RIFF" {
			break;
		}
		let riff_size = read_le32(&audio[offset + 4..offset + 8]) as usize;
		let wav_end = offset + 8 + riff_size;
		if wav_end > audio.len() {
			break;
		}
		wavs.push(audio[offset..wav_end].to_vec());
		offset = wav_end;
	}
	wavs
}

/// Extract a validated third-party `.stk` into a new editable kit directory.
///
/// * `stk_path` — source archive, read-only. Never modified.
/// * `dest_dir` — must not exist, or must be an empty directory.
/// * `kit_name` — optional; defaults to the source file stem.
pub fn extract(
	stk_path: &str,
	dest_dir: &str,
	kit_name: Option<&str>,
	locale: &str,
) -> Result<StkExtractReport, String> {
	// 1. Validate the source WITHOUT touching it, then read its bytes.
	let (report, data, source_sha256) = extract_validate_and_read(stk_path, locale)?;
	let src = Path::new(stk_path);

	// 2. Prepare a clean destination.
	let (dest, samples_dir) = extract_prepare_dest(dest_dir, locale)?;

	// 3. Split the audio section into per-pad WAVs (byte-range copy).
	let audio = &data[HEADER_SIZE + KTDT_SIZE..];
	let wavs = split_wavs(audio);

	let kit_name = kit_name
		.map(|s| s.trim())
		.filter(|s| !s.is_empty())
		.map(|s| s.to_string())
		.unwrap_or_else(|| {
			src.file_stem()
				.map(|s| s.to_string_lossy().into_owned())
				.unwrap_or_else(|| "ExtractedKit".to_string())
		});

	// 4. Rebuild pads from the KTDT params + write WAVs. Pad 16 is reserved.
	let (pads_json, extracted, wavs_written) =
		extract_rebuild_pads(&report, &wavs, &samples_dir)?;

	// 5-6. Write the Project JSON companion and the provenance manifest.
	let note = tr_ex("note", locale);
	let (json_path, manifest_path) = extract_write_companions(
		&dest,
		&kit_name,
		pads_json,
		&note,
		&source_sha256,
		src,
		wavs_written,
		report.pads_filled,
	)?;

	Ok(StkExtractReport {
		source: stk_path.to_string(),
		source_sha256,
		dest_dir: dest.to_string_lossy().into_owned(),
		json_path: json_path.to_string_lossy().into_owned(),
		manifest_path: manifest_path.to_string_lossy().into_owned(),
		kit_name,
		wavs_written,
		pads: extracted,
		note,
	})
}

/// Validate the source archive without modifying it, then read its bytes and
/// fingerprint. Returns the inspection report, the raw bytes, and the source
/// SHA-256. Errors (writing nothing) when the archive is invalid or unreadable.
fn extract_validate_and_read(
	stk_path: &str,
	locale: &str,
) -> Result<(StkInspectReport, Vec<u8>, String), String> {
	let report = inspect(stk_path, locale)?;
	if !report.valid {
		let detail = report.errors.join("; ");
		return Err(format!("{}{}", tr_ex("err_invalid", locale),
			if detail.is_empty() { String::new() } else { format!(" ({detail})") }));
	}
	let src = Path::new(stk_path);
	let data = std::fs::read(src).map_err(|e| format!("{}: {e}", tr("err_not_found", locale)))?;
	let source_sha256 = sha256_hex(&data);
	Ok((report, data, source_sha256))
}

/// Ensure `dest_dir` is a clean target (created if absent, refused if it is a
/// file or a non-empty directory) and create its `samples/` subdirectory.
/// Returns `(dest, samples_dir)`.
fn extract_prepare_dest(dest_dir: &str, locale: &str) -> Result<(PathBuf, PathBuf), String> {
	let dest = PathBuf::from(dest_dir);
	if dest.is_file() {
		return Err(tr_ex("err_dest_is_file", locale));
	}
	if dest.is_dir() {
		let has_entries = std::fs::read_dir(&dest)
			.map_err(|e| e.to_string())?
			.next()
			.is_some();
		if has_entries {
			return Err(tr_ex("err_dest_not_empty", locale));
		}
	} else {
		std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
	}
	let samples_dir = dest.join("samples");
	std::fs::create_dir_all(&samples_dir).map_err(|e| e.to_string())?;
	Ok((dest, samples_dir))
}

/// Output of [`extract_rebuild_pads`]: the `pads` JSON map, the per-pad
/// extraction summaries, and the count of WAVs written.
type RebuiltPads = (serde_json::Map<String, serde_json::Value>, Vec<ExtractedPad>, usize);

/// Rebuild the editable pads: write each filled pad's WAV under `samples_dir`
/// (de-duplicating name collisions), copy the pad parameters, and build the
/// `pads` JSON map. Returns `(pads_json, extracted_pads, wavs_written)`.
fn extract_rebuild_pads(
	report: &StkInspectReport,
	wavs: &[Vec<u8>],
	samples_dir: &Path,
) -> Result<RebuiltPads, String> {
	let mut pads_json = serde_json::Map::new();
	let mut extracted = Vec::new();
	let mut wavs_written = 0usize;
	let mut used_names: std::collections::HashSet<String> = std::collections::HashSet::new();

	for info in report.pads.iter().filter(|p| p.pad <= 15) {
		let idx = (info.pad - 1) as usize;
		// A pad is only materialized when both a filled path and its WAV exist.
		let filled = !info.path.is_empty() && !info.path.ends_with("sample.wav");
		let wav_bytes = wavs.get(idx);

		let (wav_file, bytes) = if filled {
			if let Some(bytes) = wav_bytes {
				let mut name = safe_wav_name(&info.path, info.pad);
				// De-duplicate collisions so no WAV is silently overwritten.
				while !used_names.insert(name.clone()) {
					name = format!("pad{:02}_{name}", info.pad);
				}
				let out = samples_dir.join(&name);
				std::fs::write(&out, bytes).map_err(|e| e.to_string())?;
				wavs_written += 1;
				(Some(name), bytes.len() as u64)
			} else {
				(None, 0)
			}
		} else {
			(None, 0)
		};

		extracted.push(ExtractedPad {
			pad: info.pad,
			wav_file: wav_file.clone(),
			bytes,
			volume: info.volume,
			pan: info.pan,
			pitch: info.pitch,
			fx_send: info.fx_send,
		});

		if let Some(name) = wav_file {
			let rel = format!("samples/{name}");
			let mut s = serde_json::Map::new();
			s.insert("id".into(), serde_json::json!(format!("extracted-{}", info.pad)));
			s.insert("fileName".into(), serde_json::json!(name));
			s.insert("originalFileName".into(), serde_json::json!(name));
			s.insert("resolvedPath".into(), serde_json::json!(rel));
			s.insert("originalPath".into(), serde_json::json!(rel));
			s.insert("volume".into(), serde_json::json!(info.volume));
			s.insert("pan".into(), serde_json::json!(info.pan));
			s.insert("pitch".into(), serde_json::json!(info.pitch));
			s.insert("fxSend".into(), serde_json::json!(info.fx_send));
			pads_json.insert(info.pad.to_string(), serde_json::Value::Object(s));
		}
	}

	Ok((pads_json, extracted, wavs_written))
}

/// Write the two companion files: the canonical `Project` JSON (matching
/// `models::Project`) at the kit root, and the `extraction.json` provenance
/// manifest. Returns `(json_path, manifest_path)`.
#[allow(clippy::too_many_arguments)]
fn extract_write_companions(
	dest: &Path,
	kit_name: &str,
	pads_json: serde_json::Map<String, serde_json::Value>,
	note: &str,
	source_sha256: &str,
	src: &Path,
	wavs_written: usize,
	pads_filled: usize,
) -> Result<(PathBuf, PathBuf), String> {
	// Canonical Project JSON companion (matches models::Project).
	let project = serde_json::json!({
		"format": crate::models::PROJECT_FORMAT,
		"fmtVersion": crate::models::PROJECT_FORMAT_VERSION,
		"fmt_version": crate::models::PROJECT_FORMAT_VERSION,
		"app_version": crate::models::APP_VERSION,
		"device": { "profile": "smpltrek", "firmware": "3.2" },
		"kit": {
			"name": kit_name,
			"pads": pads_json,
			"notes": note,
		}
	});
	let json_path = dest.join(format!("{}.json", crate::stk_format::sanitize_kit_filename(kit_name)));
	std::fs::write(&json_path, serde_json::to_string_pretty(&project).map_err(|e| e.to_string())?)
		.map_err(|e| e.to_string())?;

	// Provenance manifest.
	let manifest = serde_json::json!({
		"extractedFrom": src.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
		"sourceSha256": source_sha256,
		"extractedAtUnix": crate::stk_format::unix_now_secs(),
		"wavsWritten": wavs_written,
		"padsFilled": pads_filled,
		"unrecoverable": note,
	});
	let manifest_path = dest.join("extraction.json");
	std::fs::write(&manifest_path, serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?)
		.map_err(|e| e.to_string())?;

	Ok((json_path, manifest_path))
}

#[cfg(test)]
mod inspect_tests {
	use super::*;

	// A 100-byte file starts with the magic but is far shorter than the 360-byte
	// container overhead. This is the case that used to underflow
	// data.len() - HEADER_FILE_SIZE_ADJUSTMENT. It must produce an invalid
	// report (or Err) and must not panic.
	#[test]
	fn inspect_100_byte_stk_does_not_panic() {
		let dir = std::env::temp_dir().join(format!(
			"stk_inspect_100_{}_{}",
			std::process::id(),
			std::time::SystemTime::now()
				.duration_since(std::time::UNIX_EPOCH)
				.unwrap()
				.as_nanos()
		));
		std::fs::create_dir_all(&dir).unwrap();
		let f = dir.join("tiny.stk");
		let mut bytes = vec![0u8; 100];
		bytes[0..4].copy_from_slice(OFFICIAL_MAGIC); // magic present, body absent
		std::fs::write(&f, &bytes).unwrap();

		let rep = inspect(f.to_str().unwrap(), "en").expect("inspect returns a report, not a panic");
		assert!(!rep.valid, "a 100-byte .stk cannot be a valid archive");
		assert!(!rep.errors.is_empty(), "truncation must be reported as an error");

		let _ = std::fs::remove_dir_all(&dir);
	}
}

#[cfg(test)]
mod extract_tests {
	use super::*;

	// Build a valid synthetic .stk with the given per-pad (name, params) using
	// the real compiler, so tests exercise the actual round-trip.
	fn build_fixture(pads: &[(u8, &str, u8, i8, i32, u8)]) -> (Vec<u8>, tempfiles::TempDir) {
		use crate::models::{Project, Sample};
		let tmp = tempfiles::TempDir::new();
		let mut p = Project::new("FIXTURE");
		for &(pad, name, vol, pan, pitch, fx) in pads {
			// Create a tiny clean RIFF/fmt/data WAV on disk for the sample to
			// point at (48k/16-bit mono), so the compiler's normalizer reads it.
			let pcm = vec![0i16; 64];
			let data_bytes = (pcm.len() * 2) as u32;
			let mut wav = Vec::new();
			wav.extend_from_slice(b"RIFF");
			wav.extend_from_slice(&(36 + data_bytes).to_le_bytes());
			wav.extend_from_slice(b"WAVEfmt ");
			wav.extend_from_slice(&16u32.to_le_bytes());
			wav.extend_from_slice(&1u16.to_le_bytes()); // PCM
			wav.extend_from_slice(&1u16.to_le_bytes()); // mono
			wav.extend_from_slice(&48000u32.to_le_bytes());
			wav.extend_from_slice(&96000u32.to_le_bytes());
			wav.extend_from_slice(&2u16.to_le_bytes());
			wav.extend_from_slice(&16u16.to_le_bytes());
			wav.extend_from_slice(b"data");
			wav.extend_from_slice(&data_bytes.to_le_bytes());
			for s in &pcm {
				wav.extend_from_slice(&s.to_le_bytes());
			}
			let wav_path = tmp.path().join(name);
			std::fs::write(&wav_path, &wav).unwrap();
			p.kit.pads.insert(pad, Sample {
				id: format!("id-{pad}"),
				file_name: name.to_string(),
				original_file_name: Some(name.to_string()),
				resolved_path: Some(wav_path.to_string_lossy().into_owned()),
				original_path: wav_path.to_string_lossy().into_owned(),
				sha256: None,
				meta: Default::default(),
				volume: vol,
				pan,
				pitch,
				fx_send: fx,
				note: None,
			});
		}
		let stk_path = tmp.path().join("fixture.stk");
		crate::compile::compile(&p, &crate::compile::CompileOptions {
			output_path: stk_path.to_string_lossy().into_owned(),
			mono: true,
			overwrite: true,
		}).unwrap();
		let bytes = std::fs::read(&stk_path).unwrap();
		(bytes, tmp)
	}

	// Minimal scoped temp-dir helper (no external dev-dependency).
	mod tempfiles {
		use std::path::{Path, PathBuf};
		use std::sync::atomic::{AtomicU64, Ordering};

		static NEXT_TEMP_DIR: AtomicU64 = AtomicU64::new(0);
		pub struct TempDir(PathBuf);
		impl TempDir {
			pub fn new() -> Self {
				let base = std::env::temp_dir().join(format!(
					"stk_extract_test_{}_{}_{}",
					std::process::id(),
					std::time::SystemTime::now()
						.duration_since(std::time::UNIX_EPOCH)
						.unwrap()
						.as_nanos(),
					NEXT_TEMP_DIR.fetch_add(1, Ordering::Relaxed)
				));
				std::fs::create_dir_all(&base).unwrap();
				TempDir(base)
			}
			pub fn path(&self) -> &Path { &self.0 }
		}
		impl Drop for TempDir {
			fn drop(&mut self) { let _ = std::fs::remove_dir_all(&self.0); }
		}
	}

	#[test]
	fn extract_writes_wavs_and_json_companion() {
		let (_bytes, tmp) = build_fixture(&[(1, "Kick.wav", 90, -10, 200, 5)]);
		let stk = tmp.path().join("fixture.stk");
		let dest = tmp.path().join("out");
		let rep = extract(stk.to_str().unwrap(), dest.to_str().unwrap(), Some("MyKit"), "en").unwrap();

		assert!(rep.wavs_written >= 1, "at least one WAV extracted");
		assert!(dest.join("samples").is_dir(), "samples/ created");
		assert!(dest.join("MyKit.json").is_file(), "JSON companion written");
		assert!(dest.join("extraction.json").is_file(), "manifest written");

		// A WAV file exists under samples/ and is a valid RIFF.
		let entries: Vec<_> = std::fs::read_dir(dest.join("samples")).unwrap().flatten().collect();
		assert!(!entries.is_empty());
		let first = std::fs::read(entries[0].path()).unwrap();
		assert_eq!(&first[0..4], b"RIFF");
	}

	#[test]
	fn extract_preserves_pad_parameters() {
		let (_b, tmp) = build_fixture(&[(1, "Snare.wav", 77, 20, -300, 12)]);
		let stk = tmp.path().join("fixture.stk");
		let dest = tmp.path().join("out");
		let rep = extract(stk.to_str().unwrap(), dest.to_str().unwrap(), None, "en").unwrap();

		let pad1 = rep.pads.iter().find(|p| p.pad == 1).unwrap();
		assert_eq!(pad1.volume, 77);
		assert_eq!(pad1.pan, 20);
		assert_eq!(pad1.pitch, -300);
		assert_eq!(pad1.fx_send, 12);

		// Same values must appear in the JSON companion.
		let json: serde_json::Value =
			serde_json::from_str(&std::fs::read_to_string(&rep.json_path).unwrap()).unwrap();
		let p = &json["kit"]["pads"]["1"];
		assert_eq!(p["volume"], 77);
		assert_eq!(p["pan"], 20);
		assert_eq!(p["pitch"], -300);
		assert_eq!(p["fxSend"], 12);
	}

	#[test]
	fn extract_never_alters_input_stk() {
		let (bytes, tmp) = build_fixture(&[(1, "Kick.wav", 100, 0, 0, 0)]);
		let stk = tmp.path().join("fixture.stk");
		let before = std::fs::read(&stk).unwrap();
		assert_eq!(before, bytes);
		let before_sha = sha256_hex(&before);

		let dest = tmp.path().join("out");
		extract(stk.to_str().unwrap(), dest.to_str().unwrap(), None, "en").unwrap();

		let after = std::fs::read(&stk).unwrap();
		assert_eq!(sha256_hex(&after), before_sha, "source .stk must be byte-identical after extraction");
	}

	#[test]
	fn extract_refuses_malformed_input() {
		let tmp = tempfiles::TempDir::new();
		let bad = tmp.path().join("bad.stk");
		std::fs::write(&bad, b"NOT A REAL STK FILE").unwrap();
		let dest = tmp.path().join("out");
		let res = extract(bad.to_str().unwrap(), dest.to_str().unwrap(), None, "en");
		assert!(res.is_err(), "malformed .stk must be refused");
		assert!(!dest.exists() || std::fs::read_dir(&dest).unwrap().next().is_none(),
			"nothing should be written when input is refused");
	}

	#[test]
	fn extract_refuses_non_empty_destination() {
		let (_b, tmp) = build_fixture(&[(1, "Kick.wav", 100, 0, 0, 0)]);
		let stk = tmp.path().join("fixture.stk");
		let dest = tmp.path().join("busy");
		std::fs::create_dir_all(&dest).unwrap();
		std::fs::write(dest.join("existing.txt"), b"keep me").unwrap();

		let res = extract(stk.to_str().unwrap(), dest.to_str().unwrap(), None, "en");
		assert!(res.is_err(), "non-empty destination must be refused");
		// The pre-existing file must be untouched.
		assert_eq!(std::fs::read_to_string(dest.join("existing.txt")).unwrap(), "keep me");
	}

	#[test]
	fn safe_wav_name_strips_traversal() {
		assert_eq!(safe_wav_name("../../etc/passwd", 3), "passwd.wav");
		assert_eq!(safe_wav_name("/abs/Internal/Kick.wav", 1), "Kick.wav");
		assert_eq!(safe_wav_name("", 7), "pad07.wav");
	}
}
