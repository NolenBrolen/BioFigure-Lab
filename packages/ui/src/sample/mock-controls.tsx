/*
 * Stand-in for a base component that isn't built yet (the colour
 * swatch). It exists only so the sample screen can show the look,
 * and are replaced by the real component once it is built.
 */
export function MockSwatch({ colour, label }: { colour: string; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="size-4 shrink-0 rounded-sm ring-1 ring-border-strong ring-inset"
      style={{ backgroundColor: colour }}
    />
  )
}
