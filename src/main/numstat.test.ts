import { describe, it, expect } from 'vitest'
import { parseNumstat } from './numstat'

describe('parseNumstat', () => {
  it('parses added/removed counts and totals', () => {
    const out = '10\t2\tnotes.md\n3\t0\tplan.md\n'
    const r = parseNumstat(out)
    expect(r.files).toEqual([
      { path: 'notes.md', added: 10, removed: 2 },
      { path: 'plan.md', added: 3, removed: 0 }
    ])
    expect(r.added).toBe(13)
    expect(r.removed).toBe(2)
  })

  it('treats binary "-" counts as zero', () => {
    const r = parseNumstat('-\t-\timage.png\n')
    expect(r.files[0]).toEqual({ path: 'image.png', added: 0, removed: 0 })
    expect(r.added).toBe(0)
  })

  it('keeps paths that contain spaces', () => {
    const r = parseNumstat('1\t1\tServant leadership.md\n')
    expect(r.files[0].path).toBe('Servant leadership.md')
  })

  it('returns empty for blank output', () => {
    expect(parseNumstat('')).toEqual({ files: [], added: 0, removed: 0 })
  })
})
