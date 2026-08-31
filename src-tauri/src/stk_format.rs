// Shared SmplTrek fw 3.2 .STK binary-layout constants and checked byte readers.
//
// Both the compiler (`compile.rs`) and the inspector/extractor (`stk_inspect.rs`)
// depend on these exact offsets and sizes. Keeping a single definition here is
// what guarantees the writer and the reader cannot silently disagree about the
// layout. See `file_format.md` for the reference format.

/// 4-byte magic tag at the very start of every SmplTrek `.STK` archive.
pub const VDK0_MAGIC: &[u8; 4] = b"VDK0";

/// Difference between the physical file length and the 32-bit size field stored
/// at header offset 4. Factory kits write `file_len - 360` there; the constant
/// also doubles as the minimum trailing container overhead beyond header+KTDT.
pub const HEADER_FILE_SIZE_ADJUSTMENT: usize = 360;

/// 4-byte tag introducing the KTDT (kit data) block.
pub const KTDT_TAG: &[u8; 4] = b"KTDT";

/// Size in bytes of the KTDT block body (0x1084 = 4228): fifteen 280-byte pad
/// entries plus the trailing footer that carries global volume and the first
/// embedded ISDT record.
pub const KTDT_SIZE: usize = 0x1084;

/// Fixed main-header length preceding the KTDT block.
pub const HEADER_SIZE: usize = 32;

/// Size in bytes of one pad entry inside the KTDT block (256-byte path field +
/// 24 bytes of per-pad parameters).
pub const ENTRY_SIZE: usize = 280;

/// Length of the NUL-terminated internal audio path field at the start of each
/// pad entry.
pub const PATH_FIELD: usize = 256;

/// Offset, within the KTDT body, of the first pad's embedded `ISDT` record
/// (pad index 0). Later pads' ISDT records live in the audio section.
pub const FIRST_ISDT_OFFSET: usize = 4212;

/// Offset, within the KTDT body, of the 32-bit global-volume field (0x64 = 100
/// at full scale), sitting in the footer just before the first ISDT record.
pub const GLOBAL_VOLUME_OFFSET: usize = 4208;

/// Return `data[off .. off+len]` only when the whole range is in bounds.
/// The single checked-slice primitive every parse path funnels through, so a
/// hostile embedded length can never trigger an out-of-bounds panic.
pub fn take(data: &[u8], off: usize, len: usize) -> Option<&[u8]> {
	data.get(off..off.checked_add(len)?)
}

/// Read a little-endian u32 at `off`, or `None` if fewer than 4 bytes remain.
pub fn read_le_u32(data: &[u8], off: usize) -> Option<u32> {
	let b = take(data, off, 4)?;
	Some(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

/// Read a little-endian u16 at `off`, or `None` if fewer than 2 bytes remain.
pub fn read_le_u16(data: &[u8], off: usize) -> Option<u16> {
	let b = take(data, off, 2)?;
	Some(u16::from_le_bytes([b[0], b[1]]))
}

/// Lowercase hex SHA-256 of a byte slice. The single hashing loop shared by the
/// file fingerprinter (`sha256_file`) and the extractor's provenance stamp.
pub fn sha256_hex(data: &[u8]) -> String {
	use sha2::{Digest, Sha256};
	let mut hasher = Sha256::new();
	hasher.update(data);
	let mut hex = String::with_capacity(64);
	for b in hasher.finalize() {
		use std::fmt::Write;
		let _ = write!(hex, "{b:02x}");
	}
	hex
}

/// Seconds since the UNIX epoch, or `0` if the clock is before it. The single
/// epoch helper shared by every caller that needs a coarse UNIX timestamp.
pub fn unix_now_secs() -> u64 {
	use std::time::{SystemTime, UNIX_EPOCH};
	SystemTime::now()
		.duration_since(UNIX_EPOCH)
		.map(|d| d.as_secs())
		.unwrap_or(0)
}

/// Sanitize a kit name into a filename that is safe on every target platform.
///
/// Kit filenames must be safe on Windows too: non-`[A-Za-z0-9_-]` characters
/// are replaced with `-`, runs of `-` are collapsed, leading/trailing `-`/`_`
/// are trimmed, and Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`,
/// `COM1..9`, `LPT1..9`) as well as an empty result all fall back to `"kit"`.
pub fn sanitize_kit_filename(name: &str) -> String {
	let mut safe = String::new();
	for character in name.chars() {
		let character = if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
			character
		} else {
			'-'
		};
		if character != '-' || !safe.ends_with('-') {
			safe.push(character);
		}
	}
	let safe = safe.trim_matches(['-', '_']).to_string();
	if safe.is_empty()
		|| matches!(
			safe.to_ascii_uppercase().as_str(),
			"CON" | "PRN"
				| "AUX" | "NUL" | "COM1"
				| "COM2" | "COM3" | "COM4"
				| "COM5" | "COM6" | "COM7"
				| "COM8" | "COM9" | "LPT1"
				| "LPT2" | "LPT3" | "LPT4"
				| "LPT5" | "LPT6" | "LPT7"
				| "LPT8" | "LPT9"
		) {
		"kit".into()
	} else {
		safe
	}
}
