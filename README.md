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

