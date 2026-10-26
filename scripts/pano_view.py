#!/usr/bin/env python3
"""Reproject an equirect plate to a flat perspective view (what the phone shows). MIT.
usage: pano_view.py plate.jpg out.png [yaw_deg=0 (+ = turn left, like the game)] [pitch_deg=0] [vfov=80] [w=390] [h=844]"""
import sys, math, numpy as np
from PIL import Image
src = Image.open(sys.argv[1]).convert('RGB'); out = sys.argv[2]
yaw = math.radians(float(sys.argv[3]) if len(sys.argv) > 3 else 0); pit = math.radians(float(sys.argv[4]) if len(sys.argv) > 4 else 0)
vf = math.radians(float(sys.argv[5]) if len(sys.argv) > 5 else 80); W = int(sys.argv[6]) if len(sys.argv) > 6 else 390; H = int(sys.argv[7]) if len(sys.argv) > 7 else 844
a = np.asarray(src, dtype=np.float32); sh, sw = a.shape[:2]
f = (H / 2) / math.tan(vf / 2)
xs, ys = np.meshgrid(np.arange(W) - W / 2 + 0.5, np.arange(H) - H / 2 + 0.5)
d = np.stack([xs, -ys, np.full_like(xs, f)], -1)           # camera space, +z forward, +x right, +y up
cp, sp = math.cos(pit), math.sin(pit)
d = np.stack([d[..., 0], d[..., 1] * cp + d[..., 2] * sp, -d[..., 1] * sp + d[..., 2] * cp], -1)
cy, sy = math.cos(yaw), math.sin(yaw)                      # yaw>0 turns left (toward -x of view)
d = np.stack([d[..., 0] * cy - d[..., 2] * sy, d[..., 1], d[..., 0] * sy + d[..., 2] * cy], -1)
lon = np.arctan2(d[..., 0], d[..., 2]); lat = np.arcsin(d[..., 1] / np.linalg.norm(d, axis=-1))
u = (lon / (2 * math.pi) + 0.5) * sw; v = (0.5 - lat / math.pi) * sh
u = np.clip(u.astype(int) % sw, 0, sw - 1); v = np.clip(v.astype(int), 0, sh - 1)
Image.fromarray(a[v, u].astype(np.uint8)).save(out)
