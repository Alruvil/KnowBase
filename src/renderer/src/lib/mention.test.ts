import { describe, it, expect } from 'vitest'
import { detectMention } from './mention'

// caret defaults to end of string
const at = (s: string): ReturnType<typeof detectMention> => detectMention(s, s.length)

describe('detectMention', () => {
  it('detects an @token at the start', () => {
    expect(at('@not')).toEqual({ start: 0, query: 'not' })
  })

  it('detects an @token after a space', () => {
    expect(at('read @plan')).toEqual({ start: 5, query: 'plan' })
  })

  it('allows slashes in the token (subfolder paths)', () => {
    expect(at('@sub/deep')).toEqual({ start: 0, query: 'sub/deep' })
  })

  it('does not trigger inside an email (@ not preceded by whitespace)', () => {
    expect(at('mail me at bob@acme')).toBeNull()
  })

  it('closes the mention after a space', () => {
    expect(at('@plan ')).toBeNull()
  })

  it('uses the caret position, not the whole string', () => {
    // caret right after "@pl" in "@plan"
    expect(detectMention('@plan', 3)).toEqual({ start: 0, query: 'pl' })
  })
})
