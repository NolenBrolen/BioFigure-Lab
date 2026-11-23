/*
 * The editor screen: top bar, icon library on the left, the figure page in the
 * middle and the properties of the selection on the right. The layout follows
 * the sample screen in packages/ui (EditorSample). The slides of the figure
 * run along the bottom of the canvas.
 *
 * Phones (below 768 px, BIO-11): the canvas fills the screen, the tools sit in
 * a tab bar along the bottom and open their panel in a sheet over the lower
 * half. A selected object swaps the tabs for its property bar: one item per
 * setting row of its panel, each opening just that row in the sheet. The
 * canvas stays the same element in both layouts, so it can switch live.
 */
import type { ExportSettings } from '@biofigure-lab/export/export-figure'
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { PageSizeMenu } from '@biofigure-lab/ui/components/page-size-menu/PageSizeMenu'
import { PaperPreviewWindow } from '@biofigure-lab/ui/components/paper-preview/PaperPreviewWindow'
import { SlideStrip } from '@biofigure-lab/ui/components/slide-strip/SlideStrip'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { ToolRail } from '@biofigure-lab/ui/components/tool-rail/ToolRail'
import { BottomSheet } from '@biofigure-lab/ui/components/mobile-editor/BottomSheet'
import { MobileTabBar } from '@biofigure-lab/ui/components/mobile-editor/MobileTabBar'
import { PropertyBar } from '@biofigure-lab/ui/components/mobile-editor/PropertyBar'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { ExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { useRowFocus } from '@biofigure-lab/ui/lib/row-focus'
import { usePhoneLayout } from '@biofigure-lab/ui/lib/use-media-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { menuSections, quickActionGroups } from '../editor/canvas-actions'
import { FigureCanvas, type CanvasState } from '../editor/FigureCanvas'
import { actionForKey, finishesTyping, textActionForKey } from '../editor/shortcuts'
import { DEFAULT_TEXT_STYLE } from '../editor/text-style'
import { DEFAULT_CHOICE, type Tool } from '../editor/shapes'
import type { FigureStore, Figure } from '../editor/storage'
import { PAGE_PRESETS, type PageMm } from '../editor/page-size'
import { fitZoom, mmToPx, nextZoom } from '../editor/units'
import { CanvasArea } from './CanvasArea'
import { LayersArea } from './LayersArea'
import { ArrowsView, ShapesView } from './DrawPanels'
import { ExportDialog } from './ExportDialog'
import { NewFigureDialog } from './NewFigureDialog'
import { TableView } from './TableView'
import { ChartDataDrawer, dataPanelRoom, GraphView } from './GraphView'
import { IconsView } from './IconsView'
import { editorTools, panelForSelection, panelForTool, panelNames, toolForPanel } from './tools'
import { iconById, loadIconSvg, placementSize } from '../editor/icon-library'
import { PropertiesPanel } from './PropertiesPanel'
import { TextStyleControls, TextView } from './TextView'
import { TopBar } from './TopBar'
import { ArrangeBar } from './ArrangeBar'
import { debugTargets } from '../debug/debug-targets'
import { useExport } from './useExport'
import { useSlides } from './useSlides'
import { useTheme } from './useTheme'
import { BAR_SET_ITEMS, EDIT_TEXT, settingGroups, shapeBarSets, TYPE_TEXT, type BarSet } from './mobile-props'
import { useKeyboardRoom } from './use-keyboard-room'
import { usePinchZoom } from './usePinchZoom'

/** The journal sizes in the page size menu above the canvas. */
const PAGE_OPTIONS = PAGE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label, ...preset.page }))

/** A page size in mm as page pixels. */
const pagePx = (page: PageMm) => ({ width: mmToPx(page.width), height: mmToPx(page.height) })

/** Phones: how much bigger new icons, shapes, arrows and text start than on a desktop (see `FigureCanvas.placeScale`). */
const PHONE_PLACE_SCALE = 1.5

/** Phones: the Place button under each drawing tool's panel, and the tool it uses when none is picked yet. Text has none: its tab places text right away. */
const PLACE_LABELS: Record<string, string> = { arrows: 'Place arrow', shapes: 'Place shape', graph: 'Place chart', table: 'Place table' }
const PLACE_DEFAULTS: Record<string, Tool> = { arrows: 'arrow', shapes: 'rectangle', graph: 'chart', table: 'table' }

