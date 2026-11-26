// Pencil-style icon drafts: redraws an existing library icon as if drawn on paper.
// Everything is plain SVG strokes (no <filter>), so the result works in Fabric.js.
// The grain comes from many thin strokes, slight wobble and broken dash patterns.

const NS = 'http://www.w3.org/2000/svg';
const GEOM = 'path,circle,ellipse,rect,line,polyline,polygon';
const SKIP = 'defs,clipPath,mask,linearGradient,radialGradient,pattern,symbol';

// ---------- small helpers ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
const f = (n) => Math.round(n * 100) / 100;
const g1 = (n) => Math.round(n * 10) / 10; // point coordinates: 0.1 px is plenty at 128x128
const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lum = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const darken = (c, k) => c.map((v) => v * (1 - k));
const WHITE = [255, 255, 255];

function parseColor(s) {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) return m[1].split(',').slice(0, 3).map(Number);
  if (s[0] === '#') {
    const h = s.length === 4 ? s.slice(1).split('').map((x) => x + x).join('') : s.slice(1, 7);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  return null;
}

function paint(v, svg) {
  if (!v || v === 'none') return null;
  const u = v.match(/url\("?#([^")]+)"?\)/);
  if (u) {
    const g = svg.querySelector('#' + CSS.escape(u[1]));
    const stops = g ? [...g.querySelectorAll('stop')] : [];
    if (!stops.length) return null;
    const s = stops[Math.floor(stops.length / 2)];
    return parseColor(s.getAttribute('stop-color') || getComputedStyle(s).stopColor);
  }
  return parseColor(v);
}

// ---------- read the source icon into shapes and lines (in 128x128 coordinates) ----------
function sampleGeom(g, m, sc, closed) {
  const L = g.getTotalLength();
  const n = Math.max(6, Math.ceil((L * sc) / 0.7));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const p = g.getPointAtLength((L * i) / n);
    pts.push([m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f]);
  }
  const first = pts[0], last = pts[pts.length - 1];
  if (closed) pts.pop();
  else if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.5) { pts.pop(); closed = true; }
  return { pts, closed };
}

// Fast path reader: turns path data into point lists ourselves (getPointAtLength is very
// slow on long generated paths). Handles M L H V C S Q T Z; returns null for arcs.
export function flattenD(d, m, sc) {
  if (/[aA]/.test(d)) return null;
  const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  const T = (x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
  const subs = [];
  let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = '', lc = null, i = 0;
  const num = () => +tok[i++];
  const add = (px, py) => cur.pts.push(T(px, py));
  const curve = (pts, fn) => {
    let L = 0;
    for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    const n = Math.max(2, Math.ceil((L * sc) / 0.8));
    for (let k = 1; k <= n; k++) { const p = fn(k / n); add(p[0], p[1]); }
  };
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'Z') {
      if (cur) cur.closed = true;
      x = sx; y = sy; lc = null; cur = null;
      continue;
    }
    if (!cur && C !== 'M') { cur = { pts: [T(x, y)], closed: false }; subs.push(cur); }
    if (C === 'M') {
      x = ox + num(); y = oy + num(); sx = x; sy = y;
      cur = { pts: [T(x, y)], closed: false }; subs.push(cur);
      cmd = rel ? 'l' : 'L'; lc = null;
    } else if (C === 'L' || C === 'H' || C === 'V') {
      const nx = C === 'V' ? x : ox + num(), ny = C === 'H' ? y : oy + num();
      const L = Math.hypot(nx - x, ny - y), n = Math.max(1, Math.ceil((L * sc) / 0.8));
      for (let k = 1; k <= n; k++) add(x + ((nx - x) * k) / n, y + ((ny - y) * k) / n);
      x = nx; y = ny; lc = null;
    } else if (C === 'C' || C === 'S') {
      let c1;
      if (C === 'S') c1 = lc && lc.c ? [2 * x - lc.p[0], 2 * y - lc.p[1]] : [x, y];
      else c1 = [ox + num(), oy + num()];
      const c2 = [ox + num(), oy + num()], p = [ox + num(), oy + num()], p0 = [x, y];
      curve([p0, c1, c2, p], (t) => { const u = 1 - t; return [0, 1].map((a) => u * u * u * p0[a] + 3 * u * u * t * c1[a] + 3 * u * t * t * c2[a] + t * t * t * p[a]); });
      x = p[0]; y = p[1]; lc = { c: true, p: c2 };
    } else if (C === 'Q' || C === 'T') {
      let c;
      if (C === 'T') c = lc && lc.q ? [2 * x - lc.p[0], 2 * y - lc.p[1]] : [x, y];
      else c = [ox + num(), oy + num()];
      const p = [ox + num(), oy + num()], p0 = [x, y];
      curve([p0, c, p], (t) => { const u = 1 - t; return [0, 1].map((a) => u * u * p0[a] + 2 * u * t * c[a] + t * t * p[a]); });
      x = p[0]; y = p[1]; lc = { q: true, p: c };
    } else return null;
  }
  return subs.map((s) => {
    const p = s.pts;
    let closed = s.closed;
    if (p.length > 2 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 0.5) { p.pop(); closed = true; }
    return { pts: p, closed };
  });
}

