// Three-native "Lakeside" foreground -- standalone, inscribed on its own. A
// pure-black silhouette looking out over a calm lake from a dock: two Adirondack
// CHAIRS (slat fan on a solid seat base) on a plank DOCK in perspective (seams
// see-through). The water is drawn as thin wavy ripple lines (NOT a solid fill) so
// the show reads through the gaps like reflections on the surface. Lots of
// intentional holes so the background shines through.
//
// Full-frame plane carrying a CanvasTexture (transparent above, black below).
// renderOrder 100 (front). FRAME-BASED static contract.
import { PlaneGeometry, Mesh, MeshBasicMaterial, CanvasTexture, SRGBColorSpace } from 'three';

export const FPS = 60;
export const FRAMES = 900;
export const DURATION = Math.round(FRAMES / FPS * 1000);
export const PEAK_FRAME = 1;

const VIEW_SPAN = 42.9, VIEW_CENTER_Y = 12, OVER = 1.12;
const PAD = (OVER - 1) / (2 * OVER);

function buildMesh(paint) {
  const W = 1152, H = 1152;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const fy = p => H * (PAD + (1 - p) / OVER);
  const fx = u => W * (PAD + u / OVER);
  paint(g, W, H, fx, fy);
  const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace;
  const geo = new PlaneGeometry(VIEW_SPAN * OVER, VIEW_SPAN * OVER);
  geo.translate(0, VIEW_CENTER_Y, 0);
  const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const object = new Mesh(geo, mat); object.renderOrder = 100;
  function setFrame() {}
  function dispose() { geo.dispose(); mat.dispose(); tex.dispose(); }
  setFrame();
  return { object, setFrame, frames: FRAMES, dispose };
}

export function create() {
  return buildMesh((g, W, H, fx, fy) => {
    g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineCap = 'round'; g.lineJoin = 'round';
    const pp = dp => H * dp / OVER;
    const dot = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
    const bone = (x1, y1, x2, y2, w1, w2) => {       // tapered filled bar + round ends
      const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      g.beginPath();
      g.moveTo(x1 + nx * w1, y1 + ny * w1); g.lineTo(x2 + nx * w2, y2 + ny * w2);
      g.lineTo(x2 - nx * w2, y2 - ny * w2); g.lineTo(x1 - nx * w1, y1 - ny * w1);
      g.closePath(); g.fill(); dot(x1, y1, w1); dot(x2, y2, w2);
    };

    const HORIZON = 0.095;   // calm-water far edge (low, so the chairs sit above it)

    // --- calm water: thin gently-wavy ripple lines (NOT a solid fill) so the show
    //     shows through the gaps, like fireworks reflected on the surface ---
    let p = 0.004, k = 0;
    while (p < HORIZON) {
      const tn = p / HORIZON;                                 // 0 near, 1 at horizon
      g.lineWidth = pp(0.0078 * (1 - tn) + 0.0022);
      const amp = 0.0015 + 0.0011 * tn;
      g.beginPath();
      for (let i = 0; i <= 150; i++) {
        const u = i / 150;
        const yy = fy(p + amp * Math.sin(u * (24 + k * 3) + k * 1.3));
        i ? g.lineTo(fx(u), yy) : g.moveTo(fx(u), yy);
      }
      g.stroke();
      k++; p += 0.0065 + 0.006 * tn;
    }

    // --- dock: perspective deck of planks (converging up), thin see-through seams ---
    const nearA = 0.20, nearB = 0.80, farA = 0.37, farB = 0.63, deckP = 0.080;
    const planks = 9, gN = 0.006, gF = 0.003;
    for (let i = 0; i < planks; i++) {
      const na = nearA + (nearB - nearA) * i / planks + gN, nb = nearA + (nearB - nearA) * (i + 1) / planks - gN;
      const fa = farA + (farB - farA) * i / planks + gF, fb = farA + (farB - farA) * (i + 1) / planks - gF;
      g.beginPath();
      g.moveTo(fx(na), fy(0)); g.lineTo(fx(nb), fy(0));
      g.lineTo(fx(fb), fy(deckP)); g.lineTo(fx(fa), fy(deckP));
      g.closePath(); g.fill();
    }

    // --- an Adirondack chair, back to us: a slat fan ON TOP of a solid seat base
    //     (seat block + arms + four legs + stretcher) ---
    function chair(uc, baseP, h, dir) {
      const Y = fr => fy(baseP + h * fr);
      const dl = dir * 0.03;
      // back: fan of slats with gaps (upper half only)
      const slats = 7;
      for (let i = 0; i < slats; i++) {
        const t = (i / (slats - 1)) * 2 - 1;
        const topFr = 1.0 - 0.15 * t * t;                   // curved fan top, centre tallest
        bone(fx(uc + t * 0.013), Y(0.50), fx(uc + t * 0.038 + dl), Y(topFr), pp(h * 0.044), pp(h * 0.046));
      }
      bone(fx(uc - 0.020), Y(0.53), fx(uc + 0.020), Y(0.53), pp(h * 0.030), pp(h * 0.030));   // lower back rail
      bone(fx(uc - 0.040 + dl), Y(0.82), fx(uc + 0.040 + dl), Y(0.82), pp(h * 0.020), pp(h * 0.020)); // upper rail
      // narrow solid seat block (the base the back rises from)
      g.beginPath();
      g.moveTo(fx(uc - 0.044), Y(0.50)); g.lineTo(fx(uc + 0.044), Y(0.50));
      g.lineTo(fx(uc + 0.048), Y(0.32)); g.lineTo(fx(uc - 0.048), Y(0.32));
      g.closePath(); g.fill();
      // flat armrests, parallel to the deck, lifted above the seat so they read distinctly
      bone(fx(uc - 0.024), Y(0.58), fx(uc - 0.050), Y(0.58), pp(h * 0.020), pp(h * 0.020));
      bone(fx(uc + 0.024), Y(0.58), fx(uc + 0.050), Y(0.58), pp(h * 0.020), pp(h * 0.020));
      // four narrow legs down to the dock (a small reveal above the deck = the base)
      bone(fx(uc - 0.040), Y(0.32), fx(uc - 0.044), Y(0.0), pp(h * 0.024), pp(h * 0.018));
      bone(fx(uc + 0.040), Y(0.32), fx(uc + 0.044), Y(0.0), pp(h * 0.024), pp(h * 0.018));
      bone(fx(uc - 0.046), Y(0.30), fx(uc - 0.050), Y(0.0), pp(h * 0.022), pp(h * 0.016));
      bone(fx(uc + 0.046), Y(0.30), fx(uc + 0.050), Y(0.0), pp(h * 0.022), pp(h * 0.016));
      // bottom stretcher
      bone(fx(uc - 0.046), Y(0.05), fx(uc + 0.046), Y(0.05), pp(h * 0.015), pp(h * 0.015));
    }
    chair(0.400, 0.064, 0.078, -1);
    chair(0.600, 0.064, 0.078, 1);
  });
}
