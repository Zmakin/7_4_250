// Three-native Willow shell — standalone, inscribed on its own (the Three.js
// equivalent of animations/Willow.html). Referenced by Builder.html AND by
// exported shows via dynamic import; its `import ... from 'three'` resolves
// through the host's import map (./lib in dev, /content/<id> on-chain).
//
// Same FRAME-BASED contract as effects/peony.js:
//   export const FPS, FRAMES, DURATION, PEAK_FRAME
//   export function create(opts) -> { object, setFrame(n), frames, dispose() }
//
// What makes a Willow a willow: long, soft, GOLDEN fronds that shoot out and
// then droop under gravity into hanging streamers. To get the streamer look (not
// a peony's crisp sphere) each "stream" renders a short TRAIL — a row of points
// sampled along the stream's own past trajectory. Because the ballistics are
// closed-form, the trail is just the same position function evaluated at earlier
// ages, so every frame is still deterministic (playback == scrub == export).
//   horizontal: p(t) = p0 + v0·(base + tau),  tau = (1 - e^{-k t})/k
//   vertical:   y(t) = y0 + v0y·(base + tau) + (g/k)(tau - t)
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

// ---- Frame contract ---------------------------------------------------------
export const FPS = 60;
export const FRAMES = 180;          // willows hang long -> 3.0 s
export const DURATION = Math.round(FRAMES / FPS * 1000); // 3000 ms
export const PEAK_FRAME = 101;      // spacebar option 2 = full drooping crown ~1.67 s in ((101-1)/60)

const START_AGE = 0.10;             // trims the dense white birth flash
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) {
  f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f);
  return START_AGE + (f - 1) / FPS;
}

export function create(opts = {}) {
  const color   = new Color(opts.color || '#ffcc55');           // warm gold
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 12), oz = opts.z || 0;
  const streams  = opts.count   || 130;                          // number of fronds
  const trailLen = opts.trail   || 16;                           // points per frond (long hanging streamers)
  // Willow = a wide-ish spherical burst whose stars travel out to a generous
  // max radius, THEN weep down. Moderate drag lets them spread far and still
  // arrest at a defined radius (so they stop flying outward); moderate gravity
  // then dominates so the long trails droop down more than they spread.
  const gravity  = opts.gravity != null ? opts.gravity : 11.0;   // weep, but let the ball form first
  const drag     = opts.drag    != null ? opts.drag    : 1.05;   // arrests at a generous radius
  const spread   = (opts.spread || 15) * (opts.scale || 1);      // big, tall outward explosion
  const lift     = opts.lift    != null ? opts.lift    : 1.20;   // taller, rounder ball with upward lean
  const trailDt  = opts.trailDt != null ? opts.trailDt : 0.06;   // wider trail spacing -> longer fronds
  const r0       = 0.6;

  const count = streams * trailLen;
  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  // per-stream data
  const v0   = new Float32Array(streams * 3);  // initial velocity, never mutated
  const base = new Float32Array(streams);      // r0/speed birth offset
  const seed = new Float32Array(streams);

  for (let s = 0; s < streams; s++) {
    const theta = Math.random() * Math.PI * 2;
    // Elevation as an up-biased dome: cy = vertical direction in [-(lift-1), 1].
    // Most fronds point up/outward (cy>0), only a few dip below the horizon, so
    // the burst grows upward and outward before gravity weeps it down.
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

  // per-trail-index scratch (recomputed once per frame, shared across streams)
  const tau_j   = new Float32Array(trailLen);
  const droop_j = new Float32Array(trailLen);

  function setAgeSeconds(t) {
    const gk = gravity / drag;
    const norm = Math.min(1, t / MAX_AGE);
    // willows hang -> hold longer, then fade over the back 40%
    const lifeFade = norm < 0.6 ? 1 : smooth01((1 - norm) / 0.4);

    // trail samples depend only on the index j (same age offset for every stream)
    for (let j = 0; j < trailLen; j++) {
      let tj = t - j * trailDt; if (tj < 0) tj = 0;
      const tauj = (1 - Math.exp(-drag * tj)) / drag;
      tau_j[j]   = tauj;
      droop_j[j] = gk * (tauj - tj);
    }

    for (let s = 0; s < streams; s++) {
      const vx = v0[s*3], vy = v0[s*3+1], vz = v0[s*3+2], b = base[s];
      const tw = 0.85 + 0.15 * Math.sin(t * 14 + seed[s] * 40);
      for (let j = 0; j < trailLen; j++) {
        const ix = (s * trailLen + j) * 3;
        const k = b + tau_j[j];
        pos[ix]     = ox + vx * k;
        pos[ix + 1] = oy + vy * k + droop_j[j];
        pos[ix + 2] = oz + vz * k;
        // head (j=0) bright gold; tail fades to dim ember (green/blue drop faster).
        // Gentle linear falloff (not squared) so the long frond stays lit along
        // its whole length instead of vanishing after a few points.
        const ember = j / trailLen;
        const tf = 1 - 0.88 * ember;
        const bright = lifeFade * tf * (j === 0 ? tw : 1);
        col[ix]     = color.r * bright;
        col[ix + 1] = color.g * bright * (1 - 0.35 * ember);
        col[ix + 2] = color.b * bright * (1 - 0.7 * ember);
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
