// Three-native Dahlia shell — standalone, inscribed on its own.
// FRAME-BASED contract (see effects/peony.js).
//
// Dahlia = a Peony with FEWER, LARGER, more widely-spaced stars thrown FARTHER
// (low drag = long travel). Big bold petals rather than a fine ball.
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
export const PEAK_FRAME = 54;

const START_AGE = 0.12;
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) { f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f); return START_AGE + (f - 1) / FPS; }

export function create(opts = {}) {
  const color   = new Color(opts.color || '#ff8a3d');
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 12), oz = opts.z || 0;
  const count   = opts.count   || 110;                           // few, bold
  const gravity = opts.gravity != null ? opts.gravity : 5.5;
  const drag    = opts.drag    != null ? opts.drag    : 0.7;     // long throw
  const spread  = (opts.spread || 20) * (opts.scale || 1);       // wide petals
  const r0      = 0.6;

  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  const v0   = new Float32Array(count * 3);
  const base = new Float32Array(count);
  const seed = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const speed = spread * (0.7 + Math.random() * 0.3);
    v0[i*3]   = Math.sin(phi) * Math.cos(theta) * speed;
    v0[i*3+1] = Math.cos(phi) * speed;
    v0[i*3+2] = Math.sin(phi) * Math.sin(theta) * speed;
    base[i]   = r0 / speed;
    pos[i*3] = ox; pos[i*3+1] = oy; pos[i*3+2] = oz;
    seed[i] = Math.random();
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color',    new BufferAttribute(col, 3));
  const mat = new PointsMaterial({
    size: 1.7, map: sparkTexture(), vertexColors: true, transparent: true,   // large stars
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });
  const object = new Points(geo, mat);

  function setAgeSeconds(t) {
    const ex = Math.exp(-drag * t), tau = (1 - ex) / drag, gk = gravity / drag;
    const norm = Math.min(1, t / MAX_AGE);
    const fade = norm < 0.5 ? 1 : smooth01((1 - norm) / 0.5);
    for (let i = 0; i < count; i++) {
      const ix = i * 3, k = base[i] + tau;
      pos[ix]     = ox + v0[ix]     * k;
      pos[ix + 2] = oz + v0[ix + 2] * k;
      pos[ix + 1] = oy + v0[ix + 1] * k + gk * (tau - t);
      const tw = 0.85 + 0.15 * Math.sin(t * 13 + seed[i] * 40);
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
