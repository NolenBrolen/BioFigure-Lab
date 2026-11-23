/*
 * Paper preview: the figure placed on an A4 journal page, among placeholder
 * text, so you can see how it will look in the PDF of your paper.
 *
 * Two page types (picked 2026-11-14: title page is the default):
 *
 *   title-page  - the article's first page: title, authors and abstract,
 *                 sans-serif headings and caption.
 *   inside-page - a page further in, with the figure at the top.
 *
 * The figure's width picks how it sits among the text, as journals do:
 *
 *   single       (up to 90 mm)  - in one column, the caption under it and
 *                                 text running down beside it.
 *   one-and-half (up to 140 mm) - across one and a half columns, the caption
 *                                 in the space beside it, text below.
 *   double       (wider)        - across both columns, caption below.
 *
 * The page is laid out in real millimetres (A4, 18 mm side margins, two
 * 85 mm columns with a 4 mm gap) and then scaled. A figure wider than its
 * place (85, 120 or 174 mm), or very tall, is shrunk to fit, keeping its shape.
 */
import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/400-italic.css'
import '@fontsource/source-serif-4/600.css'
import '@fontsource/source-serif-4/700.css'

import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import { cn } from '../../lib/cn'
import {
  PAPER_ABSTRACT,
  PAPER_AUTHORS,
  PAPER_BODY,
  PAPER_CAPTION,
  PAPER_CAPTION_LABEL,
  PAPER_RUNNING_HEAD,
  PAPER_TITLE,
  type PaperBlock,
} from './paper-text'

export type PaperLayout = 'title-page' | 'inside-page'

export type PaperPreviewProps = {
  /** The figure, drawn to fill a box of `figureMm`. An `<svg>` child (or grandchild) is stretched to fill it. */
  figure: ReactNode
  /** The figure's size on paper, in millimetres. */
  figureMm: { width: number; height: number }
  /** The caption text after "Fig. 1". A placeholder caption when left out. */
  caption?: string
  layout?: PaperLayout
  /** Page size on screen: 1 is actual size (1 mm = 1 CSS mm). Left out, the page fits the width it's given. */
  scale?: number
  className?: string
}

/** A4 in CSS pixels (96 per inch). */
export const PAGE_PX = { width: (210 / 25.4) * 96, height: (297 / 25.4) * 96 }

/** The widest a figure can be: both columns. */
export const TEXT_WIDTH_MM = 174
const COLUMN_MM = 85
const GAP_MM = 4

export type FigureColumns = 'single' | 'one-and-half' | 'double'

/** How many columns a figure this wide takes, the way journals size them. */
export function figureColumns(widthMm: number): FigureColumns {
  if (widthMm <= 90) return 'single'
  if (widthMm <= 140) return 'one-and-half'
  return 'double'
}

/** The widest a figure can be drawn in each place. */
const SLOT_WIDTH_MM: Record<FigureColumns, number> = { single: COLUMN_MM, 'one-and-half': 120, double: TEXT_WIDTH_MM }
const MAX_FIGURE_HEIGHT_MM: Record<PaperLayout, number> = { 'title-page': 150, 'inside-page': 210 }

const serif = { fontFamily: '"Source Serif 4", Georgia, serif' }
const sans = { fontFamily: 'var(--font-sans)' }
const accent = '#2f6f8f'

/** Where the figure goes and the size it's drawn at: its own, or shrunk to fit its place on the page. */
export function fittedFigureMm(figureMm: { width: number; height: number }, layout: PaperLayout = 'title-page') {
  const columns = figureColumns(figureMm.width)
  const shrink = Math.min(1, SLOT_WIDTH_MM[columns] / figureMm.width, MAX_FIGURE_HEIGHT_MM[layout] / figureMm.height)
  return { columns, width: figureMm.width * shrink, height: figureMm.height * shrink, shrunk: shrink < 0.995 }
}

export function PaperPreview({ figure, figureMm, caption = PAPER_CAPTION, layout = 'title-page', scale, className }: PaperPreviewProps) {
  const frame = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(0)
  const fixed = scale !== undefined

  useLayoutEffect(() => {
    const element = frame.current
    if (!element || fixed) return
    const update = () => setFitScale(element.clientWidth / PAGE_PX.width)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [fixed])

  const shown = fixed ? scale : fitScale
  return (
    <div
      ref={frame}
      role="img"
      aria-label={`Preview: the figure on an A4 journal page (${layout === 'title-page' ? 'title page' : 'inside page'})`}
      className={cn('relative shrink-0 overflow-hidden bg-white', !fixed && 'w-full', className)}
      style={fixed ? { width: PAGE_PX.width * scale, height: PAGE_PX.height * scale } : { aspectRatio: `${PAGE_PX.width} / ${PAGE_PX.height}` }}
    >
      <div
        inert
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: PAGE_PX.width, height: PAGE_PX.height, transform: `scale(${shown})`, visibility: shown ? 'visible' : 'hidden' }}
      >
        <Page figure={figure} figureMm={fittedFigureMm(figureMm, layout)} caption={caption} layout={layout} />
      </div>
    </div>
  )
}

