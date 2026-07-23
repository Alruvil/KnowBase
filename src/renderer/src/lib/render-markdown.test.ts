// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderMarkdownToHtml, htmlToPlainText } from './render-markdown'

describe('renderMarkdownToHtml', () => {
  it('renders headings, emphasis, and links without markdown syntax', () => {
    const html = renderMarkdownToHtml('# Title\n\n**bold** and [link](https://x.com)')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<a href="https://x.com">link</a>')
    expect(html).not.toContain('#')
    expect(html).not.toContain('**')
  })

  it('renders GFM tables (matching the editor toolbar output)', () => {
    const html = renderMarkdownToHtml('| a | b |\n| --- | --- |\n| 1 | 2 |\n')
    expect(html).toContain('<table>')
    expect(html).toContain('<td>1</td>')
  })
})

describe('htmlToPlainText', () => {
  it('strips tags, keeping readable text', () => {
    expect(htmlToPlainText('<h1>Title</h1><p><strong>bold</strong> text</p>')).toBe('Titlebold text')
  })
})
