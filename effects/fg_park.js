// Three-native "Park" foreground -- standalone, inscribed on its own. A pure-black
// silhouette of people watching the show from a park: a fine-grass lawn, one
// Weber-style BBQ, two picnic tables, and solid full-body PEOPLE -- a man grilling,
// a child, and a crowd standing (backs to us) watching the show. Figures are built
// from a filled torso plus thick rounded limbs so they read as real figures.
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
    const pp = dp => H * dp / OVER;   // convert a screen-fraction height to canvas px

    // deterministic PRNG so the lawn looks the same every render
    let s = 0x1a2b3c4d;
    const rnd = () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // ground contour: low so the seated crowd sits above it (grass at their feet)
    const groundP = u => 0.035 + 0.006 * Math.sin(u * Math.PI);
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

    // --- silhouette drawing helpers -------------------------------------
    const poly = (pts, wpx) => {            // thick rounded polyline (a limb)
      g.lineWidth = wpx; g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.stroke();
    };
    const dot = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
    // a tapered filled limb between two joints (half-widths w1->w2) with round ends
    const bone = (x1, y1, x2, y2, w1, w2) => {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      g.beginPath();
      g.moveTo(x1 + nx * w1, y1 + ny * w1);
      g.lineTo(x2 + nx * w2, y2 + ny * w2);
      g.lineTo(x2 - nx * w2, y2 - ny * w2);
      g.lineTo(x1 - nx * w1, y1 - ny * w1);
      g.closePath(); g.fill();
      dot(x1, y1, w1); dot(x2, y2, w2);
    };

    // a realistic standing figure, ~7.5 heads tall, built from tapered limbs with
    // bent arms so negative space opens between arm and torso (reads as a person,
    // not a blob). pose: 'relax'|'hip'|'drink'|'grill'|'point'|'cross'.
    function human(u, h, pose, o) {
      o = o || {}; pose = pose || 'relax';
      const gP = groundP(u);
      const X = off => fx(u) + pp(h * off);
      const Y = fr => fy(gP) - pp(h * fr);
      const W = k => pp(h * k);
      const f = o.faceR === false ? -1 : 1;     // facing dir for asymmetric arm poses
      // legs (slight contrapposto -> visible gap between them) + feet
      const hipL = [X(-0.045), Y(0.47)], hipR = [X(0.045), Y(0.47)];
      const knL = [X(-0.05), Y(0.24)], anL = [X(-0.055), Y(0.02)];
      const knR = [X(0.055), Y(0.235)], anR = [X(0.065), Y(0.02)];
      bone(hipL[0], hipL[1], knL[0], knL[1], W(0.058), W(0.042));
      bone(hipR[0], hipR[1], knR[0], knR[1], W(0.060), W(0.044));
      bone(knL[0], knL[1], anL[0], anL[1], W(0.042), W(0.028));
      bone(knR[0], knR[1], anR[0], anR[1], W(0.044), W(0.030));
      bone(anL[0], anL[1], X(-0.095), Y(0.0), W(0.026), W(0.016));
      bone(anR[0], anR[1], X(0.105), Y(0.0), W(0.028), W(0.018));
      // torso (wide shoulders -> narrow waist), neck, head
      // torso with naturally ROUNDED shoulders (wide rounded top); the round cap
      // stays below the head so a real, thin neck shows between them
      bone(X(0), Y(0.47), X(0), Y(0.80), W(0.072), W(0.092));
      const shL = [X(-0.09), Y(0.80)], shR = [X(0.09), Y(0.80)];
      bone(X(0), Y(0.82), X(o.headDX || 0), Y(0.93), W(0.022), W(0.018));   // thin neck
      dot(X(o.headDX || 0), Y(0.985), W(0.054));                  // head, centered, above shoulders
      // arms: both hang by default; the ACTION arm (on the facing side) takes the
      // pose while the other stays down -- so no figure ever loses an arm
      let elL = [X(-0.115), Y(0.62)], haL = [X(-0.05), Y(0.49)];
      let elR = [X(0.115), Y(0.62)], haR = [X(0.05), Y(0.49)];
      const setArm = (e, hnd) => {
        if (f > 0) { elR = [X(e[0]), Y(e[1])]; haR = [X(hnd[0]), Y(hnd[1])]; }
        else { elL = [X(-e[0]), Y(e[1])]; haL = [X(-hnd[0]), Y(hnd[1])]; }
      };
      if (pose === 'hip') setArm([0.17, 0.64], [0.05, 0.56]);
      else if (pose === 'drink') setArm([0.12, 0.66], [0.03, 0.86]);
      else if (pose === 'point') setArm([0.16, 0.80], [0.31, 0.86]);
      else if (pose === 'grill') {                 // both arms forward to the grill
        setArm([0.14, 0.70], [0.27, 0.60]);
        if (f > 0) { elL = [X(0.07), Y(0.66)]; haL = [X(0.18), Y(0.62)]; }
        else { elR = [X(-0.07), Y(0.66)]; haR = [X(-0.18), Y(0.62)]; }
      } else if (pose === 'cross') {
        elL = [X(-0.105), Y(0.66)]; haL = [X(0.08), Y(0.67)];
        elR = [X(0.105), Y(0.66)]; haR = [X(-0.08), Y(0.67)];
      }
      bone(shL[0], shL[1], elL[0], elL[1], W(0.044), W(0.036));
      bone(shR[0], shR[1], elR[0], elR[1], W(0.046), W(0.038));
      bone(elL[0], elL[1], haL[0], haL[1], W(0.036), W(0.022));
      bone(elR[0], elR[1], haR[0], haR[1], W(0.038), W(0.024));
    }

    // a figure seated on a bench (side view). faceR -> faces +x (toward the table).
    function sitter(u, h, faceR) {
      const gP = groundP(u), d = faceR ? 1 : -1;
      const Xd = off => fx(u) + pp(h * off * d);
      const Y = fr => fy(gP) - pp(h * fr);
      const W = k => pp(h * k);
      const hip = [Xd(-0.02), Y(0.30)], knee = [Xd(0.17), Y(0.29)], ankle = [Xd(0.17), Y(0.02)];
      const neck = [Xd(-0.05), Y(0.60)], headC = [Xd(-0.02), Y(0.76)];
      // thigh (near-horizontal), calf (down), foot
      bone(hip[0], hip[1], knee[0], knee[1], W(0.062), W(0.046));
      bone(knee[0], knee[1], ankle[0], ankle[1], W(0.046), W(0.030));
      bone(ankle[0], ankle[1], Xd(0.23), Y(0.0), W(0.028), W(0.016));
      // torso, neck, head
      bone(hip[0], hip[1], neck[0], neck[1], W(0.078), W(0.072));           // rounded top
      bone(neck[0], neck[1], headC[0], Y(0.715), W(0.023), W(0.019));       // thin neck
      dot(headC[0], headC[1], W(0.054));
      // near arm resting forward toward the table
      bone(Xd(-0.04), Y(0.59), Xd(0.09), Y(0.47), W(0.044), W(0.036));
      bone(Xd(0.09), Y(0.47), Xd(0.19), Y(0.40), W(0.036), W(0.022));
    }

    // flat Weber-style kettle grill on a tripod
    function grill(gx, gr, cyP) {
      const cx = fx(gx), rad = fx(gx + gr) - fx(gx), cy = fy(cyP);
      g.beginPath(); g.ellipse(cx, cy, rad, rad * 0.55, 0, 0, Math.PI); g.fill();
      g.beginPath(); g.ellipse(cx, cy, rad * 0.92, rad * 0.6, 0, Math.PI, Math.PI * 2); g.fill();
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx, cy - rad * 0.6); g.lineTo(cx, cy - rad * 0.6 - pp(0.006)); g.stroke();
      g.beginPath();
      g.moveTo(cx - rad * 0.5, cy + rad * 0.3); g.lineTo(cx - rad * 1.1, fy(0.0));
      g.moveTo(cx + rad * 0.5, cy + rad * 0.3); g.lineTo(cx + rad * 1.1, fy(0.0));
      g.moveTo(cx, cy + rad * 0.45); g.lineTo(cx, fy(0.0));
      g.stroke();
    }

    // side-view picnic table (top, A-frame legs, a bench)
    function table(u, wP) {
      const gP = groundP(u), cx = fx(u), half = pp(wP / 2);
      poly([[cx - half, fy(gP + 0.045)], [cx + half, fy(gP + 0.045)]], pp(0.013));   // top
      poly([[cx - half * 0.8, fy(gP + 0.045)], [cx - half, fy(gP)]], pp(0.011));      // legs
      poly([[cx + half * 0.8, fy(gP + 0.045)], [cx + half, fy(gP)]], pp(0.011));
      poly([[cx - half * 1.1, fy(gP + 0.022)], [cx + half * 1.1, fy(gP + 0.022)]], pp(0.009)); // bench
    }

    // ===================== compose the scene =====================
    grill(0.095, 0.016, 0.082);   // raised so the lid sits about waist height
    table(0.285, 0.085);
    table(0.760, 0.080);

    // man grilling beside the BBQ (faces it on his left, reaching with one arm)
    human(0.150, 0.112, 'grill', { faceR: false });
    human(0.060, 0.072, 'relax', {});                 // a child
    // people seated at the near table (facing each other across it)
    sitter(0.243, 0.110, true);
    sitter(0.332, 0.110, false);
    // a group standing, watching the show in varied natural poses
    human(0.420, 0.107, 'hip', { faceR: true });
    human(0.480, 0.110, 'drink', { faceR: false });
    human(0.540, 0.104, 'relax', {});
    human(0.600, 0.108, 'cross', {});
    // people seated at the far table
    sitter(0.718, 0.110, true);
    sitter(0.805, 0.110, false);
    // two more standing on the right
    human(0.880, 0.108, 'hip', { faceR: false });
    human(0.940, 0.104, 'point', { faceR: true });

    // --- fine grass across the lawn (drawn last so tips overlap the feet) ---
    grassRow(0.00, 1.00, 6, 8, 16, u => fy(groundP(u)));
  });
}
