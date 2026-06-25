// Three-native Spider shell — standalone, inscribed on its own.
// FRAME-BASED contract (see effects/peony.js).
//
// Spider = a small number of long, STRAIGHT thin legs that shoot out radially
// almost without slowing (very low drag), then barely droop at the tips — like
// spider legs. Uses the willow trail engine for the leg streaks, but with very
// low drag (straight legs) and low gravity (only a slight tip droop).
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
export const FRAMES = 111;
export const DURATION = Math.round(FRAMES / FPS * 1000); // 1850
export const PEAK_FRAME = 44;

const START_AGE = 0.16;             // less source saturation
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) { f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f); return START_AGE + (f - 1) / FPS; }

export function create(opts = {}) {
  const color   = new Color(opts.color || '#9fffd0');
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 12), oz = opts.z || 0;
  const streams  = opts.count   || 40;                           // few legs
  const trailLen = opts.trail   || 16;                           // ~2x longer legs
  const gravity  = opts.gravity != null ? opts.gravity : 4.0;    // slight tip droop only
  const drag     = opts.drag    != null ? opts.drag    : 0.22;   // even lower -> longer straight legs
  const spread   = (opts.spread || 13) * (opts.scale || 1);
  const trailDt  = opts.trailDt != null ? opts.trailDt : 0.072;  // stretch legs to match the longer life
  const r0       = 0.4;

  const count = streams * trailLen;
  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  const v0   = new Float32Array(streams * 3);
  const base = new Float32Array(streams);
  const seed = new Float32Array(streams);

  for (let s = 0; s < streams; s++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const speed = spread * (0.85 + Math.random() * 0.15);        // near-uniform -> even legs
    v0[s*3]   = Math.sin(phi) * Math.cos(theta) * speed;
    v0[s*3+1] = Math.cos(phi) * speed;
    v0[s*3+2] = Math.sin(phi) * Math.sin(theta) * speed;
    base[s]   = r0 / speed;
    seed[s]   = Math.random();
  }
  for (let i = 0; i < count; i++) { pos[i*3] = ox; pos[i*3+1] = oy; pos[i*3+2] = oz; }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color',    new BufferAttribute(col, 3));
  const mat = new PointsMaterial({
    size: 0.85, map: sparkTexture(), vertexColors: true, transparent: true,   // thin legs
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });
  const object = new Points(geo, mat);

  const tau_j = new Float32Array(trailLen), droop_j = new Float32Array(trailLen);

  function setAgeSeconds(t) {
    const gk = gravity / drag;
    const norm = Math.min(1, t / MAX_AGE);
    const lifeFade = norm < 0.5 ? 1 : smooth01((1 - norm) / 0.5);
    for (let j = 0; j < trailLen; j++) {
      let tj = t - j * trailDt; if (tj < 0) tj = 0;
      const tauj = (1 - Math.exp(-drag * tj)) / drag;
      tau_j[j] = tauj; droop_j[j] = gk * (tauj - tj);
    }
    for (let s = 0; s < streams; s++) {
      const vx = v0[s*3], vy = v0[s*3+1], vz = v0[s*3+2], b = base[s];
      const tw = 0.88 + 0.12 * Math.sin(t * 16 + seed[s] * 40);
      for (let j = 0; j < trailLen; j++) {
        const ix = (s * trailLen + j) * 3;
        const k = b + tau_j[j];
        pos[ix]     = ox + vx * k;
        pos[ix + 1] = oy + vy * k + droop_j[j];
        pos[ix + 2] = oz + vz * k;
        const tf = 1 - j / trailLen;
        const bright = lifeFade * tf * (j === 0 ? tw : 1);
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
