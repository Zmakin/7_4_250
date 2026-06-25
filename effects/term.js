// Three-native "Term" effect -- standalone, inscribed on its own. The 4th-of-July
// word firework: a scaled-up PALM-FROND TAIL climbs to the top-centre of the
// screen, holds for a beat, then DELAY-EXPLODES into the chosen TERM spelled out
// in sparkling letters that jitter and shimmer and hold through to the loop.
//
// One module, many dropdown entries (america250, usa, ...): the text comes from
// opts.term and the colour from opts.color (the show's Bitcoin-derived palette).
//
// FRAME-BASED contract (see effects/peony.js). The HOST schedules this so its
// burst lands in the final ~2s of the show and holds through the 0.5s tail to the
// loop point; the term layer is excluded from the show-end calc (it never extends
// the show). renderOrder 200 -> in FRONT of any foreground.
import {
  BufferGeometry, BufferAttribute, PointsMaterial, Points, Group,
  Color, AdditiveBlending, CanvasTexture
} from 'three';

export const FPS = 60;
// rise(0.7s) -> hold -> burst -> then the WORD holds on screen a full 2.0s.
// The host schedules startTime = end - DURATION so those final 120 frames (the
// 2s of visible text) land in the last 2s of the show and hold to the loop.
const RISE_END   = 42;     // tail reaches the apex
const BURST_AT   = 54;     // letters explode out of the apex
const SETTLE_END = 90;     // letters have converged into the word
const HOLD_FRAMES = 120;   // 2.0s of fully-formed text (the requirement)
export const FRAMES = SETTLE_END + HOLD_FRAMES;          // 210 (~3.5s total)
export const DURATION = Math.round(FRAMES / FPS * 1000); // 3500
export const PEAK_FRAME = SETTLE_END + 30;               // text fully formed + shimmering
const VIEW_SPAN = 42.9, VIEW_CENTER_Y = 12;
const X_MAX = VIEW_SPAN / 2;
const Y_BOT = VIEW_CENTER_Y - VIEW_SPAN / 2;
const pctY = p => Y_BOT + p * VIEW_SPAN;
const APEX_X = 0, APEX_Y = pctY(0.84);                   // top-centre

let _tex = null;
function sparkTexture() {
  if (_tex) return _tex;
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  grd.addColorStop(0.0, 'rgba(255,255,255,0.72)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.72)');   // dimmed core -> color shows, less white-hot wash
  grd.addColorStop(0.55, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  _tex = new CanvasTexture(c);
  return _tex;
}
function smooth01(x) { x = x <= 0 ? 0 : x >= 1 ? 1 : x; return x * x * (3 - 2 * x); }
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sample the term text into world-space target points near the top-centre.
function textTargets(term, maxPts) {
  const CW = 1024, CH = 256;
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, CW, CH);
  g.fillStyle = '#fff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // shrink font until it fits the canvas width
  let fs = 170;
  do { g.font = `900 ${fs}px Arial, sans-serif`; fs -= 6; }
  while (g.measureText(term).width > CW * 0.92 && fs > 40);
  g.fillText(term, CW / 2, CH / 2);
  const data = g.getImageData(0, 0, CW, CH).data;
  const pts = [];
  const step = 3;
  for (let y = 0; y < CH; y += step) for (let x = 0; x < CW; x += step) {
    if (data[(y * CW + x) * 4] > 128) pts.push([x, y]);
  }
  // thin to maxPts
  const targets = [];
  const stride = Math.max(1, Math.floor(pts.length / maxPts));
  // word occupies most of the width, a shallow band of height near the apex
  const wHalf = X_MAX * 0.92, hHalf = wHalf * (CH / CW);
  for (let i = 0; i < pts.length; i += stride) {
    const [x, y] = pts[i];
    const wx = (x / CW - 0.5) * 2 * wHalf;
    const wy = APEX_Y - (y / CH - 0.5) * 2 * hHalf;       // canvas y down -> world y up
    targets.push([wx, wy]);
  }
  return targets;
}

