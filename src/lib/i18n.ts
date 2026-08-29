// i18n (spec §17). Self-contained, UTF-8, ICU-like JSON dictionaries.
// Fallback locale is English. A language can never surface a raw key: if a key
// is missing in the active locale it falls back to English, then to the key.
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
      'app.title': 'STK Editor',
       'welcome.description': 'Create editable kits and compile .stk files for Sonicware devices.',
        'welcome.supported': 'Tested only with Sonicware SmplTrek firmware 3.2.',
         'welcome.elz1': 'ELZ_1 Play STK data is documented by Sonicware, but is not verified by STK Editor.',
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
                 'menu.compile': 'Compile kit',
                  'menu.compile_file': 'Compile to .stk…',
                   'menu.export': 'Export',
                    'menu.export_sd': 'Export to SD card…',
                     'menu.export_full': 'Export kit with JSON…',
                      'menu.undo': 'Undo',
                       'menu.redo': 'Redo',
                        'menu.about': 'About STK Editor',
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
                                                               'unsaved.body':
                                              'Des modifications n\x27ont pas été sauvegardées. Que voulez-vous faire ?',
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
                                                                          'help.guide_body': 'Drag a WAV onto a pad to assign it. Cmd/Ctrl-click removes it while keeping the file on disk. Use the Explorer to browse and preview files.',
                                                                          'help.json_body': 'Projects use the smpltrek-kit-project JSON format. Each pad keeps its file references and sound parameters for later editing.',
                                                                          'help.compile_doc_body': 'Compilation produces a .stk file for SmplTrek firmware 3.2. Missing required files block compilation.',
                                                                          'help.sd_doc_body': 'Hardware export contains device files only. Full export adds STK, WAV, JSON and README files for later editing.',
                                                                          'help.compatibility_body': 'This build is tested only on Sonicware SmplTrek firmware 3.2. Other devices and firmware versions are not verified.',
                                                                          'help.diagnostic_body': 'Use this menu to open shortcuts, the About dialog, and the bundled README.',
                                                                          'menu.no_recent': 'No recent kits',
