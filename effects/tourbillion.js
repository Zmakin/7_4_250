// Three-native Tourbillion shell — standalone, inscribed on its own.
// FRAME-BASED contract (see effects/peony.js).
//
// A real tourbillion (from French "whirlwind") is NOT one big spirograph: it is
// several small devices thrown from the break that each SPIN FAST on their own
// axis while RISING, so each one carves a dense little spark circle as its centre
// travels up and out — the whole thing reading as an umbrella of whirling
// spinners. Here each spinner's centre follows a ballistic up-and-out arc while
// the spinner whirls on a tight circle (its own random-facing plane), and a
// short trail traces the whirl. Closed-form, so every frame is deterministic.
//   ref: skylighter tourbillion build; "ascends and revolves at the same time".
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
export const PEAK_FRAME = 56;

const START_AGE = 0.10;
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) { f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f); return START_AGE + (f - 1) / FPS; }

export function create(opts = {}) {
  const color   = new Color(opts.color || '#ffdd88');            // gold/silver
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 12), oz = opts.z || 0;
  const spinners = opts.count   || 11;                           // a handful of whirlers
  const trailLen = opts.trail   || 16;                           // traces each whirl
  const gravity  = opts.gravity != null ? opts.gravity : 8.0;
  const drag     = opts.drag    != null ? opts.drag    : 0.8;
  const spread   = (opts.spread || 11) * (opts.scale || 1);      // ~20% wider coverage on spawn
  const lift     = opts.lift    != null ? opts.lift    : 1.55;   // umbrella: mostly up & out
  const spin     = opts.spin    != null ? opts.spin    : 17;     // rad/s whirl (fast)
  const whirlR   = opts.whirlR  != null ? opts.whirlR  : 1.7;    // radius of each spark circle
  const trailDt  = opts.trailDt != null ? opts.trailDt : 0.018;  // tight spacing -> a full circle
  const r0       = 0.5;

  const count = spinners * trailLen;
  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  const v0   = new Float32Array(spinners * 3);  // centre launch velocity
  const ua   = new Float32Array(spinners * 3);  // whirl-plane axis 1
  const wa   = new Float32Array(spinners * 3);  // whirl-plane axis 2
  const ph   = new Float32Array(spinners);      // whirl phase
  const dir  = new Float32Array(spinners);      // whirl direction
  const base = new Float32Array(spinners);
  const seed = new Float32Array(spinners);

  for (let s = 0; s < spinners; s++) {
    const theta = Math.random() * Math.PI * 2;
    let cy = Math.random() * lift - (lift - 1); if (cy > 1) cy = 1;  // up-biased dome
    const horiz = Math.sqrt(Math.max(0, 1 - cy * cy));
    const speed = spread * (0.6 + Math.random() * 0.4);
    const dx = Math.cos(theta) * horiz, dy = cy, dz = Math.sin(theta) * horiz;
    v0[s*3] = dx * speed; v0[s*3+1] = dy * speed; v0[s*3+2] = dz * speed;
    // a random-ish plane for the whirl (perp to a random axis), so circles face all ways
    let ux = -dy, uy = dx, uz = 0.3 * (Math.random() * 2 - 1); let ul = Math.hypot(ux, uy, uz);
    if (ul < 1e-3) { ux = 1; uy = 0; uz = 0; ul = 1; }
    ux /= ul; uy /= ul; uz /= ul;
    // wa = (dir-ish) x u, then orthonormalize roughly
    let wx = dy * uz - dz * uy, wy = dz * ux - dx * uz, wz = dx * uy - dy * ux;
    const wl = Math.hypot(wx, wy, wz) || 1; wx /= wl; wy /= wl; wz /= wl;
    ua[s*3] = ux; ua[s*3+1] = uy; ua[s*3+2] = uz;
    wa[s*3] = wx; wa[s*3+1] = wy; wa[s*3+2] = wz;
    ph[s]  = Math.random() * Math.PI * 2;
    dir[s] = Math.random() < 0.5 ? 1 : -1;
    base[s]= r0 / speed;
    seed[s]= Math.random();
  }
  for (let i = 0; i < count; i++) { pos[i*3] = ox; pos[i*3+1] = oy; pos[i*3+2] = oz; }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color',    new BufferAttribute(col, 3));
  const mat = new PointsMaterial({
    size: 1.05, map: sparkTexture(), vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });
  const object = new Points(geo, mat);

  const tau_j = new Float32Array(trailLen), droop_j = new Float32Array(trailLen), t_j = new Float32Array(trailLen);

  function setAgeSeconds(t) {
    const gk = gravity / drag;
    const norm = Math.min(1, t / MAX_AGE);
    const lifeFade = norm < 0.55 ? 1 : smooth01((1 - norm) / 0.45);
    for (let j = 0; j < trailLen; j++) {
      let tj = t - j * trailDt; if (tj < 0) tj = 0;
      const tauj = (1 - Math.exp(-drag * tj)) / drag;
      tau_j[j] = tauj; droop_j[j] = gk * (tauj - tj); t_j[j] = tj;
    }
    for (let s = 0; s < spinners; s++) {
      const vx = v0[s*3], vy = v0[s*3+1], vz = v0[s*3+2], b = base[s];
      const ux = ua[s*3], uy = ua[s*3+1], uz = ua[s*3+2];
      const wx = wa[s*3], wy = wa[s*3+1], wz = wa[s*3+2];
      const tw = 0.85 + 0.15 * Math.sin(t * 20 + seed[s] * 40);
      for (let j = 0; j < trailLen; j++) {
        const ix = (s * trailLen + j) * 3;
        const k = b + tau_j[j];
        // travelling centre
        const cx = ox + vx * k;
        const cy = oy + vy * k + droop_j[j];
        const cz = oz + vz * k;
        // whirl around the centre
        const a = ph[s] + dir[s] * spin * t_j[j];
        const ca = Math.cos(a) * whirlR, sa = Math.sin(a) * whirlR;
        pos[ix]     = cx + ux * ca + wx * sa;
        pos[ix + 1] = cy + uy * ca + wy * sa;
        pos[ix + 2] = cz + uz * ca + wz * sa;
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
