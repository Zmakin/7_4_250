// Three-native SHAPE shell -- standalone, inscribed on its own.
// FRAME-BASED contract (see effects/peony.js / effects/pearls.js).
//
// The Three counterpart of animations/shape_Ring.html: stars launch from the
// central pop and fly outward, each aimed at its spot on the chosen outline, so
// the shape draws itself as the break expands -- then coasts to the outline and
// holds (gently sagging + fading). One module renders ALL shapes; the host
// passes which one via opts.shape (circle/square/triangle/diamond/star/heart/
// rocket -- bitcoin stays on the p5 path for now).
import {
  BufferGeometry, BufferAttribute, PointsMaterial, Points,
  Color, AdditiveBlending, CanvasTexture
} from 'three';

let _tex = null;
function sparkTexture() {
  if (_tex) return _tex;
  const s = 512, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  grd.addColorStop(0.0, 'rgba(255,255,255,0.72)');     // dimmed core -> sharp bead, color shows, less white-hot wash
  grd.addColorStop(0.35, 'rgba(255,255,255,0.72)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.45)');
  grd.addColorStop(0.8, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  _tex = new CanvasTexture(c);
  return _tex;
}
function smooth01(x) { x = x <= 0 ? 0 : x >= 1 ? 1 : x; return x * x * (3 - 2 * x); }

export const FPS = 60;
export const FRAMES = 120;
export const DURATION = Math.round(FRAMES / FPS * 1000); // 2000
// Spaced beads expand into the shape then keep drifting/sagging (pearls feel);
// ~frame 60 reads as the clearest full shape before it breaks up.
export const PEAK_FRAME = 60;

const START_AGE = 0.06;
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) { f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f); return START_AGE + (f - 1) / FPS; }

// world units per shape-space pixel. shape_Ring.html draws shapes at ~150px
// extent in its 800px canvas; 0.115 makes the circle radius (~17 world units)
// match the pearls/circle reference so every shape reads at the same scale.
const SHAPE_SCALE = 0.115;