/** Spacing of the snapping grid. */
const GRID_MM = 5

const initialState: CanvasState = { selection: null, layers: [], selectedLayerIds: [], canUndo: false, canRedo: false, zoom: 1, tool: 'select', transforming: false, newText: DEFAULT_TEXT_STYLE, nextShapeText: DEFAULT_TEXT_STYLE, drawChoice: DEFAULT_CHOICE }

type EditorScreenProps = {
  /** The figure as it was stored when it was opened. */
  figure: Figure
  store: FigureStore
  /** Back to the start screen, after the last changes are saved. */
  onBack: () => void
}

export function EditorScreen({ figure: saved, store, onBack }: EditorScreenProps) {
  const [pageMm, setPageMm] = useState(saved.page)
  const page = useMemo(() => pagePx(pageMm), [pageMm])
  // The canvas is made once, at the size the figure had when opened; `setPage` changes it later.
  const [firstPage] = useState(page)
  const [customSizeOpen, setCustomSizeOpen] = useState(false)
  const toasts = useToast()
  const [name, setName] = useState(saved.name)
  const [saveFailed, setSaveFailed] = useState(false)
  const [state, setState] = useState(initialState)
  // The chart data drawer under the page, shown while a chart is selected. Each chart keeps
  // whether its drawer was minimised, so selecting it again shows the drawer the same way.
  const [collapsedCharts, setCollapsedCharts] = useState<ReadonlySet<string>>(new Set())
  const selectedChart = state.selection?.chart ? state.selectedLayerIds.join(',') : ''
  const dataCollapsed = collapsedCharts.has(selectedChart)
  const setDataCollapsed = (collapsed: boolean) =>
    setCollapsedCharts((current) => {
      const next = new Set(current)
      if (collapsed) next.add(selectedChart)
      else next.delete(selectedChart)
      return next
    })
  const [figure, setFigure] = useState<FigureCanvas | null>(null)
  const [theme, toggleTheme] = useTheme()
  const [snapToGrid, setSnapToGrid] = useState(false)
  // The open panel in the tool rail; a tool's key opens its panel too.
  const [railTool, setRailTool] = useState('icons')
  // Each kind of object shows its properties in its tool's panel on the left (its home), so
  // selecting one opens that panel and turns it into the object's properties. Groups and several
  // objects at once have no home: their properties stay in the right panel.
  const selectedShape = state.selection?.kind === 'shape' ? state.selection : undefined
  const home = state.selection ? panelForSelection[state.selection.kind] : undefined
  const selectionKey = state.selectedLayerIds.join(',')
  const [openedFor, setOpenedFor] = useState('')
  const [propsOpen, setPropsOpen] = useState(false)
  // A new selection opens its properties, also an icon just added from the library.
  if (home && selectionKey !== openedFor) {
    setOpenedFor(selectionKey)
    setPropsOpen(true)
    setRailTool(home)
  } else if (!home && openedFor) {
    setOpenedFor('')
    setPropsOpen(false)
  }
  /** The properties in a panel on the left are open for this panel. */
  const openIn = (panel: string) => propsOpen && home === panel
  // Back to the panel's tiles is done with the object too, so clicking it again opens it again.
  const backToTiles = () => {
    setPropsOpen(false)
    figure?.clearSelection()
  }
  const phone = usePhoneLayout()
  // Phones: whether the sheet is open, and which setting it shows while something is selected.
  const [sheetOpen, setSheetOpen] = useState(false)
  // How tall the open sheet is: the page moves up into the room above it.
  const [sheetHeight, setSheetHeight] = useState(0)
  const [focus, setFocus] = useState<string>()
  const [sheetFor, setSheetFor] = useState('')
  // Phones, a shape that takes text: which of its Shape and Text sets the bar shows (none: just those two buttons).
  const [barSet, setBarSet] = useState<BarSet>()
  // Phones: a slider in the sheet is being dragged. The object's frame, handles and quick actions step aside meanwhile, to show the change.
  const [sliding, setSliding] = useState(false)
  // A new selection (or none) closes the sheet, so the page and the new bar are in view.
  if (selectionKey !== sheetFor) {
    setSheetFor(selectionKey)
    setSheetOpen(false)
    setFocus(undefined)
    setBarSet(undefined)
  }
  // Starting to type in a shape (its Type button, or a double tap) closes the sheet, so the shape shows above
  // the keyboard, and opens the bar's Text items, for styling what is typed.
  const typingInShape = state.selection?.typingInShape === true
  const [wasTypingInShape, setWasTypingInShape] = useState(typingInShape)
  if (typingInShape !== wasTypingInShape) {
    setWasTypingInShape(typingInShape)
    if (typingInShape) {
      setSheetOpen(false)
      setBarSet('text')
    }
  }
  const addIcon =(add: () => Promise<unknown> | undefined) => {
    void add()
  }
  const [exportOpen, setExportOpen] = useState(false)
  // The paper preview shows the slide on screen as it was when Preview was clicked.
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewSvg, setPreviewSvg] = useState('')
  const [exportSettings, setExportSettings] = useState<ExportSettings>({ format: 'png', dpi: 300, transparent: false })
  const [exportAll, setExportAll] = useState(false)
  const startExport = useExport()
  const canvasHost = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const sheetBody = useRef<HTMLDivElement>(null)
  // What is stored now, so opening a figure without changing it doesn't save (and move it to the top of the list).
  const stored = useRef<{ fingerprint?: string; hasThumbnail: boolean }>({ hasThumbnail: Boolean(saved.thumbnail) })
  const [firstCanvas] = useState(saved.slides[0]?.canvas)
  const slides = useSlides(saved.slides, figure)
  const { withCurrent, refresh } = slides
  /** What decides whether there is something new to save: the name and every slide's contents, in order. */
  const fingerprint = useCallback((list: Figure['slides']) => JSON.stringify([name, pageMm, list.map((slide) => [slide.id, slide.canvas])]), [name, pageMm])

  // Make the Fabric canvas in its own fresh <canvas> element, so React's
  // second run of this effect in development never reuses a disposed one.
  useEffect(() => {
    const host = canvasHost.current
    if (!host) return
    const element = document.createElement('canvas')
    host.append(element)
    const created = new FigureCanvas(element, firstPage, firstCanvas)
    setFigure(created)
    if (import.meta.env.DEV) debugTargets.figure = created
    const unsubscribe = created.subscribe(setState)
    return () => {
      unsubscribe()
      setFigure(null)
      if (import.meta.env.DEV && debugTargets.figure === created) debugTargets.figure = null
      void created.dispose().then(() => element.remove())
    }
  }, [firstPage, firstCanvas])

  /** The zoom that fits the page in view. */
  const fitValue = useCallback(() => {
    const space = viewport.current
    const host = canvasHost.current
    const frame = host?.parentElement
    if (!space || !host || !frame) return undefined
    // Leave room for what sits around the page (padding and the size menu above), so it fits without a scrollbar.
    const around = { width: frame.offsetWidth - host.offsetWidth, height: frame.offsetHeight - host.offsetHeight }
    return fitZoom(page, { width: space.clientWidth - around.width, height: space.clientHeight - around.height }, 0)
  }, [page])
  const zoomToFit = useCallback(() => {
    const zoom = fitValue()
    if (figure && zoom !== undefined) figure.setZoom(zoom)
  }, [figure, fitValue])

  useEffect(zoomToFit, [zoomToFit])
  // Switching between the phone and desktop layouts changes the room for the page.
  useEffect(() => {
    const timer = setTimeout(zoomToFit, 0)
    return () => clearTimeout(timer)
  }, [phone, zoomToFit])
  usePinchZoom(viewport, canvasHost, figure, phone, fitValue)
  const keyboardRoom = useKeyboardRoom(viewport, phone)
  // Phones place new things bigger, so they're easy to see and grab at a phone's zoom (owner's call, 2026-11-17).
  useEffect(() => {
    if (figure) figure.placeScale = phone ? PHONE_PLACE_SCALE : 1
  }, [figure, phone])

  // Room under the page while the chart's data panel floats over the canvas, so the page can scroll up above it.
  const dataInset = state.selection?.chart ? dataPanelRoom(dataCollapsed) : undefined

  const saveNow = useCallback(async () => {
    if (!figure || figure.loading || stored.current.fingerprint === undefined) return
    const list = withCurrent(slides.slides)
    const now = fingerprint(list)
    if (now === stored.current.fingerprint && stored.current.hasThumbnail) return
    stored.current = { fingerprint: now, hasThumbnail: true }
    const withThumbnail = withCurrent(slides.slides, true)
    refresh(withThumbnail)
    try {
      await store.save(saved.id, { name, page: pageMm, slides: withThumbnail, thumbnail: withThumbnail[0]?.thumbnail })
      setSaveFailed(false)
    } catch {
      setSaveFailed(true)
    }
  }, [figure, name, pageMm, saved.id, store, slides.slides, withCurrent, refresh, fingerprint])

  // The page as it looks once opened is the starting point for "has it changed".
  useEffect(() => {
    if (figure && !figure.loading && stored.current.fingerprint === undefined) stored.current.fingerprint = fingerprint(withCurrent(slides.slides))
  }, [figure, state, fingerprint, withCurrent, slides.slides])

  // A press in the dark area around the page (not on its scrollbars) stops typing, as a press beside the text does.
  useEffect(() => {
    const space = viewport.current
    if (!figure || !space) return
    const onDown = (event: PointerEvent) => {
      const onScrollbar = event.target === space && (event.offsetX >= space.clientWidth || event.offsetY >= space.clientHeight)
      if (onScrollbar || canvasHost.current?.contains(event.target as Node)) return
      figure.pressOutsidePage()
      // Phones have no Done button: a tap anywhere off the object lets go of it, the grey around the page too.
      if (phone && event.isPrimary) figure.clearSelection()
    }
    space.addEventListener('pointerdown', onDown)
    return () => space.removeEventListener('pointerdown', onDown)
  }, [figure, phone])

  useEffect(() => figure?.setGrid(snapToGrid ? mmToPx(GRID_MM) : undefined), [figure, snapToGrid])

  // Opening another panel (from the rail, a key or selecting an object) turns off a drawing tool that belongs to a different panel.
  useEffect(() => {
    if (figure && toolForPanel(state.tool, railTool) !== state.tool) figure.setTool('select')
  }, [figure, railTool, state.tool])

  // Save a moment after each change, so a drag doesn't save on every frame.
  useEffect(() => {
    const timer = setTimeout(() => void saveNow(), 300)
    return () => clearTimeout(timer)
  }, [saveNow, state])

  const goBack = () => void saveNow().then(onBack)

  /** A new page size for every slide; what's on them scales to fit. A toast offers Undo. */
  const changePage = (to: PageMm) => {
    const from = pageMm
    if (to.width === from.width && to.height === from.height) return
    setPageMm(to)
    void slides.resizePage(pagePx(from), pagePx(to)).then((putBack) => {
      if (!putBack) return
      const preset = PAGE_PRESETS.find((item) => item.page.width === to.width && item.page.height === to.height)
      const toastId = toasts.add({
        title: `Page is now ${preset ? preset.label.toLowerCase() : `${to.width} × ${to.height} mm`}`,
        description: 'Everything on it was scaled to fit.',
        actionProps: {
          children: 'Undo',
          onClick: () => {
            toasts.close(toastId)
            setPageMm(from)
            putBack()
          },
        },
      })
    })
  }

  // Keyboard shortcuts, except while typing in a field or in a text box.
  useEffect(() => {
    if (!figure) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      // Text styling keys work while typing in text on the page (Fabric's hidden field) and with text selected.
      const typing = target?.dataset.fabric === 'textarea'
      if (typing && finishesTyping(event)) {
        event.preventDefault()
        return figure.finishTyping()
      }
      const text = figure.textStyle()
      const textKey = text && (typing || !target?.closest('input, textarea, [contenteditable="true"]')) ? textActionForKey(event, typing) : undefined
      if (text && textKey) {
        event.preventDefault()
        if (textKey === 'bold') return void figure.changeText({ bold: !text.bold })
        if (textKey === 'italic') return void figure.changeText({ italic: !text.italic })
        if (textKey === 'underline') return void figure.changeText({ underline: !text.underline })
        const script = textKey === 'subscript' ? 'sub' : 'super'
        return void figure.changeText({ script: text.script === script ? 'none' : script })
      }
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (figure.selectInText(event)) return event.preventDefault()
      // Picked table cells take Enter, typing, arrows and Delete first, like a spreadsheet.
      const forTable = figure.tableKey(event)
      if (forTable === 'typing') return
      if (forTable) {
        event.preventDefault()
        return
      }
      const action = actionForKey(event)
      if (!action) return
      // Fabric types into a hidden textarea while a text box is being edited; that
      // is caught above, so these keys only reach here outside text editing.
      event.preventDefault()
      switch (action.type) {
        case 'tool': {
          const panel = panelForTool[action.tool]
          if (panel) setRailTool(panel)
          return figure.setTool(action.tool)
        }
        case 'undo':
          return figure.undo()
        case 'redo':
          return figure.redo()
        case 'delete':
          return figure.deleteSelection()
        case 'zoom-in':
          return figure.setZoom(nextZoom(figure.zoom, 'in'))
        case 'zoom-out':
          return figure.setZoom(nextZoom(figure.zoom, 'out'))
        case 'zoom-fit':
          return zoomToFit()
        case 'bring-to-front':
          return figure.arrange('front')
        case 'send-to-back':
          return figure.arrange('back')
        case 'bring-forward':
          return figure.arrange('forward')
        case 'send-backward':
          return figure.arrange('backward')
        case 'lock':
          return figure.toggleLock()
        case 'select-all':
          return figure.selectAll()
        case 'duplicate':
          return void figure.duplicate()
        case 'copy':
          return void figure.copy()
        case 'cut':
          return void figure.cut()
        case 'paste':
          return void figure.paste()
        case 'group':
          return figure.group()
        case 'ungroup':
          return figure.ungroup()
        case 'previous-slide':
          return slides.step(-1)
        case 'next-slide':
          return slides.step(1)
        case 'escape':
          figure.setTool('select')
          figure.canvas.discardActiveObject()
          figure.canvas.requestRenderAll()
          return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [figure, zoomToFit, slides])

  const openExport = () => {
    if (figure) setExportOpen(true)
  }

  const exportNow = () => {
    if (!figure) return
    setExportOpen(false)
    if (!exportAll || slides.slides.length === 1) return startExport({ svg: figure.toSVG({ background: false }), pageMm, settings: exportSettings, name })
    // Each slide is drawn on a hidden canvas of its own, so the one on screen doesn't change.
    const list = withCurrent(slides.slides)
    void (async () => {
      const hidden = new FigureCanvas(document.createElement('canvas'), page)
      const svgs: string[] = []
      for (const slide of list) {
        await hidden.showSlide(slide.canvas)
        svgs.push(hidden.toSVG({ background: false }))
      }
      void hidden.dispose()
      startExport({ svg: svgs, pageMm, settings: exportSettings, name })
    })()
  }

  const pickTool = (id: string) => {
    setRailTool(id)
    // Opening the Text panel turns on the text tool, so the next click on the page adds text.
    if (id === 'text') figure?.setTool('text')
    // Opening the Arrows panel turns on the arrow tool, unless arrows are selected to restyle.
    if (id === 'arrows' && state.selection?.kind !== 'line') figure?.setTool('arrow')
    // Opening the Shapes panel turns on the rectangle, unless a shape is selected to change.
    if (id === 'shapes' && !selectedShape) {
      figure?.setDrawChoice({ shape: 'rectangle' })
      figure?.setTool('rectangle')
    }
    // Opening the Graph panel turns on the chart tool with the last picked chart (bar at first), unless a chart is selected to change.
    if (id === 'graph' && state.selection?.kind !== 'chart') figure?.setTool('chart')
  }

  const tools = editorTools({
    iconsPanel: (
      <IconsView
        figure={figure}
        icon={state.selection?.kind === 'icon' ? state.selection : undefined}
        open={openIn('icons')}
        onBack={backToTiles}
        // The SVG loads on first use (usually already cached by its library tile).
        onAdd={(icon) => addIcon(async () => { const svg = await loadIconSvg(icon.id); return svg && figure?.addSvg(svg, icon.name, undefined, placementSize(icon) * (figure?.placeScale ?? 1), icon.id) })}
      />
    ),
    arrowsPanel: <ArrowsView figure={figure} tool={state.tool} arrow={state.selection?.kind === 'line' ? state.selection : undefined} />,
    shapesPanel: (
      <ShapesView
        figure={figure}
        tool={state.tool}
        shape={selectedShape}
        open={openIn('shapes')}
        onBack={backToTiles}
        next={state.drawChoice}
        textControls={<TextStyleControls figure={figure} style={selectedShape?.text ?? state.nextShapeText} forShapes />}
      />
    ),
    graphPanel: (
      <GraphView
        figure={figure}
        tool={state.tool}
        selection={state.selection?.chart ? state.selection : undefined}
        open={openIn('graph')}
        onBack={backToTiles}
        onShowData={() => setDataCollapsed(false)}
      />
    ),
    tablePanel: <TableView figure={figure} selection={state.selection?.table ? state.selection : undefined} open={openIn('table')} onBack={backToTiles} />,
    textPanel: <TextView figure={figure} state={state} />,
  })

  const propertiesPanel = (
    <PropertiesPanel
      selection={state.selection}
      home={home && panelNames[home]}
      onShowHome={() => {
        if (!home) return
        setRailTool(home)
        setPropsOpen(true)
      }}
      pageMm={pageMm}
      gridMm={GRID_MM}
      snapToGrid={snapToGrid}
      onSnapToGrid={setSnapToGrid}
      onChange={(patch) => figure?.change(patch)}
      onResize={(change, keep) => figure?.resize(change, keep)}
      usedColours={() => figure?.usedColours() ?? []}
    />
  )

  // Phones: with something selected the sheet holds its properties (its tool's panel, or the
  // page panel for groups), and the property bar lists that panel's settings.
  const editing = phone && state.selection !== null && (home === undefined || propsOpen)
  const railPanel = tools.find((tool) => tool.id === railTool)?.panel
  const [groupRows, setGroupRows] = useState<string[]>()
  const groups = settingGroups(useRowFocus(sheetBody, editing ? groupRows : undefined, editing))
  const group = editing ? groups.find((each) => each.id === focus) : undefined
  // A table without lines: its line colour does nothing, so the bar fades it; a second tap goes to Style, where lines are picked (owner's call, 2026-11-17).
  const lineless = state.selection?.table?.borders === 'none'
  const barItems = groups.map((each) =>
    lineless && each.id === 'Line colour'
      ? { ...each, off: { why: state.selection?.table?.look === 'soft' ? 'The Soft look has no lines. Tap again to pick another look in Style.' : 'This table has no lines. Tap again to pick lines in Style.', goTo: 'Layout' } }
      : each,
  )
  // A shape that takes text: its Shape and Text buttons first, each opening its own items (experiment B).
  const sets = shapeBarSets(barItems)
  const shownItems = sets ? (barSet ? sets[barSet] : [...BAR_SET_ITEMS, ...sets.direct]) : barItems
  const backFromSet = sets && barSet ? { label: 'Back to all settings', onBack: () => { setBarSet(undefined); setSheetOpen(false) } } : undefined
  // The open item's rows. The groups come from what useRowFocus reads, so its rows reach it on the next render.
  if (group?.rows.join('|') !== groupRows?.join('|')) setGroupRows(group?.rows)
  // One setting open: its title names it, so the row's own label steps aside.
  const oneSetting = group?.rows.length === 1
  const pickSetting = (id: string) => {
    if (id === 'set:shape' || id === 'set:text') return setBarSet(id === 'set:shape' ? 'shape' : 'text')
    // A shape's Type item has nothing to set: it starts typing in the shape, within the tap so the keyboard opens.
    if (id === TYPE_TEXT) {
      setSheetOpen(false)
      figure?.typeInSelectedShape()
      return
    }
    // A text's Edit text item likewise starts typing in it.
    if (id === EDIT_TEXT) {
      setSheetOpen(false)
      figure?.editSelectedText()
      return
    }
    if (sheetOpen && focus === id) return setSheetOpen(false)
    setFocus(id)
    setSheetOpen(true)
  }
  // The Place button under a drawing tool's panel: what that panel's tool draws (the tile picked last).
  const placeTool = !editing ? (panelForTool[state.tool] === railTool ? state.tool : PLACE_DEFAULTS[railTool]) : undefined
  const placeLabel = placeTool && PLACE_LABELS[railTool]

  return (
    <div
      className={cn(
        'grid h-dvh w-full gap-px overflow-hidden bg-border text-sm text-foreground',
        phone
          ? 'grid-cols-1 grid-rows-[var(--topbar-height)_minmax(0,1fr)_auto]'
          : 'grid-cols-[calc(var(--rail-width)+1px+var(--panel-left-width))_minmax(0,1fr)_var(--panel-right-width)] grid-rows-[var(--topbar-height)_minmax(0,1fr)]',
      )}
    >
      <TopBar
        name={name}
        onRename={setName}
        onBack={goBack}
        saveFailed={saveFailed}
        canUndo={state.canUndo}
        canRedo={state.canRedo}
        onUndo={() => figure?.undo()}
        onRedo={() => figure?.redo()}
        onExport={openExport}
        theme={theme}
        onToggleTheme={toggleTheme}
        compact={phone}
        arrange={
          figure &&
          !phone &&
          state.selection && (
            <ArrangeBar selection={state.selection} commands={figure} />
          )
        }
      />
      {phone ? null : <ToolRail value={railTool} onValueChange={pickTool} tools={tools} />}
      <div className="flex min-h-0 min-w-0 flex-col bg-canvas">
      {/* The chart's data panel floats over the canvas, so the canvas and slide strip never move when it opens. */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <CanvasArea
        canvasHostRef={canvasHost}
        viewportRef={viewport}
        pageLabel={
          <>
            <PageSizeMenu
              options={PAGE_OPTIONS}
              page={pageMm}
              onPick={(id) => {
                const preset = PAGE_PRESETS.find((item) => item.id === id)
                if (preset) changePage(preset.page)
              }}
              onCustom={() => setCustomSizeOpen(true)}
            />
            <NewFigureDialog
              open={customSizeOpen}
              onOpenChange={setCustomSizeOpen}
              initial={pageMm}
              title="Page size"
              description="Pick a journal column width, or type your own size. Everything on the page scales to fit."
              submitLabel="Change size"
              onCreate={changePage}
            />
          </>
        }
        tool={state.tool}
        zoom={state.zoom}
        onZoomIn={() => figure?.setZoom(nextZoom(figure.zoom, 'in'))}
        onZoomOut={() => figure?.setZoom(nextZoom(figure.zoom, 'out'))}
        onPreview={() => {
          if (!figure) return
          setPreviewSvg(figure.toSVG({ background: false }))
          setPreviewOpen(true)
        }}
        onZoomFit={zoomToFit}
        // Phones: room under the page for the open sheet, so the page sits in view above it instead of behind it (owner's call, 2026-11-17).
        // The keyboard, while typing, slides the page up the same way.
        bottomInset={phone ? (keyboardRoom > 0 ? keyboardRoom + 16 : sheetOpen && sheetHeight > 0 ? sheetHeight + 16 : undefined) : dataInset}
        onDropIcon={(id, clientX, clientY) => {
          const icon = iconById(id)
          const host = canvasHost.current?.getBoundingClientRect()
          if (!figure || !icon || !host) return
          // From the screen to page pixels: the canvas is the page drawn at the current zoom.
          const at = { x: (clientX - host.left) / figure.zoom, y: (clientY - host.top) / figure.zoom }
          addIcon(async () => { const svg = await loadIconSvg(icon.id); return svg && figure.addSvg(svg, icon.name, at, placementSize(icon), icon.id) })
        }}
        selection={state.selection}
        transforming={state.transforming || sliding}
        quickActions={(openMenu) => (figure && state.selection ? quickActionGroups(state.selection, figure, openMenu) : [])}
        menuSections={figure ? menuSections(state.selection, figure, figure.canPaste) : []}
        onRightClick={(x, y) => figure?.selectForMenu({ x, y })}
        compact={phone}
      />
      {phone && (
        <BottomSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          label={editing ? `${state.selection?.name ?? ''} settings` : (panelNames[railTool] ?? 'Tool')}
          // The Axes sheet starts with its Y axis / X axis tabs, which say enough (owner's call, 2026-11-17).
          title={group?.id === 'Axes' ? undefined : group?.label}
          onHeightChange={setSheetHeight}
          // Every sheet is as tall as its content, up to nearly the whole screen, so all its options show at once; the icon library, which scrolls, always takes that height.
          size={!editing && railTool === 'icons' ? 'tall' : 'fit'}
          footer={
            placeTool &&
            placeLabel && (
              <Button
                variant="primary"
                className="h-11 w-full"
                onClick={() => {
                  if (figure?.placeWithTool(placeTool)) setSheetOpen(false)
                }}
              >
                {placeLabel}
              </Button>
            )
          }
        >
          {/* Part of the panel open: each setting runs the full width, its label above it rather than in a column beside it.
              One setting open: the sheet's title names it, so the row's own label steps aside (not the labels of rows inside it, like text spacing). */}
          <div
            ref={sheetBody}
            onPointerDown={(event) => {
              if (!(event.target instanceof Element) || !event.target.closest('[data-slider]')) return
              setSliding(true)
              figure?.hideControls(true)
              const done = () => {
                setSliding(false)
                figure?.hideControls(false)
                window.removeEventListener('pointerup', done)
                window.removeEventListener('pointercancel', done)
              }
              window.addEventListener('pointerup', done)
              window.addEventListener('pointercancel', done)
            }}
            className={cn(
              'flex min-h-0 flex-1 flex-col',
              group && '[&_[data-prop-label]:not([data-prop-row]_*)]:col-span-2 [&_[data-prop-label]:not([data-prop-row]_*)]:pt-2 [&_[data-prop-row]:not([data-prop-row]_*)]:col-span-2 [&_[data-prop-row]:not([data-prop-row]_*)]:flex-wrap',
              oneSetting && '[&_[data-prop-label]:not([data-prop-row]_*)]:hidden',
            )}>
            {/* Editing on a phone, each sheet shows part of the panel, with room to show it in full: all the swatches, sliders.
                Set while the sheet is closed too, so the bar lists the same settings the sheets show (like the text's Highlight). */}
            <ExpandedControls value={editing}>{editing && home === undefined ? propertiesPanel : railPanel}</ExpandedControls>
          </div>
        </BottomSheet>
      )}
      {!phone && state.selection?.chart && <ChartDataDrawer figure={figure} chart={state.selection.chart} collapsed={dataCollapsed} onCollapsedChange={setDataCollapsed} />}
      </div>
      {!phone && <SlideStrip
        className="shrink-0"
        slides={slides.slides}
        currentId={slides.currentId}
        aspect={page.width / page.height}
        onSelect={slides.select}
        onAdd={slides.add}
        onDuplicate={slides.duplicate}
        onDelete={slides.remove}
        onMove={slides.move}
      />}
      </div>
      {/* Right side: page settings (or a group's properties) on top, layers below. Phones show the tab or property bar instead. */}
      {phone ? (
        editing ? (
          <PropertyBar label={`${state.selection?.name ?? ''} settings`} items={shownItems} value={sheetOpen ? focus : undefined} onPick={pickSetting} back={backFromSet} slide={sets ? { key: barSet ?? 'all', from: barSet ? 'right' : 'left' } : undefined} />
        ) : (
          <MobileTabBar
            tabs={tools.map((tool) => ({ ...tool, label: panelNames[tool.id] ?? tool.label }))}
            value={sheetOpen ? railTool : undefined}
            onPick={(id) => {
              if (sheetOpen && id === railTool) return setSheetOpen(false)
              // Text has nothing to pick first: it goes straight on the page, ready to type (the keyboard opens), and its
              // property bar takes over. Placed within the tap, so phones allow the keyboard to open.
              if (id === 'text') {
                setRailTool('text')
                setSheetOpen(false)
                figure?.placeWithTool('text')
                return
              }
              // Graph keeps its panel (pick a chart kind, then Place chart): placing one straight away was tried and
              // dropped (owner's call, 2026-11-17).
              pickTool(id)
              setSheetOpen(true)
            }}
          />
        )
      ) : (
        <div className="flex min-h-0 flex-col gap-px bg-border">
          {propertiesPanel}
          <LayersArea
            layers={state.layers}
            selectedIds={state.selectedLayerIds}
            onSelect={(id, add) => figure?.selectLayer(id, add)}
            onRename={(id, name) => figure?.renameLayer(id, name)}
            onMove={(id, index) => figure?.moveLayer(id, index)}
            onToggleHidden={(id) => figure?.toggleLayerHidden(id)}
            onToggleLocked={(id) => figure?.toggleLayerLocked(id)}
          />
        </div>
      )}
      <PaperPreviewWindow
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        figureMm={pageMm}
        // The figure's own SVG, drawn with the app's fonts; the page stretches it to its size in mm.
        figure={<div className="contents" dangerouslySetInnerHTML={{ __html: previewSvg }} />}
      />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        pageMm={pageMm}
        settings={exportSettings}
        onSettingsChange={setExportSettings}
        slideCount={slides.slides.length}
        allSlides={exportAll}
        onAllSlidesChange={setExportAll}
        onExport={exportNow}
      />
    </div>
  )
}
