/**
 * Light or dark mode. Follows the operating system until the person picks one
 * with the top bar button; that choice is remembered in this browser.
 * The figure page stays white either way.
 */
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
const KEY = 'biofigure-lab:theme'

function savedTheme(): Theme | undefined {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : undefined
  } catch {
    return undefined
  }
}

const systemTheme = (): Theme => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

export function useTheme(): [Theme, () => void] {
  const [chosen, setChosen] = useState(savedTheme)
  const [system, setSystem] = useState(systemTheme)

  // Keep up when the operating system switches, e.g. at sunset.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystem(systemTheme())
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  // On <html>, so menus and tooltips that open outside the screen follow too.
  useEffect(() => {
    if (chosen) document.documentElement.dataset.theme = chosen
    else delete document.documentElement.dataset.theme
  }, [chosen])

  const theme = chosen ?? system
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setChosen(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Storage blocked: the choice lasts until the page is reloaded.
    }
  }
  return [theme, toggle]
}
