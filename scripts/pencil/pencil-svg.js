// Node reader for the pencil generator: reads a library SVG without a browser and returns
// the same element list as collectDom() in pencil.js, plus the mosaic silhouette traced
// from its own rasteriser instead of a canvas.
// It covers what the library icons use: inherited fill / stroke / opacity / stroke-width /
// fill-rule / linecap, transforms (translate, rotate, scale, skewX/Y, matrix), circle,
// ellipse, rect (with rounded corners), line, polyline, polygon, paths with arcs,
// clip paths, and gradients (read as their middle stop, like the browser version).
import { buildItems, flattenD, traceSilhouette, hash } from './pencil.js';

// ---------- a small XML reader (library icons are plain generated SVG) ----------
function parseXml(text) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root;
  const src = text.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>]*>/gi, '');
  const re = /<(\/?)([a-zA-Z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(src))) {
    const [, close, tag, attrText, self] = m;
    if (close) { cur = cur.parent ?? root; continue; }
    const attrs = {};
    for (const a of attrText.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = a[2] ?? a[3];
    const el = { tag, attrs, children: [], parent: cur };
    cur.children.push(el);
    if (!self) cur = el;
  }
  return root;
}
const walk = (el, fn) => { for (const c of el.children) { fn(c); walk(c, fn); } };

