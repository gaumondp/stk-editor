// i18n (spec §11). Self-contained, UTF-8, ICU-like dictionaries for en / fr / ja.
//
// The interface starts in ENGLISH on every fresh install. The host system
// language is never consulted; only an explicit choice in the language menu is
// persisted (key `stk-forge.locale`) and restored.
//
// English is also the fallback locale: a key missing from the active locale
// falls back to English, then to the key itself, so a raw key can never surface
// while a translation exists in English.
import { writable, get } from 'svelte/store';

// Reactive version counter — bumped on every locale change so tr() re-evaluates.
let _tv = 0;
const tick = writable(0);

function bumpTick() {
	_tv++;
	tick.set(_tv);
}

// Minimal ICU interpolation: {name} and plural {count, plural, one{...} other{...}}
const en: Record<string, string> = {
	'app.title': 'STK Forge',
	'welcome.description': 'Create editable kits and compile .stk files for Sonicware devices.',
	'welcome.supported': 'Tested only with Sonicware SmplTrek firmware 3.2.',
	'welcome.elz1': 'ELZ_1 Play STK data is documented by Sonicware, but is not verified by STK Forge.',
	'welcome.hint': 'Drag WAV files onto pads • Cmd/Ctrl+Click removes a sample • Double-click previews • F1 opens help',
	'menu.new': 'New kit',
	'menu.kit': 'Kit',
	'menu.open': 'Open kit…',
	'menu.open_compiled': 'Open compiled kit…',
	'menu.save': 'Save',
	'menu.save_as': 'Save as…',
	'menu.kit_information': 'Kit information…',
	'menu.find_missing': 'Find missing audio files…',
	'menu.close': 'Close kit',
	'menu.quit': 'Quit STK Forge',
	'menu.compile': 'Compile kit',
	'menu.compile_file': 'Compile to .stk…',
	'menu.export': 'Export',
	'menu.export_sd': 'Export to SD card…',
	'menu.export_full': 'Export kit with JSON…',
	'menu.undo': 'Undo',
	'menu.redo': 'Redo',
	'menu.about': 'About STK Forge',
	'menu.recent': 'Recent kits…',
	'menu.help': 'Help',
	'menu.language': 'Language',
	'status.saved': 'Saved',
	'status.modified': 'Modified',
	'status.saving': 'Saving…',
	'status.compiling': 'Compiling…',
	'status.compile_ok': 'Compilation succeeded',
	'status.compile_error': 'Compilation failed',
	'status.missing': 'Missing audio file',
	'status.invalid': 'Invalid project',
	'status.git_conflict': 'Git conflict',
	'status.git_sync': 'Git sync…',
	'status.git_sync_ok': 'Git sync OK',
	'status.git_error': 'Git error',
	'pad.empty': 'Empty',
	'pad.assigned': 'Assigned',
	'pad.selected': 'Selected',
	'pad.drag_over': 'Drop WAV here',
	'pad.missing': 'Missing',
	'pad.invalid': 'Invalid',
	'pad.disabled': 'Reserved',
	'pad.count_one': '{count} pad',
	'pad.count_other': '{count} pads',
	'kit.name': 'Kit name',
	'kit.pads': 'Pads',
	'kit.notes': 'Notes',
	'explorer.title': 'Audio files',
	'explorer.select_dir': 'Choose folder…',
	'explorer.name': 'File',
	'explorer.size': 'Size',
	'explorer.duration': 'Duration',
	'explorer.date': 'Date',
	'explorer.columns': 'Columns',
	'explorer.show_size': 'Show size',
	'explorer.show_duration': 'Show duration',
	'explorer.show_date': 'Show date',
	'explorer.resize': 'Resize Audio Explorer',
	'explorer.compatible': 'Compatible',
	'explorer.search': 'Search',
	'explorer.play': 'Preview',
	'explorer.stop': 'Stop preview',
	'explorer.volume': 'Volume',
	'explorer.preview_volume': 'Preview volume',
	'explorer.no_preview': 'No WAV preview selected',
	'explorer.preview_error': 'Unable to play this WAV',
	'explorer.missing_global': 'Find missing files',
	'explorer.sort': 'Sort',
	'explorer.sort_name': 'Name',
	'missing.title': 'Missing files',
	'missing.relink': 'Relink',
	'btn.compile': 'Compile kit',
	'btn.save': 'Save',
	'btn.save_as': 'Save as',
	'btn.export_sd': 'Export to SD card (hardware)',
	'btn.export_full': 'Full export (with JSON)',
	'btn.open_dir': 'Open output folder',
	'compile.title': 'Compile to .STK',
	'compile.output': 'Output .STK file',
	'compile.mono': 'Mono',
	'compile.stereo': 'Stereo',
	'compile.overwrite': 'Overwrite if exists',
	'compile.copy_samples': 'Copy samples on export',
	'compile.blocking': 'Blocking errors',
	'compile.warnings': 'Warnings',
	'unsaved.title': 'Unsaved changes',
	'unsaved.body': 'Some changes have not been saved. What do you want to do?',
	'unsaved.save': 'Save',
	'unsaved.discard': 'Discard',
	'unsaved.cancel': 'Cancel',
	'help.shortcuts': 'Keyboard shortcuts',
	'help.guide': 'User guide',
	'help.json': 'JSON format',
	'help.compile_doc': 'Compilation',
	'help.sd_doc': 'SD export',
	'help.compatibility': 'Compatibility',
	'help.diagnostic': 'Diagnostic report',
	'help.guide_body':
		'Drag a WAV onto a pad to assign it. Cmd/Ctrl-click removes it while keeping the file on disk. Use the Explorer to browse and preview files.',
	'help.json_body':
		'Projects use the smpltrek-kit-project JSON format. Each pad keeps its file references and sound parameters for later editing.',
	'help.compile_doc_body':
		'Compilation produces a .stk file for SmplTrek firmware 3.2. Missing required files block compilation.',
	'help.sd_doc_body':
		'Hardware export contains device files only. Full export adds STK, WAV, JSON and README files for later editing.',
	'help.compatibility_body':
		'This build is tested only on Sonicware SmplTrek firmware 3.2. Other devices and firmware versions are not verified.',
	'help.diagnostic_body': 'Use this menu to open shortcuts, the About dialog, and the bundled README.',
	'menu.no_recent': 'No recent kits',
	'help.about': 'About',
	'common.close': 'Close',
	'dialog.kit_information': 'Kit Information',
	'inspect.title': 'Open Compiled Kit',
	'inspect.choose': 'Choose .STK…',
	'inspect.inspect': 'Inspect',
	'inspect.inspecting': 'Inspecting…',
	'inspect.extract': 'Extract as Editable Kit…',
	'inspect.extracting': 'Extracting…',
	'inspect.path_placeholder': '/path/to/kit.stk',
	'inspect.path_label': '.STK file path',
	'inspect.valid': '✓ Valid',
	'inspect.invalid': '✗ Invalid',
	'inspect.summary': '{bytes} bytes • {filled}/{total} pads filled • header {header} • KTDT {ktdt}',
	'inspect.errors': 'Errors ({count})',
	'inspect.warnings': 'Warnings ({count})',
	'inspect.info': 'Info',
	'inspect.pads': 'Pads',
	'inspect.col_pad': 'Pad',
	'inspect.col_path': 'Path',
	'inspect.col_vol': 'Vol',
	'inspect.col_pan': 'Pan',
	'inspect.col_pitch': 'Pitch',
	'inspect.col_fx': 'FX',
	'inspect.col_valid': 'Valid',
	'inspect.extract_ok': 'Kit extracted to {path}',
	'inspect.extract_error': 'Extraction failed: {error}',
	'about.build_time': 'Built {time}',
	'about.developed_by': 'Developed by Patrick Gaumond',
	'about.github': 'GitHub repository',
	'about.copy_diagnostics': 'Copy diagnostic information',
	'about.diagnostics_copied': 'Copied',
	'common.cancel': 'Cancel',
	'common.save_changes': 'Save changes',
	'about.title': 'STK Forge',
	'about.version': 'v{version} • Tested only with Sonicware SmplTrek firmware 3.2',
	'about.description': 'Create editable kits, compile .stk files, and inspect compiled kits locally.',
	'about.compatibility':
		'Sonicware documents SmplTrek-created STK data for ELZ_1 Play; STK Forge has not validated that workflow.',
	'about.license': 'License: MIT',
	'about.repo': 'Local-only application',
	'about.disclaimer': 'Independent project. Verify every output on the exact hardware and firmware you intend to use.',
	'about.ok': 'OK',
	'device.smpltrek_3_2': 'Sonicware SmplTrek · firmware 3.2',
	'git.title': 'Git',
	'git.status': 'Repository status',
	'git.remotes': 'Remotes',
	'git.commit': 'Commit',
	'git.pull': 'Pull',
	'git.push': 'Push',
	'git.branch': 'Branch',
	'git.init': 'Initialize',
	'git.no_repo': 'Not a Git repository',
	'export.hardware': 'Hardware profile (device files only)',
	'export.full': 'Full profile (with JSON + README)',
	'common.open_recent': 'Open recent',
	'common.clear_recent': 'Clear recent list'
};

