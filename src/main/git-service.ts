import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { promises as fs } from 'fs'
import { join } from 'path'
import { log } from './logger'
import { parseNumstat } from './numstat'
import type { DiffSummary, GitStatus } from '../shared/types'

const execFileAsync = promisify(execFile)

let available: boolean | null = null

async function isAvailable(): Promise<boolean> {
  if (available !== null) return available
  available = await execFileAsync('git', ['--version'])
    .then(() => true)
    .catch(() => false)
  return available
}

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 })
  return stdout
}

/** git that never throws — returns '' on failure. */
async function tryGit(root: string, args: string[]): Promise<string> {
  try {
    return await git(root, args)
  } catch {
    return ''
  }
}

const GITIGNORE = `# KnowBase — internal state, not knowledge content
.knowledge/
.DS_Store
`

async function ensureGitignore(root: string): Promise<void> {
  const path = join(root, '.gitignore')
  try {
    const current = await fs.readFile(path, 'utf-8')
    if (!current.includes('.knowledge/')) {
      await fs.writeFile(path, current.trimEnd() + '\n.knowledge/\n', 'utf-8')
    }
  } catch {
    await fs.writeFile(path, GITIGNORE, 'utf-8')
  }
}

/**
 * Ensure the content root is a git repo with a local identity, a .gitignore
 * that excludes internal state, and at least one commit. Safe to call repeatedly.
 */
export async function ensureRepo(root: string): Promise<boolean> {
  if (!(await isAvailable())) {
    log('git', 'git not available — content versioning disabled')
    return false
  }
  const isRepo = await git(root, ['rev-parse', '--is-inside-work-tree'])
    .then(() => true)
    .catch(() => false)
  if (!isRepo) {
    await tryGit(root, ['init'])
    log('git', 'initialized content repo', { root })
  }
  // Local identity so commits work even without a global git config.
  await tryGit(root, ['config', 'user.email', 'knowledge-app@localhost'])
  await tryGit(root, ['config', 'user.name', 'KnowBase'])
  await ensureGitignore(root)
  const hasHead = await git(root, ['rev-parse', '--verify', 'HEAD'])
    .then(() => true)
    .catch(() => false)
  if (!hasHead) {
    await tryGit(root, ['add', '-A'])
    await tryGit(root, ['commit', '--allow-empty', '-m', 'Initial snapshot'])
  }
  return true
}

export async function status(root: string): Promise<GitStatus> {
  if (!(await isAvailable())) return { enabled: false, dirty: false, files: 0 }
  const out = await tryGit(root, ['status', '--porcelain'])
  const lines = out.split('\n').filter((l) => l.trim())
  return { enabled: true, dirty: lines.length > 0, files: lines.length }
}

/** Commit all changes if any. Returns true if a commit was made. */
export async function commitAll(root: string, message: string): Promise<boolean> {
  if (!(await isAvailable())) return false
  await tryGit(root, ['add', '-A'])
  try {
    await git(root, ['commit', '-m', message])
    return true
  } catch {
    return false // nothing to commit
  }
}

/** Snapshot the current content before an AI call, so it can be reverted. */
export async function checkpointBeforeCall(root: string, prompt: string): Promise<void> {
  await ensureRepo(root)
  const summary = prompt.replace(/\s+/g, ' ').slice(0, 72)
  const made = await commitAll(root, `before AI: ${summary}`)
  log('git', 'pre-call checkpoint', { committed: made })
}

/** Diff of the working tree (incl. new files) against the last commit. */
export async function diffSinceHead(root: string): Promise<DiffSummary> {
  const empty: DiffSummary = { files: [], added: 0, removed: 0 }
  if (!(await isAvailable())) return empty
  await tryGit(root, ['add', '-A']) // stage so new files are counted
  const out = await tryGit(root, ['diff', '--cached', '--numstat', 'HEAD'])
  return parseNumstat(out)
}

/** Drop all working-tree changes back to the last commit (incl. new files). */
export async function revert(root: string): Promise<boolean> {
  if (!(await isAvailable())) return false
  try {
    await git(root, ['reset', '--hard', 'HEAD'])
    await git(root, ['clean', '-fd']) // remove untracked (respects .gitignore)
    log('git', 'reverted to last commit')
    return true
  } catch (err) {
    log('git', 'revert failed', { error: err instanceof Error ? err.message : String(err) })
    return false
  }
}
