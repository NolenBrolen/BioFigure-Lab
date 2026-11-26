/*
 * Small pictures for the Frame tab (BIO-73, owner's notes 2026-11-25): each
 * frame style and caption place drawn with a stand-in icon (a circle and a
 * square) and rounded bars for the caption text, not the selected icon and
 * its name, so they read the same whatever icon is picked. Drawn in the
 * button's text colour, so they follow light and dark mode and the picked
 * button's blue.
 */
import type { CaptionPlace, FrameStyle } from '../editor/icon-card'

/** The stand-in icon, centred on (x, y); `k` scales it. */
function Glyph({ x, y, k = 1.25 }: { x: number; y: number; k?: number }) {
  return (
    <g fill="currentColor">
      <circle cx={x - 2 * k} cy={y - 1.5 * k} r={4 * k} opacity={0.45} />
      <rect x={x - 0.5 * k} y={y - 0.5 * k} width={6 * k} height={6 * k} rx={1.3 * k} opacity={0.85} />
    </g>
  )
}

/** A line of caption text. */
function TextBar({ x, y, width, strong = false }: { x: number; y: number; width: number; strong?: boolean }) {
  return <rect x={x} y={y} width={width} height={3.5} rx={1.75} fill="currentColor" opacity={strong ? 1 : 0.6} />
}

const SOFT = { fill: 'currentColor', fillOpacity: 0.16 }
const LINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 }

/** A frame style, with its caption where that style puts it. `none`: a no-entry sign. */
export function StylePicture({ style }: { style: FrameStyle | 'none' }) {
  return (
    <svg viewBox="0 0 56 40" aria-hidden="true" className="h-full w-full">
      {style === 'none' && (
        // A no-entry sign: a ring with a slash across it.
        <g fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round">
          <circle cx={28} cy={20} r={12} />
          <path d="M19.5 28.5L36.5 11.5" />
        </g>
      )}
      {style === 'tile' && (
        <>
          <rect x={14} y={3} width={28} height={34} rx={6} {...SOFT} />
          <Glyph x={28} y={15} />
          <TextBar x={21} y={27} width={14} />
        </>
      )}
      {style === 'outlined' && (
        <>
          <rect x={16} y={3} width={24} height={24} rx={4} {...LINE} />
          <Glyph x={28} y={15} />
          <TextBar x={19} y={32} width={18} />
        </>
      )}
      {style === 'circle' && (
        <>
          <circle cx={28} cy={15} r={12} {...SOFT} />
          <Glyph x={28} y={15} />
          <TextBar x={19} y={32} width={18} />
        </>
      )}
      {style === 'chip' && (
        <>
          <rect x={6} y={11} width={44} height={18} rx={9} {...LINE} />
          <Glyph x={17} y={20} k={1} />
          <TextBar x={25} y={18.25} width={17} />
        </>
      )}
      {style === 'header' && (
        <>
          <path d="M18 4h20a4 4 0 0 1 4 4v5H14V8a4 4 0 0 1 4-4Z" fill="currentColor" opacity={0.75} />
          <rect x={14} y={4} width={28} height={32} rx={4} {...LINE} />
          <rect x={21} y={7} width={14} height={3} rx={1.5} fill="var(--color-panel, #fff)" />
          <Glyph x={28} y={24} />
        </>
      )}
    </svg>
  )
}

/** Where the caption goes, the text bar drawn strongest so it stands out from the frame. */
export function CaptionPicture({ place }: { place: CaptionPlace }) {
  return (
    <svg viewBox="0 0 56 40" aria-hidden="true" className="h-full w-full">
      {place === 'none' && (
        <>
          <rect x={16} y={6} width={24} height={28} rx={5} {...SOFT} />
          <Glyph x={28} y={20} />
        </>
      )}
      {place === 'below' && (
        <>
          <rect x={17} y={3} width={22} height={22} rx={5} {...SOFT} />
          <Glyph x={28} y={14} />
          <TextBar x={18} y={31} width={20} strong />
        </>
      )}
      {place === 'inside' && (
        <>
          <rect x={15} y={3} width={26} height={34} rx={5} {...SOFT} />
          <Glyph x={28} y={15} />
          <TextBar x={20} y={27} width={16} strong />
        </>
      )}
      {place === 'beside' && (
        <>
          <rect x={5} y={9} width={46} height={22} rx={5} {...SOFT} />
          <Glyph x={15} y={20} />
          <TextBar x={24} y={18.25} width={20} strong />
        </>
      )}
    </svg>
  )
}