const fr: Record<string, string> = {
	'app.title': 'STK Forge',
	'welcome.description': 'Créez des kits modifiables et compilez des fichiers .stk pour des appareils Sonicware.',
	'welcome.supported': 'Testé uniquement avec Sonicware SmplTrek, micrologiciel 3.2.',
	'welcome.elz1': 'Sonicware documente des données STK pour ELZ_1 Play, mais STK Forge ne les a pas validées.',
	'welcome.hint':
		'Glissez des WAV sur les pads • Cmd/Ctrl+clic retire un sample • Double-clic préécoute • F1 ouvre l’aide',
	'menu.new': 'Nouveau kit',
	'menu.kit': 'Kit',
	'menu.open': 'Ouvrir un kit…',
	'menu.open_compiled': 'Ouvrir un kit compilé…',
	'menu.save': 'Sauvegarder',
	'menu.save_as': 'Sauvegarder sous…',
	'menu.kit_information': 'Informations du kit…',
	'menu.find_missing': 'Rechercher les fichiers audio manquants…',
	'menu.close': 'Fermer le kit',
	'menu.quit': 'Quitter STK Forge',
	'menu.compile': 'Compiler le kit',
	'menu.compile_file': 'Compiler en .stk…',
	'menu.export': 'Exporter',
	'menu.export_sd': 'Exporter vers une carte SD…',
	'menu.export_full': 'Exporter le kit avec JSON…',
	'menu.undo': 'Annuler',
	'menu.redo': 'Rétablir',
	'menu.about': 'À propos de STK Forge',
	'menu.recent': 'Kits récents…',
	'menu.help': 'Aide',
	'menu.language': 'Langue',
	'status.saved': 'Sauvegardé',
	'status.modified': 'Modifié',
	'status.saving': 'Sauvegarde…',
	'status.compiling': 'Compilation…',
	'status.compile_ok': 'Compilation réussie',
	'status.compile_error': 'Échec de la compilation',
	'status.missing': 'Fichier audio manquant',
	'status.invalid': 'Projet non valide',
	'status.git_conflict': 'Conflit Git',
	'status.git_sync': 'Synchronisation Git…',
	'status.git_sync_ok': 'Synchronisation Git réussie',
	'status.git_error': 'Erreur Git',
	'pad.empty': 'Vide',
	'pad.assigned': 'Assigné',
	'pad.selected': 'Sélectionné',
	'pad.drag_over': 'Déposez un WAV ici',
	'pad.missing': 'Manquant',
	'pad.invalid': 'Invalide',
	'pad.disabled': 'Réservé',
	'pad.count_one': '{count} pad',
	'pad.count_other': '{count} pads',
	'kit.name': 'Nom du kit',
	'kit.pads': 'Pads',
	'kit.notes': 'Notes',
	'explorer.title': 'Fichiers audio',
	'explorer.select_dir': 'Choisir un dossier…',
	'explorer.name': 'Fichier',
	'explorer.size': 'Taille',
	'explorer.duration': 'Durée',
	'explorer.date': 'Date',
	'explorer.columns': 'Colonnes',
	'explorer.show_size': 'Afficher la taille',
	'explorer.show_duration': 'Afficher la durée',
	'explorer.show_date': 'Afficher la date',
	'explorer.resize': 'Redimensionner l’explorateur audio',
	'explorer.compatible': 'Compatible',
	'explorer.search': 'Rechercher',
	'explorer.play': 'Préécouter',
	'explorer.stop': 'Arrêter la préécoute',
	'explorer.volume': 'Volume',
	'explorer.preview_volume': 'Volume de préécoute',
	'explorer.no_preview': 'Aucun WAV en préécoute',
	'explorer.preview_error': 'Impossible de lire ce WAV',
	'explorer.missing_global': 'Rechercher les fichiers manquants',
	'explorer.sort': 'Trier',
	'explorer.sort_name': 'Nom',
	'missing.title': 'Fichiers manquants',
	'missing.relink': 'Relier',
	'btn.compile': 'Compiler le kit',
	'btn.save': 'Sauvegarder',
	'btn.save_as': 'Sauvegarder sous',
	'btn.export_sd': 'Exporter vers la carte SD (matériel)',
	'btn.export_full': 'Export complet (avec JSON)',
	'btn.open_dir': 'Ouvrir le dossier de sortie',
	'compile.title': 'Compiler en .STK',
	'compile.output': 'Fichier .STK de sortie',
	'compile.mono': 'Mono',
	'compile.stereo': 'Stéréo',
	'compile.overwrite': 'Écraser s\x27il existe',
	'compile.copy_samples': 'Copier les samples à l’export',
	'compile.blocking': 'Erreurs bloquantes',
	'compile.warnings': 'Avertissements',
	'unsaved.title': 'Modifications non sauvegardées',
	'unsaved.body': 'Des modifications n\x27ont pas été sauvegardées. Que voulez-vous faire ?',
	'unsaved.save': 'Sauvegarder',
	'unsaved.discard': 'Quitter sans sauvegarder',
	'unsaved.cancel': 'Annuler',
	'help.shortcuts': 'Raccourcis clavier',
	'help.guide': 'Guide d\x27utilisation',
	'help.json': 'Format JSON',
	'help.compile_doc': 'Compilation',
	'help.sd_doc': 'Export carte SD',
	'help.compatibility': 'Compatibilité',
	'help.diagnostic': 'Rapport de diagnostic',
	'help.guide_body':
		'Glissez un WAV sur un pad pour l’assigner. Cmd/Ctrl-clic le retire sans supprimer le fichier. Utilisez l’explorateur pour parcourir et préécouter les fichiers.',
	'help.json_body':
		'Les projets utilisent le format JSON smpltrek-kit-project. Chaque pad conserve ses références de fichiers et ses paramètres sonores pour une modification ultérieure.',
	'help.compile_doc_body':
		'La compilation produit un fichier .stk pour SmplTrek, micrologiciel 3.2. Les fichiers requis manquants bloquent la compilation.',
	'help.sd_doc_body':
		'L’export matériel contient uniquement les fichiers de l’appareil. L’export complet ajoute les fichiers STK, WAV, JSON et README pour une modification ultérieure.',
	'help.compatibility_body':
		'Cette version est testée uniquement avec Sonicware SmplTrek, micrologiciel 3.2. Les autres appareils et micrologiciels ne sont pas vérifiés.',
	'help.diagnostic_body': 'Utilisez ce menu pour ouvrir les raccourcis, À propos et le README inclus.',
	'menu.no_recent': 'Aucun kit récent',
	'help.about': 'À propos',
	'common.close': 'Fermer',
	'dialog.kit_information': 'Informations du kit',
	'inspect.title': 'Ouvrir un kit compilé',
	'inspect.choose': 'Choisir un .STK…',
	'inspect.inspect': 'Inspecter',
	'inspect.inspecting': 'Inspection…',
	'inspect.extract': 'Extraire en kit modifiable…',
	'inspect.extracting': 'Extraction…',
	'inspect.path_placeholder': '/chemin/vers/kit.stk',
	'inspect.path_label': 'Chemin du fichier .STK',
	'inspect.valid': '✓ Valide',
	'inspect.invalid': '✗ Invalide',
	'inspect.summary': '{bytes} octets • {filled}/{total} pads remplis • en-tête {header} • KTDT {ktdt}',
	'inspect.errors': 'Erreurs ({count})',
	'inspect.warnings': 'Avertissements ({count})',
	'inspect.info': 'Info',
	'inspect.pads': 'Pads',
	'inspect.col_pad': 'Pad',
	'inspect.col_path': 'Chemin',
	'inspect.col_vol': 'Vol',
	'inspect.col_pan': 'Pan',
	'inspect.col_pitch': 'Hauteur',
	'inspect.col_fx': 'FX',
	'inspect.col_valid': 'Valide',
	'inspect.extract_ok': 'Kit extrait vers {path}',
	'inspect.extract_error': 'Échec de l’extraction : {error}',
	'about.build_time': 'Compilé le {time}',
	'about.developed_by': 'Développé par Patrick Gaumond',
	'about.github': 'Dépôt GitHub',
	'about.copy_diagnostics': 'Copier les informations de diagnostic',
	'about.diagnostics_copied': 'Copié',
	'common.cancel': 'Annuler',
	'common.save_changes': 'Enregistrer les modifications',
	'about.title': 'STK Forge',
	'about.version': 'v{version} • Testé uniquement avec Sonicware SmplTrek, micrologiciel 3.2',
	'about.description':
		'Créez des kits modifiables, compilez des fichiers .stk et inspectez des kits compilés localement.',
	'about.compatibility':
		'Sonicware documente des données STK créées avec SmplTrek pour ELZ_1 Play ; STK Forge n’a pas validé ce flux.',
	'about.license': 'Licence : MIT',
	'about.repo': 'Application locale uniquement',
	'about.disclaimer': 'Projet indépendant. Vérifiez chaque sortie avec le matériel et le micrologiciel exacts prévus.',
	'about.ok': 'OK',
	'device.smpltrek_3_2': 'Sonicware SmplTrek · firmware 3.2',
	'git.title': 'Git',
	'git.status': 'État du dépôt',
	'git.remotes': 'Dépôts distants',
	'git.commit': 'Commit',
	'git.pull': 'Pull',
	'git.push': 'Push',
	'git.branch': 'Branche',
	'git.init': 'Initialiser',
	'git.no_repo': 'Dépôt Git introuvable',
	'export.hardware': 'Profil matériel (fichiers device only)',
	'export.full': 'Profil complet (avec JSON + README)',
	'common.open_recent': 'Ouvrir récent',
	'common.clear_recent': 'Vider la liste récente'
};

