/**
 * Lining objects up: align, distribute and snapping while dragging. Works on
 * plain boxes (what you see of each object, in page pixels), so it can be
 * tested without Fabric. Each function says how far to move each box.
 */
export type Box = { left: number; top: number; width: number; height: number }
export type Move = { dx: number; dy: number }

export type AlignEdge = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom'
export type Axis = 'horizontal' | 'vertical'

/** How close an edge must come to another edge before it snaps, in screen pixels. */
export const SNAP_DISTANCE_PX = 6

/** The smallest box around all the boxes. */
export function boundsOf(boxes: readonly Box[]): Box {
  const left = Math.min(...boxes.map((box) => box.left))
  const top = Math.min(...boxes.map((box) => box.top))
  const right = Math.max(...boxes.map((box) => box.left + box.width))
  const bottom = Math.max(...boxes.map((box) => box.top + box.height))
  return { left, top, width: right - left, height: bottom - top }
}

/**
 * Line boxes up along one edge or centre. Several boxes line up with the box
 * around all of them; one box lines up with the page.
 */
export function align(boxes: readonly Box[], edge: AlignEdge, page: Box): Move[] {
  const target = boxes.length === 1 ? page : boundsOf(boxes)
  return boxes.map((box) => {
    switch (edge) {
      case 'left':
        return { dx: target.left - box.left, dy: 0 }
      case 'centre':
        return { dx: target.left + target.width / 2 - (box.left + box.width / 2), dy: 0 }
      case 'right':
        return { dx: target.left + target.width - (box.left + box.width), dy: 0 }
      case 'top':
        return { dx: 0, dy: target.top - box.top }
      case 'middle':
        return { dx: 0, dy: target.top + target.height / 2 - (box.top + box.height / 2) }
      case 'bottom':
        return { dx: 0, dy: target.top + target.height - (box.top + box.height) }
    }
  })
}

/**
 * Spread boxes out so the gaps between them are equal. The first and last box
 * (by position) stay where they are. Needs at least three boxes.
 */
export function distribute(boxes: readonly Box[], axis: Axis): Move[] {
  const moves = boxes.map(() => ({ dx: 0, dy: 0 }))
  if (boxes.length < 3) return moves
  const start = (box: Box) => (axis === 'horizontal' ? box.left : box.top)
  const size = (box: Box) => (axis === 'horizontal' ? box.width : box.height)
  const ordered = boxes.map((box, index) => ({ box, index })).sort((a, b) => start(a.box) - start(b.box))
  const from = Math.min(...boxes.map(start))
  const to = Math.max(...boxes.map((box) => start(box) + size(box)))
  const gap = (to - from - boxes.reduce((sum, box) => sum + size(box), 0)) / (boxes.length - 1)
  let next = from
  for (const { box, index } of ordered) {
    const shift = next - start(box)
    moves[index] = axis === 'horizontal' ? { dx: shift, dy: 0 } : { dx: 0, dy: shift }
    next += size(box) + gap
  }
  return moves
}

/** A thin guide line shown while snapping: vertical at x = `at` (from y `from` to `to`), or horizontal at y = `at`. */
export type Guide = { axis: 'x' | 'y'; at: number; from: number; to: number }

export type SnapResult = Move & { guides: Guide[] }

/** The three lines of a box along one axis: start edge, centre and end edge. */
const linesOf = (box: Box, axis: 'x' | 'y'): number[] => {
  const start = axis === 'x' ? box.left : box.top
  const size = axis === 'x' ? box.width : box.height
  return [start, start + size / 2, start + size]
}

