import { promises as fs } from 'fs'
import { resolve, sep, dirname } from 'path'
import type { FileNode } from '../shared/types'

const IGNORED = new Set(['.git', '.obsidian', 'node_modules', '.DS_Store'])

/**
 * Resolves a root-relative path to an absolute one, rejecting anything
 * that escapes the knowledge root.
 */
export function safePath(root: string, relPath: string): string {
  const abs = resolve(root, relPath)
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new Error(`Path escapes knowledge root: ${relPath}`)
  }
  return abs
}

export async function buildTree(root: string, dir = ''): Promise<FileNode[]> {
  const abs = safePath(root, dir)
  const entries = await fs.readdir(abs, { withFileTypes: true })
  const nodes: FileNode[] = []
  for (const entry of entries) {
    if (IGNORED.has(entry.name) || entry.name.startsWith('.')) continue
    const relPath = dir ? `${dir}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: relPath,
        type: 'folder',
        children: await buildTree(root, relPath)
      })
    } else if (entry.isFile()) {
      nodes.push({ name: entry.name, path: relPath, type: 'file' })
    }
  }
  // Folders first, then files, special "_" files at the top of their group
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    const aSpecial = a.name.startsWith('_') ? 0 : 1
    const bSpecial = b.name.startsWith('_') ? 0 : 1
    if (aSpecial !== bSpecial) return aSpecial - bSpecial
    return a.name.localeCompare(b.name)
  })
  return nodes
}

export async function readFile(root: string, relPath: string): Promise<string> {
  return fs.readFile(safePath(root, relPath), 'utf-8')
}

/** Reads a binary file (e.g. an image) as base64, for display in the renderer. */
export async function readBinary(root: string, relPath: string): Promise<string> {
  const buf = await fs.readFile(safePath(root, relPath))
  return buf.toString('base64')
}

export async function writeFile(root: string, relPath: string, content: string): Promise<void> {
  const abs = safePath(root, relPath)
  await fs.mkdir(dirname(abs), { recursive: true })
  await fs.writeFile(abs, content, 'utf-8')
}

export async function createFile(root: string, relPath: string, content = ''): Promise<void> {
  const abs = safePath(root, relPath)
  await fs.mkdir(dirname(abs), { recursive: true })
  await fs.writeFile(abs, content, { encoding: 'utf-8', flag: 'wx' })
}

/** Create the file with `content` only if it does not already exist; a no-op otherwise. */
export async function ensureFile(root: string, relPath: string, content = ''): Promise<void> {
  const abs = safePath(root, relPath)
  try {
    await fs.access(abs)
    return
  } catch {
    // Doesn't exist yet — create it below.
  }
  await fs.mkdir(dirname(abs), { recursive: true })
  await fs.writeFile(abs, content, 'utf-8')
}

export async function createFolder(root: string, relPath: string): Promise<void> {
  await fs.mkdir(safePath(root, relPath), { recursive: true })
}

export async function rename(root: string, oldRel: string, newRel: string): Promise<void> {
  const target = safePath(root, newRel)
  try {
    await fs.access(target)
    throw new Error(`Target already exists: ${newRel}`)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  await fs.rename(safePath(root, oldRel), target)
}
