// Three-native "Deep Space" background -- standalone, inscribed on its own. The
// RARE one: a window straight into space. Pure black (matching the foreground
// silhouette black, so it reads as a hole into the void), the BRIGHTEST stars of
// any background, and a small stylised inner solar system -- the planets easily
// visible from Earth, out to Saturn (with its rings) -- strung along the ecliptic.
//
// Because it's "a view into space" it REJECTS foregrounds (enforced by the host:
// no ground band can sit in front of it). Deterministic layout.
//
// FRAME-BASED contract (see effects/peony.js). Static apart from a faint twinkle.
import {
  PlaneGeometry, Mesh, MeshBasicMaterial, Group,
  BufferGeometry, BufferAttribute, PointsMaterial, Points,
  Color, AdditiveBlending, CanvasTexture, SRGBColorSpace
} from 'three';

export const FPS = 60;
export const FRAMES = 900;
export const DURATION = Math.round(FRAMES / FPS * 1000); // 15000
export const PEAK_FRAME = 1;

const VIEW_SPAN = 42.9, VIEW_CENTER_Y = 12, OVER = 1.12;
const X_MAX = VIEW_SPAN / 2;
const Y_BOT = VIEW_CENTER_Y - VIEW_SPAN / 2;
function pctY(p) { return Y_BOT + p * VIEW_SPAN; }

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _star = null;
function starTexture() {
  if (_star) return _star;
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  _star = new CanvasTexture(c);
  return _star;
}

