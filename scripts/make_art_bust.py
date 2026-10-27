#!/usr/bin/env python3
"""Builds assets/art/art-bust.png: WAIST-UP Art (hat, face, both cleavers, fists, shoulders) for the camera-monitor feed. All pixels are REAL: matted from Louie's
supplied clip-A.mp4 (t=5.0 s). No invented limbs: the body just falls into shadow below the ribs (alpha + grade fade), and the frame's hard side cuts dissolve into the dark.
  rembg isnet matte -> pymatting defringe -> crop -> side/bottom shadow falloff -> cold rim light -> premultiplied resize.
  /workspace/venv-rembg/bin/python scripts/make_art_bust.py [frame.png]   (ffmpeg -ss 5.0 -i clip-A.mp4 -frames:v 1 frame.png)"""
import sys, subprocess, os, numpy as np
from PIL import Image
from scipy import ndimage as ndi
from rembg import remove, new_session
from pymatting import estimate_foreground_ml
src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/hr/t5.0.png'; out = 'assets/art/art-bust.png'
im = Image.open(src).convert('RGB'); W, H = im.size
a = np.asarray(remove(im, session=new_session('isnet-general-use'), alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=10, alpha_matting_erode_size=10))[..., 3].astype(np.float32) / 255
keep = a > 0.5; lab, n = ndi.label(keep); keep = lab == (1 + int(np.argmax(ndi.sum(keep, lab, range(1, n + 1)))))
a = np.where(ndi.binary_dilation(ndi.binary_fill_holes(keep), iterations=3), a, 0); a = np.clip((ndi.grey_erosion(a, size=(3, 3)) - 0.15) / 0.7, 0, 1); a = ndi.gaussian_filter(a, 0.7)
fg = estimate_foreground_ml(np.asarray(im, np.float64) / 255, a.astype(np.float64)).astype(np.float32)
ys, xs = np.where(a > 0.3); y0, y1, x0, x1 = max(0, ys.min() - 6), H, max(0, xs.min() - 4), min(W, xs.max() + 5)
a = a[y0:y1, x0:x1]; fg = fg[y0:y1, x0:x1]; h, w = a.shape
yy = np.arange(h, dtype=np.float32)[:, None] / h; xx = np.arange(w, dtype=np.float32)[None, :] / w
side = np.clip(np.minimum(xx, 1 - xx) / 0.14, 0, 1); side = side * side * (3 - 2 * side)                  # the frame's hard arm cuts dissolve into shadow
fade = np.clip((0.97 - yy) / 0.40, 0, 1); fade = fade * fade * (3 - 2 * fade)                           # below the ribs he falls into darkness
a = a * np.maximum(side, 0.0) * np.where(yy < 0.55, 1.0, fade)
shade = np.interp(yy, [0, 0.5, 0.75, 1.0], [1.0, 0.95, 0.6, 0.25]) * np.interp(xx, [0, 0.12, 0.5, 0.88, 1], [0.5, 0.85, 1, 0.85, 0.5])
Af = ndi.gaussian_filter(a, 1.0); rim = np.clip(Af - np.roll(Af, -7, axis=1), 0, 1)
C = np.clip(fg * shade[..., None] * np.array([0.9, 1.0, 1.08], np.float32) + rim[..., None] * np.array([0.2, 0.5, 0.6], np.float32) * 1.2, 0, 1)
tw = 380; th = round(h * tw / w)
pm = Image.fromarray((np.dstack([C * a[..., None], a]) * 255 + .5).astype(np.uint8), 'RGBA').resize((tw, th), Image.LANCZOS)
r = np.asarray(pm, np.float32) / 255; ra = np.clip(r[..., 3:4], 0, 1)
res = np.dstack([np.where(ra > 1 / 255, np.clip(r[..., :3] / np.maximum(ra, 1e-4), 0, 1), 0), ra])
Image.fromarray((res * 255 + .5).astype(np.uint8), 'RGBA').save(out + '.tmp.png')
subprocess.check_call(['pngquant', '256', '--quality', '55-95', '--speed', '1', '--floyd=0.6', '--strip', '-f', '-o', out, out + '.tmp.png']); os.remove(out + '.tmp.png'); print('wrote', out, tw, th)
