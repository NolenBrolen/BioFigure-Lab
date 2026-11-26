/*
 * The figures that ship with the app, as figure files in this folder (nothing
 * is loaded from an outside server): the example every new visitor finds in
 * their list, and the templates in New figure > From a template. Each file is
 * read only when it is needed, so the app starts without them.
 */
import type { PageMm } from '../editor/page-size'

/** A figure as saved in a file: what the editor stores, minus its id and dates. */
export type FigureFile = {
  name: string
  page: PageMm
  slides: { id: string; canvas?: string; thumbnail?: string }[]
  thumbnail?: string
}

export type Template = {
  id: string
  /** The name the new figure gets, and the card's name. */
  name: string
  /** One line under the name: what the figure shows. */
  detail: string
  load: () => Promise<FigureFile>
}

const read = async (file: Promise<{ default: string }>): Promise<FigureFile> => JSON.parse((await file).default) as FigureFile

/** The sample figure added once to a new visitor's list. */
export const EXAMPLE_NAME = 'Example figure'
export const loadExample = () => read(import('./example.figure.json?raw'))

export const TEMPLATES: readonly Template[] = [
  { id: 'cell-culture', name: 'Cell culture workflow', detail: 'Steps with lab equipment, mechanism, bar chart', load: () => read(import('./cell-culture.figure.json?raw')) },
  { id: 'signalling-pathway', name: 'Signalling pathway', detail: 'Receptor in a membrane, to the nucleus', load: () => read(import('./signalling-pathway.figure.json?raw')) },
  { id: 'vaccine-study', name: 'Study timeline', detail: 'Timeline, immune cells, result chart', load: () => read(import('./vaccine-study.figure.json?raw')) },
  { id: 'multi-panel', name: 'Multi-panel results', detail: 'Panels A, B and C with charts', load: () => read(import('./multi-panel.figure.json?raw')) },
  { id: 'gene-to-protein', name: 'Gene to protein', detail: 'DNA, mRNA, protein', load: () => read(import('./gene-to-protein.figure.json?raw')) },
]
