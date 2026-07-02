import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getConfig: (): Promise<unknown> => ipcRenderer.invoke('config:get'),
  setConfig: (patch: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('config:set', patch),
  detectSlippi: (): Promise<unknown> => ipcRenderer.invoke('slippi:detect'),
  analyze: (folder: string, code: string): Promise<unknown> =>
    ipcRenderer.invoke('engine:analyze', folder, code),
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
