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

export type Metrics = Record<string, number | null>

export interface SetRecord {
  session_date: string
  opp_code: string
  my_char: string
  opp_char: string
  stages: string[]
  n_games: number
  wins: number
  losses: number
  files: string[]
  metrics: Metrics
  pro_baseline: Metrics | null
  pro_games: number
  gameplan: Record<string, unknown>
}

export interface SessionData {
  generated_at: string
  sets: SetRecord[]
}

export interface NotesResult {
  ok: boolean
  reason?: string
  written?: string[]
  unchanged?: string[]
}

export interface AnalyzeSessionResult {
  ok: boolean
  reason?: string
  file?: string
  session?: SessionData
  trends?: Record<string, unknown>
  notes?: NotesResult | null
}

export interface SessionSummary {
  file: string
  generated_at: string
  sets: SetRecord[]
}

export interface AppConfig {
  replayFolder: string | null
  connectCode: string | null
  mainCharacters: string[]
  matchups: string[]
  notesFolder: string | null
  autoWriteNotes: boolean
  coachBackend: 'api' | 'claude-cli'
  coachModel: CoachModel
  onboarded: boolean
}

export type CoachModel = 'opus' | 'sonnet' | 'haiku'

export interface SlippiDetection {
  replayFolder: string | null
  codeSuggestions: string[]
}

export interface ProDirStatus {
  name: string
  count: number
  bytes: number
}

export interface FetchOpts {
  datasetDir: string
  token: string
  outDirName: string
  limit: number
}

export interface FetchResult {
  ok: boolean
  reason?: string
  result?: { found?: number; scanned?: number; out?: string } | null
}

export interface UpdateCheck {
  current: string
  latest: string | null
  newer: boolean
  url?: string
}

export interface NoJohnsApi {
  checkUpdate: () => Promise<UpdateCheck>
  proStatus: (dirNames: string[]) => Promise<ProDirStatus[]>
  fetchPros: (opts: FetchOpts) => Promise<FetchResult>
  cancelFetch: () => Promise<boolean>
  getConfig: () => Promise<AppConfig>
  setConfig: (patch: Partial<AppConfig>) => Promise<AppConfig>
  detectSlippi: () => Promise<SlippiDetection>
  analyzeSession: (opts: { sets: number }) => Promise<AnalyzeSessionResult>
  listSessions: () => Promise<SessionSummary[]>
  getTrends: () => Promise<Record<string, unknown> | null>
  doctor: (folder: string, code: string) => Promise<DoctorResult>
  writeNotes: (sessionFile?: string) => Promise<NotesResult>
  saveFocuses: (payload: {
    sessionFile?: string
    prose: string
    focuses: { gap: string; plan: string }[]
  }) => Promise<NotesResult>
  pickNotesFolder: () => Promise<string | null>
  openNote: (relPath: string) => Promise<{ ok: boolean; reason?: string }>
  setCoachKey: (key: string) => Promise<{ ok: boolean; reason?: string }>
  clearCoachKey: () => Promise<{ ok: boolean }>
  coachKeyStatus: () => Promise<CoachKeyStatus>
  coachStatus: () => Promise<CoachStatus>
  detectClaudeCli: () => Promise<CliDetection>
  coachReport: (sessionFile?: string) => Promise<CoachResult>
  coachChat: (text: string) => Promise<CoachResult>
  coachReset: () => Promise<boolean>
  coachHasConversation: () => Promise<boolean>
  onCoachDelta: (cb: (text: string) => void) => () => void
  onEngineEvent: (cb: (e: EngineEvent) => void) => () => void
}

export interface CoachKeyStatus {
  configured: boolean
  last4?: string
}

export interface CliDetection {
  found: boolean
  version?: string
}

export interface CoachStatus {
  backend: 'api' | 'claude-cli'
  model: CoachModel
  keyConfigured: boolean
  cliFound: boolean
  cliVersion?: string
  notesConfigured: boolean
  ready: boolean
}

export interface CoachGap {
  gap: string
  evidence: string
  suggestion: string
}

export interface CoachUsage {
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
  costUsd: number
  monthUsd: number
}

export interface CoachResult {
  ok: boolean
  reason?: string
  text?: string
  gaps?: CoachGap[]
  usage?: CoachUsage
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
