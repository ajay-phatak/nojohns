import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync, mkdirSync, readdirSync, statSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { EngineJob, EngineEvent } from './engine'
import { loadConfig, saveConfig, dataDir, AppConfig } from './config'
import { detectSlippi } from './slippi-detect'

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
    async (event, opts: { datasetDir: string; token: string; outDirName: string; limit: number }) => {
      if (activeFetch) return { ok: false, reason: 'busy' }
      const outDir = join(dataDir(), 'pro_replays', opts.outDirName)
      let result: EngineEvent | null = null
      activeFetch = new EngineJob()
      try {
        const exitCode = await activeFetch.run(
          ['fetch', '--matchup', `${opts.datasetDir}/${opts.token}`, '--out', outDir,
           '--data-dir', dataDir(), '--limit', String(opts.limit)],
          (e: EngineEvent) => {
            if (e.event === 'result') result = e
            event.sender.send('engine:event', e)
          }
        )
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

  ipcMain.handle('config:get', () => loadConfig())
  ipcMain.handle('config:set', (_e, patch: Partial<AppConfig>) => saveConfig(patch))
  ipcMain.handle('slippi:detect', () => detectSlippi())

  // Walking skeleton: run `analyze` on a folder + connect code, stream
  // progress events to the renderer, return the parsed session JSON.
  ipcMain.handle('engine:analyze', async (event, folder: string, code: string) => {
    const sessionsDir = join(dataDir(), 'sessions')
    mkdirSync(sessionsDir, { recursive: true })
    const jsonPath = join(sessionsDir, `session-${Date.now()}.json`)

    const job = new EngineJob()
    const exitCode = await job.run(
      ['analyze', folder, '--code', code, '--sets', '2', '--singles-only',
       '--pool-matchups', '--json', jsonPath, '--out', jsonPath.replace(/\.json$/, '.txt'),
       '--data-dir', dataDir()],
      (e: EngineEvent) => event.sender.send('engine:event', e)
    )
    if (exitCode !== 0) return { ok: false, exitCode }
    return { ok: true, session: JSON.parse(readFileSync(jsonPath, 'utf-8')) }
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
