/*
 * Controls inside `ExpandedControls` have the room to show themselves in
 * full: the phone's sheet with one setting open (BIO-11). A colour field then
 * shows its swatches right away instead of in a dropdown, and an opacity
 * field becomes a slider.
 */
import { createContext, useContext } from 'react'

export const ExpandedControls = createContext(false)

export const useExpandedControls = () => useContext(ExpandedControls)