// ---- shape outlines (offsets from centre, shape-space px, +y DOWN) ----------
// Ported from animations/shape_Ring.html, but with FEW, EVENLY-SPACED beads
// (pearls style) -- each dot reads as a distinct bead, not a solid line.
function getShapePoints(shape) {
  switch (shape) {
    case 'square':   return polyPoints([[-125,-125],[125,-125],[125,125],[-125,125]], 56);
    case 'triangle': return polyPoints([[0,-150],[132,98],[-132,98]], 48);
    case 'diamond':  return polyPoints([[0,-155],[150,0],[0,155],[-150,0]], 52);
    case 'star':     return starPoints();
    case 'heart':    return heartPoints();
    case 'rocket':   return rocketPoints();
    case 'bitcoin':  return bitcoinPoints();
    default:         return circlePoints();
  }
}
function circlePoints() {
  const p = [];
  for (let i = 0; i < 46; i++) { const a = (i / 46) * Math.PI * 2; p.push({ x: Math.cos(a) * 150, y: Math.sin(a) * 150 }); }
  return p;
}
function starPoints() {
  const v = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 155 : 64;
    v.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return polyPoints(v, 56);
}
function heartPoints() {
  const p = [];
  for (let i = 0; i < 52; i++) {
    const t = (i / 52) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    p.push({ x: x * 9.2, y: y * 9.2 });
  }
  return p;
}
function rocketPoints() {
  const v = [
    [0, -160], [40, -80], [40, 30], [85, 110], [40, 70],
    [18, 70], [12, 100], [-12, 100], [-18, 70], [-40, 70],
    [-85, 110], [-40, 30], [-40, -80]
  ];
  return polyPoints(v, 56);
}
// ---- hollow ₿ glyph outline (ported from animations/shape_Ring.html) --------
// A flat-backed stem, two FULL rounded D-loops with hollow counters, a pinched
// waist, and four prongs top & bottom. bitcoinPoints traces ONLY the edge of
// that silhouette (outer edge + the two counter holes) so the B is hollow and
// scales uniformly from the central pop -- matching the real ₿ proportions.
const B_LEFT = -70, B_STEM_R = -34, B_CAP = 74;
const B_XCTR = -8, B_RX = B_CAP - B_XCTR;
const B_UP_T = -108, B_UP_B = -1;   // outer loops pinch tighter at the centre spine
const B_LO_T = 1,    B_LO_B = 108;
const B_WAIST = 2;                  // half-height of the pinched waist gap
const B_WAIST_R = 6;               // short spine -> the two bowls meet in a sharp point, not a blunt bar
// Counters are D-shaped (flat left wall + rounded right) so the inner edge reads
// as a straight vertical "centre line" parallel to the stem, like a real B.
const B_HOLE_LEFT = -23;           // straight left wall of each counter (1 space toward centre)
const B_HX = 50, B_HY = 33;        // counter reach right (-> -23+50=27) and half-height (shorter counter)
// Counters pushed toward the middle so the two inner edges converge into a single
// band-width stroke (top stroke == middle band == ~20), like a real B.
const B_UP_CY = -49, B_LO_CY = 49; // counter centres
function bsq(v) { return v * v; }
function bowlD(x, y, yTop, yBot) {
  if (y < yTop || y > yBot || x < B_LEFT) return false;
  if (x <= B_XCTR) return true;
  const yc = (yTop + yBot) / 2, Hy = (yBot - yTop) / 2;
  return bsq((x - B_XCTR) / B_RX) + bsq((y - yc) / Hy) <= 1;
}
// D-shaped counter hole: flat left wall at B_HOLE_LEFT, half-ellipse bulging right.
function bHole(x, y, ccy) {
  if (x < B_HOLE_LEFT) return false;
  return bsq((x - B_HOLE_LEFT) / B_HX) + bsq((y - ccy) / B_HY) <= 1;
}
function bLoop(x, y, yTop, yBot, ccy) {
  return bowlD(x, y, yTop, yBot) && !bHole(x, y, ccy);
}
function bFill(x, y) {
  if (y < B_UP_T || y > B_LO_B) return false;
  if (x >= B_LEFT && x <= B_STEM_R) return true;                    // stem
  if (y >= -B_WAIST && y <= B_WAIST && x >= B_LEFT && x <= B_WAIST_R) return true; // waist bar
  if (bLoop(x, y, B_UP_T, B_UP_B, B_UP_CY)) return true;           // upper loop
  if (bLoop(x, y, B_LO_T, B_LO_B, B_LO_CY)) return true;           // lower loop
  return false;
}
function bProng(x, y) {
  const bar = (x0, x1) => x >= x0 && x <= x1 && ((y >= -138 && y <= B_UP_T) || (y >= B_LO_B && y <= 138));
  return bar(-62, -44) || bar(-16, 6);   // left spike; right spike widened + nudged left
}
function solidB(x, y) { return bFill(x, y) || bProng(x, y); }
function bitcoinPoints() {
  const pts = []; const S = 8, CX = 8;   // step -> bead spacing (wider = discrete sparks, not a solid line); CX centres the glyph
  for (let x = -86; x <= 82; x += S) {
    for (let y = -140; y <= 140; y += S) {
      if (!solidB(x, y)) continue;
      // keep a cell only if it borders empty space (i.e. it's on the outline)
      if (!solidB(x - S, y) || !solidB(x + S, y) || !solidB(x, y - S) || !solidB(x, y + S)) {
        // Drop flat horizontal bottom/top segments near the waist: a dot that is only on
        // the bottom (or top) edge — right neighbour inside but below (above) is empty —
        // creates rectangular "square base" artefacts on each loop.  Keep only corner dots
        // (where the right neighbour is also empty) so the loops taper diagonally to a vertex.
        if (solidB(x + S, y) && !solidB(x, y + S) && y > -30 && y < 0) continue; // upper flat bottom
        if (solidB(x + S, y) && !solidB(x, y - S) && y <  30 && y > 0) continue; // lower flat top
        // Remove natural dots that are being repositioned explicitly below.
        if ((y === -4 || y === 4)   && x === 16) continue; // y=±4 tip pair  → moved to x=32
        if ((y === -12 || y === 12) && x === 40) continue; // y=±12 corners   → moved to x=56
        pts.push({ x: x + CX, y: y });
      }
    }
  }
  // Convergence arc — explicit placements for the waist vertex and surrounding pairs.
  // Arc from vertex outward: vertex(x=24,y=0) → 2nd(x=32,y=±4) → 3rd(x=40,y=±8) → 4th(x=56,y=±12)
  pts.push({ x: 16 + CX, y:   0 }); // vertex — single dot (output x=24)
  pts.push({ x: 24 + CX, y:  -4 }); // 2nd pair top    (output x=32)
  pts.push({ x: 24 + CX, y:   4 }); // 2nd pair bottom (output x=32)
  pts.push({ x: 32 + CX, y:  -8 }); // 3rd pair top    (output x=40, off-grid row)
  pts.push({ x: 32 + CX, y:   8 }); // 3rd pair bottom (output x=40, off-grid row)
  pts.push({ x: 48 + CX, y: -12 }); // 4th pair top    (output x=56)
  pts.push({ x: 48 + CX, y:  12 }); // 4th pair bottom (output x=56)
  return pts;
}

