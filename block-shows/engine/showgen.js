// showgen.js — generateShow(block, RULESET) -> Builder-importable project JSON.
//
// PURE & DETERMINISTIC: no Date.now(), no Math.random(). Macro params come from
// the block's named fields; every per-object attribute is decided SEPARATELY by a
// specific byte of the block's byte-tape (hash+merkle+prevhash+scalar fields), so
// each value traces to an identifiable datum — no PRNG anywhere. Re-running on the
// same block + RULESET yields byte-identical output. SAME RULESET for every block.
//
// Output object matches Builder.html's project import shape:
//   { name, version:'1.0', timeline:[ …anim ], created }
// and each anim matches the timeline entry shape (Builder.html ~line 1470).

// ---- Base effect durations (ms), copied from Builder.html ANIMATIONS ---------
const BASE_DUR = {
  // bodies
  peony: 2000, chrysanthemum: 2000, palm: 2500, willow: 3000, crossette: 1800,
  strobe: 2000, pistil: 2200, brocade: 2800, dahlia: 2400, fallingleaves: 3200,
  fish: 1200, spider: 1850, cracklingrain: 2400, waterfall: 3000, romancandle: 3000,
  tourbillion: 1800, dragoneggs: 2300,
  // tails
  risingtail: 2000, comet: 2000, palmfrond: 2500,
  // shapes (Builder synthesizes 2200 for all shapes)
  circle: 2200, square: 2200, triangle: 2200, diamond: 2200, star: 2200,
  heart: 2200, rocket: 2200, bitcoin: 2200,
};

