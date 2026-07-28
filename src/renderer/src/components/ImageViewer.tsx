import { useEffect, useRef, useState } from 'react'
import Breadcrumb from './Breadcrumb'
import { imageMime } from '../lib/file-kind'

interface Props {
  path: string
  onOpenPrompt: (folderPath: string) => void
}

const MIN_ZOOM = 0.25
const MAX_ZOOM = 8

/** Read-only viewer for raster images (PNG/JPG/GIF/…) — fetched as base64 over IPC. */
interface Size {
  w: number
  h: number
}

export default function ImageViewer({ path, onOpenPrompt }: Props): React.JSX.Element {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [natural, setNatural] = useState<Size | null>(null)
  const [container, setContainer] = useState<Size | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      window.api.readBinaryFile(path).then((base64) => {
        if (!cancelled) setDataUrl(`data:${imageMime(path)};base64,${base64}`)
      })
    }
    setDataUrl(null)
    setNatural(null)
    setZoom(1)
    load()
    const unsubscribe = window.api.onFsChanged(load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [path])

  // Track the viewport so the "fit to pane" baseline stays right across resizes.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setContainer({ w: width, h: height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Ctrl/Cmd + scroll to zoom. Needs a non-passive listener so preventDefault
  // actually stops the browser's own page-zoom on the same gesture.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Zoom by sizing the image's layout box, not by `transform: scale()` — a
  // transform doesn't grow the layout box, so the overflow it creates above the
  // container's top edge is unreachable by scrolling (worse the more you zoom).
  const fitScale =
    natural && container ? Math.min(1, container.w / natural.w, container.h / natural.h) : 1
  const sizeStyle: React.CSSProperties =
    natural && container
      ? { width: natural.w * fitScale * zoom, height: natural.h * fitScale * zoom }
      : { maxWidth: '100%', maxHeight: '100%' }

  return (
    <div className="editor">
      <div className="editor-header">
        <Breadcrumb path={path} onOpenPrompt={onOpenPrompt} />
      </div>
      <div
        className="image-viewer-body"
        ref={bodyRef}
        title="Ctrl/Cmd + scroll to zoom · double-click to reset"
        onDoubleClick={() => setZoom(1)}
      >
        {dataUrl ? (
          <>
            <img
              src={dataUrl}
              alt={path}
              style={sizeStyle}
              onLoad={(e) =>
                setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
              }
            />
            {zoom !== 1 && <span className="image-zoom-badge">{Math.round(zoom * 100)}%</span>}
          </>
        ) : (
          <p className="auth-note dim">Loading…</p>
        )}
      </div>
    </div>
  )
}
