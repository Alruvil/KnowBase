import { contextBridge, ipcRenderer } from 'electron'
import type { FileNode, AgentEventPayload, HistoryEntry, AuthStatus, GitStatus } from '../shared/types'

const api = {
  getTree: (): Promise<FileNode[]> => ipcRenderer.invoke('fs:tree'),
  readFile: (relPath: string): Promise<string> => ipcRenderer.invoke('fs:read', relPath),
  writeFile: (relPath: string, content: string): Promise<void> =>
    ipcRenderer.invoke('fs:write', relPath, content),
  createFile: (relPath: string, content = ''): Promise<void> =>
    ipcRenderer.invoke('fs:create-file', relPath, content),
  ensureFile: (relPath: string, content = ''): Promise<void> =>
    ipcRenderer.invoke('fs:ensure-file', relPath, content),
  createFolder: (relPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:create-folder', relPath),
  rename: (oldRel: string, newRel: string): Promise<void> =>
    ipcRenderer.invoke('fs:rename', oldRel, newRel),
  delete: (relPath: string): Promise<void> => ipcRenderer.invoke('fs:delete', relPath),
  getRoot: (): Promise<string> => ipcRenderer.invoke('settings:get-root'),
  chooseRoot: (): Promise<string> => ipcRenderer.invoke('settings:choose-root'),
  onFsChanged: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('fs:changed', listener)
    return () => ipcRenderer.removeListener('fs:changed', listener)
  },

  // --- Auth & model settings ---
  getAuthStatus: (): Promise<AuthStatus> => ipcRenderer.invoke('settings:auth-status'),
  setAuth: (auth: { mode: string; token: string }): Promise<AuthStatus> =>
    ipcRenderer.invoke('settings:set-auth', auth),
  getModel: (): Promise<string> => ipcRenderer.invoke('settings:get-model'),
  setModel: (model: string): Promise<string> => ipcRenderer.invoke('settings:set-model', model),

  // --- AI agent ---
  agentSend: (requestId: string, contextFolder: string, prompt: string): Promise<void> =>
    ipcRenderer.invoke('agent:send', requestId, contextFolder, prompt),
  agentCancel: (requestId: string): Promise<void> =>
    ipcRenderer.invoke('agent:cancel', requestId),
  onAgentEvent: (callback: (payload: AgentEventPayload) => void): (() => void) => {
    const listener = (_e: unknown, payload: AgentEventPayload): void => callback(payload)
    ipcRenderer.on('agent:event', listener)
    return () => ipcRenderer.removeListener('agent:event', listener)
  },

  // --- History ---
  loadHistory: (project: string): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke('history:load', project),
  buildIndexPrompt: (folder: string): Promise<string> =>
    ipcRenderer.invoke('index:build-prompt', folder),

  // --- Clipboard ---
  copyHtml: (html: string, text: string): Promise<void> =>
    ipcRenderer.invoke('clipboard:write-html', html, text),

  // --- Content versioning ---
  gitStatus: (): Promise<GitStatus> => ipcRenderer.invoke('git:status'),
  gitSave: (): Promise<GitStatus> => ipcRenderer.invoke('git:save'),
  gitRevert: (): Promise<GitStatus> => ipcRenderer.invoke('git:revert'),

  // --- Diagnostics ---
  getLogPath: (): Promise<string> => ipcRenderer.invoke('log:path'),
  revealLog: (): Promise<void> => ipcRenderer.invoke('log:reveal')
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