// ---- The single, global ruleset (tune these; same for every block) -----------
export const DEFAULT_RULESET = {
  CANVAS: 576,
  // Show length: triangular over [SHOW_MIN, SHOW_MAX] with the mode at
  // SHOW_MODE — most shows land near the mode (10–13s), 15s is the rare long
  // tail, sub-8s the rare short tail.
  SHOW_MIN: 7000, SHOW_MAX: 15000, SHOW_MODE: 11800,
  HARD_CAP: 15000, END_PAD: 500,   // showEnd = lastBurstEnd + END_PAD (Builder's loop rule)

  TX_REF: 2500,            // tx_count that reads as "very busy" (log-compressed)
  BURSTS_PER_SEC: 2.8,     // base density (more shells than v1)
  N_MIN: 14, N_MAX: 64,

  START_PAD: 250,          // ms before first shell
  P_TAIL: 0.55,            // chance a body gets a rising tail
  P_SHAPE: 0.08,           // chance a shell is a shape accent (vs body)
  TAIL_GAP_MAX: 150,       // ms blank delay between tail apex and burst (delayed trigger)

  // 2D placement: each object's x and y are SEPARATELY decided by its own block
  // byte (uniform across the sky rectangle), so bursts spread across the screen.
  // Tail (if any) shares the body's exact (x,y) — the tail climbs UP to the burst
  // point (effect's end == placement), so they line up.
  X_MARGIN: 38, SKY_MIN: 56, SKY_MAX: 392,

  // rotation (degrees). Bodies spin a little; tails swing their launch angle, and
  // the ~20% of bytes in the extremes come in steeply from the corners.
  BODY_ROT_MAX: 24, TAIL_ROT_MAX: 28, TAIL_CORNER_MAX: 62,

  // scale (mapped from each object's scale byte 0..255).
  SCALE_MIN: 0.6, SCALE_MAX: 2.0, SCALE_SKEW: 1.5,
  FINALE_MS: 1800, FINALE_SCALE: 0.3,
  SCALE_CLAMP_MIN: 0.5, SCALE_CLAMP_MAX: 2.2,

  // ---- Per-object byte-tape assignment -----------------------------------------
  // Every per-object attribute of shell i reads block byte tape[(o + i*s)]. Strides
  // are ODD (coprime with the 128-byte power-of-two tape), so the first ~128 shells
  // each read a DISTINCT block byte for that attribute. The tape itself is the
  // block's real consensus bytes: hash(32)+merkle(32)+prevhash(32)+nonce,bits,
  // version,timestamp,mediantime,size,weight,tx_count (8×4) = 128 bytes.
  TAPE: {
    isShape:  { o: 0,  s: 3 },
    typePick: { o: 1,  s: 5 },
    speed:    { o: 2,  s: 7 },
    tail:     { o: 3,  s: 9 },
    tailType: { o: 4,  s: 11 },
    x:        { o: 5,  s: 13 },
    y:        { o: 6,  s: 15 },
    rot:      { o: 7,  s: 17 },
    tailRot:  { o: 8,  s: 19 },
    scale:    { o: 9,  s: 21 },
    gap:      { o: 10, s: 23 },
    startJit: { o: 11, s: 25 },
    hue:      { o: 12, s: 27 },
    hueJit:   { o: 13, s: 29 },
    sat:      { o: 14, s: 31 },
    light:    { o: 15, s: 33 },
    hue2:     { o: 16, s: 35 },
  },

  HUE_RECENT: 4, HUE_MIN_SEP: 25, GOLDEN: 137.5, // colour diversity guard
  NAVY_THRESHOLD: 64,      // (legacy) hashByte[1] < this -> navygradient else allblack

  // Background选: weighted pick from hash byte hb[1]. Night skies (stars/moon)
  // dominate; the Deep-Space window is the rare one. Moon skies still always show
  // stars -- whether the MOON itself appears depends on the block's mine time.
  BG_WEIGHTS: {
    allblack: 17, navygradient: 17,
    starsblack: 16, starsnavy: 16,
    moonblack: 14, moonnavy: 14,
    space: 4,               // rarest (~3%)
  },
  // Stylised moon (see computeMoon): all July-4 blocks are EDT (UTC-4).
  MOON_TZ_OFFSET: -4,       // EDT hours from UTC
  MOON_CENTER_PLATEAU: 1.5, // hours either side of transit the moon "holds" centre

  // Term word-firework: chosen from a Bitcoin byte (hb[3]) across this list so it
  // varies block-to-block but is fully deterministic. (May be the same word for the
  // whole run -- that's fine per spec.) Set TERM_ENABLE false to drop all terms.
  TERM_ENABLE: true,
  TERMS: ['america250', 'seven4250', 'happy4th', 'usa', 'happy250th'],
  TERM_DURATION: 3500,      // rise + burst + 2.0s of held text (matches term.js)
  TERM_LEAD: 3500,          // start = showEnd - this, so the 2s of text ends at the loop

  // body weight table (crowd-pleasers up, novelty down)
  BODY_WEIGHTS: {
    peony: 10, chrysanthemum: 9, willow: 8, brocade: 7, dahlia: 7,
    pistil: 6, crossette: 6, palm: 6, spider: 5, strobe: 5, cracklingrain: 5,
    dragoneggs: 4, romancandle: 4, waterfall: 4, fallingleaves: 4,
    tourbillion: 3, fish: 2,
  },
  SHAPE_WEIGHTS: {
    bitcoin: 5, circle: 4, star: 4, heart: 2, diamond: 2, triangle: 2, rocket: 2, square: 1,
  },
  SPEEDS: [0.6, 0.8, 0.9, 1.0, 1.0, 1.0, 1.1, 1.2, 1.4], // biased to ~1.0

  // palette hue offsets from H0
  SCHEMES: {
    analogous:     [0, 30, -30, 15, -15],
    complementary: [0, 180, 30, 150],
    triadic:       [0, 120, 240, 60],
    tetradic:      [0, 90, 180, 270],
    split:         [0, 150, 210, 30],
  },
};

