// Three-native Crackling Rain shell — standalone, inscribed on its own.
// FRAME-BASED contract (see effects/peony.js).
//
// Crackling Rain = a gold burst that rains DOWN in fine trails, each star
// crackling/popping as it falls (glittery flicker). Like waterfall but with a
// fuller spherical spread and a per-head crackle. Uses the willow trail engine.
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
export const FRAMES = 144;
export const DURATION = Math.round(FRAMES / FPS * 1000); // 2400
export const PEAK_FRAME = 66;

const START_AGE = 0.20;             // trim the bright source -> less light pollution
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) { f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f); return START_AGE + (f - 1) / FPS; }

export function create(opts = {}) {
  const color   = new Color(opts.color || '#ffd27a');            // warm gold
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 12), oz = opts.z || 0;
  const streams  = opts.count   || 210;                          // more sparks
  const trailLen = opts.trail   || 9;
  const gravity  = opts.gravity != null ? opts.gravity : 12.0;   // rains down
  const drag     = opts.drag    != null ? opts.drag    : 1.15;
  const spread   = (opts.spread || 13) * (opts.scale || 1);
  const lift     = opts.lift    != null ? opts.lift    : 1.0;    // full sphere (rains all around)
  const trailDt  = opts.trailDt != null ? opts.trailDt : 0.045;
  const r0       = 0.5;

  const count = streams * trailLen;
  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  const v0   = new Float32Array(streams * 3);
  const base = new Float32Array(streams);
  const seed = new Float32Array(streams);

  for (let s = 0; s < streams; s++) {
    const theta = Math.random() * Math.PI * 2;
    let cy = Math.random() * lift - (lift - 1);
    if (cy > 1) cy = 1;
    const horiz = Math.sqrt(Math.max(0, 1 - cy * cy));
    const speed = spread * (0.55 + Math.random() * 0.45);
    v0[s*3]   = Math.cos(theta) * horiz * speed;
    v0[s*3+1] = cy * speed;
    v0[s*3+2] = Math.sin(theta) * horiz * speed;
    base[s]   = r0 / speed;
    seed[s]   = Math.random();
  }
  for (let i = 0; i < count; i++) { pos[i*3] = ox; pos[i*3+1] = oy; pos[i*3+2] = oz; }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color',    new BufferAttribute(col, 3));
  const mat = new PointsMaterial({
    size: 0.95, map: sparkTexture(), vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });
  const object = new Points(geo, mat);

  const tau_j = new Float32Array(trailLen), droop_j = new Float32Array(trailLen);

  function setAgeSeconds(t) {
    const gk = gravity / drag;
    const norm = Math.min(1, t / MAX_AGE);
    const lifeFade = norm < 0.55 ? 1 : smooth01((1 - norm) / 0.45);
    for (let j = 0; j < trailLen; j++) {
      let tj = t - j * trailDt; if (tj < 0) tj = 0;
      const tauj = (1 - Math.exp(-drag * tj)) / drag;
      tau_j[j] = tauj; droop_j[j] = gk * (tauj - tj);
    }
    for (let s = 0; s < streams; s++) {
      const vx = v0[s*3], vy = v0[s*3+1], vz = v0[s*3+2], b = base[s];
      // crackle: frequent, bright per-stream pop on the head (obvious sparkle)
      const cr = Math.sin(t * 60 + seed[s] * 120) * Math.sin(t * 39 + seed[s] * 77);
      const headFlash = cr > 0.0 ? 2.4 : 0.35;
      for (let j = 0; j < trailLen; j++) {
        const ix = (s * trailLen + j) * 3;
        const k = b + tau_j[j];
        pos[ix]     = ox + vx * k;
        pos[ix + 1] = oy + vy * k + droop_j[j];
        pos[ix + 2] = oz + vz * k;
        const tf = 1 - j / trailLen;
        const bright = lifeFade * tf * tf * (j === 0 ? headFlash : 1);
        col[ix] = color.r * bright; col[ix + 1] = color.g * bright; col[ix + 2] = color.b * bright;
      }
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
