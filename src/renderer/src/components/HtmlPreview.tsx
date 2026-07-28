interface Props {
  content: string
}

/**
 * Renders raw HTML/SVG source in a sandboxed iframe — bypasses the markdown
 * pipeline entirely, so a full document (or an SVG infographic) renders as
 * intended instead of being run through the markdown parser.
 */
export default function HtmlPreview({ content }: Props): React.JSX.Element {
  return (
    <iframe
      className="html-preview"
      srcDoc={content}
      sandbox="allow-scripts"
      title="Preview"
    />
  )
}