Object.assign(en, {
	'pad.assignments_title': 'Audio pad assignments',
	'pad.assignments_description': 'Drag audio files into this list or directly onto pads.',
	'pad.assigned_count': '{count}/15 assigned',
	'pad.ready': 'Ready for a WAV',
	'pad.drop_here': 'Drop WAV here',
	'pad.remove': 'Remove sample from Pad {pad}',
	'pad.clear_all': 'Clear all',
	'pad.mute_preview': 'Mute preview',
	'pad.unmute_preview': 'Unmute preview',
	'pad.preview_hint': 'Double-click a pad to hear its assigned sound.',
	'pad.suggestions_title': 'Default drum positions',
	'pad.hide_suggestions': 'Hide suggested drum position',
	'pad.show_suggestions': 'Show suggested drum position',
	'pad.suggestion_1': 'Main crash',
	'pad.suggestion_1_short': 'Crash 1',
	'pad.suggestion_2': 'Main open hi-hat',
	'pad.suggestion_2_short': 'OpenHat',
	'pad.suggestion_3': 'Main ride',
	'pad.suggestion_3_short': 'Ride 1',
	'pad.suggestion_4': 'High percussion',
	'pad.suggestion_4_short': 'HiPerc',
	'pad.suggestion_5': 'Mid percussion',
	'pad.suggestion_5_short': 'MidPerc',
	'pad.suggestion_6': 'Low percussion',
	'pad.suggestion_6_short': 'LowPerc',
	'pad.suggestion_7': 'Sound effect or special percussion',
	'pad.suggestion_7_short': 'FX/Perc',
	'pad.suggestion_8': 'Main kick',
	'pad.suggestion_8_short': 'Kick 1',
	'pad.suggestion_9': 'Main snare',
	'pad.suggestion_9_short': 'Snare 1',
	'pad.suggestion_10': 'Main closed hi-hat',
	'pad.suggestion_10_short': 'CloseHat',
	'pad.suggestion_11': 'Main clap',
	'pad.suggestion_11_short': 'Clap 1',
	'pad.suggestion_12': 'Main rimshot',
	'pad.suggestion_12_short': 'Rimshot',
	'pad.suggestion_13': 'Secondary kick',
	'pad.suggestion_13_short': 'Kick 2',
	'pad.suggestion_14': 'Secondary snare',
	'pad.suggestion_14_short': 'Snare 2',
	'pad.suggestion_15': 'Main shaker',
	'pad.suggestion_15_short': 'Shaker',
	'pad.parameters_title': 'Pad parameters',
	'pad.parameter_volume': 'Volume',
	'pad.parameter_pan': 'Pan',
	'pad.parameter_pitch': 'Pitch',
	'pad.parameter_fx_send': 'FX send',
	'pad.parameter_value': 'Value',
	'pad.parameter_value_for': '{parameter} value',
	'pad.parameter_drag_hint': 'Drag a knob up or down, or type a value below.',
	'pad.parameter_selected': 'Pad {pad} selected',
	'pad.parameter_pan_center': 'Center',
	'pad.parameter_pan_left': 'Left {value}',
	'pad.parameter_pan_right': 'Right {value}',
	'pad.parameter_select_audio': 'Select a pad with an assigned sample to edit its parameters.',
	'pad.parameter_invalid': 'Enter a whole number between {min} and {max}.',
	'theme.switch_to_light': 'Use light theme',
	'theme.switch_to_dark': 'Use dark theme',
	'display.scale': 'Interface scale',
	'sd_reader.title': 'SD card reader',
	'sd_reader.open': 'Read SD card',
	'sd_reader.close': 'Close',
	'sd_reader.choose_another': 'Choose another card…',
	'sd_reader.valid': 'Valid SmplTrek card',
	'sd_reader.incomplete': 'Incomplete SmplTrek folder',
	'sd_reader.invalid': 'No SmplTrek folder in the selected location',
	'sd_reader.selected_path': 'Selected location',
	'sd_reader.projects': 'Projects',
	'sd_reader.no_projects': 'No projects found',
	'sd_reader.presets': 'Presets',
	'sd_reader.preset_audio_drum': 'AUDIO/DRUM',
	'sd_reader.preset_audio_inst': 'AUDIO/INST',
	'sd_reader.preset_kit': 'KIT',
	'sd_reader.audio_files': 'Audio files',
	'sd_reader.no_audio_files': 'No audio files found',
	'sd_reader.search_audio': 'Filter audio files…',
	'sd_reader.missing_directories': 'Missing directories',
	'sd_reader.files_count': '{count} file(s)',
	'compile.overwrite_invalid': 'Overwrite the existing invalid .stk file?',
	'export.overwrite_invalid': 'Overwrite the existing invalid .stk file?',
	'toast.compiled': 'Compiled {pads} pads → {bytes} bytes',
	'toast.export_done': 'Export: {count} files — {note}',
	'toast.export_done_short': 'Export: {count} files',
	'toast.export_verified': 'Verified: .stk written — eject the SD card safely before removing it',
	'toast.export_verify_failed': 'Export verification failed: .stk not found',
	'toast.missing_auto_linked': 'Missing files auto-linked',
	'toast.missing_relinked': 'Some missing files were re-linked',
	'toast.missing_not_found': 'Some files could not be found',
	'toast.pad_relinked': 'Pad {pad} re-linked',
	'pad.replace_title': 'Replace sample?',
	'pad.replace_body': 'Pad {pad} already has custom parameters (volume {volume}, pan {pan}). Replace them?',
	'explorer.refresh': 'Refresh',
	'explorer.recent_folders': 'Recent folders…',
	'explorer.recursive': 'Recursive',
	'explorer.recursive_hint': 'Recursive scan — the backend lists the selected folder only in V1.1',
	'explorer.files_count': '{count} files',
	'explorer.no_wav_found': 'No WAV found',
	'explorer.select_folder': 'Select a folder',
	'recent.sort': 'Sort:',
	'recent.sort_opened': 'Last opened',
	'recent.sort_modified': 'Last modified',
	'recent.remove': 'Remove from list'
});

