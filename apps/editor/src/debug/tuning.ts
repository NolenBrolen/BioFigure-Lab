import { buttonGroup, useControls } from 'leva'

interface Tuning {
  /** The value the code uses today; picking it again removes the override. */
  now: number
  /** Values to try with one click each. */
  choices: number[]
  /** Slider range for values in between. Defaults to around the choices. */
  min?: number
  max?: number
  step?: number
  unit?: string
}

/**
 * One size to tune by eye: a row of buttons for the choices and a slider,
 * both setting `cssVar` on the page. The feature reads it with
 * `var(cssVar, <current value>)`.
 */
export function useTuning(name: string, cssVar: string, { now, choices, min, max, step = 1, unit = 'px' }: Tuning) {
  const apply = (value: number) => {
    const root = document.documentElement.style
    if (value === now) root.removeProperty(cssVar)
    else root.setProperty(cssVar, `${value}${unit}`)
  }
  // One button per choice; it moves the slider, which applies the value.
  const picks: Record<string, () => void> = Object.fromEntries(choices.map((choice) => [`${choice}`, () => set({ [cssVar]: choice })]))
  const [, set] = useControls(name, () => ({
    [cssVar]: { value: now, min: min ?? Math.min(...choices, now) / 2, max: max ?? Math.max(...choices, now) * 2, step, onChange: apply },
    try: buttonGroup(picks),
  }))
}
