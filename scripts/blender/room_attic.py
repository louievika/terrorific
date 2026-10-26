"""Attic (the office). Door dead ahead (+Y), fuse box on the right (yaw -62), slide-bolt hatch on the left (yaw +62)."""
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
o = args(); reset(); setup_render(o, exposure=-0.5)
W, D = 6.0, 5.6; EZ, RZ = 1.9, 3.7                      # eave height, ridge height
floor = use('floor', mat_wood_floor, (0.17, 0.09, 0.04), 0.15, 1.4)
plaster = use('plaster', mat_plaster, (0.40, 0.34, 0.25), 1.3)
roofw = use('roofboards', mat_wood, (0.16, 0.09, 0.045), 14.0)
beam = use('beam', mat_wood, (0.10, 0.055, 0.03), 10.0)
iron = use('iron', mat_surface, (0.07, 0.07, 0.075), 0.5, 0.9, 7.0, 0.4)
# structure
box('floor', (0, 0, -0.1), (W + 0.4, D + 0.4, 0.2), floor, bevel=0)
for sx in (-1, 1): box('knee%d' % sx, (sx * (W / 2 + 0.1), 0, EZ / 2), (0.2, D + 0.4, EZ), plaster, bevel=0)
pent = [(-W / 2, 0), (W / 2, 0), (W / 2, EZ), (0, RZ), (-W / 2, EZ)]
poly_prism('gable_front', pent, 0.2, plaster, loc=(0, D / 2 + 0.1, 0)); poly_prism('gable_back', pent, 0.2, plaster, loc=(0, -D / 2 - 0.1, 0))
import math as m
ang = m.degrees(m.atan2(RZ - EZ, W / 2)); sl = m.hypot(W / 2, RZ - EZ)
for sx in (-1, 1):
    th = sx * ang; r = m.radians(th)
    cx, cz = sx * W / 4, (EZ + RZ) / 2
    box('roof%d' % sx, (cx + sx * 0.0, 0, cz + 0.045), (sl + 0.25, D + 0.4, 0.09), roofw, rot=(0, th, 0), bevel=0)
    nrm = (-m.sin(r), 0, -m.cos(r))
    for k in range(-2, 3):
        box('raft', (cx + nrm[0] * 0.08, k * 1.0, cz + nrm[2] * 0.08), (sl, 0.09, 0.16), beam, rot=(0, th, 0), bevel=0.006)
