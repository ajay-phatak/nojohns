// Full 26-character Melee roster (Sheik and Zelda are separate characters;
// the dataset stores both under ZELDA_SHEIK, distinguished by filename).
//
// datasetDir: HuggingFace dataset directory for fetch --matchup DIR/TOKEN.
// token: the string that appears in dataset filenames (full display names,
// e.g. "Dr. Mario", confirmed against real listings).
export const CHARACTERS: { name: string; datasetDir: string; token: string }[] = [
  { name: 'Fox', datasetDir: 'FOX', token: 'Fox' },
  { name: 'Falco', datasetDir: 'FALCO', token: 'Falco' },
  { name: 'Marth', datasetDir: 'MARTH', token: 'Marth' },
  { name: 'Sheik', datasetDir: 'ZELDA_SHEIK', token: 'Sheik' },
  { name: 'Zelda', datasetDir: 'ZELDA_SHEIK', token: 'Zelda' },
  { name: 'Captain Falcon', datasetDir: 'CPTFALCON', token: 'Captain Falcon' },
  { name: 'Jigglypuff', datasetDir: 'JIGGLYPUFF', token: 'Jigglypuff' },
  { name: 'Peach', datasetDir: 'PEACH', token: 'Peach' },
  { name: 'Ice Climbers', datasetDir: 'ICE_CLIMBERS', token: 'Ice Climbers' },
  { name: 'Samus', datasetDir: 'SAMUS', token: 'Samus' },
  { name: 'Yoshi', datasetDir: 'YOSHI', token: 'Yoshi' },
  { name: 'Luigi', datasetDir: 'LUIGI', token: 'Luigi' },
  { name: 'Ganondorf', datasetDir: 'GANONDORF', token: 'Ganondorf' },
  { name: 'Mario', datasetDir: 'MARIO', token: 'Mario' },
  { name: 'Dr. Mario', datasetDir: 'DOC', token: 'Dr. Mario' },
  { name: 'Pikachu', datasetDir: 'PIKACHU', token: 'Pikachu' },
  { name: 'Pichu', datasetDir: 'PICHU', token: 'Pichu' },
  { name: 'Ness', datasetDir: 'NESS', token: 'Ness' },
  { name: 'Link', datasetDir: 'LINK', token: 'Link' },
  { name: 'Young Link', datasetDir: 'YLINK', token: 'Young Link' },
  { name: 'Donkey Kong', datasetDir: 'DK', token: 'Donkey Kong' },
  { name: 'Bowser', datasetDir: 'BOWSER', token: 'Bowser' },
  { name: 'Kirby', datasetDir: 'KIRBY', token: 'Kirby' },
  { name: 'Mewtwo', datasetDir: 'MEWTWO', token: 'Mewtwo' },
  { name: 'Mr. Game & Watch', datasetDir: 'GAMEANDWATCH', token: 'Game' },
  { name: 'Roy', datasetDir: 'ROY', token: 'Roy' }
]

// Normalized name used by the engine's pro_replays/<my>_vs_<opp> layout.
export const normalizeChar = (name: string): string =>
  name.toLowerCase().replace(/[.&]/g, '').replace(/\s+/g, '_')