// A planet disc texture. Deliberately MODERATE brightness + high saturation so the
// global UnrealBloom (low 0.22 threshold) doesn't blow the disc to a white glow and
// drown the colour -- the planets must read as distinct COLOURED bodies next to the
// white additive stars. So: no bright highlight, capped luminance, saturated hues.
// R is kept small (0.17·S) so even Saturn's full ring system fits INSIDE the canvas
// (ring outer ≈ 0.39·S < 0.5·S) instead of being clipped square at the edges. The
// host sizes the plane so the BODY ends up at the requested world radius regardless.
const R_FRAC = 0.17;
function planetTexture(rgb, opts = {}) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const cx = S / 2, cy = S / 2, R = S * R_FRAC;
  const lit  = (k) => `rgb(${rgb[0]*k|0},${rgb[1]*k|0},${rgb[2]*k|0})`;
  // gentle spherical shading: lit side ~1.0, far side darkens. NO super-bright core.
  const grd = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.15, cx, cy, R);
  grd.addColorStop(0.0, lit(1.08));
  grd.addColorStop(0.6, lit(0.9));
  grd.addColorStop(1.0, lit(0.4));
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  if (opts.bands) {                                   // gas-giant banding (Jupiter)
    g.globalAlpha = 0.30;
    for (let i = -3; i <= 3; i++) {
      g.fillStyle = i % 2 ? lit(0.6) : lit(1.05);
      g.fillRect(cx - R, cy + i * R * 0.28 - R * 0.12, R * 2, R * 0.22);
    }
    g.globalAlpha = 1;
  }
  g.restore();
  if (opts.ring) {                                     // Saturn ring system (muted)
    g.save();
    g.translate(cx, cy); g.rotate(-0.42); g.scale(1, 0.34);
    g.strokeStyle = 'rgba(150,138,108,0.8)'; g.lineWidth = R * 0.16;
    g.beginPath(); g.arc(0, 0, R * 1.9, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(120,110,88,0.55)'; g.lineWidth = R * 0.10;
    g.beginPath(); g.arc(0, 0, R * 2.3, 0, Math.PI * 2); g.stroke();
    g.restore();
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    g.fillStyle = grd; g.fillRect(0, 0, S, S); g.restore();
  }
  // crisp limb so the disc edge reads (no glow ring)
  g.lineWidth = 1.5; g.strokeStyle = lit(0.35);
  g.beginPath(); g.arc(cx, cy, R - 1, 0, Math.PI * 2); g.stroke();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

// planets out to Saturn, easily visible from Earth. Colours are SATURATED but kept
// MODERATE in luminance (peak channel ~160-190) so bloom preserves the colour. Discs
// bumped up in size to separate them from the star points. [rgb, world radius, ...]
const PLANETS = [
  { rgb: [128, 112, 96],  r: 0.8 },                    // Mercury — grey-tan
  { rgb: [196, 178, 120], r: 1.25 },                   // Venus — pale gold (brightest)
  { rgb: [182, 74, 46],   r: 1.0 },                    // Mars — saturated rust red
  { rgb: [188, 152, 104], r: 2.1, bands: true },       // Jupiter — banded tan
  { rgb: [190, 172, 126], r: 1.9, ring: true },        // Saturn — pale gold + rings
];

export function create(opts = {}) {
  const seed = ((opts.seed != null ? opts.seed : 0x300be7) >>> 0) || 0x300be7;
  const rng = mulberry32(seed);
  const object = new Group();

  // pure-black base plane
  const bgeo = new PlaneGeometry(VIEW_SPAN * OVER, VIEW_SPAN * OVER);
  bgeo.translate(0, VIEW_CENTER_Y, 0);
  const bmat = new MeshBasicMaterial({
    color: new Color().setRGB(0, 0, 0, SRGBColorSpace), depthTest: false, depthWrite: false });
  const base = new Mesh(bgeo, bmat); base.renderOrder = -101; object.add(base);

  // bright star field (brightest of any background) -- but capped so no single star
  // blooms into a sun-like blob (there is no sun in this view).
  const N = 380;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const baseB = new Float32Array(N), seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i*3]   = (rng() * 2 - 1) * X_MAX * 1.05;
    pos[i*3+1] = pctY(rng());
    pos[i*3+2] = 0;
    baseB[i] = 0.18 + Math.pow(rng(), 2.0) * 0.5;      // many faint, a few brighter (capped)
    seeds[i] = rng() * 99;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  const smat = new PointsMaterial({
    size: 1.1, map: starTexture(), vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true });
  const stars = new Points(geo, smat); stars.renderOrder = -99; object.add(stars);

  // a denser DUSTING of dim, tiny background stars for depth -- kept well under the
  // bloom threshold so they read as faint pinpricks behind the bright stars and never
  // bloom. Static (the faint dust needs no twinkle), so they live in their own buffer.
  const DN = 820;
  const dpos = new Float32Array(DN * 3), dcol = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) {
    dpos[i*3]   = (rng() * 2 - 1) * X_MAX * 1.05;
    dpos[i*3+1] = pctY(rng());
    dpos[i*3+2] = 0;
    const b = 0.045 + Math.pow(rng(), 2.4) * 0.10;      // very faint (~0.045 - 0.145)
    dcol[i*3] = b; dcol[i*3+1] = b; dcol[i*3+2] = b * 1.04;
  }
  const dgeo = new BufferGeometry();
  dgeo.setAttribute('position', new BufferAttribute(dpos, 3));
  dgeo.setAttribute('color', new BufferAttribute(dcol, 3));
  const dmat = new PointsMaterial({
    size: 0.55, map: starTexture(), vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true });
  const dimStars = new Points(dgeo, dmat); dimStars.renderOrder = -100; object.add(dimStars);

  // planets scattered RANDOMLY across the inner 90% of the frame (nothing on the
  // outer edge), no particular order. Light rejection sampling keeps them from
  // piling on top of each other. Deterministic via rng.
  const planetMeshes = [];
  const placed = [];
  const minSep = VIEW_SPAN * 0.17;                       // keep bodies visually apart
  const xLim = X_MAX * 0.9, yLo = pctY(0.05), yHi = pctY(0.95);
  PLANETS.forEach((pl, i) => {
    // plane sized so the BODY (drawn at R_FRAC of the canvas) lands at world radius pl.r,
    // 20% smaller than before; the transparent margin still gives Saturn's rings room.
    const w = (pl.r / R_FRAC) * 0.8;
    let x = 0, y = 0;
    for (let tries = 0; tries < 48; tries++) {
      x = (rng() * 2 - 1) * xLim;                        // inner 90% horizontally
      y = pctY(0.05 + rng() * 0.90);                     // inner 90% vertically
      if (placed.every(p => Math.hypot(p.x - x, p.y - y) > minSep)) break;
    }
    // Per-planet manual nudges on top of the random spot (positions stay random):
    if (i === 2) { y += 0.08 * VIEW_SPAN; x = -x; }                 // Mars: up 8%, mirrored to the other side
    if (i === 3 || i === 4) { y -= 0.20 * VIEW_SPAN; x -= 0.06 * VIEW_SPAN; } // Jupiter & Saturn: down 20%, slightly left
    x = Math.max(-xLim, Math.min(xLim, x));               // keep inside the inner 90%
    y = Math.max(yLo, Math.min(yHi, y));
    placed.push({ x, y });
    const tex = planetTexture(pl.rgb, { ring: pl.ring, bands: pl.bands });
    const pgeo = new PlaneGeometry(w, w);
    const pmat = new MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const m = new Mesh(pgeo, pmat); m.position.set(x, y, 0); m.renderOrder = -97;
    object.add(m); planetMeshes.push(m);
  });

  object.renderOrder = -100;

  function setFrame(f) {
    const t = (f - 1) / FPS;
    for (let i = 0; i < N; i++) {
      const tw = 0.8 + 0.2 * Math.sin(t * 4.0 + seeds[i]);
      const b = baseB[i] * tw;
      col[i*3] = b; col[i*3+1] = b; col[i*3+2] = b * 1.02;
    }
    geo.attributes.color.needsUpdate = true;
  }
  function dispose() {
    object.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
  }
  setFrame(1);
  return { object, setFrame, frames: FRAMES, dispose };
}
