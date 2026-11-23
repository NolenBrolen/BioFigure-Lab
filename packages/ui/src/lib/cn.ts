import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Joins class names and lets later Tailwind classes win over earlier ones,
 * so `cn('px-2', isWide && 'px-4')` gives `px-4`. Components use it to let a
 * `className` prop override their own styles.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
