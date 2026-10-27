#!/usr/bin/env python3
"""Builds assets/art/art-peek.png for the corner peek: the head, hands and shoulders of art-body.png (real pixels matted from the supplied clip-A) with the
body falling away into shadow (alpha fade) so he looks like he is leaning out of the dark behind a corner.   python3 scripts/make_art_peek.py"""
import numpy as np
from PIL import Image
im = Image.open('assets/art/art-body.png').convert('RGBA'); CROP, FADE = 440, 210
a = np.asarray(im.crop((0, 0, im.width, CROP)), np.float32) / 255
y = np.arange(CROP, dtype=np.float32)[:, None]; k = np.clip((CROP - y) / FADE, 0, 1); k = k * k * (3 - 2 * k)
a[..., 3] *= k; a[..., :3] *= np.clip(0.55 + 0.45 * k, 0, 1)[..., None]
Image.fromarray((a * 255 + .5).astype(np.uint8), 'RGBA').save('assets/art/art-peek.png', optimize=True); print('wrote art-peek.png', im.width, CROP)
