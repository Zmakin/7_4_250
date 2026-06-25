// Three-native "All Black" background -- standalone, inscribed on its own.
// FRAME-BASED contract (see effects/peony.js). A background spans the whole show
// and has no burst: it's a single full-frame plane drawn behind everything.
// A near-black night sky (faint blue) -- dark enough that the pure-black
// foreground ground band still reads as a darker shadow in front of it.
import { PlaneGeometry, Mesh, MeshBasicMaterial, Color, SRGBColorSpace } from 'three';

export const FPS = 60;
export const FRAMES = 900;                              // 15s show span
export const DURATION = Math.round(FRAMES / FPS * 1000); // 15000
export const PEAK_FRAME = 1;                            // static -> any frame is "the look"

// The camera (fov 50, z=46, look-at y=12) sees a ~42.9-unit square at z=0,
// centred at y=12. Overscan a touch so edges never show.
const VIEW_SPAN = 42.9, VIEW_CENTER_Y = 12, OVER = 1.12;

export function create() {
  const geo = new PlaneGeometry(VIEW_SPAN * OVER, VIEW_SPAN * OVER);
  geo.translate(0, VIEW_CENTER_Y, 0);                   // bake world position (host won't move it)
  const mat = new MeshBasicMaterial({
    // EXACT match to the p5 animations/bg_AllBlack.html: background(25,25,30) --
    // dark navy, deliberately lighter than the pure-black foreground band.
    // setRGB(...,SRGBColorSpace) tags these as sRGB DISPLAY values so the
    // renderer's sRGB output round-trips them unchanged. A bare Color(r,g,b)
    // is treated as LINEAR and gamma-brightens on output -> "too light".
    color: new Color().setRGB(25 / 255, 25 / 255, 30 / 255, SRGBColorSpace),
    depthTest: false, depthWrite: false
  });
  const object = new Mesh(geo, mat);
  object.renderOrder = -100;                            // drawn before the shells
  function setFrame() { /* static */ }
  function dispose() { geo.dispose(); mat.dispose(); }
  setFrame();
  return { object, setFrame, frames: FRAMES, dispose };
}
