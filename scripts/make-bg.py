#!/usr/bin/env python3
"""
scripts/make-bg.py
Generates soft gradient WebP backgrounds for each brand × mode combination.
Each file is kept under 80 KB.

Output files (relative to mobile/assets/images/):
  bg-cobalt-dark.webp
  bg-cobalt-light.webp
  bg-ember-dark.webp
  bg-ember-light.webp

Usage:
  cd gymholik
  python3 scripts/make-bg.py
"""

import os
from PIL import Image, ImageDraw
import math

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "mobile", "assets", "images")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Canvas size (portrait mobile — Expo will scale)
W, H = 480, 852

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def ease_in_out(t):
    return t * t * (3 - 2 * t)

def make_gradient(filename, colors_stops, max_quality=82):
    """
    colors_stops: list of (y_fraction, (r,g,b)) tuples
    """
    img = Image.new("RGB", (W, H))
    pixels = img.load()

    for y in range(H):
        t_global = y / (H - 1)
        # Find which segment we're in
        c = colors_stops[0][1]
        for i in range(len(colors_stops) - 1):
            y0, col0 = colors_stops[i]
            y1, col1 = colors_stops[i + 1]
            if y0 <= t_global <= y1:
                local_t = (t_global - y0) / (y1 - y0) if y1 > y0 else 0
                c = lerp_color(col0, col1, ease_in_out(local_t))
                break
            elif t_global > y1:
                c = col1

        for x in range(W):
            # Subtle radial vignette — brightest at center-top
            cx_dist = abs(x - W / 2) / (W / 2)
            cy_dist = y / H
            vignette = 1.0 - 0.12 * (cx_dist ** 2 + cy_dist * 0.5)
            px = tuple(max(0, min(255, int(ch * vignette))) for ch in c)
            pixels[x, y] = px

    # Add very faint noise for depth
    import random
    rng = random.Random(42)
    pix = img.load()
    for y in range(H):
        for x in range(W):
            n = rng.randint(-3, 3)
            px = pix[x, y]
            pix[x, y] = tuple(max(0, min(255, ch + n)) for ch in px)

    path = os.path.join(OUTPUT_DIR, filename)
    img.save(path, "WEBP", quality=max_quality, method=6)
    size_kb = os.path.getsize(path) / 1024
    print(f"  {filename:30s}  {size_kb:.1f} KB")
    if size_kb > 80:
        # Re-save at lower quality until under 80 KB
        for q in range(max_quality - 5, 50, -5):
            img.save(path, "WEBP", quality=q, method=6)
            size_kb = os.path.getsize(path) / 1024
            if size_kb <= 80:
                print(f"    → re-saved at q={q}: {size_kb:.1f} KB")
                break

CONFIGS = {
    "bg-cobalt-dark.webp": [
        (0.00, (11, 16, 32)),
        (0.40, (18, 26, 46)),
        (0.75, (14, 22, 42)),
        (1.00, (11, 16, 32)),
    ],
    "bg-cobalt-light.webp": [
        (0.00, (244, 246, 251)),
        (0.40, (255, 255, 255)),
        (0.75, (235, 239, 248)),
        (1.00, (244, 246, 251)),
    ],
    "bg-ember-dark.webp": [
        (0.00, (20, 16, 14)),
        (0.40, (29, 24, 22)),
        (0.75, (24, 18, 16)),
        (1.00, (20, 16, 14)),
    ],
    "bg-ember-light.webp": [
        (0.00, (251, 246, 242)),
        (0.40, (255, 255, 255)),
        (0.75, (245, 237, 232)),
        (1.00, (251, 246, 242)),
    ],
}

if __name__ == "__main__":
    print("Generating gradient WebP backgrounds...")
    for filename, stops in CONFIGS.items():
        make_gradient(filename, stops)
    print("Done.")
