/**
 * Typing a new width or height: works out the new scale of an object.
 * Sizes are the object's own size times its scale, without the line around it.
 */
export type Scalable = { width: number; height: number; scaleX: number; scaleY: number }

export function resizedScale(
  object: Scalable,
  change: { width?: number; height?: number },
  keepProportions: boolean,
): { scaleX: number; scaleY: number } {
  let { scaleX, scaleY } = object
  // A flat object, such as a horizontal line, has no height to scale.
  if (change.width !== undefined && object.width > 0) scaleX = Math.max(change.width, 1) / object.width
  if (change.height !== undefined && object.height > 0) scaleY = Math.max(change.height, 1) / object.height
  if (keepProportions) {
    if (change.width !== undefined && object.width > 0) scaleY = object.scaleY * (scaleX / object.scaleX)
    else if (change.height !== undefined && object.height > 0) scaleX = object.scaleX * (scaleY / object.scaleY)
  }
  return { scaleX, scaleY }
}
