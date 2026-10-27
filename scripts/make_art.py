#!/usr/bin/env python3
"""Builds assets/art/art.png (transparent Art overlay) from the user-supplied design reference assets/art/art-title.png.
Phase E-2 pipeline (clean outline, no halo):
  1. subject matte from the open-source ISNet model via rembg (run once:  /workspace/venv-rembg/bin/python scripts/make_art.py --rembg)
     and cached as assets/art/art-alpha.png (8-bit alpha only, ~100 KB);
  2. alpha is tightened (1 px erode, smooth-step, tiny AA feather) so no background colour survives at the edge;
  3. edge colours are re-estimated (pymatting estimate_foreground_ml) = de-contaminated, then the RGBA is PREMULTIPLIED for every resize;
  4. the dark felt hat the matte cannot see against the dark background is replaced by an ORIGINAL procedurally painted tilted top hat;
  5. the torso fades into darkness at the sides/bottom (hidden by the room's black), so no hard crop edge shows.
The reference photo is user-supplied (not original art); matte, hat, grade and fades are original work."""
import numpy as np, os, sys, math
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'art')
src = Image.open(os.path.join(R, 'art-title.png')).convert('RGB')
W, H = src.size
ALPHA = os.path.join(R, 'art-alpha.png')

if '--rembg' in sys.argv or not os.path.exists(ALPHA):
    from rembg import remove, new_session
    out = remove(src, session=new_session('isnet-general-use'), alpha_matting=False)
    out.split()[3].save(ALPHA, optimize=True)
alpha = np.asarray(Image.open(ALPHA).convert('L'), np.float32) / 255.0

# --- 2. tighten the matte
a = ndi.grey_erosion(alpha, size=(3, 3))
a = np.clip((a - 0.28) / 0.5, 0, 1); a = a * a * (3 - 2 * a)
a = ndi.gaussian_filter(a, 0.8)
# close the notch/hole the matte leaves in the shaded side of the hood, and drop the stray blue hat-band fragment (replaced by the painted hat)
yy0, xx0 = np.mgrid[0:H, 0:W]
head_zone = yy0 < H * 0.7
closed = ndi.binary_closing(a > 0.5, structure=np.ones((3, 3)), iterations=22) & head_zone
closed = ndi.binary_fill_holes(closed) & head_zone
a = np.where(head_zone, np.maximum(a, ndi.gaussian_filter(closed.astype(np.float32), 1.0)), a)
blue = (np.asarray(src, np.float32)[..., 2] > np.asarray(src, np.float32)[..., 0] + 25) & (yy0 < H * 0.1) & (xx0 < W * 0.57)
a = a * (1 - ndi.gaussian_filter(blue.astype(np.float32), 1.2))
# keep the largest connected blob (drops stray background specks)
lab, n = ndi.label(a > 0.5)
if n > 1:
    sizes = ndi.sum(a > 0.5, lab, range(1, n + 1)); keep = 1 + int(np.argmax(sizes)); a = a * ndi.binary_dilation(lab == keep, iterations=6)

# --- 3. de-contaminate edge colour
from pymatting import estimate_foreground_ml
rgb = np.asarray(src, np.float32) / 255.0
fg = estimate_foreground_ml(rgb, a)

