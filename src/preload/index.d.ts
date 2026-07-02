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
  mainCharacters: string[]
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
  doctor: (folder: string, code: string) => Promise<DoctorResult>
  onEngineEvent: (cb: (e: EngineEvent) => void) => () => void
}

export interface DoctorResult {
  exitCode: number
  result: {
    resolved?: string
    slp_count?: number
    newest?: string
    code_seen_in?: number | null
    code_scanned?: number
  } | null
  error: { msg?: string; code?: string } | null
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: NoJohnsApi
  }
}
