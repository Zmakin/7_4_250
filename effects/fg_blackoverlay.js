// Three-native "Black Overlay" foreground -- standalone, inscribed on its own.
// A black grassy ground band along the bottom, drawn IN FRONT of everything (hides
// shells behind it). Same fine-grass ground as the Baseball foreground but with no
// pitcher's mound, backstop, or light pole -- just the gently-bowed ground line
// topped with a deterministic field of fine, tapered grass blades across the width.
//
// Drawn as a full-frame plane carrying a CanvasTexture: transparent above the
// ground line, pure black below. renderOrder 100 (front). FRAME-BASED contract.
import { PlaneGeometry, Mesh, MeshBasicMaterial, CanvasTexture, SRGBColorSpace } from 'three';

export const FPS = 60;
export const FRAMES = 900;
export const DURATION = Math.round(FRAMES / FPS * 1000); // 15000
export const PEAK_FRAME = 1;

const VIEW_SPAN = 42.9, VIEW_CENTER_Y = 12, OVER = 1.12;

// Canvas covers the full overscanned plane. fy(p)/fx(u) convert a screen fraction
// (p = fraction up from the VISIBLE bottom; u = fraction across, 0=left) to a
// canvas pixel, accounting for the OVER overscan so "15%" lands correctly.
const PAD = (OVER - 1) / (2 * OVER);     // 0.0536 visible inset each side
function makeTexture(paint) {
  const W = 1152, H = 1152;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const fy = p => H * (PAD + (1 - p) / OVER);
  const fx = u => W * (PAD + u / OVER);
  paint(g, W, H, fx, fy);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function buildMesh(paint) {
  const geo = new PlaneGeometry(VIEW_SPAN * OVER, VIEW_SPAN * OVER);
  geo.translate(0, VIEW_CENTER_Y, 0);
  const tex = makeTexture(paint);
  const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const object = new Mesh(geo, mat);
  object.renderOrder = 100;
  function setFrame() { /* static */ }
  function dispose() { geo.dispose(); mat.dispose(); tex.dispose(); }
  setFrame();
  return { object, setFrame, frames: FRAMES, dispose };
}

export function create() {
  return buildMesh((g, W, H, fx, fy) => {
    g.fillStyle = '#000';
    g.strokeStyle = '#000';
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // deterministic PRNG so the field looks the same every render
    let s = 0x1a2b3c4d;
    const rnd = () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // ground contour: raised to ~10% (gentle bow down at edges)
    const groundP = u => 0.075 + 0.010 * Math.sin(u * Math.PI);

    // a single tapered, slightly-curved blade rising from (x, baseY)
    const blade = (x, baseY, h, lean, w) => {
      g.beginPath();
      g.moveTo(x - w, baseY);
      g.quadraticCurveTo(x + lean * 0.35, baseY - h * 0.55, x + lean, baseY - h);
      g.quadraticCurveTo(x + lean * 0.20 + w, baseY - h * 0.45, x + w, baseY);
      g.closePath();
      g.fill();
    };

    // a row of fine blades from u0..u1, base following a contour, heights in [hMin,hMax]
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

    // ground band (filled below the contour)
    g.beginPath();
    g.moveTo(0, fy(groundP(0)));
    const steps = 64;
    for (let i = 0; i <= steps; i++) { const u = i / steps; g.lineTo(fx(u), fy(groundP(u))); }
    g.lineTo(W, H + 10); g.lineTo(0, H + 10); g.closePath(); g.fill();

    // fine grass across the whole field
    grassRow(0.00, 1.00, 6, 9, 19, u => fy(groundP(u)));
  });
}
