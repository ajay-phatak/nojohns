import { join } from 'path'
import { readFileSync, existsSync } from 'fs'

export interface SlippiDetection {
  replayFolder: string | null
  codeSuggestions: string[]
}

// Best-effort reads of Slippi Launcher app data. File locations vary across
// launcher versions, so every step degrades to null/[] and the UI always
// offers manual entry.
export function detectSlippi(): SlippiDetection {
  const appData = process.env['APPDATA']
  if (!appData) return { replayFolder: null, codeSuggestions: [] }
  const launcherDir = join(appData, 'Slippi Launcher')

  let replayFolder: string | null = null
  try {
    const settings = JSON.parse(readFileSync(join(launcherDir, 'Settings'), 'utf-8'))
    const root = settings?.settings?.rootSlpPath
    if (typeof root === 'string' && existsSync(root)) replayFolder = root
  } catch {
    // fall through to Documents default
  }
  if (!replayFolder) {
    const docs = join(process.env['USERPROFILE'] ?? '', 'Documents', 'Slippi')
    if (existsSync(docs)) replayFolder = docs
  }

  let codeSuggestions: string[] = []
  try {
    const raw = JSON.parse(
      readFileSync(join(launcherDir, 'netplay', 'User', 'Slippi', 'direct-codes.json'), 'utf-8')
    )
    if (Array.isArray(raw)) {
      // Entries look like { connectCode, lastPlayed, ... }; most recent first.
      codeSuggestions = raw
        .map((e) => e?.connectCode)
        .filter((c): c is string => typeof c === 'string' && c.includes('#'))
    }
  } catch {
    // no suggestions
  }

  return { replayFolder, codeSuggestions }
}
