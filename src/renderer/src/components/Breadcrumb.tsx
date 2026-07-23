import { PROMPT_FILE } from '@shared/types'

interface Props {
  /** Root-relative path of the file being edited, e.g. "Blog/Opinion/post.md" */
  path: string
  /** Open the config (prompt) for a folder along the trail. */
  onOpenPrompt: (folderPath: string) => void
}

interface Crumb {
  name: string
  /** Accumulated root-relative path of this folder */
  path: string
}

/**
 * Renders "Blog › Opinion › post" above the editor. Each folder segment
 * carries a config cog that opens that folder's _prompt.md.
 */
export default function Breadcrumb({ path, onOpenPrompt }: Props): React.JSX.Element {
  const parts = path.split('/')
  const leaf = parts.pop() ?? path

  let acc = ''
  const folders: Crumb[] = parts.map((name) => {
    acc = acc ? `${acc}/${name}` : name
    return { name, path: acc }
  })

  const editingPrompt = leaf === PROMPT_FILE
  const leafLabel = editingPrompt ? 'config' : leaf.replace(/\.md$/, '')

  return (
    <nav className="breadcrumb">
      {folders.map((folder) => (
        <span className="crumb" key={folder.path}>
          <span className="crumb-name">{folder.name}</span>
          <button
            className="crumb-cog"
            title={`Configure "${folder.name}"`}
            onClick={() => onOpenPrompt(folder.path)}
          >
            ⚙
          </button>
          <span className="crumb-sep">›</span>
        </span>
      ))}
      <span className={`crumb leaf ${editingPrompt ? 'is-config' : ''}`}>
        {editingPrompt && <span className="crumb-cog-inline">⚙</span>}
        {leafLabel}
      </span>
    </nav>
  )
}
