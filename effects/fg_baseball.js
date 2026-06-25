// Three-native "Baseball Field" foreground -- standalone, inscribed on its own.
// A pure-black silhouette of a local school ball field seen from behind home
// plate: fine grass across the whole bottom, a small grassy pitcher's mound in
// the centre, a DOMED CHAINLINK BACKSTOP on the left (wood slats across its
// middle to stop foul balls, tall grass at its base) and a tall LIGHT POLE on
// the right with two floodlight ballasts hanging from a crossarm (+ a tiny grass
// tuft at its base). The chainlink diamonds stay transparent so the show reads
// through them. Small, for scale reference against the show behind it.
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

    // ground contour: very gentle bow down at edges (nearly flat)
    const groundP = u => 0.040 + 0.008 * Math.sin(u * Math.PI);

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

    // --- ground band (filled below the contour) ---
    g.beginPath();
    g.moveTo(0, fy(groundP(0)));
    const steps = 64;
    for (let i = 0; i <= steps; i++) { const u = i / steps; g.lineTo(fx(u), fy(groundP(u))); }
    g.lineTo(W, H + 10); g.lineTo(0, H + 10); g.closePath(); g.fill();

    // --- small grassy pitcher's mound (60% of the way from centre toward the backstop) ---
    const mU = 0.27, mW = 0.028, mPeak = 0.010;
    const mGround = groundP(mU);
    const moundP = u => {                          // contour of the mound surface
      const d = (u - mU) / mW;
      return mGround + (Math.abs(d) < 1 ? mPeak * (1 - d * d) : 0);
    };
    g.beginPath();
    g.moveTo(fx(mU - mW), fy(mGround));
    for (let i = 0; i <= 32; i++) { const u = mU - mW + (2 * mW) * (i / 32); g.lineTo(fx(u), fy(moundP(u))); }
    g.lineTo(fx(mU + mW), fy(mGround)); g.closePath(); g.fill();

    // ====================================================================
    //  LIGHT POLE on the right: tall post, crossarm, two hanging floodlights
    // ====================================================================
    const poleU = 0.855, poleBaseP = 0.040, poleTopP = 0.355;
    const px = fx(poleU);
    g.lineWidth = 7;
    g.beginPath(); g.moveTo(px, fy(poleBaseP)); g.lineTo(px, fy(poleTopP)); g.stroke();
    // crossarm
    const armL = 0.826, armR = 0.884, armP = poleTopP - 0.006;
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(fx(armL), fy(armP)); g.lineTo(fx(armR), fy(armP)); g.stroke();
    // a floodlight ballast hanging from the arm at u
    const ballast = (u) => {
      const x = fx(u), yArm = fy(armP), yHang = fy(armP - 0.010), yBot = fy(armP - 0.030);
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, yArm); g.lineTo(x, yHang); g.stroke();   // hanger
      const w = fx(u + 0.014) - x;                                         // floodlight head (flares down)
      g.beginPath();
      g.moveTo(x - w * 0.45, yHang);
      g.lineTo(x + w * 0.45, yHang);
      g.lineTo(x + w, yBot);
      g.lineTo(x - w, yBot);
      g.closePath(); g.fill();
    };
    ballast(0.838);
    ballast(0.872);

    // ====================================================================
    //  ANGULAR CHAINLINK BACKSTOP on the left -- 3 straight panels with an
    //  angled hood (left slope + flat top + right slope) rather than a hoop.
    //  Short: the hood top sits just above the top wood board.
    // ====================================================================
    const bsL = 0.045, bsR = 0.200;            // wider -> squatter
    const bsBaseP = 0.040, bsWallP = 0.150, bsTopP = 0.173;   // wall top, then hood ~20% above top board
    const xL = fx(bsL), xR = fx(bsR);
    const xLi = fx(bsL + 0.030), xRi = fx(bsR - 0.030);       // hood inset (planes meet above)
    const yBase = fy(bsBaseP), yWall = fy(bsWallP), yTop = fy(bsTopP);
    // 3 side-viewed panels: left narrow (far wing), centre medium, right widest (near/straight-on).
    // upper posts angle slightly inward at top so the centre upper bay is a trapezoid, not a triangle.
    const span = bsR - bsL;
    const p1 = bsL + span * 0.22, p2 = bsL + span * 0.56;   // batter's box = centre panel
    const p1t = p1 + span * 0.04, p2t = p2 - span * 0.04;   // slightly-inset upper-post tops
    // outline path (reused for clip + frame stroke)
    const outline = () => {
      g.beginPath();
      g.moveTo(xL, yBase);
      g.lineTo(xL, yWall);     // left post
      g.lineTo(xLi, yTop);     // left hood plane
      g.lineTo(xRi, yTop);     // flat top hood plane
      g.lineTo(xR, yWall);     // right hood plane
      g.lineTo(xR, yBase);     // right post
    };
    // chainlink mesh: thin diagonal cross-hatch, transparent diamonds between
    g.save();
    outline(); g.closePath(); g.clip();
    g.lineWidth = 2; g.globalAlpha = 0.8;
    const meshPx = (xR - xL) / 16;
    for (let k = -26; k < 52; k++) {
      g.beginPath(); g.moveTo(xL + k * meshPx, yTop - 50); g.lineTo(xL + (k + 20) * meshPx, yBase + 40); g.stroke();
      g.beginPath(); g.moveTo(xL + k * meshPx, yBase + 40); g.lineTo(xL + (k + 20) * meshPx, yTop - 50); g.stroke();
    }
    g.globalAlpha = 1;
    // --- 4 wood boards across the LOWER HALF of the CENTRE panel only (batter's box) ---
    const slatXL = fx(p1) + 4, slatW = fx(p2) - fx(p1) - 8;
    for (const sp of [0.054, 0.073, 0.092, 0.111]) {
      const y = fy(sp), th = fy(sp - 0.011) - y;
      g.fillRect(slatXL, y, slatW, th);
    }
    g.restore();
    // solid frame: posts + angular hood
    g.lineWidth = 5;
    outline(); g.stroke();
    // horizontal top rail across the vertical plane (separates wall from the hood that hangs out)
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(xL, yWall); g.lineTo(xR, yWall); g.stroke();
    // 2 interior posts: lower vertical part, then continuing up through the hood (angled in)
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(fx(p1), yBase); g.lineTo(fx(p1), yWall); g.lineTo(fx(p1t), yTop);
    g.moveTo(fx(p2), yBase); g.lineTo(fx(p2), yWall); g.lineTo(fx(p2t), yTop);
    g.stroke();

    // ====================================================================
    //  GRASS (drawn last so blade tips overlap the bases of the structures)
    // ====================================================================
    // fine grass across the whole field
    grassRow(0.00, 1.00, 6, 9, 19, u => fy(groundP(u)));
    // grass on the pitcher's mound (small)
    grassRow(mU - mW, mU + mW, 4, 8, 14, u => fy(moundP(u)));
    // tall grass at the base of the backstop
    grassRow(bsL - 0.01, bsR + 0.01, 4, 20, 40, u => fy(groundP(u)));
    // tiny grass tuft at the base of the light pole
    grassRow(poleU - 0.018, poleU + 0.018, 4, 16, 30, u => fy(groundP(u)));
  });
}
