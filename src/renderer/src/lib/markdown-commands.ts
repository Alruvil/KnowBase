import type { EditorView } from '@codemirror/view'

/** A markdown-editing action applied to the current CodeMirror selection. */
export type MdCommand = (view: EditorView) => void

/** Wrap the selection with `before`/`after`; with no selection, drop the caret between them. */
export function wrapInline(before: string, after = before): MdCommand {
  return (view) => {
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const insert = before + selected + after
    view.dispatch({
      changes: { from, to, insert },
      selection: selected
        ? { anchor: from + before.length, head: to + before.length }
        : { anchor: from + before.length }
    })
  }
}

/** Insert `[text](url)` around the selection, selecting `url` for quick typing. */
export const insertLink: MdCommand = (view) => {
  const { from, to } = view.state.selection.main
  const text = view.state.sliceDoc(from, to) || 'text'
  const insert = `[${text}](url)`
  const urlStart = from + text.length + 3 // after "[text]("
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: urlStart, head: urlStart + 3 }
  })
}

/** Prefix every line touched by the selection. `numbered` produces 1., 2., 3.… */
export function prefixLines(prefix: string, numbered = false): MdCommand {
  return (view) => {
    const { state } = view
    const { from, to } = state.selection.main
    const first = state.doc.lineAt(from).number
    const last = state.doc.lineAt(to).number
    const changes = []
    for (let n = first; n <= last; n++) {
      const line = state.doc.line(n)
      const p = numbered ? `${n - first + 1}. ` : prefix
      changes.push({ from: line.from, insert: p })
    }
    view.dispatch({ changes })
  }
}

/** Set the current line's heading level (1–6), or 0 to strip heading markers. */
export function setHeading(level: number): MdCommand {
  return (view) => {
    const { state } = view
    const line = state.doc.lineAt(state.selection.main.head)
    const body = line.text.replace(/^#{1,6}\s+/, '')
    const prefix = level > 0 ? `${'#'.repeat(level)} ` : ''
    const insert = prefix + body
    view.dispatch({
      changes: { from: line.from, to: line.to, insert },
      selection: { anchor: line.from + insert.length }
    })
  }
}

/** Insert a block on its own line(s) at the caret. */
export function insertBlock(text: string): MdCommand {
  return (view) => {
    const { state } = view
    const pos = state.selection.main.head
    const line = state.doc.lineAt(pos)
    const insert = (line.text.length > 0 ? '\n' : '') + text
    view.dispatch({
      changes: { from: pos, insert },
      selection: { anchor: pos + insert.length }
    })
  }
}

export const TABLE_TEMPLATE = `| Column | Column |
| ------ | ------ |
| Cell   | Cell   |
`

export const CODE_BLOCK = '```\n\n```'