Object.assign(fr, {
	'pad.assignments_title': 'Association audio aux pads',
	'pad.assignments_description': 'Glisser les fichiers audio dans cette liste ou directement sur les pads.',
	'pad.assigned_count': '{count}/15 associés',
	'pad.ready': 'Prêt pour un WAV',
	'pad.drop_here': 'Déposer un WAV ici',
	'pad.remove': 'Retirer le son du pad {pad}',
	'pad.clear_all': 'Tout effacer',
	'pad.mute_preview': 'Mettre la préécoute en sourdine',
	'pad.unmute_preview': 'Réactiver la préécoute',
	'pad.preview_hint': 'Double-cliquer un pad pour entendre le son associé.',
	'pad.suggestions_title': 'Positions de batterie suggérées',
	'pad.hide_suggestions': 'Masquer les positions suggérées',
	'pad.show_suggestions': 'Afficher les positions suggérées',
	'pad.suggestion_1': 'Crash principal',
	'pad.suggestion_1_short': 'Crash 1',
	'pad.suggestion_2': 'Charley ouvert principal',
	'pad.suggestion_2_short': 'HH ouvert',
	'pad.suggestion_3': 'Ride principal',
	'pad.suggestion_3_short': 'Ride 1',
	'pad.suggestion_4': 'Percussion haute',
	'pad.suggestion_4_short': 'PercHaut',
	'pad.suggestion_5': 'Percussion médiane',
	'pad.suggestion_5_short': 'Perc méd',
	'pad.suggestion_6': 'Percussion basse',
	'pad.suggestion_6_short': 'Perc bas',
	'pad.suggestion_7': 'Effet sonore ou percussion spéciale',
	'pad.suggestion_7_short': 'FX/Perc',
	'pad.suggestion_8': 'Kick principal',
	'pad.suggestion_8_short': 'Kick 1',
	'pad.suggestion_9': 'Snare principale',
	'pad.suggestion_9_short': 'Snare 1',
	'pad.suggestion_10': 'Charley fermé principal',
	'pad.suggestion_10_short': 'HH fermé',
	'pad.suggestion_11': 'Clap principal',
	'pad.suggestion_11_short': 'Clap 1',
	'pad.suggestion_12': 'Rimshot principal',
	'pad.suggestion_12_short': 'Rimshot',
	'pad.suggestion_13': 'Kick secondaire',
	'pad.suggestion_13_short': 'Kick 2',
	'pad.suggestion_14': 'Snare secondaire',
	'pad.suggestion_14_short': 'Snare 2',
	'pad.suggestion_15': 'Shaker principal',
	'pad.suggestion_15_short': 'Shaker',
	'pad.parameters_title': 'Paramètres du pad',
	'pad.parameter_volume': 'Volume',
	'pad.parameter_pan': 'Panoramique',
	'pad.parameter_pitch': 'Hauteur',
	'pad.parameter_fx_send': 'Envoi FX',
	'pad.parameter_value': 'Valeur',
	'pad.parameter_value_for': 'Valeur de {parameter}',
	'pad.parameter_drag_hint': 'Glissez un potentiomètre vers le haut ou le bas, ou saisissez une valeur ci-dessous.',
	'pad.parameter_selected': 'Pad {pad} sélectionné',
	'pad.parameter_pan_center': 'Centre',
	'pad.parameter_pan_left': 'Gauche {value}',
	'pad.parameter_pan_right': 'Droite {value}',
	'pad.parameter_select_audio': 'Sélectionnez un pad avec un son associé pour modifier ses paramètres.',
	'pad.parameter_invalid': 'Saisissez un nombre entier entre {min} et {max}.',
	'theme.switch_to_light': 'Utiliser le thème clair',
	'theme.switch_to_dark': 'Utiliser le thème sombre',
	'display.scale': 'Échelle de l’interface',
	'sd_reader.title': 'Lecteur de carte SD',
	'sd_reader.open': 'Lire une carte SD',
	'sd_reader.close': 'Fermer',
	'sd_reader.choose_another': 'Choisir une autre carte…',
	'sd_reader.valid': 'Carte SmplTrek valide',
	'sd_reader.incomplete': 'Dossier SmplTrek incomplet',
	'sd_reader.invalid': 'Aucun dossier SmplTrek dans l’emplacement sélectionné',
	'sd_reader.selected_path': 'Emplacement sélectionné',
	'sd_reader.projects': 'Projets',
	'sd_reader.no_projects': 'Aucun projet trouvé',
	'sd_reader.presets': 'Préréglages',
	'sd_reader.preset_audio_drum': 'AUDIO/DRUM',
	'sd_reader.preset_audio_inst': 'AUDIO/INST',
	'sd_reader.preset_kit': 'KIT',
	'sd_reader.audio_files': 'Fichiers audio',
	'sd_reader.no_audio_files': 'Aucun fichier audio trouvé',
	'sd_reader.search_audio': 'Filtrer les fichiers audio…',
	'sd_reader.missing_directories': 'Dossiers manquants',
	'sd_reader.files_count': '{count} fichier(s)',
	'compile.overwrite_invalid': 'Écraser le fichier .stk non valide existant ?',
	'export.overwrite_invalid': 'Écraser le fichier .stk non valide existant ?',
	'toast.compiled': '{pads} pads compilés → {bytes} octets',
	'toast.export_done': 'Export : {count} fichiers — {note}',
	'toast.export_done_short': 'Export : {count} fichiers',
	'toast.export_verified': 'Vérifié : .stk écrit — éjectez la carte SD correctement avant de la retirer',
	'toast.export_verify_failed': 'Échec de la vérification de l’export : .stk introuvable',
	'toast.missing_auto_linked': 'Fichiers manquants reliés automatiquement',
	'toast.missing_relinked': 'Certains fichiers manquants ont été reliés',
	'toast.missing_not_found': 'Certains fichiers sont introuvables',
	'toast.pad_relinked': 'Pad {pad} relié',
	'pad.replace_title': 'Remplacer le son ?',
	'pad.replace_body':
		'Le pad {pad} possède déjà des paramètres personnalisés (volume {volume}, panoramique {pan}). Les remplacer ?',
	'explorer.refresh': 'Actualiser',
	'explorer.recent_folders': 'Dossiers récents…',
	'explorer.recursive': 'Récursif',
	'explorer.recursive_hint': 'Analyse récursive — en V1.1, le backend liste uniquement le dossier sélectionné',
	'explorer.files_count': '{count} fichiers',
	'explorer.no_wav_found': 'Aucun WAV trouvé',
	'explorer.select_folder': 'Sélectionnez un dossier',
	'recent.sort': 'Trier :',
	'recent.sort_opened': 'Dernière ouverture',
	'recent.sort_modified': 'Dernière modification',
	'recent.remove': 'Retirer de la liste'
});