'help.about': 'About',
                                                 'common.close': 'Close',
                                                 'dialog.kit_information': 'Kit Information',
                                                 'inspect.title': 'Open Compiled Kit', 'inspect.choose': 'Choose .STK…', 'inspect.inspect': 'Inspect', 'inspect.inspecting': 'Inspecting…', 'inspect.extract': 'Extract as Editable Kit…', 'inspect.extracting': 'Extracting…', 'inspect.path_placeholder': '/path/to/kit.stk', 'inspect.path_label': '.STK file path', 'inspect.valid': '✓ Valid', 'inspect.invalid': '✗ Invalid', 'inspect.summary': '{bytes} bytes • {filled}/{total} pads filled • header {header} • KTDT {ktdt}', 'inspect.errors': 'Errors ({count})', 'inspect.warnings': 'Warnings ({count})', 'inspect.info': 'Info', 'inspect.pads': 'Pads', 'inspect.col_pad': 'Pad', 'inspect.col_path': 'Path', 'inspect.col_vol': 'Vol', 'inspect.col_pan': 'Pan', 'inspect.col_pitch': 'Pitch', 'inspect.col_fx': 'FX', 'inspect.col_valid': 'Valid', 'inspect.extract_ok': 'Kit extracted to {path}', 'inspect.extract_error': 'Extraction failed: {error}',
                                                 'about.build_time': 'Built {time}', 'about.developed_by': 'Developed by Patrick Gaumond', 'about.github': 'GitHub repository', 'about.copy_diagnostics': 'Copy diagnostic information', 'about.diagnostics_copied': 'Copied',
                                                  'common.cancel': 'Cancel',
                                                   'common.save_changes': 'Save changes',
                                                 'about.title': 'STK Editor',
                                                 'about.version': 'v{version} • Tested only with Sonicware SmplTrek firmware 3.2',
                                                 'about.description': 'Create editable kits, compile .stk files, and inspect compiled kits locally.',
                                                 'about.compatibility': 'Sonicware documents SmplTrek-created STK data for ELZ_1 Play; STK Editor has not validated that workflow.',
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
      'app.title': 'STK Editor',
        'welcome.description': 'Créez des kits modifiables et compilez des fichiers .stk pour des appareils Sonicware.',
         'welcome.supported': 'Testé uniquement avec Sonicware SmplTrek, micrologiciel 3.2.',
          'welcome.elz1': 'Sonicware documente des données STK pour ELZ_1 Play, mais STK Editor ne les a pas validées.',
           'welcome.hint': 'Glissez des WAV sur les pads • Cmd/Ctrl+clic retire un sample • Double-clic préécoute • F1 ouvre l’aide',
        'menu.new': 'Nouveau kit',
         'menu.kit': 'Kit',
          'menu.open': 'Ouvrir un kit…',
           'menu.open_compiled': 'Ouvrir un kit compilé…',
            'menu.save': 'Sauvegarder',
             'menu.save_as': 'Sauvegarder sous…',
              'menu.kit_information': 'Informations du kit…',
               'menu.find_missing': 'Rechercher les fichiers audio manquants…',
                'menu.close': 'Fermer le kit',
                 'menu.compile': 'Compiler le kit',
                  'menu.compile_file': 'Compiler en .stk…',
                   'menu.export': 'Exporter',
                    'menu.export_sd': 'Exporter vers une carte SD…',
                     'menu.export_full': 'Exporter le kit avec JSON…',
                      'menu.undo': 'Annuler',
                       'menu.redo': 'Rétablir',
                        'menu.about': 'À propos de STK Editor',
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
                                                               'unsaved.body':
                                              'Des modifications n\x27ont pas été sauvegardées. Que voulez-vous faire ?',
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
                                                                          'help.guide_body': 'Glissez un WAV sur un pad pour l’assigner. Cmd/Ctrl-clic le retire sans supprimer le fichier. Utilisez l’explorateur pour parcourir et préécouter les fichiers.',
                                                                          'help.json_body': 'Les projets utilisent le format JSON smpltrek-kit-project. Chaque pad conserve ses références de fichiers et ses paramètres sonores pour une modification ultérieure.',
                                                                          'help.compile_doc_body': 'La compilation produit un fichier .stk pour SmplTrek, micrologiciel 3.2. Les fichiers requis manquants bloquent la compilation.',
                                                                          'help.sd_doc_body': 'L’export matériel contient uniquement les fichiers de l’appareil. L’export complet ajoute les fichiers STK, WAV, JSON et README pour une modification ultérieure.',
                                                                          'help.compatibility_body': 'Cette version est testée uniquement avec Sonicware SmplTrek, micrologiciel 3.2. Les autres appareils et micrologiciels ne sont pas vérifiés.',
                                                                          'help.diagnostic_body': 'Utilisez ce menu pour ouvrir les raccourcis, À propos et le README inclus.',
                                                                          'menu.no_recent': 'Aucun kit récent',
