/**
 * A new random id (a version 4 UUID). Browsers only offer
 * `crypto.randomUUID` on https and localhost; on a plain-http address, such
 * as the dev server opened on a phone over Wi-Fi, the same kind of id is
 * built from `crypto.getRandomValues`, which works everywhere.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const hex = [...crypto.getRandomValues(new Uint8Array(16))].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  // Version 4, and variant 1 (the first digit of the fourth group is 8, 9, a or b).
  const variant = '89ab'.charAt(parseInt(hex.charAt(16), 16) & 3)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20)}`
}
