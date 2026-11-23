// Licences a dependency may have so the app can still be released under AGPL-3.0.
// Add a licence here only after checking it is compatible with AGPL-3.0.
export const ALLOWED_DEPENDENCY_LICENCES = new Set([
  "MIT",
  "MIT-0", // MIT without the attribution requirement (used by jsdom's CSS helpers)
  "ISC",
  "0BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "BlueOak-1.0.0",
  "MPL-2.0",
  "Zlib",
  "Unlicense",
  "CC0-1.0",
  "CC-BY-4.0",
  "OFL-1.1",
  "Python-2.0",
  "LGPL-3.0-or-later",
  "GPL-3.0-or-later",
  "AGPL-3.0-only",
  "AGPL-3.0-or-later",
]);

// True when an SPDX licence expression such as "MIT", "(MIT OR Apache-2.0)" or
// "MIT AND Zlib" only lets in allowed licences. Mixed AND/OR expressions are
// treated strictly: every licence named must be allowed.
export function isAllowedLicence(expression: string | undefined): boolean {
  if (!expression) return false;
  const ids = expression.replace(/[()]/g, " ").split(/\s+(?:AND|OR)\s+|\s+/).filter(Boolean);
  if (ids.length === 0) return false;
  if (/\sAND\s/.test(expression) || !/\sOR\s/.test(expression)) {
    return ids.every((id) => ALLOWED_DEPENDENCY_LICENCES.has(id));
  }
  return ids.some((id) => ALLOWED_DEPENDENCY_LICENCES.has(id));
}

// Packages whose package.json gives the licence in the old `licenses` list,
// which the lock file leaves out. Each was checked by hand against its LICENSE file.
export const LICENCES_CHECKED_BY_HAND: Record<string, string> = {
  jstat: "MIT", // checked 2026-11-07, LICENSE file is the MIT licence
};
