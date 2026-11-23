/*
 * Step maths for the slider. The handle follows the pointer smoothly while
 * dragging, but the value it reports always lands on an allowed step
 * (1 %, 0.25 pt, ...). These helpers do that rounding.
 */

export type Steps = { min: number; max: number; step: number; largeStep: number }

/** How many decimals a step has: 0.25 → 2, 1 → 0. */
export function decimalsOf(step: number) {
  const text = String(step)
  return text.includes('.') ? text.length - text.indexOf('.') - 1 : 0
}

/** Rounds to the nearest allowed step, inside min and max, without float noise (0.30000000000000004). */
export function snap(value: number, { min, max, step }: Pick<Steps, 'min' | 'max' | 'step'>) {
  const stepped = Math.round((value - min) / step) * step + min
  const clamped = Math.min(max, Math.max(min, stepped))
  return Number(clamped.toFixed(decimalsOf(step)))
}

/** The slider moves in tiny steps so dragging looks smooth; this is that tiny step. */
export function fineStepOf(step: number) {
  return step / 20
}

/**
 * The value after a key press. The slider underneath moves by the tiny drag
 * step, so this turns its answer into a real step: an arrow key moves one
 * step, Page Up/Down or Shift+arrow one large step, Home/End to the ends.
 */
export function keyboardValue(previous: number, next: number, steps: Steps) {
  if (next <= steps.min || next >= steps.max) return snap(next, steps)
  const moved = next - previous
  const amount = Math.abs(moved) > fineStepOf(steps.step) * 1.5 ? steps.largeStep : steps.step
  return snap(previous + Math.sign(moved) * amount, steps)
}