'help.about': 'À propos',
                                                  'common.close': 'Fermer',
                                                  'dialog.kit_information': 'Informations du kit',
                                                  'inspect.title': 'Ouvrir un kit compilé', 'inspect.choose': 'Choisir un .STK…', 'inspect.inspect': 'Inspecter', 'inspect.inspecting': 'Inspection…', 'inspect.extract': 'Extraire en kit modifiable…', 'inspect.extracting': 'Extraction…', 'inspect.path_placeholder': '/chemin/vers/kit.stk', 'inspect.path_label': 'Chemin du fichier .STK', 'inspect.valid': '✓ Valide', 'inspect.invalid': '✗ Invalide', 'inspect.summary': '{bytes} octets • {filled}/{total} pads remplis • en-tête {header} • KTDT {ktdt}', 'inspect.errors': 'Erreurs ({count})', 'inspect.warnings': 'Avertissements ({count})', 'inspect.info': 'Info', 'inspect.pads': 'Pads', 'inspect.col_pad': 'Pad', 'inspect.col_path': 'Chemin', 'inspect.col_vol': 'Vol', 'inspect.col_pan': 'Pan', 'inspect.col_pitch': 'Hauteur', 'inspect.col_fx': 'FX', 'inspect.col_valid': 'Valide', 'inspect.extract_ok': 'Kit extrait vers {path}', 'inspect.extract_error': 'Échec de l’extraction : {error}',
                                                  'about.build_time': 'Compilé le {time}', 'about.developed_by': 'Développé par Patrick Gaumond', 'about.github': 'Dépôt GitHub', 'about.copy_diagnostics': 'Copier les informations de diagnostic', 'about.diagnostics_copied': 'Copié',
                                                   'common.cancel': 'Annuler',
                                                    'common.save_changes': 'Enregistrer les modifications',
                                                  'about.title': 'STK Editor',
                                                  'about.version': 'v{version} • Testé uniquement avec Sonicware SmplTrek, micrologiciel 3.2',
                                                  'about.description': 'Créez des kits modifiables, compilez des fichiers .stk et inspectez des kits compilés localement.',
                                                  'about.compatibility': 'Sonicware documente des données STK créées avec SmplTrek pour ELZ_1 Play ; STK Editor n’a pas validé ce flux.',
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
	'pad.suggestion_1': 'Main crash', 'pad.suggestion_1_short': 'Crash 1',
	'pad.suggestion_2': 'Main open hi-hat', 'pad.suggestion_2_short': 'OpenHat',
	'pad.suggestion_3': 'Main ride', 'pad.suggestion_3_short': 'Ride 1',
	'pad.suggestion_4': 'High percussion', 'pad.suggestion_4_short': 'HiPerc',
	'pad.suggestion_5': 'Mid percussion', 'pad.suggestion_5_short': 'MidPerc',
	'pad.suggestion_6': 'Low percussion', 'pad.suggestion_6_short': 'LowPerc',
	'pad.suggestion_7': 'Sound effect or special percussion', 'pad.suggestion_7_short': 'FX/Perc',
	'pad.suggestion_8': 'Main kick', 'pad.suggestion_8_short': 'Kick 1',
	'pad.suggestion_9': 'Main snare', 'pad.suggestion_9_short': 'Snare 1',
	'pad.suggestion_10': 'Main closed hi-hat', 'pad.suggestion_10_short': 'CloseHat',
	'pad.suggestion_11': 'Main clap', 'pad.suggestion_11_short': 'Clap 1',
	'pad.suggestion_12': 'Main rimshot', 'pad.suggestion_12_short': 'Rimshot',
	'pad.suggestion_13': 'Secondary kick', 'pad.suggestion_13_short': 'Kick 2',
	'pad.suggestion_14': 'Secondary snare', 'pad.suggestion_14_short': 'Snare 2',
	'pad.suggestion_15': 'Main shaker', 'pad.suggestion_15_short': 'Shaker',
	'theme.switch_to_light': 'Use light theme',
	'theme.switch_to_dark': 'Use dark theme',
	'display.scale': 'Interface scale',
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
	'pad.suggestion_1': 'Crash principal', 'pad.suggestion_1_short': 'Crash 1',
	'pad.suggestion_2': 'Charley ouvert principal', 'pad.suggestion_2_short': 'HH ouvert',
	'pad.suggestion_3': 'Ride principal', 'pad.suggestion_3_short': 'Ride 1',
	'pad.suggestion_4': 'Percussion haute', 'pad.suggestion_4_short': 'PercHaut',
	'pad.suggestion_5': 'Percussion médiane', 'pad.suggestion_5_short': 'Perc méd',
	'pad.suggestion_6': 'Percussion basse', 'pad.suggestion_6_short': 'Perc bas',
	'pad.suggestion_7': 'Effet sonore ou percussion spéciale', 'pad.suggestion_7_short': 'FX/Perc',
	'pad.suggestion_8': 'Kick principal', 'pad.suggestion_8_short': 'Kick 1',
	'pad.suggestion_9': 'Snare principale', 'pad.suggestion_9_short': 'Snare 1',
	'pad.suggestion_10': 'Charley fermé principal', 'pad.suggestion_10_short': 'HH fermé',
	'pad.suggestion_11': 'Clap principal', 'pad.suggestion_11_short': 'Clap 1',
	'pad.suggestion_12': 'Rimshot principal', 'pad.suggestion_12_short': 'Rimshot',
	'pad.suggestion_13': 'Kick secondaire', 'pad.suggestion_13_short': 'Kick 2',
	'pad.suggestion_14': 'Snare secondaire', 'pad.suggestion_14_short': 'Snare 2',
	'pad.suggestion_15': 'Shaker principal', 'pad.suggestion_15_short': 'Shaker',
	'theme.switch_to_light': 'Utiliser le thème clair',
	'theme.switch_to_dark': 'Utiliser le thème sombre',
	'display.scale': 'Échelle de l’interface',
});

