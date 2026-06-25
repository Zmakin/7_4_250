// Three-native Crossette shell — standalone, inscribed on its own.
// FRAME-BASED contract (see effects/peony.js).
//
// Crossette = stars fly out, then each one SPLITS into a small 4-point cross
// partway through its flight (the signature criss-cross grid). Each primary
// carries 4 children that overlap (reading as one dot) until the split time,
// then diverge along a cross in the plane perpendicular to the outward path.
// Closed-form: child pos = primary path + (after split) arm·splitSpeed·dt.
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
export const FRAMES = 108;
export const DURATION = Math.round(FRAMES / FPS * 1000); // 1800
export const PEAK_FRAME = 66;       // just after the ~0.7s split, crosses fully open

const START_AGE = 0.10;
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) { f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f); return START_AGE + (f - 1) / FPS; }

export function create(opts = {}) {
  const color   = new Color(opts.color || '#ff5ce0');
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 12), oz = opts.z || 0;
  const primaries = opts.count   || 64;
  const gravity   = opts.gravity != null ? opts.gravity : 6.0;
  const drag      = opts.drag    != null ? opts.drag    : 1.0;
  const spread    = (opts.spread || 13) * (opts.scale || 1);
  const splitAge  = opts.splitAge  != null ? opts.splitAge  : 0.70;  // seconds until split
  const splitSpeed= opts.splitSpeed!= null ? opts.splitSpeed: 7.0;
  const r0        = 0.5;
  const ARMS = 4;

  const count = primaries * ARMS;
  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  const v0   = new Float32Array(primaries * 3);
  const ua   = new Float32Array(primaries * 3);  // cross axis u
  const wa   = new Float32Array(primaries * 3);  // cross axis w
  const base = new Float32Array(primaries);
  const ts   = new Float32Array(primaries);
  const seed = new Float32Array(primaries);

  for (let p = 0; p < primaries; p++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const speed = spread * (0.6 + Math.random() * 0.4);
    const dx = Math.sin(phi) * Math.cos(theta), dy = Math.cos(phi), dz = Math.sin(phi) * Math.sin(theta);
    v0[p*3] = dx * speed; v0[p*3+1] = dy * speed; v0[p*3+2] = dz * speed;
    // two axes perpendicular to dir
    let ux = -dy, uy = dx, uz = 0; let ul = Math.hypot(ux, uy, uz);
    if (ul < 1e-3) { ux = 1; uy = 0; uz = 0; ul = 1; }
    ux /= ul; uy /= ul; uz /= ul;
    // w = dir x u
    const wx = dy * uz - dz * uy, wy = dz * ux - dx * uz, wz = dx * uy - dy * ux;
    ua[p*3] = ux; ua[p*3+1] = uy; ua[p*3+2] = uz;
    wa[p*3] = wx; wa[p*3+1] = wy; wa[p*3+2] = wz;
    base[p] = r0 / speed;
    ts[p]   = splitAge * (0.85 + Math.random() * 0.3);
    seed[p] = Math.random();
  }
  for (let i = 0; i < count; i++) { pos[i*3] = ox; pos[i*3+1] = oy; pos[i*3+2] = oz; }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color',    new BufferAttribute(col, 3));
  const mat = new PointsMaterial({
    size: 1.3, map: sparkTexture(), vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });
  const object = new Points(geo, mat);

  // arm signs: +u, -u, +w, -w
  const armU = [1, -1, 0, 0], armW = [0, 0, 1, -1];

  function setAgeSeconds(t) {
    const ex = Math.exp(-drag * t), tau = (1 - ex) / drag, gk = gravity / drag;
    const norm = Math.min(1, t / MAX_AGE);
    const fade = norm < 0.55 ? 1 : smooth01((1 - norm) / 0.45);
    for (let p = 0; p < primaries; p++) {
      const k = base[p] + tau;
      const px = ox + v0[p*3]     * k;
      const py = oy + v0[p*3+1]   * k + gk * (tau - t);
      const pz = oz + v0[p*3+2]   * k;
      const dt = t - ts[p];
      const split = dt > 0;
      const armLen = split ? splitSpeed * dt : 0;
      const flash = (split && dt < 0.08) ? 1.8 : 1;               // pop at the split
      for (let a = 0; a < ARMS; a++) {
        const ix = (p * ARMS + a) * 3;
        const su = armU[a] * armLen, sw = armW[a] * armLen;
        pos[ix]     = px + ua[p*3]   * su + wa[p*3]   * sw;
        pos[ix + 1] = py + ua[p*3+1] * su + wa[p*3+1] * sw;
        pos[ix + 2] = pz + ua[p*3+2] * su + wa[p*3+2] * sw;
        const tw = 0.85 + 0.15 * Math.sin(t * 16 + seed[p] * 40);
        const bright = fade * tw * flash;
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
