// Three-native Fish shell — standalone, inscribed on its own.
// FRAME-BASED contract (see effects/peony.js).
//
// Fish: stars that scatter outward, each darting ERRATICALLY in its own random
// direction (not a tidy back-and-forth), then fizzle out with a few sparkles.
// The dart is a sum of two incommensurate high-frequency sines on two
// perpendicular axes, so the path never repeats and changes heading every frame
// or two -- closed-form, so it's still deterministic per frame.
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
export const FRAMES = 72;
export const DURATION = Math.round(FRAMES / FPS * 1000); // 1200
export const PEAK_FRAME = 28;

const START_AGE = 0.28;             // skip the central glow entirely -> no source pollution
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) { f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f); return START_AGE + (f - 1) / FPS; }

export function create(opts = {}) {
  const baseColor = new Color(opts.color || '#44ccff');
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 12), oz = opts.z || 0;
  const streams  = opts.count   || 25;                           // few -> each fish clearly distinct
  const trailLen = opts.trail   || 11;                           // more dots -> continuous streak
  const gravity  = opts.gravity != null ? opts.gravity : 4.0;
  const drag     = opts.drag    != null ? opts.drag    : 1.5;    // decelerate sooner -> slower, followable
  const spread   = (opts.spread || 21) * (opts.scale || 1);      // fly far apart
  const dart     = opts.dart    != null ? opts.dart    : 1.7;    // erratic dart amplitude
  const hueJit   = opts.hueJit  != null ? opts.hueJit  : 0.085;
  const trailDt  = opts.trailDt != null ? opts.trailDt : 0.022;  // closer dots -> no gaps in the streak
  const r0       = 0.4;

  const count = streams * trailLen;
  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  const v0   = new Float32Array(streams * 3);
  const ua   = new Float32Array(streams * 3);  // dart axis 1
  const wa   = new Float32Array(streams * 3);  // dart axis 2
  const cBase= new Float32Array(streams * 3);
  const base = new Float32Array(streams);
  const ph   = new Float32Array(streams * 4);  // four random phases per fish
  const seed = new Float32Array(streams);

  for (let s = 0; s < streams; s++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const speed = spread * (0.6 + Math.random() * 0.4);
    const dx = Math.sin(phi) * Math.cos(theta), dy = Math.cos(phi), dz = Math.sin(phi) * Math.sin(theta);
    v0[s*3] = dx * speed; v0[s*3+1] = dy * speed; v0[s*3+2] = dz * speed;
    let ux = -dy, uy = dx, uz = 0; let ul = Math.hypot(ux, uy, uz);
    if (ul < 1e-3) { ux = 1; uy = 0; uz = 0; ul = 1; }
    ux /= ul; uy /= ul; uz /= ul;
    const wx = dy * uz - dz * uy, wy = dz * ux - dx * uz, wz = dx * uy - dy * ux;
    ua[s*3] = ux; ua[s*3+1] = uy; ua[s*3+2] = uz;
    wa[s*3] = wx; wa[s*3+1] = wy; wa[s*3+2] = wz;
    base[s] = r0 / speed;
    for (let q = 0; q < 4; q++) ph[s*4+q] = Math.random() * 6.28;
    const c = baseColor.clone().offsetHSL((Math.random() * 2 - 1) * hueJit, 0, 0);
    cBase[s*3] = c.r; cBase[s*3+1] = c.g; cBase[s*3+2] = c.b;
    seed[s] = Math.random();
  }
  for (let i = 0; i < count; i++) { pos[i*3] = ox; pos[i*3+1] = oy; pos[i*3+2] = oz; }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color',    new BufferAttribute(col, 3));
  const mat = new PointsMaterial({
    size: 1.25, map: sparkTexture(), vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });
  const object = new Points(geo, mat);

  const tau_j = new Float32Array(trailLen), droop_j = new Float32Array(trailLen), t_j = new Float32Array(trailLen);

  // erratic offset along axis (sum of two incommensurate sines) -- slower so the
  // darting is followable, not frantic
  function jit(tj, p0, p1) {
    return Math.sin(13 * tj + p0) + 0.7 * Math.sin(21 * tj + p1);
  }

  function setAgeSeconds(t) {
    const gk = gravity / drag;
    const norm = Math.min(1, t / MAX_AGE);
    const lifeFade = norm < 0.5 ? 1 : smooth01((1 - norm) / 0.5);
    const fizz = norm > 0.6;
    for (let j = 0; j < trailLen; j++) {
      let tj = t - j * trailDt; if (tj < 0) tj = 0;
      const tauj = (1 - Math.exp(-drag * tj)) / drag;
      tau_j[j] = tauj; droop_j[j] = gk * (tauj - tj); t_j[j] = tj;
    }
    for (let s = 0; s < streams; s++) {
      const vx = v0[s*3], vy = v0[s*3+1], vz = v0[s*3+2], b = base[s];
      const ux = ua[s*3], uy = ua[s*3+1], uz = ua[s*3+2];
      const wx = wa[s*3], wy = wa[s*3+1], wz = wa[s*3+2];
      const p0 = ph[s*4], p1 = ph[s*4+1], p2 = ph[s*4+2], p3 = ph[s*4+3];
      // end-of-life sparkle fizzle (per fish)
      let endSpark = 1;
      if (fizz) {
        const f = Math.sin(t * 44 + seed[s] * 120) * Math.sin(t * 29 + seed[s] * 51);
        endSpark = f > 0.0 ? 1.6 : 0.15;
      }
      for (let j = 0; j < trailLen; j++) {
        const ix = (s * trailLen + j) * 3;
        const k = b + tau_j[j];
        const du = dart * jit(t_j[j], p0, p1);
        const dw = dart * jit(t_j[j], p2, p3);
        pos[ix]     = ox + vx * k + ux * du + wx * dw;
        pos[ix + 1] = oy + vy * k + droop_j[j] + uy * du + wy * dw;
        pos[ix + 2] = oz + vz * k + uz * du + wz * dw;
        const tf = 1 - j / trailLen;
        const bright = lifeFade * tf * (j === 0 ? endSpark : Math.min(1, endSpark));
        col[ix] = cBase[s*3] * bright; col[ix + 1] = cBase[s*3+1] * bright; col[ix + 2] = cBase[s*3+2] * bright;
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
