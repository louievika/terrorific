#!/usr/bin/env python3
"""Builds assets/art/art.png (transparent Art overlay) from the user-supplied reference image
(assets/art/art-title.png - a reference still, NOT original art) with a feathered head cut-out.
Phase C replaces this with an original Art render under the same filename."""
import numpy as np, os
from PIL import Image, ImageDraw, ImageFilter
R = os.path.join(os.path.dirname(__file__), '..', 'assets', 'art')
src = Image.open(os.path.join(R, 'art-title.png')).convert('RGB')
k = src.width / 612.0                       # coordinates below are in 612x1024 preview space
box = (0, 0, 612, 1000)
m = Image.new('L', (612, 1024), 0); d = ImageDraw.Draw(m)
d.ellipse((60, 40, 545, 830), fill=255)                    # head/hood
d.polygon([(300, 30), (360, 0), (580, 70), (545, 245), (440, 150)], fill=255)  # hat
d.polygon([(160, 700), (520, 690), (612, 1000), (0, 1000)], fill=255)          # shoulders
m = m.filter(ImageFilter.GaussianBlur(26))
m = m.resize(src.size, Image.LANCZOS)
rgba = src.copy(); rgba.putalpha(m)
rgba = rgba.crop((0, 0, src.width, int(1000 * k))).resize((600, int(600 * 1000 * k / src.width)), Image.LANCZOS)
rgba.save(os.path.join(R, 'art.png'), optimize=True)
print(rgba.size, os.path.getsize(os.path.join(R, 'art.png')) // 1024, 'KB')
