import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileNode, GitStatus } from '@shared/types'
import { HIDDEN_FILES, PROMPT_TEMPLATE, promptPath } from '@shared/types'
import FileTree from './components/FileTree'
import Editor from './components/Editor'
import Console, { type PendingPrompt } from './components/Console'
import SettingsModal from './components/SettingsModal'
import DiffModal from './components/DiffModal'
import StatusBar from './components/StatusBar'

/** Folder that contains a file ('' = knowledge root). */
function folderOf(path: string | null): string {
  if (!path) return ''
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

export default function App(): React.JSX.Element {
  const [tree, setTree] = useState<FileNode[]>([])
  const [rootDir, setRootDir] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [contextFolder, setContextFolder] = useState('')
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [consoleHeight, setConsoleHeight] = useState(220)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [diffOpen, setDiffOpen] = useState(false)
  const [diffInitialFile, setDiffInitialFile] = useState<string | null>(null)
  const [git, setGit] = useState<GitStatus>({ enabled: false, dirty: false, files: 0 })
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null)
  const [authHasToken, setAuthHasToken] = useState(false)

  const fileFolder = folderOf(selectedPath)
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selectedPath

  const refreshGit = useCallback(() => {
    window.api.gitStatus().then(setGit)
  }, [])

  const refreshAuth = useCallback(() => {
    window.api.getAuthStatus().then((s) => setAuthHasToken(s.hasToken))
  }, [])

  // The AI console follows the edited file's folder, until manually re-scoped.
  // Opening a different file re-syncs it.
  useEffect(() => {
    setContextFolder(folderOf(selectedPath))
  }, [selectedPath])

  const refreshTree = useCallback(async () => {
    setTree(await window.api.getTree())
  }, [])

  // On any filesystem change (incl. the AI editing files), refresh the tree and
  // re-read the open file so the editor reflects external edits automatically.
  const onFsChange = useCallback(async () => {
    refreshTree()
    refreshGit()
    const path = selectedRef.current
    if (!path) return
    try {
      const content = await window.api.readFile(path)
      setFileContent((prev) => (prev === content ? prev : content))
    } catch {
      // File may have been deleted externally; the tree refresh reflects that.
    }
  }, [refreshTree, refreshGit])

  useEffect(() => {
    refreshTree()
    refreshGit()
    refreshAuth()
    window.api.getRoot().then(setRootDir)
    return window.api.onFsChanged(onFsChange)
  }, [refreshTree, refreshGit, refreshAuth, onFsChange])

  const saveContent = useCallback(() => {
    window.api.gitSave().then(setGit)
  }, [])

  const revertContent = useCallback(() => {
    if (window.confirm('Discard all content changes since the last save? This cannot be undone.')) {
      window.api.gitRevert().then(setGit)
    }
  }, [])

  // Files the console can reference with "@", relative to the current scope
  // (that's what the agent can read, since its working dir is the scope folder).
  const scopeFiles = useMemo(() => {
    const out: string[] = []
    const prefix = contextFolder ? contextFolder + '/' : ''
    const walk = (nodes: FileNode[]): void => {
      for (const n of nodes) {
        if (n.type === 'folder') walk(n.children ?? [])
        else if (!HIDDEN_FILES.has(n.name) && (n.path === contextFolder || n.path.startsWith(prefix))) {
          out.push(n.path.slice(prefix.length))
        }
      }
    }
    if (contextFolder) walk(tree)
    return out.sort()
  }, [tree, contextFolder])

  const openFile = useCallback(async (path: string) => {
    try {
      const content = await window.api.readFile(path)
      setSelectedPath(path)
      setFileContent(content)
    } catch (err) {
      console.error('Failed to open file', path, err)
    }
  }, [])

  /** Open a folder's _prompt.md in the editor, creating it from a template if absent. */
  const openPrompt = useCallback(
    async (folderPath: string) => {
      const path = promptPath(folderPath)
      await window.api.ensureFile(path, PROMPT_TEMPLATE)
      openFile(path)
    },
    [openFile]
  )

  const openDiffFile = useCallback((path: string) => {
    setDiffInitialFile(path)
    setDiffOpen(true)
  }, [])

  /** Compute a token-frugal reindex prompt and route it through the console. */
  const requestIndexUpdate = useCallback(async (folderPath: string) => {
    const text = await window.api.buildIndexPrompt(folderPath)
    setContextFolder(folderPath)
    setPendingPrompt({ folder: folderPath, text })
  }, [])

  const closeIfSelected = (path: string): void => {
    setSelectedPath((current) => {
      if (current && (current === path || current.startsWith(path + '/'))) {
        setFileContent(null)
        return null
      }
      return current
    })
  }

  const dragSidebar = (e: React.MouseEvent): void => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth
    const onMove = (ev: MouseEvent): void =>
      setSidebarWidth(Math.min(600, Math.max(160, startWidth + ev.clientX - startX)))
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const dragConsole = (e: React.MouseEvent): void => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = consoleHeight
    const onMove = (ev: MouseEvent): void =>
      setConsoleHeight(Math.min(600, Math.max(120, startHeight - (ev.clientY - startY))))
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="shell">
      <div className="app">
        <aside className="sidebar" style={{ width: sidebarWidth }}>
        <FileTree
          tree={tree}
          rootDir={rootDir}
          selectedPath={selectedPath}
          onSelectFile={openFile}
          onOpenPrompt={openPrompt}
          onUpdateIndex={requestIndexUpdate}
          onDeleted={closeIfSelected}
          onRenamed={(oldPath, newPath) => {
            if (selectedPath === oldPath) {
              setSelectedPath(newPath)
            }
          }}
        />
      </aside>
      <div className="splitter splitter-v" onMouseDown={dragSidebar} />
      <main className="main">
        <section className="editor-pane">
          {selectedPath && fileContent !== null ? (
            <Editor
              path={selectedPath}
              initialContent={fileContent}
              onOpenPrompt={openPrompt}
            />
          ) : (
            <div className="empty-state">
              <p>Select a file, or create a project to get started.</p>
            </div>
          )}
        </section>
        <div className="splitter splitter-h" onMouseDown={dragConsole} />
        <section className="console-pane" style={{ height: consoleHeight }}>
          <Console
            contextFolder={contextFolder}
            fileFolder={fileFolder}
            scopeFiles={scopeFiles}
            pendingPrompt={pendingPrompt}
            onPendingPromptHandled={() => setPendingPrompt(null)}
            authHasToken={authHasToken}
            onChangeContext={setContextFolder}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenDiffFile={openDiffFile}
          />
        </section>
        </main>
        {settingsOpen && (
          <SettingsModal
            onClose={() => {
              setSettingsOpen(false)
              refreshAuth()
            }}
          />
        )}
        {diffOpen && (
          <DiffModal
            initialFile={diffInitialFile}
            onClose={() => {
              setDiffOpen(false)
              setDiffInitialFile(null)
            }}
          />
        )}
      </div>
      <StatusBar
        status={git}
        onSave={saveContent}
        onRevert={revertContent}
        onViewDiff={() => {
          setDiffInitialFile(null)
          setDiffOpen(true)
        }}
      />
    </div>
  )
}
