#!/usr/bin/env python3
"""Builds assets/art/art.png (the transparent Art overlay used by every in-room scare) from the user-supplied clip footage - no painted or synthesized parts.
Source: one frame of /workspace/terrifier-game-supplied/clip-C.mp4 (calm eyes, real hat in frame).
  1. matte = union of two open-source segmenters (rembg isnet-general-use for the hood/face + u2net for the dark hat, which isnet drops against the dark teal wall);
  2. the matte is cleaned (largest blob, holes filled, 1px tighten, tiny feather);
  3. edge colours are re-estimated (pymatting estimate_foreground_ml) so no teal wall bleeds into the outline (defringe), then resized PREMULTIPLIED (no halos);
  4. a light grade matches the room: warm key on the lit side, cold rim kept on the other, slight desaturation + grain-friendly contrast;
  5. the lower torso fades to transparent so no hard crop edge shows.
  python3 scripts/make_art_face.py [frame.png]   (extract with: ffmpeg -ss 0.5 -i clip-C.mp4 -frames:v 1 frame.png)
Needs: /workspace/venv-rembg (rembg, onnxruntime, pymatting, scipy, pillow)."""
import sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
from rembg import remove, new_session
from pymatting import estimate_foreground_ml
src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/hr/C-02.png'
out = sys.argv[2] if len(sys.argv) > 2 else 'assets/art/art.png'
im = Image.open(src).convert('RGB'); W, H = im.size
def seg(model, **kw):
    return np.asarray(remove(im, session=new_session(model), alpha_matting=True, alpha_matting_foreground_threshold=235, alpha_matting_background_threshold=20, alpha_matting_erode_size=8, **kw))[..., 3].astype(np.float32) / 255
a = seg('isnet-general-use')
# the dark felt hat vanishes against the dark teal wall in a full-frame pass: re-segment just the top-right crop with u2net (hat stays) and merge
hx0, hy1 = int(W * 0.27), int(H * 0.27)
crop = im.crop((hx0, 0, W, hy1))
ha = np.asarray(remove(crop, session=new_session('u2net'), alpha_matting=True, alpha_matting_foreground_threshold=200, alpha_matting_background_threshold=30, alpha_matting_erode_size=6))[..., 3].astype(np.float32) / 255
a[0:hy1, hx0:W] = np.maximum(a[0:hy1, hx0:W], ha)
# clean
keep = a > 0.5
lab, n = ndi.label(keep); sizes = ndi.sum(keep, lab, range(1, n + 1)); keep = lab == (1 + int(np.argmax(sizes)))
keep = ndi.binary_fill_holes(ndi.binary_closing(keep, np.ones((3, 3)), iterations=4))
a = np.where(ndi.binary_dilation(keep, iterations=5), a, 0)
a = np.clip((ndi.grey_erosion(a, size=(3, 3)) - 0.15) / 0.7, 0, 1); a = ndi.gaussian_filter(a, 0.7)
# defringe
fg = estimate_foreground_ml(np.asarray(im, np.float64) / 255, a.astype(np.float64)).astype(np.float32)
# grade: warm key from the left, cold rim stays on the right; slightly lower saturation, soft S-curve
yy, xx = np.mgrid[0:H, 0:W]; k = np.clip(1 - xx / W, 0, 1)[..., None]
warm = np.array([1.06, 1.0, 0.90], np.float32); cool = np.array([0.96, 1.0, 1.06], np.float32)
fg = fg * (k * warm + (1 - k) * cool)
g = fg.mean(-1, keepdims=True); fg = np.clip(g + (fg - g) * 0.92, 0, 1)
fg = np.clip(fg, 0, 1); fg = fg * fg * (3 - 2 * fg) * 0.35 + fg * 0.65
# crop to subject, fade the bottom 18% to nothing
box = Image.fromarray((a * 255).astype(np.uint8)).point(lambda v: 255 if v > 8 else 0).getbbox(); x0, y0, x1, y1 = box
fg = fg[y0:y1, x0:x1]; a = a[y0:y1, x0:x1]; h = a.shape[0]
fade = np.clip((1 - (np.arange(h) / h - 0.82) / 0.18), 0, 1)[:, None]; a = a * (fade * fade * (3 - 2 * fade))
tw = 640; th = round(h * tw / a.shape[1])
pm = Image.fromarray((np.dstack([fg * a[..., None], a]) * 255 + .5).astype(np.uint8), 'RGBA').resize((tw, th), Image.LANCZOS)
r = np.asarray(pm, np.float32) / 255; ra = np.clip(r[..., 3:4], 0, 1)
res = np.dstack([np.where(ra > 1 / 255, np.clip(r[..., :3] / np.maximum(ra, 1e-4), 0, 1), 0), ra])
Image.fromarray((res * 255 + .5).astype(np.uint8), 'RGBA').save(out + '.tmp.png')
import subprocess; subprocess.check_call(['pngquant', '256', '--quality', '55-95', '--speed', '1', '--floyd=0.6', '--strip', '-f', '-o', out, out + '.tmp.png']); import os; os.remove(out + '.tmp.png')
print('wrote', out, tw, th)
