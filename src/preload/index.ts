import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  checkUpdate: (): Promise<unknown> => ipcRenderer.invoke('update:check'),
  getConfig: (): Promise<unknown> => ipcRenderer.invoke('config:get'),
  setConfig: (patch: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('config:set', patch),
  detectSlippi: (): Promise<unknown> => ipcRenderer.invoke('slippi:detect'),
  analyzeSession: (opts: { sets: number }): Promise<unknown> =>
    ipcRenderer.invoke('engine:analyzeSession', opts),
  listSessions: (): Promise<unknown> => ipcRenderer.invoke('sessions:list'),
  getTrends: (): Promise<unknown> => ipcRenderer.invoke('trends:get'),
  doctor: (folder: string, code: string): Promise<unknown> =>
    ipcRenderer.invoke('engine:doctor', folder, code),
  proStatus: (dirNames: string[]): Promise<unknown> =>
    ipcRenderer.invoke('proReplays:status', dirNames),
  fetchPros: (opts: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('engine:fetch', opts),
  cancelFetch: (): Promise<unknown> => ipcRenderer.invoke('engine:cancelFetch'),
  writeNotes: (sessionFile?: string): Promise<unknown> =>
    ipcRenderer.invoke('notes:write', sessionFile),
  pickNotesFolder: (): Promise<unknown> => ipcRenderer.invoke('notes:pickFolder'),
  openNote: (relPath: string): Promise<unknown> => ipcRenderer.invoke('notes:open', relPath),
  onEngineEvent: (cb: (e: Record<string, unknown>) => void): (() => void) => {
    const listener = (_: unknown, e: Record<string, unknown>): void => cb(e)
    ipcRenderer.on('engine:event', listener)
    return () => ipcRenderer.removeListener('engine:event', listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
