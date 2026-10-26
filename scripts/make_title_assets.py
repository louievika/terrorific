#!/usr/bin/env python3
"""Build derived title-screen assets from assets/art/art-title.png (user-supplied reference image).
Outputs: art-title-m.jpg (720w static), art-title-blink.png (720w transparent closed-eyelid overlay),
art-title.webp (540w animated WebP: irregular blinks + jaw twitches baked, variable frame durations).
Eye / jaw regions are defined in source-pixel coords for the 1125x1883 reference; scaled if you swap the image."""
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
SRC = 'assets/art/art-title.png'
src = Image.open(SRC).convert('RGB')
W, H = src.size
k = W / 1125.0
# (cx, cy, rx, ry) eyes in reference coords
EYES = [(342, 764, 104, 48), (670, 744, 106, 52)]
JAW_Y = 960  # lower face starts here

def skin():
    a = np.asarray(src.crop((int(250*k), int(830*k), int(400*k), int(870*k)))).reshape(-1, 3)
    return tuple(int(v) for v in np.median(a, axis=0))
SKIN = skin()

def lid_layer(amount):
    """RGBA layer of eyelids covering `amount` (0..1) of each eye from the top."""
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for cx, cy, rx, ry in EYES:
        cx, cy, rx, ry = [v*k for v in (cx, cy, rx, ry)]
        m = Image.new('L', (W, H), 0)
        d = ImageDraw.Draw(m)
        top = cy - ry
        bottom = top + 2*ry*amount
        # ellipse clipped to lid height
        d.ellipse((cx-rx, cy-ry, cx+rx, cy+ry), fill=255)
        clip = Image.new('L', (W, H), 0)
        ImageDraw.Draw(clip).rectangle((cx-rx-4, top-4, cx+rx+4, bottom), fill=255)
        m = Image.fromarray(np.minimum(np.asarray(m), np.asarray(clip)))
        m = m.filter(ImageFilter.GaussianBlur(5*k))
        # 'close' the eye by filling the almond with the dark makeup colour (lids = black voids, pupils vanish)
        col = Image.new('RGBA', (W, H), (14, 8, 10, 255))
        a = np.asarray(m).astype(np.float32) / 255.0
        arr = np.asarray(col).copy()
        arr[..., 3] = (a * 255).astype(np.uint8)
        layer = Image.alpha_composite(layer, Image.fromarray(arr, 'RGBA'))
    return layer

def with_lids(amount):
    return Image.alpha_composite(src.convert('RGBA'), lid_layer(amount)).convert('RGB')

def jaw(dy, dx=0):
    """shift the lower face down (jaw drop twitch), feathered."""
    a = np.asarray(src).astype(np.float32)
    shifted = np.roll(np.roll(a, int(dy*k), axis=0), int(dx*k), axis=1)
    ramp = np.clip((np.arange(H) - JAW_Y*k) / (140*k), 0, 1)[:, None, None]
    out = a*(1-ramp) + shifted*ramp
    return Image.fromarray(out.astype(np.uint8))

def jaw_blink(dy, amount):
    j = jaw(dy)
    return Image.alpha_composite(j.convert('RGBA'), lid_layer(amount)).convert('RGB')

# --- static mobile copy (720w) + blink overlay (closed lids, transparent elsewhere) ---
mw = 720; mh = round(H * mw / W)
src.resize((mw, mh), Image.LANCZOS).save('assets/art/art-title-m.jpg', quality=82, optimize=True, progressive=True)
lid_layer(1.0).resize((mw, mh), Image.LANCZOS).save('assets/art/art-title-blink.png', optimize=True)

# --- animated WebP, 540w, variable frame durations ---
aw = 540; ah = round(H * aw / W)
def fr(img): return img.resize((aw, ah), Image.LANCZOS)
base = fr(src)
half = fr(with_lids(0.55)); closed = fr(with_lids(1.0))
j1 = fr(jaw(7)); j2 = fr(jaw(13, 3)); jb = fr(jaw_blink(8, 0.6))
timeline = [
    (base, 1300), (half, 55), (closed, 95), (half, 55),
    (base, 1500), (j1, 80), (base, 110), (j1, 60), (base, 900),
    (half, 50), (closed, 85), (half, 50), (base, 190), (half, 50), (closed, 85), (half, 50),
    (base, 2100), (j2, 75), (base, 1500), (jb, 120), (base, 800),
]
frames = [f for f, _ in timeline]; durs = [d for _, d in timeline]
frames[0].save('assets/art/art-title.webp', save_all=True, append_images=frames[1:], duration=durs,
               loop=0, quality=62, method=5)
print('loop ms', sum(durs), 'frames', len(frames))
