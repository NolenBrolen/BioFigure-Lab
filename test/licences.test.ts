import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isAllowedLicence, LICENCES_CHECKED_BY_HAND } from "./helpers/licences.ts";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const readJson = (path: string) => JSON.parse(read(path)) as Record<string, unknown>;

const LICENCE_TITLES: Record<string, string> = {
  "AGPL-3.0-or-later": "GNU AFFERO GENERAL PUBLIC LICENSE",
  MIT: "MIT License",
};

const workspaces = ["apps", "packages"].flatMap((dir) =>
  readdirSync(join(root, dir), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => `${dir}/${d.name}`),
);

describe("licence split", () => {
  it("keeps the root under AGPL-3.0-or-later", () => {
    expect(readJson("package.json").license).toBe("AGPL-3.0-or-later");
    expect(read("LICENSE")).toContain(LICENCE_TITLES["AGPL-3.0-or-later"]);
  });

  it("keeps each part under its decided licence", () => {
    const decided: Record<string, string> = {
      "apps/editor": "AGPL-3.0-or-later",
      "apps/api": "AGPL-3.0-or-later",
      "apps/site": "AGPL-3.0-or-later",
      "packages/ui": "AGPL-3.0-or-later",
      "packages/export": "MIT",
    };
    // The website (apps/site) is not part of the public release, so it is only checked where it exists.
    for (const [dir, licence] of Object.entries(decided)) {
      if (dir === "apps/site" && !existsSync(join(root, dir))) continue;
      expect(readJson(`${dir}/package.json`).license, dir).toBe(licence);
    }
  });

  it("gives every app and package a LICENSE file matching its package.json", () => {
    for (const dir of workspaces) {
      const licence = readJson(`${dir}/package.json`).license as string;
      const title = LICENCE_TITLES[licence];
      expect(title, `${dir} has unexpected licence ${licence}`).toBeDefined();
      expect(existsSync(join(root, dir, "LICENSE")), `${dir}/LICENSE missing`).toBe(true);
      expect(read(`${dir}/LICENSE`), dir).toContain(title);
    }
  });

  it("keeps the icon library licence's self-hosting, reuse limits and contact", () => {
    const licence = read("ICON-LICENSE.md");
    expect(licence).toContain("## 2. Self-hosting");
    expect(licence).toContain("## 3. Not allowed without written permission from BioFigure Lab");
    expect(licence).toContain("contact@biofigurelab.com");
    // The icon library is a separate download; its README points back to this licence when installed.
    if (existsSync(join(root, "icons", "README.md"))) expect(read("icons/README.md")).toContain("(../ICON-LICENSE.md)");
  });

  it("never lets an MIT package depend on AGPL code", () => {
    const agplNames = workspaces
      .map((dir) => readJson(`${dir}/package.json`))
      .filter((pkg) => pkg.license !== "MIT")
      .map((pkg) => pkg.name as string);
    for (const dir of workspaces) {
      const pkg = readJson(`${dir}/package.json`);
      if (pkg.license !== "MIT") continue;
      const deps = Object.keys({
        ...(pkg.dependencies as object),
        ...(pkg.peerDependencies as object),
      });
      expect(deps.filter((d) => agplNames.includes(d)), dir).toEqual([]);
    }
  });
});

describe("dependency licences", () => {
  it("only installs packages with AGPL-compatible licences", () => {
    const lock = readJson("package-lock.json");
    const packages = lock.packages as Record<string, { license?: string; link?: boolean }>;
    const bad = Object.entries(packages)
      .filter(([path, info]) => path.startsWith("node_modules/") && !info.link)
      .map(([path, info]) => {
        const name = path.replace(/^.*node_modules\//, "");
        return { name, licence: info.license ?? LICENCES_CHECKED_BY_HAND[name] };
      })
      .filter(({ licence }) => !isAllowedLicence(licence))
      .map(({ name, licence }) => `${name}: ${licence ?? "no licence"}`);
    expect(bad).toEqual([]);
  });
});

describe("isAllowedLicence", () => {
  it("accepts permissive licences and OR-choices with one allowed option", () => {
    expect(isAllowedLicence("MIT")).toBe(true);
    expect(isAllowedLicence("(MIT OR Apache-2.0)")).toBe(true);
    expect(isAllowedLicence("(BUSL-1.1 OR MIT)")).toBe(true);
    expect(isAllowedLicence("MIT AND Zlib")).toBe(true);
  });

  it("rejects missing, proprietary and unknown licences", () => {
    expect(isAllowedLicence(undefined)).toBe(false);
    expect(isAllowedLicence("UNLICENSED")).toBe(false);
    expect(isAllowedLicence("SEE LICENSE IN LICENSE.md")).toBe(false);
    expect(isAllowedLicence("BUSL-1.1")).toBe(false);
    expect(isAllowedLicence("MIT AND BUSL-1.1")).toBe(false);
  });
});
