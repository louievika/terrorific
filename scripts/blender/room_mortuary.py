"""Mortuary: tiled room, steel slabs under sheets, drawer wall of cold storage, floor drain."""
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
o = args(); reset(); setup_render(o, exposure=-0.4)
W, D, H = 5.4, 6.4, 3.0
floor = use('floor', mat_tile, (0.30, 0.31, 0.27), 0.3, (0.03, 0.03, 0.025))
wall = use('wall', mat_tile, (0.5, 0.53, 0.47), 0.15)
upper = use('upper', mat_plaster, (0.33, 0.35, 0.3), 1.8)
steel = use('steel', mat_surface, (0.42, 0.44, 0.45), 0.28, 1.0, 10.0, 0.4, 0.3)
shell(W, D, H, floor, upper, use('ceil', mat_concrete, (0.2, 0.2, 0.18)), y0=-2.6, wainscot=wall, wainscot_h=1.9)
by = -2.6 + D
# cold storage: 3x3 steel drawer doors in the back wall (centre), two left open a crack
for i in range(3):
    for j in range(3):
        x = (i - 1) * 0.72; z = 0.55 + j * 0.62
        box('drawer', (x, by - 0.06, z), (0.66, 0.1, 0.56), steel, bevel=0.012)
        box('dhandle', (x, by - 0.13, z), (0.2, 0.03, 0.03), use('iron', mat_surface, (0.06, 0.06, 0.06), 0.5, 0.9), bevel=0.004)
box('drawerframe', (0, by - 0.04, 1.2), (2.35, 0.06, 2.0), use('frame', mat_surface, (0.12, 0.12, 0.12), 0.5, 0.9), bevel=0.005)
box('drawerout', (-0.72, by - 0.55, 1.17), (0.62, 1.0, 0.04), steel, bevel=0.01)             # slid-out tray
sheet_cover('trayform', (-0.72, by - 0.55, 1.19), (0.5, 0.9, 0.14), rot=0)
# two slabs, one with a covered form
for k, (x, y) in enumerate(((-1.55, 0.7), (1.55, 0.2))):
    box('slab%d' % k, (x, y, 0.88), (0.85, 2.1, 0.05), steel, bevel=0.01)
    for sx in (-1, 1): box('slableg', (x + sx * 0.35, y, 0.43), (0.05, 1.9, 0.86), steel, bevel=0.005)
    box('slabbar', (x, y, 0.2), (0.7, 0.04, 0.04), steel)
sheet_cover('body1', (-1.55, 0.7, 0.9), (0.55, 1.75, 0.22), rot=0)
sheet_cover('body2', (1.55, 0.2, 0.9), (0.55, 1.75, 0.2), rot=0)
# drain + hose, trolley with instruments, sink, bucket
cyl('drain', (0, 0.0, 0.004), 0.16, 0.008, use('iron'), seg=24)
box('trolley', (0.1, -1.0, 0.45), (0.7, 0.45, 0.04), steel); box('trolley2', (0.1, -1.0, 0.1), (0.7, 0.45, 0.03), steel)
for sx in (-1, 1):
    for sy in (-1, 1): box('tl', (0.1 + sx * 0.32, -1.0 + sy * 0.2, 0.27), (0.025, 0.025, 0.54), steel)
for i in range(4): box('tool%d' % i, (-0.1 + i * 0.09, -1.0, 0.475), (0.03, 0.18, 0.012), steel, rot=(0, 0, i * 11 - 15))
cyl('bucket', (2.0, -1.4, 0.18), 0.17, 0.36, steel, seg=20, r2=0.2)
box('sinkb', (-W / 2 + 0.35, -1.5, 0.45), (0.6, 1.1, 0.9), steel); box('sinkbasin', (-W / 2 + 0.35, -1.5, 0.92), (0.5, 0.9, 0.04), use('sinkdark', mat_surface, (0.02, 0.02, 0.02), 0.2))
cyl('sinktap', (-W / 2 + 0.2, -1.5, 1.15), 0.015, 0.4, use('brass'), seg=8)
door('mdoor', (W / 2 - 0.02, -1.0, 0), 1.1, 2.2, use('mdw', mat_surface, (0.18, 0.2, 0.17), 0.6, 0.6, 7.0, 0.4), use('mdf', mat_surface, (0.1, 0.1, 0.1), 0.6, 0.6), axis='Xm', panels=False)
box('mdwin', (W / 2 - 0.06, -1.0, 1.6), (0.02, 0.35, 0.3), use('void'), bevel=0.004)
frame_picture('chart', (-W / 2 + 0.03, 1.5, 1.7), 0.5, 0.65, axis='X', face=1, art=(0.12, 0.12, 0.1))
lamp_cord(0.0, 0.3, H, 2.5); bulb((0.0, 0.3, 2.42), watts=380)
camera((0, -1.8, 1.5))
render(o)
