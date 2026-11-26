/*
 * The Blocks tool's Legends section (BIO-106): one card per look, each the
 * legend a click places. The start icons load first (they are library
 * icons), so the pictures show them; until then the cards show the icons'
 * grey stand-ins.
 */
import { useEffect, useState, type ReactNode } from 'react'

import { legendBlock, type Block } from '../editor/blocks'
import { legendSvg, loadStartIcons, startLegend, type LegendLook } from '../editor/legend-block'

type LegendCard = { id: string; name: string; title: string; look: LegendLook; make: (centre: { x: number; y: number }) => Block }

export const LEGEND_BLOCKS: readonly LegendCard[] = [
  { id: 'legend-plain', name: 'Plain key', title: 'Add a legend: icons and colours with labels, no frame', look: 'plain', make: legendBlock('plain') },
  { id: 'legend-boxed', name: 'Boxed key', title: 'Add a legend in a box with a header', look: 'boxed', make: legendBlock('boxed') },
  { id: 'legend-chips', name: 'Legend chips', title: 'Add a legend of tinted chips', look: 'chips', make: legendBlock('chips') },
]

export function LegendCards({ onAdd, card }: { onAdd: (make: LegendCard['make']) => void; card: (block: LegendCard, svg: string, onClick: () => void) => ReactNode }) {
  // Drawn again once the icons are in (three small pictures, cheap).
  const [, setLoaded] = useState(false)
  useEffect(() => {
    let live = true
    void loadStartIcons().then(() => live && setLoaded(true))
    return () => {
      live = false
    }
  }, [])
  return <>{LEGEND_BLOCKS.map((block) => card(block, legendSvg(startLegend(block.look)), () => onAdd(block.make)))}</>
}
