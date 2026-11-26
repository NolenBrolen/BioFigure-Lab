/*
 * What the live site (biofigurelab.com) adds to the editor: sign-in with each
 * account's own figures, figure sync between devices, sharing figures with
 * people, the account settings page and the feedback dialog.
 *
 * `site.tsx` says which one this build uses. In this repository it's the live
 * site's; the public release swaps in `noSite` (no-site.tsx), which leaves all
 * of it out, and leaves out the folders it needs (site/account, site/feedback,
 * site/sync, site/sharing).
 * The rest of the editor only talks to the site through this type.
 */
import type { SyncState } from '@biofigure-lab/ui/components/sync-status/SyncStatus'
import type { ComponentType, ReactNode } from 'react'

import type { OpenStore } from '../editor/figure-stores'
import type { LibraryIcon } from '../editor/icon-library'
import type { Figure, FigureStore } from '../editor/storage'

export type Figures = OpenStore & {
  /** Changes when someone signs in, out or switches account: the app then shows that account's start screen. */
  key: string
  signedIn: boolean
}

export type Feedback = {
  /** Opens the feedback dialog: general feedback, or a problem with a library icon. Undefined: no feedback buttons. */
  open?: (icon?: LibraryIcon) => void
  /** The dialog itself, rendered where the hook is used. */
  dialog: ReactNode
}

/** Figure sync for the open figure. Everything is undefined without sync: the figure is saved in this browser only. */
export type FigureSync = {
  status?: Exclude<SyncState, 'local' | 'blocked'>
  /** Try syncing again (clicking the status after it failed). */
  retry?: () => void
  /** This device's name, for the badge on this device's copy of a slide that was also changed elsewhere. */
  deviceName?: string
}

/** Sharing the open figure with people (BIO-34). Without it: no Share button, no faces. */
export type FigureSharing = {
  /** Opens the Share dialog. Undefined: no Share button (signed out, or no sharing in this build). */
  open?: () => void
  /** The Share dialog itself, rendered where the hook is used. */
  dialog: ReactNode
  /** Who else has the figure open, for the top bar; null for nobody. */
  presence: ReactNode
  /** Opened through a share link (BIO-36): who you are here ("Visitor 1"), for the top bar. */
  you?: ReactNode
}

/** Version history of the slide on the canvas (BIO-36). */
export type SlideHistory = {
  /** Opens or closes the history panel. Undefined: no History button (not online, view only, or not in this build). */
  toggle?: () => void
  open: boolean
  /** The panel, in the right panel's place while open; null when closed. */
  panel: ReactNode
  /** While looking at an earlier version: its contents and what it is ("Today, 11:05 · Ana López"), shown over the canvas. */
  preview: { canvas: string | undefined; label: string } | null
}

export type Site = {
  /** The figures to show: the signed-in account's own, or the ones saved in this browser without an account. */
  useFigures: () => Figures
  /**
   * A page of the site's own to show instead of the start screen or the editor (the account settings page, a figure
   * opened through its share link), or null. `screens` are the app's figure screens, for showing a linked figure.
   */
  useScreen: (showStart: () => void, screens: FigureScreens) => ReactNode
  /** The sign-in button or account menu at the right end of the top bars; null leaves the spot out. */
  AccountControl: ComponentType<{ compact?: boolean }> | null
  useFeedback: () => Feedback
  /** Wraps the screens: runs the site's background work (figure sync) and its own dialogs. */
  Provider: ComponentType<{ store: FigureStore; children: ReactNode }>
  /** A bar under the start screen's header (figures moving into the account after signing in), or null. */
  StartBanner: ComponentType | null
  /** Sync for the open figure; `selectSlide` lets a clash message show the slide. */
  useFigureSync: (figureId: string, store: FigureStore, selectSlide: (slideId: string) => void) => FigureSync
  /** Sharing for the open figure; `onLeft` runs after leaving a figure someone shared with you (it's gone from this device). */
  useFigureSharing: (figure: Pick<Figure, 'id' | 'name' | 'access'>, store: FigureStore, onLeft: () => void) => FigureSharing
  /** Version history of a slide; `putBack` puts an earlier version's contents on the canvas (as one undoable step), `undo` takes that back. */
  useSlideHistory: (
    figure: Pick<Figure, 'id' | 'access'>,
    slide: { id: string; number: number },
    actions: { putBack: (canvas: string | undefined) => Promise<void>; undo: () => void },
  ) => SlideHistory
  /** The start screen's extras for shared figures: the All / Yours / Shared with you chips and the faces on a card. Null without sharing. */
  SharedFigures: SharedFigures | null
}

/** The app's two screens for an open figure, handed to the site (so the site's files never import them). */
export type FigureScreens = {
  Editor: ComponentType<{ figure: Figure; store: FigureStore; onBack: () => void; onReload?: () => void }>
  Viewer: ComponentType<{ figure: Figure; store: FigureStore; onBack: () => void; onOpen: (id: string) => void; copyStore?: FigureStore }>
}

/** Which figures the start screen shows. */
export type FigureFilter = 'all' | 'mine' | 'shared'

export type SharedFigures = {
  Filter: ComponentType<{ figures: Figure[]; value: FigureFilter; onValueChange: (value: FigureFilter) => void }>
  /** The faces of the people on a shared figure, for the corner of its picture; nothing for one that isn't shared. */
  Faces: ComponentType<{ figure: Figure }>
}
