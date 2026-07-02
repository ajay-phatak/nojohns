// Full 26-character Melee roster in rough tier/popularity order (Sheik and
// Zelda are separate characters; the dataset stores both under ZELDA_SHEIK,
// distinguished by filename).
//
// datasetDir: HuggingFace dataset directory for fetch --matchup DIR/TOKEN.
// token: the string that appears in dataset filenames (full display names,
// e.g. "Dr. Mario", confirmed against real listings).
// engineName: py-slippi character-enum name lowercased — must match the
// engine's pro_replays/<my>_vs_<opp> dir naming exactly (e.g. game_and_watch).
export interface CharacterInfo {
  name: string
  datasetDir: string
  token: string
  engineName: string
}

export const CHARACTERS: CharacterInfo[] = [
  { name: 'Fox', datasetDir: 'FOX', token: 'Fox', engineName: 'fox' },
  { name: 'Marth', datasetDir: 'MARTH', token: 'Marth', engineName: 'marth' },
  { name: 'Jigglypuff', datasetDir: 'JIGGLYPUFF', token: 'Jigglypuff', engineName: 'jigglypuff' },
  { name: 'Falco', datasetDir: 'FALCO', token: 'Falco', engineName: 'falco' },
  { name: 'Sheik', datasetDir: 'ZELDA_SHEIK', token: 'Sheik', engineName: 'sheik' },
  { name: 'Captain Falcon', datasetDir: 'CPTFALCON', token: 'Captain Falcon', engineName: 'captain_falcon' },
  { name: 'Peach', datasetDir: 'PEACH', token: 'Peach', engineName: 'peach' },
  { name: 'Ice Climbers', datasetDir: 'ICE_CLIMBERS', token: 'Ice Climbers', engineName: 'ice_climbers' },
  { name: 'Dr. Mario', datasetDir: 'DOC', token: 'Dr. Mario', engineName: 'dr_mario' },
  { name: 'Donkey Kong', datasetDir: 'DK', token: 'Donkey Kong', engineName: 'donkey_kong' },
  { name: 'Pikachu', datasetDir: 'PIKACHU', token: 'Pikachu', engineName: 'pikachu' },
  { name: 'Yoshi', datasetDir: 'YOSHI', token: 'Yoshi', engineName: 'yoshi' },
  { name: 'Samus', datasetDir: 'SAMUS', token: 'Samus', engineName: 'samus' },
  { name: 'Luigi', datasetDir: 'LUIGI', token: 'Luigi', engineName: 'luigi' },
  { name: 'Ganondorf', datasetDir: 'GANONDORF', token: 'Ganondorf', engineName: 'ganondorf' },
  { name: 'Mewtwo', datasetDir: 'MEWTWO', token: 'Mewtwo', engineName: 'mewtwo' },
  { name: 'Mr. Game & Watch', datasetDir: 'GAMEANDWATCH', token: 'Game', engineName: 'game_and_watch' },
  { name: 'Link', datasetDir: 'LINK', token: 'Link', engineName: 'link' },
  { name: 'Mario', datasetDir: 'MARIO', token: 'Mario', engineName: 'mario' },
  { name: 'Roy', datasetDir: 'ROY', token: 'Roy', engineName: 'roy' },
  { name: 'Young Link', datasetDir: 'YLINK', token: 'Young Link', engineName: 'young_link' },
  { name: 'Pichu', datasetDir: 'PICHU', token: 'Pichu', engineName: 'pichu' },
  { name: 'Kirby', datasetDir: 'KIRBY', token: 'Kirby', engineName: 'kirby' },
  { name: 'Ness', datasetDir: 'NESS', token: 'Ness', engineName: 'ness' },
  { name: 'Zelda', datasetDir: 'ZELDA_SHEIK', token: 'Zelda', engineName: 'zelda' },
  { name: 'Bowser', datasetDir: 'BOWSER', token: 'Bowser', engineName: 'bowser' }
]

export const charByName = (name: string): CharacterInfo | undefined =>
  CHARACTERS.find((c) => c.name === name)