/** Snap one axis: the smallest move that lines up one of the moving box's lines with a target line. */
function snapAxis(moving: Box, targets: readonly Box[], axis: 'x' | 'y', distance: number, grid: number | undefined) {
  const own = linesOf(moving, axis)
  let best: number | undefined
  for (const target of targets) {
    for (const line of linesOf(target, axis)) {
      for (const mine of own) {
        const shift = line - mine
        if (Math.abs(shift) <= distance && (best === undefined || Math.abs(shift) < Math.abs(best))) best = shift
      }
    }
  }
  // The grid only counts when no object or page line is close: objects matter more.
  if (best === undefined && grid !== undefined && grid > 0) {
    const edges = own.filter((_, index) => index !== 1)
    for (const mine of edges) {
      const shift = Math.round(mine / grid) * grid - mine
      if (Math.abs(shift) <= distance && (best === undefined || Math.abs(shift) < Math.abs(best))) best = shift
    }
  }
  return best ?? 0
}

/**
 * Where a box being dragged should snap to: the edges and centres of other
 * boxes and of the page, or else the grid. Returns the extra move and the
 * guide lines to show. `distance` is in page pixels (SNAP_DISTANCE_PX / zoom).
 */
export function snap(moving: Box, others: readonly Box[], page: Box, distance: number, grid?: number): SnapResult {
  const targets = [page, ...others]
  const dx = snapAxis(moving, targets, 'x', distance, grid)
  const dy = snapAxis(moving, targets, 'y', distance, grid)
  const placed = { ...moving, left: moving.left + dx, top: moving.top + dy }
  return { dx, dy, guides: [...guidesFor(placed, targets, 'x'), ...guidesFor(placed, targets, 'y')] }
}

/**
 * The page shrunk by `margin` on every side: its edges are extra snap lines,
 * so objects can sit a little way in from the page edge. None when the page is
 * too small to keep that margin.
 */
export function marginBox(page: Box, margin: number): Box | undefined {
  if (margin <= 0 || page.width <= margin * 2 || page.height <= margin * 2) return undefined
  return { left: page.left + margin, top: page.top + margin, width: page.width - margin * 2, height: page.height - margin * 2 }
}

/** True when one of the guide lines runs along an edge of the margin box (not its middle, which is the page's). */
export function touchesMargin(guides: readonly Guide[], margin: Box): boolean {
  const edges = { x: [margin.left, margin.left + margin.width], y: [margin.top, margin.top + margin.height] }
  return guides.some((guide) => edges[guide.axis].some((edge) => Math.abs(edge - guide.at) < 0.5))
}

/** Which edge of a box a handle drags along one axis: its left/top (`start`) or right/bottom (`end`). */
export type Side = 'start' | 'end'

/** The shift that brings `edge` onto the nearest target line within `distance`, else onto the grid, else 0. */
function snapLine(edge: number, targets: readonly Box[], axis: 'x' | 'y', distance: number, grid: number | undefined): number | undefined {
  let best: number | undefined
  for (const target of targets) {
    for (const line of linesOf(target, axis)) {
      const shift = line - edge
      if (Math.abs(shift) <= distance && (best === undefined || Math.abs(shift) < Math.abs(best))) best = shift
    }
  }
  if (best === undefined && grid !== undefined && grid > 0) {
    const shift = Math.round(edge / grid) * grid - edge
    if (Math.abs(shift) <= distance) best = shift
  }
  return best
}

const sideEdge = (box: Box, axis: 'x' | 'y', side: Side) => {
  const start = axis === 'x' ? box.left : box.top
  return side === 'start' ? start : start + (axis === 'x' ? box.width : box.height)
}

/** Move one edge of a box by `shift`, the opposite edge staying put. */
function moveEdge(box: Box, axis: 'x' | 'y', side: Side, shift: number): Box {
  if (axis === 'x') return side === 'start' ? { ...box, left: box.left + shift, width: box.width - shift } : { ...box, width: box.width + shift }
  return side === 'start' ? { ...box, top: box.top + shift, height: box.height - shift } : { ...box, height: box.height + shift }
}

/** Scale one axis of a box to `size`, keeping the edge opposite `side` in place. */
function sizeAxis(box: Box, axis: 'x' | 'y', side: Side, size: number): Box {
  const now = axis === 'x' ? box.width : box.height
  return moveEdge(box, axis, side, size - now)
}

