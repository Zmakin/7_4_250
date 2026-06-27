# Bitcoin Ordinals Fireworks Builder

A browser-based tool for composing fireworks shows inscribed on Bitcoin. Every animation, background, and effect runs entirely on-chain — no servers, no downloads. Use the live builder at the link below to design your own show, or explore shows generated from real Bitcoin block data.

**[Open the Builder →](https://zmakin.github.io/7_4_250/)**

---

## What It Is

The builder lets you place fireworks effects on a canvas and arrange them on a timeline. When you're happy with the result, you export a single self-contained HTML file that loads everything directly from Bitcoin (via ordinals.com) — no external dependencies.

The project also includes the **⚡ Block Builder**, which generates fireworks shows deterministically from real July 4th Bitcoin block data (2009–2025). Every field in the block — the merkle root, nonce, transaction count, mine timestamp — maps to something in the show: the color palette, shell types, timing, background sky, foreground scene, and more.

---

## Using the Builder

### The Canvas

The large square in the center is your stage. Click anywhere on it to place the selected effect at that position. The placement dot shows where the effect will burst.

- **Center dot** — the burst point; drag to reposition after placing

### The Timeline

The timeline on the left lists every element in your show in order. Click any entry to select it and edit its properties. Drag entries to reorder them. The **▶ Play** button previews the full show.

### Adding Effects

Use the dropdowns on the right side to pick what to place next:

| Category | What it does |
|---|---|
| **Background** | Full-sky backdrop — star field, moon sky, deep space, navy gradient, or all black. Spans the whole show. |
| **Tail** | The rising trail before a burst — comet arc, straight rising tail, or palm frond climb. Place it at the burst point; it launches upward from there. |
| **Body** | The burst itself — peony, willow, chrysanthemum, brocade, palm, dragoneggs, and many more. This is the main firework. |
| **Shape** | A burst shaped like a star, heart, bitcoin symbol, rocket, etc. |
| **Foreground** | A silhouette scene drawn in front of everything — baseball field, lakeside dock, football stadium, park crowd, or a plain dark ground band. |
| **Term** | A word-firework finale. A rising trail explodes into animated text: *america250*, *happy4th*, *usa*, and others. Always placed near the end of the show. |

**Tip:** Tails and bodies go together — place the tail first at the burst point, then place the body at the same point. The tail automatically climbs up to where the body fires.

### Effect Options

After selecting a category the panel shows controls for that effect:

- **Color** — the burst color (or two colors for effects like Pistil)
- **Speed** — how fast the animation plays (0.5× slow-motion to 2× fast)
- **Scale** — how large the burst is
- **Rotation** — spin the burst or tilt the tail's launch angle

### The Preview Window

The square on the right side of the stage is the **global preview** — it plays the full show from the beginning, looping. Use it to judge the whole composition while you work.

- **Spacebar** — freeze the global preview at the current frame
- The three freeze-point buttons below the preview step through the key moments of the selected effect (start, peak, end)

---

## The ⚡ Block Builder

The Block Builder panel (top of the left column) generates complete shows from real Bitcoin block data. Every show is fully deterministic — the same block always produces the exact same show.

### How to use it

1. Click **Generate** to load the current block's show into the timeline
2. Use **◀ ▶** to step through the time ascending list of 2,268 July 4th blocks starting in 2009
3. Click **🎲** to jump to a random block
4. Type a block height directly into the height box and press Enter
5. Hit **▶ Play** on the timeline to watch the show

### What the block data controls

| Block field | What it drives |
|---|---|
| **Nonce** | Show length (7–15 seconds, most land near 12s) |
| **Transaction count** | Number of shells (more txs = denser show) |
| **Merkle root** | Color palette — base hue, scheme (analogous, triadic, complementary…), saturation |
| **Merkle root** | Background sky type and star-field orientation |
| **Merkle root** | Foreground scene |
| **Timestamp** | Moon phase and position (for star/moon backgrounds) |
| **Hash** | Cadence — how evenly spaced vs clustered the bursts are |
| **Fees/reward ratio** | Finale intensity — higher fee pressure = bigger closing shells |
| **Per-shell bytes** | Every individual shell's type, color, position, scale, rotation, tail, and timing |

**[Open the Builder →](https://zmakin.github.io/7_4_250/)**

### Background skies

Star fields and moon skies dominate (they're the most common July 4th setting). Deep Space — pure black with visible planets along the ecliptic — is the rarest option (~3% of blocks). Whether the moon appears depends on what time the block was actually mined: some blocks were mined during the day in the United States and legitimately show no moon.

### Foreground scenes

The foreground is drawn from the merkle root, so any block in any year can get any scene:

- **Baseball field** — hometown ballpark with backstop, light pole, and chainlink
- **Lakeside** — dock, Adirondack chairs, calm water
- **Football stadium** — bleachers and goalposts
- **Park** — crowd silhouettes with trees and benches
- **Black overlay** — minimal grassy band
- Some blocks get no foreground at all

---

## Exporting a Show

When your show is ready, click **Export Inscription** at the bottom of the builder.

This generates a single `.html` file that:
- Loads Three.js, the bloom renderer, and every effect module directly from their Bitcoin inscription IDs
- Has no dependency on this builder, GitHub, or any server
- Loops forever, runs entirely on-chain when itself inscribed on Bitcoin
- Is safely sent my a backende server with per wallet address determinism and recollection
- You can Save up to 3 shows to work on at any time but Export only 1 timeline for final inscription

The exported file is self-contained and ready to inscribe. Working with Ord-Drops.xyz this will be solely available to the wallet that submitted the exported file, or they may choose from a curated list st mint time.

---

**[Open the Builder →](https://zmakin.github.io/7_4_250/)**

## Browser Requirements

Any modern desktop browser works — Chrome, Firefox, Edge, Safari. The builder uses WebGL (Three.js) and Web Audio. Mobile browsers work for viewing but the canvas interaction is designed for mouse/pointer input.

---

## On-Chain Libraries

The builder and all exported shows load their dependencies from Bitcoin. The inscribed library set:

| What | Inscription |
|---|---|
| Three.js r178 | `0d013bb6…i0` (Wizards of Ord) |
| Post-processing bundle | `6fe83473…i0` — EffectComposer, RenderPass, ShaderPass, UnrealBloomPass |
| All body/tail/bg/fg effects | Individual inscriptions per file |

The post-processing bundle (`three-bloom.min.js`) contains the full Three.js `three/addons/postprocessing/` pipeline needed for the multi-layer bloom renderer: **EffectComposer**, **RenderPass**, **ShaderPass**, **UnrealBloomPass**, plus their internal dependencies (CopyShader, LuminosityHighPassShader, Pass, FullScreenQuad).

## How Bitcoin block data drives each show

Every show is a pure function of one block — no randomness outside the block's own bytes. The same ruleset applies to all 2,518 July 4th blocks (2009–2025).

---

### Macro parameters — named block fields

| Bitcoin field | What it controls | How |
|---|---|---|
| **`nonce`** (32-bit) | **Show length** (7–15s) | Treated as a uniform random number `u = nonce/2³²`, then a triangular distribution → most shows 10–13s, 15s rare, 7s very rare |
| **`tx_count`** | **Shell density / burst count** | Log-compressed vs a reference count of 2,500 txs. More transactions → more shells. Clamped to 14–64
| **`totalFees / reward`** | **Finale intensity** | The fees-to-reward ratio (how much of the block subsidy came from fees). Higher relative fees → bigger scale boost on finale shells and stronger clustering at the end. |
| **`timestamp`** | **Moon position & visibiJulian Date → actual synodic lunar phase +whether the moon was above the horizon at EDT mine time. Astronomically accurate. |

---

### Palette — `merkle_root` bytes

| Byte(s) | What it controls |
|---|---|                                                                                                           
| `[0..1]` | **Base hue H₀** — two bytes → 0hole palette spins from |
| `[2]` | **Palette scheme** — analogous / complementary / triadic / tetradic / split |
| `[3]` | **Base saturation** — 70–100% |
| `[4]` | **Base lightness** — 45–60% |
| `[8]` | **Background type** — weighted pick: allblack, navygradient, starsblack, starsnavy, moonblack, moonnavy, space (rarest ~3%) |
| `[9]` | **Star-field compass facing** — which direction the constellation field rotates to |
| `[10]` | **Word firework** — which of 5 phrases fires (AMERICA 250 / 7/4/250 / HAPPY 4TH OF JULY / USA / HAPPY 250TH 4TH) |                                                                                  | `[12]` | **Foreground scene** — none / bas park / blackoverlay |

---

### Per-shell attributes — the block byte-tape

Every shell reads its own dedicated byte from a 128-byte tape built from real consensus bytes: `hash(32) + merkle_root(32) + prev_hash(32) + nonce/bits/version/timestamp/mediantime/size/weight/tx_count` (8 × 4 bytes). Each attribute uses a different offset and an oddo the first ~128 shells each read a distinctblock byte per attribute.

| Attribute | What it sets |
|---|---|
| Is shape accent? | 8% chance → bitcoin / s a burst |
| Shell type | Which burst effect (peony, willow, dahlia, dragoneggs, etc.) |
| Speed | Playback speed 0.6–1.4× (faster = shorter duration slot) |
| Has tail? | 55% chance of a rising-tail lead-in |
| Tail type | risingtail / comet / palmfrond |
| X position | Horizontal placement — stratified + jitter so shells spread across the full width |
| Y position | Burst height, confined to the
| Body rotation | ±24° spin on the burst |
| Tail rotation | ±28° launch angle; extreme bytes go up to ±62° for steep corner entries |
| Scale | Size 0.6–2.2× (skewed large; finales-ratio bonus) |
| Tail/body gap | 0–150ms blank delay between tail apex and burst |
| Start jitter | Nudges each shell off its even grid slot |
| Hue | Picks a palette scheme spoke + ±12° iversity guard prevents same-hue runs |
| Saturation | ±8% from the merkle-set base |
| Lightness | ±7% from the merkle-set base |
| 2nd color | Pistil shells only — a second palette hue for the inner ring |

---

### Cadence — `hash` byte `[0]`

The first byte of the block hash controls whether shells are evenly spaced vs. clustered in bursts. On modern blocks this byte is near zero (proof-of-work leading zeros), producing more even spacing; early 2009–2010 blocks with less accumulated work have higher values and more

---

### Color diversity guard

Colors come from the merkle-seeded palette, but the engine tracks the last 4 emitted hues and rotates any new hue that lands within 25° of a recent one by the **golden angle (137.5°)** until it clears. This guarantees spread without breaking the merkle-driven palette.

---

### Summary

| Field | Controls |
|---|---|
| `nonce` | Show length |
| `tx_count` | Shell count / density |
| `totalFees / reward` | Finale scale boost |
| `timestamp` | Moon phase + sky position |
| `merkle_root` | Entire color palette, background, foreground scene, word firework |
| `hash + merkle + prev_hash + scalar fieldsy individual shell's type, color, position,size, speed, rotation |
