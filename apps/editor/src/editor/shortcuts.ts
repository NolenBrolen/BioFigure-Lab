/** What a key press does in the editor, so all the keys live in one place. */
import type { Tool } from './shapes'

export type EditorAction =
  | { type: 'tool'; tool: Tool }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'delete' }
  | { type: 'zoom-in' }
  | { type: 'zoom-out' }
  | { type: 'zoom-fit' }
  | { type: 'escape' }
  | { type: 'bring-to-front' }
  | { type: 'send-to-back' }
  | { type: 'bring-forward' }
  | { type: 'send-backward' }
  | { type: 'lock' }
  | { type: 'select-all' }
  | { type: 'duplicate' }
  | { type: 'copy' }
  | { type: 'cut' }
  | { type: 'paste' }
  | { type: 'group' }
  | { type: 'ungroup' }
  | { type: 'previous-slide' }
  | { type: 'next-slide' }

export type KeyPress = { key: string; code?: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }

const toolKeys: Record<string, Tool> = { v: 'select', r: 'rectangle', o: 'ellipse', l: 'line', a: 'arrow', t: 'text' }

export function actionForKey(event: KeyPress): EditorAction | undefined {
  const mod = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()
  if (mod) {
    if (key === 'z') return event.shiftKey ? { type: 'redo' } : { type: 'undo' }
    if (key === 'y') return { type: 'redo' }
    if (key === '=' || key === '+') return { type: 'zoom-in' }
    if (key === '-') return { type: 'zoom-out' }
    // Shift+] types "}" on most keyboards, so the key's position counts here.
    if (event.shiftKey && event.code === 'BracketRight') return { type: 'bring-forward' }
    if (event.shiftKey && event.code === 'BracketLeft') return { type: 'send-backward' }
    if (event.shiftKey && key === 'l') return { type: 'lock' }
    if (key === ']') return { type: 'bring-to-front' }
    if (key === '[') return { type: 'send-to-back' }
    if (key === 'g') return event.shiftKey ? { type: 'ungroup' } : { type: 'group' }
    if (event.shiftKey) return undefined
    if (key === 'd') return { type: 'duplicate' }
    if (key === 'c') return { type: 'copy' }
    if (key === 'x') return { type: 'cut' }
    if (key === 'v') return { type: 'paste' }
    if (key === 'a') return { type: 'select-all' }
    return undefined
  }
  if (event.altKey) return undefined
  // Shift+1 types "!" on most keyboards, so the key's position counts too.
  if (event.shiftKey && (event.code === 'Digit1' || key === '1' || key === '!')) return { type: 'zoom-fit' }
  if (key === 'delete' || key === 'backspace') return { type: 'delete' }
  if (key === 'escape') return { type: 'escape' }
  if (key === 'pageup') return { type: 'previous-slide' }
  if (key === 'pagedown') return { type: 'next-slide' }
  const tool = event.shiftKey ? undefined : toolKeys[key]
  return tool ? { type: 'tool', tool } : undefined
}

/** Keys that style text: bold, italic and underline, and sub- and superscript while typing. */
export type TextKeyAction = 'bold' | 'italic' | 'underline' | 'subscript' | 'superscript'

/**
 * The text styling a key press asks for. Sub- and superscript (Mod+= and
 * Mod+Shift+=, as in word processors) only count while typing in text, since
 * outside it Mod+= zooms in.
 */
export function textActionForKey(event: KeyPress, typing: boolean): TextKeyAction | undefined {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return undefined
  const key = event.key.toLowerCase()
  // Shift+= types "+" on most keyboards, so the key's position counts too.
  if (typing && (key === '=' || key === '+' || event.code === 'Equal')) return event.shiftKey || key === '+' ? 'superscript' : 'subscript'
  if (event.shiftKey) return undefined
  if (key === 'b') return 'bold'
  if (key === 'i') return 'italic'
  if (key === 'u') return 'underline'
  return undefined
}

/** Ctrl+Enter (⌘+Enter on a Mac) while typing in a text box: stop typing, as a click beside it does. */
export const finishesTyping = (event: KeyPress): boolean => (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key === 'Enter'
