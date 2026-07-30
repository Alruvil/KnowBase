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

/** A root-relative folder to restrict an operation to (a project); '' = everything. */
type Scope = string | undefined

function scopeArgs(scope: Scope): string[] {
  return scope ? ['--', scope] : []
}

export async function status(root: string, scope?: Scope): Promise<GitStatus> {
  if (!(await isAvailable())) return { enabled: false, dirty: false, files: 0 }
  const out = await tryGit(root, ['status', '--porcelain', ...scopeArgs(scope)])
  const lines = out.split('\n').filter((l) => l.trim())
  return { enabled: true, dirty: lines.length > 0, files: lines.length }
}

/**
 * Commit changes if any. With a `scope`, only that project's changes are staged
 * and committed — other projects' pending edits are left untouched, even if
 * they're currently dirty too.
 */
export async function commitAll(root: string, message: string, scope?: Scope): Promise<boolean> {
  if (!(await isAvailable())) return false
  await tryGit(root, ['add', '-A', ...scopeArgs(scope)])
  try {
    await git(root, ['commit', '-m', message, ...scopeArgs(scope)])
    return true
  } catch {
    return false // nothing to commit
  }
}

/** Snapshot the current content before an AI call, so it can be reverted. */
export async function checkpointBeforeCall(root: string, prompt: string, scope: Scope): Promise<void> {
  await ensureRepo(root)
  const summary = prompt.replace(/\s+/g, ' ').slice(0, 72)
  const made = await commitAll(root, `before AI: ${summary}`, scope)
  log('git', 'pre-call checkpoint', { committed: made, scope: scope || '(all)' })
}

/** Diff of the working tree (incl. new files) against the last commit. */
export async function diffSinceHead(root: string, scope?: Scope): Promise<DiffSummary> {
  const empty: DiffSummary = { files: [], added: 0, removed: 0 }
  if (!(await isAvailable())) return empty
  await tryGit(root, ['add', '-A', ...scopeArgs(scope)]) // stage so new files are counted
  const out = await tryGit(root, ['diff', '--cached', '--numstat', 'HEAD', ...scopeArgs(scope)])
  return parseNumstat(out)
}

/** Unified diff text for a single file, against the last commit. */
export async function diffPatch(root: string, path: string): Promise<string> {
  if (!(await isAvailable())) return ''
  await tryGit(root, ['add', '-A']) // stage so new files show a full-file diff
  return tryGit(root, ['diff', '--cached', 'HEAD', '--', path])
}

/**
 * Drop working-tree changes back to the last commit, including new files. With
 * a `scope`, only that project's files are touched — `reset --hard` isn't
 * path-scopable, so this uses `checkout` + `clean` restricted to the scope
 * instead, leaving other projects' pending changes exactly as they were.
 */
export async function revert(root: string, scope?: Scope): Promise<boolean> {
  if (!(await isAvailable())) return false
  try {
    if (scope) {
      await git(root, ['checkout', 'HEAD', '--', scope])
      await git(root, ['clean', '-fd', '--', scope])
    } else {
      await git(root, ['reset', '--hard', 'HEAD'])
      await git(root, ['clean', '-fd']) // remove untracked (respects .gitignore)
    }
    log('git', 'reverted to last commit', { scope: scope || '(all)' })
    return true
  } catch (err) {
    log('git', 'revert failed', { error: err instanceof Error ? err.message : String(err) })
    return false
  }
}

/** Drop working-tree changes to a single file back to the last commit. */
export async function revertFile(root: string, path: string): Promise<boolean> {
  if (!(await isAvailable())) return false
  try {
    await tryGit(root, ['add', '-A'])
    const existedAtHead = await git(root, ['cat-file', '-e', `HEAD:${path}`])
      .then(() => true)
      .catch(() => false)
    await tryGit(root, ['reset', 'HEAD', '--', path])
    if (existedAtHead) {
      await git(root, ['checkout', 'HEAD', '--', path])
    } else {
      await fs.rm(join(root, path), { force: true })
    }
    log('git', 'reverted file', { path })
    return true
  } catch (err) {
    log('git', 'revert file failed', { path, error: err instanceof Error ? err.message : String(err) })
    return false
  }
}
