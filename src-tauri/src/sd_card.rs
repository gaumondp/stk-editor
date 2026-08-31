use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}};
use walkdir::WalkDir;

const EXPECTED_DIRECTORIES: [&str; 3] = ["Pool", "Preset", "Project"];

/// Read-only summary of a selected SmplTrek SD-card directory.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SdCardReport {
    pub selected_path: String,
    pub smpltrek_path: Option<String>,
    pub valid: bool,
    pub missing_directories: Vec<String>,
    pub projects: Vec<String>,
    pub presets: SdPresetCounts,
    pub audio_files: Vec<SdAudioFile>,
}

/// Counts the preset formats available in the standard SmplTrek folders.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SdPresetCounts {
    pub audio_drum: usize,
    pub audio_inst: usize,
    pub kit: usize,
}

/// One WAV discovered under the selected SmplTrek directory.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SdAudioFile {
    pub relative_path: String,
    pub bytes: u64,
    pub source_group: String,
}

/// Inspects either a SmplTrek volume root or its `SmplTrek` directory without writing to it.
pub fn inspect_sd_card(selected_path: &str) -> Result<SdCardReport, String> {
    let selected = PathBuf::from(selected_path);
    if !selected.is_dir() {
        return Err(format!("selected path is not a directory: {selected_path}"));
    }

    let smpltrek = if selected.file_name().is_some_and(|name| name == "SmplTrek") {
        selected.clone()
    } else {
        selected.join("SmplTrek")
    };
    if !smpltrek.is_dir() {
        return Ok(SdCardReport {
            selected_path: selected.to_string_lossy().into_owned(),
            smpltrek_path: None,
            valid: false,
            missing_directories: EXPECTED_DIRECTORIES.iter().map(|directory| (*directory).to_string()).collect(),
            projects: Vec::new(),
            presets: SdPresetCounts::default(),
            audio_files: Vec::new(),
        });
    }

    let missing_directories: Vec<String> = EXPECTED_DIRECTORIES
        .iter()
        .filter(|directory| !smpltrek.join(directory).is_dir())
        .map(|directory| (*directory).to_string())
        .collect();

    Ok(SdCardReport {
        selected_path: selected.to_string_lossy().into_owned(),
        smpltrek_path: Some(smpltrek.to_string_lossy().into_owned()),
        valid: missing_directories.is_empty(),
        missing_directories,
        projects: directory_names(&smpltrek.join("Project")),
        presets: SdPresetCounts {
            audio_drum: count_extension(&smpltrek.join("Preset/Audio/Drum"), "stk"),
            audio_inst: count_extension(&smpltrek.join("Preset/Audio/Inst"), "wav"),
            kit: count_extension(&smpltrek.join("Preset/Kit"), "stk"),
        },
        audio_files: wav_files(&smpltrek),
    })
}

fn directory_names(path: &Path) -> Vec<String> {
    let mut names: Vec<_> = fs::read_dir(path)
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_dir())
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .collect();
    names.sort_by_key(|name| name.to_lowercase());
    names
}

fn count_extension(path: &Path, extension: &str) -> usize {
    WalkDir::new(path)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file() && has_extension(entry.path(), extension))
        .count()
}

fn wav_files(root: &Path) -> Vec<SdAudioFile> {
    let mut files: Vec<_> = WalkDir::new(root)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file() && has_extension(entry.path(), "wav"))
        .filter_map(|entry| {
            let relative = entry.path().strip_prefix(root).ok()?;
            let relative_path = relative.to_string_lossy().replace('\\', "/");
            let source_group = relative
                .components()
                .next()?
                .as_os_str()
                .to_string_lossy()
                .into_owned();
            Some(SdAudioFile {
                relative_path,
                bytes: entry.metadata().ok()?.len(),
                source_group,
            })
        })
        .collect();
    files.sort_by_key(|file: &SdAudioFile| file.relative_path.to_lowercase());
    files
}

