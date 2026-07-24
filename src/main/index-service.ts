import { promises as fs } from 'fs'
import { safePath } from './fs-service'
import { HIDDEN_FILES, INDEX_FILE } from '../shared/types'

interface IndexEntry {
  file: string
  description: string
}

/** Parse an `_index.json` body into filename → description pairs. Never throws. */
export function parseIndexEntries(content: string): Map<string, string> {
  const entries = new Map<string, string>()
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return entries
  }
  if (!Array.isArray(parsed)) return entries
  for (const item of parsed) {
    const file = (item as Partial<IndexEntry>)?.file
    const description = (item as Partial<IndexEntry>)?.description
    if (typeof file === 'string' && typeof description === 'string') {
      entries.set(file, description)
    }
  }
  return entries
}

/**
 * Compose a task prompt for the agent to build or update `_index.json` in
 * `folder`, non-recursively. Diffs against the existing index by mtime so
 * the agent only re-reads files that are new or changed since the index was
 * last generated — unchanged entries are handed over verbatim, saving the
 * tokens a full re-scan would cost as a folder grows.
 */
export async function buildIndexUpdatePrompt(root: string, folder: string): Promise<string> {
  const dirAbs = safePath(root, folder)
  const dirEntries = await fs.readdir(dirAbs, { withFileTypes: true })
  const mdFiles = dirEntries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && !HIDDEN_FILES.has(e.name))
    .map((e) => e.name)
    .sort()

  const indexRel = folder ? `${folder}/${INDEX_FILE}` : INDEX_FILE
  const indexAbs = safePath(root, indexRel)

  let existing = new Map<string, string>()
  let indexMtimeMs = 0
  try {
    const [content, stat] = await Promise.all([fs.readFile(indexAbs, 'utf-8'), fs.stat(indexAbs)])
    existing = parseIndexEntries(content)
    indexMtimeMs = stat.mtimeMs
  } catch {
    // No index yet — every file is "new".
  }

  const unchanged: IndexEntry[] = []
  const needsDescription: string[] = []
  for (const name of mdFiles) {
    const description = existing.get(name)
    const stat = await fs.stat(safePath(root, folder ? `${folder}/${name}` : name))
    if (description && stat.mtimeMs <= indexMtimeMs) {
      unchanged.push({ file: name, description })
    } else {
      needsDescription.push(name)
    }
  }
  const removed = [...existing.keys()].filter((name) => !mdFiles.includes(name))

  const lines: string[] = [
    `Update ${INDEX_FILE} in this folder to reflect its current markdown files.`,
    '',
    `Format: a JSON array of objects, each exactly { "file": "filename.md", "description": "one-sentence description." }, sorted alphabetically by "file". Write ONLY valid JSON to the file — no markdown, no comments, no trailing prose.`
  ]

  if (unchanged.length) {
    lines.push(
      '',
      'These entries are already accurate and unchanged since the index was last built — copy them through as-is in the final JSON, do NOT re-read those files:',
      JSON.stringify(unchanged, null, 2)
    )
  }
  if (needsDescription.length) {
    lines.push(
      '',
      'These files are new or changed since the index was last built — read each one and write a concise, one-sentence description for it:',
      ...needsDescription.map((name) => `- ${name}`)
    )
  }
  if (removed.length) {
    lines.push('', `These files no longer exist — drop their entries: ${removed.join(', ')}`)
  }
  if (!mdFiles.length) {
    lines.push('', 'There are no markdown files here yet — write an empty JSON array: []')
  }
  lines.push('', `Write the combined, complete result to ${INDEX_FILE} in this folder.`)

  return lines.join('\n')
}
