import { describe, it, expect } from 'vitest'
import { projectOf } from './history-service'

describe('projectOf', () => {
  it('returns the top-level folder for a nested scope', () => {
    expect(projectOf('blog/Opinion/deep')).toBe('blog')
  })

  it('returns the folder itself for a project-level scope', () => {
    expect(projectOf('blog')).toBe('blog')
  })

  it('returns empty for the root', () => {
    expect(projectOf('')).toBe('')
  })
})