const ja: Record<string, string> = {
	'app.title': 'STK Forge',
	'welcome.description': '編集可能なキットを作成し、Sonicware機器向けの .stk ファイルをコンパイルします。',
	'welcome.supported': 'Sonicware SmplTrek ファームウェア 3.2 でのみ動作確認済みです。',
	'welcome.elz1': 'Sonicware は ELZ_1 Play 用の STK データを公開していますが、STK Forge では未検証です。',
	'welcome.hint':
		'WAVをパッドへドラッグして割り当て • Cmd/Ctrl+クリックでサンプルを解除 • ダブルクリックで試聴 • F1でヘルプを表示',
	'menu.new': '新規キット',
	'menu.kit': 'キット',
	'menu.open': 'キットを開く…',
	'menu.open_compiled': 'コンパイル済みキットを開く…',
	'menu.save': '保存',
	'menu.save_as': '名前を付けて保存…',
	'menu.kit_information': 'キット情報…',
	'menu.find_missing': '見つからないオーディオファイルを検索…',
	'menu.close': 'キットを閉じる',
	'menu.quit': 'アプリケーションを終了',
	'menu.compile': 'キットをコンパイル',
	'menu.compile_file': '.stk にコンパイル…',
	'menu.export': '書き出し',
	'menu.export_sd': 'SDカードへ書き出し…',
	'menu.export_full': 'JSON付きでキットを書き出し…',
	'menu.undo': '元に戻す',
	'menu.redo': 'やり直す',
	'menu.about': 'STK Forge について',
	'menu.recent': '最近のキット…',
	'menu.help': 'ヘルプ',
	'menu.language': '言語',
	'menu.no_recent': '最近使用したキットはありません',
	'status.saved': '保存済み',
	'status.modified': '変更あり',
	'status.saving': '保存中…',
	'status.compiling': 'コンパイル中…',
	'status.compile_ok': 'コンパイルに成功しました',
	'status.compile_error': 'コンパイルに失敗しました',
	'status.missing': 'オーディオファイルが見つかりません',
	'status.invalid': '無効なプロジェクト',
	'status.git_conflict': 'Git競合',
	'status.git_sync': 'Git同期中…',
	'status.git_sync_ok': 'Git同期完了',
	'status.git_error': 'Gitエラー',
	'pad.empty': '空',
	'pad.assigned': '割り当て済み',
	'pad.selected': '選択中',
	'pad.drag_over': 'ここにWAVをドロップ',
	'pad.missing': '見つからない',
	'pad.invalid': '無効',
	'pad.disabled': '予約済み',
	'pad.count_one': '{count} パッド',
	'pad.count_other': '{count} パッド',
	'kit.name': 'キット名',
	'kit.pads': 'パッド',
	'kit.notes': 'メモ',
	'explorer.title': 'オーディオファイル',
	'explorer.select_dir': 'フォルダーを選択…',
	'explorer.name': 'ファイル',
	'explorer.size': 'サイズ',
	'explorer.duration': '長さ',
	'explorer.date': '日付',
	'explorer.columns': '列',
	'explorer.show_size': 'サイズを表示',
	'explorer.show_duration': '長さを表示',
	'explorer.show_date': '日付を表示',
	'explorer.resize': 'オーディオエクスプローラーのサイズ変更',
	'explorer.compatible': '互換性あり',
	'explorer.search': '検索',
	'explorer.play': '試聴',
	'explorer.stop': '試聴を停止',
	'explorer.volume': '音量',
	'explorer.preview_volume': '試聴音量',
	'explorer.no_preview': '試聴するWAVが選択されていません',
	'explorer.preview_error': 'このWAVを再生できません',
	'explorer.missing_global': '見つからないファイルを検索',
	'explorer.sort': '並べ替え',
	'explorer.sort_name': '名前順',
	'missing.title': '見つからないファイル',
	'missing.relink': '再リンク',
	'btn.compile': 'キットをコンパイル',
	'btn.save': '保存',
	'btn.save_as': '名前を付けて保存',
	'btn.export_sd': 'SDカードへ書き出し（ハードウェア用）',
	'btn.export_full': '完全書き出し（JSON付き）',
	'btn.open_dir': '出力フォルダーを開く',
	'compile.title': '.STK にコンパイル',
	'compile.output': '出力 .STK ファイル',
	'compile.mono': 'モノラル',
	'compile.stereo': 'ステレオ',
	'compile.overwrite': '既存の場合は上書き',
	'compile.copy_samples': '書き出し時にサンプルをコピー',
	'compile.blocking': '処理を妨げるエラー',
	'compile.warnings': '警告',
	'compile.overwrite_invalid': '既存の無効な .stk ファイルを上書きしますか？',
	'unsaved.title': '未保存の変更',
	'unsaved.body': '保存されていない変更があります。どうしますか？',
	'unsaved.save': '保存',
	'unsaved.discard': '保存せずに破棄',
	'unsaved.cancel': 'キャンセル',
	'help.shortcuts': 'キーボードショートカット',
	'help.guide': 'ユーザーガイド',
	'help.json': 'JSON形式',
	'help.compile_doc': 'コンパイル',
	'help.sd_doc': 'SDカードへの書き出し',
	'help.compatibility': '互換性',
	'help.diagnostic': '診断レポート',
	'help.guide_body':
		'WAVをパッドにドラッグして割り当てます。Cmd/Ctrl+クリックでディスク上のファイルを残したまま解除できます。エクスプローラーでファイルを参照・試聴できます。',
	'help.json_body':
		'プロジェクトは smpltrek-kit-project JSON 形式を使用します。各パッドのファイル参照とサウンド設定を保持するため、後から編集できます。',
	'help.compile_doc_body':
		'コンパイルにより SmplTrek ファームウェア 3.2 向けの .stk ファイルが作成されます。必要なファイルが見つからない場合、コンパイルはできません。',
	'help.sd_doc_body':
		'ハードウェア用の書き出しには機器で使うファイルだけが含まれます。完全書き出しには、後から編集できるようSTK、WAV、JSON、READMEも含まれます。',
	'help.compatibility_body':
		'このビルドは Sonicware SmplTrek ファームウェア 3.2 でのみ動作確認済みです。他の機器やファームウェアは未検証です。',
	'help.diagnostic_body': 'このメニューからショートカット、バージョン情報、同梱のREADMEを開けます。',
	'help.about': 'バージョン情報',
	'common.close': '閉じる',
	'common.cancel': 'キャンセル',
	'common.save_changes': '変更を保存',
	'common.open_recent': '最近使用した項目を開く',
	'common.clear_recent': '最近使用した項目を消去',
	'dialog.kit_information': 'キット情報',
	'inspect.title': 'コンパイル済みキットを開く',
	'inspect.choose': '.STKを選択…',
	'inspect.inspect': '検査',
	'inspect.inspecting': '検査中…',
	'inspect.extract': '編集可能なキットとして展開…',
	'inspect.extracting': '展開中…',
	'inspect.path_placeholder': '/path/to/kit.stk',
	'inspect.path_label': '.STKファイルのパス',
	'inspect.valid': '✓ 有効',
	'inspect.invalid': '✗ 無効',
	'inspect.summary': '{bytes} バイト • {filled}/{total} パッド使用中 • ヘッダー {header} • KTDT {ktdt}',
	'inspect.errors': 'エラー（{count}）',
	'inspect.warnings': '警告（{count}）',
	'inspect.info': '情報',
	'inspect.pads': 'パッド',
	'inspect.col_pad': 'パッド',
	'inspect.col_path': 'パス',
	'inspect.col_vol': '音量',
	'inspect.col_pan': 'パン',
	'inspect.col_pitch': 'ピッチ',
	'inspect.col_fx': 'FX',
	'inspect.col_valid': '有効',
	'inspect.extract_ok': 'キットを {path} に展開しました',
	'inspect.extract_error': '展開に失敗しました：{error}',
	'about.build_time': 'ビルド日時 {time}',
	'about.developed_by': '開発：Patrick Gaumond',
	'about.github': 'GitHubリポジトリ',
	'about.copy_diagnostics': '診断情報をコピー',
	'about.diagnostics_copied': 'コピーしました',
	'about.title': 'STK Forge',
	'about.version': 'v{version} • Sonicware SmplTrek ファームウェア 3.2 でのみ動作確認済み',
	'about.description':
		'編集可能なキットを作成し、.stkファイルをコンパイルして、コンパイル済みキットをローカルで検査します。',
	'about.compatibility':
		'Sonicware は SmplTrek で作成した STK データを ELZ_1 Play で使えると案内していますが、STK Forge では未検証です。',
	'about.license': 'ライセンス：MIT',
	'about.repo': 'ローカル専用アプリケーション',
	'about.disclaimer':
		'独立したプロジェクトです。使用する正確なハードウェアとファームウェアで、必ず各出力を確認してください。',
	'about.ok': 'OK',
	'device.smpltrek_3_2': 'Sonicware SmplTrek · ファームウェア 3.2',
	'git.title': 'Git',
	'git.status': 'リポジトリの状態',
	'git.remotes': 'リモート',
	'git.commit': 'コミット',
	'git.pull': 'プル',
	'git.push': 'プッシュ',
	'git.branch': 'ブランチ',
	'git.init': '初期化',
	'git.no_repo': 'Gitリポジトリではありません',
	'export.hardware': 'ハードウェアプロファイル（機器用ファイルのみ）',
	'export.full': '完全プロファイル（JSON・README付き）',
	'export.overwrite_invalid': '既存の無効な .stk ファイルを上書きしますか？',
	'pad.assignments_title': 'オーディオパッドの割り当て',
	'pad.assignments_description': 'オーディオファイルをこのリストまたはパッドへ直接ドラッグします。',
	'pad.assigned_count': '{count}/15 割り当て済み',
	'pad.ready': 'WAVを待機中',
	'pad.drop_here': 'ここにWAVをドロップ',
	'pad.remove': 'パッド {pad} からサンプルを削除',
	'pad.clear_all': 'すべて消去',
	'pad.mute_preview': '試聴をミュート',
	'pad.unmute_preview': '試聴のミュートを解除',
	'pad.preview_hint': 'パッドをダブルクリックすると割り当てたサウンドを試聴できます。',
	'pad.suggestions_title': '標準ドラム配置',
	'pad.hide_suggestions': '推奨ドラム配置を隠す',
	'pad.show_suggestions': '推奨ドラム配置を表示',
	'pad.suggestion_1': 'メインクラッシュ',
	'pad.suggestion_1_short': 'Crash 1',
	'pad.suggestion_2': 'メインオープンハイハット',
	'pad.suggestion_2_short': 'Open HH',
	'pad.suggestion_3': 'メインライド',
	'pad.suggestion_3_short': 'Ride 1',
	'pad.suggestion_4': '高音域パーカッション',
	'pad.suggestion_4_short': 'High Perc',
	'pad.suggestion_5': '中音域パーカッション',
	'pad.suggestion_5_short': 'Mid Perc',
	'pad.suggestion_6': '低音域パーカッション',
	'pad.suggestion_6_short': 'Low Perc',
	'pad.suggestion_7': '効果音または特殊パーカッション',
	'pad.suggestion_7_short': 'FX/Perc',
	'pad.suggestion_8': 'メインキック',
	'pad.suggestion_8_short': 'Kick 1',
	'pad.suggestion_9': 'メインスネア',
	'pad.suggestion_9_short': 'Snare 1',
	'pad.suggestion_10': 'メインクローズドハイハット',
	'pad.suggestion_10_short': 'Closed HH',
	'pad.suggestion_11': 'メインクラップ',
	'pad.suggestion_11_short': 'Clap 1',
	'pad.suggestion_12': 'メインリムショット',
	'pad.suggestion_12_short': 'Rimshot',
	'pad.suggestion_13': 'セカンダリーキック',
	'pad.suggestion_13_short': 'Kick 2',
	'pad.suggestion_14': 'セカンダリースネア',
	'pad.suggestion_14_short': 'Snare 2',
	'pad.suggestion_15': 'メインシェイカー',
	'pad.suggestion_15_short': 'Shaker',
	'pad.parameters_title': 'パッドパラメーター',
	'pad.parameter_volume': '音量',
	'pad.parameter_pan': 'パン',
	'pad.parameter_pitch': 'ピッチ',
	'pad.parameter_fx_send': 'FXセンド',
	'pad.parameter_value': '値',
	'pad.parameter_value_for': '{parameter}の値',
	'pad.parameter_drag_hint': 'ノブを上下にドラッグするか、下に値を入力してください。',
	'pad.parameter_selected': 'パッド {pad} を選択中',
	'pad.parameter_pan_center': '中央',
	'pad.parameter_pan_left': '左 {value}',
	'pad.parameter_pan_right': '右 {value}',
	'pad.parameter_select_audio': 'サンプルが割り当てられたパッドを選択するとパラメーターを編集できます。',
	'pad.parameter_invalid': '{min} から {max} の整数を入力してください。',
	'theme.switch_to_light': 'ライトテーマを使用',
	'theme.switch_to_dark': 'ダークテーマを使用',
	'display.scale': 'インターフェースの拡大率',
	'sd_reader.title': 'SDカードリーダー',
	'sd_reader.open': 'SDカードを読み込む',
	'sd_reader.close': '閉じる',
	'sd_reader.choose_another': '別のカードを選択…',
	'sd_reader.valid': '有効なSmplTrekカード',
	'sd_reader.incomplete': '不完全なSmplTrekフォルダー',
	'sd_reader.invalid': '選択した場所にSmplTrekフォルダーがありません',
	'sd_reader.selected_path': '選択した場所',
	'sd_reader.projects': 'プロジェクト',
	'sd_reader.no_projects': 'プロジェクトが見つかりません',
	'sd_reader.presets': 'プリセット',
	'sd_reader.preset_audio_drum': 'AUDIO/DRUM',
	'sd_reader.preset_audio_inst': 'AUDIO/INST',
	'sd_reader.preset_kit': 'KIT',
	'sd_reader.audio_files': 'オーディオファイル',
	'sd_reader.no_audio_files': 'オーディオファイルが見つかりません',
	'sd_reader.search_audio': 'オーディオファイルを絞り込み…',
	'sd_reader.missing_directories': '見つからないディレクトリ',
	'sd_reader.files_count': '{count} 件'
};

