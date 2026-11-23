/*
 * Lines of a label's text, for the "Lines" tiles in the icon panel: how many
 * lines the text has, and the same words laid out over a chosen number of lines.
 */

/** The most lines the tiles offer. */
export const MAX_LABEL_LINES = 4

/** How many lines the text has: lines you typed, counting an empty text as one. */
export function lineCount(text: string): number {
  return text.split('\n').length
}

/** How many words the text has, which is the most lines it can be spread over. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/**
 * The text's words spread over `lines` lines, as evenly as possible (the
 * longest line as short as it can be), words never split. With fewer words than
 * lines, each word gets its own line and empty lines are added above and below,
 * so the text stays in the middle. Old line breaks are ignored.
 */
export function wrapIntoLines(text: string, lines: number): string {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const wanted = Math.max(1, Math.floor(lines))
  const count = Math.min(wanted, words.length)
  // best[k][i]: the shortest possible longest line when the first i words fill k lines.
  const width = (from: number, to: number) => words.slice(from, to).join(' ').length
  const table = (fill: number) => Array.from({ length: count + 1 }, () => Array<number>(words.length + 1).fill(fill))
  const best = table(Infinity)
  const cut = table(0)
  const at = (grid: number[][], k: number, i: number) => grid[k]?.[i] ?? 0
  best[0] = best[0]?.map((_, i) => (i === 0 ? 0 : Infinity)) ?? []
  for (let k = 1; k <= count; k++) {
    for (let i = k; i <= words.length; i++) {
      for (let j = k - 1; j < i; j++) {
        const longest = Math.max(at(best, k - 1, j), width(j, i))
        if (longest < at(best, k, i)) {
          const row = best[k]
          const cutRow = cut[k]
          if (row && cutRow) {
            row[i] = longest
            cutRow[i] = j
          }
        }
      }
    }
  }
  const result: string[] = []
  let end = words.length
  for (let k = count; k >= 1; k--) {
    const start = at(cut, k, end)
    result.unshift(words.slice(start, end).join(' '))
    end = start
  }
  const spare = wanted - count
  const above = Math.floor(spare / 2)
  return [...Array<string>(above).fill(''), ...result, ...Array<string>(spare - above).fill('')].join('\n')
}

/**
 * The text with new lines at the end up to `lines` lines, each holding "Line 2",
 * "Line 3" and so on, so they show on the icon at once. What is written stays
 * as it is; an empty line gets its placeholder too.
 */
export function addLines(text: string, lines: number): string {
  const result = text.split('\n')
  while (result.length < lines) result.push('')
  return result.map((line, i) => (line.trim() === '' ? `Line ${i + 1}` : line)).join('\n')
}

/** The line placeholders ("Line 2") added by `addLines` that nobody typed over, taken out. */
function withoutPlaceholders(text: string): string {
  return text
    .split('\n')
    .filter((line) => !/^Line \d+$/.test(line.trim()))
    .join('\n')
}

/** What the Lines tiles remember while you only click them: the text for each line count, and the text the last click made. */
export type LineMemory = { texts: Map<number, string>; last: string }

export const newLineMemory = (): LineMemory => ({ texts: new Map(), last: '' })

/**
 * The text after picking `lines` lines. More lines add placeholders to what is
 * written; fewer lines re-wrap the words evenly (placeholders nobody typed over
 * are dropped). While you only click the tiles, going back to a line count
 * you already had gives that text back, so wrapped text unwraps again. Editing
 * the text starts the memory over.
 */
export function changeLineCount(text: string, lines: number, memory: LineMemory): string {
  if (text !== memory.last) {
    memory.texts.clear()
    memory.texts.set(lineCount(text), text)
  }
  const current = lineCount(text)
  let result = memory.texts.get(lines)
  if (result === undefined) {
    if (lines === current) result = text
    else if (lines > current) result = addLines(text, lines)
    else result = addLines(wrapIntoLines(withoutPlaceholders(text), lines), lines)
  }
  memory.texts.set(lines, result)
  memory.last = result
  return result
}
