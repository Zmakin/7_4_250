// Three-native Brocade shell — standalone, inscribed on its own.
// FRAME-BASED contract (see effects/peony.js).
//
// Brocade (per the trade description): a SPIDER-like web of fine lace in the sky,
// a SILVER tail effect that is BRIGHTER than willow or tiger-tail, with long
// tails made of GLITTER. So: a full round silver ball of many fine trails, each
// trail strongly twinkling along its whole length (hard glitter pops, not a
// subtle shimmer). Uses the willow trail engine. Bloom is global in the builder.
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
export const FRAMES = 168;
export const DURATION = Math.round(FRAMES / FPS * 1000); // 2800
export const PEAK_FRAME = 80;

const START_AGE = 0.19;             // skip the overexposed source frames
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) { f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f); return START_AGE + (f - 1) / FPS; }

export function create(opts = {}) {
  const color   = new Color(opts.color || '#e6ecff');            // silver
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 12), oz = opts.z || 0;
  const streams  = opts.count   || 240;                          // many fine lace strands
  const trailLen = opts.trail   || 12;
  const gravity  = opts.gravity != null ? opts.gravity : 7.5;    // some droop, stays a ball
  const drag     = opts.drag    != null ? opts.drag    : 0.95;
  const spread   = (opts.spread || 19) * (opts.scale || 1);      // big round ball
  const lift     = opts.lift    != null ? opts.lift    : 1.05;   // nearly full sphere
  const trailDt  = opts.trailDt != null ? opts.trailDt : 0.05;
  const bright0  = opts.bright  != null ? opts.bright  : 1.2;    // brighter than willow
  const r0       = 0.6;

  const count = streams * trailLen;
  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  const v0   = new Float32Array(streams * 3);
  const base = new Float32Array(streams);
  const seed = new Float32Array(streams);

  for (let s = 0; s < streams; s++) {
    const theta = Math.random() * Math.PI * 2;
    let cy = Math.random() * lift - (lift - 1); if (cy > 1) cy = 1;
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
    const lifeFade = norm < 0.6 ? 1 : smooth01((1 - norm) / 0.4);
    for (let j = 0; j < trailLen; j++) {
      let tj = t - j * trailDt; if (tj < 0) tj = 0;
      const tauj = (1 - Math.exp(-drag * tj)) / drag;
      tau_j[j] = tauj; droop_j[j] = gk * (tauj - tj);
    }
    for (let s = 0; s < streams; s++) {
      const vx = v0[s*3], vy = v0[s*3+1], vz = v0[s*3+2], b = base[s];
      for (let j = 0; j < trailLen; j++) {
        const ix = (s * trailLen + j) * 3;
        const k = b + tau_j[j];
        pos[ix]     = ox + vx * k;
        pos[ix + 1] = oy + vy * k + droop_j[j];
        pos[ix + 2] = oz + vz * k;
        const tf = 1 - 0.8 * (j / trailLen);
        // HARD glitter: each spark on each strand pops bright on its own phase
        const gl = Math.sin(t * 33 + (seed[s] * 60 + j * 1.7) * 6.3);
        const glitter = gl > 0.55 ? 2.0 : 0.7;
        const v = lifeFade * tf * glitter * bright0;
        col[ix] = color.r * v; col[ix + 1] = color.g * v; col[ix + 2] = color.b * v;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    mat.opacity = norm < 0.82 ? 1 : smooth01((1 - norm) / 0.18);
  }
  function setFrame(f) { setAgeSeconds(frameToAge(f)); }
  function dispose() { geo.dispose(); mat.dispose(); }
  setFrame(1);
  return { object, setFrame, frames: FRAMES, dispose };
}