Object.assign(ja, {
	'toast.compiled': '{pads} パッドをコンパイルしました → {bytes} バイト',
	'toast.export_done': '書き出し：{count} 件のファイル — {note}',
	'toast.export_done_short': '書き出し：{count} 件のファイル',
	'toast.export_verified': '確認済み：.stk を書き出しました。取り外す前にSDカードを安全に取り出してください',
	'toast.export_verify_failed': '書き出しの確認に失敗しました：.stk が見つかりません',
	'toast.missing_auto_linked': '見つからないファイルを自動で再リンクしました',
	'toast.missing_relinked': '一部の見つからないファイルを再リンクしました',
	'toast.missing_not_found': '一部のファイルが見つかりませんでした',
	'toast.pad_relinked': 'パッド {pad} を再リンクしました',
	'pad.replace_title': 'サンプルを置き換えますか？',
	'pad.replace_body': 'パッド {pad} には既にカスタム設定（音量 {volume}、パン {pan}）があります。置き換えますか？',
	'explorer.refresh': '再読み込み',
	'explorer.recent_folders': '最近使用したフォルダー…',
	'explorer.recursive': 'サブフォルダーを含む',
	'explorer.recursive_hint': '再帰スキャン — V1.1 では選択したフォルダーのみを一覧表示します',
	'explorer.files_count': '{count} 件のファイル',
	'explorer.no_wav_found': 'WAVが見つかりません',
	'explorer.select_folder': 'フォルダーを選択してください',
	'recent.sort': '並べ替え：',
	'recent.sort_opened': '最後に開いた順',
	'recent.sort_modified': '最後に変更した順',
	'recent.remove': 'リストから削除'
});