const dict: Record<'fr' | 'en', Record<string, string>> = { fr, en };
const available = ['fr', 'en'] as const;
const FALLBACK = 'en' as const;

// Detect language from the system on first launch.
function systemLocale(): 'fr' | 'en' {
     if (typeof navigator !== 'undefined' && navigator.language) {
       if (navigator.language.toLowerCase().startsWith('fr'))
        return 'fr';
          return 'en';
          }
      return 'en';
}

const localeStore = writable<'fr' | 'en'>(
     (typeof localStorage !== 'undefined'
        ? (localStorage.getItem('locale') as 'fr' | 'en' | null)
          : null) ?? systemLocale()
       );

// Persist locale and bump the reactive tick on every change.
localeStore.subscribe((l) => {
     if (typeof localStorage !== 'undefined')
       localStorage.setItem('locale', l);
      bumpTick();
       });

// Simple interpolation: {name}
function interpolate(
     template: string,
     vars: Record<string, unknown> | undefined
): string {
     if (!vars)
       return template;
     return template.replace(
       /\{(\w+)\}/g,
       (_m, key) => (vars[key] === undefined ? `{${key}}` : String(vars[key]))
          );
}

export async function translate(
     key: string,
     vars?: Record<string, unknown>
): Promise<string> {
     const active = get(localeStore);
     const local = dict[active]?.[key] ?? dict[FALLBACK]?.[key] ?? key;
     return interpolate(local, vars);
}

export function t(key: string, vars?: Record<string, unknown>): string {
     const active = get(localeStore);
     const local = dict[active]?.[key] ?? dict[FALLBACK]?.[key] ?? key;
     return interpolate(local, vars);
}

// Reactive i18n — re-evaluates when the locale changes.
export function tr(key: string, vars?: Record<string, unknown>): string {
     get(tick); // touch reactive dependency
     return t(key, vars);
}

// Reactive getter for Svelte 5 components.
export function useT() {
     return (key: string, vars?: Record<string, unknown>) => tr(key, vars);
}

export function trAsync(
     key: string,
     vars?: Record<string, unknown>
): Promise<string> {
     return translate(key, vars);
}

export const locale = localeStore;
export function setLocale(l: 'fr' | 'en') {
     localeStore.set(l);
      }
export function getLocale(): 'fr' | 'en' {
     return get(localeStore);
      }
export { available };

// --- Locale-aware formatters (S11) ---

export function formatNumber(value: number, opts?: Intl.NumberFormatOptions): string {
	get(tick);
	return new Intl.NumberFormat(getLocale(), opts).format(value);
}

export function formatDuration(ms: number): string {
	get(tick);
	const secs = ms / 1000;
	return new Intl.NumberFormat(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(secs) + 's';
}

export function formatFileSize(bytes: number): string {
	get(tick);
	const locale = getLocale();
	if (bytes < 1024) return `${new Intl.NumberFormat(locale).format(bytes)} B`;
	if (bytes < 1024 * 1024) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
	return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}

export function formatDate(tsSeconds: number): string {
	get(tick);
	return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium' } as Intl.DateTimeFormatOptions).format(new Date(tsSeconds * 1000));
}

export function formatDateTime(tsSeconds: number): string {
	get(tick);
	return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' } as Intl.DateTimeFormatOptions).format(
		new Date(tsSeconds * 1000)
	);
}

export function trPlural(keyOne: string, keyOther: string, count: number, vars?: Record<string, unknown>): string {
	get(tick);
	const rules = new Intl.PluralRules(getLocale());
	const key = rules.select(count) === 'one' ? keyOne : keyOther;
	return t(key, { ...vars, count: formatNumber(count) });
}
