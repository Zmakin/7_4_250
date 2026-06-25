// Three-native Roman Candle shell — standalone, inscribed on its own.
// FRAME-BASED contract (see effects/peony.js).
//
// Roman Candle = a sequence of single stars fired UPWARD one after another, each
// rising on a comet trail, arcing over and fading, before the next launches.
// Not a single burst: each "shot" has its own launch time and lives ~shotLife.
// Closed-form per shot: local age = t - launchT (hidden if < 0), ballistic rise.
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
const SHOT_HUES = ['#ff5b5b', '#ffd24d', '#5bff8a', '#5bbcff', '#ff7be0'];

export const FPS = 60;
export const FRAMES = 180;
export const DURATION = Math.round(FRAMES / FPS * 1000); // 3000
export const PEAK_FRAME = 150;      // most shots in the air late in the sequence

const START_AGE = 0.04;
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) { f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f); return START_AGE + (f - 1) / FPS; }

export function create(opts = {}) {
  const tint    = opts.color ? new Color(opts.color) : null;     // override the multi-color cycle
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 12), oz = opts.z || 0;
  const shots    = opts.count   || 8;
  const trailLen = opts.trail   || 7;
  const gravity  = opts.gravity != null ? opts.gravity : 8.0;
  const drag     = opts.drag    != null ? opts.drag    : 0.5;    // lower drag -> further out
  const power    = (opts.power  || 21) * (opts.scale || 1);       // bigger launch -> travels further
  const shotLife = opts.shotLife!= null ? opts.shotLife : 1.3;   // seconds per shot
  const trailDt  = opts.trailDt != null ? opts.trailDt : 0.045;
  const r0       = 0.4;

  const total = MAX_AGE;
  const interval = (total * 0.86) / shots;                       // more time between shots

  const count = shots * trailLen;
  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  const vy   = new Float32Array(shots);     // launch vertical speed
  const vx   = new Float32Array(shots);     // slight horizontal lean
  const vz   = new Float32Array(shots);
  const launchT = new Float32Array(shots);
  const cBase= new Float32Array(shots * 3);
  const base = new Float32Array(shots);
  const seed = new Float32Array(shots);

  for (let s = 0; s < shots; s++) {
    const lean = (Math.random() * 2 - 1) * 0.5;                  // wider fan across the sky
    const az = Math.random() * Math.PI * 2;
    const speed = power * (0.9 + Math.random() * 0.2);
    vy[s] = speed;
    vx[s] = Math.cos(az) * lean * speed;
    vz[s] = Math.sin(az) * lean * speed;
    launchT[s] = s * interval;
    base[s] = r0 / speed;
    const c = tint || new Color(SHOT_HUES[s % SHOT_HUES.length]);
    cBase[s*3] = c.r; cBase[s*3+1] = c.g; cBase[s*3+2] = c.b;
    seed[s] = Math.random();
  }
  for (let i = 0; i < count; i++) { pos[i*3] = ox; pos[i*3+1] = oy; pos[i*3+2] = oz; }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color',    new BufferAttribute(col, 3));
  const mat = new PointsMaterial({
    size: 1.6, map: sparkTexture(), vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });
  const object = new Points(geo, mat);

  function shotPos(s, age, out) {
    const ex = Math.exp(-drag * age), tau = (1 - ex) / drag, gk = gravity / drag;
    const k = base[s] + tau;
    out[0] = ox + vx[s] * k;
    out[1] = oy + vy[s] * k + gk * (tau - age);
    out[2] = oz + vz[s] * k;
  }
  const tmp = [0, 0, 0];

  function setAgeSeconds(t) {
    const norm = Math.min(1, t / MAX_AGE);
    for (let s = 0; s < shots; s++) {
      const local = t - launchT[s];
      let shotFade = 0;
      if (local >= 0) {
        const ln = local / shotLife;
        shotFade = ln >= 1 ? 0 : (ln < 0.12 ? smooth01(ln / 0.12) : smooth01((1 - ln) / 0.88));
      }
      const tw = 0.85 + 0.15 * Math.sin(t * 16 + seed[s] * 40);
      const cr = cBase[s*3], cg = cBase[s*3+1], cb = cBase[s*3+2];
      for (let j = 0; j < trailLen; j++) {
        const ix = (s * trailLen + j) * 3;
        const la = local - j * trailDt;
        // trail points older than the launch don't exist yet -> hidden, so the
        // star emerges from blank space with NO source dot of color at origin.
        if (la <= 0) { col[ix] = col[ix + 1] = col[ix + 2] = 0; continue; }
        shotPos(s, la, tmp);
        pos[ix] = tmp[0]; pos[ix + 1] = tmp[1]; pos[ix + 2] = tmp[2];
        const tf = 1 - j / trailLen;
        const bright = shotFade * tf * (j === 0 ? tw : 1);
        col[ix] = cr * bright; col[ix + 1] = cg * bright; col[ix + 2] = cb * bright;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    mat.opacity = norm < 0.9 ? 1 : smooth01((1 - norm) / 0.1);
  }
  function setFrame(f) { setAgeSeconds(frameToAge(f)); }
  function dispose() { geo.dispose(); mat.dispose(); }
  setFrame(1);
  return { object, setFrame, frames: FRAMES, dispose };
}
