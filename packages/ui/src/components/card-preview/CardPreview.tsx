/*
 * A small picture of a framed icon (a "card", BIO-73): the icon in its frame
 * with its caption below, inside or beside it, or in a header strip. Used for
 * the frame style and caption tiles in the editor's Frame tab, where it shows
 * the selected icon itself, and meant for the Blocks tool's previews too.
 *
 * It only draws; it doesn't measure. `scale` shrinks the whole card (drawn at
 * page size) to fit a tile, kept centred in the space it is given; it may
 * reach past that space (a picker button draws its picture at 60% of its size).
 */
import type { CSSProperties, ReactNode } from 'react'

import { cn } from '../../lib/cn'

export type CardLook = {
  shape: 'rounded' | 'square' | 'circle' | 'pill'
  fill: string | null
  outline: string | null
  padding: number
  corners: number
  caption: 'none' | 'below' | 'inside' | 'beside'
  header: boolean
}

export type CardPreviewProps = {
  /** The icon's SVG text; while it loads, a soft placeholder takes its place. */
  svg: string | undefined
  label: string
  look: CardLook
  /** The icon's size before scaling, in px. */
  iconSize?: number
  /** How much smaller than page size the card is drawn. */
  scale?: number
  className?: string
}

function Caption({ children, light }: { children: ReactNode; light?: boolean }) {
  return <span className={cn('whitespace-nowrap text-[12px] leading-tight font-medium', light ? 'text-white' : 'text-[#20242a]')}>{children}</span>
}

function Art({ svg, size }: { svg: string | undefined; size: number }) {
  if (!svg) return <span aria-hidden className="block shrink-0 rounded-sm bg-black/10" style={{ width: size, height: size }} />
  return <span aria-hidden className="block shrink-0 [&>svg]:size-full" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
}

/** The card at page size. */
function Card({ svg, label, look, iconSize }: { svg: string | undefined; label: string; look: CardLook; iconSize: number }) {
  const { shape, fill, outline, padding, corners, header } = look
  const caption = label.trim() ? look.caption : 'none'
  const radius = shape === 'circle' || shape === 'pill' ? 9999 : shape === 'square' ? 0 : corners
  const frame: CSSProperties = { background: fill ?? 'transparent', boxShadow: outline ? `inset 0 0 0 1.5px ${outline}` : undefined, borderRadius: radius }
  const beside = caption === 'beside' && !header
  const inside = caption === 'inside' && !header
  // A header card keeps its strip without text (a style picture), so it still looks like one.
  const strip = header && (caption !== 'none' || !label.trim())
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div
        className={cn('flex items-center overflow-hidden', beside ? 'flex-row gap-2' : 'flex-col gap-1', shape === 'circle' && 'aspect-square justify-center')}
        style={{ ...frame, padding: strip ? 0 : beside ? `${padding}px ${padding * 1.6}px ${padding}px ${padding}px` : padding }}
      >
        {strip && (
          <div className="min-h-5 w-full px-2 py-1 text-center" style={{ background: outline ?? '#71717a' }}>
            {caption !== 'none' && <Caption light>{label}</Caption>}
          </div>
        )}
        <div className={cn('flex items-center', beside ? 'flex-row gap-2' : 'flex-col gap-1')} style={strip ? { padding } : undefined}>
          <Art svg={svg} size={iconSize} />
          {(inside || beside) && <Caption>{label}</Caption>}
        </div>
      </div>
      {caption === 'below' && !header && <Caption>{label}</Caption>}
    </div>
  )
}

export function CardPreview({ svg, label, look, iconSize = 52, scale = 1, className }: CardPreviewProps) {
  return (
    <span aria-hidden className={cn('pointer-events-none relative block size-full', className)}>
      <span className="absolute top-1/2 left-1/2 block" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <Card svg={svg} label={label} look={look} iconSize={iconSize} />
      </span>
    </span>
  )
}
