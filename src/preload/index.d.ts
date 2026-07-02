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

export interface NoJohnsApi {
  analyze: (folder: string, code: string) => Promise<AnalyzeResult>
  onEngineEvent: (cb: (e: EngineEvent) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: NoJohnsApi
  }
}