# --- 4. original hat (felt cylinder + brim), painted at 2x and rotated into the reference pose
k = W / 612.0
def hat_layer():
    S = 2; w, h = W * S, H * S
    L = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    cx, cy = 448 * k * S, 150 * k * S; ang = math.radians(39)
    ux, uy = math.cos(ang), math.sin(ang); vx, vy = math.sin(ang), -math.cos(ang)   # brim axis / crown axis (up-right)
    def P(a_, b_): return (cx + (ux * a_ + vx * b_) * k * S, cy + (uy * a_ + vy * b_) * k * S)
    def ell(a0, b0, ra, rb, n=64): return [P(a0 + ra * math.cos(t), b0 + rb * math.sin(t)) for t in [i * 2 * math.pi / n for i in range(n)]]
    d.polygon(ell(0, 0, 150, 36), fill=(26, 28, 30, 255))                                           # brim
    crown = [P(-92, 4), P(-84, 128), *[P(0 + 84 * math.cos(t), 128 + 24 * math.sin(t)) for t in [math.pi + i * math.pi / 30 for i in range(31)]][::-1][:0], P(84, 128), P(92, 4)]
    d.polygon([P(-92, 2), P(-84, 126), P(84, 126), P(92, 2)], fill=(30, 32, 34, 255))               # crown side
    d.polygon(ell(0, 126, 84, 24), fill=(46, 48, 50, 255))                                          # crown top
    d.polygon([P(-91, 14), P(91, 14), P(90, 30), P(-90, 30)], fill=(16, 18, 20, 255))                # hat band
    d.polygon(ell(0, 0, 150, 36)[::1], outline=(70, 76, 80, 255))
    arr = np.asarray(L, np.float32) / 255.0
    # felt: fine noise + key-light gradient from the left, cold teal rim on the right edge
    rng = np.random.default_rng(5); nz = ndi.gaussian_filter(rng.normal(0, 1, arr.shape[:2]), 0.8) * 0.06
    gx = np.linspace(1.25, 0.45, w)[None, :]
    m = arr[..., 3]; rim = np.clip(ndi.gaussian_filter(m, 5) - ndi.gaussian_filter(np.roll(m, -7, 1), 5) * 1.0, 0, 1) * 1.6
    soft = ndi.gaussian_filter(m, 7 * S)
    col = arr[..., :3] * gx[..., None] * (0.6 + 0.4 * soft[..., None]) + nz[..., None]
    col[..., :] += (np.clip(np.sin(np.linspace(0, 14, w))[None, :], 0, 1) * 0.0)[..., None]
    col += rim[..., None] * np.array([0.04, 0.2, 0.24])
    out = np.concatenate([np.clip(col, 0, 1) * m[..., None], m[..., None]], 2)       # premultiplied
    img = Image.fromarray((out * 255).astype(np.uint8), 'RGBA').resize((W, H), Image.LANCZOS)
    return np.asarray(img, np.float32) / 255.0                                       # premultiplied RGBA
hat = hat_layer()

# --- compose: hat under the hood (hood in front), premultiplied "over"
head = np.concatenate([fg * a[..., None], a[..., None]], 2)
comp = head + hat * (1 - a[..., None])

# --- 5. fade torso edges / bottom into the dark
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
fade = np.ones((H, W), np.float32)
fade *= np.clip((H * 0.93 - yy) / (H * 0.2), 0, 1) ** 1.3                           # bottom: gone by the lower collar
fade *= np.clip(xx / (W * 0.12), 0, 1) ** 1.2 * np.clip((W - xx) / (W * 0.1), 0, 1) ** 1.2 + (yy < H * 0.62)   # sides below the neck only
fade = np.clip(fade, 0, 1)
comp *= fade[..., None]

# --- write: premultiplied downscale (no fringing), then un-premultiply for PNG
tw = 600; th = int(round(tw * H / W)); img = Image.fromarray((np.clip(comp, 0, 1) * 255).astype(np.uint8), 'RGBA')
small = np.asarray(img.resize((tw, th), Image.LANCZOS), np.float32) / 255.0
al = np.clip(small[..., 3:], 0, 1); col = np.where(al > 1e-3, small[..., :3] / np.maximum(al, 1e-3), 0)
final = np.concatenate([np.clip(col, 0, 1), al], 2)
# crop to the bottom 1000/1883*... keep full frame height; trim empty rows at top
out = Image.fromarray((final * 255 + 0.5).astype(np.uint8), 'RGBA')
bb = out.getchannel('A').point(lambda v: 255 if v > 4 else 0).getbbox(); out = out.crop((0, bb[1], tw, th))
out.save(os.path.join(R, 'art.png'), optimize=True)
print(out.size, os.path.getsize(os.path.join(R, 'art.png')) // 1024, 'KB')
