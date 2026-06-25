// Three-native "Navy Gradient" background -- standalone, inscribed on its own.
// Full-frame plane, navy at the BOTTOM smoothly darkening to near-black at the
// TOP. The Three counterpart of animations/bg_NavyGradient.html, now restoring
// that file's per-pixel DITHERED wash so the dark gradient stays smooth at any
// screen size instead of showing 8-bit "banding rectangles".
import { PlaneGeometry, Mesh, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, LinearFilter } from 'three';

export const FPS = 60;
export const FRAMES = 900;                               // 15s show span
export const DURATION = Math.round(FRAMES / FPS * 1000); // 15000
export const PEAK_FRAME = 1;                             // static

const VIEW_SPAN = 42.9, VIEW_CENTER_Y = 12, OVER = 1.12;

function gradientTexture() {
  // Tall, high-res texture so the gradient has hundreds of distinct steps and
  // the baked dither survives upscaling on big screens. (createLinearGradient's
  // 9 stops on a 4x256 canvas was the source of the banding.)
  const W = 32, H = 2048;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  // smoothstep-eased stops, EXACT match to the p5 animations/bg_NavyGradient.html
  // endpoints: near-black at the top easing to navy at the horizon.
  // CanvasTexture flipY (default true) -> canvas top (y=0) maps to plane top.
  const top = [1, 3, 10], bot = [0, 22, 56];
  for (let y = 0; y < H; y++) {
    const u = y / (H - 1);
    const e = u * u * (3 - 2 * u);                       // smoothstep
    const r0 = top[0] + (bot[0] - top[0]) * e;
    const g0 = top[1] + (bot[1] - top[1]) * e;
    const b0 = top[2] + (bot[2] - top[2]) * e;
    for (let x = 0; x < W; x++) {
      // Triangular-PDF dither (~+/-1.5 LSB), decorrelated per pixel. Perturbing
      // each channel before the 8-bit round breaks the hard quantization steps
      // into noise the eye averages out -> a smooth navy->black wash.
      const d = (Math.random() + Math.random() - 1) * 1.5;
      const i = (y * W + x) * 4;
      img.data[i]     = Math.max(0, Math.min(255, Math.round(r0 + d)));
      img.data[i + 1] = Math.max(0, Math.min(255, Math.round(g0 + d)));
      img.data[i + 2] = Math.max(0, Math.min(255, Math.round(b0 + d)));
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  // Tag the canvas data as sRGB DISPLAY values so the renderer's sRGB output
  // round-trips them unchanged (matching the p5 wash). An untagged map is
  // treated as LINEAR and gamma-brightens on output -> "too light".
  tex.colorSpace = SRGBColorSpace;
  // Plain bilinear, NO mipmaps: mip averaging would blur away the dither and
  // re-introduce banding on downscale.
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

export function create() {
  const geo = new PlaneGeometry(VIEW_SPAN * OVER, VIEW_SPAN * OVER);
  geo.translate(0, VIEW_CENTER_Y, 0);
  const tex = gradientTexture();
  const mat = new MeshBasicMaterial({ map: tex, depthTest: false, depthWrite: false });
  const object = new Mesh(geo, mat);
  object.renderOrder = -100;                             // drawn before the shells
  function setFrame() { /* static */ }
  function dispose() { geo.dispose(); mat.dispose(); tex.dispose(); }
  setFrame();
  return { object, setFrame, frames: FRAMES, dispose };
}
