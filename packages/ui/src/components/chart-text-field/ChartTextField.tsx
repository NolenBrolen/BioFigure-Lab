/*
 * Chart text field (BIO-69, design B picked 2026-11-24): a text field for a
 * chart's name, axis titles, unit and caption that shows sub- and
 * superscripts as the chart draws them, smaller and lower (or higher), right
 * in the field. An Ω button beside it opens a popup with Subscript,
 * Superscript and every symbol, like the Text tool's ⋯ menu.
 *
 * Text is saved as the editor saves it (lib/script-runs.ts): a plain string
 * plus Fabric-style runs of sub- and superscript characters.
 *
 * - Ctrl/⌘+= makes the selected letters subscript and Ctrl/⌘+Shift+=
 *   superscript, as in the Text tool; again turns it off. With nothing
 *   selected it switches the next letters typed. New letters take the look of
 *   the letter before them.
 * - The popup stays open while symbols are picked, so several can go in a
 *   row; each goes in where the cursor was, and the picked letters stay
 *   marked in the field. Escape or a click outside closes it (Escape goes
 *   back to typing).
 * - Ctrl/⌘+Z and Ctrl/⌘+Shift+Z (or Ctrl+Y) undo and redo inside the field.
 * - `multiline` (the caption): Enter starts a new line, Ctrl/⌘+Enter finishes.
 *   One line: Enter finishes. Long text scrolls to keep the cursor in view.
 *
 * Built on a contentEditable box: typing, pasting and new lines are handled
 * here (so new letters get a known look); deleting and IME input are left to
 * the browser and read back from the box.
 */
import { Omega } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { useExpandedControls } from '../../lib/expanded-controls'
import { runsOf, SCRIPT_SCALE, SCRIPT_SHIFT, scriptsOf, type Script, type ScriptRun } from '../../lib/script-runs'
import { IconButton } from '../icon-button/IconButton'
import { Popover } from '../popover/Popover'
import { SYMBOLS } from '../text-controls/TextControls'
import { inputBoxClass } from '../text-field/TextField'
import { Tooltip } from '../tooltip/Tooltip'

export type ScriptText = { text: string; runs?: ScriptRun[] }

export type ChartTextFieldProps = {
  value: ScriptText
  /** Every change while typing. */
  onChange: (value: ScriptText) => void
  /** Typing finished: the field (and its popup) was left, or Enter pressed. */
  onDone?: () => void
  /** For screen readers, e.g. "Chart name". */
  label: string
  placeholder?: string
  /** Several lines: Enter starts a new line, Ctrl/⌘+Enter finishes. */
  multiline?: boolean
  /** Height of a multiline field, in lines; longer text scrolls. */
  rows?: number
  className?: string
}

type On = Exclude<Script, 'none'>
type Range = { start: number; end: number }
type Entry = { value: ScriptText; selection: Range }
type EditKind = 'type' | 'delete' | 'other'

/** Typing or deleting within this long of the last change is one undo step. */
const UNDO_PAUSE = 1000
const HIGHLIGHT = 'chart-text-kept'

/** How a sub- or superscript looks in the field: the Text tool's size and shift, in the field's own text size. */
export const scriptStyle = (script: On) => ({ fontSize: `${SCRIPT_SCALE}em`, verticalAlign: `${(-SCRIPT_SHIFT[script] / SCRIPT_SCALE).toFixed(3)}em` })

const sameText = (a: ScriptText, b: ScriptText) => a.text === b.text && JSON.stringify(a.runs ?? []) === JSON.stringify(b.runs ?? [])

/** The text nodes of the box, in order, each with the script of the part it sits in. */
function textNodes(root: HTMLElement): { node: Text; script: Script }[] {
  const out: { node: Text; script: Script }[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const script = (node.parentElement?.closest('[data-script]') as HTMLElement | null)?.dataset.script
    out.push({ node: node as Text, script: script === 'sub' || script === 'super' ? script : 'none' })
  }
  return out
}

