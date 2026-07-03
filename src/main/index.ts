import { app, shell, dialog, BrowserWindow, ipcMain } from 'electron'
import { join, resolve, basename } from 'path'
import { readFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { EngineJob, EngineEvent } from './engine'
import { loadConfig, saveConfig, dataDir, AppConfig } from './config'
import { detectSlippi } from './slippi-detect'
import { writeSessionNotes } from './notes/write'
import type { TrendsData } from './notes/render'
import { setKey, clearKey, keyStatus } from './coach/key'
import { generateReport, chat, resetConversation, hasConversation } from './coach/client'
import {
  detectCli,
  cliGenerateReport,
  cliChat,
  resetCliConversation,
  hasCliConversation
} from './coach/cli'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Validate replay folder + code; the result NDJSON event is the payload.
  ipcMain.handle('engine:doctor', async (_e, folder: string, code: string) => {
    let result: EngineEvent | null = null
    let error: EngineEvent | null = null
    const job = new EngineJob()
    const exitCode = await job.run(
      ['doctor', folder, ...(code ? ['--code', code] : [])],
      (e: EngineEvent) => {
        if (e.event === 'result') result = e
        if (e.event === 'error') error = e
      }
    )
    return { exitCode, result, error }
  })

  // Pro replay inventory: replay count + disk usage per matchup dir.
  ipcMain.handle('proReplays:status', (_e, dirNames: string[]) => {
    const base = join(dataDir(), 'pro_replays')
    return dirNames.map((name) => {
      const dir = join(base, name)
      try {
        const slp = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.slp'))
        const bytes = slp.reduce((sum, f) => sum + statSync(join(dir, f)).size, 0)
        return { name, count: slp.length, bytes }
      } catch {
        return { name, count: 0, bytes: 0 }
      }
    })
  })

  // Fetch pro replays for one matchup. One fetch at a time; progress streams
  // over engine:event like every other job.
  let activeFetch: EngineJob | null = null
  ipcMain.handle(
    'engine:fetch',
    async (
      event,
      opts: { datasetDir: string; token: string; outDirName: string; limit: number }
    ) => {
      if (activeFetch) return { ok: false, reason: 'busy' }
      const outDir = join(dataDir(), 'pro_replays', opts.outDirName)
      let result: EngineEvent | null = null
      activeFetch = new EngineJob()
      try {
        const exitCode = await activeFetch.run(
          [
            'fetch',
            '--matchup',
            `${opts.datasetDir}/${opts.token}`,
            '--out',
            outDir,
            '--data-dir',
            dataDir(),
            '--limit',
            String(opts.limit)
          ],
          (e: EngineEvent) => {
            if (e.event === 'result') result = e
            event.sender.send('engine:event', e)
          }
        )
        if (exitCode === 0) {
          // New pros can change baselines on archived sessions — patch them
          // in place so old reports show the comparison without re-analyzing.
          const sessionsDir = join(dataDir(), 'sessions')
          let sessionFiles: string[] = []
          try {
            sessionFiles = readdirSync(sessionsDir)
              .filter((f) => f.endsWith('.json'))
              .map((f) => join(sessionsDir, f))
          } catch {
            // no sessions yet
          }
          if (sessionFiles.length > 0) {
            await new EngineJob().run(
              ['rebaseline', ...sessionFiles, '--data-dir', dataDir()],
              (e: EngineEvent) => event.sender.send('engine:event', e)
            )
          }
        }
        return { ok: exitCode === 0, result }
      } finally {
        activeFetch = null
      }
    }
  )
  ipcMain.handle('engine:cancelFetch', () => {
    activeFetch?.cancel()
    return true
  })

  // Passive update check: compare the newest published GitHub release to the
  // running version. No downloading — the banner links to the releases page.
  // Full auto-update (electron-updater) is deferred until code signing.
  ipcMain.handle('update:check', async () => {
    const current = app.getVersion()
    try {
      const res = await fetch('https://api.github.com/repos/ajay-phatak/nojohns/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' }
      })
      if (!res.ok) return { current, latest: null, newer: false }
      const rel = (await res.json()) as { tag_name?: string; html_url?: string }
      const latest = (rel.tag_name ?? '').replace(/^v/, '')
      const toParts = (v: string): number[] => v.split('.').map((n) => parseInt(n, 10) || 0)
      const [c, l] = [toParts(current), toParts(latest)]
      const newer = latest !== '' && (l[0] - c[0] || l[1] - c[1] || l[2] - c[2]) > 0
      return { current, latest, newer, url: rel.html_url }
    } catch {
      return { current, latest: null, newer: false }
    }
  })

  const readJsonOrNull = <T>(path: string): T | null => {
    try {
      return JSON.parse(readFileSync(path, 'utf-8'))
    } catch {
      return null
    }
  }

  // Newest archived session json name, or the given one normalized.
  const resolveSessionJson = (sessionFile?: string): string | null => {
    if (sessionFile) return basename(sessionFile)
    try {
      return (
        readdirSync(join(dataDir(), 'sessions'))
          .filter((f) => f.endsWith('.json'))
          .sort()
          .reverse()[0] ?? null
      )
    } catch {
      return null
    }
  }

  // Render + write the notes tier for one archived session (default: newest).
  // Shared by notes:write, notes:writeAi, and the post-analysis auto-write.
  const writeNotesFor = (
    sessionFile?: string,
    coachReport: string | null = null
  ): { ok: boolean; reason?: string; written?: string[]; unchanged?: string[] } => {
    const config = loadConfig()
    if (!config.notesFolder) return { ok: false, reason: 'no_folder' }
    const file = resolveSessionJson(sessionFile)
    if (!file) return { ok: false, reason: 'no_session' }
    const session = readJsonOrNull<Parameters<typeof writeSessionNotes>[1]>(
      join(dataDir(), 'sessions', file)
    )
    if (!session) return { ok: false, reason: 'bad_session' }
    const trends = readJsonOrNull<TrendsData>(join(dataDir(), 'trends.json'))
    try {
      return { ok: true, ...writeSessionNotes(config.notesFolder, session, trends, coachReport) }
    } catch (err) {
      return { ok: false, reason: String(err) }
    }
  }

  ipcMain.handle('notes:write', (_e, sessionFile?: string) => writeNotesFor(sessionFile))

  // AI notes: generate a coaching report through the configured backend, then
  // write the notes with the report embedded as the session note's coach
  // block. Deltas stream over coach:delta for progress display.
  ipcMain.handle('notes:writeAi', async (event, sessionFile?: string) => {
    const config = loadConfig()
    if (!config.notesFolder) return { ok: false, reason: 'no_folder' }
    const file = resolveSessionJson(sessionFile)
    if (!file) return { ok: false, reason: 'no_session' }
    let sessionTxt: string
    try {
      sessionTxt = readFileSync(
        join(dataDir(), 'sessions', file.replace(/\.json$/, '.txt')),
        'utf-8'
      )
    } catch {
      return { ok: false, reason: 'no_session' }
    }
    let trendsTxt: string | null = null
    try {
      trendsTxt = readFileSync(join(dataDir(), 'trends.txt'), 'utf-8')
    } catch {
      // no trends yet
    }
    const onDelta = (t: string): void => event.sender.send('coach:delta', t)
    const report =
      config.coachBackend === 'claude-cli'
        ? await cliGenerateReport(sessionTxt, trendsTxt, config.coachModel, onDelta)
        : await generateReport(sessionTxt, trendsTxt, config.coachModel, onDelta)
    if (!report.ok || !report.text) {
      return { ok: false, reason: report.reason ?? 'coach_failed' }
    }
    return { ...writeNotesFor(file, report.text), usage: report.usage }
  })

  ipcMain.handle('notes:pickFolder', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })

  // Open a note (path relative to the notes folder) in the OS default editor.
  ipcMain.handle('notes:open', (_e, relPath: string) => {
    const config = loadConfig()
    if (!config.notesFolder) return { ok: false, reason: 'no_folder' }
    const base = resolve(config.notesFolder)
    const full = resolve(base, relPath)
    if (!full.startsWith(base)) return { ok: false, reason: 'bad_path' }
    if (!existsSync(full)) return { ok: false, reason: 'missing' }
    shell.openPath(full)
    return { ok: true }
  })

  // Coach API key: plaintext crosses IPC only inbound (set); status returns
  // configured + last4, never the key itself.
  ipcMain.handle('coach:setKey', (_e, key: string) => setKey(key))
  ipcMain.handle('coach:clearKey', () => clearKey())
  ipcMain.handle('coach:keyStatus', () => keyStatus())
  ipcMain.handle('coach:detectCli', () => detectCli())

  // Backend readiness in one call: which backend is selected + whether it
  // can actually serve a request right now.
  ipcMain.handle('coach:status', async () => {
    const { coachBackend, coachModel } = loadConfig()
    const key = keyStatus()
    const cli = await detectCli()
    return {
      backend: coachBackend,
      model: coachModel,
      keyConfigured: key.configured,
      cliFound: cli.found,
      cliVersion: cli.version,
      ready: coachBackend === 'claude-cli' ? cli.found : key.configured
    }
  })

  // Coaching report on an archived session (default: newest). Deltas stream
  // over coach:delta; the invoke resolves with the final result + usage/cost.
  ipcMain.handle('coach:report', async (event, sessionFile?: string) => {
    const sessionsDir = join(dataDir(), 'sessions')
    let txtFile = sessionFile ? basename(sessionFile).replace(/\.json$/, '.txt') : null
    if (!txtFile) {
      try {
        txtFile =
          readdirSync(sessionsDir)
            .filter((f) => f.endsWith('.txt'))
            .sort()
            .reverse()[0] ?? null
      } catch {
        txtFile = null
      }
    }
    if (!txtFile) return { ok: false, reason: 'no_session' }
    let sessionTxt: string
    try {
      sessionTxt = readFileSync(join(sessionsDir, txtFile), 'utf-8')
    } catch {
      return { ok: false, reason: 'no_session' }
    }
    let trendsTxt: string | null = null
    try {
      trendsTxt = readFileSync(join(dataDir(), 'trends.txt'), 'utf-8')
    } catch {
      // no trends yet
    }
    const onDelta = (text: string): void => event.sender.send('coach:delta', text)
    const { coachBackend, coachModel } = loadConfig()
    return coachBackend === 'claude-cli'
      ? cliGenerateReport(sessionTxt, trendsTxt, coachModel, onDelta)
      : generateReport(sessionTxt, trendsTxt, coachModel, onDelta)
  })

  ipcMain.handle('coach:chat', (event, text: string) => {
    const onDelta = (t: string): void => event.sender.send('coach:delta', t)
    const { coachBackend, coachModel } = loadConfig()
    return coachBackend === 'claude-cli'
      ? cliChat(text, coachModel, onDelta)
      : chat(text, coachModel, onDelta)
  })

  ipcMain.handle('coach:reset', () => {
    resetConversation()
    resetCliConversation()
    return true
  })

  ipcMain.handle('coach:hasConversation', () => hasConversation() || hasCliConversation())

  ipcMain.handle('config:get', () => loadConfig())
  ipcMain.handle('config:set', (_e, patch: Partial<AppConfig>) => saveConfig(patch))
  ipcMain.handle('slippi:detect', () => detectSlippi())

  // Full analysis chain: analyze N sets -> ingest into history -> recompute
  // trends. Progress streams throughout; returns the parsed session + trends.
  ipcMain.handle('engine:analyzeSession', async (event, opts: { sets: number }) => {
    const config = loadConfig()
    if (!config.replayFolder || !config.connectCode) return { ok: false, reason: 'not_configured' }

    const sessionsDir = join(dataDir(), 'sessions')
    mkdirSync(sessionsDir, { recursive: true })
    const stamp = Date.now()
    const jsonPath = join(sessionsDir, `session-${stamp}.json`)
    const historyPath = join(dataDir(), 'history.json')
    const trendsJson = join(dataDir(), 'trends.json')
    const forward = (e: EngineEvent): void => event.sender.send('engine:event', e)

    const analyze = await new EngineJob().run(
      [
        'analyze',
        config.replayFolder,
        '--code',
        config.connectCode,
        '--sets',
        String(opts.sets),
        '--singles-only',
        '--pool-matchups',
        '--json',
        jsonPath,
        '--out',
        join(sessionsDir, `session-${stamp}.txt`),
        '--data-dir',
        dataDir()
      ],
      forward
    )
    if (analyze !== 0) return { ok: false, reason: 'analyze_failed' }

    const ingest = await new EngineJob().run(
      ['ingest', jsonPath, '--history', historyPath],
      forward
    )
    if (ingest !== 0) return { ok: false, reason: 'ingest_failed' }

    const trends = await new EngineJob().run(
      [
        'trends',
        '--history',
        historyPath,
        '--out',
        join(dataDir(), 'trends.txt'),
        '--json',
        trendsJson
      ],
      forward
    )
    if (trends !== 0) return { ok: false, reason: 'trends_failed' }

    // Notes are a side output — never fail the analysis over them.
    const sessionFile = `session-${stamp}.json`
    const notes = config.notesFolder && config.autoWriteNotes ? writeNotesFor(sessionFile) : null

    return {
      ok: true,
      file: sessionFile,
      session: JSON.parse(readFileSync(jsonPath, 'utf-8')),
      trends: JSON.parse(readFileSync(trendsJson, 'utf-8')),
      notes
    }
  })

  // Archived sessions, newest first.
  ipcMain.handle('sessions:list', () => {
    const sessionsDir = join(dataDir(), 'sessions')
    try {
      return readdirSync(sessionsDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 20)
        .map((f) => {
          try {
            const s = JSON.parse(readFileSync(join(sessionsDir, f), 'utf-8'))
            return { file: f, generated_at: s.generated_at, sets: s.sets }
          } catch {
            return null
          }
        })
        .filter((s) => s !== null)
    } catch {
      return []
    }
  })

  ipcMain.handle('trends:get', () => {
    try {
      return JSON.parse(readFileSync(join(dataDir(), 'trends.json'), 'utf-8'))
    } catch {
      return null
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