fn has_extension(path: &Path, extension: &str) -> bool {
    path.extension().is_some_and(|value| value.eq_ignore_ascii_case(extension))
}

#[cfg(test)]
mod tests {
    use super::inspect_sd_card;
    use std::{fs, path::{Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};

    fn temp_card(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("stk-forge-sd-card-{name}-{unique}"));
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn create_complete_card(root: &Path) -> PathBuf {
        let smpltrek = root.join("SmplTrek");
        for directory in [
            "Pool/Audio/Drum",
            "Preset/Audio/Drum",
            "Preset/Audio/Inst",
            "Preset/Kit",
            "Project/alpha",
            "Project/Bravo",
        ] {
            fs::create_dir_all(smpltrek.join(directory)).unwrap();
        }
        fs::write(smpltrek.join("Pool/Audio/Drum/kick.wav"), []).unwrap();
        fs::write(smpltrek.join("Preset/Audio/Inst/bass.wav"), []).unwrap();
        fs::write(smpltrek.join("Preset/Audio/Drum/House.stk"), []).unwrap();
        fs::write(smpltrek.join("Preset/Kit/Trap.stk"), []).unwrap();
        smpltrek
    }

    #[test]
    fn reads_a_card_volume_and_summarizes_projects_presets_and_wavs() {
        let card = temp_card("complete");
        let smpltrek = create_complete_card(&card);

        let report = inspect_sd_card(card.to_str().unwrap()).unwrap();

        assert!(report.valid);
        assert_eq!(report.smpltrek_path.as_deref(), Some(smpltrek.to_str().unwrap()));
        assert_eq!(report.projects, vec!["alpha", "Bravo"]);
        assert_eq!(report.presets.audio_drum, 1);
        assert_eq!(report.presets.audio_inst, 1);
        assert_eq!(report.presets.kit, 1);
        assert_eq!(report.audio_files.len(), 2);
        assert_eq!(report.audio_files[0].relative_path, "Pool/Audio/Drum/kick.wav");
        fs::remove_dir_all(card).unwrap();
    }

    #[test]
    fn accepts_the_smpltrek_directory_itself() {
        let card = temp_card("direct");
        let smpltrek = create_complete_card(&card);

        let report = inspect_sd_card(smpltrek.to_str().unwrap()).unwrap();

        assert!(report.valid);
        assert_eq!(report.smpltrek_path.as_deref(), Some(smpltrek.to_str().unwrap()));
        fs::remove_dir_all(card).unwrap();
    }

    #[test]
    fn reports_a_missing_smpltrek_directory_without_scanning_the_volume() {
        let card = temp_card("missing-root");
        fs::write(card.join("outside.wav"), []).unwrap();

        let report = inspect_sd_card(card.to_str().unwrap()).unwrap();

        assert!(!report.valid);
        assert!(report.smpltrek_path.is_none());
        assert!(report.projects.is_empty());
        assert!(report.audio_files.is_empty());
        fs::remove_dir_all(card).unwrap();
    }

    #[test]
    fn reports_an_incomplete_card_and_keeps_discovered_audio() {
        let card = temp_card("incomplete");
        let smpltrek = card.join("SmplTrek");
        fs::create_dir_all(smpltrek.join("Pool/Audio")).unwrap();
        fs::write(smpltrek.join("Pool/Audio/loop.wav"), []).unwrap();
        fs::create_dir_all(smpltrek.join("Project/Sketch")).unwrap();

        let report = inspect_sd_card(card.to_str().unwrap()).unwrap();

        assert!(!report.valid);
        assert_eq!(report.missing_directories, vec!["Preset"]);
        assert_eq!(report.projects, vec!["Sketch"]);
        assert_eq!(report.audio_files[0].relative_path, "Pool/Audio/loop.wav");
        fs::remove_dir_all(card).unwrap();
    }
}