function sampleEl(el, m, sc, tmp) {
  const out = [];
  if (el.tagName === 'path') {
    const d = el.getAttribute('d') || '';
    const fast = flattenD(d, m, sc);
    if (fast) return fast.filter((s) => s.pts.length > 1);
    const parts = /m/.test(d.slice(1)) ? [d] : d.split(/(?=M)/).filter((p) => p.trim());
    for (const p of parts) {
      tmp.setAttribute('d', p);
      out.push(sampleGeom(tmp, m, sc, /z\s*$/i.test(p.trim())));
    }
  } else {
    out.push(sampleGeom(el, m, sc, !['line', 'polyline'].includes(el.tagName)));
  }
  return out.filter((s) => s.pts.length > 1);
}

function clipFor(el, svg, tmp, cache) {
  const ref = el.closest('[clip-path]');
  if (!ref || !svg.contains(ref)) return null;
  if (cache.has(ref)) return cache.get(ref);
  const id = (ref.getAttribute('clip-path').match(/#([^)"]+)/) || [])[1];
  const cp = id && svg.querySelector('#' + CSS.escape(id));
  let rings = null;
  if (cp) {
    const m = ref.getCTM();
    const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
    rings = [...cp.querySelectorAll(GEOM)].flatMap((c) => sampleEl(c, m, sc, tmp).map((s) => s.pts));
  }
  cache.set(ref, rings);
  return rings;
}

// Outline of a thick stroke, so it can be shaded like a filled shape.
// Returns the filled rings and the edges to draw: an end that joins another piece of
// the same line gets no cap line, so a chain drawn in segments reads as one ribbon.
function band(sub, r, round, joinStart, joinEnd) {
  const { rings, left, right, capS, capE } = bandParts(sub, r, round);
  if (sub.closed) return { rings, edges: rings.map((p) => ({ pts: p, closed: true })) };
  const rRev = [...right].reverse();
  let edges;
  if (!joinStart && !joinEnd) edges = [{ pts: rings[0], closed: true }];
  else if (joinStart && joinEnd) edges = [{ pts: left, closed: false }, { pts: rRev, closed: false }];
  else if (joinEnd) edges = [{ pts: [...rRev, ...capS, ...left], closed: false }];
  else edges = [{ pts: [...left, ...capE, ...rRev], closed: false }];
  return { rings, edges };
}

function bandParts({ pts, closed }, r, round) {
  const n = pts.length;
  const k = Math.max(2, Math.ceil(r / 0.7));
  const nor = pts.map((_, i) => {
    const a = pts[closed ? (i - k + n) % n : Math.max(0, i - k)];
    const b = pts[closed ? (i + k) % n : Math.min(n - 1, i + k)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  });
  const left = pts.map((p, i) => [p[0] + nor[i][0] * r, p[1] + nor[i][1] * r]);
  const right = pts.map((p, i) => [p[0] - nor[i][0] * r, p[1] - nor[i][1] * r]);
  if (closed) return { rings: [left, right], left, right, capS: [], capE: [] };
  const cap = (c, a0) => {
    const arr = [];
    if (!round) return arr;
    for (let j = 1; j < 10; j++) {
      const a = a0 - (Math.PI * j) / 10;
      arr.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
    }
    return arr;
  };
  const aEnd = Math.atan2(nor[n - 1][1], nor[n - 1][0]);
  const aStart = Math.atan2(nor[0][1], nor[0][0]) + Math.PI;
  const capE = cap(pts[n - 1], aEnd), capS = cap(pts[0], aStart);
  return { rings: [[...left, ...capE, ...[...right].reverse(), ...capS]], left, right, capS, capE };
}

const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.8;
const isWhite = (c) => c.every((v) => v >= 250);

// Browser reader: the drawn elements of an SVG, each with its point lists (128x128
// coordinates) and its resolved paint. The Node reader in pencil-svg.js returns the same.
export function collectDom(svgText, host) {
  host.innerHTML = svgText;
  const svg = host.querySelector('svg');
  svg.setAttribute('width', '128');
  svg.setAttribute('height', '128');
  const tmp = document.createElementNS(NS, 'path');
  svg.appendChild(tmp);
  const els = [];
  const clipCache = new Map();
  for (const el of svg.querySelectorAll(GEOM)) {
    if (el === tmp || el.closest(SKIP)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    let op = 1;
    for (let n = el; n && n !== svg; n = n.parentNode) op *= +(n.getAttribute('opacity') ?? 1);
    const m = el.getCTM();
    const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
    els.push({
      subs: sampleEl(el, m, sc, tmp),
      fill: paint(cs.fill, svg),
      stroke: paint(cs.stroke, svg),
      fo: op * +cs.fillOpacity,
      so: op * +cs.strokeOpacity,
      sw: parseFloat(cs.strokeWidth) * sc,
      rule: cs.fillRule,
      round: cs.strokeLinecap === 'round',
      clip: clipFor(el, svg, tmp, clipCache),
    });
  }
  host.innerHTML = '';
  return els;
}

export function analyse(svgText, host, opts = {}) {
  return buildItems(collectDom(svgText, host), opts);
}

// Turn the read elements into pencil items (shapes, lines, bands). No browser needed.
export function buildItems(els, opts = {}) {
  const items = [];
  for (const { subs, fill, stroke, fo, so, sw, rule, round, clip } of els) {
    const strokeOn = stroke && so > 0.05 && sw > 0;
    if (fill && fo > 0.05) {
      const rings = subs.map((s) => s.pts);
      // Pure white with no outline is a gap-maker (e.g. the halo where a chain crosses itself): paper only.
      const eraser = isWhite(fill) && !strokeOn;
      items.push({ kind: 'shape', rings, edges: rings.map((p) => ({ pts: p, closed: true })), rule, color: mix(fill, WHITE, 1 - Math.min(1, fo)), alpha: fo, stroke: strokeOn ? stroke : null, sw, clip, eraser });
    } else if (strokeOn) {
      const color = mix(stroke, WHITE, 1 - Math.min(1, so));
      for (const s of subs) items.push({ kind: 'stroke', sub: s, color, sw, clip, round, eraser: isWhite(stroke) });
    }
  }
  // Thick strokes become shaded bands; ends that meet another piece of the same colour are joins.
  const strokes = items.filter((it) => it.kind === 'stroke' && !it.sub.closed);
  const touches = (it, p) => strokes.some((o) => o !== it && o.eraser === it.eraser && Math.abs(o.sw - it.sw) < 0.2 && hex(o.color) === hex(it.color) && (near(o.sub.pts[0], p) || near(o.sub.pts[o.sub.pts.length - 1], p)));
  const out = items.map((it) => {
    if (it.kind !== 'stroke') return it;
    const s = it.sub;
    if (it.sw <= 4) return { kind: 'line', pts: s.pts, closed: s.closed, color: it.color, sw: it.sw, clip: it.clip };
    const js = !s.closed && touches(it, s.pts[0]);
    const je = !s.closed && touches(it, s.pts[s.pts.length - 1]);
    const { rings, edges } = band(s, it.sw / 2, it.round, js, je);
    return { kind: 'shape', rings, edges, rule: s.closed ? 'evenodd' : 'nonzero', color: it.color, stroke: null, sw: 0, clip: it.clip, band: true, eraser: it.eraser };
  });
  if (opts.silhouette) {
    // Every piece becomes shading; one silhouette shape goes first with the outline.
    // Features that stand out from the coat (pink ears, feet and tail, a dark eye) keep their outline.
    const pieces = out.filter((it) => it.kind === 'shape' && !it.eraser);
    const sat = (c) => (Math.max(...c) - Math.min(...c)) / 255;
    let wsum = 0, ssum = 0;
    for (const it of pieces) { const a = area(it.rings); wsum += a; ssum += sat(it.color) * a; }
    const coatSat = ssum / (wsum || 1);
    for (const it of pieces) {
      const feature = sat(it.color) - coatSat > 0.12 || lum(it.color) < 0.18;
      if (!feature) it.patch = true;
    }
    const rings = opts.silhouette;
    out.unshift({ kind: 'shape', rings, edges: rings.map((p) => ({ pts: p, closed: true })), rule: 'evenodd', color: [255, 255, 255], stroke: null, sw: 0, clip: null, silhouette: true });
    out.push({ kind: 'outline-only', edges: rings.map((p) => ({ pts: p, closed: true })) });
  } else if (opts.patches) markPatches(out);
  if (opts.join) joinOverlaps(out);
  return out;
}

// Opt-in (opts.join): where a shape partly overlaps another shape of nearly the same colour (an arm
// laid over a cell body), the outline parts that lie inside the other shape are dropped, so the two
// read as one body. A shape wholly inside another (a nucleus, a vacuole) keeps its outline.
function joinOverlaps(items) {
  const shapes = items.filter((it) => it.kind === 'shape' && !it.eraser && !it.band && it.rings.length);
  const inside = (p, o) => o.rings.reduce((c, r) => (insideRing(p, r) ? !c : c), false);
  const like = (a, b) => Math.hypot(a.color[0] - b.color[0], a.color[1] - b.color[1], a.color[2] - b.color[2]) / 255 < 0.25;
  const cuts = new Map();
  for (const a of shapes) {
    const probe = a.rings[0].filter((_, k) => k % 3 === 0);
    for (const b of shapes) {
      if (a === b || !like(a, b)) continue;
      const share = probe.filter((p) => inside(p, b)).length / probe.length;
      if (share > 0.05 && share < 0.95) cuts.set(a, [...(cuts.get(a) ?? []), b]);
    }
  }
  for (const [a, others] of cuts) {
    const pieces = [];
    for (const e of a.edges) {
      const pts = e.pts;
      const keep = pts.map((p) => !others.some((o) => inside(p, o)));
      if (keep.every(Boolean)) { pieces.push(e); continue; }
      // Start at a dropped point, so a run of kept points is never split across the ring's seam.
      const s = e.closed ? keep.indexOf(false) : 0;
      let run = [];
      for (let k = 0; k < pts.length; k++) {
        const i = (s + k) % pts.length;
        if (keep[i]) run.push(pts[i]);
        else { if (run.length > 1) pieces.push({ pts: run, closed: false }); run = []; }
      }
      if (run.length > 1) pieces.push({ pts: run, closed: false });
    }
    a.edges = pieces;
  }
}

// ---------- file size ----------
// Size levels (opts.size in render; default 2, the owner's pick):
// 0  as drawn.
// 1  same drawing, written shorter: relative path commands, no leading zeros, shared
//    attributes on one group. Looks identical.
// 2  also fewer points (lines are simplified more), straight hatch strokes instead of
//    slightly bowed ones, and a shorter grain pattern. Same strokes, tiny differences.
// 3  also longer, slightly wider-spaced hatch strokes and a single outline pass in A and B.
//    Fewer strokes, so it looks a little different.
let TUNE;
const r1 = (n) => Math.round(n * 10) / 10 || 0.1;
const TUNES = [
  { tol: 1, straight: false, seg: 1, spacing: 1, single: false, dashPairs: 16, dashRound: f },
  { tol: 1, straight: false, seg: 1, spacing: 1, single: false, dashPairs: 16, dashRound: f },
  { tol: 2.5, straight: true, seg: 1, spacing: 1, single: false, dashPairs: 6, dashRound: r1 },
  { tol: 2.5, straight: true, seg: 1.8, spacing: 1.2, single: true, dashPairs: 6, dashRound: r1 },
];

const num = (v) => {
  let t = String(Math.round(v * 100) / 100);
  if (t.startsWith('0.')) t = t.slice(1);
  else if (t.startsWith('-0.')) t = '-' + t.slice(2);
  return t === '-0' ? '0' : t;
};
// Rewrite path data (absolute M L Q Z) as short relative commands.
export function compactD(d) {
  const tok = d.match(/[MLQZ]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let out = '', prev = '', cmd = '', x = 0, y = 0, sx = 0, sy = 0, i = 0, last = '';
  const put = (v) => {
    const t = num(v);
    if (prev && !t.startsWith('-') && !(t.startsWith('.') && prev.includes('.'))) out += ' ';
    out += t; prev = t;
  };
  const letter = (c) => { if (c !== last) { out += c; prev = ''; last = c; } };
  while (i < tok.length) {
    if (/[MLQZ]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'Z') { out += 'z'; prev = ''; last = 'z'; x = sx; y = sy; continue; }
    if (cmd === 'M') {
      const nx = +tok[i++], ny = +tok[i++];
      out += 'm'; prev = ''; last = 'l'; // numbers after m are implicit l
      put(nx - x); put(ny - y);
      x = sx = nx; y = sy = ny;
      cmd = 'L';
    } else if (cmd === 'L') {
      const nx = +tok[i++], ny = +tok[i++];
      letter('l'); put(nx - x); put(ny - y);
      x = nx; y = ny;
    } else if (cmd === 'Q') {
      const cx = +tok[i++], cy = +tok[i++], nx = +tok[i++], ny = +tok[i++];
      letter('q'); put(cx - x); put(cy - y); put(nx - x); put(ny - y);
      x = nx; y = ny;
    } else i++;
  }
  return out;
}
function compactSvg(svg) {
  return svg
    .replace(/ d="([^"]+)"/g, (_, d) => ` d="${compactD(d)}"`)
    .replace(/ fill="none"/g, '')
    .replace(/ stroke-linecap="round"/g, '')
    .replace(/ stroke-linejoin="round"/g, '')
    .replace(/([" ])0\./g, '$1.')
    .replace(/(<svg[^>]*>(?:<defs>.*?<\/defs>)?)(.*)<\/svg>$/s, '$1<g fill="none" stroke-linecap="round" stroke-linejoin="round">$2</g></svg>');
}

// ---------- drawing primitives ----------
// Drop points that lie (almost) on a straight line, to keep the files small.
function simplify(pts, tol = 0.12) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const dd = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / l;
      if (dd > best) { best = dd; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const ringsD = (rings) => rings.map((r) => 'M' + simplify(r, 0.12 * TUNE.tol).map((p) => g1(p[0]) + ' ' + g1(p[1])).join('L') + 'Z').join('');

// The pencil grain: a random dash pattern. Smaller files keep only the first pairs (the
// pattern repeats sooner); the random numbers are still drawn so the strokes stay the same.
function dashes(R, w, [dMin, dMax]) {
  const a = [];
  for (let i = 0; i < 16; i++) {
    const dash = dMin + R() * (dMax - dMin), gap = w * (0.25 + R() * 0.6);
    if (i < TUNE.dashPairs) a.push(TUNE.dashRound(dash), TUNE.dashRound(gap));
  }
  return a.join(' ');
}

// One hand-drawn line along a list of points: a few passes, each with its own wobble.
function pencilStroke(R, pts, closed, o) {
  const out = [];
  const n = pts.length;
  if (n < 2) return out;
  // arc length per point
  const len = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = len[n - 1] + (closed ? Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) : 0);
  for (let pass = 0; pass < o.passes; pass++) {
    const shift = o.spread ? [(R() - 0.5) * o.spread, (R() - 0.5) * o.spread] : [0, 0];
    const across = o.offsets ? o.offsets[pass % o.offsets.length] : 0;
    const p1 = R() * 6.28, p2 = R() * 6.28, w1 = 30 + R() * 30, w2 = 9 + R() * 8;
    const start = closed ? Math.floor(R() * n) : 0;
    const count = closed ? Math.round(n * (1 + (o.loop ?? 0.06) * (0.5 + R()))) : n;
    const step = Math.max(1, Math.round(1.6 / Math.max(0.3, total / n)));
    const seq = [];
    for (let j = 0; j < count; j += step) seq.push((start + j) % n);
    if (!closed && seq[seq.length - 1] !== n - 1) seq.push(n - 1);
    const pp = seq.map((i, j) => {
      const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      const ia = closed || i > 0 ? a : pts[i], ib = closed || i < n - 1 ? b : pts[i];
      const dx = ib[0] - ia[0], dy = ib[1] - ia[1], l = Math.hypot(dx, dy) || 1;
      const s = len[i] + (closed && j * step >= n ? total : 0);
      const wob = o.wobble * (0.65 * Math.sin((6.28 * s) / w1 + p1) + 0.35 * Math.sin((6.28 * s) / w2 + p2)) + across;
      return [pts[i][0] - (dy / l) * wob + shift[0], pts[i][1] + (dx / l) * wob + shift[1]];
    });
    if (!closed && o.overshoot) {
      const ext = (a, b) => {
        const dx = a[0] - b[0], dy = a[1] - b[1], l = Math.hypot(dx, dy) || 1, e = o.overshoot * (0.4 + R());
        return [a[0] + (dx / l) * e, a[1] + (dy / l) * e];
      };
      pp.unshift(ext(pp[0], pp[Math.min(2, pp.length - 1)]));
      pp.push(ext(pp[pp.length - 1], pp[Math.max(0, pp.length - 3)]));
    }
    const d = 'M' + simplify(pp, 0.06 * TUNE.tol).map((p) => g1(p[0]) + ' ' + g1(p[1])).join('L');
    const op = o.opacity * (0.8 + R() * 0.2);
    out.push(`<path d="${d}" fill="none" stroke="${o.color}" stroke-width="${f(o.width)}" stroke-opacity="${f(op)}" stroke-linecap="round" stroke-linejoin="round"${o.grain ? ` stroke-dasharray="${dashes(R, o.width, o.grain)}" stroke-dashoffset="${f(R() * 20)}"` : ''}/>`);
  }
  return out;
}

// Where parallel hatch lines cross the shape: spans inside it, per line.
function hatchLines(rings, rule, angle, spacing, R, jit = 0.25) {
  const a = (angle * Math.PI) / 180;
  const u = [Math.cos(a), Math.sin(a)], v = [-Math.sin(a), Math.cos(a)];
  const proj = rings.map((r) => r.map((p) => [p[0] * u[0] + p[1] * u[1], p[0] * v[0] + p[1] * v[1]]));
  let wMin = Infinity, wMax = -Infinity;
  for (const r of proj) for (const p of r) { wMin = Math.min(wMin, p[1]); wMax = Math.max(wMax, p[1]); }
  const lines = [];
  for (let w = wMin + spacing * R(); w < wMax; w += spacing * (1 + (R() - 0.5) * 2 * jit)) {
    const hits = [];
    for (const r of proj) {
      for (let i = 0; i < r.length; i++) {
        const p = r[i], q = r[(i + 1) % r.length];
        if ((p[1] <= w) !== (q[1] <= w)) {
          const t = (w - p[1]) / (q[1] - p[1]);
          hits.push([p[0] + t * (q[0] - p[0]), q[1] > p[1] ? 1 : -1]);
        }
      }
    }
    hits.sort((x, y) => x[0] - y[0]);
    const spans = [];
    if (rule === 'evenodd') {
      for (let i = 0; i + 1 < hits.length; i += 2) spans.push([hits[i][0], hits[i + 1][0]]);
    } else {
      let wind = 0, s0 = 0;
      for (const [s, dir] of hits) {
        const was = wind;
        wind += dir;
        if (was === 0 && wind !== 0) s0 = s;
        else if (was !== 0 && wind === 0) spans.push([s0, s]);
      }
    }
    lines.push({ w, spans: spans.filter((sp) => sp[1] - sp[0] > 0.4) });
  }
  return { lines, u, v };
}

// Shading made of strokes. seg: split long spans into short strokes; zigzag: one back-and-forth scribble.
function hatch(R, it, o) {
  const { lines, u, v } = hatchLines(it.rings, it.rule, o.angle, o.spacing * (o.zigzag ? 1 : TUNE.spacing), R, o.jitter ?? 0.25);
  const at = (s, w) => [u[0] * s + v[0] * w, u[1] * s + v[1] * w];
  const parts = [];
  const pt = (p) => g1(p[0]) + ' ' + g1(p[1]);
  const edge = () => (o.inset ?? 0) * (R() * 1.6 - 0.3) * -1 + (o.overrun ?? 0) * R();
  if (o.zigzag) {
    let run = [], dir = 1, prev = null;
    const flush = () => { if (run.length > 1) parts.push('M' + run.map(pt).join('L')); run = []; };
    for (const ln of lines) {
      if (!ln.spans.length) { flush(); prev = null; continue; }
      const sp = ln.spans.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
      // A span that doesn't overlap the previous line's lies in another piece of the shape
      // (e.g. separate wedges in one path): lift the pencil instead of drawing across the gap.
      if (prev && (sp[0] > prev[1] || sp[1] < prev[0])) { flush(); dir = 1; }
      prev = sp;
      const s0 = sp[0] - edge(), s1 = sp[1] + edge();
      const w = ln.w + (R() - 0.5) * 0.4;
      if (dir > 0) run.push(at(s0, w), at(s1, w)); else run.push(at(s1, w), at(s0, w));
      dir = -dir;
      if (ln.spans.length > 1) { flush(); dir = 1; }
    }
    flush();
  } else {
    for (const ln of lines) {
      for (const sp of ln.spans) {
        let s = sp[0] - edge();
        const end = sp[1] + edge();
        while (s < end - 0.3) {
          const L = o.seg ? (o.seg[0] + R() * (o.seg[1] - o.seg[0])) * TUNE.seg : end - s;
          const e = Math.min(end, s + L);
          const tilt = (R() - 0.5) * (o.tilt ?? 0.8);
          const w0 = ln.w + (R() - 0.5) * 0.3, w1 = w0 + tilt;
          const bow = (R() - 0.5) * 0.6;
          const mid = at((s + e) / 2, (w0 + w1) / 2 + bow);
          parts.push(TUNE.straight ? 'M' + pt(at(s, w0)) + 'L' + pt(at(e, w1)) : 'M' + pt(at(s, w0)) + 'Q' + pt(mid) + ' ' + pt(at(e, w1)));
          s = e - (o.seg ? R() * 1.2 : 0);
        }
      }
    }
  }
  if (!parts.length) return [];
  // Pencil pressure: short strokes are spread over three groups pressed lighter or harder.
  const groups = o.zigzag ? [parts] : [[], [], []];
  if (!o.zigzag) for (const p of parts) groups[Math.floor(R() * 3)].push(p);
  const press = o.zigzag ? [1] : [0.6, 0.85, 1.1];
  return groups.filter((g) => g.length).map((g, i) =>
    `<path d="${g.join('')}" fill="none" stroke="${o.color}" stroke-width="${f(o.width)}" stroke-opacity="${f(Math.min(1, o.opacity * press[i]))}" stroke-linecap="round" stroke-linejoin="round"${o.grain ? ` stroke-dasharray="${dashes(R, o.width, o.grain)}"` : ''}/>`);
}

// ---------- the styles ----------
const GRAPHITE = '#3b3b3d';

function graphiteShade(R, it, color, strength = 1) {
  const dark = 1 - lum(it.color);
  if (dark < 0.07) return [];
  const sp = 1.35 + 4.4 * Math.pow(1 - dark, 1.5);
  const layers = dark < 0.38 ? 1 : dark < 0.68 ? 2 : 3;
  const angles = [42, -38, 8];
  const out = [];
  for (let l = 0; l < layers; l++) {
    out.push(...hatch(R, it, { angle: angles[l] + (R() - 0.5) * 8, spacing: sp * (l ? 1.3 : 1), color, width: 0.5, opacity: (0.45 + 0.35 * dark) * strength, seg: [8, 18], inset: 0.5, grain: [2, 7] }));
  }
  return out;
}

// Each style: how a shape's inside is shaded, its outline, and how thin lines are drawn.
export const STYLES = [
  {
    id: 'graphite-line',
    name: 'A · Graphite outline',
    note: 'Grey pencil, outlines only, loose double lines.',
    fill: () => [],
    patch: (R, it) => graphiteShade(R, it, GRAPHITE, 0.55),
    thin: (it) => ({ color: GRAPHITE, opacity: 0.25 + 0.6 * (1 - lum(it.color)) }),
    outline: () => ({ color: GRAPHITE, width: 0.75, passes: 2, wobble: 0.55, spread: 0.5, opacity: 0.8, grain: [3, 10] }),
    line: () => ({ color: GRAPHITE, opacity: 0.8 }),
  },
  {
    id: 'graphite-shaded',
    name: 'B · Graphite shaded',
    note: 'Grey pencil with hatching; darker colours get denser cross-hatching.',
    fill: (R, it) => graphiteShade(R, it, GRAPHITE),
    patch: (R, it) => graphiteShade(R, it, GRAPHITE),
    thin: (it) => ({ color: GRAPHITE, opacity: 0.3 + 0.65 * (1 - lum(it.color)) }),
    outline: () => ({ color: '#2b2b2d', width: 0.8, passes: 2, wobble: 0.45, spread: 0.4, opacity: 0.85, grain: [4, 12] }),
    line: () => ({ color: '#2b2b2d', opacity: 0.85 }),
  },
  {
    id: 'colour-scribble',
    name: 'D · Colour scribble + graphite',
    note: 'Loose back-and-forth colour that runs over the edges, with a dark pencil outline on top.',
    fill: (R, it) => hatch(R, it, { angle: 60 + (R() - 0.5) * 20, spacing: 1.9, color: hex(darken(it.color, 0.05)), width: 1.5, opacity: 0.6, zigzag: true, overrun: 1.4, jitter: 0.35, grain: [5, 14] }),
    patch: (R, it) => hatch(R, it, { angle: 60 + (R() - 0.5) * 20, spacing: 2.2, color: hex(darken(it.color, 0.1)), width: 1.3, opacity: 0.5, zigzag: true, overrun: 0.6, jitter: 0.35, grain: [5, 14] }),
    thin: (it) => ({ color: hex(mix(darken(it.color, 0.25), [38, 38, 40], 0.4)), opacity: 0.8 }),
    outline: () => ({ color: '#262628', width: 1, passes: 1, wobble: 0.5, spread: 0, opacity: 0.9, loop: 0.1, grain: [6, 16] }),
    line: () => ({ color: '#262628', opacity: 0.9 }),
  },
];

const perimeter = (rings) => rings.reduce((sum, r) => {
  let l = 0;
  for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; l += Math.hypot(q[0] - p[0], q[1] - p[1]); }
  return sum + l;
}, 0);
// Average width of a shape is about 2 * area / perimeter.
const isThin = (rings) => (2 * area(rings)) / (perimeter(rings) || 1) < 0.9 && area(rings) < 60;

const area = (rings) => rings.reduce((sum, r) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return sum + Math.abs(a) / 2;
}, 0);

function insideRing(p, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < ((r[j][0] - r[i][0]) * (p[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  }
  return c;
}

// ---------- mosaic artwork: outline only the silhouette ----------
// Draws the icon to a canvas and traces the edge of everything that is painted
// (marching squares), so the pencil outline follows the whole body, not every patch.
export async function silhouette(svgText, N = 256) {
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  const img = new Image();
  img.src = url;
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const cx = cv.getContext('2d');
  cx.drawImage(img, 0, 0, N, N);
  URL.revokeObjectURL(url);
  const a = cx.getImageData(0, 0, N, N).data;
  return traceSilhouette((x, y) => a[(y * N + x) * 4 + 3] > 100, N);
}

// Marching squares over a pixel mask (N x N, on(x, y) for painted pixels): the outline
// rings of everything painted, smoothed, in 128x128 coordinates.
export function traceSilhouette(isOn, N) {
  const on = (x, y) => x >= 0 && y >= 0 && x < N && y < N && isOn(x, y);
  const k = 128 / N;
  const segs = new Map();
  const key = (p) => p[0] + ',' + p[1];
  const addSeg = (p, q) => { (segs.get(key(p)) || segs.set(key(p), []).get(key(p))).push(q); };
  // Cells between pixel centres; edge midpoints in half-pixel units.
  for (let y = -1; y < N; y++) {
    for (let x = -1; x < N; x++) {
      const c = (on(x, y) ? 8 : 0) | (on(x + 1, y) ? 4 : 0) | (on(x + 1, y + 1) ? 2 : 0) | (on(x, y + 1) ? 1 : 0);
      const T = [2 * x + 2, 2 * y + 1], Rr = [2 * x + 3, 2 * y + 2], B = [2 * x + 2, 2 * y + 3], L = [2 * x + 1, 2 * y + 2];
      const table = { 1: [[L, B]], 2: [[B, Rr]], 3: [[L, Rr]], 4: [[Rr, T]], 5: [[L, T], [Rr, B]], 6: [[B, T]], 7: [[L, T]], 8: [[T, L]], 9: [[T, B]], 10: [[T, Rr], [B, L]], 11: [[T, Rr]], 12: [[Rr, L]], 13: [[Rr, B]], 14: [[B, L]] };
      for (const [p, q] of table[c] || []) addSeg(p, q);
    }
  }
  const rings = [];
  for (const start of [...segs.keys()]) {
    while (segs.get(start)?.length) {
      const ring = [];
      let cur = start;
      for (let guard = 0; guard < 100000; guard++) {
        const list = segs.get(cur);
        if (!list || !list.length) break;
        const nx = list.pop();
        const [px, py] = cur.split(',').map(Number);
        ring.push([px * k / 2, py * k / 2]);
        cur = key(nx);
        if (cur === start) break;
      }
      if (ring.length > 12) rings.push(ring);
    }
  }
  // Smooth the pixel staircase a little, then resample.
  return rings.map((r) => {
    let pts = r;
    for (let pass = 0; pass < 3; pass++) pts = pts.map((p, i) => { const a1 = pts[(i - 1 + pts.length) % pts.length], b1 = pts[(i + 1) % pts.length]; return [(a1[0] + 2 * p[0] + b1[0]) / 4, (a1[1] + 2 * p[1] + b1[1]) / 4]; });
    return pts;
  }).filter((r) => area([r]) > 4);
}

// Tone patches: a shape that sits inside a bigger, earlier shape of a similar lightness
// (fur shading on a mouse, a highlight on a glass tube). These become shading without an
// outline, so a coat reads as one shaded body instead of stripes.
function markPatches(items) {
  const shapes = items.filter((it) => it.kind === 'shape' && !it.eraser);
  shapes.forEach((it, i) => {
    const a = area(it.rings);
    const ring = it.rings[0];
    const probe = Array.from({ length: 8 }, (_, k) => ring[Math.floor((k * ring.length) / 8)]);
    for (let j = i - 1; j >= 0; j--) {
      const o = shapes[j];
      if (area(o.rings) < 2.5 * a || Math.abs(lum(o.color) - lum(it.color)) > 0.45) continue;
      const outer = simplify(o.rings[0], 0.3);
      if (probe.filter((p) => insideRing(p, outer)).length >= 7) { it.patch = true; break; }
    }
  });
}

// Small marks such as the letters in atoms: drawn crisp (no wobble) on a paper-coloured halo.
const isSmallMark = (pts) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return x1 - x0 < 7 && y1 - y0 < 7;
};

// A small letter written by hand: slightly turned and resized, a gentle wobble scaled to
// the letter, an O that doesn't quite close, stroke ends that run on a little, and a faint
// second pass like a pencil going over it.
function handLetter(R, it, col) {
  let pts = it.pts;
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  const rot = ((R() - 0.5) * 10 * Math.PI) / 180, sc = 0.95 + R() * 0.1;
  const cos = Math.cos(rot) * sc, sin = Math.sin(rot) * sc;
  const dx = (R() - 0.5) * 0.4, dy = (R() - 0.5) * 0.4;
  pts = pts.map(([x, y]) => [cx + (x - cx) * cos - (y - cy) * sin + dx, cy + (x - cx) * sin + (y - cy) * cos + dy]);
  if (it.closed) {
    // go round a little more than once, starting somewhere random, so the ends overlap
    const n = pts.length, s0 = Math.floor(R() * n), extra = Math.round(n * (0.06 + R() * 0.08));
    pts = Array.from({ length: n + extra }, (_, i) => pts[(s0 + i) % n]);
  }
  const out = [];
  for (const [pass, op, w] of [[0, 0.92, 0.85], [1, 0.35, 0.6]]) {
    const ph = R() * 6.28, amp = pass ? 0.18 : 0.12;
    let L = 0;
    const q = pts.map((p, i) => {
      if (i) L += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
      const wob = amp * Math.sin(L / 2.2 + ph);
      return [p[0] - (ty / l) * wob, p[1] + (tx / l) * wob];
    });
    if (!it.closed) {
      const run = (a, b) => { const ex = a[0] - b[0], ey = a[1] - b[1], l = Math.hypot(ex, ey) || 1, e = 0.15 + R() * 0.25; return [a[0] + (ex / l) * e, a[1] + (ey / l) * e]; };
      q.unshift(run(q[0], q[Math.min(2, q.length - 1)]));
      q.push(run(q[q.length - 1], q[Math.max(0, q.length - 3)]));
    }
    const d = 'M' + simplify(q, 0.04).map((p) => f(p[0]) + ' ' + f(p[1])).join('L');
    out.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${f(w)}" stroke-opacity="${op}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  return out;
}

// Turn the analysed icon into a pencil SVG string (128x128, no filters).
export function render(items, style, seed, paper = '#ffffff', opts = {}) {
  TUNE = TUNES[opts.size ?? 2]; // level 2 picked by the owner (2026-11-18)
  const R = rng(seed);
  const RL = rng(seed ^ 0x5bd1e995); // own random stream, so letter options don't change the other strokes
  const body = [];
  const defs = [];
  // Clip ids are numbered per file and carry the icon's id (opts.idPrefix), so the same
  // icon always gives the same file and two icons on one page never share an id.
  let clipCount = 0;
  const idPrefix = opts.idPrefix ?? 'pcl';
  for (const it of items) {
    const g = [];
    if (it.kind === 'shape') {
      const d = ringsD(it.rings);
      // See-through shapes (glass, tinted windows) get no paper backing, so what's behind stays visible.
      if (!it.patch && !(it.alpha < 0.6)) g.push(`<path d="${d}" fill="${paper}" fill-rule="${it.rule}"/>`);
      if (it.silhouette) {
        // paper underlay only; its outline is drawn last, on top of the shading
      } else if (it.patch) {
        g.push(...style.patch(R, it));
      } else if (!it.eraser && isThin(it.rings)) {
        // Thin strands (fur, hairlines): one soft pencil mark in the style's tone, no outline.
        const t = style.thin(it);
        g.push(`<path d="${d}" fill="${t.color}" fill-opacity="${f(t.opacity)}" fill-rule="${it.rule}"/>`);
      } else if (!it.eraser) {
        g.push(...style.fill(R, it));
        const oo = TUNE.single ? { ...style.outline(it), passes: 1 } : style.outline(it);
        if (area(it.rings) > 5) for (const e of it.edges) g.push(...pencilStroke(R, e.pts, e.closed, oo));
      }
    } else if (it.kind === 'outline-only') {
      const oo = TUNE.single ? { ...style.outline({ color: [90, 90, 90] }), passes: 1 } : style.outline({ color: [90, 90, 90] });
      for (const e of it.edges) g.push(...pencilStroke(R, e.pts, e.closed, oo));
    } else if (opts.crispMarks !== false && it.sw < 1.5 && isSmallMark(it.pts)) {
      const d = 'M' + simplify(it.pts, 0.05).map((p) => g1(p[0]) + ' ' + g1(p[1])).join('L') + (it.closed ? 'Z' : '');
      const col = style.line(it).color;
      g.push(`<path d="${d}" fill="none" stroke="${paper}" stroke-width="${f(it.sw + 1.6)}" stroke-linecap="round" stroke-linejoin="round"/>`);
      // Hand-drawn letters are the default (picked by the owner); 'crisp' keeps the clean line.
      if ((opts.crispMarks ?? 'hand') === 'hand') g.push(...handLetter(RL, it, col));
      else g.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${f(Math.max(0.9, it.sw))}" stroke-linecap="round" stroke-linejoin="round"/>`);
    } else {
      const lo = style.line(it);
      const k = Math.max(1, Math.round(it.sw / 1.0));
      const w = Math.min(1.1, Math.max(0.6, it.sw / k + 0.15));
      const offsets = Array.from({ length: k }, (_, i) => (k === 1 ? 0 : -it.sw / 2 + w / 2 + (i * (it.sw - w)) / (k - 1)));
      g.push(...pencilStroke(R, it.pts, it.closed, { ...lo, width: w, passes: Math.max(2, k), offsets, wobble: 0.35, spread: 0.3, overshoot: 1.2, grain: [3, 10] }));
    }
    if (it.clip) {
      const id = `${idPrefix}-${clipCount++}`;
      defs.push(`<clipPath id="${id}"><path d="${ringsD(it.clip)}"/></clipPath>`);
      body.push(`<g clip-path="url(#${id})">${g.join('')}</g>`);
    } else body.push(...g);
  }
  const svg = `<svg xmlns="${NS}" viewBox="0 0 128 128">${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${body.join('')}</svg>`;
  return (opts.size ?? 2) >= 1 ? compactSvg(svg) : svg;
}
