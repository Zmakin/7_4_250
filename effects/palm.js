// Three-native Palm shell — standalone, inscribed on its own.
// FRAME-BASED contract (see effects/peony.js).
//
// Palm = a few THICK fronds that rise up and arc outward then over, like the
// crown of a palm tree (plus an implied trunk). Strong upward bias, low frond
// count, thick stars, long trails. Uses the willow trail engine.
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
export const FRAMES = 150;
export const DURATION = Math.round(FRAMES / FPS * 1000); // 2500
export const PEAK_FRAME = 66;

const START_AGE = 0.22;             // trim more birth frames -> no overexposed source ball
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) { f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f); return START_AGE + (f - 1) / FPS; }

export function create(opts = {}) {
  const color   = new Color(opts.color || '#ffd86b');            // gold
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 12), oz = opts.z || 0;
  const streams  = opts.count   || 16;                           // few thick fronds
  const trailLen = opts.trail   || 14;
  const gravity  = opts.gravity != null ? opts.gravity : 8.0;
  const drag     = opts.drag    != null ? opts.drag    : 0.7;    // long arc
  const spread   = (opts.spread || 11) * (opts.scale || 1);
  const lift     = opts.lift    != null ? opts.lift    : 1.7;    // strongly upward
  const trailDt  = opts.trailDt != null ? opts.trailDt : 0.05;
  const r0       = 0.6;

  const count = streams * trailLen;
  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  const v0   = new Float32Array(streams * 3);
  const base = new Float32Array(streams);
  const seed = new Float32Array(streams);

  for (let s = 0; s < streams; s++) {
    const theta = Math.random() * Math.PI * 2;
    let cy = Math.random() * lift - (lift - 1);                  // strong upward dome
    if (cy > 1) cy = 1;
    const horiz = Math.sqrt(Math.max(0, 1 - cy * cy));
    const speed = spread * (0.7 + Math.random() * 0.3);
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
    size: 1.15, map: sparkTexture(), vertexColors: true, transparent: true,   // crisp, not blurry
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
      const tw = 0.88 + 0.12 * Math.sin(t * 12 + seed[s] * 40);
      for (let j = 0; j < trailLen; j++) {
        const ix = (s * trailLen + j) * 3;
        const k = b + tau_j[j];
        pos[ix]     = ox + vx * k;
        pos[ix + 1] = oy + vy * k + droop_j[j];
        pos[ix + 2] = oz + vz * k;
        const ember = j / trailLen;
        const tf = 1 - 0.85 * ember;
        // EXCESSIVE glitter: two fast sines beat against each other so nearly every
        // spark on every frond is constantly popping bright (dense palm sparkle).
        const spk = Math.sin(t * 58 + (seed[s] * 60 + j * 2.1) * 6.3) * Math.sin(t * 91 + j * 5.0 + seed[s] * 33);
        const sparkle = spk > -0.1 ? 2.6 : 0.45;
        const bright = lifeFade * tf * sparkle * (j === 0 ? tw : 0.95);
        col[ix]     = color.r * bright;
        col[ix + 1] = color.g * bright * (1 - 0.3 * ember);
        col[ix + 2] = color.b * bright * (1 - 0.6 * ember);
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
