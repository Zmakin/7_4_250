// Three-native Falling Leaves shell — standalone, inscribed on its own.
// FRAME-BASED contract (see effects/peony.js).
//
// Falling Leaves: each ember sinks slowly while tracing a wide, tilted ELLIPSE
// in the view plane -- a strong horizontal rock with a small vertical bob, the
// way a leaf rocks and tips as it flutters down. Leaves are seeded ALREADY
// spread out (the shell has opened) and from then on only flutter + fall; there
// is no outward expansion and no spherical scatter, so it never reads as a spin.
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
const LEAF_HUES = ['#ff7a2d', '#ffb24d', '#e8423a', '#ffd24d', '#c85a2a'];

export const FPS = 60;
export const FRAMES = 192;
export const DURATION = Math.round(FRAMES / FPS * 1000); // 3200
export const PEAK_FRAME = 30;

const START_AGE = 0.02;
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) { f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f); return START_AGE + (f - 1) / FPS; }

export function create(opts = {}) {
  const tint    = opts.color ? new Color(opts.color) : null;     // else autumn palette
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 12), oz = opts.z || 0;
  const count   = opts.count   || 80;
  const radius  = (opts.spread || 11) * (opts.scale || 1);       // how spread out they START
  const fall    = opts.fall    != null ? opts.fall    : 1.9;     // slow sink (units/s)
  const rockX   = opts.rockX   != null ? opts.rockX   : 4.2;     // wide horizontal rock
  const bobY    = opts.bobY    != null ? opts.bobY    : 1.5;     // small vertical bob -> ellipse

  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  const cBase= new Float32Array(count * 3);
  const px0  = new Float32Array(count);     // seeded scattered position (filled cloud, not a ring)
  const py0  = new Float32Array(count);
  const pz0  = new Float32Array(count);
  const amp  = new Float32Array(count);     // per-leaf horizontal amplitude
  const vamp = new Float32Array(count);     // per-leaf vertical amplitude
  const freq = new Float32Array(count);     // flutter frequency
  const phs  = new Float32Array(count);     // phase
  const dirn = new Float32Array(count);     // ellipse direction (+/-1)
  const seed = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    px0[i] = ox + (Math.random() * 2 - 1) * radius;
    py0[i] = oy + (Math.random() * 2 - 1) * radius * 0.5;        // flatter than wide
    pz0[i] = oz + (Math.random() * 2 - 1) * radius * 0.4;        // static depth (parallax only)
    amp[i] = rockX * (0.75 + Math.random() * 0.5);
    vamp[i]= bobY  * (0.7 + Math.random() * 0.6);
    freq[i]= 1.7 + Math.random() * 1.3;
    phs[i] = Math.random() * 6.28;
    dirn[i]= Math.random() < 0.5 ? 1 : -1;
    const c = tint || new Color(LEAF_HUES[(Math.random() * LEAF_HUES.length) | 0]);
    cBase[i*3] = c.r; cBase[i*3+1] = c.g; cBase[i*3+2] = c.b;
    pos[i*3] = px0[i]; pos[i*3+1] = py0[i]; pos[i*3+2] = pz0[i];
    seed[i] = Math.random();
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color',    new BufferAttribute(col, 3));
  const mat = new PointsMaterial({
    size: 1.6, map: sparkTexture(), vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });
  const object = new Points(geo, mat);

  function setAgeSeconds(t) {
    const norm = Math.min(1, t / MAX_AGE);
    const fadeIn  = smooth01(t / 0.18);
    const fadeOut = norm < 0.55 ? 1 : smooth01((1 - norm) / 0.45);
    const fade = fadeIn * fadeOut;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const a = freq[i] * t + phs[i];
      // wide horizontal rock + small vertical bob 90deg out of phase => tilted ellipse
      pos[ix]     = px0[i] + amp[i]  * Math.sin(a);
      pos[ix + 1] = py0[i] - fall * t + vamp[i] * Math.cos(a) * dirn[i];
      pos[ix + 2] = pz0[i];
      const twinkle = 0.7 + 0.3 * Math.sin(t * 5 + seed[i] * 40);
      const v = fade * twinkle;
      col[ix] = cBase[ix] * v; col[ix + 1] = cBase[ix + 1] * v; col[ix + 2] = cBase[ix + 2] * v;
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
