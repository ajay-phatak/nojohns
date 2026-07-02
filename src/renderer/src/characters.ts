// Display name -> HuggingFace dataset directory. The dataset organizes
// replays by character dir; fetch --matchup DIR/OPPONENT filters filenames.
export const CHARACTERS: { name: string; datasetDir: string }[] = [
  { name: 'Fox', datasetDir: 'FOX' },
  { name: 'Falco', datasetDir: 'FALCO' },
  { name: 'Marth', datasetDir: 'MARTH' },
  { name: 'Sheik', datasetDir: 'ZELDA_SHEIK' },
  { name: 'Captain Falcon', datasetDir: 'CPTFALCON' },
  { name: 'Jigglypuff', datasetDir: 'JIGGLYPUFF' },
  { name: 'Peach', datasetDir: 'PEACH' },
  { name: 'Ice Climbers', datasetDir: 'ICE_CLIMBERS' },
  { name: 'Samus', datasetDir: 'SAMUS' },
  { name: 'Yoshi', datasetDir: 'YOSHI' },
  { name: 'Luigi', datasetDir: 'LUIGI' },
  { name: 'Ganondorf', datasetDir: 'GANONDORF' },
  { name: 'Mario', datasetDir: 'MARIO' },
  { name: 'Dr. Mario', datasetDir: 'DOC' },
  { name: 'Pikachu', datasetDir: 'PIKACHU' },
  { name: 'Link', datasetDir: 'LINK' },
  { name: 'Donkey Kong', datasetDir: 'DK' },
  { name: 'Game & Watch', datasetDir: 'GAMEANDWATCH' }
]

// Normalized name used by the engine's pro_replays/<my>_vs_<opp> layout.
export const normalizeChar = (name: string): string =>
  name.toLowerCase().replace(/[.&]/g, '').replace(/\s+/g, '_')
