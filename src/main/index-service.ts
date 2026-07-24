import { promises as fs } from 'fs'
import { safePath } from './fs-service'
import { HIDDEN_FILES, INDEX_FILE } from '../shared/types'

const ENTRY_RE = /^-\s*`([^`]+)`\s*—\s*(.+)$/

/** Parse an `_index.md` body into filename → description pairs. */
export function parseIndexEntries(content: string): Map<string, string> {
  const entries = new Map<string, string>()
  for (const line of content.split('\n')) {
    const m = ENTRY_RE.exec(line.trim())
    if (m) entries.set(m[1], m[2].trim())
  }
  return entries
}

/**
 * Compose a task prompt for the agent to build or update `_index.md` in
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

  const unchanged: { name: string; description: string }[] = []
  const needsDescription: string[] = []
  for (const name of mdFiles) {
    const description = existing.get(name)
    const stat = await fs.stat(safePath(root, folder ? `${folder}/${name}` : name))
    if (description && stat.mtimeMs <= indexMtimeMs) {
      unchanged.push({ name, description })
    } else {
      needsDescription.push(name)
    }
  }
  const removed = [...existing.keys()].filter((name) => !mdFiles.includes(name))

  const lines: string[] = [
    `Update ${INDEX_FILE} in this folder to reflect its current markdown files.`,
    '',
    `Format: one line per file, exactly \`- \\\`filename.md\\\` — one-sentence description.\`, sorted alphabetically by filename.`
  ]

  if (unchanged.length) {
    lines.push(
      '',
      'These entries are already accurate and unchanged since the index was last built — copy them through as-is, do NOT re-read those files:',
      ...unchanged.map((e) => `- \`${e.name}\` — ${e.description}`)
    )
  }
  if (needsDescription.length) {
    lines.push(
      '',
      'These files are new or changed since the index was last built — read each one and write a concise, one-sentence description:',
      ...needsDescription.map((name) => `- ${name}`)
    )
  }
  if (removed.length) {
    lines.push('', `These files no longer exist — drop their entries: ${removed.join(', ')}`)
  }
  if (!mdFiles.length) {
    lines.push('', 'There are no markdown files here yet — write a one-line note that the folder is empty.')
  }
  lines.push('', `Write the combined, complete result to ${INDEX_FILE} in this folder.`)

  return lines.join('\n')
}
