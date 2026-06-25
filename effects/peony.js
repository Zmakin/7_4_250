// Three-native Peony shell — standalone, inscribed on its own (the Three.js
// equivalent of animations/PeonyBurst.html). Referenced by Builder.html AND by
// exported shows via dynamic import; its `import ... from 'three'` resolves
// through the host's import map (./lib in dev, /content/<id> on-chain).
//
// Contract every effect module follows (FRAME-BASED):
//   export const FPS, FRAMES, DURATION   // DURATION = FRAMES/FPS*1000 (ms)
//   export function create(opts)         // -> { object, setFrame(n), frames, dispose() }
//     opts: { color, x, y, z, scale }    (world coords)
//     object   = a THREE.Object3D the host adds to / removes from its scene
//     setFrame(n) = place the effect deterministically at integer frame n (1..FRAMES)
//   The host only ever asks for integer frames, never raw time, and never sees
//   the t=0 white singularity (START_AGE trims it; frame 1 is a colour burst).
//
// Physics is closed-form so the same frame is identical every time (playback,
// frozen scrubbing, peak-frame analysis, and export all agree):
//   horizontal: p(t) = p0 + (v0/k)(1 - e^{-k t})
//   vertical:   y(t) = y0 + ((v0 + g/k)/k)(1 - e^{-k t}) - (g/k)·t
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

// Smoothstep ease, clamped to [0,1] — for soft flash/fade transitions.
function smooth01(x) { x = x <= 0 ? 0 : x >= 1 ? 1 : x; return x * x * (3 - 2 * x); }

// ---- Frame contract (shared by every effect) --------------------------------
// Effects are FRAME-BASED, not time-based. The host (builder / show) only ever
// asks for integer frames 1..FRAMES via setFrame(); it never sees the t=0
// singularity. START_AGE trims the dense white birth flash so frame 1 is
// already a colour burst with a glow halo.
export const FPS = 60;
export const FRAMES = 120;          // total rendered frames (white birth trimmed)
export const DURATION = Math.round(FRAMES / FPS * 1000); // 2000 ms timeline span
export const PEAK_FRAME = 48;       // spacebar option 2 = the bright full burst ~0.78s into the life

const START_AGE = 0.12;             // seconds skipped at the front (the white blob)
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
// frame (1-based) -> simulation age in seconds
function frameToAge(f) {
  f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f);
  return START_AGE + (f - 1) / FPS;
}

export function create(opts = {}) {
  const color   = new Color(opts.color || '#ff9632');
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 12), oz = opts.z || 0;
  const count   = opts.count   || 650;
  const gravity = opts.gravity != null ? opts.gravity : 7.0;
  const drag    = opts.drag    != null ? opts.drag    : 1.1;   // lower drag = more outward travel
  const spread  = (opts.spread || 15) * (opts.scale || 1);     // wider burst
  const flatten = opts.flatten != null ? opts.flatten : 0.95;  // nearly round
  const r0      = 0.6;                                         // small birth radius (defined ring on frame 1)

  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  const sz   = new Float32Array(count);
  const v0   = new Float32Array(count * 3);  // initial velocity, never mutated
  const base = new Float32Array(count);      // r0/speed, gives the birth offset along v0
  const seed = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const speed = spread * (0.55 + Math.random() * 0.45);
    v0[i*3]   = Math.sin(phi) * Math.cos(theta) * speed;
    v0[i*3+1] = Math.sin(phi) * Math.sin(theta) * speed * flatten;
    v0[i*3+2] = Math.cos(phi) * speed;
    base[i]   = r0 / speed;
    pos[i*3] = ox; pos[i*3+1] = oy; pos[i*3+2] = oz;
    col[i*3] = col[i*3+1] = col[i*3+2] = 1;
    sz[i] = 2.2 + Math.random() * 2.8;
    seed[i] = Math.random();
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color',    new BufferAttribute(col, 3));
  geo.setAttribute('size',     new BufferAttribute(sz, 1));

  const mat = new PointsMaterial({
    size: 1.1, map: sparkTexture(), vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });

  const object = new Points(geo, mat);

  function setAgeSeconds(t) {
    const ex = Math.exp(-drag * t);
    const tau = (1 - ex) / drag;
    const gk = gravity / drag;
    const norm = Math.min(1, t / MAX_AGE);
    // hot at birth, hold, then smooth fade over the back half
    const fade = norm < 0.5 ? 1 : smooth01((1 - norm) / 0.5);
    for (let i = 0; i < count; i++) {
      const ix = i * 3, b = base[i], k = b + tau;     // birth offset + ballistic spread
      pos[ix]     = ox + v0[ix]     * k;
      pos[ix + 2] = oz + v0[ix + 2] * k;
      pos[ix + 1] = oy + v0[ix + 1] * b + (v0[ix + 1] + gk) * tau - gk * t;
      const tw = 0.88 + 0.12 * Math.sin(t * 16 + seed[i] * 40);
      const bright = fade * tw;
      col[ix]     = color.r * bright;
      col[ix + 1] = color.g * bright;
      col[ix + 2] = color.b * bright;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    mat.opacity = norm < 0.8 ? 1 : smooth01((1 - norm) / 0.2);
  }

  // Public API: integer frames only.
  function setFrame(f) { setAgeSeconds(frameToAge(f)); }

  function dispose() { geo.dispose(); mat.dispose(); }

  setFrame(1);
  return { object, setFrame, frames: FRAMES, dispose };
}