/**
 * Snapping while a handle resizes a box: the edges the handle drags (`sides`)
 * jump onto the edges and centres of other boxes and of the page, or else the
 * grid, while the opposite edges stay put. With `keepRatio` (a corner handle
 * that keeps proportions) only the edge that needs the smaller jump snaps, and
 * the other side follows to keep the shape. Returns the snapped box and the
 * guide lines along the edges that snapped.
 */
export function snapResize(moving: Box, sides: { x?: Side; y?: Side }, others: readonly Box[], page: Box, distance: number, grid?: number, keepRatio = false): { box: Box; guides: Guide[] } {
  const targets = [page, ...others]
  const shifts = {
    x: sides.x && snapLine(sideEdge(moving, 'x', sides.x), targets, 'x', distance, grid),
    y: sides.y && snapLine(sideEdge(moving, 'y', sides.y), targets, 'y', distance, grid),
  }
  let box = moving
  if (keepRatio && sides.x && sides.y && moving.width > 0 && moving.height > 0) {
    const useX = shifts.x !== undefined && (shifts.y === undefined || Math.abs(shifts.x) <= Math.abs(shifts.y))
    const axis = useX ? 'x' : shifts.y !== undefined ? 'y' : undefined
    if (axis) {
      const other = axis === 'x' ? 'y' : 'x'
      box = moveEdge(box, axis, sides[axis]!, shifts[axis]!)
      const ratio = axis === 'x' ? box.width / moving.width : box.height / moving.height
      box = sizeAxis(box, other, sides[other]!, (other === 'x' ? moving.width : moving.height) * ratio)
    }
  } else {
    if (sides.x && shifts.x !== undefined) box = moveEdge(box, 'x', sides.x, shifts.x)
    if (sides.y && shifts.y !== undefined) box = moveEdge(box, 'y', sides.y, shifts.y)
  }
  if (box.width < 1 || box.height < 1) return { box: moving, guides: [] }
  // Guides only for the dragged edges: the edge that stays put isn't news.
  const dragged = (['x', 'y'] as const).flatMap((axis) => (sides[axis] ? [{ axis, at: sideEdge(box, axis, sides[axis]) }] : []))
  const guides = [...guidesFor(box, targets, 'x'), ...guidesFor(box, targets, 'y')].filter((guide) => dragged.some((edge) => edge.axis === guide.axis && Math.abs(edge.at - guide.at) < 0.5))
  return { box, guides }
}

/** Where a dragged point (an arrow's end) should snap to: the edges and centres of other boxes and of the page, or else the grid. */
export function snapPoint(point: { x: number; y: number }, others: readonly Box[], page: Box, distance: number, grid?: number): { x: number; y: number; guides: Guide[] } {
  const result = snap({ left: point.x, top: point.y, width: 0, height: 0 }, others, page, distance, grid)
  return { x: point.x + result.dx, y: point.y + result.dy, guides: result.guides }
}

/** Guide lines for every target line that the (already snapped) box now touches. */
function guidesFor(box: Box, targets: readonly Box[], axis: 'x' | 'y'): Guide[] {
  const guides: Guide[] = []
  const own = linesOf(box, axis)
  const across = (b: Box) => (axis === 'x' ? [b.top, b.top + b.height] : [b.left, b.left + b.width])
  const [boxFrom, boxTo] = across(box) as [number, number]
  for (const target of targets) {
    const [targetFrom, targetTo] = across(target) as [number, number]
    for (const line of linesOf(target, axis)) {
      if (!own.some((mine) => Math.abs(mine - line) < 0.5)) continue
      const from = Math.min(boxFrom, targetFrom)
      const to = Math.max(boxTo, targetTo)
      const same = guides.find((guide) => Math.abs(guide.at - line) < 0.5)
      if (same) {
        same.from = Math.min(same.from, from)
        same.to = Math.max(same.to, to)
      } else guides.push({ axis, at: line, from, to })
    }
  }
  return guides
}

/** Where pasted or duplicated copies go: a little down and to the right, in page pixels. */
export const PASTE_OFFSET_PX = 10
