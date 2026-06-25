// Three-native "Starfield" night-sky background -- standalone, inscribed on its
// own. Renders a realistic-feeling US night sky: a 360-degree panorama of the
// brightest stars arranged into RECOGNISABLE constellations (the summer/northern
// sky: both Dippers + Draco circumpolar in the north, Cassiopeia, the Summer
// Triangle of Cygnus/Lyra/Aquila, Ophiuchus holding Serpens with Hercules and
// Corona Borealis above, and Scorpius/Sagittarius low in the south), plus faint
// scatter stars. They sit in their relative directions with an empty band at the
// 0/360 seam so none is ever cut in half.
// A Bitcoin-derived `facing` (compass azimuth)
// scrolls which slice of the panorama you see, so different blocks show different
// constellations. Optionally a MOON (phase + arc position from the block's mine
// time) hangs in a shallow high arc; a brighter moon dims the stars.
//
// FRAME-BASED contract (see effects/peony.js). A background spans the whole show
// and has no burst -- it is static apart from a subtle per-frame star twinkle.
// Stars are kept deliberately DIM (well under the global bloom threshold) so the
// additive fireworks always read over them and never get washed out.
//
// One module, four dropdown entries (like the shapes share shape.js):
//   tone:'black' / 'navy'  x  moon: none / present.
import {
  PlaneGeometry, Mesh, MeshBasicMaterial, Group,
  BufferGeometry, BufferAttribute, PointsMaterial, Points, LineSegments, LineBasicMaterial,
  Color, AdditiveBlending, CanvasTexture, SRGBColorSpace, LinearFilter
} from 'three';

export const FPS = 60;
export const FRAMES = 900;                               // 15s show span
export const DURATION = Math.round(FRAMES / FPS * 1000); // 15000
export const PEAK_FRAME = 1;                             // static -> any frame is "the look"

// Camera (fov 50, z=46, look-at y=12) sees a ~42.9-unit square at z=0, centred
// at y=12. Frame: x in [-21.45,21.45], y in [-9.45 (bottom), 33.45 (top)].
const VIEW_SPAN = 42.9, VIEW_CENTER_Y = 12, OVER = 1.12;
const X_MAX = VIEW_SPAN / 2;                             // 21.45
const Y_BOT = VIEW_CENTER_Y - VIEW_SPAN / 2;            // -9.45
function pctY(p) { return Y_BOT + p * VIEW_SPAN; }       // 0..1 of screen height -> world y

// Star field maps onto the upper band of the frame (above where a foreground
// scene/ground would sit) up toward the top.
const SKY_Y_LO = pctY(0.18);                             // horizon-ish
const SKY_Y_HI = pctY(0.97);                             // near top
const WINDOW_HALF = 56;                                  // half the visible azimuth fov (deg)
const ALT_RANGE = 62;                                    // degrees of altitude mapped LO..HI

