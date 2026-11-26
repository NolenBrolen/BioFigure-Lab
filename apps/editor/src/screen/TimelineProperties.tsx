/*
 * The properties of a selected experiment timeline (BIO-96), in the Blocks
 * panel where its cards are:
 *
 * - Events: one row per event in day order, its kind (a marker button per
 *   kind) and its day, with a − that removes it; Add event.
 * - Kinds of event: each with its marker (click for the next shape) and name,
 *   a − that removes it with its events; Add kind.
 * - Axis: how many days and the word before each day number.
 * - Phases (Bar with pins only): each phase's name and last day.
 * - Style: the three styles as small pictures; Preset colours; Detach.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { ColourInput } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { CalendarRange, Minus, Plus, Unlink } from 'lucide-react'
import type { ReactNode } from 'react'

import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import { wash } from '../editor/panel-block'
import { MARKERS, TIMELINE_LENGTH, TIMELINE_STYLES, eventsByDay, kindColour, type MarkerShape, type TimelineSettings, type TimelineStyle } from '../editor/timeline-block'
import { LiveTextField, NumberField } from './fields'
import { Tile } from './FrameProperties'
import { PropertiesHeader, PropRow, PropRows } from './properties-pane'
import { PRESET_GROUPS, ROW, swatchLook } from './SequenceProperties'
import { detachTimelineWithUndo, removeEventKindWithUndo, removeEventWithUndo } from './sequence-actions'
import { PresetPicker } from './ShapeProperties'

/** A kind's marker, as a small picture in its colour. */
function MarkerPicture({ shape, colour }: { shape: MarkerShape; colour: string }) {
  return (
    <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
      {shape === 'triangle' && <path d="M6 10.5 1.5 2.5h9Z" fill={colour} />}
      {shape === 'dot' && <circle cx="6" cy="6" r="4" fill={colour} />}
      {shape === 'diamond' && <path d="M6 1 11 6 6 11 1 6Z" fill={colour} />}
      {shape === 'square' && <rect x="2" y="2" width="8" height="8" fill={colour} />}
      {shape === 'star' && <path d="M6 .8 7.5 4.2l3.7.3-2.8 2.4.9 3.6L6 8.6 2.7 10.5l.9-3.6L.8 4.5l3.7-.3Z" fill={colour} />}
      {shape === 'flag' && <path d="M3 11.5V1h1.2v10.5Zm1.2-10.3 6 2.5-6 2.5Z" fill={colour} />}
    </svg>
  )
}

/** One style as a small picture, in the timeline's colour: what the Style tile makes. */
function StylePicture({ style, colour }: { style: TimelineStyle; colour: string }) {
  return (
    <svg viewBox="0 0 48 36" className="size-full" aria-hidden="true">
      {style === 'lanes' && (
        <>
          {[6, 14, 22].map((y) => (
            <rect key={y} x="14" y={y} width="32" height="6" rx="1" fill={wash(colour, 0.15)} />
          ))}
          {[6, 14, 22].map((y) => (
            <rect key={`n${y}`} x="2" y={y + 1.5} width="9" height="3" rx="1" fill="currentColor" opacity="0.35" />
          ))}
          {[17, 23, 29].map((x) => (
            <path key={x} d={`M${x} 7.5l2 1.5-2 1.5-2-1.5Z`} fill={colour} />
          ))}
          {[29, 37].map((x) => (
            <circle key={x} cx={x} cy="17" r="1.6" fill="#e69f00" />
          ))}
          <circle cx="43" cy="25" r="1.8" fill="#d55e00" />
          <path d="M13 31h34" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        </>
      )}
      {style === 'ruler' && (
        <>
          <path d="M3 24h42" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
          {Array.from({ length: 11 }, (_, i) => (
            <path key={i} d={`M${5 + i * 4} 24v2`} stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
          ))}
          {[5, 11, 17, 21].map((x) => (
            <path key={x} d={`M${x} 22.5l-2-3h4Z`} fill={colour} />
          ))}
          {[17, 29, 37].map((x) => (
            <circle key={x} cx={x} cy="15" r="1.7" fill="#e69f00" />
          ))}
          <path d="M43 24V9m0 0 4 1.7-4 1.7" fill="#d55e00" stroke="#d55e00" strokeWidth="1" />
          <rect x="5" y="30" width="38" height="2.5" rx="1" fill="currentColor" opacity="0.25" />
        </>
      )}
      {style === 'pins' && (
        <>
          <rect x="3" y="16" width="42" height="5" rx="2.5" fill={wash(colour, 0.3)} />
          <rect x="3" y="16" width="18" height="5" rx="2.5" fill={colour} />
          {[6, 12, 18].map((x) => (
            <g key={x}>
              <path d={`M${x} 16V9`} stroke={colour} strokeWidth="0.9" />
              <circle cx={x} cy="7" r="2.4" fill="#ffffff" stroke={colour} strokeWidth="0.9" />
            </g>
          ))}
          {[18, 30].map((x) => (
            <g key={x}>
              <path d={`M${x} 21v7`} stroke="#e69f00" strokeWidth="0.9" />
              <circle cx={x} cy="30" r="2.4" fill="#ffffff" stroke="#e69f00" strokeWidth="0.9" />
            </g>
          ))}
          <path d="M42 16V9" stroke="#d55e00" strokeWidth="0.9" />
          <circle cx="42" cy="7" r="2.4" fill="#ffffff" stroke="#d55e00" strokeWidth="0.9" />
        </>
      )}
    </svg>
  )
}

