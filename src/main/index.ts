import { app, BrowserWindow, ipcMain, shell, dialog, Menu, clipboard } from 'electron'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { watch, type FSWatcher } from 'chokidar'

const __dirname = dirname(fileURLToPath(import.meta.url))
import * as fsService from './fs-service'
import {
  ensureRootDir,
  setRootDir,
  authStatus,
  setAuth,
  getModel,
  setModel,
  type AuthConfig
} from './settings'
import { runAgent } from './agent-service'
import { loadHistory, appendHistory, type HistoryEntry } from './history-service'
import { initLogger, logPath, log } from './logger'
import * as gitService from './git-service'
import { buildIndexUpdatePrompt } from './index-service'

let mainWindow: BrowserWindow | null = null
let watcher: FSWatcher | null = null
let rootDir = ''

/** In-flight agent turns, keyed by renderer-supplied request id. */
const agentRuns = new Map<string, AbortController>()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    title: 'KnowBase',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open external links in the system browser, not inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function startWatcher(): void {
  watcher?.close()
  let timer: NodeJS.Timeout | null = null
  watcher = watch(rootDir, {
    ignored: (path) => path.includes('/.'),
    ignoreInitial: true,
    depth: 20
  })
  watcher.on('all', () => {
    // Debounce bursts of events (e.g. a folder move) into one refresh
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      mainWindow?.webContents.send('fs:changed')
    }, 200)
  })
}

function registerIpc(): void {
  ipcMain.handle('fs:tree', () => fsService.buildTree(rootDir))
  ipcMain.handle('fs:read', (_e, relPath: string) => fsService.readFile(rootDir, relPath))
  ipcMain.handle('fs:read-binary', (_e, relPath: string) => fsService.readBinary(rootDir, relPath))
  ipcMain.handle('fs:write', (_e, relPath: string, content: string) =>
    fsService.writeFile(rootDir, relPath, content)
  )
  ipcMain.handle('fs:create-file', (_e, relPath: string, content: string) =>
    fsService.createFile(rootDir, relPath, content)
  )
  ipcMain.handle('fs:ensure-file', (_e, relPath: string, content: string) =>
    fsService.ensureFile(rootDir, relPath, content)
  )
  ipcMain.handle('fs:create-folder', (_e, relPath: string) =>
    fsService.createFolder(rootDir, relPath)
  )
  ipcMain.handle('fs:rename', (_e, oldRel: string, newRel: string) =>
    fsService.rename(rootDir, oldRel, newRel)
  )
  ipcMain.handle('fs:delete', (_e, relPath: string) =>
    shell.trashItem(fsService.safePath(rootDir, relPath))
  )
  ipcMain.handle('settings:get-root', () => rootDir)
  ipcMain.handle('settings:choose-root', async () => {
    if (!mainWindow) return rootDir
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose knowledge root folder',
      defaultPath: rootDir,
      properties: ['openDirectory', 'createDirectory']
    })
    if (!result.canceled && result.filePaths[0]) {
      setRootDir(result.filePaths[0])
      rootDir = ensureRootDir()
      gitService.ensureRepo(rootDir).catch(() => {})
      startWatcher()
      mainWindow.webContents.send('fs:changed')
    }
    return rootDir
  })

  ipcMain.handle('settings:auth-status', () => authStatus())
  ipcMain.handle('settings:set-auth', (_e, auth: AuthConfig) => {
    setAuth(auth)
    return authStatus()
  })
  ipcMain.handle('settings:get-model', () => getModel())
  ipcMain.handle('settings:set-model', (_e, model: string) => {
    setModel(model)
    return getModel()
  })

  ipcMain.handle('history:load', (_e, project: string) => loadHistory(rootDir, project))
  ipcMain.handle('index:build-prompt', (_e, folder: string) => buildIndexUpdatePrompt(rootDir, folder))

  // Streaming agent turn. Events are pushed to the renderer as `agent:event`.
  ipcMain.handle(
    'agent:send',
    async (_e, requestId: string, contextFolder: string, prompt: string) => {
      log('ipc', 'agent:send', { requestId, contextFolder, promptChars: prompt.length })
      const controller = new AbortController()
      agentRuns.set(requestId, controller)
      const send = (payload: object): void =>
        mainWindow?.webContents.send('agent:event', { requestId, ...payload })

      // Snapshot content before the call so the AI's changes can be reviewed/reverted.
      await gitService.checkpointBeforeCall(rootDir, prompt).catch(() => {})

      let assistantText = ''
      try {
        await runAgent({
          root: rootDir,
          contextFolder,
          prompt,
          requestId,
          signal: controller.signal,
          emit: (event) => {
            if (event.type === 'text') assistantText += event.text
            send(event)
          }
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        log('ipc', 'agent:send failed', { requestId, error: message })
        send({ type: 'error', message })
      }

      // Summarize what the AI changed on disk (files + line counts).
      const diff = await gitService.diffSinceHead(rootDir).catch(() => null)
      if (diff && diff.files.length) send({ type: 'diff', diff })

      // Persist the turn to the project's history (records the scope it came from).
      const now = Date.now()
      const entries: HistoryEntry[] = [{ ts: now, scope: contextFolder, role: 'user', text: prompt }]
      if (assistantText.trim()) {
        entries.push({ ts: Date.now(), scope: contextFolder, role: 'assistant', text: assistantText })
      }
      await appendHistory(rootDir, contextFolder, entries).catch(() => {})
      agentRuns.delete(requestId)
    }
  )
  ipcMain.handle('agent:cancel', (_e, requestId: string) => {
    agentRuns.get(requestId)?.abort()
    agentRuns.delete(requestId)
  })

  // Writes both HTML and a plain-text fallback so the target app (e.g. WordPress's
  // rich-text editor) picks up formatting, while plain-text paste targets still work.
  ipcMain.handle('clipboard:write-html', (_e, html: string, text: string) => {
    clipboard.write({ html, text })
  })

  ipcMain.handle('log:path', () => logPath())
  ipcMain.handle('log:reveal', () => shell.showItemInFolder(logPath()))

  // --- Content versioning (git on the knowledge root) ---
  ipcMain.handle('git:status', () => gitService.status(rootDir))
  ipcMain.handle('git:save', async () => {
    await gitService.commitAll(rootDir, `Manual save ${new Date().toISOString()}`)
    return gitService.status(rootDir)
  })
  ipcMain.handle('git:revert', async () => {
    await gitService.revert(rootDir)
    mainWindow?.webContents.send('fs:changed') // refresh tree + open file
    return gitService.status(rootDir)
  })
  ipcMain.handle('git:diff', () => gitService.diffSinceHead(rootDir))
  ipcMain.handle('git:diff-file', (_e, path: string) => gitService.diffPatch(rootDir, path))
  ipcMain.handle('git:revert-file', async (_e, path: string) => {
    await gitService.revertFile(rootDir, path)
    mainWindow?.webContents.send('fs:changed') // refresh tree + open file
    return gitService.diffSinceHead(rootDir)
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null) // no File/Edit/View/Window menu — it adds nothing here
  initLogger()
  rootDir = ensureRootDir()
  log('app', 'ready', { rootDir })
  gitService.ensureRepo(rootDir).catch(() => {})
  registerIpc()
  createWindow()
  startWatcher()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  watcher?.close()
  if (process.platform !== 'darwin') app.quit()
})
