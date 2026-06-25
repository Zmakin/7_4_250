// Three-native "Football Field" foreground -- standalone, inscribed on its own. A
// pure-black silhouette of a school football field: the same fine-grass ground as
// the other foregrounds, a FIELD-GOAL POST on the left (uprights crop above the
// 15% line), and open METAL BLEACHERS on the right -- an angled, cross-braced frame
// whose understructure is transparent (the show reads through it), seats facing the
// goalpost. Everything small for scale against the show behind it.
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

    // deterministic PRNG so the field looks the same every render
    let s = 0x1a2b3c4d;
    const rnd = () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // ground contour: POV pushed back, grass sits lower (tips ~7-8%)
    const groundP = u => 0.050 + 0.008 * Math.sin(u * Math.PI);

    const blade = (x, baseY, h, lean, w) => {
      g.beginPath();
      g.moveTo(x - w, baseY);
      g.quadraticCurveTo(x + lean * 0.35, baseY - h * 0.55, x + lean, baseY - h);
      g.quadraticCurveTo(x + lean * 0.20 + w, baseY - h * 0.45, x + w, baseY);
      g.closePath();
      g.fill();
    };
    const grassRow = (u0, u1, stepPx, hMin, hMax, contour) => {
      for (let xp = fx(u0); xp <= fx(u1); xp += stepPx * (0.6 + 0.8 * rnd())) {
        const u = (xp / W - PAD) * OVER;
        const baseY = contour(u);
        const h = hMin + (hMax - hMin) * rnd();
        const lean = (rnd() - 0.5) * h * 0.7;
        const w = 1.4 + 1.4 * rnd();
        blade(xp, baseY, h, lean, w);
      }
    };

    // --- ground band ---
    g.beginPath();
    g.moveTo(0, fy(groundP(0)));
    const steps = 64;
    for (let i = 0; i <= steps; i++) { const u = i / steps; g.lineTo(fx(u), fy(groundP(u))); }
    g.lineTo(W, H + 10); g.lineTo(0, H + 10); g.closePath(); g.fill();

    // --- field goal post on the LEFT, scaled up 40% (uprights crop above 15%) ---
    const px = 0.18, S = 1.78, gpBase = groundP(px);
    const barP = gpBase + 0.055 * S, halfW = 0.055 * S, topP = barP + 0.085 * S;
    g.lineWidth = 11;
    g.beginPath(); g.moveTo(fx(px), fy(gpBase)); g.lineTo(fx(px), fy(barP)); g.stroke();        // base post
    g.lineWidth = 10;
    g.beginPath(); g.moveTo(fx(px - halfW), fy(barP)); g.lineTo(fx(px + halfW), fy(barP)); g.stroke(); // crossbar
    g.beginPath();                                                                              // uprights
    g.moveTo(fx(px - halfW), fy(barP)); g.lineTo(fx(px - halfW), fy(topP));
    g.moveTo(fx(px + halfW), fy(barP)); g.lineTo(fx(px + halfW), fy(topP));
    g.stroke();

    // --- open METAL bleachers on the RIGHT, facing the goalpost (rise left->right),
    //     moved back toward the edge; understructure is transparent (cross-braced frame) ---
    const bx0 = 0.80, bx1 = 1.00, rows = 5;
    const baseP = 0.072, stepUp = 0.016, stepIn = (bx1 - bx0) / rows;
    const topP2 = baseP + rows * stepUp;
    const seatP = k => baseP + Math.max(0, Math.min(rows, k)) * stepUp;
    // seat planks (thin bars), front (left/field) low -> back (right) high
    for (let r = 0; r < rows; r++) {
      const uA = bx0 + r * stepIn, p = baseP + r * stepUp;
      const y = fy(p), th = fy(p - 0.007) - y;
      g.fillRect(fx(uA), y, fx(uA + stepIn) - fx(uA), th);
    }
    // vertical legs to the ground at each step
    g.lineWidth = 3;
    for (let k = 0; k <= rows; k++) {
      const u = bx0 + k * stepIn;
      g.beginPath(); g.moveTo(fx(u), fy(0.0)); g.lineTo(fx(u), fy(seatP(k))); g.stroke();
    }
    // diagonal cross-braces in each bay (X), open gaps between
    g.lineWidth = 2;
    for (let k = 0; k < rows; k++) {
      const uL = bx0 + k * stepIn, uR = bx0 + (k + 1) * stepIn;
      g.beginPath();
      g.moveTo(fx(uL), fy(0.0)); g.lineTo(fx(uR), fy(seatP(k + 1)));
      g.moveTo(fx(uR), fy(0.0)); g.lineTo(fx(uL), fy(seatP(k)));
      g.stroke();
    }
    // elevated handrail running above the seats: a raised rail on short posts that
    // rise from each step (not a chord sitting on the treads)
    const railH = 0.026;
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(fx(bx0), fy(baseP + railH)); g.lineTo(fx(bx1), fy(topP2 + railH)); g.stroke();
    g.lineWidth = 2;
    for (let k = 0; k <= rows; k++) {
      const u = bx0 + k * stepIn;
      g.beginPath(); g.moveTo(fx(u), fy(seatP(k))); g.lineTo(fx(u), fy(seatP(k) + railH)); g.stroke();
    }

    // --- fine grass across the whole field (drawn last so tips overlap the bases) ---
    grassRow(0.00, 1.00, 6, 9, 19, u => fy(groundP(u)));
  });
}
