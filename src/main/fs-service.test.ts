import { describe, it, expect } from 'vitest'
import { safePath } from './fs-service'

const ROOT = '/home/user/Knowledge'

describe('safePath', () => {
  it('resolves paths inside the root', () => {
    expect(safePath(ROOT, 'blog/post.md')).toBe('/home/user/Knowledge/blog/post.md')
  })

  it('allows the root itself', () => {
    expect(safePath(ROOT, '')).toBe(ROOT)
  })

  it('rejects parent-directory traversal', () => {
    expect(() => safePath(ROOT, '../secrets.txt')).toThrow(/escapes/)
    expect(() => safePath(ROOT, 'blog/../../etc/passwd')).toThrow(/escapes/)
  })

  it('rejects a sibling that merely shares the prefix', () => {
    expect(() => safePath(ROOT, '../Knowledge-evil/x')).toThrow(/escapes/)
  })
})