const dict: Record<'fr' | 'en' | 'ja', Record<string, string>> = { fr, en, ja };
const available = ['fr', 'en', 'ja'] as const;
const FALLBACK = 'en' as const;

/**
 * The raw dictionaries, exposed so tests can assert key parity across locales.
 * Application code should call {@link tr} or {@link t} instead.
 */
export const dictionaries = dict;

/** A locale supported by the interface. */
export type Locale = (typeof available)[number];

/** localStorage key holding the user's explicit language choice. */
const LOCALE_STORAGE_KEY = 'stk-forge.locale';

/**
 * Reads the persisted language choice.
 *
 * The application always starts in English. The system language is deliberately
 * NOT used: a French or Japanese host would otherwise silently override the
 * documented English default. Only an explicit choice made in the language menu
 * is restored here.
 *
 * @returns The stored locale, or English when none was ever chosen.
 */
function storedLocale(): Locale {
	if (typeof localStorage === 'undefined') return FALLBACK;
	const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
	return available.includes(stored as Locale) ? (stored as Locale) : FALLBACK;
}

const localeStore = writable<Locale>(storedLocale());

// Persist locale and bump the reactive tick on every change.
localeStore.subscribe((l) => {
	if (typeof localStorage !== 'undefined') localStorage.setItem(LOCALE_STORAGE_KEY, l);
	bumpTick();
});

