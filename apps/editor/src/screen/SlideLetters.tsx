/*
 * The slide's letter settings (BIO-83, design A "Outside the corner"): rows
 * placed right under the Letter toggle in the properties of a panel with a
 * letter and of a figure grid with letters on. It acts on every letter of the slide at once, so its
 * heading says so: style (A, a, (A), A.), weight, size in pt and, from the
 * second slide on, whether the count starts again at A or goes on from the
 * slide before.
 */
import { SegmentedToggle } from '@biofigure-lab/ui/components/segmented-toggle/SegmentedToggle'
import { Slider } from '@biofigure-lab/ui/components/slider/Slider'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'

import type { FigureCanvas } from '../editor/FigureCanvas'
import { LETTER_SIZE_RANGE, LETTER_STYLES, letterName, type LettersInfo } from '../editor/panel-letters'
import { PropRow } from './properties-pane'

const WEIGHTS = [
  { value: 'bold', label: 'Bold', picture: <span className="text-sm font-bold">A</span> },
  { value: 'plain', label: 'Plain', picture: <span className="text-sm font-normal">A</span> },
] as const

/** The caption and rows of the slide's letter settings; they sit in a properties card (inside `PropRows`), right under the Letter toggle. */
export function SlideLettersRows({ figure, letters }: { figure: FigureCanvas | null; letters: LettersInfo }) {
  const expanded = useExpandedControls()
  return (
    <>
      <p className="col-span-2 text-xs text-muted-foreground">{letters.slide === 1 ? 'Letters' : `Slide ${letters.slide}`}</p>
        <PropRow label="Style" rowId="Letter style" top>
          <div role="group" aria-label="Letter style" className="grid w-full grid-cols-4 gap-1.5">
            {LETTER_STYLES.map((style) => (
              // Only the letter shows; the name is the button's name and tooltip. The letter is drawn by CSS, so the button has no text to clash with its name.
              <button
                key={style.id}
                type="button"
                title={style.name}
                aria-label={style.name}
                aria-pressed={letters.style === style.id}
                onClick={() => figure?.setSlideLetters({ style: style.id })}
                className={cn(
                  'flex h-9 min-w-0 items-center justify-center rounded-md border text-base leading-none transition-colors duration-(--duration-instant) before:content-[attr(data-letter)] focus-visible:outline-2 focus-visible:outline-ring',
                  letters.style === style.id ? 'border-primary/25 bg-primary-subtle text-primary-subtle-foreground hover:bg-primary-subtle-hover' : 'border-border-strong bg-panel text-foreground hover:bg-muted',
                  letters.bold && 'font-bold',
                )}
                data-letter={letterName(0, style.id)}
              />
            ))}
          </div>
        </PropRow>
        <PropRow label="Weight" rowId="Letter weight">
          <SegmentedToggle label="Letter weight" options={WEIGHTS} value={letters.bold ? 'bold' : 'plain'} onValueChange={(value) => figure?.setSlideLetters({ bold: value === 'bold' })} showLabels className="h-8 flex-1" />
        </PropRow>
        <PropRow label="Size" rowId="Letter size">
          <Slider
            look={expanded ? 'bar' : undefined}
            label="Letter size"
            hideLabel
            min={LETTER_SIZE_RANGE.min}
            max={LETTER_SIZE_RANGE.max}
            step={0.5}
            value={letters.size}
            unit="pt"
            onValueChange={(size) => figure?.setSlideLetters({ size }, 'letter-size')}
            className="min-w-0 flex-1"
          />
        </PropRow>
        {/* The first slide always starts at A, so it has nothing to choose. */}
        {!letters.first && (
          <PropRow label="Numbering">
            <SegmentedToggle
              label="Letter numbering"
              options={[
                { value: 'continue', label: `From ${letters.goOnAt}` },
                { value: 'start', label: `From ${letters.startAt}` },
              ]}
              value={letters.numbering}
              onValueChange={(numbering) => figure?.setSlideLetters({ numbering })}
              showLabels
              className="h-8 flex-1"
            />
          </PropRow>
        )}
    </>
  )
}
