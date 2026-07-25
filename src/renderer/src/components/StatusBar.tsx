import type { GitStatus } from '@shared/types'

interface Props {
  status: GitStatus
  onSave: () => void
  onRevert: () => void
  onViewDiff: () => void
}

export default function StatusBar({ status, onSave, onRevert, onViewDiff }: Props): React.JSX.Element | null {
  if (!status.enabled) return null

  return (
    <div className="statusbar">
      <span className="statusbar-label">Content</span>
      <div className="statusbar-right">
        {status.dirty ? (
          <>
            <span className="sb-dirty">● {status.files} unsaved</span>
            <button className="sb-btn" title="See exactly what changed, file by file" onClick={onViewDiff}>
              View diff
            </button>
            <button className="sb-btn" title="Commit the current content as a restore point" onClick={onSave}>
              Save
            </button>
            <button
              className="sb-btn danger"
              title="Discard all content changes since the last save"
              onClick={onRevert}
            >
              Revert
            </button>
          </>
        ) : (
          <span className="sb-clean">✓ all changes saved</span>
        )}
      </div>
    </div>
  )
}