/**
 * Substitutes `{name}` placeholders in a translated template.
 *
 * @param template The translated string, possibly containing placeholders.
 * @param vars Values keyed by placeholder name.
 * @returns The interpolated string; an unknown placeholder is left untouched.
 */
function interpolate(template: string, vars: Record<string, unknown> | undefined): string {
	if (!vars) return template;
	return template.replace(/\{(\w+)\}/g, (_m, key) => (vars[key] === undefined ? `{${key}}` : String(vars[key])));
}

/**
 * Translates a key in the active locale, without reactivity.
 *
 * @param key The dictionary key, e.g. `menu.save`.
 * @param vars Optional placeholder values.
 * @returns The active-locale string, the English fallback, or the key itself.
 */
export function t(key: string, vars?: Record<string, unknown>): string {
	const active = get(localeStore);
	const local = dict[active]?.[key] ?? dict[FALLBACK]?.[key] ?? key;
	return interpolate(local, vars);
}

/**
 * Translates a key and re-evaluates whenever the locale changes.
 *
 * Use this in Svelte markup so the interface updates on a language switch.
 *
 * @param key The dictionary key, e.g. `menu.save`.
 * @param vars Optional placeholder values.
 * @returns The active-locale string, the English fallback, or the key itself.
 */
export function tr(key: string, vars?: Record<string, unknown>): string {
	get(tick); // touch reactive dependency
	return t(key, vars);
}

/** Reactive store holding the active locale. */
export const locale = localeStore;

/**
 * Switches the interface language and persists the choice.
 *
 * @param l The locale to activate.
 */
export function setLocale(l: Locale): void {
	localeStore.set(l);
}

/**
 * Reads the active locale.
 *
 * @returns The locale currently applied to the interface.
 */
export function getLocale(): Locale {
	return get(localeStore);
}

export { available };

// --- Locale-aware formatters (S11) ---

/**
 * Formats a number using the active locale's conventions.
 *
 * @param value The number to format.
 * @param opts Optional `Intl.NumberFormat` options.
 * @returns The localized representation.
 */
export function formatNumber(value: number, opts?: Intl.NumberFormatOptions): string {
	get(tick);
	return new Intl.NumberFormat(getLocale(), opts).format(value);
}

/**
 * Formats a duration in milliseconds as localized seconds.
 *
 * @param ms The duration in milliseconds.
 * @returns The duration with one decimal place, suffixed with `s`.
 */
export function formatDuration(ms: number): string {
	get(tick);
	const secs = ms / 1000;
	return new Intl.NumberFormat(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(secs) + 's';
}

/**
 * Formats a byte count as a localized B / KB / MB string.
 *
 * @param bytes The size in bytes.
 * @returns The localized size with its unit.
 */
export function formatFileSize(bytes: number): string {
	get(tick);
	const active = getLocale();
	if (bytes < 1024) return `${new Intl.NumberFormat(active).format(bytes)} B`;
	if (bytes < 1024 * 1024)
		return `${new Intl.NumberFormat(active, { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
	return `${new Intl.NumberFormat(active, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}

/**
 * Formats a UNIX timestamp as a localized medium-length date.
 *
 * @param tsSeconds The timestamp in seconds since the epoch.
 * @returns The localized date.
 */
export function formatDate(tsSeconds: number): string {
	get(tick);
	return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium' }).format(new Date(tsSeconds * 1000));
}
