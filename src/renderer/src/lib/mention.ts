/**
 * If the caret sits inside an "@token" (a file reference being typed), return
 * where the "@" starts and the token so far. Returns null otherwise.
 *
 * The "@" must start a word (be at the start or follow whitespace) so it
 * doesn't trigger inside emails or mid-word. The token runs to the caret and
 * ends at the first whitespace.
 */
export function detectMention(
  value: string,
  caret: number
): { start: number; query: string } | null {
  let i = caret - 1
  while (i >= 0) {
    const ch = value[i]
    if (ch === '@') {
      const before = i === 0 ? ' ' : value[i - 1]
      return /\s/.test(before) ? { start: i, query: value.slice(i + 1, caret) } : null
    }
    if (/\s/.test(ch)) return null
    i--
  }
  return null
}