// ---- deterministic PRNG so the sky is identical every render ----------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- constellation panorama (stylised but recognisable shapes) --------------
// Each: lon = panorama azimuth of its centre (deg, 0..360), alt = centre altitude
// (deg above horizon). stars = [du, dv, mag] offsets in degrees from the centre
// (mag ~ visual magnitude, lower = brighter). lines = index pairs to connect.
// Summer / northern sky set, placed in correct RELATIVE directions and rotated so
// the empty winter arc straddles the 0/360 seam -- no figure wraps / is cut in half.
//   north pole region (high): UrsaMajor, Draco, UrsaMinor ; Cassiopeia low in the N
//   the Summer Triangle across the E: Cygnus, Lyra, Aquila
//   summer core to the S: Sagittarius & Scorpius low ; Ophiuchus + Serpens (the
//   serpent-bearer holding the serpent) mid ; Hercules + CoronaBorealis high above.
const CONSTELLATIONS = [
  { name: 'UrsaMajor', lon: 66, alt: 48, stars: [
      [0, 0, 1.8], [4, 0.3, 2.4], [8, 1, 2.4], [11, 2.5, 3.3],
      [13.5, 1, 1.8], [13, -2.5, 2.2], [9.5, -3, 2.4] ],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]] },
  { name: 'Draco', lon: 90, alt: 56, stars: [
      [-7, -1, 3.3], [-4, 1, 3.3], [-1, 2, 2.8], [2, 3, 3.1], [4, 1, 3.7],
      [5, -1, 2.2], [3, -2, 2.8], [5.5, -3, 3.7], [3.5, -3.5, 4.9] ],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,8],[8,7],[7,5]] },
  { name: 'UrsaMinor', lon: 110, alt: 42, stars: [
      [0, 0, 2.0], [3, -1.5, 4.3], [6, -2.5, 4.9], [8, -3, 3.0],
      [11, -2, 2.1], [11.5, -5, 3.0], [8.5, -5.5, 4.3] ],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]] },
  { name: 'Cassiopeia', lon: 134, alt: 20, stars: [
      [-8, 0, 2.2], [-4, 3, 2.3], [0, 0, 2.5], [4, 3.5, 2.7], [8, 1, 3.4] ],
    lines: [[0,1],[1,2],[2,3],[3,4]] },
  { name: 'Cygnus', lon: 174, alt: 42, stars: [
      [0, 8, 1.2], [0, 2, 2.2], [0, -5, 1.3], [-6, 2.5, 2.5], [6, 1.5, 2.5] ],
    lines: [[0,1],[1,2],[3,1],[1,4]] },
  { name: 'Lyra', lon: 191, alt: 56, stars: [
      [0, 0, 0.0], [-1.5, -3, 4], [1.5, -3.5, 4.2], [-1, -6, 4.3], [1.7, -6.5, 4.3] ],
    lines: [[1,2],[1,3],[2,4],[3,4]] },
  { name: 'Aquila', lon: 216, alt: 32, stars: [
      [0, 0, 0.8], [-1, 2, 2.7], [1, -2, 3.7], [-4, 3, 3.0], [4, -1, 3.4], [-6, 1, 3.2] ],
    lines: [[1,0],[0,2],[3,1],[1,5],[0,4]] },
  { name: 'Sagittarius', lon: 249, alt: 16, stars: [
      [0, 0, 2.0], [3, 1, 2.8], [4, 4, 2.6], [1, 5, 3.1], [-2, 3, 2.9],
      [-3, -1, 3.5], [5, -2, 2.8] ],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,0],[4,5],[1,6]] },
  { name: 'Ophiuchus', lon: 262, alt: 40, stars: [
      [0, 7, 2.1], [-4, 3, 2.7], [-5, -3, 3.3], [-1, -6, 2.6], [4, -5, 2.4], [5, 1, 2.4] ],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]] },
  { name: 'Serpens', lon: 270, alt: 44, stars: [
      [-6, 4, 3.5], [-4, 2, 3.6], [-2, 0, 2.6], [0, -1, 3.5], [3, -3, 3.5],
      [5, -5, 3.3], [7, -4, 4.0] ],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]] },
  { name: 'Hercules', lon: 273, alt: 54, stars: [
      [0, 0, 2.8], [3, 1, 3.5], [4, 4, 3.9], [1, 5, 3.8], [-3, -2, 3.1],
      [6, -1, 3.2], [-2, 3, 3.1], [6, 6, 3.5] ],
    lines: [[0,1],[1,2],[2,3],[3,0],[0,4],[1,5],[3,6],[2,7]] },
  { name: 'Scorpius', lon: 288, alt: 20, stars: [
      [0, 4, 1.0], [-2, 6, 2.9], [2, 6.5, 2.6], [0.5, 0, 2.8], [1.5, -4, 2.0],
      [3.5, -7, 1.9], [6, -8, 1.6] ],
    lines: [[1,0],[2,0],[0,3],[3,4],[4,5],[5,6]] },
  { name: 'CoronaBorealis', lon: 293, alt: 58, stars: [
      [0, 0, 3.7], [-2, 0.5, 2.2], [-3.5, 2, 3.8], [-4, 4, 4.1], [1.5, 0, 3.8],
      [3, 1.5, 4.1], [3.5, 3.5, 5.0] ],
    lines: [[3,2],[2,1],[1,0],[0,4],[4,5],[5,6]] },
];

