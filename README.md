# Ordinals Fireworks Builder - Setup Instructions

## Step 1: Download p5.js Library

1. Go to https://p5js.org/download/
2. Download the complete library (p5.min.js)
3. Create a `lib` folder in this project directory
4. Place `p5.min.js` inside the `lib` folder

**Alternative - Quick Download via Command:**

```bash
# Windows PowerShell
New-Item -ItemType Directory -Force -Path lib
Invoke-WebRequest -Uri "https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js" -OutFile "lib/p5.min.js"
```

```bash
# Mac/Linux
mkdir -p lib
curl -o lib/p5.min.js https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js
```

## Step 2: Test Individual Animations

Open any animation HTML file directly in your browser:
- `animations/RisingTail.html`
- `animations/PeonyBurst.html`
- `animations/Palm.html`
- `animations/Willow.html`
- `animations/Chrysanthemum.html`
- `animations/Crossette.html`
- `animations/Strobe.html`
- `animations/Pistil.html`

Test with parameters:
```
RisingTail.html?hue=200&speed=1.5&angle=45
```

## Step 3: Use the Builder

Open `FireworksBuilder.html` in your browser to compose shows.

## Project Structure

```
ordinals-fireworks/
??? README.md
??? lib/
?   ??? p5.min.js          (download this!)
??? animations/
?   ??? RisingTail.html
?   ??? PeonyBurst.html
?   ??? Palm.html
?   ??? Willow.html
?   ??? Chrysanthemum.html
?   ??? Crossette.html
?   ??? Strobe.html
?   ??? Pistil.html
??? FireworksBuilder.html
```

## For Inscription

When ready to inscribe:

1. Replace all `../lib/p5.min.js` references with:
   `/content/13a5c8e41dfc110514b450b2f15317988c0aaf276d3dbdcca9aa3c7d0b2188a7i0`

2. Minify each HTML file

3. Inscribe animations first, note their IDs

4. Update `ANIMATIONS` object in builder with real IDs

5. Export final shows and inscribe

## Browser Compatibility

- Chrome/Edge: ? Full support
- Firefox: ? Full support  
- Safari: ? Full support
- Mobile: ?? Limited (desktop recommended)
