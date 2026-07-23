import { useEffect, useRef, useState } from 'react'
import type { AgentEventPayload } from '@shared/types'
import { detectMention } from '../lib/mention'

interface Props {
  /** Folder the AI runs under ('' = whole knowledge base / root) */
  contextFolder: string
  /** Folder of the file currently open in the editor ('' = root/none) */
  fileFolder: string
  /** Files under the current scope, relative to it — offered for "@" references. */
  scopeFiles: string[]
  onChangeContext: (folder: string) => void
  onOpenSettings: () => void
}

interface Msg {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'error' | 'system' | 'meta' | 'diff'
  text: string
}

interface Crumb {
  label: string
  path: string
}

const uid = (): string => crypto.randomUUID()
const MAX_MENTIONS = 8

function crumbsFor(folder: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'KnowBase', path: '' }]
  if (folder) {
    let acc = ''
    for (const name of folder.split('/')) {
      acc = acc ? `${acc}/${name}` : name
      crumbs.push({ label: name, path: acc })
    }
  }
  return crumbs
}

export default function Console({
  contextFolder,
  fileFolder,
  scopeFiles,
  onChangeContext,
  onOpenSettings
}: Props): React.JSX.Element {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)
  const [mentionIdx, setMentionIdx] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const runningReq = useRef<string | null>(null)
  const assistantId = useRef<string | null>(null)

  const atRoot = contextFolder === ''
  const project = atRoot ? '' : contextFolder.split('/')[0]

  const matches = mention
    ? scopeFiles
        .filter((f) => f.toLowerCase().includes(mention.query.toLowerCase()))
        .slice(0, MAX_MENTIONS)
    : []

  // Load the project's saved conversation when the project changes.
  useEffect(() => {
    if (!project) {
      setMessages([])
      return
    }
    let cancelled = false
    window.api.loadHistory(project).then((entries) => {
      if (cancelled) return
      setMessages(entries.map((e) => ({ id: uid(), role: e.role, text: e.text })))
    })
    return () => {
      cancelled = true
    }
  }, [project])

  // Subscribe once to streamed agent events; route by the active request id.
  useEffect(() => {
    return window.api.onAgentEvent((p: AgentEventPayload) => {
      if (p.type === 'diff') {
        const d = p.diff
        if (d && d.files.length) {
          const header = `${d.files.length} file${d.files.length > 1 ? 's' : ''} changed  ·  +${d.added} −${d.removed}`
          const lines = d.files.map((f) => `  ${f.path}  +${f.added} −${f.removed}`)
          setMessages((prev) => [
            ...prev,
            { id: uid(), role: 'diff', text: `${header}\n${lines.join('\n')}` }
          ])
        }
        return
      }
      if (p.requestId !== runningReq.current) return
      if (p.type === 'text') {
        setMessages((prev) => {
          if (assistantId.current) {
            return prev.map((m) =>
              m.id === assistantId.current ? { ...m, text: m.text + (p.text ?? '') } : m
            )
          }
          const id = uid()
          assistantId.current = id
          return [...prev, { id, role: 'assistant', text: p.text ?? '' }]
        })
      } else if (p.type === 'tool') {
        assistantId.current = null // next text starts a fresh bubble after tool activity
        setMessages((prev) => [...prev, { id: uid(), role: 'tool', text: p.detail || p.tool || '' }])
      } else if (p.type === 'done') {
        const parts: string[] = []
        if (p.model) parts.push(p.model)
        if (p.inputTokens || p.outputTokens) {
          parts.push(`↑ ${(p.inputTokens ?? 0).toLocaleString()}`)
          parts.push(`↓ ${(p.outputTokens ?? 0).toLocaleString()} tokens`)
        }
        if (p.costUsd && p.costUsd > 0) parts.push(`$${p.costUsd.toFixed(4)}`)
        if (parts.length) {
          setMessages((prev) => [...prev, { id: uid(), role: 'meta', text: parts.join('  ·  ') }])
        }
        runningReq.current = null
        assistantId.current = null
        setRunning(false)
      } else if (p.type === 'error') {
        setMessages((prev) => [...prev, { id: uid(), role: 'error', text: p.message || 'Error' }])
        runningReq.current = null
        assistantId.current = null
        setRunning(false)
      }
    })
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const value = e.target.value
    setInput(value)
    const m = detectMention(value, e.target.selectionStart ?? value.length)
    setMention(m)
    setMentionIdx(0)
  }

  const insertMention = (file: string): void => {
    if (!mention) return
    const caret = inputRef.current?.selectionStart ?? input.length
    const next = input.slice(0, mention.start) + `@${file} ` + input.slice(caret)
    setInput(next)
    setMention(null)
    requestAnimationFrame(() => {
      const pos = mention.start + file.length + 2
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(pos, pos)
    })
  }

  const send = async (): Promise<void> => {
    const text = input.trim()
    if (!text || atRoot || running) return
    const requestId = uid()
    runningReq.current = requestId
    assistantId.current = null
    setInput('')
    setMention(null)
    setMessages((prev) => [...prev, { id: uid(), role: 'user', text }])
    setRunning(true)
    try {
      await window.api.agentSend(requestId, contextFolder, text)
    } finally {
      if (runningReq.current === requestId) {
        runningReq.current = null
        setRunning(false)
      }
    }
  }

  const cancel = (): void => {
    if (runningReq.current) window.api.agentCancel(runningReq.current)
    runningReq.current = null
    assistantId.current = null
    setRunning(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (mention && matches.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIdx((i) => (i + 1) % matches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIdx((i) => (i - 1 + matches.length) % matches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(matches[mentionIdx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMention(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const crumbs = crumbsFor(contextFolder)
  const decoupled = contextFolder !== fileFolder

  const roleGlyph = (role: Msg['role']): string =>
    role === 'user'
      ? '❯'
      : role === 'assistant'
        ? '✦'
        : role === 'tool'
          ? '⚙'
          : role === 'error'
            ? '✕'
            : role === 'meta'
              ? '∑'
              : role === 'diff'
                ? '✎'
                : 'ℹ'

  return (
    <div className="console">
      <div className="console-header">
        <span>Console</span>
        <button className="console-settings" title="AI settings" onClick={onOpenSettings}>
          ⚙
        </button>
      </div>

      <div
        className="console-scope"
        title="Folder the AI runs under — sets its prompt and index scope"
      >
        <span className="scope-label">Runs in</span>
        <nav className="scope-crumbs">
          {crumbs.map((crumb, i) => (
            <span className="scope-crumb" key={crumb.path || 'root'}>
              <button
                className={i === crumbs.length - 1 ? 'scope-current' : ''}
                onClick={() => onChangeContext(crumb.path)}
              >
                {crumb.label}
              </button>
              {i < crumbs.length - 1 && <span className="scope-sep">›</span>}
            </span>
          ))}
        </nav>
        {decoupled && (
          <button
            className="scope-follow"
            title="Re-scope the AI to the folder of the file you're editing"
            onClick={() => onChangeContext(fileFolder)}
          >
            ↺ follow file
          </button>
        )}
      </div>

      <div className="console-messages" ref={scrollRef}>
        {messages.length === 0 && !atRoot && (
          <div className="console-msg system">
            <span className="console-role">ℹ</span>
            <span className="console-text">
              Ask about this project, or give instructions — retrieve, analyze, optimize, or
              store knowledge. Type <b>@</b> to reference a file. The AI works within {project}.
            </span>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`console-msg ${m.role}`}>
            <span className="console-role">{roleGlyph(m.role)}</span>
            <span className="console-text">{m.text}</span>
          </div>
        ))}
        {running && (
          <div className="console-msg assistant thinking">
            <span className="console-role">✦</span>
            <span className="console-text">thinking…</span>
          </div>
        )}
      </div>

      {atRoot ? (
        <div className="console-blocked">
          Open a file inside a project to use the console. The AI always runs within a single
          project — its own context, indexes, prompt and files. Pick a project in the tree, or
          click a project level above.
        </div>
      ) : (
        <div className="console-input-row">
          {mention && matches.length > 0 && (
            <div className="mention-popup">
              {matches.map((f, i) => (
                <button
                  key={f}
                  className={`mention-item ${i === mentionIdx ? 'active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    insertMention(f)
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={inputRef}
            className="console-input"
            rows={2}
            placeholder="Ask, or give instructions… @ to reference a file · Enter to send"
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
          />
          {running ? (
            <button className="console-send cancel" onClick={cancel}>
              Stop
            </button>
          ) : (
            <button className="console-send" onClick={send} disabled={!input.trim()}>
              Send
            </button>
          )}
        </div>
      )}
    </div>
  )
}
