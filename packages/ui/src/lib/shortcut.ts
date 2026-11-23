/**
 * Keyboard shortcuts are written once, like "Mod+Shift+Z". "Mod" is the main
 * modifier: Ctrl on Windows and Linux, ⌘ on a Mac. These helpers turn that
 * into what the person sees on their own keyboard.
 */

export type Platform = 'mac' | 'other'

const macSymbols: Record<string, string> = {
  Mod: '⌘',
  Ctrl: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Enter: '↩',
  Backspace: '⌫',
  Delete: '⌦',
  Escape: 'Esc',
}

const otherNames: Record<string, string> = {
  Mod: 'Ctrl',
  Escape: 'Esc',
}

/** Best guess of the person's platform; "other" when it can't be told. */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const name = nav.userAgentData?.platform ?? nav.platform
  return /mac|iphone|ipad/i.test(name) ? 'mac' : 'other'
}

/** "Mod+Shift+Z" -> ["⌘", "⇧", "Z"] on a Mac, ["Ctrl", "Shift", "Z"] elsewhere. */
export function shortcutKeys(shortcut: string, platform: Platform = detectPlatform()): string[] {
  const names = platform === 'mac' ? macSymbols : otherNames
  return shortcut
    .split('+')
    .map((key) => key.trim())
    .filter(Boolean)
    .map((key) => names[key] ?? key)
}

/** The shortcut as one string: "⌘⇧Z" on a Mac, "Ctrl+Shift+Z" elsewhere. */
export function formatShortcut(shortcut: string, platform: Platform = detectPlatform()): string {
  return shortcutKeys(shortcut, platform).join(platform === 'mac' ? '' : '+')
}