// Detailed moon sprite that REFLECTS PHASE: a crisp grey-tan disc clipped to the LIT
// region for the given illuminated fraction. The unlit part is left fully TRANSPARENT
// (you simply don't see it against the night sky) -- no grey dark-side disc, no soft
// perimeter glow ring. phase: 0..1 (1=full, 0.5=half, ->0 thin crescent); waxing=true
// puts the lit limb on the RIGHT.
//
// The surface is drawn from the REAL documented near-side: the named maria (the dark
// "seas") in their actual face-on positions (north up, west left) as soft irregular
// basalt plains, plus the signature craters -- Tycho and Copernicus with their bright
// ray systems, dark-floored Plato, Clavius, the brilliant Aristarchus -- over a
// limb-darkened highland surface with fine grain. seedRng only flavours the random
// scatter craters / grain so the recognisable features stay put every render.
function moonTexture(phase, seedRng, waxing = true, bri = 1) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const cx = S / 2, cy = S / 2, R = S * 0.46;
  // brighten the lit surface as the moon fills (bri ~1 at crescent -> ~1.4 at full)
  const sc = v => Math.max(0, Math.min(255, Math.round(v * bri)));
  const rgb = (r, g2, b, a) => a == null ? `rgb(${sc(r)},${sc(g2)},${sc(b)})`
                                         : `rgba(${sc(r)},${sc(g2)},${sc(b)},${a})`;
  // world-space helper: normalized (nx,ny) in [-1,1] disc coords -> canvas px
  const PX = (nx, ny) => [cx + nx * R, cy + ny * R];
  phase = Math.max(0, Math.min(1, phase));

  // Build the LIT-region path (lit limb + elliptical terminator), then clip to it
  // and paint the surface only inside -> the dark side stays transparent.
  g.save();
  if (phase >= 0.995) {
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2);
  } else {
    g.beginPath();
    // lit limb = the right (waxing) or left (waning) semicircle, top -> bottom
    const a0 = waxing ? -Math.PI / 2 : Math.PI / 2;
    const a1 = waxing ? Math.PI / 2 : -Math.PI / 2;
    g.arc(cx, cy, R, a0, a1, false);
    // terminator: a half-ellipse back to the top. semi-x shrinks the lit area.
    const semi = Math.abs(R * (1 - 2 * phase));
    const gib = phase > 0.5;                          // gibbous bulges into the dark side
    // Same winding for both limbs: a1/a0 are already swapped between waxing/waning, so
    // !gib here mirrors the bulge correctly -- gibbous bulges OUT into the dark limb,
    // crescent carves IN. (A waning-specific flag here inverted it: gibbous->crescent.)
    g.ellipse(cx, cy, semi, R, 0, a1, a0, !gib);
    g.closePath();
  }
  g.clip();

  // ---- base highland surface: a MATTE, near-uniform regolith grey (a full moon is
  // lit flat-on, so there is NO glossy hotspot/specular sheen -- just a faint limb
  // darkening at the very edge). Kept moderate so bloom doesn't blow it to white. ----
  const grd = g.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.02);
  grd.addColorStop(0.0, rgb(116,114,106));
  grd.addColorStop(0.80, rgb(110,108,100));
  grd.addColorStop(0.94, rgb(92,90,83));
  grd.addColorStop(1.0, rgb(60,59,54));
  g.fillStyle = grd; g.fillRect(0, 0, S, S);

  // deterministic blobbing: a soft irregular closed patch around (nx,ny). `rng` drives
  // the lumpiness; drawn under a blur so the seas have organic, feathered shores.
  function blob(nx, ny, baseR, squashX, rot, rng) {
    const [bx, by] = PX(nx, ny), n = 18, rad = [];
    for (let i = 0; i < n; i++) rad.push(0.78 + 0.30 * rng());
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const k = i % n;
      // 3-tap smoothing so the outline undulates instead of spiking
      const rr = baseR * R * (rad[(k - 1 + n) % n] + 2 * rad[k] + rad[(k + 1) % n]) / 4;
      const a = rot + i / n * Math.PI * 2;
      const px = bx + Math.cos(a) * rr * squashX;
      const py = by + Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  }

  // ---- the maria, in real near-side positions (nx +right/east, ny +down/south).
  // These dark basalt plains ARE the "man in the moon": Imbrium/Serenitatis/
  // Tranquillitatis form the eyes & face, Nubium/Humorum the body. They are roughly
  // HALF the brightness of the highlands, so they're painted dark and fairly opaque. ----
  // [nx, ny, radius, opacity, squashX, label]
  const MARIA = [
    [-0.30, -0.36, 0.36, 0.92, 1.05, 'Imbrium'],          // right "eye"
    [ 0.18, -0.30, 0.24, 0.95, 0.95, 'Serenitatis'],      // left "eye"
    [ 0.38, -0.02, 0.26, 0.92, 1.00, 'Tranquillitatis'],  // "mouth"/cheek
    [ 0.63, -0.20, 0.13, 0.95, 0.85, 'Crisium'],          // isolated oval, NE limb
    [ 0.52,  0.20, 0.18, 0.88, 0.90, 'Fecunditatis'],
    [ 0.34,  0.32, 0.13, 0.85, 1.00, 'Nectaris'],
    [-0.13,  0.38, 0.19, 0.82, 1.25, 'Nubium'],
    [-0.42,  0.30, 0.13, 0.84, 1.00, 'Humorum'],
    [-0.58, -0.02, 0.34, 0.80, 0.80, 'Procellarum'],      // vast western ocean
    [ 0.06, -0.06, 0.12, 0.72, 1.20, 'Vaporum'],          // bridges the two "eyes"
    [-0.27,  0.20, 0.12, 0.74, 1.15, 'Cognitum'],
    [-0.05, -0.60, 0.32, 0.62, 2.60, 'Frigoris'],         // thin arc hugging the north limb
  ];
  g.save();
  g.filter = 'blur(' + (S * 0.010) + 'px)';
  for (const [nx, ny, r, op, sq] of MARIA) {
    const rng = mulberry32((Math.round((nx + 2) * 1000) ^ Math.round((ny + 2) * 7919)) >>> 0);
    const rot = rng() * Math.PI;
    blob(nx, ny, r, sq, rot, rng);
    const [bx, by] = PX(nx, ny);
    const gg = g.createRadialGradient(bx, by, 0, bx, by, r * R * 1.05);
    // cool dark basalt, near-flat across the plain, feathering only at the very shore
    gg.addColorStop(0.0, rgb(54, 55, 61, op));
    gg.addColorStop(0.78, rgb(58, 59, 65, op * 0.95));
    gg.addColorStop(1.0, rgb(64, 65, 71, 0));
    g.fillStyle = gg; g.fill();
    // internal mottling: a few darker/lighter patches so the seas aren't a flat tint
    for (let m = 0; m < 5; m++) {
      const mxn = nx + (rng() - 0.5) * r * 1.2, myn = ny + (rng() - 0.5) * r * 1.2;
      const [px, py] = PX(mxn, myn), pr = r * R * (0.18 + rng() * 0.22);
      const dark = rng() < 0.6;
      const mg = g.createRadialGradient(px, py, 0, px, py, pr);
      mg.addColorStop(0, dark ? rgb(44,45,50, 0.30) : rgb(82,83,90, 0.22));
      mg.addColorStop(1, rgb(60,61,67, 0));
      g.fillStyle = mg; g.beginPath(); g.arc(px, py, pr, 0, Math.PI*2); g.fill();
    }
  }
  g.filter = 'none';
  g.restore();

  // ---- fine surface grain (subtle speckle so the disc isn't a flat wash) ----
  for (let i = 0; i < 2600; i++) {
    const a = seedRng() * Math.PI * 2, rr = Math.sqrt(seedRng()) * R * 0.99;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    const d = seedRng();
    g.fillStyle = d < 0.5 ? rgb(60,59,54, 0.05 + seedRng()*0.05)
                          : rgb(180,178,164, 0.04 + seedRng()*0.05);
    g.fillRect(px, py, 1.4, 1.4);
  }

  // ---- a named crater: dark floor, bright sunlit rim, tiny central peak ----
  function crater(nx, ny, r, opt = {}) {
    const [px, py] = PX(nx, ny), cr = r * R;
    // ejecta apron (faint bright halo) for fresh craters
    if (opt.bright) {
      const ap = g.createRadialGradient(px, py, cr * 0.6, px, py, cr * 2.6);
      ap.addColorStop(0, rgb(190,188,172, 0.16));
      ap.addColorStop(1, rgb(190,188,172, 0));
      g.fillStyle = ap; g.beginPath(); g.arc(px, py, cr * 2.6, 0, Math.PI*2); g.fill();
    }
    // floor
    const fl = g.createRadialGradient(px - cr*0.3, py - cr*0.3, cr*0.1, px, py, cr);
    fl.addColorStop(0, opt.darkFloor ? rgb(54,55,60, 0.9) : rgb(92,90,82, 0.85));
    fl.addColorStop(1, opt.darkFloor ? rgb(66,67,72, 0.7) : rgb(120,118,108, 0.5));
    g.fillStyle = fl; g.beginPath(); g.arc(px, py, cr, 0, Math.PI*2); g.fill();
    // sunlit rim (brighter on the side facing the light = upper-left)
    g.lineWidth = Math.max(1, cr * 0.16);
    g.strokeStyle = rgb(196,193,176, opt.bright ? 0.85 : 0.6);
    g.beginPath(); g.arc(px, py, cr * 0.96, Math.PI*0.9, Math.PI*1.9); g.stroke();
    g.strokeStyle = rgb(46,46,42, 0.45);
    g.beginPath(); g.arc(px, py, cr * 0.96, Math.PI*1.9, Math.PI*2.9); g.stroke();
    // central peak
    if (!opt.darkFloor && cr > R*0.025) {
      g.fillStyle = rgb(170,167,152, 0.7);
      g.beginPath(); g.arc(px, py, cr * 0.14, 0, Math.PI*2); g.fill();
    }
  }

  // ---- ray system: faint bright streaks fanning out from young craters ----
  function rays(nx, ny, len, n, str, rng) {
    const [px, py] = PX(nx, ny);
    g.save(); g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, L = len * R * (0.5 + rng() * 0.8);
      const ex = px + Math.cos(a) * L, ey = py + Math.sin(a) * L;
      const lg = g.createLinearGradient(px, py, ex, ey);
      lg.addColorStop(0, rgb(210,207,190, str));
      lg.addColorStop(1, rgb(210,207,190, 0));
      g.strokeStyle = lg; g.lineWidth = Math.max(1, R * (0.004 + rng() * 0.006));
      g.beginPath(); g.moveTo(px, py); g.lineTo(ex, ey); g.stroke();
    }
    g.restore();
  }

  // rays first (under the crater bowls), seeded per-crater for stable fans
  rays(-0.04, 0.54, 1.30, 32, 0.18, mulberry32(0x7c0a));   // Tycho -- the great ray system
  rays(-0.17, 0.07, 0.70, 22, 0.12, mulberry32(0xc0fe));   // Copernicus
  rays(-0.44,-0.20, 0.50, 16, 0.13, mulberry32(0xa215));   // Aristarchus (small, brilliant)

  // signature near-side craters (positions are the documented ones), drawn LARGE so
  // they read at the moon's on-screen size instead of vanishing as specks.
  crater(-0.04, 0.54, 0.070, { bright: true });            // Tycho (the brilliant ray crater)
  crater(-0.17, 0.07, 0.066, { bright: true });            // Copernicus
  crater(-0.44,-0.20, 0.040, { bright: true });            // Aristarchus
  crater(-0.10,-0.54, 0.062, { darkFloor: true });         // Plato (lava-flooded, dark)
  crater(-0.12, 0.66, 0.078, {});                          // Clavius (large, southern)
  crater( 0.30, 0.46, 0.056, {});                          // Theophilus
  crater(-0.32, 0.46, 0.044, {});                          // Tycho-region neighbour
  crater( 0.48,-0.40, 0.044, {});                          // Cleomedes-ish, NE
  crater(-0.40,-0.06, 0.046, { bright: true });            // Kepler

  // scatter of smaller craters for texture (seeded, avoids the dark mare centres a bit)
  for (let i = 0; i < 46; i++) {
    const a = seedRng() * Math.PI * 2, rr = Math.sqrt(seedRng()) * R * 0.93;
    const nx = Math.cos(a) * rr / R, ny = Math.sin(a) * rr / R;
    crater(nx, ny, (0.012 + seedRng() * 0.030), { bright: seedRng() < 0.16 });
  }

  // ---- subtle uneven limb shading: gives the disc a 3D, spherical feel without a
  // glossy hotspot. A soft inner vignette (slightly offset so the curvature reads),
  // then a few irregular darker scallops so the rim isn't a mathematically perfect
  // circle. Kept gentle on purpose. ----
  g.save();
  const vg = g.createRadialGradient(cx - R * 0.10, cy - R * 0.08, R * 0.60, cx, cy, R * 1.0);
  vg.addColorStop(0.0, 'rgba(0,0,0,0)');
  vg.addColorStop(0.80, 'rgba(0,0,0,0)');
  vg.addColorStop(1.0, 'rgba(14,14,18,0.36)');
  g.fillStyle = vg; g.fillRect(0, 0, S, S);
  g.filter = 'blur(' + (S * 0.012) + 'px)';
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2 + seedRng() * 0.22;
    const rr = R * (1 - (0.03 + seedRng() * 0.06));
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    const pr = R * (0.09 + seedRng() * 0.11);
    const sg = g.createRadialGradient(px, py, 0, px, py, pr);
    sg.addColorStop(0, 'rgba(0,0,0,' + (0.07 + seedRng() * 0.09).toFixed(3) + ')');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg; g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
  }
  g.filter = 'none';
  g.restore();

  g.restore();

  // Soften ONLY the terminator (the transparent cut) so it fades instead of being a
  // razor-straight edge. Build a soft-edged copy of the SAME lit region and keep only
  // what it covers (destination-in): the lit surface fades to transparency across the
  // terminator. The outer limb is re-crisped with a sharp circle so only the day/night
  // line softens -- no shadow band, no eclipse.
  if (phase < 0.995) {
    const mk = document.createElement('canvas'); mk.width = mk.height = S;
    const mg = mk.getContext('2d');
    const a0 = waxing ? -Math.PI / 2 : Math.PI / 2;
    const a1 = waxing ? Math.PI / 2 : -Math.PI / 2;
    const semi = Math.abs(R * (1 - 2 * phase));
    const gib = phase > 0.5;
    mg.fillStyle = '#fff';
    mg.filter = 'blur(' + (S * 0.013) + 'px)';          // terminator softness
    mg.beginPath();
    mg.arc(cx, cy, R, a0, a1, false);
    mg.ellipse(cx, cy, semi, R, 0, a1, a0, !gib);
    mg.closePath(); mg.fill();
    mg.filter = 'none';
    mg.globalCompositeOperation = 'destination-in';     // re-crisp the outer limb
    mg.beginPath(); mg.arc(cx, cy, R, 0, Math.PI * 2); mg.fill();
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(mk, 0, 0);
    g.globalCompositeOperation = 'source-over';
  }

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter; tex.magFilter = LinearFilter; tex.generateMipmaps = false;
  return tex;
}

