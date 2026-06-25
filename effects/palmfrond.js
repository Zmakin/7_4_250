// Three-native Palm Frond Tail — standalone, inscribed on its own (Three.js
// equivalent of animations/tail_Palm.html). The thick gold rising "trunk" of a
// palm shell that SHEDS small strobing/crackling balls which fall away as it
// climbs (a real crackle/palm tail). FRAME-BASED contract (see effects/peony.js)
// plus start/end world points for the green/red placement markers.
//
// object is a Group: a thick trunk streak (Points) + small shed sparks (Points).
// keyFramesFor uses the exported PEAK_FRAME, so it never samples the geometry --
// a Group object is safe here.
import {
  BufferGeometry, BufferAttribute, PointsMaterial, Points, Group,
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
export const FRAMES = 150;
export const DURATION = Math.round(FRAMES / FPS * 1000); // 2500
export const PEAK_FRAME = 50;       // 2nd spacebar freeze option

const START_AGE = 0.05;
const MAX_AGE   = START_AGE + (FRAMES - 1) / FPS;
function frameToAge(f) { f = f < 1 ? 1 : (f > FRAMES ? FRAMES : f); return START_AGE + (f - 1) / FPS; }

export function create(opts = {}) {
  const color = new Color(opts.color || '#ffc864');             // gold
  const ox = opts.x || 0, oy = (opts.y != null ? opts.y : 16), oz = opts.z || 0;
  const H        = (opts.rise || 22) * (opts.scale || 1);
  const trailLen = opts.trail   || 28;
  const trailDt  = opts.trailDt != null ? opts.trailDt : 0.02;
  const kRise    = opts.kRise   != null ? opts.kRise   : 1.6;
  const shed     = opts.shed    != null ? opts.shed    : 46;     // crackling balls shed off the tail
  const shedG    = opts.shedG   != null ? opts.shedG   : 11.0;   // gravity on shed balls
  const shedLife = opts.shedLife!= null ? opts.shedLife : 0.85;  // seconds each ball lasts

  // end = placement (burst point); rises UP to the click from a start below
  // (which may sit off-canvas). Markers show where it begins and ends.
  const ex = ox, ey = oy, ez = oz;
  const sx = ox, sy = oy - H, sz = oz;
  const span = MAX_AGE - START_AGE;
  const denom = 1 - Math.exp(-kRise * span);
  function headAt(age, out) {
    const a = age - START_AGE <= 0 ? 0 : age - START_AGE;
    const frac = (1 - Math.exp(-kRise * a)) / denom;
    out[0] = sx; out[1] = sy + H * frac; out[2] = sz;
  }
  const tmp = [0, 0, 0];

  // --- trunk streak ---
  const tpos = new Float32Array(trailLen * 3);
  const tcol = new Float32Array(trailLen * 3);
  for (let j = 0; j < trailLen; j++) { tpos[j*3] = sx; tpos[j*3+1] = sy; tpos[j*3+2] = sz; }
  const tgeo = new BufferGeometry();
  tgeo.setAttribute('position', new BufferAttribute(tpos, 3));
  tgeo.setAttribute('color',    new BufferAttribute(tcol, 3));
  const tmat = new PointsMaterial({
    size: 3.0, map: sparkTexture(), vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });
  const trunk = new Points(tgeo, tmat);

  // --- shed crackling balls (born along the rise, then fall) ---
  const spos = new Float32Array(shed * 3);
  const scol = new Float32Array(shed * 3);
  const tb   = new Float32Array(shed);     // birth age
  const bx   = new Float32Array(shed), by = new Float32Array(shed), bz = new Float32Array(shed);
  const svx  = new Float32Array(shed), svy = new Float32Array(shed), svz = new Float32Array(shed);
  const sseed= new Float32Array(shed);
  for (let i = 0; i < shed; i++) {
    tb[i] = START_AGE + ((i + Math.random()) / shed) * (span * 0.85);
    headAt(tb[i], tmp);
    bx[i] = tmp[0]; by[i] = tmp[1]; bz[i] = tmp[2];
    svx[i] = (Math.random() * 2 - 1) * 1.6;
    svy[i] = Math.random() * 1.2;                 // a little upward kick, then gravity wins
    svz[i] = (Math.random() * 2 - 1) * 1.6;
    sseed[i] = Math.random();
  }
  const sgeo = new BufferGeometry();
  sgeo.setAttribute('position', new BufferAttribute(spos, 3));
  sgeo.setAttribute('color',    new BufferAttribute(scol, 3));
  const smat = new PointsMaterial({
    size: 1.1, map: sparkTexture(), vertexColors: true, transparent: true,   // small but visible balls
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });
  const sparks = new Points(sgeo, smat);

  const object = new Group();
  object.add(trunk); object.add(sparks);

  function setAgeSeconds(t) {
    const norm = Math.min(1, t / MAX_AGE);
    const fade = norm < 0.85 ? 1 : smooth01((1 - norm) / 0.15);

    // trunk streak
    for (let j = 0; j < trailLen; j++) {
      const ix = j * 3;
      const sage = t - j * trailDt;
      headAt(sage, tmp);
      tpos[ix] = tmp[0]; tpos[ix+1] = tmp[1]; tpos[ix+2] = tmp[2];
      if (sage < START_AGE) { tcol[ix] = tcol[ix+1] = tcol[ix+2] = 0; continue; } // not born -> no source blob
      const tf = 1 - j / trailLen;
      const v = fade * tf * tf;
      const mix = j === 0 ? 0.6 : 0.0;
      const hb = j === 0 ? 1.7 : 1;
      tcol[ix]   = (color.r + (1 - color.r) * mix) * v * hb;
      tcol[ix+1] = (color.g + (1 - color.g) * mix) * v * hb;
      tcol[ix+2] = (color.b + (1 - color.b) * mix) * v * hb;
    }
    tgeo.attributes.position.needsUpdate = true;
    tgeo.attributes.color.needsUpdate = true;
    tmat.opacity = norm < 0.85 ? 1 : smooth01((1 - norm) / 0.15);

    // shed crackling balls
    for (let i = 0; i < shed; i++) {
      const ix = i * 3;
      const dt = t - tb[i];
      let v = 0;
      if (dt >= 0) {
        spos[ix]   = bx[i] + svx[i] * dt;
        spos[ix+1] = by[i] + svy[i] * dt - 0.5 * shedG * dt * dt;   // fall off the tail
        spos[ix+2] = bz[i] + svz[i] * dt;
        const ln = dt / shedLife;
        if (ln < 1) {
          // strobing crackle: sharp on/off pop per ball
          const cr = Math.sin(t * 70 + sseed[i] * 120) * Math.sin(t * 47 + sseed[i] * 53);
          const flick = cr > 0.0 ? 1.9 : 0.12;
          v = fade * flick * smooth01((1 - ln) / 0.5);
        }
      } else {
        spos[ix] = bx[i]; spos[ix+1] = by[i]; spos[ix+2] = bz[i];   // not shed yet
      }
      scol[ix] = color.r * v; scol[ix+1] = color.g * v; scol[ix+2] = color.b * v;
    }
    sgeo.attributes.position.needsUpdate = true;
    sgeo.attributes.color.needsUpdate = true;
  }
  function setFrame(f) { setAgeSeconds(frameToAge(f)); }
  function dispose() { tgeo.dispose(); tmat.dispose(); sgeo.dispose(); smat.dispose(); }
  setFrame(1);
  return { object, setFrame, frames: FRAMES, dispose, start: [sx, sy, sz], end: [ex, ey, ez] };
}