// ---------- transforms ----------
const I = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const mul = (m, n) => ({
  a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b,
  c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d,
  e: m.a * n.e + m.c * n.f + m.e, f: m.b * n.e + m.d * n.f + m.f,
});
function parseTransform(s) {
  let m = I;
  for (const [, name, args] of (s || '').matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
    const v = args.split(/[\s,]+/).filter(Boolean).map(Number);
    let t = I;
    if (name === 'translate') t = { ...I, e: v[0], f: v[1] ?? 0 };
    else if (name === 'scale') t = { ...I, a: v[0], d: v[1] ?? v[0] };
    else if (name === 'rotate') {
      const r = (v[0] * Math.PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
      t = { a: cs, b: sn, c: -sn, d: cs, e: 0, f: 0 };
      if (v.length >= 3) t = mul(mul({ ...I, e: v[1], f: v[2] }, t), { ...I, e: -v[1], f: -v[2] });
    } else if (name === 'skewX') t = { ...I, c: Math.tan((v[0] * Math.PI) / 180) };
    else if (name === 'skewY') t = { ...I, b: Math.tan((v[0] * Math.PI) / 180) };
    else if (name === 'matrix') t = { a: v[0], b: v[1], c: v[2], d: v[3], e: v[4], f: v[5] };
    m = mul(m, t);
  }
  return m;
}
// Like getCTM(): from the element's own coordinates to the 128x128 icon (viewBox 0 0 128 128).
function ctm(el) {
  const chain = [];
  for (let n = el; n && n.tag !== 'svg' && n.tag !== '#root'; n = n.parent) chain.unshift(n);
  return chain.reduce((m, n) => mul(m, parseTransform(n.attrs.transform)), I);
}
const scaleOf = (m) => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
const apply = (m, [x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];

// ---------- styles ----------
// Properties a child takes from its parents, with the browser defaults.
const INHERITED = { fill: '#000000', stroke: 'none', 'stroke-width': '1', 'fill-rule': 'nonzero', 'stroke-linecap': 'butt', 'fill-opacity': '1', 'stroke-opacity': '1', visibility: 'visible' };
function styleOf(el) {
  const own = (n) => {
    const s = { ...n.attrs };
    for (const part of (n.attrs.style || '').split(';')) {
      const i = part.indexOf(':');
      if (i > 0) s[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    return s;
  };
  const out = {};
  for (let n = el; n && n.tag !== '#root'; n = n.parent) {
    const s = own(n);
    if (s.display === 'none') return null;
    for (const k of Object.keys(INHERITED)) if (out[k] === undefined && s[k] !== undefined && s[k] !== 'inherit') out[k] = s[k];
  }
  for (const [k, v] of Object.entries(INHERITED)) if (out[k] === undefined) out[k] = v;
  return out;
}

const NAMED = { black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255], gray: [128, 128, 128], grey: [128, 128, 128] };
function parseColor(s) {
  s = (s || '').trim().toLowerCase();
  if (NAMED[s]) return NAMED[s];
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) return m[1].split(',').slice(0, 3).map(Number);
  if (s[0] === '#') {
    const h = s.length === 4 ? s.slice(1).split('').map((x) => x + x).join('') : s.slice(1, 7);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  return null;
}
function paint(v, byId) {
  if (!v || v === 'none') return null;
  const u = v.match(/url\(\s*["']?#([^"')]+)["']?\s*\)/);
  if (u) {
    const g = byId.get(u[1]);
    const stops = [];
    if (g) walk(g, (c) => { if (c.tag === 'stop') stops.push(c); });
    if (!stops.length) return null;
    const s = stops[Math.floor(stops.length / 2)];
    return parseColor(s.attrs['stop-color'] ?? styleOf(s)?.['stop-color'] ?? '#000');
  }
  return parseColor(v);
}

// ---------- geometry: like getTotalLength / getPointAtLength ----------
// Every shape becomes a fine polyline (pieces between moves), which is then resampled at
// even steps along its length, as the browser version does.
function arcPoints(x1, y1, rx, ry, phi, fa, fs, x2, y2) {
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry) return [[x2, y2]];
  const p = (phi * Math.PI) / 180, cp = Math.cos(p), sp = Math.sin(p);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI;
  else if (fs && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(8, Math.ceil((Math.abs(dt) * Math.max(rx, ry)) / 0.1));
  const out = [];
  for (let k = 1; k <= n; k++) {
    const t = t1 + (dt * k) / n;
    out.push([cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp]);
  }
  out[out.length - 1] = [x2, y2];
  return out;
}

// Path data to pieces of fine polyline in the path's own coordinates.
function flattenFine(d) {
  const tok = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  const pieces = [];
  let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = '', lc = null, i = 0;
  const num = () => +tok[i++];
  const flag = () => {
    // arc flags may be written without separators ("a5 5 0 011 1")
    const t = tok[i];
    if (t.length > 1 && /^[01]/.test(t)) { tok[i] = t.slice(1); return +t[0]; }
    i++; return +t;
  };
  const start = () => { if (!cur) { cur = [[x, y]]; pieces.push(cur); } };
  const steps = (L) => Math.max(8, Math.ceil(L / 0.1));
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'Z') {
      if (cur) cur.push([sx, sy]);
      x = sx; y = sy; lc = null; cur = null;
      continue;
    }
    if (C === 'M') {
      x = ox + num(); y = oy + num(); sx = x; sy = y;
      cur = [[x, y]]; pieces.push(cur);
      cmd = rel ? 'l' : 'L'; lc = null;
      continue;
    }
    start();
    if (C === 'L' || C === 'H' || C === 'V') {
      const nx = C === 'V' ? x : ox + num(), ny = C === 'H' ? y : oy + num();
      cur.push([nx, ny]); x = nx; y = ny; lc = null;
    } else if (C === 'C' || C === 'S') {
      const c1 = C === 'S' ? (lc && lc.c ? [2 * x - lc.p[0], 2 * y - lc.p[1]] : [x, y]) : [ox + num(), oy + num()];
      const c2 = [ox + num(), oy + num()], p = [ox + num(), oy + num()], p0 = [x, y];
      const n = steps(Math.hypot(c1[0] - x, c1[1] - y) + Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) + Math.hypot(p[0] - c2[0], p[1] - c2[1]));
      for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; cur.push([0, 1].map((a) => u * u * u * p0[a] + 3 * u * u * t * c1[a] + 3 * u * t * t * c2[a] + t * t * t * p[a])); }
      x = p[0]; y = p[1]; lc = { c: true, p: c2 };
    } else if (C === 'Q' || C === 'T') {
      const c = C === 'T' ? (lc && lc.q ? [2 * x - lc.p[0], 2 * y - lc.p[1]] : [x, y]) : [ox + num(), oy + num()];
      const p = [ox + num(), oy + num()], p0 = [x, y];
      const n = steps(Math.hypot(c[0] - x, c[1] - y) + Math.hypot(p[0] - c[0], p[1] - c[1]));
      for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; cur.push([0, 1].map((a) => u * u * p0[a] + 2 * u * t * c[a] + t * t * p[a])); }
      x = p[0]; y = p[1]; lc = { q: true, p: c };
    } else if (C === 'A') {
      const rx = num(), ry = num(), phi = num(), fa = flag(), fs = flag();
      const nx = ox + num(), ny = oy + num();
      cur.push(...arcPoints(x, y, rx, ry, phi, fa, fs, nx, ny));
      x = nx; y = ny; lc = null;
    } else { i++; }
  }
  return pieces;
}

