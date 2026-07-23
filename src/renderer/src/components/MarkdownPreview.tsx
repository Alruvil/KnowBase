interface Props {
  html: string
}

/** Read-only rendered view of a document's final HTML — no markdown syntax visible. */
export default function MarkdownPreview({ html }: Props): React.JSX.Element {
  return <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: html }} />
}