/** The marker buttons that pick an event's kind. */
function KindPicker({ settings, value, onPick, event }: { settings: TimelineSettings; value: number; onPick: (kind: number) => void; event: string }) {
  return (
    <div role="group" aria-label={`${event} kind`} className="flex shrink-0 items-center gap-0.5">
      {settings.kinds.map((kind, i) => (
        <button
          key={i}
          type="button"
          title={kind.name || `Kind ${i + 1}`}
          aria-label={kind.name || `Kind ${i + 1}`}
          aria-pressed={value === i}
          onClick={() => onPick(i)}
          className={cn(
            'grid size-7 place-items-center rounded-md border transition-colors duration-(--duration-instant) focus-visible:outline-2 focus-visible:outline-ring',
            value === i ? 'border-primary/40 bg-primary-subtle' : 'border-transparent opacity-45 hover:bg-muted hover:opacity-100',
          )}
        >
          <MarkerPicture shape={kind.marker} colour={kindColour(settings, i)} />
        </button>
      ))}
    </div>
  )
}

/** A small card holding a list of rows, like a sequence's labels and steps. */
function ListCard({ title, top, children }: { title: string; top?: ReactNode; children: ReactNode }) {
  return (
    <div className="px-3 pt-1 pb-3">
      <div className="rounded-lg border border-border bg-muted/40 p-2">
        {top}
        <div className="px-1 pb-1.5 text-xs text-muted-foreground">{title}</div>
        <div className="flex flex-col gap-1">{children}</div>
      </div>
    </div>
  )
}

type Props = {
  figure: FigureCanvas | null
  /** The selected timeline; its settings are in `timeline.timeline`. */
  timeline: SelectionInfo
  /** Back to the block cards; also lets go of the timeline. */
  onBack: () => void
}