function ellipsePoints(cx, cy, rx, ry) {
  const n = Math.max(64, Math.ceil((2 * Math.PI * Math.max(rx, ry)) / 0.1));
  const out = [];
  for (let k = 0; k <= n; k++) { const t = (2 * Math.PI * k) / n; out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); }
  return out;
}
function rectPoints(a) {
  const x = +(a.x ?? 0), y = +(a.y ?? 0), w = +a.width, h = +a.height;
  let rx = a.rx !== undefined ? +a.rx : a.ry !== undefined ? +a.ry : 0;
  let ry = a.ry !== undefined ? +a.ry : rx;
  rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
  if (!rx || !ry) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  const corner = (cx, cy, a0) => {
    const out = [];
    for (let k = 0; k <= 16; k++) { const t = a0 + (Math.PI / 2) * (k / 16); out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); }
    return out;
  };
  return [
    ...corner(x + w - rx, y + ry, -Math.PI / 2),
    ...corner(x + w - rx, y + h - ry, 0),
    ...corner(x + rx, y + h - ry, Math.PI / 2),
    ...corner(x + rx, y + ry, Math.PI),
    [x + w - rx, y],
  ];
}
const nums = (s) => (s || '').split(/[\s,]+/).filter(Boolean).map(Number);
function shapePieces(el) {
  const a = el.attrs;
  switch (el.tag) {
    case 'path': return flattenFine(a.d || '');
    case 'circle': return [ellipsePoints(+(a.cx ?? 0), +(a.cy ?? 0), +a.r, +a.r)];
    case 'ellipse': return [ellipsePoints(+(a.cx ?? 0), +(a.cy ?? 0), +a.rx, +a.ry)];
    case 'rect': return [rectPoints(a)];
    case 'line': return [[[+(a.x1 ?? 0), +(a.y1 ?? 0)], [+(a.x2 ?? 0), +(a.y2 ?? 0)]]];
    case 'polyline':
    case 'polygon': {
      const v = nums(a.points), pts = [];
      for (let k = 0; k + 1 < v.length; k += 2) pts.push([v[k], v[k + 1]]);
      if (el.tag === 'polygon' && pts.length) pts.push(pts[0]);
      return [pts];
    }
  }
  return [];
}

// Even steps along the whole length (moves between pieces have no length), like
// sampling getPointAtLength() n + 1 times.
function sampleEven(pieces, m, sc, closed) {
  const segs = [];
  let L = 0;
  for (const p of pieces) for (let k = 1; k < p.length; k++) {
    const l = Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]);
    segs.push([p[k - 1], p[k], L, l]);
    L += l;
  }
  if (!segs.length) return { pts: [], closed };
  const n = Math.max(6, Math.ceil((L * sc) / 0.7));
  const pts = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const s = (L * k) / n;
    while (j < segs.length - 1 && segs[j][2] + segs[j][3] < s) j++;
    const [a, b, s0, l] = segs[j];
    const t = l ? Math.min(1, Math.max(0, (s - s0) / l)) : 0;
    pts.push(apply(m, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]));
  }
  const first = pts[0], last = pts[pts.length - 1];
  if (closed) pts.pop();
  else if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.5) { pts.pop(); closed = true; }
  return { pts, closed };
}

// Same as sampleEl() in pencil.js.
function sampleEl(el, m, sc) {
  if (el.tag === 'path') {
    const d = el.attrs.d || '';
    const fast = flattenD(d, m, sc);
    if (fast) return fast.filter((s) => s.pts.length > 1);
    const parts = /m/.test(d.slice(1)) ? [d] : d.split(/(?=M)/).filter((p) => p.trim());
    return parts.map((p) => sampleEven(flattenFine(p), m, sc, /z\s*$/i.test(p.trim()))).filter((s) => s.pts.length > 1);
  }
  return [sampleEven(shapePieces(el), m, sc, !['line', 'polyline'].includes(el.tag))].filter((s) => s.pts.length > 1);
}

