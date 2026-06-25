// Three-native Strobe shell — standalone, inscribed on its own.
// FRAME-BASED contract (see effects/peony.js).
//
// Strobe = a WIDE sphere of stars that hang and FLASH on/off at random phases.
// Each strobing "ball" also has a few tiny SPARKLE satellites orbiting it that
// glitter at a faster rate, so every flash is surrounded by a little shimmer.
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
export const FRAMES = 120;          // longer duration (2.0 s)
export const DURATION = Math.round(FRAMES / FPS * 1000); // 2000
export const PEAK_FRAME = 56;

const START_AGE = 0.12;
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) { f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f); return START_AGE + (f - 1) / FPS; }

export function create(opts = {}) {
  const color   = new Color(opts.color || '#dff3ff');            // cool white/silver
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 12), oz = opts.z || 0;
  const stars   = opts.count   || 110;
  const sparks  = opts.sparks  != null ? opts.sparks  : 4;       // sparkle satellites per ball
  const gravity = opts.gravity != null ? opts.gravity : 3.0;
  const drag    = opts.drag    != null ? opts.drag    : 1.0;     // lower -> wider expansion
  const spread  = (opts.spread || 19) * (opts.scale || 1);       // wider
  const rate    = opts.rate    != null ? opts.rate    : 20;      // strobe frequency
  const r0      = 0.5;

  const per = 1 + sparks;
  const count = stars * per;
  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  const v0   = new Float32Array(stars * 3);
  const base = new Float32Array(stars);
  const seed = new Float32Array(stars);
  // per-satellite orbit basis (two axes per star) + phase
  const ua   = new Float32Array(stars * 3);
  const wa   = new Float32Array(stars * 3);

  for (let s = 0; s < stars; s++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const speed = spread * (0.5 + Math.random() * 0.5);
    const dx = Math.sin(phi) * Math.cos(theta), dy = Math.cos(phi), dz = Math.sin(phi) * Math.sin(theta);
    v0[s*3] = dx * speed; v0[s*3+1] = dy * speed; v0[s*3+2] = dz * speed;
    let ux = -dy, uy = dx, uz = 0; let ul = Math.hypot(ux, uy, uz);
    if (ul < 1e-3) { ux = 1; uy = 0; uz = 0; ul = 1; }
    ux /= ul; uy /= ul; uz /= ul;
    const wx = dy * uz - dz * uy, wy = dz * ux - dx * uz, wz = dx * uy - dy * ux;
    ua[s*3] = ux; ua[s*3+1] = uy; ua[s*3+2] = uz;
    wa[s*3] = wx; wa[s*3+1] = wy; wa[s*3+2] = wz;
    base[s] = r0 / speed;
    seed[s] = Math.random();
  }
  for (let i = 0; i < count; i++) { pos[i*3] = ox; pos[i*3+1] = oy; pos[i*3+2] = oz; }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color',    new BufferAttribute(col, 3));
  const mat = new PointsMaterial({
    size: 1.2, map: sparkTexture(), vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });
  const object = new Points(geo, mat);

  function setAgeSeconds(t) {
    const ex = Math.exp(-drag * t), tau = (1 - ex) / drag, gk = gravity / drag;
    const norm = Math.min(1, t / MAX_AGE);
    const fade = norm < 0.6 ? 1 : smooth01((1 - norm) / 0.4);
    const orbit = 0.8 + 1.4 * Math.min(1, t);                    // sparkle ring grows a touch
    for (let s = 0; s < stars; s++) {
      const k = base[s] + tau;
      const cx = ox + v0[s*3]   * k;
      const cy = oy + v0[s*3+1] * k + gk * (tau - t);
      const cz = oz + v0[s*3+2] * k;
      // main ball: hard strobe on/off
      const ph = Math.sin(t * rate + seed[s] * 100);
      const mainB = fade * (ph > 0.2 ? 1 : 0.05);
      let ix = (s * per) * 3;
      pos[ix] = cx; pos[ix+1] = cy; pos[ix+2] = cz;
      col[ix] = color.r * mainB; col[ix+1] = color.g * mainB; col[ix+2] = color.b * mainB;
      // sparkle satellites: orbit the ball, glitter fast and offset in phase
      for (let q = 0; q < sparks; q++) {
        const a = (q / sparks) * Math.PI * 2 + t * 6 + seed[s] * 20;
        const ca = Math.cos(a) * orbit, sa = Math.sin(a) * orbit;
        ix = (s * per + 1 + q) * 3;
        pos[ix]   = cx + ua[s*3]   * ca + wa[s*3]   * sa;
        pos[ix+1] = cy + ua[s*3+1] * ca + wa[s*3+1] * sa;
        pos[ix+2] = cz + ua[s*3+2] * ca + wa[s*3+2] * sa;
        const sg = Math.sin(t * 47 + (seed[s] * 30 + q) * 11);
        const sb = fade * (sg > 0.5 ? 1.3 : 0.0);
        col[ix] = color.r * sb; col[ix+1] = color.g * sb; col[ix+2] = color.b * sb;
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
