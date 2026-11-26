/*
 * The editor without the live site's extras (see types.ts): no sign-in, no
 * sync, no feedback dialog. Figures are saved in this browser only. The public release
 * builds with this one.
 */
import { storeFor } from '../editor/figure-stores'
import type { Site } from './types'

export const noSite: Site = {
  useFigures: () => ({ ...storeFor(), key: '', signedIn: false }),
  useScreen: () => null,
  AccountControl: null,
  useFeedback: () => ({ dialog: null }),
  Provider: ({ children }) => children,
  StartBanner: null,
  useFigureSync: () => ({}),
  useFigureSharing: () => ({ dialog: null, presence: null }),
  useSlideHistory: () => ({ open: false, panel: null, preview: null }),
  SharedFigures: null,
}