type Fitted = ReturnType<typeof fittedFigureMm>
type PageProps = { figure: ReactNode; figureMm: Fitted; caption: string; layout: PaperLayout }

function Page({ figure, figureMm, caption, layout }: PageProps) {
  const page: CSSProperties = {
    ...serif,
    color: '#1a1a1a',
    fontSize: '9.5pt',
    lineHeight: 1.27,
    padding: '12mm 18mm 20mm',
    hyphens: 'auto',
  }
  const title = layout === 'title-page'
  const parts = { figure: <FigureBlock figure={figure} figureMm={figureMm} />, caption: <Caption text={caption} layout={layout} />, layout }

  return (
    <article lang="en" data-layout={layout} data-columns={figureMm.columns} className="flex h-full w-full flex-col overflow-hidden bg-white" style={page}>
      <RunningHead layout={layout} />
      {title && <TitleBlock />}
      {figureMm.columns === 'double' && (title ? <TitlePageDouble {...parts} /> : <InsidePageDouble {...parts} />)}
      {figureMm.columns === 'one-and-half' && <OneAndHalf {...parts} />}
      {figureMm.columns === 'single' && <Single {...parts} />}
    </article>
  )
}

type LayoutParts = { figure: ReactNode; caption: ReactNode; layout: PaperLayout }

const headingFontFor = (layout: PaperLayout) => (layout === 'title-page' ? { ...sans, color: accent } : serif)

function RunningHead({ layout }: { layout: PaperLayout }) {
  const title = layout === 'title-page'
  return (
    <header
      className="mb-[7mm] flex shrink-0 items-baseline justify-between border-b pb-[1.5mm]"
      style={{ borderColor: '#000', borderBottomWidth: title ? '0.25mm' : '0.4mm', fontSize: '8.5pt' }}
    >
      <span>{title ? '301' : '304'}</span>
      <span style={title ? { ...sans, letterSpacing: '0.02em' } : undefined}>{PAPER_RUNNING_HEAD}</span>
    </header>
  )
}

function TitleBlock() {
  return (
    <div className="mb-[5mm] shrink-0">
      <p style={{ ...sans, fontSize: '8pt', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent }}>Review</p>
      <h1 style={{ ...sans, fontSize: '17pt', fontWeight: 700, lineHeight: 1.2, margin: '1.5mm 0 2.5mm', letterSpacing: '-0.01em' }}>{PAPER_TITLE}</h1>
      <p style={{ ...sans, fontSize: '9pt' }}>{PAPER_AUTHORS}</p>
      <div
        className="mt-[4mm] border-y py-[2.5mm] text-justify"
        style={{ borderColor: accent, borderTopWidth: '0.5mm', borderBottomWidth: '0.25mm', fontSize: '8.5pt', lineHeight: 1.3 }}
      >
        <span style={{ ...sans, fontWeight: 700 }}>Abstract </span>
        {PAPER_ABSTRACT}
      </div>
    </div>
  )
}

/** "Fig. 1" and the caption: small sans-serif on the title page, serif with a bold sans label inside. */
function Caption({ text, layout }: { text: string; layout: PaperLayout }) {
  return layout === 'title-page' ? (
    <p style={{ ...sans, fontSize: '7.5pt', lineHeight: 1.35, color: '#333' }}>
      <span style={{ fontWeight: 700 }}>{PAPER_CAPTION_LABEL}. </span>
      <Italics text={text} />
    </p>
  ) : (
    <p className="text-justify" style={{ fontSize: '8.5pt', lineHeight: 1.3 }}>
      <span style={{ ...sans, fontWeight: 700, color: '#000' }}>{PAPER_CAPTION_LABEL}</span>
      {'  '}
      <Italics text={text} />
    </p>
  )
}

/** Double column, title page: a little text, then the figure across both columns, caption below, more text. */
function TitlePageDouble({ figure, caption, layout }: LayoutParts) {
  return (
    <>
      {/* With a tall figure, the text above it gives way first, so the figure and its caption always fit. */}
      <Columns className="mb-[5mm] min-h-0 shrink" balance>
        <Body blocks={PAPER_BODY.slice(0, 3)} headingFont={headingFontFor(layout)} />
      </Columns>
      <div className="mx-auto shrink-0">{figure}</div>
      <div className="mt-[2.5mm] mb-[5mm] shrink-0">{caption}</div>
      <Columns className="min-h-0 flex-1">
        <Body blocks={PAPER_BODY.slice(3)} headingFont={headingFontFor(layout)} />
      </Columns>
    </>
  )
}

