// Full 26-character Melee roster in rough tier/popularity order (Sheik and
// Zelda are separate characters; the dataset stores both under ZELDA_SHEIK,
// distinguished by filename).
//
// datasetDir: HuggingFace dataset directory for fetch --matchup DIR/TOKEN.
// token: the string that appears in dataset filenames (full display names,
// e.g. "Dr. Mario", confirmed against real listings).
export const CHARACTERS: { name: string; datasetDir: string; token: string }[] = [
  { name: 'Fox', datasetDir: 'FOX', token: 'Fox' },
  { name: 'Marth', datasetDir: 'MARTH', token: 'Marth' },
  { name: 'Jigglypuff', datasetDir: 'JIGGLYPUFF', token: 'Jigglypuff' },
  { name: 'Falco', datasetDir: 'FALCO', token: 'Falco' },
  { name: 'Sheik', datasetDir: 'ZELDA_SHEIK', token: 'Sheik' },
  { name: 'Captain Falcon', datasetDir: 'CPTFALCON', token: 'Captain Falcon' },
  { name: 'Peach', datasetDir: 'PEACH', token: 'Peach' },
  { name: 'Ice Climbers', datasetDir: 'ICE_CLIMBERS', token: 'Ice Climbers' },
  { name: 'Dr. Mario', datasetDir: 'DOC', token: 'Dr. Mario' },
  { name: 'Donkey Kong', datasetDir: 'DK', token: 'Donkey Kong' },
  { name: 'Pikachu', datasetDir: 'PIKACHU', token: 'Pikachu' },
  { name: 'Yoshi', datasetDir: 'YOSHI', token: 'Yoshi' },
  { name: 'Samus', datasetDir: 'SAMUS', token: 'Samus' },
  { name: 'Luigi', datasetDir: 'LUIGI', token: 'Luigi' },
  { name: 'Ganondorf', datasetDir: 'GANONDORF', token: 'Ganondorf' },
  { name: 'Mewtwo', datasetDir: 'MEWTWO', token: 'Mewtwo' },
  { name: 'Mr. Game & Watch', datasetDir: 'GAMEANDWATCH', token: 'Game' },
  { name: 'Link', datasetDir: 'LINK', token: 'Link' },
  { name: 'Mario', datasetDir: 'MARIO', token: 'Mario' },
  { name: 'Roy', datasetDir: 'ROY', token: 'Roy' },
  { name: 'Young Link', datasetDir: 'YLINK', token: 'Young Link' },
  { name: 'Pichu', datasetDir: 'PICHU', token: 'Pichu' },
  { name: 'Kirby', datasetDir: 'KIRBY', token: 'Kirby' },
  { name: 'Ness', datasetDir: 'NESS', token: 'Ness' },
  { name: 'Zelda', datasetDir: 'ZELDA_SHEIK', token: 'Zelda' },
  { name: 'Bowser', datasetDir: 'BOWSER', token: 'Bowser' }
]

// Normalized name used by the engine's pro_replays/<my>_vs_<opp> layout.
export const normalizeChar = (name: string): string =>
  name.toLowerCase().replace(/[.&]/g, '').replace(/\s+/g, '_')
