import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { parseIndexEntries, buildIndexUpdatePrompt } from './index-service'

describe('parseIndexEntries', () => {
  it('extracts filename → description pairs from a JSON array', () => {
    const body = JSON.stringify([
      { file: 'a.md', description: 'About A.' },
      { file: 'b.md', description: 'About B, with an em dash — like this.' }
    ])
    const entries = parseIndexEntries(body)
    expect(entries.get('a.md')).toBe('About A.')
    expect(entries.get('b.md')).toBe('About B, with an em dash — like this.')
    expect(entries.size).toBe(2)
  })

  it('returns an empty map for empty content', () => {
    expect(parseIndexEntries('').size).toBe(0)
  })

  it('returns an empty map for malformed JSON instead of throwing', () => {
    expect(parseIndexEntries('not json').size).toBe(0)
  })

  it('ignores entries missing file or description', () => {
    const body = JSON.stringify([{ file: 'a.md' }, { description: 'no file' }, 'a string'])
    expect(parseIndexEntries(body).size).toBe(0)
  })
})

describe('buildIndexUpdatePrompt', () => {
  let root: string
  const old = new Date('2020-01-01')
  const recent = new Date()

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kb-index-'))
    mkdirSync(join(root, 'blog'), { recursive: true })
  })

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('treats every file as new when there is no existing index', async () => {
    writeFileSync(join(root, 'blog', 'a.md'), '# A')
    writeFileSync(join(root, 'blog', 'b.md'), '# B')
    const prompt = await buildIndexUpdatePrompt(root, 'blog')
    expect(prompt).toContain('new or changed')
    expect(prompt).toContain('- a.md')
    expect(prompt).toContain('- b.md')
    expect(prompt).not.toContain('already accurate')
    expect(prompt).toContain('JSON array')
  })

  it('carries unchanged entries through without asking the agent to re-read them', async () => {
    writeFileSync(join(root, 'blog', 'a.md'), '# A')
    utimesSync(join(root, 'blog', 'a.md'), old, old)
    writeFileSync(join(root, 'blog', '_index.json'), JSON.stringify([{ file: 'a.md', description: 'About A.' }]))
    utimesSync(join(root, 'blog', '_index.json'), recent, recent)

    const prompt = await buildIndexUpdatePrompt(root, 'blog')
    expect(prompt).toContain('already accurate')
    expect(prompt).toContain('"file": "a.md"')
    expect(prompt).toContain('"description": "About A."')
    expect(prompt).not.toContain('new or changed')
  })

  it('flags a file modified after the index was built for re-description', async () => {
    writeFileSync(join(root, 'blog', 'a.md'), '# A')
    utimesSync(join(root, 'blog', 'a.md'), recent, recent)
    writeFileSync(
      join(root, 'blog', '_index.json'),
      JSON.stringify([{ file: 'a.md', description: 'Stale description.' }])
    )
    utimesSync(join(root, 'blog', '_index.json'), old, old)

    const prompt = await buildIndexUpdatePrompt(root, 'blog')
    expect(prompt).toContain('new or changed')
    expect(prompt).toContain('- a.md')
    expect(prompt).not.toContain('Stale description')
  })

  it('lists removed entries for files that no longer exist', async () => {
    writeFileSync(join(root, 'blog', 'a.md'), '# A')
    utimesSync(join(root, 'blog', 'a.md'), old, old)
    writeFileSync(
      join(root, 'blog', '_index.json'),
      JSON.stringify([
        { file: 'a.md', description: 'About A.' },
        { file: 'gone.md', description: 'Deleted file.' }
      ])
    )
    utimesSync(join(root, 'blog', '_index.json'), recent, recent)

    const prompt = await buildIndexUpdatePrompt(root, 'blog')
    expect(prompt).toContain('drop their entries')
    expect(prompt).toContain('gone.md')
  })

  it('notes an empty folder', async () => {
    const prompt = await buildIndexUpdatePrompt(root, 'blog')
    expect(prompt).toContain('no markdown files here yet')
    expect(prompt).toContain('empty JSON array')
  })

  it('treats a malformed existing index as empty, re-describing every file', async () => {
    writeFileSync(join(root, 'blog', 'a.md'), '# A')
    utimesSync(join(root, 'blog', 'a.md'), old, old)
    writeFileSync(join(root, 'blog', '_index.json'), 'not valid json')
    utimesSync(join(root, 'blog', '_index.json'), recent, recent)

    const prompt = await buildIndexUpdatePrompt(root, 'blog')
    expect(prompt).toContain('new or changed')
    expect(prompt).toContain('- a.md')
  })
})
