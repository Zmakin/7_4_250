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
