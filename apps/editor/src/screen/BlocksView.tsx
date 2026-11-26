/*
 * The Blocks tool's panel (BIO-74, ahead of the full Blocks tool in BIO-76):
 * the ready-made figure pieces, one card per block: for now a Panel, and a
 * Panel with 3 icon spaces. Each picture is the block itself drawn by the
 * canvas code, on a piece of white page, so a card shows exactly what
 * clicking it places.
 * The panel's styles are picked in its properties (PanelProperties), which
 * open here when a panel is selected.
 */
import { useMemo } from 'react'

import { blockSvg, comparisonOfSpaces, emptyPanel, experimentTimeline, figureGrid, figureGridSvg, graphicalAbstract, labelledIcon, panelWithIcons, pathwayCascade, processOfSpaces, sequenceOfSpaces, wellPlate, zoomInset, type Block } from '../editor/blocks'
import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import { GRID_LAYOUTS } from '../editor/grid-block'
import { plateSvg } from '../editor/well-plate'
import { LegendProperties } from './LegendProperties'
import { LegendCards } from './legend-cards'
import { AbstractProperties } from './AbstractProperties'
import { ComparisonProperties } from './ComparisonProperties'
import { CalloutProperties } from './CalloutProperties'
import { GridProperties } from './GridProperties'
import { PanelProperties } from './PanelProperties'
import { PathwayProperties } from './PathwayProperties'
import { PlateProperties } from './PlateProperties'
import { SequenceProperties } from './SequenceProperties'
import { TimelineProperties } from './TimelineProperties'

/** The blocks, in the order of their cards. */
const BLOCKS: readonly { id: string; name: string; title: string; make: (centre: { x: number; y: number }) => Block }[] = [
  { id: 'panel', name: 'Panel', title: 'Add a panel', make: emptyPanel },
  { id: 'panel-icons', name: 'Panel with 3 icons', title: 'Add a panel with 3 icon spaces', make: (centre) => panelWithIcons(centre, 3) },
  // Sequences (BIO-75): one card per look, each with three steps to fill.
  { id: 'sequence-arrows', name: 'Steps with arrows', title: 'Add three steps with arrows between them', make: sequenceOfSpaces('arrows') },
  { id: 'sequence-timeline', name: 'Timeline', title: 'Add a timeline of three steps', make: sequenceOfSpaces('timeline') },
  { id: 'sequence-cards', name: 'Step cards', title: 'Add three numbered step cards', make: sequenceOfSpaces('cards') },
  { id: 'sequence-ribbon', name: 'Ribbon', title: 'Add a ribbon of three steps', make: sequenceOfSpaces('ribbon') },
  // Comparisons (BIO-95): one card per kind; the look is picked in its properties.
  { id: 'comparison-versus', name: 'Control vs Treatment', title: 'Add two matching sides to compare', make: comparisonOfSpaces('versus') },
  { id: 'comparison-change', name: 'Before / After', title: 'Add two matching sides with an arrow between them', make: comparisonOfSpaces('change') },
  // Callouts (BIO-97): three zoom insets and three labelled icons, one card per look.
  // Graphical abstracts (BIO-107): one card per look, each a title over three parts.
  { id: 'abstract-cards', name: 'Banner and cards', title: 'Add a graphical abstract: a title bar over three cards with arrows', make: graphicalAbstract('cards') },
  { id: 'abstract-chevrons', name: 'Chevron flow', title: 'Add a graphical abstract: a title over three parts in chevrons', make: graphicalAbstract('chevrons') },
  { id: 'abstract-spotlight', name: 'Spotlight', title: 'Add a graphical abstract: numbered steps leading to a highlighted finding', make: graphicalAbstract('spotlight') },
  { id: 'callout-lens', name: 'Zoom lens', title: 'Add a round zoom inset with lines to a marker', make: zoomInset('lens') },
  { id: 'callout-frame', name: 'Zoom frame', title: 'Add a square zoom inset joined corner to corner', make: zoomInset('frame') },
  { id: 'callout-pin', name: 'Zoom pin', title: 'Add a zoom inset on a pin with a caption', make: zoomInset('pin') },
  { id: 'callout-plain', name: 'Labels', title: 'Add an icon with three labels on lines', make: labelledIcon('plain') },
  { id: 'callout-chips', name: 'Label chips', title: 'Add an icon with three label chips', make: labelledIcon('chips') },
  { id: 'callout-numbers', name: 'Numbered labels', title: 'Add an icon with three numbered labels and a key', make: labelledIcon('numbers') },
  // Pathway cascades (BIO-105): one card per look, each a receptor in the membrane, two steps and a target gene in the nucleus.
  { id: 'pathway-cutout', name: 'Cell cutout', title: 'Add a signalling pathway drawn in a cell', make: pathwayCascade('cutout') },
  { id: 'pathway-cards', name: 'Flow cards', title: 'Add a signalling pathway of cards', make: pathwayCascade('cards') },
  { id: 'pathway-bands', name: 'Compartments', title: 'Add a signalling pathway in compartment bands', make: pathwayCascade('bands') },
]