export function TimelineProperties({ figure, timeline, onBack }: Props) {
  const toasts = useToast()
  const settings = timeline.timeline
  if (!settings) return null
  const events = eventsByDay(settings)
  const unit = settings.unit.trim() || 'Day'
  return (
    <>
      <PropertiesHeader backLabel="Back to blocks" picture={<CalendarRange />} name="Experiment timeline" onBack={onBack} />
      {/* The axis's length and unit sit at the top of the events' card, right above them (owner's feedback, 2026-11-26). */}
      <ListCard
        title="Events"
        top={
          <div className="mb-2.5 flex min-w-0 items-end gap-1.5 border-b border-border pb-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span aria-hidden="true" className="px-1 text-xs text-muted-foreground">Length</span>
              <NumberField label="Length" suffix={settings.length === 1 ? unit.toLowerCase() : `${unit.toLowerCase()}s`} value={settings.length} min={TIMELINE_LENGTH.min} max={TIMELINE_LENGTH.max} dense onCommit={(length) => figure?.setTimeline({ length: Math.round(length) })} className="w-full" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span aria-hidden="true" className="px-1 text-xs text-muted-foreground">Unit</span>
              <LiveTextField label="Unit" value={settings.unit} placeholder="No unit" onType={(text) => figure?.setTimeline({ unit: text }, 'timeline-unit')} onDone={() => undefined} className="w-full" />
            </div>
          </div>
        }
      >
        {events.map((event, i) => (
          <div key={event.index} className="flex min-w-0 items-center gap-1.5">
            <KindPicker settings={settings} value={event.kind} event={`Event ${i + 1}`} onPick={(kind) => figure?.setEvent(event.index, { kind })} />
            <NumberField label={`Event ${i + 1} ${unit.toLowerCase()}`} prefix={unit} value={event.day} min={0} max={TIMELINE_LENGTH.max} dense onCommit={(day) => figure?.setEvent(event.index, { day: Math.round(day * 10) / 10 })} className="min-w-0 flex-1" />
            <IconButton icon={Minus} label={events.length < 2 ? 'A timeline keeps at least one event' : `Remove event ${i + 1}`} disabled={events.length < 2} onClick={() => removeEventWithUndo(toasts, figure, event.index, i)} />
          </div>
        ))}
        <Button variant="secondary" size="sm" className="mt-1 gap-1.5 self-end" onClick={() => figure?.addEvent()}>
          <Plus aria-hidden="true" />
          Add event
        </Button>
      </ListCard>
      <ListCard title="Kinds of event">
        {settings.kinds.map((kind, i) => (
          <div key={i} className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              title="Click for the next marker shape"
              aria-label={`${kind.name || `Kind ${i + 1}`} marker: ${kind.marker}`}
              onClick={() => {
                const next = MARKERS.at((MARKERS.indexOf(kind.marker) + 1) % MARKERS.length) ?? 'dot'
                figure?.setTimeline({ kinds: settings.kinds.map((each, k) => (k === i ? { ...each, marker: next } : each)) })
              }}
              className="grid size-7 shrink-0 place-items-center rounded-md border border-border-strong bg-panel transition-colors duration-(--duration-instant) hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <MarkerPicture shape={kind.marker} colour={kindColour(settings, i)} />
            </button>
            <LiveTextField
              label={`Kind ${i + 1} name`}
              value={kind.name}
              placeholder="No name"
              onType={(name) => figure?.setTimeline({ kinds: settings.kinds.map((each, k) => (k === i ? { ...each, name } : each)) }, `timeline-kind-${i}`)}
              onDone={() => undefined}
              className="min-w-0 flex-1"
            />
            <IconButton icon={Minus} label={settings.kinds.length < 2 ? 'A timeline keeps at least one kind of event' : `Remove ${kind.name || `kind ${i + 1}`} and its events`} disabled={settings.kinds.length < 2} onClick={() => removeEventKindWithUndo(toasts, figure, i, kind.name)} />
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          className="mt-1 gap-1.5 self-end"
          onClick={() => {
            const unused = MARKERS.find((marker) => !settings.kinds.some((kind) => kind.marker === marker)) ?? 'dot'
            figure?.setTimeline({ kinds: [...settings.kinds, { name: `Kind ${settings.kinds.length + 1}`, marker: unused }] })
          }}
        >
          <Plus aria-hidden="true" />
          Add kind
        </Button>
      </ListCard>
      {settings.style === 'pins' && (
        <ListCard title="Phases">
          {settings.phases.map((phase, i) => (
            <div key={i} className="flex min-w-0 items-center gap-1.5">
              <LiveTextField
                label={`Phase ${i + 1} name`}
                value={phase.name}
                placeholder="No name"
                onType={(name) => figure?.setTimeline({ phases: settings.phases.map((each, k) => (k === i ? { ...each, name } : each)) }, `timeline-phase-${i}`)}
                onDone={() => undefined}
                className="min-w-0 flex-1"
              />
              <NumberField label={`Phase ${i + 1} last ${unit.toLowerCase()}`} prefix="to" value={phase.end} min={0} max={TIMELINE_LENGTH.max} dense onCommit={(end) => figure?.setTimeline({ phases: settings.phases.map((each, k) => (k === i ? { ...each, end } : each)) })} className="w-20 shrink-0" />
              <IconButton icon={Minus} label={`Remove phase ${i + 1}`} onClick={() => figure?.setTimeline({ phases: settings.phases.filter((_, k) => k !== i) })} />
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            className="mt-1 gap-1.5 self-end"
            onClick={() => figure?.setTimeline({ phases: [...settings.phases, { name: `Phase ${settings.phases.length + 1}`, end: settings.length }] })}
          >
            <Plus aria-hidden="true" />
            Add phase
          </Button>
        </ListCard>
      )}
      <PropRows className="border-t border-border pt-3 [&>[data-wide-label]:not(:first-child)]:mt-3">
        <PropRow label="Style" wide>
          <div role="group" aria-label="Timeline style" className="grid w-full grid-cols-3 gap-1.5">
            {TIMELINE_STYLES.map((style) => (
              <Tile key={style.id} name={style.name} short={style.name} on={settings.style === style.id} onClick={() => figure?.setTimeline({ style: style.id })}>
                <StylePicture style={style.id} colour={settings.colour} />
              </Tile>
            ))}
          </div>
        </PropRow>
        <PropRow label="Preset" wide>
          <PresetPicker
            groups={PRESET_GROUPS}
            row={ROW}
            look={swatchLook}
            isOn={(preset) => preset.colour === settings.colour.toLowerCase()}
            onPick={(preset) => figure?.setTimeline({ colour: preset.colour })}
            columns={6}
            customLabel="Custom colour"
            custom={<ColourInput label="Timeline colour" value={settings.colour} onChange={(next) => next && figure?.setTimeline({ colour: next })} used={() => figure?.usedColours() ?? []} className="min-w-0 flex-1" />}
          />
        </PropRow>
      </PropRows>
      <div className="border-t border-border p-3">
        <Button variant="secondary" size="sm" className="w-full gap-1.5" onClick={() => detachTimelineWithUndo(toasts, figure)}>
          <Unlink aria-hidden="true" />
          Detach timeline
        </Button>
      </div>
    </>
  )
}