// ---- helpers -----------------------------------------------------------------
function hexBytes(hex) {
  const out = [];
  for (let i = 0; i + 1 < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}
function u32be(n) { n = n >>> 0; return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;

// inverse-CDF triangular sample: u in [0,1], mode in (0,1) -> value in [0,1]
function triangular(u, mode) {
  return u < mode ? Math.sqrt(u * mode) : 1 - Math.sqrt((1 - u) * (1 - mode));
}

function weightedPick(weights, r) {
  const keys = Object.keys(weights);
  let total = 0; for (const k of keys) total += weights[k];
  let x = r * total;
  for (const k of keys) { x -= weights[k]; if (x <= 0) return k; }
  return keys[keys.length - 1];
}
function snapSpeed(v) { return clamp(Math.round(v * 10) / 10, 0.5, 2.0); }

// Stylised moon model (lightweight, deterministic). From the block's UTC unix
// timestamp compute:
//   phase  = the renderer's phase-SLIDER value 0..1 (NOT raw illum). 0.5 = FULL;
//            either extreme = NEW. The right half (>0.5) is WAXING (lit limb right),
//            the left half (<0.5) is WANING (lit limb left). Encodes the accurate
//            synodic illum fraction + waxing/waning so bg_starfield renders it right.
//   prog   = position along the screen arc 0(east/rise, screen-left) .. 0.5(centre apex)
//            .. 1(west/set, screen-right), with a ~3h "hold" at centre,
//   visible= whether the moon was above the horizon at the block's EDT mine time
//            (so some blocks legitimately show NO moon).
const SYNODIC = 29.530588853;                 // days
const REF_NEW_MOON_JD = 2451550.1;            // 2000-01-06 18:14 UTC (a known new moon)
function computeMoon(unixSec, tzOffsetHours, plateauH) {
  const jd = unixSec / 86400 + 2440587.5;     // unix -> Julian Date
  let p = ((jd - REF_NEW_MOON_JD) / SYNODIC) % 1; if (p < 0) p += 1;  // 0=new,0.5=full
  const illum = (1 - Math.cos(2 * Math.PI * p)) / 2;                  // illuminated fraction
  // Map to the slider value: waxing (p<0.5, lit limb right) -> right half [0.5,1];
  // waning (p>=0.5, lit limb left) -> left half [0,0.5]; full -> 0.5, new -> extreme.
  const phase = p < 0.5 ? 1 - illum / 2 : illum / 2;
  // local EDT hour-of-day
  const localH = (((unixSec / 3600) + tzOffsetHours) % 24 + 24) % 24;
  // moonrise drifts with phase: new ~6:00 (rises with sun), full ~18:00 (rises at dusk)
  const riseH = (p * 24 + 6) % 24;
  let sinceRise = (localH - riseH + 24) % 24;  // hours since the moon rose (0..24)
  const visible = sinceRise <= 12;             // up for ~12h
  // prog across the transit with a centre plateau (~2*plateauH hours held at apex)
  const dt = sinceRise - 6;                    // -6..+6 around transit
  let prog;
  const ad = Math.abs(dt);
  if (ad <= plateauH) prog = 0.5;
  else prog = 0.5 + Math.sign(dt) * 0.5 * ((ad - plateauH) / (6 - plateauH));
  return { phase: +phase.toFixed(3), prog: +clamp(prog, 0, 1).toFixed(3), visible };
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return '#' + to(r) + to(g) + to(b);
}

// ---- the engine --------------------------------------------------------------
export function generateShow(block, RULESET = DEFAULT_RULESET) {
  const R = RULESET;
  const hb = hexBytes(block.hash);
  const mb = hexBytes(block.merkle_root);

  // Block byte-tape: the block's real consensus bytes. Every per-object attribute
  // is decided SEPARATELY for each shell by a specific byte of this tape, so each
  // value traces to an identifiable datum (no opaque PRNG). 128 bytes:
  // hash(32)+merkle(32)+prevhash(32)+nonce,bits,version,timestamp,mediantime,size,
  // weight,tx_count (8×4).
  const tape = hb.concat(
    mb, hexBytes(block.prev || ''),
    u32be(block.nonce), u32be(block.bits), u32be(block.version),
    u32be(block.timestamp), u32be(block.mediantime || block.timestamp),
    u32be(block.size), u32be(block.weight), u32be(block.tx_count)
  );
  const tapeAt = (k) => tape[((k % tape.length) + tape.length) % tape.length]; // 0..255
  const B = (attr, i) => { const t = R.TAPE[attr]; return tapeAt(t.o + i * t.s); }; // 0..255
  const Bf = (attr, i) => B(attr, i) / 255;                                          // 0..1

  // ----- macro: length, density, palette, background -----
  // length: triangular driven by the nonce (uniform across all eras), mode ~11.8s
  const uLen = (block.nonce >>> 0) / 4294967296;
  const modeFrac = (R.SHOW_MODE - R.SHOW_MIN) / (R.SHOW_MAX - R.SHOW_MIN);
  const L = Math.round(R.SHOW_MIN + triangular(uLen, modeFrac) * (R.SHOW_MAX - R.SHOW_MIN));
  const targetBurstEnd = Math.min(L, R.HARD_CAP) - R.END_PAD; // last burst ends here -> showEnd ~ L

  const txN = Math.log2(1 + (block.tx_count || 0)) / Math.log2(1 + R.TX_REF);
  const densityFactor = 0.8 + 0.5 * Math.min(txN, 1.4);
  const N = clamp(Math.round((L / 1000) * R.BURSTS_PER_SEC * densityFactor), R.N_MIN, R.N_MAX);

  const cadenceClustered = hb[0] / 255;                 // 0 even .. 1 clustered+finale
  const feesRatio = block.reward > 0 ? clamp((block.totalFees || 0) / block.reward, 0, 1) : 0;
  const finaleStrength = clamp(feesRatio * 6, 0, 1);

  const H0 = ((mb[0] << 8) | mb[1]) % 360;
  const schemeNames = Object.keys(R.SCHEMES);
  const scheme = R.SCHEMES[schemeNames[mb[2] % schemeNames.length]];
  const satBase = 70 + (mb[3] / 255) * 30;
  const lightBase = 45 + (mb[4] / 255) * 15;
  // weighted background pick. NB: real block HASHES have many leading ZERO bytes
  // (proof-of-work), so hb[0..~10] are all 0 -> useless for selection. Use the
  // merkle_root bytes (mb), which are uniformly random, for the night-sky picks.
  const bgType = weightedPick(R.BG_WEIGHTS, mb[8] / 256);
  const bgIsStar = bgType === 'starsblack' || bgType === 'starsnavy' || bgType === 'moonblack' || bgType === 'moonnavy';
  const bgHasMoon = bgType === 'moonblack' || bgType === 'moonnavy';
  // compass facing for star/moon skies (real constellations rotate with mb[9])
  const bgFacing = bgIsStar ? Math.round((mb[9] / 255) * 360) : null;
  // moon phase/position/visibility from the block's mine time
  const moon = bgHasMoon ? computeMoon(block.timestamp || 0, R.MOON_TZ_OFFSET, R.MOON_CENTER_PLATEAU) : null;

  // colour: each object's hue/sat/light decided by its own block bytes, then a
  // golden-angle diversity guard prevents same-hue runs (no drowned-out monochrome).
  const recent = [];
  function hueFor(i, hueAttr) {
    let hue = H0 + scheme[B(hueAttr, i) % scheme.length] + (Bf('hueJit', i) - 0.5) * 24;
    hue = ((hue % 360) + 360) % 360;
    for (let g = 0; g < 8; g++) {
      if (!recent.some((h) => Math.abs(((hue - h + 540) % 360) - 180) < R.HUE_MIN_SEP)) break;
      hue = (hue + R.GOLDEN) % 360;
    }
    recent.push(hue); if (recent.length > R.HUE_RECENT) recent.shift();
    return hue;
  }
  function colorFor(i, hueAttr) {
    const s = clamp(satBase + (Bf('sat', i) - 0.5) * 16, 55, 100);
    const l = clamp(lightBase + (Bf('light', i) - 0.5) * 14, 40, 65);
    return hslToHex(hueFor(i, hueAttr), s, l);
  }

  // ----- schedule N body start times over [START_PAD, targetBurstEnd] -----
  // base cadence is even (clustered later when cadenceClustered is high); each
  // shell's local jitter is decided by its own block byte.
  const window = targetBurstEnd - R.START_PAD;
  const starts = [];
  for (let i = 0; i < N; i++) {
    const frac = (i + 0.5) / N;
    const fracC = mix(frac, Math.pow(frac, 1.6), cadenceClustered * 0.6);
    const jitter = (Bf('startJit', i) - 0.5) * (1 / N) * (1 + cadenceClustered);
    starts.push(R.START_PAD + clamp(fracC + jitter, 0, 1) * window);
  }
  starts.sort((a, b) => a - b);

  // ----- build entries -----
  const timeline = [];
  let idSeq = block.height * 1000;
  const bgEntry = {
    type: bgType, category: 'background', subType: null, shape: null,
    color: null, color2: null, speed: 1,
    x: R.CANVAS / 2, y: R.CANVAS / 2, scale: 1, rotation: 0,
    startTime: 0, freeze: 'first', startFrame: 0, duration: L, id: idSeq++,
  };
  // star/moon sky params (the Builder threads these into bg_starfield.js)
  if (bgFacing != null) bgEntry.facing = bgFacing;
  if (moon) { bgEntry.moonPhase = moon.phase; bgEntry.moonProg = moon.prog; bgEntry.moonVisible = moon.visible; }
  timeline.push(bgEntry);

  let lastBurstEnd = 0;
  for (let i = 0; i < N; i++) {
    // ---- every attribute below reads its OWN block byte (see RULESET.TAPE) ----
    const isShape = B('isShape', i) < R.P_SHAPE * 255;
    const type = weightedPick(isShape ? R.SHAPE_WEIGHTS : R.BODY_WEIGHTS, Bf('typePick', i));
    const speed = snapSpeed(R.SPEEDS[Math.min(R.SPEEDS.length - 1, Math.floor(Bf('speed', i) * R.SPEEDS.length))]);
    const bodyDur = BASE_DUR[type] / speed;

    // tail decision (its own byte)
    let hasTail = Bf('tail', i) < (isShape ? R.P_TAIL * 0.4 : R.P_TAIL);
    let tailType = null;
    if (hasTail) tailType = type === 'palm' ? 'palmfrond' : (Bf('tailType', i) < 0.25 ? 'comet' : 'risingtail');

    // 2D position: x and y each from their own byte; tail + body co-located at the
    // burst point (the tail climbs UP to it, so they line up).
    const x = R.X_MARGIN + Bf('x', i) * (R.CANVAS - 2 * R.X_MARGIN);
    const burstY = R.SKY_MIN + Bf('y', i) * (R.SKY_MAX - R.SKY_MIN);

    // rotation: body spin from its byte; tail launch-angle from its byte (extreme
    // ~20% of bytes => steep "corner" entries up to TAIL_CORNER_MAX).
    const bodyRot = (Bf('rot', i) * 2 - 1) * R.BODY_ROT_MAX;
    let tailRot = 0;
    if (hasTail) {
      const tn = Bf('tailRot', i) * 2 - 1;
      tailRot = tn * (Math.abs(tn) > 0.8 ? R.TAIL_CORNER_MAX : R.TAIL_ROT_MAX);
    }

    // body start (clamped so it ENDS by the target / cap -> showEnd tracks L)
    let bodyStart = clamp(starts[i], R.START_PAD, Math.min(targetBurstEnd - bodyDur, R.HARD_CAP - bodyDur));

    // tail timing: climbs to the burst point, body fires at the apex (+ blank gap)
    let tailStart = 0, tailDur = 0;
    if (hasTail) {
      tailDur = BASE_DUR[tailType] / speed;
      const gap = Bf('gap', i) * R.TAIL_GAP_MAX;
      tailStart = bodyStart - tailDur - gap;
      if (tailStart < 0) { hasTail = false; tailType = null; } // no room -> aerial (never a tail without a body)
    }

    // scale: from this object's scale byte (big byte => big "feature" shell);
    // finale add-on is data-driven (fees ratio).
    const inFinale = bodyStart >= (targetBurstEnd - R.FINALE_MS);
    let scale = R.SCALE_MIN + Math.pow(Bf('scale', i), R.SCALE_SKEW) * (R.SCALE_MAX - R.SCALE_MIN);
    if (inFinale) scale += R.FINALE_SCALE * (0.5 + 0.5 * finaleStrength);
    scale = clamp(scale, R.SCALE_CLAMP_MIN, R.SCALE_CLAMP_MAX);

    const color = colorFor(i, 'hue');
    const color2 = type === 'pistil' ? colorFor(i, 'hue2') : null;

    if (hasTail) {
      timeline.push({
        type: tailType, category: 'tail', subType: null, shape: null,
        color, color2: null, speed,
        x, y: burstY, scale: clamp(scale, 0.7, 1.6), rotation: +tailRot.toFixed(1),
        startTime: Math.round(tailStart), freeze: 'first', startFrame: 0,
        duration: tailDur, id: idSeq++,
      });
    }

    timeline.push({
      type, category: isShape ? 'shape' : 'body', subType: null,
      shape: isShape ? type : null,
      color, color2, speed,
      x, y: burstY, scale: +scale.toFixed(3), rotation: +bodyRot.toFixed(1),
      startTime: Math.round(bodyStart), freeze: 'first', startFrame: 0,
      duration: bodyDur, id: idSeq++,
    });
    lastBurstEnd = Math.max(lastBurstEnd, bodyStart + bodyDur);
  }

  const showEnd = Math.min(Math.round(lastBurstEnd) + R.END_PAD, R.HARD_CAP);
  bgEntry.duration = showEnd;

  // TERM word-firework: a scaled palm-frond tail rises to top-centre then explodes
  // into a sparkling 4th-of-July word. Chosen from a Bitcoin byte (merkle mb[10],
  // not the leading-zero hash); timed so it lands in the final ~2s and holds
  // through the loop (excluded from showEnd).
  if (R.TERM_ENABLE) {
    const termType = R.TERMS[mb[10] % R.TERMS.length];
    const termStart = Math.max(0, showEnd - R.TERM_LEAD);
    timeline.push({
      type: termType, category: 'term', subType: null, shape: null,
      color: colorFor(0, 'hue'), color2: null, speed: 1,
      x: R.CANVAS / 2, y: R.CANVAS / 2, scale: 1, rotation: 0,
      startTime: termStart, freeze: 'first', startFrame: 1,
      duration: R.TERM_DURATION, id: idSeq++,
    });
  }

  timeline.sort((a, b) => a.startTime - b.startTime);

  return {
    name: `BTC ${block.height} · ${(block.iso || '').slice(0, 10)}`,
    version: '1.0',
    created: block.iso || null,
    block: { height: block.height, hash: block.hash, year: block.iso ? +block.iso.slice(0, 4) : null },
    meta: { showEnd, lengthTarget: L, bursts: N, palette: { H0, scheme: schemeNames[mb[2] % schemeNames.length] } },
    timeline,
  };
}

// in-app overlay convenience
if (typeof window !== 'undefined') {
  window.BlockShow = { generateShow, DEFAULT_RULESET };
}