/** Figure grids (BIO-86): multi-panel figures of empty chart spaces, one card per layout. */
const LAYOUT_BLOCKS = GRID_LAYOUTS.map((layout) => ({ id: `grid-${layout.id}`, name: layout.name, title: `Add a graph layout: ${layout.name}`, make: figureGrid(layout.id), picture: () => figureGridSvg(layout.id) }))

/**
 * Process blocks (BIO-96): every style of each is its own card (the owner,
 * 2026-11-26), the default style first: Lanes, Ring and Tree.
 */
const PROCESS_SECTIONS: readonly { name: string; blocks: readonly { id: string; name: string; title: string; make: (centre: { x: number; y: number }) => Block }[] }[] = [
  {
    name: 'Experiment timeline',
    blocks: [
      { id: 'timeline-lanes', name: 'Lanes', title: 'Add an experiment timeline with a lane per kind of event', make: experimentTimeline('lanes') },
      { id: 'timeline-ruler', name: 'Ruler', title: 'Add an experiment timeline as a ruler with markers', make: experimentTimeline('ruler') },
      { id: 'timeline-pins', name: 'Bar with pins', title: 'Add an experiment timeline as a bar with pins', make: experimentTimeline('pins') },
    ],
  },
  {
    name: 'Cycle',
    blocks: [
      { id: 'cycle-ring', name: 'Ring', title: 'Add a cycle of four steps on a ring', make: processOfSpaces('ring') },
      { id: 'cycle-segments', name: 'Segments', title: 'Add a cycle of four steps round a ring of segments', make: processOfSpaces('segments') },
      { id: 'cycle-loop', name: 'Loop of cards', title: 'Add a cycle of four steps in cards', make: processOfSpaces('loop') },
    ],
  },
  {
    name: 'Branching',
    blocks: [
      { id: 'branch-tree', name: 'Tree', title: 'Add a start that branches into three arms', make: processOfSpaces('tree') },
      { id: 'branch-fan', name: 'Fan', title: 'Add a start that fans out into three arms', make: processOfSpaces('fan') },
      { id: 'branch-rows', name: 'Arm rows', title: 'Add a start that splits into three arm rows', make: processOfSpaces('rows') },
    ],
  },
]
const PROCESS_BLOCKS = PROCESS_SECTIONS.flatMap((section) => section.blocks)
/** Well plate maps (BIO-98): one card per look, each a 96-well plate with an example dose series. */
const PLATE_BLOCKS = [
  { id: 'plate-plate', name: 'Well plate', title: 'Add a well plate map', make: wellPlate('plate'), picture: () => plateSvg('plate') },
  { id: 'plate-grid', name: 'Plate grid', title: 'Add a well plate map with square wells', make: wellPlate('grid'), picture: () => plateSvg('grid') },
  { id: 'plate-labelled', name: 'Labelled wells', title: 'Add a well plate map with labels in the wells', make: wellPlate('labelled'), picture: () => plateSvg('labelled') },
]

/** A section's name over its cards. */
function SectionName({ children }: { children: string }) {
  return <h3 className="col-span-2 pt-1 text-xs font-medium text-muted-foreground first:pt-0">{children}</h3>
}

/** One block: its picture on white page, its name under it. */
function BlockCard({ name, title, svg, onClick }: { name: string; title: string; svg: string; onClick: () => void }) {
  return (
    <button
      type="button"
      // Named by its visible name; the picture's letters would not match a label (axe: label-content-name-mismatch).
      title={title}
      onClick={onClick}
      className="flex flex-col gap-1.5 rounded-md border border-border-strong bg-panel p-1.5 text-muted-foreground transition-colors duration-(--duration-instant) hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      {/* The page is white in both themes, so the picture sits on white too. */}
      <span className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-sm bg-white p-2.5 dark:brightness-(--page-dim)" dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="text-xs leading-tight">{name}</span>
    </button>
  )
}

type Props = {
  figure: FigureCanvas | null
  /** The selected panel or sequence block, whose properties the panel opens. */
  panel?: SelectionInfo
  /** Whether the selected block's properties are showing (not the blocks). */
  open: boolean
  onBack: () => void
}

