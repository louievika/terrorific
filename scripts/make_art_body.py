#!/usr/bin/env python3
"""Builds assets/art/art-body.png: FULL-BODY Art (head to feet) as a shadowed, rim-lit silhouette for the camera-monitor feeds.
HONESTY NOTE: Louie's supplied footage only ever shows Art from the waist up. So the head, hat, hood and torso here are REAL pixels matted from the supplied
clip-A.mp4 (t=5.0 s: hat fully in shot, hands and cleavers up in front of the torso); the legs and shoes below the frame are an ORIGINAL dark silhouette (black baggy trousers, big shoes)
that sits in deep shadow, which is how it reads on a night-vision camera. Pipeline:
  1. matte (rembg isnet-general-use + alpha matting), pymatting defringe, premultiplied resize;
  2. torso carried down to the hips and two legs + shoes drawn as supersampled polygons (original);
  3. deep-shadow grade: bright at the face, falling to near-black at the feet; cold rim light on the right edge, faint warm kick on the left; fine grain.
  /workspace/venv-rembg/bin/python scripts/make_art_body.py [frame.png]   (ffmpeg -ss 5.0 -i clip-A.mp4 -frames:v 1 frame.png)"""
import sys, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi
from rembg import remove, new_session
from pymatting import estimate_foreground_ml
src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/hr/t5.0.png'
out = 'assets/art/art-body.png'
im = Image.open(src).convert('RGB'); W, H = im.size
a = np.asarray(remove(im, session=new_session('isnet-general-use'), alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=10, alpha_matting_erode_size=10))[..., 3].astype(np.float32) / 255
keep = a > 0.5; lab, n = ndi.label(keep); keep = lab == (1 + int(np.argmax(ndi.sum(keep, lab, range(1, n + 1)))))
a = np.where(ndi.binary_dilation(ndi.binary_fill_holes(keep), iterations=4), a, 0); a = np.clip((ndi.grey_erosion(a, size=(3, 3)) - 0.12) / 0.7, 0, 1); a = ndi.gaussian_filter(a, 0.6)
fg = estimate_foreground_ml(np.asarray(im, np.float64) / 255, a.astype(np.float64)).astype(np.float32)
# --- big canvas: real upper body on top, original lower body beneath
ys0 = np.where(a > 0.3)[0]; TOP = max(0, int(ys0.min()) - 8); CW, CH = 760, 3420 - TOP + 20
canvas_a = np.zeros((CH, CW), np.float32); canvas_c = np.zeros((CH, CW, 3), np.float32)
canvas_a[0:H - TOP, 0:W] = a[TOP:H, :]; canvas_c[0:H - TOP, 0:W] = fg[TOP:H, :]   # frame y -> canvas y-TOP
# the supplied frame cuts both arms at its edges: dissolve those hard cuts into shadow
xs_ = np.arange(CW); ramp = np.maximum(np.clip((xs_ - 680) / 56.0, 0, 1), np.clip((60 - xs_) / 50.0, 0, 1))[None, :]; canvas_a *= (1 - 0.85 * ramp)
SS = 2; lower = Image.new('L', (CW * SS, CH * SS), 0); d = ImageDraw.Draw(lower)
def P(pts): return [(x * SS, (y - TOP) * SS) for x, y in pts]
rows = np.where(canvas_a.max(1) > 0.3)[0]; yb = int(rows.max()) + TOP           # bottom of the real collar (frame coords)
rr = np.where(canvas_a[yb - 100 - TOP] > 0.3)[0]; l0, r0 = int(rr.min()), int(rr.max())
d.polygon(P([(l0 + 10, yb - 100), (r0 - 10, yb - 100), (730, yb + 40), (680, 1450), (630, 1700), (590, 1820), (170, 1820), (130, 1700), (80, 1450), (30, yb + 40)]), fill=255)   # torso to the hips (original, in shadow)
d.polygon(P([(165, 1760), (395, 1760), (365, 2550), (325, 3250), (195, 3250), (190, 2550)]), fill=255)                         # left leg
d.polygon(P([(365, 1760), (595, 1760), (565, 2550), (540, 3250), (410, 3250), (400, 2550)]), fill=255)                         # right leg
d.ellipse(P([(70, 3250), (335, 3370)]), fill=255); d.polygon(P([(195, 3250), (335, 3250), (340, 3340), (80, 3350)]), fill=255)  # left shoe (points out)
d.ellipse(P([(410, 3250), (690, 3375)]), fill=255); d.polygon(P([(410, 3250), (540, 3250), (675, 3340), (420, 3350)]), fill=255)  # right shoe
lower = lower.resize((CW, CH), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2)); la = np.asarray(lower, np.float32) / 255
rng = np.random.default_rng(5); cloth = np.clip(0.055 + ndi.gaussian_filter(rng.random((CH, CW)).astype(np.float32), 2.5) * 0.08, 0, 1)
fill = np.maximum(0, la - canvas_a)                                              # only where the real matte is absent
canvas_c = canvas_c * canvas_a[..., None] + np.dstack([cloth * 0.95, cloth * 0.98, cloth * 1.15]) * fill[..., None]   # premult-style blend
A_ = np.clip(canvas_a + fill, 0, 1); C = np.where(A_[..., None] > 1e-3, canvas_c / np.maximum(A_[..., None], 1e-3), 0)
# --- deep-shadow grade: face stays readable, everything below falls into darkness
y = np.arange(CH, dtype=np.float32)[:, None]
g = np.interp(y, [0, 560, 800, 1100, 1500, 1900, 3420], [0.95, 0.90, 0.72, 0.42, 0.26, 0.16, 0.11])
C = np.clip(C * g[..., None] * np.array([0.92, 1.0, 1.12], np.float32), 0, 1)
# rim light: right edge cold teal, left edge faint warm
Af = ndi.gaussian_filter(A_, 1.0); sh = 9
right = np.clip(Af - np.roll(Af, -sh, axis=1), 0, 1); left = np.clip(Af - np.roll(Af, sh, axis=1), 0, 1)
rim_f = np.interp(y, [0, 1100, 2200, 3420], [1.0, 1.0, 0.8, 0.6])
C = np.clip(C + (right * rim_f)[..., None] * np.array([0.25, 0.62, 0.72], np.float32) * 1.5 + (left * rim_f)[..., None] * np.array([0.5, 0.3, 0.14], np.float32) * 0.5, 0, 1)
C = np.clip(C + (rng.random(C.shape).astype(np.float32) - 0.5) * 0.02, 0, 1)
# --- crop, premultiplied resize to 220 wide
ys, xs = np.where(A_ > 0.02); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
C = C[y0:y1, x0:x1]; A_ = A_[y0:y1, x0:x1]; tw = 220; th = round(A_.shape[0] * tw / A_.shape[1])
pm = Image.fromarray((np.dstack([C * A_[..., None], A_]) * 255 + .5).astype(np.uint8), 'RGBA').resize((tw, th), Image.LANCZOS)
r = np.asarray(pm, np.float32) / 255; ra = np.clip(r[..., 3:4], 0, 1)
res = np.dstack([np.where(ra > 1 / 255, np.clip(r[..., :3] / np.maximum(ra, 1e-4), 0, 1), 0), ra])
Image.fromarray((res * 255 + .5).astype(np.uint8), 'RGBA').save(out + '.tmp.png')
subprocess.check_call(['pngquant', '256', '--quality', '55-95', '--speed', '1', '--floyd=0.6', '--strip', '-f', '-o', out, out + '.tmp.png']); import os; os.remove(out + '.tmp.png')
print('wrote', out, tw, th)
