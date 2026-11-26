/*
 * Sub- and superscript: how they look and how they are saved. Shared by the
 * editor's Text tool and chart text (apps/editor text-style.ts, chart-text.ts)
 * and the chart text field here, so all of them draw and store them the same.
 *
 * Saved as Fabric's style runs (`{ start, end, style }`, as Fabric's
 * `util.stylesToArray` writes them: characters counted without line breaks),
 * keeping only `script`. The text itself stays a plain string beside them.
 */
export type Script = 'none' | 'sub' | 'super'

/** How much smaller sub- and superscripts are, and how far they move (as a share of the text size; down is positive). */
export const SCRIPT_SCALE = 0.62
export const SCRIPT_SHIFT: Record<Exclude<Script, 'none'>, number> = { sub: 0.22, super: -0.36 }

/** One run of sub- or superscript characters. */
export type ScriptRun = { start: number; end: number; style: { script: Exclude<Script, 'none'> } }

/** Each character's script (line breaks are plain), counting characters as the runs do: without the line breaks. */
export function scriptsOf(text: string, runs: readonly ScriptRun[] | undefined): Script[] {
  let index = 0
  return [...text].map((char) => {
    if (char === '\n') return 'none'
    const at = index++
    return runs?.find((run) => run.start <= at && at < run.end)?.style.script ?? 'none'
  })
}

/** The runs for each character's script, or undefined when there are none. */
export function runsOf(text: string, scripts: readonly Script[]): ScriptRun[] | undefined {
  const runs: ScriptRun[] = []
  let index = 0
  ;[...text].forEach((char, i) => {
    if (char === '\n') return
    const script = scripts[i] ?? 'none'
    const last = runs.at(-1)
    if (script !== 'none') {
      if (last && last.end === index && last.style.script === script) last.end++
      else runs.push({ start: index, end: index + 1, style: { script } })
    }
    index++
  })
  return runs.length ? runs : undefined
}
