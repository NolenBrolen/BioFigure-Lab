/**
 * How much memory all undo histories together may hold (every slide has its
 * own). Each step is a whole copy of the slide as text, and a slide full of
 * pencil icons is about 11 MB, so 200 steps could crash the tab. Past the
 * budget, the oldest steps of the history holding the most go first; every
 * history keeps at least one step to undo.
 */
export class HistoryBudget {
  private readonly histories = new Set<WeakRef<History>>()
  readonly maxChars: number

  constructor(maxChars: number) {
    this.maxChars = maxChars
  }

  add(history: History): void {
    this.histories.add(new WeakRef(history))
  }

  fit(): void {
    const live: History[] = []
    for (const ref of this.histories) {
      const history = ref.deref()
      if (history) live.push(history)
      else this.histories.delete(ref)
    }
    let total = live.reduce((sum, history) => sum + history.size, 0)
    while (total > this.maxChars) {
      const biggest = live.filter((history) => history.canForget).sort((a, b) => b.size - a.size)[0]
      if (!biggest) break
      total -= biggest.forgetOldest()
    }
  }
}

/** About 120 million characters: roughly 120-240 MB, depending on the text. */
export const sharedHistoryBudget = new HistoryBudget(120_000_000)

/**
 * Undo and redo, as a list of saved states of the figure. Each state is the
 * figure as text (Fabric's JSON). Quick changes to the same thing, such as
 * dragging the opacity slider, are merged into one step so one Undo undoes
 * the whole drag. At most `limit` steps, and all histories together stay
 * within their memory budget.
 */
export class History {
  private states: string[]
  private index = 0
  /** Characters held by all states. */
  size: number
  private readonly budget: HistoryBudget
  private lastKey: string | undefined
  private lastTime = 0
  private readonly limit: number
  private readonly mergeWindowMs: number

  constructor(initial: string, limit = 200, mergeWindowMs = 800, budget = sharedHistoryBudget) {
    this.states = [initial]
    this.size = initial.length
    this.limit = limit
    this.mergeWindowMs = mergeWindowMs
    this.budget = budget
    budget.add(this)
  }

  /** Whether the oldest step can go and still leave one step to undo. */
  get canForget(): boolean {
    return this.index > 1
  }

  /** Drop the oldest step; returns how many characters that freed. */
  forgetOldest(): number {
    const dropped = this.states.shift()?.length ?? 0
    this.index--
    this.size -= dropped
    return dropped
  }

  get current(): string {
    return this.states.at(this.index) ?? ''
  }

  get canUndo(): boolean {
    return this.index > 0
  }

  get canRedo(): boolean {
    return this.index < this.states.length - 1
  }

  /**
   * Record a new state. Pass a `mergeKey` (e.g. "opacity") to merge it into the
   * previous step when that step had the same key and came moments ago.
   */
  push(state: string, mergeKey?: string, now = Date.now()): void {
    if (state === this.current) return
    const merge =
      mergeKey !== undefined && mergeKey === this.lastKey && now - this.lastTime < this.mergeWindowMs && this.index > 0 && !this.canRedo
    for (const dropped of this.states.splice(this.index + 1)) this.size -= dropped.length
    if (merge) {
      this.size += state.length - this.current.length
      this.states[this.index] = state
    } else {
      this.states.push(state)
      this.size += state.length
      this.index++
      if (this.states.length > this.limit) this.forgetOldest()
    }
    this.lastKey = mergeKey
    this.lastTime = now
    this.budget.fit()
  }

  undo(): string | undefined {
    if (!this.canUndo) return undefined
    this.index--
    this.lastKey = undefined
    return this.current
  }

  redo(): string | undefined {
    if (!this.canRedo) return undefined
    this.index++
    this.lastKey = undefined
    return this.current
  }
}
