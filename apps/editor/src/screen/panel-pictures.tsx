/*
 * Small drawings for panel blocks (BIO-74): each of the five looks in the
 * panel's own colour, for the Style tiles. Drawn after the panel drafts' LookPicture
 * (removed once built; in git history), with the same washes and shades as the
 * panel on the page (panel-block.ts), so a tile looks like what it makes.
 */
import { shade, wash, type PanelStyle } from '../editor/panel-block'

/** Two grey blocks standing for what the panel holds. */
function Contents({ top }: { top: number }) {
  return (
    <>
      <rect x="11" y={top} width="10" height="8" rx="1.5" fill="currentColor" opacity="0.3" />
      <rect x="27" y={top} width="10" height="8" rx="1.5" fill="currentColor" opacity="0.3" />
    </>
  )
}

/** One look of a panel, in its colour; `strong` gives the deeper wash behind the contents. */
export function PanelLookPicture({ style, colour, strong = false }: { style: PanelStyle; colour: string; strong?: boolean }) {
  return (
    <svg viewBox="0 0 48 36" className="size-full" aria-hidden="true">
      {style === 'bar' && (
        <>
          <rect x="2.75" y="3.75" width="42.5" height="28.5" rx="3" fill={wash(colour, strong ? 0.2 : 0.08)} stroke={colour} strokeWidth="1.5" />
          <path d="M2 7a3 3 0 0 1 3-3h38a3 3 0 0 1 3 3v3.5H2Z" fill={colour} />
          <rect x="6" y="6.25" width="12" height="2" rx="1" fill="#ffffff" />
          <Contents top={16} />
        </>
      )}
      {style === 'tab' && (
        <>
          <rect x="2.75" y="7.75" width="42.5" height="24.5" rx="3" fill={strong ? wash(colour, 0.14) : '#ffffff'} stroke={colour} strokeWidth="1.5" />
          <rect x="6" y="4" width="17" height="7" rx="3.5" fill={colour} />
          <rect x="9" y="6.5" width="11" height="2" rx="1" fill="#ffffff" />
          <Contents top={17} />
        </>
      )}
      {style === 'soft' && (
        <>
          <rect x="2" y="3" width="44" height="30" rx="5" fill={wash(colour, strong ? 0.28 : 0.14)} />
          <rect x="6.5" y="7" width="14" height="2.5" rx="1.25" fill={shade(colour)} />
          <Contents top={16} />
        </>
      )}
      {style === 'stripe' && (
        <>
          <rect x="2.4" y="3.4" width="43.2" height="29.2" rx="2.5" fill={strong ? wash(colour, 0.1) : '#ffffff'} stroke="#d4d4d8" strokeWidth="0.8" />
          <path d="M2 6a2.5 2.5 0 0 1 2.5-2.5H5v29h-.5A2.5 2.5 0 0 1 2 30Z" fill={colour} />
          <rect x="9" y="7" width="12" height="2" rx="1" fill={shade(colour, 0.85)} />
          <Contents top={16} />
        </>
      )}
      {style === 'dashed' && (
        <>
          <rect x="2.75" y="10.75" width="42.5" height="21.5" rx="4" fill={strong ? wash(colour, 0.08) : 'none'} stroke={colour} strokeWidth="1.5" strokeDasharray="3 2" />
          <rect x="3.5" y="4" width="13" height="2.5" rx="1.25" fill={shade(colour, 0.85)} />
          <Contents top={17} />
        </>
      )}
    </svg>
  )
}
