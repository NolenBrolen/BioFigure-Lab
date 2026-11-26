/*
 * The slide strip: a filmstrip of slide pictures along the bottom of the
 * canvas. Click a slide to show it, drag it sideways to reorder, right-click
 * for duplicate and delete, and "+" at the end adds one.
 *
 * Keyboard: Left/Right move between slides, Alt+Left/Right move the slide
 * itself, Delete removes it. Deleting has no confirmation; the editor offers Undo.
 */
import { Copy, Laptop, Plus, Trash2 } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

import { cn } from "../../lib/cn";
import { ContextMenu } from "../menu/Menu";

export type SlideItem = {
  id: string;
  /** A small picture of the slide, as a URL. Missing while it is being drawn. */
  thumbnail?: string;
  /** A short badge on the picture, e.g. "This computer" for this device's version of a slide changed on two devices. */
  badge?: string;
};

export type SlideStripProps = {
  slides: SlideItem[];
  currentId: string;
  /** Page width divided by height, so the pictures have the page's shape. */
  aspect: number;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** Move a slide to a new position (counted in the list without it). */
  onMove: (id: string, index: number) => void;
  /** Look only (a figure shared for viewing): no adding, moving, menus or deleting; the arrow keys still move between slides. */
  readOnly?: boolean;
  className?: string;
};

const THUMB_HEIGHT = 64;

export function SlideStrip({
  slides,
  currentId,
  aspect,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
  readOnly = false,
  className,
}: SlideStripProps) {
  const [drag, setDrag] = useState<{ id: string; over?: number }>();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const width = Math.round(THUMB_HEIGHT * aspect);
  const only = slides.length === 1;

  const focus = (id: string | undefined) =>
    id && requestAnimationFrame(() => buttons.current.get(id)?.focus());

  const onKeyDown = (event: KeyboardEvent, index: number, id: string) => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (readOnly && !(step && !event.altKey)) return;
    if (step && event.altKey) {
      event.preventDefault();
      const to = index + step;
      if (to < 0 || to >= slides.length) return;
      onMove(id, to);
      focus(id);
    } else if (step) {
      event.preventDefault();
      const next = slides[index + step];
      if (next) {
        onSelect(next.id);
        focus(next.id);
      }
    } else if ((event.key === "Delete" || event.key === "Backspace") && !only) {
      event.preventDefault();
      onDelete(id);
      focus((slides[index + 1] ?? slides[index - 1])?.id);
    }
  };

  const drop = () => {
    if (drag?.over === undefined) return setDrag(undefined);
    const from = slides.findIndex((slide) => slide.id === drag.id);
    // `over` is a gap between slides; without the dragged slide, gaps after it shift by one.
    const to = drag.over > from ? drag.over - 1 : drag.over;
    setDrag(undefined);
    if (from >= 0 && to !== from) onMove(drag.id, to);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 overflow-x-auto px-4 py-3",
        className,
      )}
      role="region"
      aria-label="Slides"
    >
      <ol className="flex items-start gap-3">
        {slides.map((slide, index) => {
          const current = slide.id === currentId;
          const thumb = (
            <button
              ref={(element) => {
                if (element) buttons.current.set(slide.id, element);
                else buttons.current.delete(slide.id);
              }}
              type="button"
              draggable={!readOnly}
              aria-label={
                slide.badge
                  ? `Slide ${index + 1}, ${slide.badge}`
                  : `Slide ${index + 1}`
              }
              aria-current={current ? "true" : undefined}
              // One stop in the Tab order: the current slide; arrows move between the others.
              tabIndex={current ? 0 : -1}
              onClick={() => onSelect(slide.id)}
              onKeyDown={(event) => onKeyDown(event, index, slide.id)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", slide.id);
                setDrag({ id: slide.id });
              }}
              onDragEnd={() => setDrag(undefined)}
              className={cn(
                "group flex flex-col items-center gap-1 rounded-md outline-none",
                drag?.id === slide.id && "opacity-50",
              )}
            >
              <span
                style={{ width, height: THUMB_HEIGHT }}
                className={cn(
                  "relative block overflow-hidden rounded-md ring-offset-2 ring-offset-canvas transition-shadow duration-(--duration-fast)",
                  current
                    ? "ring-2 ring-primary"
                    : "ring-1 ring-border group-hover:ring-foreground/30",
                  "group-focus-visible:ring-2 group-focus-visible:ring-ring",
                )}
              >
                {slide.thumbnail ? (
                  // The white slide dims in dark mode like the page (--page-dim); the ring and badge don't.
                  <span className="absolute inset-0 bg-white dark:brightness-(--page-dim)">
                    <img
                      src={slide.thumbnail}
                      alt=""
                      draggable={false}
                      className="size-full object-contain"
                    />
                  </span>
                ) : (
                  <span className="block size-full animate-pulse bg-muted" />
                )}
                {slide.badge && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded bg-[light-dark(#fdf3e1,#36280f)] px-1 py-0.5 text-[10px] leading-none font-medium whitespace-nowrap text-[light-dark(#8a4d05,#fbbf24)]"
                  >
                    <Laptop className="size-3 shrink-0" />
                    <span className="truncate">{slide.badge}</span>
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  current ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
            </button>
          );
          return (
            <li
              key={slide.id}
              className="relative shrink-0"
              onDragOver={(event) => {
                if (!drag) return;
                event.preventDefault();
                const box = event.currentTarget.getBoundingClientRect();
                const over =
                  event.clientX > box.left + box.width / 2 ? index + 1 : index;
                if (over !== drag.over) setDrag({ ...drag, over });
              }}
              onDrop={(event) => {
                event.preventDefault();
                drop();
              }}
            >
              {drag?.over === index && (
                <span
                  aria-hidden
                  className="absolute top-0 -left-2 h-16 w-0.5 rounded bg-primary"
                />
              )}
              {drag?.over === index + 1 && index === slides.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-0 -right-2 h-16 w-0.5 rounded bg-primary"
                />
              )}
              {readOnly ? (
                thumb
              ) : (
                <ContextMenu
                  sections={[
                    {
                      label: "Slide",
                      actions: [
                        {
                          label: "Duplicate slide",
                          icon: Copy,
                          onClick: () => onDuplicate(slide.id),
                        },
                        {
                          label: "Delete slide",
                          icon: Trash2,
                          danger: true,
                          disabled: only,
                          onClick: () => onDelete(slide.id),
                        },
                      ],
                    },
                  ]}
                >
                  {thumb}
                </ContextMenu>
              )}
            </li>
          );
        })}
      </ol>
      {!readOnly && (
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add slide"
          title="Add slide"
          style={{ width, height: THUMB_HEIGHT }}
          className="flex shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="size-5" aria-hidden />
        </button>
      )}
    </div>
  );
}
