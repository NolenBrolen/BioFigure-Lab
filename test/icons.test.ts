import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { checkIcon } from "./helpers/icon-rules.ts";

const root = join(import.meta.dirname, "..");
// The icon library is a separate download (`npm run icons`); it is checked when installed.
const installedDir = join(root, "icons");
const installed = existsSync(installedDir) && readdirSync(installedDir).length > 0;

function filesIn(dir: string, ext: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(ext))
    .map((f) => join(dir, f));
}

const goodSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle cx="64" cy="64" r="40"/></svg>`;
const goodMeta = { name: "Cell", keywords: ["cell"], category: "cells" };

describe("icon rules", () => {
  it("accepts an icon that follows every rule", () => {
    expect(checkIcon(goodSvg, goodMeta)).toEqual([]);
  });

  it("rejects missing name, category or keywords", () => {
    expect(checkIcon(goodSvg, {})).toHaveLength(3);
    expect(checkIcon(goodSvg, { ...goodMeta, keywords: [] })).toHaveLength(1);
    expect(checkIcon(goodSvg, null)).toHaveLength(1);
  });

  it("rejects the wrong size, filters and raster images", () => {
    expect(checkIcon(goodSvg.replace("128 128", "64 64"), goodMeta)).toHaveLength(1);
    expect(checkIcon(goodSvg.replace("<circle", "<filter id='f'/><circle"), goodMeta)).toHaveLength(1);
    expect(checkIcon(goodSvg.replace("<circle", "<image href='x.png'/><circle"), goodMeta)).toHaveLength(1);
  });

  it("accepts an optional text slot inside the grid and rejects a broken one", () => {
    const slot = { x: 34.5, y: 60, width: 59, height: 24 };
    expect(checkIcon(goodSvg, { ...goodMeta, textSlot: slot })).toEqual([]);
    expect(checkIcon(goodSvg, { ...goodMeta, textSlot: { ...slot, width: 0 } })).toHaveLength(1);
    expect(checkIcon(goodSvg, { ...goodMeta, textSlot: { ...slot, x: 100 } })).toHaveLength(1);
    expect(checkIcon(goodSvg, { ...goodMeta, textSlot: { ...slot, y: -1 } })).toHaveLength(1);
    expect(checkIcon(goodSvg, { ...goodMeta, textSlot: { x: 1, y: 1, width: "5", height: 5 } })).toHaveLength(1);
    expect(checkIcon(goodSvg, { ...goodMeta, textSlot: null })).toHaveLength(1);
    // The starting text is optional, and must be a string.
    expect(checkIcon(goodSvg, { ...goodMeta, textSlot: { ...slot, defaultText: "Ethanol" } })).toEqual([]);
    expect(checkIcon(goodSvg, { ...goodMeta, textSlot: { ...slot, defaultText: 5 } })).toHaveLength(1);
  });

  it("rejects anything that could run code or load from elsewhere", () => {
    expect(checkIcon(goodSvg.replace("<circle", "<script>alert(1)</script><circle"), goodMeta)).not.toEqual([]);
    expect(checkIcon(goodSvg.replace("<circle", "<circle onclick='x()'"), goodMeta)).not.toEqual([]);
    expect(checkIcon(goodSvg.replace("<circle", "<use href='https://evil.example/a.svg#x'/><circle"), goodMeta)).not.toEqual([]);
    expect(checkIcon(goodSvg.replace("<circle", "<foreignObject/><circle"), goodMeta)).not.toEqual([]);
  });
});

describe("icon library", () => {
  it.runIf(installed)("every installed icon follows the rules and has its metadata file", () => {
    const iconsDir = installedDir;
    const problems: string[] = [];
    const svgPaths = filesIn(iconsDir, ".svg");
    expect(svgPaths.length).toBeGreaterThan(0);
    for (const svgPath of svgPaths) {
      const name = relative(iconsDir, svgPath);
      const metaPath = svgPath.replace(/\.svg$/, ".json");
      if (!existsSync(metaPath)) {
        problems.push(`${name}: missing ${relative(iconsDir, metaPath)}`);
        continue;
      }
      const meta: unknown = JSON.parse(readFileSync(metaPath, "utf8"));
      for (const p of checkIcon(readFileSync(svgPath, "utf8"), meta)) problems.push(`${name}: ${p}`);
    }
    for (const metaPath of filesIn(iconsDir, ".json")) {
      if (!existsSync(metaPath.replace(/\.json$/, ".svg"))) {
        problems.push(`${relative(iconsDir, metaPath)}: no matching .svg`);
      }
    }
    expect(problems).toEqual([]);
  }, 60_000); // reads every icon in the library, which grows with each batch (1,600+ files)
});
