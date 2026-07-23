import { promises as fs } from 'fs'
import { dirname } from 'path'
import { safePath } from './fs-service'

export interface HistoryEntry {
  ts: number
  /** Root-relative folder the message was sent from (the console scope). */
  scope: string
  role: 'user' | 'assistant'
  text: string
}

/** Top-level project folder for a context scope ('' if at the root / none). */
export function projectOf(contextFolder: string): string {
  if (!contextFolder) return ''
  return contextFolder.split('/')[0]
}

/** History file lives inside the project, hidden from the tree. */
function historyPath(root: string, project: string): string {
  return safePath(root, `${project}/.knowledge/history.jsonl`)
}

export async function loadHistory(root: string, project: string): Promise<HistoryEntry[]> {
  if (!project) return []
  try {
    const raw = await fs.readFile(historyPath(root, project), 'utf-8')
    return raw
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as HistoryEntry)
  } catch {
    return []
  }
}

export async function appendHistory(
  root: string,
  contextFolder: string,
  entries: HistoryEntry[]
): Promise<void> {
  const project = projectOf(contextFolder)
  if (!project || entries.length === 0) return
  const path = historyPath(root, project)
  await fs.mkdir(dirname(path), { recursive: true })
  const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n'
  await fs.appendFile(path, lines, 'utf-8')
}