export function create(opts = {}) {
  const color = new Color(opts.color || '#ffd24a');
  const term  = (opts.term || 'USA').toString();
  const seedRng = mulberry32(0x7e72 ^ hashStr(term));

  const object = new Group();

  // ---- rising palm-frond tail (climbs to the apex, sheds a few sparks) ----
  const TRAIL = 26;
  const tpos = new Float32Array(TRAIL * 3), tcol = new Float32Array(TRAIL * 3);
  const tgeo = new BufferGeometry();
  tgeo.setAttribute('position', new BufferAttribute(tpos, 3));
  tgeo.setAttribute('color', new BufferAttribute(tcol, 3));
  const tmat = new PointsMaterial({ size: 2.8, map: sparkTexture(), vertexColors: true,
    transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true });
  const trunk = new Points(tgeo, tmat); object.add(trunk);
  const startY = pctY(-0.05);                              // just below the frame
  function tailHeadY(f) {
    const u = smooth01(Math.min(1, f / RISE_END));
    return startY + (APEX_Y - startY) * u;
  }

  // ---- letter particles ----
  const targets = textTargets(term, 720);
  const N = targets.length;
  const tx = new Float32Array(N), ty = new Float32Array(N);
  const dirx = new Float32Array(N), diry = new Float32Array(N), rad = new Float32Array(N);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    tx[i] = targets[i][0]; ty[i] = targets[i][1];
    const a = seedRng() * Math.PI * 2;
    dirx[i] = Math.cos(a); diry[i] = Math.sin(a);
    rad[i] = 2 + seedRng() * 5;
    seed[i] = seedRng() * 99;
  }
  const lpos = new Float32Array(N * 3), lcol = new Float32Array(N * 3);
  const lgeo = new BufferGeometry();
  lgeo.setAttribute('position', new BufferAttribute(lpos, 3));
  lgeo.setAttribute('color', new BufferAttribute(lcol, 3));
  const lmat = new PointsMaterial({ size: 1.5, map: sparkTexture(), vertexColors: true,
    transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true });
  const letters = new Points(lgeo, lmat); object.add(letters);

  object.renderOrder = 200;

  function setFrame(f) {
    f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f);

    // --- tail: visible while rising, fades right after the burst ---
    const tailFade = f < BURST_AT ? 1 : smooth01((BURST_AT + 10 - f) / 10);
    const headY = tailHeadY(f);
    for (let j = 0; j < TRAIL; j++) {
      const ix = j * 3;
      const yy = headY - j * (1.4);                        // trail streams downward
      tpos[ix] = APEX_X; tpos[ix+1] = Math.max(startY, yy); tpos[ix+2] = 0;
      const tf = 1 - j / TRAIL;
      const v = tailFade * tf * tf * (j === 0 ? 1.8 : 1);
      const mix = j === 0 ? 0.6 : 0;
      tcol[ix]   = (color.r + (1 - color.r) * mix) * v;
      tcol[ix+1] = (color.g + (1 - color.g) * mix) * v;
      tcol[ix+2] = (color.b + (1 - color.b) * mix) * v;
    }
    tgeo.attributes.position.needsUpdate = true;
    tgeo.attributes.color.needsUpdate = true;
    tmat.opacity = tailFade;

    // --- letters: parked -> explode -> converge -> shimmer/jitter ---
    const t = (f - 1) / FPS;
    for (let i = 0; i < N; i++) {
      const ix = i * 3;
      let x, y, bright;
      if (f < BURST_AT) {
        x = APEX_X; y = APEX_Y; bright = 0;                // not yet
      } else if (f < SETTLE_END) {
        const u = (f - BURST_AT) / (SETTLE_END - BURST_AT);   // 0..1
        const conv = smooth01(u);
        const arc = Math.sin(u * Math.PI) * (1 - u);          // bow out then in
        x = APEX_X + (tx[i] - APEX_X) * conv + dirx[i] * rad[i] * arc;
        y = APEX_Y + (ty[i] - APEX_Y) * conv + diry[i] * rad[i] * arc;
        bright = smooth01(u * 2);
      } else {
        const jit = 0.10;                                     // small letter jitter
        x = tx[i] + Math.sin(t * 9 + seed[i]) * jit;
        y = ty[i] + Math.cos(t * 11 + seed[i] * 1.7) * jit;
        bright = 1;
      }
      // high sparkle: sharp per-particle flicker once formed
      const spark = f < BURST_AT ? 0 : (0.7 + 0.55 * Math.sin(t * 33 + seed[i] * 7) * Math.sin(t * 19 + seed[i]));
      const v = bright * Math.max(0.25, spark);
      const white = f >= SETTLE_END ? 0.35 * Math.max(0, Math.sin(t * 26 + seed[i] * 3)) : 0.2;
      lcol[ix]   = (color.r + (1 - color.r) * white) * v * 1.6;
      lcol[ix+1] = (color.g + (1 - color.g) * white) * v * 1.6;
      lcol[ix+2] = (color.b + (1 - color.b) * white) * v * 1.6;
      lpos[ix] = x; lpos[ix+1] = y; lpos[ix+2] = 0;
    }
    lgeo.attributes.position.needsUpdate = true;
    lgeo.attributes.color.needsUpdate = true;
  }
  function dispose() { tgeo.dispose(); tmat.dispose(); lgeo.dispose(); lmat.dispose(); }
  setFrame(1);
  return { object, setFrame, frames: FRAMES, dispose };
}

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
