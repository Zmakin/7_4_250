// Three-native Dragon Eggs shell — standalone, inscribed on its own.
// FRAME-BASED contract (see effects/peony.js).
//
// Dragon Eggs = a TWO-STAGE shell. Stage 1: a large burst throws "eggs" outward.
// Stage 2: partway out, each egg bursts AGAIN into a small cluster of crackling /
// strobing sparks (the popping dragon eggs). Closed-form: each egg carries its
// children, which overlap (one rising dot) until the egg's split time, then fly
// out from the egg's split position and flicker.
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
  grd.addColorStop(0.0, 'rgba(255,255,255,0.72)');
  grd.addColorStop(0.33, 'rgba(255,255,255,0.72)');   // dimmed core -> spark color shows, less white-hot wash
  grd.addColorStop(0.55, 'rgba(255,255,255,0.45)');
  grd.addColorStop(0.8, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  _tex = new CanvasTexture(c);
  return _tex;
}
function smooth01(x) { x = x <= 0 ? 0 : x >= 1 ? 1 : x; return x * x * (3 - 2 * x); }

export const FPS = 60;
export const FRAMES = 138;
export const DURATION = Math.round(FRAMES / FPS * 1000); // 2300
export const PEAK_FRAME = 60;       // secondary clusters fully open & crackling

const START_AGE = 0.06;
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) { f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f); return START_AGE + (f - 1) / FPS; }

export function create(opts = {}) {
  const color   = new Color(opts.color || '#ffab33');            // warm gold/orange
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 12), oz = opts.z || 0;
  const eggs     = opts.count    || 60;
  const subCount = opts.sub      != null ? opts.sub      : 7;     // sparks per egg
  const gravity  = opts.gravity  != null ? opts.gravity  : 5.0;   // stage-1 droop
  const drag     = opts.drag     != null ? opts.drag     : 1.1;
  const spread   = (opts.spread  || 16) * (opts.scale || 1);      // larger stage-1 explosion
  const splitAge = opts.splitAge != null ? opts.splitAge : 0.55;  // when eggs pop
  const subSpeed = opts.subSpeed != null ? opts.subSpeed : 5.0;   // stage-2 expansion
  const subGrav  = opts.subGrav  != null ? opts.subGrav  : 6.0;
  const rate     = opts.rate     != null ? opts.rate     : 34;    // crackle/strobe rate
  const r0       = 0.5;

  const count = eggs * subCount;
  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  const v0   = new Float32Array(eggs * 3);   // egg launch velocity
  const sx   = new Float32Array(eggs);       // egg split position (precomputed)
  const sy   = new Float32Array(eggs);
  const sz   = new Float32Array(eggs);
  const ts   = new Float32Array(eggs);       // per-egg split age
  const cd   = new Float32Array(count * 3);  // child unit dir
  const base = new Float32Array(eggs);
  const seed = new Float32Array(count);

  function eggPos(p, age, out) {
    const ex = Math.exp(-drag * age), tau = (1 - ex) / drag, gk = gravity / drag;
    const k = base[p] + tau;
    out[0] = ox + v0[p*3]   * k;
    out[1] = oy + v0[p*3+1] * k + gk * (tau - age);
    out[2] = oz + v0[p*3+2] * k;
  }
  const tmp = [0, 0, 0];

  for (let p = 0; p < eggs; p++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const speed = spread * (0.55 + Math.random() * 0.45);
    v0[p*3]   = Math.sin(phi) * Math.cos(theta) * speed;
    v0[p*3+1] = Math.cos(phi) * speed;
    v0[p*3+2] = Math.sin(phi) * Math.sin(theta) * speed;
    base[p]   = r0 / speed;
    ts[p]     = splitAge * (0.85 + Math.random() * 0.3);
    eggPos(p, ts[p], tmp);
    sx[p] = tmp[0]; sy[p] = tmp[1]; sz[p] = tmp[2];
    for (let q = 0; q < subCount; q++) {
      const ct = Math.random() * Math.PI * 2, cph = Math.acos(2 * Math.random() - 1);
      const ci = (p * subCount + q) * 3;
      cd[ci]   = Math.sin(cph) * Math.cos(ct);
      cd[ci+1] = Math.cos(cph);
      cd[ci+2] = Math.sin(cph) * Math.sin(ct);
      seed[p * subCount + q] = Math.random();
    }
  }
  for (let i = 0; i < count; i++) { pos[i*3] = ox; pos[i*3+1] = oy; pos[i*3+2] = oz; }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color',    new BufferAttribute(col, 3));
  const mat = new PointsMaterial({
    size: 1.0, map: sparkTexture(), vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });
  const object = new Points(geo, mat);

  function setAgeSeconds(t) {
    const norm = Math.min(1, t / MAX_AGE);
    const fade = norm < 0.55 ? 1 : smooth01((1 - norm) / 0.45);
    for (let p = 0; p < eggs; p++) {
      const dt = t - ts[p];
      const split = dt > 0;
      if (!split) eggPos(p, t, tmp);                              // stage 1: the rising egg
      const ex = split ? subSpeed * dt : 0;
      const gy = split ? 0.5 * subGrav * dt * dt : 0;
      // small explosion sim: right at the burst the sparks still overlap near the
      // split point, so flash them bright to read as a little pop of light.
      const splitFlash = (split && dt < 0.14) ? smooth01((0.14 - dt) / 0.14) : 0;
      for (let q = 0; q < subCount; q++) {
        const idx = p * subCount + q, ix = idx * 3;
        let bx, by, bz, bright;
        if (!split) {
          bx = tmp[0]; by = tmp[1]; bz = tmp[2];
          bright = fade * (0.8 + 0.2 * Math.sin(t * 12 + seed[idx] * 40)); // egg glows
        } else {
          bx = sx[p] + cd[ix]   * ex;
          by = sy[p] + cd[ix+1] * ex - gy;
          bz = sz[p] + cd[ix+2] * ex;
          // crackle/strobe each spark, plus the brief overlapping burst flash
          const fl = Math.sin(t * rate + seed[idx] * 120) * Math.sin(t * (rate * 0.7) + seed[idx] * 53);
          bright = fade * ((fl > 0.0 ? 1.7 : 0.12) + splitFlash * 2.4);
        }
        pos[ix] = bx; pos[ix+1] = by; pos[ix+2] = bz;
        col[ix] = color.r * bright; col[ix+1] = color.g * bright; col[ix+2] = color.b * bright;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    mat.opacity = norm < 0.85 ? 1 : smooth01((1 - norm) / 0.15);
  }
  function setFrame(f) { setAgeSeconds(frameToAge(f)); }
  function dispose() { geo.dispose(); mat.dispose(); }
  setFrame(1);
  return { object, setFrame, frames: FRAMES, dispose };
}
