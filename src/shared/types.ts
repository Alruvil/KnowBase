export interface FileNode {
  /** File or folder name, e.g. "notes.md" */
  name: string
  /** Path relative to the knowledge root, using "/" separators */
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

export interface DiffFile {
  path: string
  added: number
  removed: number
}

export interface DiffSummary {
  files: DiffFile[]
  added: number
  removed: number
}

export interface GitStatus {
  enabled: boolean
  dirty: boolean
  files: number
}

/** One streamed event from an agent turn (main → renderer over IPC). */
export interface AgentEventPayload {
  requestId: string
  type: 'text' | 'tool' | 'done' | 'error' | 'diff'
  text?: string
  tool?: string
  detail?: string
  costUsd?: number
  inputTokens?: number
  outputTokens?: number
  model?: string
  message?: string
  diff?: DiffSummary
}

/** A persisted conversation entry, stored per project. */
export interface HistoryEntry {
  ts: number
  /** Root-relative folder the message was sent from (the console scope). */
  scope: string
  role: 'user' | 'assistant'
  text: string
}

export interface AuthStatus {
  mode: 'auto' | 'subscription' | 'apiKey'
  hasToken: boolean
}

/** Names of special files that configure AI behavior at each tree level */
export const PROMPT_FILE = '_prompt.md'
export const INDEX_FILE = '_index.md'

/** System files hidden from the file tree; surfaced through the config cog instead */
export const HIDDEN_FILES = new Set<string>([PROMPT_FILE, INDEX_FILE])

export const PROMPT_TEMPLATE = `# AI instructions for this level

Give the AI context and instructions for this project/folder:
what it contains, tone and vocabulary to use, what to focus on,
and any output conventions. These instructions apply to every file
here and combine with the instructions of parent folders.
`

/** Builds the path to a folder's prompt file ('' = knowledge root). */
export function promptPath(folderPath: string): string {
  return folderPath ? `${folderPath}/${PROMPT_FILE}` : PROMPT_FILE
}
