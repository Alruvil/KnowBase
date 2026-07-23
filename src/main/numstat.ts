import type { DiffFile, DiffSummary } from '../shared/types'

/**
 * Parse the output of `git diff --numstat`. Each line is
 * `<added>\t<removed>\t<path>`; binary files report `-` for the counts, and a
 * path may itself contain tabs, so everything after the second tab is the path.
 */
export function parseNumstat(out: string): DiffSummary {
  const files: DiffFile[] = []
  let added = 0
  let removed = 0
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const [a, r, ...rest] = line.split('\t')
    const path = rest.join('\t')
    if (!path) continue
    const ai = a === '-' ? 0 : parseInt(a, 10) || 0
    const ri = r === '-' ? 0 : parseInt(r, 10) || 0
    files.push({ path, added: ai, removed: ri })
    added += ai
    removed += ri
  }
  return { files, added, removed }
}
