import { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import Breadcrumb from './Breadcrumb'
import MarkdownToolbar from './MarkdownToolbar'
import MarkdownPreview from './MarkdownPreview'
import type { MdCommand } from '../lib/markdown-commands'
import { renderMarkdownToHtml, htmlToPlainText } from '../lib/render-markdown'

interface Props {
  path: string
  initialContent: string
  onOpenPrompt: (folderPath: string) => void
}

const AUTOSAVE_MS = 600

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, class: 'cm-h1' },
  { tag: tags.heading2, class: 'cm-h2' },
  { tag: tags.heading3, class: 'cm-h3' },
  { tag: tags.heading4, class: 'cm-h4' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, class: 'cm-link' },
  { tag: tags.url, class: 'cm-url' },
  { tag: tags.monospace, class: 'cm-inline-code' },
  { tag: tags.quote, class: 'cm-quote' },
  { tag: tags.meta, class: 'cm-marker' },
  { tag: tags.processingInstruction, class: 'cm-marker' },
  { tag: tags.contentSeparator, class: 'cm-hr' }
])

const editorTheme = EditorView.theme(
  {
    '&': { height: '100%', fontSize: '15px' },
    '.cm-scroller': {
      fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
      lineHeight: '1.6'
    },
    '.cm-content': { padding: '16px 8px', maxWidth: '820px', caretColor: '#89b4fa' },
    '&.cm-focused': { outline: 'none' },
    '.cm-gutters': { background: 'transparent', border: 'none', color: '#45475a' },
    '.cm-activeLine': { background: 'rgba(137, 180, 250, 0.06)' },
    '.cm-cursor': { borderLeftColor: '#89b4fa' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      background: 'rgba(137, 180, 250, 0.25) !important'
    }
  },
  { dark: true }
)

export default function Editor({ path, initialContent, onOpenPrompt }: Props): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const dirtyRef = useRef(false)
  // Last content this editor itself wrote to disk, so its own autosave echoes
  // (which arrive back as file-change events) aren't mistaken for edits by the AI.
  const lastSaved = useRef(initialContent)
  // True while we replace the doc from disk, so the update listener doesn't
  // treat that as a user edit (which would re-mark it dirty and re-save).
  const applyingExternal = useRef(false)
  const [saved, setSaved] = useState(true)
  const [diskConflict, setDiskConflict] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [previewHtml, setPreviewHtml] = useState('')
  const [copied, setCopied] = useState(false)

  // Reset to edit mode when switching files.
  useEffect(() => setMode('edit'), [path])

  const enterPreview = (): void => {
    const view = viewRef.current
    if (view) setPreviewHtml(renderMarkdownToHtml(view.state.doc.toString()))
    setMode('preview')
  }

  const copyPreview = (): void => {
    window.api.copyHtml(previewHtml, htmlToPlainText(previewHtml))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const runCommand = (cmd: MdCommand): void => {
    const view = viewRef.current
    if (!view) return
    cmd(view)
    view.focus()
  }

  useEffect(() => {
    // Everything closes over this effect's `path`, so a pending save always
    // writes to the file the doc actually belongs to, even mid file-switch.
    dirtyRef.current = false
    lastSaved.current = initialContent
    setDiskConflict(false)
    let timer: ReturnType<typeof setTimeout> | null = null

    const flushSave = (view: EditorView): void => {
      if (timer) clearTimeout(timer)
      timer = null
      if (dirtyRef.current) {
        dirtyRef.current = false
        const content = view.state.doc.toString()
        lastSaved.current = content
        window.api.writeFile(path, content)
        setSaved(true)
      }
    }

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        history(),
        keymap.of([
          {
            key: 'Mod-s',
            run: (view) => {
              flushSave(view)
              return true
            }
          },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap
        ]),
        lineNumbers(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(markdownHighlight),
        editorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !applyingExternal.current) {
            dirtyRef.current = true
            setSaved(false)
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => flushSave(update.view), AUTOSAVE_MS)
          }
        })
      ]
    })
    const view = new EditorView({ state, parent: containerRef.current! })
    viewRef.current = view
    view.focus()

    return () => {
      flushSave(view)
      view.destroy()
      viewRef.current = null
    }
    // initialContent is only meaningful together with path; recreate per file
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  const applyDiskContent = (content: string): void => {
    const view = viewRef.current
    if (!view) return
    applyingExternal.current = true
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } })
    applyingExternal.current = false
    dirtyRef.current = false
    lastSaved.current = content
    setSaved(true)
    setDiskConflict(false)
    if (mode === 'preview') setPreviewHtml(renderMarkdownToHtml(content))
  }

  // The file changed on disk (e.g. the AI edited it). Reload if the user has no
  // unsaved edits; otherwise flag a conflict and let them choose.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (initialContent === view.state.doc.toString()) return // already in sync
    if (initialContent === lastSaved.current) return // our own autosave echo
    if (dirtyRef.current) setDiskConflict(true)
    else applyDiskContent(initialContent)
  }, [initialContent])

  return (
    <div className="editor">
      <div className="editor-header">
        <Breadcrumb path={path} onOpenPrompt={onOpenPrompt} />
        <div className="editor-header-actions">
          {mode === 'preview' ? (
            <>
              <button className="editor-mode-btn" onClick={copyPreview}>
                {copied ? '✓ copied' : 'Copy HTML'}
              </button>
              <button className="editor-mode-btn" onClick={() => setMode('edit')}>
                ✎ Edit
              </button>
            </>
          ) : (
            <button className="editor-mode-btn" title="View the final rendered document" onClick={enterPreview}>
              👁 Preview
            </button>
          )}
          {diskConflict ? (
            <button
              className="disk-conflict"
              title="This file changed on disk. Click to load the new version (discards your unsaved edits)."
              onClick={() => applyDiskContent(initialContent)}
            >
              ⟳ changed on disk — reload
            </button>
          ) : (
            <span className={`save-indicator ${saved ? 'saved' : 'dirty'}`}>
              {saved ? 'saved' : '●'}
            </span>
          )}
        </div>
      </div>
      <div className="editor-body" style={{ display: mode === 'edit' ? undefined : 'none' }} ref={containerRef} />
      {mode === 'preview' && <MarkdownPreview html={previewHtml} />}
      {mode === 'edit' && <MarkdownToolbar onRun={runCommand} />}
    </div>
  )
}
