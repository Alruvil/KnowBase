import { marked } from 'marked'

marked.setOptions({ gfm: true })

/** Render markdown to HTML, suitable for display or clipboard copy. */
export function renderMarkdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false })
}

/** Plain-text rendering of markdown (tags stripped), for clipboard fallback. */
export function htmlToPlainText(html: string): string {
  const el = document.createElement('div')
  el.innerHTML = html
  return el.textContent ?? ''
}