export function BlocksView({ figure, panel, open, onBack }: Props) {
  // Layout cards show example graphs in their cells, so they read as graph layouts (owner's feedback, 2026-11-25).
  const pictures = useMemo(() => new Map([...BLOCKS.map((block) => [block.id, blockSvg(block.make({ x: 0, y: 0 }))] as const), ...LAYOUT_BLOCKS.map((block) => [block.id, block.picture()] as const), ...PROCESS_BLOCKS.map((block) => [block.id, blockSvg(block.make({ x: 0, y: 0 }))] as const), ...PLATE_BLOCKS.map((block) => [block.id, block.picture()] as const)]), [])
  return (
    <aside aria-label="Blocks" className="flex min-h-0 flex-col overflow-y-auto bg-panel [scrollbar-gutter:stable]">
      {open && panel?.abstract ? (
        <AbstractProperties figure={figure} abstract={panel} onBack={onBack} />
      ) : open && panel?.comparison ? (
        <ComparisonProperties figure={figure} selection={panel} onBack={onBack} />
      ) : open && panel?.kind === 'legend' ? (
        <LegendProperties figure={figure} legend={panel} onBack={onBack} />
      ) : open && panel?.kind === 'plate' ? (
        <PlateProperties figure={figure} plate={panel} onBack={onBack} />
      ) : open && panel?.kind === 'timeline' ? (
        <TimelineProperties figure={figure} timeline={panel} onBack={onBack} />
      ) : open && panel?.pathway ? (
        <PathwayProperties figure={figure} selection={panel} onBack={onBack} />
      ) : open && panel?.kind === 'sequence' ? (
        <SequenceProperties figure={figure} sequence={panel} onBack={onBack} />
      ) : open && panel?.kind === 'callout' ? (
        <CalloutProperties figure={figure} callout={panel} onBack={onBack} />
      ) : open && panel ? (
        panel.grid ? <GridProperties figure={figure} grid={panel} onBack={onBack} /> : <PanelProperties figure={figure} panel={panel} onBack={onBack} />
      ) : (
        <div className="grid grid-cols-2 gap-2 p-3">
          <SectionName>Panels</SectionName>
          {BLOCKS.filter((block) => block.id.startsWith('panel')).map((block) => (
            <BlockCard key={block.id} name={block.name} title={block.title} svg={pictures.get(block.id) ?? ''} onClick={() => figure?.addBlock(block.make)} />
          ))}
          <SectionName>Sequences</SectionName>
          {BLOCKS.filter((block) => block.id.startsWith('sequence')).map((block) => (
            <BlockCard key={block.id} name={block.name} title={block.title} svg={pictures.get(block.id) ?? ''} onClick={() => figure?.addBlock(block.make)} />
          ))}
          <SectionName>Comparisons</SectionName>
          {BLOCKS.filter((block) => block.id.startsWith('comparison')).map((block) => (
            <BlockCard key={block.id} name={block.name} title={block.title} svg={pictures.get(block.id) ?? ''} onClick={() => figure?.addBlock(block.make)} />
          ))}
          {PROCESS_SECTIONS.map((section) => [
            <SectionName key={section.name}>{section.name}</SectionName>,
            ...section.blocks.map((block) => <BlockCard key={block.id} name={block.name} title={block.title} svg={pictures.get(block.id) ?? ''} onClick={() => figure?.addBlock(block.make)} />),
          ])}
          <SectionName>Graphical abstract</SectionName>
          {BLOCKS.filter((block) => block.id.startsWith('abstract')).map((block) => (
            <BlockCard key={block.id} name={block.name} title={block.title} svg={pictures.get(block.id) ?? ''} onClick={() => figure?.addBlock(block.make)} />
          ))}
          <SectionName>Callouts</SectionName>
          {BLOCKS.filter((block) => block.id.startsWith('callout')).map((block) => (
            <BlockCard key={block.id} name={block.name} title={block.title} svg={pictures.get(block.id) ?? ''} onClick={() => figure?.addBlock(block.make)} />
          ))}
          <SectionName>Pathways</SectionName>
          {BLOCKS.filter((block) => block.id.startsWith('pathway')).map((block) => (
            <BlockCard key={block.id} name={block.name} title={block.title} svg={pictures.get(block.id) ?? ''} onClick={() => figure?.addBlock(block.make)} />
          ))}
          <SectionName>Graph layouts</SectionName>
          {LAYOUT_BLOCKS.map((block) => (
            <BlockCard key={block.id} name={block.name} title={block.title} svg={pictures.get(block.id) ?? ''} onClick={() => figure?.addBlock(block.make)} />
          ))}
          <SectionName>Legends</SectionName>
          <LegendCards onAdd={(make) => figure?.addBlock(make)} card={(block, svg, onClick) => <BlockCard key={block.id} name={block.name} title={block.title} svg={svg} onClick={onClick} />} />
          <SectionName>Well plates</SectionName>
          {PLATE_BLOCKS.map((block) => (
            <BlockCard key={block.id} name={block.name} title={block.title} svg={pictures.get(block.id) ?? ''} onClick={() => figure?.addBlock(block.make)} />
          ))}
        </div>
      )}
    </aside>
  )
}