// Distribute n points evenly along a closed polygon's perimeter.
function polyPoints(verts, n) {
  const segs = []; let total = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i], b = verts[(i + 1) % verts.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, d }); total += d;
  }
  const pts = [];
  for (let i = 0; i < n; i++) {
    const target = (i / n) * total; let acc = 0;
    for (const s of segs) {
      if (acc + s.d >= target) {
        const f = (target - acc) / s.d;
        pts.push({ x: s.a[0] + (s.b[0] - s.a[0]) * f, y: s.a[1] + (s.b[1] - s.a[1]) * f });
        break;
      }
      acc += s.d;
    }
  }
  return pts;
}

export function create(opts = {}) {
  const color   = new Color(opts.color || '#ff64c8');
  const shape   = opts.shape || 'circle';
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 12), oz = opts.z || 0;
  const scale   = opts.scale || 1;
  // The ₿ is a tall glyph -- keep gravity low so it expands in proportion
  // instead of sagging into a blob; the other shapes get a gentle droop.
  const gravity = opts.gravity != null ? opts.gravity : (shape === 'bitcoin' ? 0.8 : 2.2);
  const drag    = opts.drag    != null ? opts.drag    : 0.9;   // pearls drag -> keeps expanding, never rigid
  const r0      = 0.5;                                         // tiny birth radius
  // px jitter so edges aren't CAD-perfect. The ₿ is traced on a tight 5px bead
  // grid, so large jitter scrambles the outline (skinny loops, uneven spacing) --
  // keep it small for bitcoin, looser for the big polygon shapes.
  const JIT     = shape === 'bitcoin' ? 1.0 : 3.0;

  // Build the outline in world-space offsets (flip y: screen +y down -> world +y up),
  // with a small per-bead jitter so straight edges read as hand-drawn, not CAD-perfect.
  const raw = getShapePoints(shape);
  const count = raw.length;
  const tx = new Float32Array(count), ty = new Float32Array(count); // target offsets
  for (let i = 0; i < count; i++) {
    tx[i] =  (raw[i].x + (Math.random() * 2 - 1) * JIT) * SHAPE_SCALE * scale;
    ty[i] = -(raw[i].y + (Math.random() * 2 - 1) * JIT) * SHAPE_SCALE * scale;
  }

  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  const v0   = new Float32Array(count * 3);
  const base = new Float32Array(count);
  const seed = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const dist = Math.max(0.5, Math.hypot(tx[i], ty[i]));      // target distance from centre
    const ux = tx[i] / dist, uy = ty[i] / dist;               // aim direction
    // asymptotic offset = unit*(r0 + speed/drag); pick speed so it lands exactly
    // on the target -> the outline forms and holds.
    const speed = Math.max(0.2, (dist - r0) * drag);
    v0[i*3]   = ux * speed;
    v0[i*3+1] = uy * speed;
    v0[i*3+2] = 0;
    base[i]   = r0 / speed;
    pos[i*3] = ox; pos[i*3+1] = oy; pos[i*3+2] = oz;
    seed[i] = Math.random();
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color',    new BufferAttribute(col, 3));
  const mat = new PointsMaterial({
    size: 1.5, map: sparkTexture(), vertexColors: true, transparent: true,   // small sharp beads -> reads as a line
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });
  const object = new Points(geo, mat);

  function setAgeSeconds(t) {
    const ex = Math.exp(-drag * t), tau = (1 - ex) / drag, gk = gravity / drag;
    const norm = Math.min(1, t / MAX_AGE);
    const fade = norm < 0.6 ? 1 : smooth01((1 - norm) / 0.4);
    for (let i = 0; i < count; i++) {
      const ix = i * 3, k = base[i] + tau;
      pos[ix]     = ox + v0[ix]     * k;
      pos[ix + 2] = oz + v0[ix + 2] * k;
      pos[ix + 1] = oy + v0[ix + 1] * k + gk * (tau - t);
      const tw = 0.9 + 0.1 * Math.sin(t * 9 + seed[i] * 40);
      const bright = fade * tw;
      col[ix] = color.r * bright; col[ix + 1] = color.g * bright; col[ix + 2] = color.b * bright;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    mat.opacity = norm < 0.8 ? 1 : smooth01((1 - norm) / 0.2);
  }
  function setFrame(f) { setAgeSeconds(frameToAge(f)); }
  function dispose() { geo.dispose(); mat.dispose(); }
  setFrame(1);
  return { object, setFrame, frames: FRAMES, dispose };
}
