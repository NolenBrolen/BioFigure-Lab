/**
 * Whether an item matches what was typed in a search field. Every word typed
 * must appear at the start of a word in one of the item's texts, ignoring case,
 * so "red cell" finds "Red blood cell".
 */
export function matchesSearch(query: string, texts: string[]): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const itemWords = texts.flatMap((text) => text.toLowerCase().split(/[\s-]+/))
  return words.every((word) => itemWords.some((itemWord) => itemWord.startsWith(word)))
}
