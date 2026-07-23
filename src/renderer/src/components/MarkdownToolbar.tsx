import { useEffect, useRef, useState } from 'react'
import {
  wrapInline,
  insertLink,
  prefixLines,
  setHeading,
  insertBlock,
  TABLE_TEMPLATE,
  CODE_BLOCK,
  type MdCommand
} from '../lib/markdown-commands'

interface Props {
  /** Runs a command against the live editor, then restores focus. */
  onRun: (cmd: MdCommand) => void
}

interface DropItem {
  label: string
  hint?: string
  cmd: MdCommand
}

function Dropdown({
  label,
  title,
  items,
  onRun
}: {
  label: string
  title: string
  items: DropItem[]
  onRun: (cmd: MdCommand) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDoc)
    return () => window.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="md-dropdown" ref={ref}>
      <button className="md-btn" title={title} onClick={() => setOpen((v) => !v)}>
        {label} <span className="md-caret">▾</span>
      </button>
      {open && (
        <div className="md-menu">
          {items.map((item) => (
            <button
              key={item.label}
              className="md-menu-item"
              onClick={() => {
                onRun(item.cmd)
                setOpen(false)
              }}
            >
              <span>{item.label}</span>
              {item.hint && <span className="md-menu-hint">{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MarkdownToolbar({ onRun }: Props): React.JSX.Element {
  const btn = (label: string, title: string, cmd: MdCommand): React.JSX.Element => (
    <button className="md-btn" title={title} onClick={() => onRun(cmd)}>
      {label}
    </button>
  )

  return (
    <div className="md-toolbar">
      <Dropdown
        label="H"
        title="Heading"
        onRun={onRun}
        items={[
          { label: 'Heading 1', hint: '#', cmd: setHeading(1) },
          { label: 'Heading 2', hint: '##', cmd: setHeading(2) },
          { label: 'Heading 3', hint: '###', cmd: setHeading(3) },
          { label: 'Normal text', hint: '', cmd: setHeading(0) }
        ]}
      />
      <span className="md-sep" />
      {btn('B', 'Bold', wrapInline('**'))}
      {btn('I', 'Italic', wrapInline('*'))}
      {btn('S', 'Strikethrough', wrapInline('~~'))}
      {btn('‹›', 'Inline code', wrapInline('`'))}
      <span className="md-sep" />
      {btn('🔗', 'Link', insertLink)}
      <Dropdown
        label="List"
        title="Lists"
        onRun={onRun}
        items={[
          { label: 'Bulleted list', hint: '-', cmd: prefixLines('- ') },
          { label: 'Numbered list', hint: '1.', cmd: prefixLines('', true) },
          { label: 'Task list', hint: '- [ ]', cmd: prefixLines('- [ ] ') }
        ]}
      />
      {btn('❝', 'Quote', prefixLines('> '))}
      <span className="md-sep" />
      {btn('{ }', 'Code block', insertBlock(CODE_BLOCK))}
      {btn('▦', 'Table', insertBlock(TABLE_TEMPLATE))}
      {btn('―', 'Divider', insertBlock('---\n'))}
    </div>
  )
}
