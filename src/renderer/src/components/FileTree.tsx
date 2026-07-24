import { useEffect, useState } from 'react'
import type { FileNode } from '@shared/types'
import { HIDDEN_FILES, PROMPT_FILE } from '@shared/types'

interface Props {
  tree: FileNode[]
  rootDir: string
  selectedPath: string | null
  onSelectFile: (path: string) => void
  onOpenPrompt: (folderPath: string) => void
  onUpdateIndex: (folderPath: string) => void
  onDeleted: (path: string) => void
  onRenamed: (oldPath: string, newPath: string) => void
}

interface MenuState {
  x: number
  y: number
  node: FileNode | null // null = empty area (root)
}

/** Pending inline input: creating inside a folder, or renaming a node */
interface EditState {
  mode: 'create-file' | 'create-folder' | 'rename'
  /** Folder the new entry goes into ('' = root), or the path being renamed */
  target: string
  initial: string
}

function hasPrompt(node: FileNode): boolean {
  return !!node.children?.some((c) => c.name === PROMPT_FILE)
}

export default function FileTree({
  tree,
  rootDir,
  selectedPath,
  onSelectFile,
  onOpenPrompt,
  onUpdateIndex,
  onDeleted,
  onRenamed
}: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)

  useEffect(() => {
    const close = (): void => setMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const toggle = (path: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const expandTo = (path: string): void => {
    setExpanded((prev) => new Set(prev).add(path))
  }

  const startCreate = (mode: 'create-file' | 'create-folder', folder: string): void => {
    if (folder) expandTo(folder)
    setEdit({ mode, target: folder, initial: '' })
    setMenu(null)
  }

  const submitEdit = async (value: string): Promise<void> => {
    const name = value.trim()
    setEdit(null)
    if (!edit || !name) return
    try {
      if (edit.mode === 'rename') {
        const parts = edit.target.split('/')
        parts[parts.length - 1] = name
        const newPath = parts.join('/')
        if (newPath !== edit.target) {
          await window.api.rename(edit.target, newPath)
          onRenamed(edit.target, newPath)
        }
      } else if (edit.mode === 'create-folder') {
        await window.api.createFolder(edit.target ? `${edit.target}/${name}` : name)
      } else {
        const fileName = name.endsWith('.md') ? name : `${name}.md`
        const path = edit.target ? `${edit.target}/${fileName}` : fileName
        await window.api.createFile(path, `# ${name.replace(/\.md$/, '')}\n\n`)
        onSelectFile(path)
      }
    } catch (err) {
      console.error('File operation failed', err)
    }
  }

  const deleteNode = async (node: FileNode): Promise<void> => {
    setMenu(null)
    await window.api.delete(node.path)
    onDeleted(node.path)
  }

  const openContextMenu = (e: React.MouseEvent, node: FileNode | null): void => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, node })
  }

  const renderInput = (placeholder: string, initial: string): React.JSX.Element => (
    <input
      autoFocus
      defaultValue={initial}
      placeholder={placeholder}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submitEdit(e.currentTarget.value)
        if (e.key === 'Escape') setEdit(null)
      }}
      onBlur={(e) => submitEdit(e.currentTarget.value)}
    />
  )

  const renderNode = (node: FileNode, depth: number): React.JSX.Element | null => {
    if (node.type === 'file' && HIDDEN_FILES.has(node.name)) return null

    const isRenaming = edit?.mode === 'rename' && edit.target === node.path
    if (isRenaming) {
      return (
        <div key={node.path} className="tree-item tree-edit" style={{ paddingLeft: depth * 14 }}>
          <span className="chevron" />
          <span className="icon" />
          {renderInput(node.name, node.name)}
        </div>
      )
    }

    if (node.type === 'folder') {
      const isOpen = expanded.has(node.path)
      const isProject = depth === 0
      const promptSet = hasPrompt(node)
      return (
        <div key={node.path}>
          <div
            className={`tree-item folder ${isProject ? 'project' : ''}`}
            style={{ paddingLeft: depth * 14 }}
            onClick={() => toggle(node.path)}
            onContextMenu={(e) => openContextMenu(e, node)}
          >
            <span className="chevron">{isOpen ? '▾' : '▸'}</span>
            <span className="icon">{isProject ? '◈' : '▪'}</span>
            <span className="label">{node.name}</span>
            <span className="tree-actions">
              <button
                className={`tree-act cog ${promptSet ? 'active' : ''}`}
                title={promptSet ? 'Edit AI prompt' : 'Add AI prompt'}
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenPrompt(node.path)
                }}
              >
                ⚙
              </button>
              <button
                className="tree-act hover-only"
                title="Update index (_index.md)"
                onClick={(e) => {
                  e.stopPropagation()
                  onUpdateIndex(node.path)
                }}
              >
                🗂
              </button>
              <button
                className="tree-act hover-only"
                title="New file"
                onClick={(e) => {
                  e.stopPropagation()
                  startCreate('create-file', node.path)
                }}
              >
                ＋
              </button>
              <button
                className="tree-act hover-only"
                title="New folder"
                onClick={(e) => {
                  e.stopPropagation()
                  startCreate('create-folder', node.path)
                }}
              >
                ⊞
              </button>
            </span>
          </div>
          {isOpen && (
            <div>
              {edit && edit.mode !== 'rename' && edit.target === node.path && (
                <div className="tree-item tree-edit" style={{ paddingLeft: (depth + 1) * 14 }}>
                  <span className="chevron" />
                  <span className="icon" />
                  {renderInput(edit.mode === 'create-folder' ? 'folder name' : 'file name', '')}
                </div>
              )}
              {node.children?.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      )
    }

    return (
      <div
        key={node.path}
        className={`tree-item file ${selectedPath === node.path ? 'selected' : ''}`}
        style={{ paddingLeft: depth * 14 }}
        onClick={() => onSelectFile(node.path)}
        onContextMenu={(e) => openContextMenu(e, node)}
      >
        <span className="chevron" />
        <span className="icon">•</span>
        <span className="label">{node.name}</span>
      </div>
    )
  }

  return (
    <div className="file-tree" onContextMenu={(e) => openContextMenu(e, null)}>
      <div className="sidebar-header">
        <span className="sidebar-title" title={rootDir}>
          KnowBase
        </span>
        <button
          className="icon-button"
          title="New project"
          onClick={() => startCreate('create-folder', '')}
        >
          +
        </button>
        <button
          className="icon-button"
          title="Change root folder"
          onClick={() => window.api.chooseRoot()}
        >
          ⌂
        </button>
      </div>
      <div className="tree-scroll">
        {edit && edit.mode !== 'rename' && edit.target === '' && (
          <div className="tree-item tree-edit">
            <span className="chevron" />
            <span className="icon">◈</span>
            {renderInput('project name', '')}
          </div>
        )}
        {tree.map((node) => renderNode(node, 0))}
        {tree.length === 0 && !edit && (
          <div className="tree-empty">No projects yet. Click + to create one.</div>
        )}
      </div>

      {menu && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }}>
          {menu.node === null && (
            <button onClick={() => startCreate('create-folder', '')}>New project</button>
          )}
          {menu.node?.type === 'folder' && (
            <>
              <button onClick={() => startCreate('create-file', menu.node!.path)}>New file</button>
              <button onClick={() => startCreate('create-folder', menu.node!.path)}>
                New folder
              </button>
              <button
                onClick={() => {
                  setMenu(null)
                  onOpenPrompt(menu.node!.path)
                }}
              >
                Edit AI prompt
              </button>
              <button
                onClick={() => {
                  setMenu(null)
                  onUpdateIndex(menu.node!.path)
                }}
              >
                Update index
              </button>
            </>
          )}
          {menu.node && (
            <>
              <button
                onClick={() => {
                  setEdit({ mode: 'rename', target: menu.node!.path, initial: menu.node!.name })
                  setMenu(null)
                }}
              >
                Rename
              </button>
              <button className="danger" onClick={() => deleteNode(menu.node!)}>
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
