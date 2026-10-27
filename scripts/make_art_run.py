"""ART // LOGIN - scripts/make_art_run.py (MIT, original work).
Builds assets/art/art-run.webp: a 12-frame run-cycle SPRITE SHEET (4 cols x 3 rows, transparent) from the user-supplied
design reference assets/art/art.png. Lightweight 2D rig (no 3D modelling, no film stills): per-frame stride phase drives
body bob, roll, sway, head/hat lean (row-wise shear), a footfall squash, flicker of the swinging bulb, then motion blur is
BAKED by accumulating 7 sub-frame poses, followed by film grain, a warm top-light / cold under-fill grade and a ground-contact darkening.
Usage: python3 scripts/make_art_run.py   (writes assets/art/art-run.webp and prints the manifest slot)"""
import numpy as np, json, math, os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N, COLS, ROWS = 12, 4, 3
FW, FH = 360, 576                      # frame size in the sheet
SRC_H = 516                            # art height inside the frame (room for sway / lean / bob)
rng = np.random.default_rng(11)

src = Image.open(os.path.join(ROOT, 'assets/art/art.png')).convert('RGBA')
sw = int(src.width * SRC_H / src.height)
src = src.resize((sw, SRC_H), Image.LANCZOS)
base = np.zeros((FH, FW, 4), np.float32)
ox, oy = (FW - sw) // 2, FH - SRC_H - 6
base[oy:oy + SRC_H, ox:ox + sw] = np.asarray(src, np.float32) / 255.0
base[..., :3] *= base[..., 3:4]        # premultiply

def pose(phi):
    """phi in radians over one 12-frame cycle (two footfalls per cycle)."""
    bob = math.cos(2 * phi)            # +1 = footfall (lowest), -1 = flight (highest)
    return dict(dy=8 * bob - 4, dx=13 * math.sin(phi), roll=4.2 * math.sin(phi + .25), lean=16 * math.sin(phi + .9),
                sy=1 - .035 * max(0, bob) + .02 * max(0, -bob), sx=1 + .02 * max(0, bob), hat=6 * math.sin(2 * phi + .6))

def render(p):
    from scipy.ndimage import affine_transform
    out = np.zeros_like(base)
    # row-wise shear (head leans, hat lags) before the global roll/scale
    sh = np.zeros_like(base)
    for y in range(FH):
        t = max(0.0, 1 - (y - oy) / (SRC_H * 0.78))           # 1 at the top of the head, 0 near the collar
        s = p['lean'] * t ** 1.6 + p['hat'] * max(0.0, 1 - (y - oy) / (SRC_H * 0.25)) ** 2
        k = int(math.floor(s)); f = s - k
        row = np.roll(base[y], k, axis=0) * (1 - f) + np.roll(base[y], k + 1, axis=0) * f
        sh[y] = row
    cx, cy = FW / 2, FH - 6
    r = math.radians(p['roll'])
    c, s_ = math.cos(r), math.sin(r)
    # inverse map: scale about the feet, rotate, translate (output(y,x) <- input)
    M2 = np.linalg.inv(np.array([[p['sy'] * c, -p['sx'] * s_], [p['sy'] * s_, p['sx'] * c]]))
    offset = np.array([cy, cx]) - M2 @ np.array([cy + p['dy'], cx + p['dx']])
    for ch in range(4):
        out[..., ch] = affine_transform(sh[..., ch], M2, offset=offset, order=1, mode='constant')
    return out

frames = []
SUB = 7
for i in range(N):
    acc = np.zeros_like(base)
    for s in range(SUB):                                   # 180-degree shutter across this frame's time slot
        phi = 2 * math.pi * (i + (s / (SUB - 1) - .5) * .55) / N
        acc += render(pose(phi))
    acc /= SUB
    a = acc[..., 3:4]
    rgb = np.where(a > 1e-4, acc[..., :3] / np.maximum(a, 1e-4), 0)
    h = np.linspace(0, 1, FH)[:, None, None]
    flick = 0.9 + 0.1 * math.sin(i * 2.1) + rng.normal(0, .015)  # swinging bulb catches the face
    top = np.array([1.06, 0.96, 0.82]); under = np.array([0.82, 0.88, 1.0])
    rgb = rgb * (top * (1 - h) + under * h) * flick * (0.78 + 0.22 * (1 - h))   # darker toward the legs/floor
    rgb = np.clip(rgb, 0, 1) ** 1.08
    # grain, strongest in the shadows and the blurred edges
    g = rng.normal(0, 0.05, (FH, FW, 1)) * (1.2 - rgb.mean(axis=2, keepdims=True))
    rgb = np.clip(rgb + g, 0, 1)
    rgba = np.concatenate([rgb, a], axis=2)
    frames.append(Image.fromarray((rgba * 255).astype(np.uint8), 'RGBA'))

sheet = Image.new('RGBA', (FW * COLS, FH * ROWS), (0, 0, 0, 0))
for i, f in enumerate(frames):
    sheet.paste(f, ((i % COLS) * FW, (i // COLS) * FH))
out = os.path.join(ROOT, 'assets/art/art-run.webp')
sheet.save(out, 'WEBP', quality=72, method=6, alpha_quality=80)
sheet.resize((sheet.width // 2, sheet.height // 2)).save('/tmp/art-run-preview.png')
print('wrote', out, os.path.getsize(out), 'bytes')
print(json.dumps({'sheet': 'assets/art/art-run.webp', 'frameW': FW, 'frameH': FH, 'cols': COLS, 'frames': N, 'fps': 24, 'durationMs': 1000}))
