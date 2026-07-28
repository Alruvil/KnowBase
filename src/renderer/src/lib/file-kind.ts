export type FileKind = 'markdown' | 'html' | 'svg' | 'image'

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico'])

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon'
}

function extOf(path: string): string {
  const i = path.lastIndexOf('.')
  return i === -1 ? '' : path.slice(i + 1).toLowerCase()
}

/** Classifies a file by extension, to decide how the editor opens/previews it. */
export function fileKind(path: string): FileKind {
  const ext = extOf(path)
  if (ext === 'html' || ext === 'htm') return 'html'
  if (ext === 'svg') return 'svg'
  if (IMAGE_EXT.has(ext)) return 'image'
  return 'markdown'
}

/** MIME type for a raster image extension, used to build a data: URL. */
export function imageMime(path: string): string {
  return MIME_BY_EXT[extOf(path)] ?? 'application/octet-stream'
}