box('ridge', (0, 0, RZ - 0.12), (0.14, D, 0.18), beam)
for k in range(-2, 3): box('collar', (0, k * 1.0, 2.95), (2.4, 0.08, 0.1), beam)
for sx in (-1, 1): box('plate', (sx * (W / 2 - 0.06), 0, EZ - 0.05), (0.12, D, 0.14), beam)
# the door (front), iron-banded, with a spyhole
door('maindoor', (0, D / 2 - 0.02, 0), 1.15, 2.25, use('doorwood', mat_wood, (0.11, 0.065, 0.038), 20.0), use('dframe', mat_wood, (0.1, 0.06, 0.035)))
for z in (0.35, 1.0, 1.75): box('strap', (0, D / 2 - 0.06, z), (1.12, 0.012, 0.1), iron, bevel=0.003)
box('lock', (0.4, D / 2 - 0.065, 1.05), (0.14, 0.03, 0.22), iron, bevel=0.004)
sphere('doorknob', (0.4, D / 2 - 0.09, 0.98), 0.04, use('brass'))
# fuse box, on the RIGHT wall (yaw -62 from the camera)
box('fusebox', (W / 2 - 0.05, 1.15, 1.35), (0.06, 0.42, 0.55), use('fuseenamel', mat_surface, (0.09, 0.1, 0.09), 0.45, 0.6, 8.0, 0.5), bevel=0.01)
box('fusedoor', (W / 2 - 0.09, 1.15, 1.35), (0.02, 0.36, 0.48), iron, bevel=0.004)
for i in range(3): box('fuse', (W / 2 - 0.1, 1.03 + i * 0.12, 1.5), (0.02, 0.05, 0.1), use('porc', mat_surface, (0.3, 0.28, 0.24), 0.3), bevel=0.004)
box('lever', (W / 2 - 0.12, 1.15, 1.22), (0.03, 0.04, 0.2), iron, rot=(0, 0, 0), bevel=0.003)
# slide-bolt hatch, on the LEFT wall (yaw +62)
box('hatch', (-W / 2 + 0.03, 1.15, 0.85), (0.05, 0.8, 1.4), use('hatchwood', mat_wood, (0.09, 0.05, 0.03), 26.0), bevel=0.006)
box('bolt_plate', (-W / 2 + 0.07, 1.15, 0.9), (0.02, 0.1, 0.45), iron, bevel=0.003)
cyl('bolt', (-W / 2 + 0.09, 1.15, 0.92), 0.014, 0.34, use('boltsteel', mat_surface, (0.45, 0.45, 0.46), 0.3, 1.0), rot=(0, 0, 0))
# furniture
desk_m = use('deskwood', mat_wood, (0.12, 0.065, 0.035))
table('desk', (-1.05, 0.55, 0), 1.7, 0.8, 0.76, desk_m)
box('crt', (-1.05, 0.55, 1.08), (0.5, 0.46, 0.4), use('crtplastic', mat_surface, (0.11, 0.1, 0.085), 0.5, 0.0, 14.0, 0.2), bevel=0.02)
box('crtglass', (-1.05, 0.31, 1.08), (0.38, 0.02, 0.3), use('glass', mat_surface, (0.01, 0.012, 0.012), 0.08, 0.0, 3.0, 0.05, 0.05, 1.0), bevel=0.01)
box('phone', (-1.6, 0.5, 0.82), (0.24, 0.2, 0.09), use('phoneb', mat_surface, (0.03, 0.03, 0.03), 0.35), bevel=0.02)
cyl('dial', (-1.6, 0.5, 0.875), 0.055, 0.015, use('brass'), seg=24)
chair('deskchair', (-0.95, -0.6, 0), 190)
# left side: iron bed under a dust sheet, wardrobe, trunk
sheet_cover('sheetbed', (-1.9, -1.0, 0.0), (1.1, 2.1, 0.8), rot=0)
box('wardrobe', (-W / 2 + 0.4, -1.9, 1.0), (0.7, 1.3, 2.0), use('wardwood', mat_wood, (0.09, 0.05, 0.03), 12.0), bevel=0.012)
box('trunk', (-1.2, 1.7, 0.25), (0.9, 0.55, 0.5), use('trunkb', mat_wood, (0.12, 0.07, 0.04), 16.0), bevel=0.02)
box('trunkband', (-1.2, 1.7, 0.38), (0.92, 0.57, 0.05), iron, bevel=0.005)
crate('c1', (1.8, 2.0, 0), 0.55, 20); crate('c2', (1.8, 2.0, 0.55), 0.42, -12); crate('c3', (2.4, 1.7, 0), 0.5, 5)
barrel('barrel', (-2.4, 2.1, 0))
sheet_cover('sheetchair', (2.2, -1.2, 0), (0.7, 0.7, 1.0))
# rocking chair-ish silhouette + framed portrait on the left slope-wall + boarded round gable window at the back
frame_picture('portrait', (-W / 2 + 0.03, -0.6, 1.35), 0.55, 0.75, axis='X', face=1)
window_boards('gablewin', (0, -D / 2 + 0.11, 2.4), 0.8, 0.8)
# bulb on a cord from the ridge, hard tungsten
lamp_cord(0.0, 0.3, RZ - 0.15, 2.55)
bulb((0.0, 0.3, 2.45), watts=380)
camera((0, -0.5, 1.3))
render(o)
