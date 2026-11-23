// Problems with one library icon: its SVG text and its parsed JSON metadata.
// An empty list means the icon follows the rules in icons/README.md.
export function checkIcon(svg: string, meta: unknown): string[] {
  const problems: string[] = [];

  const root = /<svg\b[^>]*>/i.exec(svg)?.[0];
  if (!root) {
    problems.push("no <svg> element");
  } else if (!/\bviewBox\s*=\s*["']\s*0\s+0\s+128\s+128\s*["']/.test(root)) {
    problems.push("viewBox must be 0 0 128 128");
  }
  if (/<filter\b/i.test(svg)) problems.push("uses <filter>, which the canvas can't render");
  if (/<image\b/i.test(svg)) problems.push("embeds a raster <image>; icons must be pure vector");
  if (/<script\b/i.test(svg)) problems.push("contains <script>");
  if (/<foreignObject\b/i.test(svg)) problems.push("contains <foreignObject>");
  if (/\son[a-z]+\s*=/i.test(svg)) problems.push("has an event handler attribute (on...=)");
  if (/(?:href|src)\s*=\s*["']\s*(?:https?:|javascript:|data:)/i.test(svg)) {
    problems.push("links to an external or data URL");
  }

  if (typeof meta !== "object" || meta === null) {
    problems.push("metadata is not a JSON object");
    return problems;
  }
  const m = meta as Record<string, unknown>;
  if (typeof m.name !== "string" || m.name.trim() === "") problems.push("metadata needs a name");
  if (typeof m.category !== "string" || m.category.trim() === "") {
    problems.push("metadata needs a category");
  }
  if (
    !Array.isArray(m.keywords) ||
    m.keywords.length === 0 ||
    !m.keywords.every((k) => typeof k === "string" && k.trim() !== "")
  ) {
    problems.push("metadata needs at least one keyword");
  }
  if (m.textSlot !== undefined) {
    const slot = m.textSlot as Record<string, unknown> | null;
    if (slot && typeof slot === "object" && slot.defaultText !== undefined && typeof slot.defaultText !== "string") {
      problems.push("textSlot defaultText must be a string");
    }
    if (slot && typeof slot === "object" && slot.skewY !== undefined && !(typeof slot.skewY === "number" && Math.abs(slot.skewY) < 80)) {
      problems.push("textSlot skewY must be a number of degrees between -80 and 80");
    }
    const num = (key: string) => (slot && typeof slot === "object" ? slot[key] : undefined);
    const ok = (key: string) => typeof num(key) === "number" && Number.isFinite(num(key));
    if (!slot || typeof slot !== "object" || !["x", "y", "width", "height"].every(ok)) {
      problems.push("textSlot needs finite numbers x, y, width and height");
    } else {
      const [x, y, width, height] = ["x", "y", "width", "height"].map((key) => num(key) as number);
      if (width! <= 0 || height! <= 0) problems.push("textSlot width and height must be above 0");
      else if (x! < 0 || y! < 0 || x! + width! > 128 || y! + height! > 128) {
        problems.push("textSlot must lie inside the 128 x 128 grid");
      }
    }
  }
  return problems;
}