/** What the box holds now, letter by letter. */
function readBox(root: HTMLElement, multiline: boolean): { chars: string[]; scripts: Script[] } {
  const chars: string[] = []
  const scripts: Script[] = []
  for (const { node, script } of textNodes(root)) {
    for (const char of node.data) {
      if (char === '\n' && !multiline) continue
      chars.push(char)
      scripts.push(char === '\n' ? 'none' : script)
    }
  }
  return { chars, scripts }
}

const codePoints = (text: string) => [...text].length

/** A DOM point as a letter index (counting letters, not UTF-16 units). */
function indexOf(root: HTMLElement, container: Node, offset: number): number {
  let index = 0
  for (const { node } of textNodes(root)) {
    if (node === container) return index + codePoints(node.data.slice(0, offset))
    // A point between elements: count the text before it.
    if (container !== node && container.contains(node)) {
      const position = container.childNodes[offset]
      if (position && (position === node || position.contains(node) || (position.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)) return index
    }
    index += codePoints(node.data)
  }
  return index
}

function readSelection(root: HTMLElement): Range | undefined {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return undefined
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return undefined
  return { start: indexOf(root, range.startContainer, range.startOffset), end: indexOf(root, range.endContainer, range.endOffset) }
}

function pointAt(root: HTMLElement, index: number): [Node, number] {
  let left = index
  const nodes = textNodes(root)
  for (const { node } of nodes) {
    const chars = [...node.data]
    if (left <= chars.length) return [node, chars.slice(0, left).join('').length]
    left -= chars.length
  }
  const last = nodes.at(-1)?.node
  return last ? [last, last.data.length] : [root, 0]
}

function domRange(root: HTMLElement, range: Range): globalThis.Range {
  const [startNode, startOffset] = pointAt(root, Math.min(range.start, range.end))
  const [endNode, endOffset] = pointAt(root, Math.max(range.start, range.end))
  const next = document.createRange()
  next.setStart(startNode, startOffset)
  next.setEnd(endNode, endOffset)
  return next
}

function writeSelection(root: HTMLElement, range: Range): void {
  const selection = window.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  selection.addRange(domRange(root, range))
}

/** Scroll a one-line field sideways (or a multiline one up and down) so the cursor shows. */
function keepCaretInView(root: HTMLElement): void {
  const selection = window.getSelection()
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : undefined
  if (!range || typeof range.getBoundingClientRect !== 'function') return
  const caret = range.getBoundingClientRect()
  if (caret.width === 0 && caret.height === 0) return
  const box = root.getBoundingClientRect()
  const room = 4
  if (caret.right > box.right - room) root.scrollLeft += caret.right - box.right + room
  else if (caret.left < box.left + room) root.scrollLeft -= box.left + room - caret.left
  if (caret.bottom > box.bottom) root.scrollTop += caret.bottom - box.bottom
  else if (caret.top < box.top) root.scrollTop -= box.top - caret.top
}

/** Fill the box with the text, one element per stretch of plain, sub- or superscript letters. */
function render(root: HTMLElement, chars: readonly string[], scripts: readonly Script[], multiline: boolean): void {
  root.replaceChildren()
  let i = 0
  while (i < chars.length) {
    const script = scripts[i] ?? 'none'
    let j = i
    while (j < chars.length && (scripts[j] ?? 'none') === script) j++
    const part = document.createElement('span')
    part.dataset.script = script
    if (script !== 'none') Object.assign(part.style, scriptStyle(script))
    part.textContent = chars.slice(i, j).join('')
    root.append(part)
    i = j
  }
  // A line break at the very end only shows as a new line with something after it.
  if (multiline && chars.at(-1) === '\n') root.append(document.createElement('br'))
}

/** Highlight the letters picked in the field while focus is in the popup (where the browser hides the selection). */
function markKept(root: HTMLElement | null, range: Range | undefined): void {
  const highlights = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights
  const Highlight = (globalThis as { Highlight?: new (...ranges: globalThis.Range[]) => unknown }).Highlight
  if (!highlights || !Highlight) return
  if (!root || !range || range.start === range.end) highlights.delete(HIGHLIGHT)
  else highlights.set(HIGHLIGHT, new Highlight(domRange(root, range)))
}

/** A tile or symbol in the popup. It acts on the field without taking the focus from the popup. */
function PopupButton({ label, shortcut, pressed, onPress, children, className, named = false }: { label: string; shortcut?: string; pressed?: boolean; onPress: () => void; children: ReactNode; className?: string; named?: boolean }) {
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <button
        type="button"
        // A tile that shows its name is read by it; a symbol by its name ("micro").
        aria-label={named ? undefined : label}
        aria-pressed={pressed}
        onMouseDown={(event: MouseEvent) => event.preventDefault()}
        onClick={onPress}
        className={cn(
          'grid shrink-0 place-items-center rounded-sm text-foreground transition-colors duration-(--duration-instant) hover:bg-muted',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
          pressed && 'bg-primary-subtle text-primary-subtle-foreground hover:bg-primary-subtle-hover',
          className,
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

export function ChartTextField({ value, onChange, onDone, label, placeholder, multiline = false, rows = 3, className }: ChartTextFieldProps) {
  const wrapper = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  /** The selection, kept while focus is in the popup, so its buttons act where the cursor was. */
  const selection = useRef<Range>({ start: 0, end: 0 })
  /** The look of the next letters typed, after Ctrl+= or a tile with nothing selected. */
  const [pending, setPending] = useState<Script | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [tick, redraw] = useState(0)
  const [focused, setFocused] = useState(false)
  /** Where the small cursor sits that shows the next letters will be sub- or superscript. */
  const [modeCaret, setModeCaret] = useState<{ left: number; top: number; height: number } | undefined>(undefined)
  const composing = useRef(false)
  /** Put the kept selection back when the field next gets focus (after the popup). */
  const restore = useRef(false)
  const history = useRef<{ undo: Entry[]; redo: Entry[]; last: ScriptText; kind: EditKind; at: number }>({ undo: [], redo: [], last: value, kind: 'other', at: 0 })
  const expanded = useExpandedControls()
  const chars = [...value.text]
  const scripts = scriptsOf(value.text, value.runs)

  // The box shows the value. Drawn again only when it differs, so typing in place (and IME input) isn't disturbed.
  useLayoutEffect(() => {
    const root = box.current
    if (!root || composing.current) return
    // A change from outside (another field, the chart's own undo) starts the field's undo afresh.
    if (!sameText(value, history.current.last)) history.current = { undo: [], redo: [], last: value, kind: 'other', at: 0 }
    const want = { chars: [...value.text], scripts: scriptsOf(value.text, value.runs) }
    const has = readBox(root, multiline)
    const same = has.chars.join('') === want.chars.join('') && has.scripts.every((s, i) => s === want.scripts[i]) && (!multiline || value.text.at(-1) !== '\n' || root.lastChild?.nodeName === 'BR')
    if (!same) {
      render(root, want.chars, want.scripts, multiline)
      if (document.activeElement === root) {
        writeSelection(root, selection.current)
        keepCaretInView(root)
      }
    }
    if (open) markKept(root, selection.current)
  }, [value, multiline, open])

  useEffect(() => () => markKept(null, undefined), [])

  /** Keep the selection up to date while the field has focus. */
  const noteSelection = useCallback(() => {
    const root = box.current
    if (!root || document.activeElement !== root) return
    const range = readSelection(root)
    if (!range) return
    const moved = range.start !== selection.current.start || range.end !== selection.current.end
    selection.current = range
    keepCaretInView(root)
    if (moved) redraw((n) => n + 1)
  }, [])
  useEffect(() => {
    document.addEventListener('selectionchange', noteSelection)
    return () => document.removeEventListener('selectionchange', noteSelection)
  }, [noteSelection])

  /** The selection edits act on: the field's own while it has focus, else the one kept. */
  const live = () => {
    noteSelection()
    const { start, end } = selection.current
    const length = chars.length
    return { lo: Math.min(Math.min(start, end), length), hi: Math.min(Math.max(start, end), length) }
  }

  const emit = (nextChars: readonly string[], nextScripts: readonly Script[], range: Range, kind: EditKind) => {
    const text = nextChars.join('')
    const next: ScriptText = { text, runs: runsOf(text, nextScripts) }
    const before: Entry = { value, selection: selection.current }
    selection.current = range
    if (sameText(next, value)) return redraw((n) => n + 1)
    const h = history.current
    const now = Date.now()
    // Typing (or deleting) straight on is one undo step; anything else is a step of its own.
    if (!(kind !== 'other' && kind === h.kind && now - h.at < UNDO_PAUSE)) h.undo.push(before)
    h.redo = []
    h.kind = kind
    h.at = now
    h.last = next
    onChange(next)
  }

  const travel = (from: 'undo' | 'redo') => {
    const h = history.current
    const entry = h[from].pop()
    if (!entry) return
    h[from === 'undo' ? 'redo' : 'undo'].push({ value, selection: selection.current })
    h.kind = 'other'
    h.last = entry.value
    selection.current = entry.selection
    onChange(entry.value)
  }

  /** Look the buttons show as on: of the picked letters, or of the next letters typed. */
  const { start, end } = selection.current
  const lo = Math.min(start, end)
  const hi = Math.max(start, end)
  const active: Script = pending ?? (hi > lo ? (scripts.slice(lo, hi).every((s) => s === scripts[lo]) ? (scripts[lo] ?? 'none') : 'none') : chars[lo - 1] === '\n' ? 'none' : (scripts[lo - 1] ?? 'none'))

  // With the cursor in sub- or superscript mode (switched on, or after such letters), it is drawn small and lowered or raised, as the next letters will be.
  const collapsed = selection.current.start === selection.current.end
  useLayoutEffect(() => {
    const root = box.current
    const outer = root?.parentElement
    if (!root || !outer || !focused || active === 'none' || !collapsed) return setModeCaret(undefined)
    const base = Number.parseFloat(getComputedStyle(root).fontSize) || 13
    const range = domRange(root, selection.current)
    const rect = typeof range.getClientRects === 'function' ? range.getClientRects()[0] : undefined
    const field = root.getBoundingClientRect()
    const frame = outer.getBoundingClientRect()
    const x = rect && (rect.left || rect.height) ? rect.left : field.left
    const middle = multiline && rect?.height ? rect.top + rect.height / 2 : field.top + field.height / 2
    const height = base * SCRIPT_SCALE * 1.25
    const next = { left: x - frame.left, top: middle + base * SCRIPT_SHIFT[active] * 0.8 - height / 2 - frame.top, height }
    setModeCaret((was) => (was && was.left === next.left && was.top === next.top && was.height === next.height ? was : next))
  }, [active, collapsed, focused, multiline, tick, value])

  const insert = (text: string, kind: EditKind) => {
    const { lo, hi } = live()
    const added = [...(multiline ? text.replace(/\r\n?/g, '\n') : text.replace(/[\r\n]+/g, ' '))]
    const look = pending ?? (chars[lo - 1] === '\n' ? 'none' : (scripts[lo - 1] ?? 'none'))
    setPending(undefined)
    const at = lo + added.length
    emit([...chars.slice(0, lo), ...added, ...chars.slice(hi)], [...scripts.slice(0, lo), ...added.map((c) => (c === '\n' ? 'none' : look)), ...scripts.slice(hi)], { start: at, end: at }, kind)
  }

  /**
   * Sub- or superscript on (or off again). With letters picked, they change;
   * with none, the next letters typed take it. From the popup's tiles
   * (`fromPopup`), the popup then closes and typing goes on in the field.
   */
  const toggle = (script: On, fromPopup = false) => {
    const { lo, hi } = live()
    if (hi === lo) {
      const current = pending ?? (chars[lo - 1] === '\n' ? 'none' : (scripts[lo - 1] ?? 'none'))
      setPending(current === script ? 'none' : script)
    } else {
      const next: Script = scripts.slice(lo, hi).every((s) => s === script) ? 'none' : script
      emit(chars, scripts.map((s, i) => (i >= lo && i < hi && chars[i] !== '\n' ? next : s)), { start: lo, end: hi }, 'other')
    }
    if (fromPopup) backToField()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    // The editor's own shortcuts (Delete removes the chart, Ctrl+Z its undo) stay out of the field.
    event.stopPropagation()
    const mod = (event.ctrlKey || event.metaKey) && !event.altKey
    const key = event.key.toLowerCase()
    if (mod && (key === '=' || key === '+' || event.code === 'Equal')) {
      event.preventDefault()
      return toggle(event.shiftKey || key === '+' ? 'super' : 'sub')
    }
    if (mod && (key === 'z' || key === 'y')) {
      event.preventDefault()
      return travel(key === 'y' || event.shiftKey ? 'redo' : 'undo')
    }
    if (event.key === 'Enter' && (!multiline || mod)) {
      event.preventDefault()
      return box.current?.blur()
    }
    if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') setPending(undefined)
  }

  const onBeforeInput = (event: InputEvent) => {
    const type = event.inputType
    if (type === 'insertText' && event.data) {
      event.preventDefault()
      insert(event.data, 'type')
    } else if (type === 'insertParagraph' || type === 'insertLineBreak') {
      event.preventDefault()
      if (multiline) insert('\n', 'other')
    } else if (type.startsWith('insertFrom')) {
      event.preventDefault()
      insert(event.dataTransfer?.getData('text/plain') ?? event.data ?? '', 'other')
    } else if (type === 'historyUndo' || type === 'historyRedo') {
      event.preventDefault()
      travel(type === 'historyUndo' ? 'undo' : 'redo')
    } else if (type.startsWith('format')) event.preventDefault()
  }

  // Deleting and IME input the browser made: read the box back.
  const readBack = () => {
    const root = box.current
    if (!root || composing.current) return
    const { chars: nextChars, scripts: nextScripts } = readBox(root, multiline)
    emit(nextChars, nextScripts, readSelection(root) ?? { start: nextChars.length, end: nextChars.length }, 'delete')
  }

  // React's onBeforeInput doesn't carry inputType, so it's listened to directly.
  const beforeInput = useRef(onBeforeInput)
  beforeInput.current = onBeforeInput
  useEffect(() => {
    const root = box.current
    if (!root) return
    const listener = (event: Event) => beforeInput.current(event as InputEvent)
    root.addEventListener('beforeinput', listener)
    return () => root.removeEventListener('beforeinput', listener)
  }, [])

  /** Leaving the field and its popup finishes typing. */
  const onBlur = (event: FocusEvent) => {
    const to = event.relatedTarget as Node | null
    if (open || (to && wrapper.current?.contains(to))) return
    setPending(undefined)
    onDone?.()
  }

  const onOpenChange = (next: boolean) => {
    if (next) {
      // Focus is about to go into the popup: keep the picked letters, and show them.
      noteSelection()
      markKept(box.current, selection.current)
    } else {
      // Only our own way back to the field puts the kept cursor back; a click into the field sets its own.
      restore.current = false
      markKept(null, undefined)
      if (document.activeElement !== box.current) onDone?.()
    }
    setOpen(next)
  }

  /**
   * Keys while the popup is open stay with it (they reach here through React's
   * tree, also from the popup): the editor's own Escape (let go of the chart)
   * and Delete must not act. Escape closes it and goes back to typing where
   * the cursor was.
   */
  const onPopupKey = (event: KeyboardEvent) => {
    if (open) event.stopPropagation()
  }
  // Escape is caught before anything else sees it (the popup's own handling sends focus to the Ω button, the editor's lets go of the chart).
  const closeRef = useRef(() => {})
  /** Close the popup and go on typing in the field, where the cursor (or the picked letters) were. */
  function backToField() {
    onOpenChange(false)
    restore.current = true
    requestAnimationFrame(() => box.current?.focus())
  }
  closeRef.current = backToField
  useEffect(() => {
    if (!open) return
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || (event.target instanceof Node && box.current?.contains(event.target))) return
      event.stopPropagation()
      event.preventDefault()
      closeRef.current()
    }
    window.addEventListener('keydown', onEscape, true)
    return () => window.removeEventListener('keydown', onEscape, true)
  }, [open])

  const lineHeight = 1.45
  return (
    <div ref={wrapper} onBlur={onBlur} onKeyDown={onPopupKey} className={cn('flex min-w-0 gap-1.5', multiline ? 'items-start' : 'items-center', expanded && 'flex-wrap', className)}>
      <div
        className={cn(inputBoxClass, 'relative min-w-0 flex-1', multiline && 'h-auto items-start py-1', expanded && !multiline && 'h-11 px-3')}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault()
            box.current?.focus()
          }
        }}
      >
        <div
          ref={box}
          role="textbox"
          aria-label={label}
          aria-multiline={multiline}
          aria-placeholder={placeholder}
          contentEditable
          suppressContentEditableWarning
          tabIndex={0}
          spellCheck={false}
          onKeyDown={onKeyDown}
          onKeyUp={noteSelection}
          onMouseUp={noteSelection}
          onInput={readBack}
          onCompositionStart={() => (composing.current = true)}
          onCompositionEnd={() => {
            composing.current = false
            readBack()
          }}
          onMouseDown={() => setPending(undefined)}
          onBlur={() => setFocused(false)}
          onFocus={() => {
            setFocused(true)
            markKept(null, undefined)
            const root = box.current
            if (restore.current && root) {
              restore.current = false
              writeSelection(root, selection.current)
            }
            // The click that gave focus set the cursor before focus arrived.
            requestAnimationFrame(noteSelection)
          }}
          style={{ ...(multiline ? { lineHeight, height: `${rows * lineHeight}em` } : {}), ...(modeCaret ? { caretColor: 'transparent' } : {}) }}
          className={cn(
            'min-w-0 flex-1 text-foreground outline-none [scrollbar-width:none]',
            multiline ? 'overflow-y-auto break-words whitespace-pre-wrap' : 'h-full overflow-hidden leading-(--control-height) whitespace-pre',
            expanded && !multiline && 'leading-11',
          )}
        />
        {modeCaret && <span aria-hidden="true" data-mode-caret={active} className="pointer-events-none absolute w-px bg-foreground" style={modeCaret} />}
        {!value.text && <span className={cn('pointer-events-none absolute left-2 text-muted-foreground', multiline ? 'top-1' : '', expanded && 'left-3')}>{placeholder}</span>}
      </div>
      <Popover
        title="Format and symbols"
        side="right"
        align="start"
        className="w-76"
        open={open}
        onOpenChange={onOpenChange}
        // A click elsewhere leaves focus where it landed; Escape (caught above) goes back to typing.
        finalFocus={false}
        trigger={<IconButton icon={Omega} label={`Subscript, superscript and symbols for ${label.toLowerCase()}`} pressed={open} />}
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-1.5">
            <PopupButton label="Subscript" shortcut="Mod+=" pressed={active === 'sub'} onPress={() => toggle('sub', true)} named className="h-14 flex-col gap-1 border text-xs">
              <span aria-hidden="true" className="text-base">
                x<span style={scriptStyle('sub')}>2</span>
              </span>
              Subscript
            </PopupButton>
            <PopupButton label="Superscript" shortcut="Mod+Shift+=" pressed={active === 'super'} onPress={() => toggle('super', true)} named className="h-14 flex-col gap-1 border text-xs">
              <span aria-hidden="true" className="text-base">
                x<span style={scriptStyle('super')}>2</span>
              </span>
              Superscript
            </PopupButton>
          </div>
          <div role="group" aria-label="Symbols" className="grid grid-cols-10 gap-0.5">
            {SYMBOLS.map(([char, name]) => (
              <PopupButton key={char} label={name} onPress={() => insert(char, 'other')} className="h-7 text-sm">
                {char}
              </PopupButton>
            ))}
          </div>
        </div>
      </Popover>
    </div>
  )
}