const GEOM = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
const SKIP = new Set(['defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'pattern', 'symbol']);

// The drawn elements of an SVG, in the same form as collectDom() in pencil.js.
export function collectSvg(svgText) {
  const root = parseXml(svgText);
  const byId = new Map();
  walk(root, (el) => { if (el.attrs.id) byId.set(el.attrs.id, el); });
  const clipCache = new Map();
  const clipFor = (el) => {
    let ref = el;
    while (ref && ref.tag !== '#root' && ref.attrs['clip-path'] === undefined) ref = ref.parent;
    if (!ref || ref.tag === '#root') return null;
    if (clipCache.has(ref)) return clipCache.get(ref);
    const id = (ref.attrs['clip-path'].match(/#([^)"']+)/) || [])[1];
    const cp = id && byId.get(id);
    let rings = null;
    if (cp) {
      const m = ctm(ref), sc = scaleOf(m);
      rings = [];
      walk(cp, (c) => { if (GEOM.has(c.tag)) rings.push(...sampleEl(c, m, sc).map((s) => s.pts)); });
    }
    clipCache.set(ref, rings);
    return rings;
  };
  const els = [];
  walk(root, (el) => {
    if (!GEOM.has(el.tag)) return;
    for (let n = el.parent; n; n = n.parent) if (SKIP.has(n.tag)) return;
    const st = styleOf(el);
    if (!st || st.visibility === 'hidden') return;
    let op = 1;
    for (let n = el; n && n.tag !== 'svg' && n.tag !== '#root'; n = n.parent) op *= +(n.attrs.opacity ?? 1);
    const m = ctm(el), sc = scaleOf(m);
    els.push({
      subs: sampleEl(el, m, sc),
      fill: paint(st.fill, byId),
      stroke: paint(st.stroke, byId),
      fo: op * +st['fill-opacity'],
      so: op * +st['stroke-opacity'],
      sw: parseFloat(st['stroke-width']) * sc,
      rule: st['fill-rule'],
      round: st['stroke-linecap'] === 'round',
      clip: clipFor(el),
    });
  });
  return els;
}

// ---------- rasteriser for the mosaic silhouette ----------
// Draws the elements' alpha at N x N with 4x4 samples per pixel and keeps the pixels a
// canvas would paint more than 100/255 opaque, then traces their outline.
export function silhouetteFromEls(els, N = 256) {
  const S = 4, M = N * S, k = M / 128;
  const clear = new Float32Array(N * N).fill(1); // how much of each pixel is still see-through
  const cover = new Uint16Array(N * N);
  const addCover = (alpha) => {
    for (let i = 0; i < cover.length; i++) if (cover[i]) { clear[i] *= 1 - (alpha * cover[i]) / (S * S); cover[i] = 0; }
  };
  for (const e of els) {
    const fillOn = e.fill && e.fo > 0;
    if (fillOn) {
      const rings = e.subs.map((s) => s.pts.map(([x, y]) => [x * k, y * k]));
      for (let r = 0; r < M; r++) {
        const yc = r + 0.5, hits = [];
        for (const ring of rings) for (let i = 0; i < ring.length; i++) {
          const p = ring[i], q = ring[(i + 1) % ring.length];
          if ((p[1] <= yc) !== (q[1] <= yc)) hits.push([p[0] + ((yc - p[1]) / (q[1] - p[1])) * (q[0] - p[0]), q[1] > p[1] ? 1 : -1]);
        }
        if (hits.length < 2) continue;
        hits.sort((a, b) => a[0] - b[0]);
        const spans = [];
        if (e.rule === 'evenodd') for (let i = 0; i + 1 < hits.length; i += 2) spans.push([hits[i][0], hits[i + 1][0]]);
        else {
          let wind = 0, s0 = 0;
          for (const [s, dir] of hits) { const was = wind; wind += dir; if (!was && wind) s0 = s; else if (was && !wind) spans.push([s0, s]); }
        }
        const row = Math.floor(r / S) * N;
        for (const [a, b] of spans) {
          for (let c = Math.max(0, Math.ceil(a - 0.5)); c < Math.min(M, Math.ceil(b - 0.5)); c++) cover[row + Math.floor(c / S)]++;
        }
      }
      addCover(Math.min(1, e.fo));
    }
    if (e.stroke && e.so > 0 && e.sw > 0) {
      const hw = (e.sw / 2) * k;
      const mark = new Uint8Array(M * M);
      for (const s of e.subs) {
        const pts = s.pts.map(([x, y]) => [x * k, y * k]);
        const n = s.closed ? pts.length : pts.length - 1;
        for (let i = 0; i < n; i++) {
          const p = pts[i], q = pts[(i + 1) % pts.length];
          const dx = q[0] - p[0], dy = q[1] - p[1], ll = dx * dx + dy * dy || 1;
          const x0 = Math.max(0, Math.floor(Math.min(p[0], q[0]) - hw)), x1 = Math.min(M - 1, Math.ceil(Math.max(p[0], q[0]) + hw));
          const y0 = Math.max(0, Math.floor(Math.min(p[1], q[1]) - hw)), y1 = Math.min(M - 1, Math.ceil(Math.max(p[1], q[1]) + hw));
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const t = Math.max(0, Math.min(1, ((x + 0.5 - p[0]) * dx + (y + 0.5 - p[1]) * dy) / ll));
            if (Math.hypot(x + 0.5 - p[0] - t * dx, y + 0.5 - p[1] - t * dy) <= hw) mark[y * M + x] = 1;
          }
        }
      }
      for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) if (mark[y * M + x]) cover[Math.floor(y / S) * N + Math.floor(x / S)]++;
      addCover(Math.min(1, e.so));
    }
  }
  return traceSilhouette((x, y) => 1 - clear[y * N + x] > 100 / 255, N);
}

// ---------- one call for the export script ----------
// The analysed items for an icon; mosaic-style icons get the silhouette.
export function analyseSvg(svgText, opts = {}) {
  const els = collectSvg(svgText);
  return buildItems(els, { ...(opts.mosaic ? { silhouette: silhouetteFromEls(els) } : {}), join: !!opts.join });
}

// The seed the draft page uses for a design and style (with its Redraw count at 1), so the
// Node output matches what the owner picked from.
export const pencilSeed = (path, styleId) => hash(path + styleId) + 7919;
