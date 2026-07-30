import { useEffect, useState } from 'react'
import type { DiffFile, DiffSummary } from '@shared/types'

interface Props {
  onClose: () => void
  /** Open with this file's patch already expanded (e.g. from a console diff link). */
  initialFile?: string | null
  /** Restrict the diff to one project's folder; '' = the whole content repo. */
  project: string
}

const EMPTY: DiffSummary = { files: [], added: 0, removed: 0 }

/** Renders one `git diff` hunk with per-line +/- coloring. */
function DiffPatch({ patch }: { patch: string }): React.JSX.Element {
  const lines = patch.split('\n')
  return (
    <pre className="diff-patch">
      {lines.map((line, i) => {
        let cls = 'diff-line-ctx'
        if (line.startsWith('+++') || line.startsWith('---')) cls = 'diff-line-meta'
        else if (line.startsWith('@@')) cls = 'diff-line-hunk'
        else if (line.startsWith('+')) cls = 'diff-line-add'
        else if (line.startsWith('-')) cls = 'diff-line-del'
        else if (line.startsWith('diff --git') || line.startsWith('index ')) cls = 'diff-line-meta'
        return (
          <div key={i} className={cls}>
            {line || ' '}
          </div>
        )
      })}
    </pre>
  )
}

export default function DiffModal({ onClose, initialFile, project }: Props): React.JSX.Element {
  const [summary, setSummary] = useState<DiffSummary>(EMPTY)
  const [openFile, setOpenFile] = useState<string | null>(null)
  const [patch, setPatch] = useState('')
  const [loadingPatch, setLoadingPatch] = useState(false)

  useEffect(() => {
    window.api.gitDiff(project).then(setSummary)
  }, [project])

  const loadPatch = async (path: string): Promise<void> => {
    setOpenFile(path)
    setLoadingPatch(true)
    const text = await window.api.gitDiffFile(path)
    setPatch(text)
    setLoadingPatch(false)
  }

  useEffect(() => {
    if (initialFile) loadPatch(initialFile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile])

  const toggleFile = (file: DiffFile): void => {
    if (openFile === file.path) {
      setOpenFile(null)
      return
    }
    loadPatch(file.path)
  }

  const revertFile = async (file: DiffFile): Promise<void> => {
    if (!window.confirm(`Discard changes to "${file.path}" since the last save? This cannot be undone.`)) {
      return
    }
    const next = await window.api.gitRevertFile(file.path)
    setSummary(next)
    if (openFile === file.path) setOpenFile(null)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-diff" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Changes since last save{project && ` · ${project}`}</span>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {summary.files.length === 0 ? (
            <p className="auth-note dim">No unsaved changes.</p>
          ) : (
            <div className="diff-file-list">
              {summary.files.map((f) => (
                <div key={f.path} className="diff-file">
                  <div className="diff-file-header">
                    <button className="diff-file-row" onClick={() => toggleFile(f)}>
                      <span className="diff-file-caret">{openFile === f.path ? '▾' : '▸'}</span>
                      <span className="diff-file-path">{f.path}</span>
                      <span className="diff-file-counts">
                        {f.added > 0 && <span className="diff-line-add">+{f.added}</span>}
                        {f.removed > 0 && <span className="diff-line-del">-{f.removed}</span>}
                      </span>
                    </button>
                    <button
                      className="sb-btn danger diff-file-revert"
                      title="Discard changes to this file only"
                      onClick={() => revertFile(f)}
                    >
                      Revert file
                    </button>
                  </div>
                  {openFile === f.path && (
                    <div className="diff-patch-wrap">
                      {loadingPatch ? (
                        <p className="auth-note dim">Loading…</p>
                      ) : (
                        <DiffPatch patch={patch} />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
