import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { composeSystemPrompt, withPriorAnswer } from './prompt-service'

let root: string

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'kb-prompt-'))
  mkdirSync(join(root, 'blog', 'Opinion'), { recursive: true })
  writeFileSync(join(root, '_prompt.md'), 'ROOT RULE')
  writeFileSync(join(root, 'blog', '_prompt.md'), 'BLOG RULE')
  writeFileSync(join(root, 'blog', 'Opinion', '_prompt.md'), 'OPINION RULE')
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('composeSystemPrompt', () => {
  it('includes every level from root to the scope, most specific last', async () => {
    const prompt = await composeSystemPrompt(root, 'blog/Opinion')
    const iRoot = prompt.indexOf('ROOT RULE')
    const iBlog = prompt.indexOf('BLOG RULE')
    const iOpinion = prompt.indexOf('OPINION RULE')
    expect(iRoot).toBeGreaterThan(-1)
    expect(iBlog).toBeGreaterThan(iRoot)
    expect(iOpinion).toBeGreaterThan(iBlog)
  })

  it('omits levels without a _prompt.md and still includes the base role', async () => {
    const prompt = await composeSystemPrompt(root, 'blog')
    expect(prompt).toContain('knowledge assistant')
    expect(prompt).toContain('BLOG RULE')
    expect(prompt).not.toContain('OPINION RULE')
  })
})

describe('withPriorAnswer', () => {
  it('returns the prompt unchanged when there is no prior answer', () => {
    expect(withPriorAnswer('follow-up question')).toBe('follow-up question')
    expect(withPriorAnswer('follow-up question', '')).toBe('follow-up question')
    expect(withPriorAnswer('follow-up question', '   ')).toBe('follow-up question')
  })

  it('prepends the prior answer as context ahead of the new prompt', () => {
    const result = withPriorAnswer('what about the second point?', 'Here are three points...')
    const contextIdx = result.indexOf('Here are three points...')
    const followUpIdx = result.indexOf('what about the second point?')
    expect(contextIdx).toBeGreaterThan(-1)
    expect(followUpIdx).toBeGreaterThan(contextIdx)
  })
})
