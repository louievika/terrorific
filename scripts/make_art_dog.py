#!/usr/bin/env python3
"""Rebuild assets/art/dog.png from the user-supplied photo (dog.jpg - supplied by Louie, not generated).
Open-source only: rembg (isnet-general-use) + pymatting foreground estimation (no colour halos) + premultiplied LANCZOS resize + pngquant (<= 250 KB).
  python3 -m venv --system-site-packages venv && venv/bin/pip install "rembg[cpu]" opencv-python-headless pymatting pillow pngquant-cli
  venv/bin/python scripts/make_art_dog.py path/to/dog.jpg
"""
import sys, subprocess, numpy as np, cv2
from PIL import Image
from rembg import remove, new_session
from pymatting import estimate_foreground_ml
src_p = sys.argv[1] if len(sys.argv) > 1 else 'dog.jpg'
im = Image.open(src_p).convert('RGB')
cut = remove(im, session=new_session('isnet-general-use'), alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=10, alpha_matting_erode_size=12)
a = np.asarray(cut)[..., 3].astype(np.float64) / 255
keep = (a > 0.5).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(keep); keep = np.zeros_like(keep)
for i in range(1, n):
    if st[i, 4] > 20000: keep[lab == i] = 1
n2, lab2, st2, _ = cv2.connectedComponentsWithStats(1 - keep)
for i in range(1, n2):
    if st2[i, 4] < 8000: keep[lab2 == i] = 1
a2 = np.where(cv2.dilate(keep, np.ones((9, 9), np.uint8)) > 0, a, 0.0)
fg = estimate_foreground_ml(np.asarray(im, dtype=np.float64) / 255, a2)
full = Image.fromarray((np.dstack([np.clip(fg, 0, 1), a2]) * 255 + .5).astype(np.uint8), 'RGBA')
c = full.crop(full.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()); W = 640; H = round(c.height * W / c.width)
arr = np.asarray(c, dtype=np.float32) / 255; al = arr[..., 3:4]
pm = Image.fromarray((np.dstack([arr[..., :3] * al, al]) * 255 + .5).astype(np.uint8), 'RGBA').resize((W, H), Image.LANCZOS)   # premultiplied resize: no halos
r = np.asarray(pm, dtype=np.float32) / 255; ra = np.clip(r[..., 3:4], 0, 1)
out = Image.fromarray((np.dstack([np.where(ra > 1 / 255, np.clip(r[..., :3] / np.maximum(ra, 1e-4), 0, 1), 0), ra]) * 255 + .5).astype(np.uint8), 'RGBA'); out.save('/tmp/dog_full.png')
subprocess.check_call(['pngquant', '256', '--quality', '70-95', '--speed', '1', '--floyd=0.6', '--strip', '-f', '-o', 'assets/art/dog.png', '/tmp/dog_full.png'])