// Soft round star sprite (shared).
let _star = null;
function starTexture() {
  if (_star) return _star;
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  _star = new CanvasTexture(c);
  return _star;
}

// tone base plane (flat near-black, or a navy->black vertical gradient).
function basePlane(tone) {
  const geo = new PlaneGeometry(VIEW_SPAN * OVER, VIEW_SPAN * OVER);
  geo.translate(0, VIEW_CENTER_Y, 0);
  let mat;
  if (tone === 'navy') {
    const W = 16, H = 1024;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const img = g.createImageData(W, H);
    const top = [1, 2, 7], bot = [0, 14, 38];            // near-black top -> navy horizon
    for (let y = 0; y < H; y++) {
      const u = y / (H - 1), e = u * u * (3 - 2 * u);
      const r0 = top[0] + (bot[0]-top[0])*e, g0 = top[1] + (bot[1]-top[1])*e, b0 = top[2] + (bot[2]-top[2])*e;
      for (let x = 0; x < W; x++) {
        const d = (Math.random() + Math.random() - 1) * 1.4, i = (y*W+x)*4;
        img.data[i]   = Math.max(0, Math.min(255, Math.round(r0 + d)));
        img.data[i+1] = Math.max(0, Math.min(255, Math.round(g0 + d)));
        img.data[i+2] = Math.max(0, Math.min(255, Math.round(b0 + d)));
        img.data[i+3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const tex = new CanvasTexture(cv);
    tex.colorSpace = SRGBColorSpace; tex.minFilter = LinearFilter; tex.magFilter = LinearFilter; tex.generateMipmaps = false;
    mat = new MeshBasicMaterial({ map: tex, depthTest: false, depthWrite: false });
    mat._tex = tex;
  } else {
    mat = new MeshBasicMaterial({
      // match the All-Black background (25,25,30) so switching to/accepting this sky
      // doesn't visibly darken the frame (additive stars then read consistently).
      color: new Color().setRGB(25/255, 25/255, 30/255, SRGBColorSpace),
      depthTest: false, depthWrite: false
    });
  }
  const m = new Mesh(geo, mat);
  m.renderOrder = -101;
  return m;
}

export function create(opts = {}) {
  const tone = opts.tone === 'navy' ? 'navy' : 'black';
  const facing = ((opts.facing != null ? opts.facing : 200) % 360 + 360) % 360;
  const hasMoon = !!(opts.moon && opts.moon.visible);
  const phase = opts.moon ? Math.max(0, Math.min(1, opts.moon.phase != null ? opts.moon.phase : 0.5)) : 0;
  const prog  = opts.moon ? Math.max(0, Math.min(1, opts.moon.prog  != null ? opts.moon.prog  : 0.5)) : 0.5;
  const seed  = (opts.seed != null ? opts.seed : 0x4a17c0de) >>> 0;
  const rng = mulberry32(seed);

  const object = new Group();
  object.add(basePlane(tone));

  // Stars: tone gain baked into each base brightness; a SEPARATE mutable moonDim
  // (a fuller moon washes the stars) is applied LIVE in setFrame, so dragging the
  // phase slider re-dims the stars without rebuilding the whole sky.
  const toneGain = (tone === 'navy' ? 0.85 : 1.0);
  let phaseVal = phase, progVal = prog;
  // The phase slider is a SINGLE control: middle (0.5) = FULL moon, either extreme =
  // NEW (no disc). The RIGHT half waxes (lit limb on the right), the LEFT half wanes
  // (lit limb on the left). illum = lit fraction 0..1.
  function illumOf(s)  { return 1 - 2 * Math.abs(s - 0.5); }
  function waxingOf(s) { return s >= 0.5; }
  // The lit surface stays dim for the thin crescents (first couple of slider steps)
  // and ramps to ~40% brighter as it fills, peaking at full (and ~1 step either side).
  // A thin crescent is dim; the disc clearly brightens as it fills, peaking at full.
  // Floor kept well below 1 so the *range* is obvious without the full moon blowing out.
  function briOf(s) {
    const il = illumOf(s);
    const t = Math.max(0, Math.min(1, (il - 0.06) / (0.96 - 0.06)));
    return 0.78 + 0.52 * (t * t * (3 - 2 * t));         // smoothstep 0.78 -> 1.30
  }
  let moonDim = hasMoon ? (1 - 0.4 * illumOf(phaseVal)) : 1.0;

  // project a panorama (lon,alt) to a fixed screen position; returns null if
  // outside the visible azimuth window.
  function project(lon, alt) {
    let rel = lon - facing; rel = ((rel + 540) % 360) - 180;       // -180..180
    if (rel < -WINDOW_HALF - 4 || rel > WINDOW_HALF + 4) return null;
    if (alt < 0 || alt > ALT_RANGE) return null;
    const x = (rel / WINDOW_HALF) * X_MAX * 1.02;
    const y = SKY_Y_LO + (alt / ALT_RANGE) * (SKY_Y_HI - SKY_Y_LO);
    return [x, y];
  }

  // gather all stars (constellation + scatter) into one Points buffer + line list
  const sx = [], sb = [], ssz = [], sseed = [];
  const linePts = [];
  for (const con of CONSTELLATIONS) {
    const proj = [];
    for (const st of con.stars) {
      const p = project(con.lon + st[0], con.alt + st[1]);
      proj.push(p);
      if (!p) continue;
      const mag = st[2];
      const b = Math.max(0.16, 0.52 - mag * 0.06) * toneGain;      // mag-scaled (boosted)
      sx.push(p[0], p[1], 0); sb.push(b); ssz.push(1.4 - mag * 0.18); sseed.push(rng() * 99);
    }
    for (const [i, j] of con.lines) {
      if (proj[i] && proj[j]) linePts.push(proj[i][0], proj[i][1], 0, proj[j][0], proj[j][1], 0);
    }
  }
  // faint scatter stars across the visible window
  const SCATTER = 220;
  for (let i = 0; i < SCATTER; i++) {
    const lon = facing + (rng() * 2 - 1) * WINDOW_HALF;
    const alt = rng() * ALT_RANGE;
    const p = project(lon, alt); if (!p) continue;
    const b = (0.12 + rng() * 0.18) * toneGain;
    sx.push(p[0], p[1], 0); sb.push(b); ssz.push(0.45 + rng() * 0.5); sseed.push(rng() * 99);
  }

  // --- constellation lines (very dim) ---
  if (linePts.length) {
    const lgeo = new BufferGeometry();
    lgeo.setAttribute('position', new BufferAttribute(new Float32Array(linePts), 3));
    const lmat = new LineBasicMaterial({
      color: new Color().setRGB(0.10, 0.12, 0.18, SRGBColorSpace),
      transparent: true, opacity: tone === 'navy' ? 0.35 : 0.5, depthTest: false, depthWrite: false
    });
    const lines = new LineSegments(lgeo, lmat);
    lines.renderOrder = -100;
    object.add(lines);
    object._lmat = lmat;
  }

  // --- stars (Points, additive, per-frame twinkle) ---
  const N = sb.length;
  const pos = new Float32Array(sx);
  const col = new Float32Array(N * 3);
  const base = new Float32Array(sb);
  const sz = new Float32Array(ssz);
  const seeds = new Float32Array(sseed);
  // PointsMaterial uses one size; emulate per-star size by baking size into a
  // gl_PointSize via a custom attribute is overkill -- instead use a single small
  // size and let brightness carry the visual weight. Pick a middle size.
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  const mat = new PointsMaterial({
    size: 0.9, map: starTexture(), vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: true
  });
  const stars = new Points(geo, mat);
  stars.renderOrder = -99;
  object.add(stars);

  // --- moon ---
  const MOON_DIA = 0.22 * VIEW_SPAN;                       // doubled size
  const MOON_R = MOON_DIA / 2;
  // Arc: slider tracks the moon LEFT->RIGHT across the frame (prog 0 = left/East edge,
  // prog 1 = right/West edge) so dragging right moves the moon right. Only a SLIVER
  // shows at each extreme; y crests at centre (prog 0.5).
  function moonXY(pr) {
    const mx = (pr - 0.5) * 2 * (X_MAX + MOON_R * 0.85);
    const myPct = 0.60 + 0.22 * Math.sin(pr * Math.PI);
    return [mx, pctY(myPct)];
  }
  let moonMesh = null;
  if (hasMoon) {
    const mgeo = new PlaneGeometry(MOON_DIA, MOON_DIA);
    const mmat = new MeshBasicMaterial({
      map: moonTexture(illumOf(phaseVal), mulberry32(seed ^ 0x9e3779b9), waxingOf(phaseVal), briOf(phaseVal)),
      transparent: true, opacity: 0.9, depthTest: false, depthWrite: false });
    moonMesh = new Mesh(mgeo, mmat);
    const [mx, my] = moonXY(progVal);
    moonMesh.position.set(mx, my, 0);
    moonMesh.renderOrder = -98;                            // in front of stars, behind shells
    object.add(moonMesh);
  }

  object.renderOrder = -100;

  function setFrame(f) {
    // gentle deterministic twinkle (small amplitude so it never visibly "dims"),
    // scaled live by moonDim so a brighter moon washes the stars.
    const t = (f - 1) / FPS;
    for (let i = 0; i < N; i++) {
      const tw = 0.93 + 0.07 * Math.sin(t * 3.0 + seeds[i]);
      const b = base[i] * tw * moonDim;
      col[i*3] = b; col[i*3+1] = b * 0.99; col[i*3+2] = b * 0.94;  // faintly warm-white
    }
    geo.attributes.color.needsUpdate = true;
  }

  // Live phase/position update for the Builder's moon sliders -- mutates the
  // existing instance (re-bakes the moon texture, moves it, re-dims the stars)
  // instead of recreating the whole sky, so dragging stays smooth.
  function setSky(newPhase, newProg) {
    if (newPhase != null) phaseVal = Math.max(0, Math.min(1, newPhase));
    if (newProg  != null) progVal  = Math.max(0, Math.min(1, newProg));
    moonDim = hasMoon ? (1 - 0.4 * illumOf(phaseVal)) : 1.0;
    if (moonMesh) {
      const old = moonMesh.material.map;
      moonMesh.material.map = moonTexture(illumOf(phaseVal), mulberry32(seed ^ 0x9e3779b9), waxingOf(phaseVal), briOf(phaseVal));
      moonMesh.material.needsUpdate = true;
      if (old) old.dispose();
      const [mx, my] = moonXY(progVal);
      moonMesh.position.set(mx, my, 0);
    }
  }

  function dispose() {
    object.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
  }
  setFrame(1);
  return { object, setFrame, setSky, frames: FRAMES, dispose };
}
