import { ElectronAPI } from '@electron-toolkit/preload'

export interface EngineEvent {
  event: 'progress' | 'log' | 'result' | 'error'
  stage?: string
  current?: number
  total?: number
  detail?: string
  msg?: string
  [key: string]: unknown
}

export interface AnalyzeResult {
  ok: boolean
  exitCode?: number
  session?: { generated_at: string; sets: Record<string, unknown>[] }
}

export interface AppConfig {
  replayFolder: string | null
  connectCode: string | null
  mainCharacter: string | null
  matchups: string[]
  notesFolder: string | null
  onboarded: boolean
}

export interface SlippiDetection {
  replayFolder: string | null
  codeSuggestions: string[]
}

export interface NoJohnsApi {
  getConfig: () => Promise<AppConfig>
  setConfig: (patch: Partial<AppConfig>) => Promise<AppConfig>
  detectSlippi: () => Promise<SlippiDetection>
  analyze: (folder: string, code: string) => Promise<AnalyzeResult>
  onEngineEvent: (cb: (e: EngineEvent) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: NoJohnsApi
  }
}
