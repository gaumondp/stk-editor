use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
pub struct WindowSize {
	pub width: u32,
	pub height: u32,
}

fn parse_window_size(raw: &str) -> Option<WindowSize> {
	let size = serde_json::from_str::<WindowSize>(raw).ok()?;
	(size.width > 0 && size.height > 0).then_some(size)
}

pub fn load_window_size() -> Option<WindowSize> {
	let path = super::prefs_path().ok()?.with_file_name("window-size.json");
	let raw = fs::read_to_string(path).ok()?;
	parse_window_size(&raw)
}

pub fn save_window_size(size: WindowSize) {
	if size.width == 0 || size.height == 0 {
		return;
	}
	let path = match super::prefs_path() {
		Ok(path) => path.with_file_name("window-size.json"),
		Err(_) => return,
	};
	let Some(directory) = path.parent() else {
		return;
	};
	if fs::create_dir_all(directory).is_err() {
		return;
	}
	let Ok(contents) = serde_json::to_string(&size) else {
		return;
	};
	let temporary_path = path.with_extension("json.tmp");
	if fs::write(&temporary_path, contents).is_ok() {
		let _ = fs::rename(temporary_path, path);
	}
}

#[cfg(test)]
mod tests {
	use super::{parse_window_size, WindowSize};

	#[test]
	fn parses_a_valid_native_window_size() {
		assert_eq!(
			parse_window_size(r#"{"width":1920,"height":1200}"#),
			Some(WindowSize { width: 1920, height: 1200 })
		);
	}

	#[test]
	fn rejects_zero_or_malformed_native_window_sizes() {
		assert_eq!(parse_window_size(r#"{"width":0,"height":820}"#), None);
		assert_eq!(parse_window_size("not json"), None);
	}
}
