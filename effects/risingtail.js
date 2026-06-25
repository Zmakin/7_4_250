// Three-native Rising Tail — standalone, inscribed on its own (Three.js
// equivalent of animations/tail_Rising.html). A TAIL is the rising comet that
// climbs to the burst point. FRAME-BASED contract (see effects/peony.js), plus
// it also returns `start`/`end` world points so the builder can draw the
// green (start) / red (end) placement markers.
//
// Orientation: the head climbs UP (+y), decelerating, from a start point below
// to the END point = the placement position (where the body would burst). The
// trail streams DOWN behind the head.
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
export const FRAMES = 120;
export const DURATION = Math.round(FRAMES / FPS * 1000); // 2000
export const PEAK_FRAME = 50;       // 2nd spacebar freeze option

const START_AGE = 0.05;
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) { f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f); return START_AGE + (f - 1) / FPS; }

export function create(opts = {}) {
  const color = new Color(opts.color || '#ffee99');
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 16), oz = opts.z || 0;
  const H        = (opts.rise || 22) * (opts.scale || 1);        // climb height
  const trailLen = opts.trail   || 26;
  const trailDt  = opts.trailDt != null ? opts.trailDt : 0.02;
  const kRise    = opts.kRise   != null ? opts.kRise   : 1.7;    // deceleration of the climb

  // end = placement (burst point, where you click); the tail rises UP to it from
  // a start below. The start may sit off-canvas -- that's fine; the green/red
  // markers show where it begins and ends.
  const ex = ox, ey = oy, ez = oz;
  const sx = ox, sy = oy - H, sz = oz;
  const span = MAX_AGE - START_AGE;
  const denom = 1 - Math.exp(-kRise * span);
  function headAt(age, out) {
    const a = age - START_AGE <= 0 ? 0 : age - START_AGE;
    const frac = (1 - Math.exp(-kRise * a)) / denom;             // 0..1, decelerating
    out[0] = sx; out[1] = sy + H * frac; out[2] = sz;
  }
  const tmp = [0, 0, 0];

  const pos  = new Float32Array(trailLen * 3);
  const col  = new Float32Array(trailLen * 3);
  for (let j = 0; j < trailLen; j++) { pos[j*3] = sx; pos[j*3+1] = sy; pos[j*3+2] = sz; }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color',    new BufferAttribute(col, 3));
  const mat = new PointsMaterial({
    size: 2.4, map: sparkTexture(), vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });
  const object = new Points(geo, mat);

  function setAgeSeconds(t) {
    const norm = Math.min(1, t / MAX_AGE);
    const fade = norm < 0.85 ? 1 : smooth01((1 - norm) / 0.15);  // fades as it reaches the top
    for (let j = 0; j < trailLen; j++) {
      const ix = j * 3;
      const sage = t - j * trailDt;
      headAt(sage, tmp);
      pos[ix] = tmp[0]; pos[ix+1] = tmp[1]; pos[ix+2] = tmp[2];
      if (sage < START_AGE) { col[ix] = col[ix+1] = col[ix+2] = 0; continue; } // not born -> no source blob
      const tf = 1 - j / trailLen;                               // head bright, trail dims
      const v = fade * tf * tf;
      // hot near-white head, colored trail
      const mix = j === 0 ? 0.6 : 0.0;
      col[ix]   = (color.r + (1 - color.r) * mix) * v * (j === 0 ? 1.6 : 1);
      col[ix+1] = (color.g + (1 - color.g) * mix) * v * (j === 0 ? 1.6 : 1);
      col[ix+2] = (color.b + (1 - color.b) * mix) * v * (j === 0 ? 1.6 : 1);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    mat.opacity = norm < 0.85 ? 1 : smooth01((1 - norm) / 0.15);
  }
  function setFrame(f) { setAgeSeconds(frameToAge(f)); }
  function dispose() { geo.dispose(); mat.dispose(); }
  setFrame(1);
  return { object, setFrame, frames: FRAMES, dispose, start: [sx, sy, sz], end: [ex, ey, ez] };
}