/** Double column, inside page: the figure at the top, its caption in two columns, then the text. */
function InsidePageDouble({ figure, caption, layout }: LayoutParts) {
  return (
    <>
      <div className="mx-auto shrink-0">{figure}</div>
      <Columns className="mt-[3mm] mb-[5mm] shrink-0" balance>
        {caption}
      </Columns>
      <Columns className="min-h-0 flex-1">
        <Body blocks={PAPER_BODY} headingFont={headingFontFor(layout)} />
      </Columns>
    </>
  )
}

/** One and a half columns: the figure on the left, its caption in the space beside it (bottom-aligned), text below. */
function OneAndHalf({ figure, caption, layout }: LayoutParts) {
  return (
    <>
      <div className="mb-[5mm] flex shrink-0 items-end" style={{ gap: `${GAP_MM}mm` }}>
        {figure}
        <div className="min-w-0 flex-1">{caption}</div>
      </div>
      <Columns className="min-h-0 flex-1">
        <Body blocks={PAPER_BODY} headingFont={headingFontFor(layout)} />
      </Columns>
    </>
  )
}

/**
 * Single column: the figure at the top of one column with its caption under it,
 * the text running down both columns. On the title page the figure sits in the
 * right column, on an inside page in the left one.
 */
function Single({ figure, caption, layout }: LayoutParts) {
  const headingFont = headingFontFor(layout)
  const text = (blocks: readonly PaperBlock[]) => (
    <Columns count={1} className="min-h-0 flex-1">
      <Body blocks={blocks} headingFont={headingFont} />
    </Columns>
  )
  const withFigure = (blocks: readonly PaperBlock[]) => (
    <Column>
      <div className="mb-[5mm] shrink-0">
        {figure}
        <div className="mt-[2.5mm]">{caption}</div>
      </div>
      {text(blocks)}
    </Column>
  )
  const title = layout === 'title-page'
  return (
    <div className="flex min-h-0 flex-1" style={{ gap: `${GAP_MM}mm` }}>
      {title ? <Column>{text(PAPER_BODY)}</Column> : withFigure(PAPER_BODY.slice(0, 5))}
      {title ? withFigure(PAPER_BODY.slice(5)) : <Column>{text(PAPER_BODY.slice(5))}</Column>}
    </div>
  )
}

function Column({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 shrink-0 flex-col" style={{ width: `${COLUMN_MM}mm` }}>
      {children}
    </div>
  )
}

/** The figure in a box of its size in mm. */
function FigureBlock({ figure, figureMm }: { figure: ReactNode; figureMm: { width: number; height: number } }) {
  return (
    <figure
      data-figure
      className="shrink-0 [&>*>svg]:block [&>*>svg]:h-full [&>*>svg]:w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
      style={{ width: `${figureMm.width}mm`, height: `${figureMm.height}mm` }}
    >
      {figure}
    </figure>
  )
}

/**
 * Text in columns (two 85 mm columns with a 4 mm gap, or one). Text past the
 * bottom moves into columns off to the side, which are cut off, so the text
 * always ends on a whole line.
 */
function Columns({ children, className, balance = false, count = 2 }: { children: ReactNode; className?: string; balance?: boolean; count?: 1 | 2 }) {
  return (
    <div
      className={cn('overflow-hidden', className)}
      style={{ columnCount: count, columnWidth: count === 1 ? `${COLUMN_MM}mm` : undefined, columnGap: `${GAP_MM}mm`, columnFill: balance ? 'balance' : 'auto' }}
    >
      {children}
    </div>
  )
}

function Body({ blocks, headingFont }: { blocks: readonly PaperBlock[]; headingFont: CSSProperties }) {
  return (
    <>
      {blocks.map((block, index) =>
        block.kind === 'heading' ? (
          <h3 key={index} className="break-after-avoid" style={{ ...headingFont, fontWeight: 700, fontSize: '9.5pt', margin: '3mm 0 1.2mm' }}>
            {block.text}
          </h3>
        ) : (
          <p key={index} className="text-justify" style={{ textIndent: index === 0 || blocks[index - 1]?.kind === 'heading' ? 0 : '4mm' }}>
            <Italics text={block.text} />
          </p>
        ),
      )}
    </>
  )
}

/** Text with *word* set in italics. */
function Italics({ text }: { text: string }) {
  const parts = text.split(/\*([^*]+)\*/)
  return (
    <>
      {parts.map((part, index) => (index % 2 === 1 ? <i key={index}>{part}</i> : <Fragment key={index}>{part}</Fragment>))}
    </>
  )
}
