"""Basement: brick-and-concrete cellar, coal furnace, pipes, joists, stairs, shelving, barrels."""
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
o = args(); reset(); setup_render(o, exposure=-0.2)
W, D, H = 6.5, 7.0, 2.5
floor = use('floor', mat_concrete, (0.16, 0.15, 0.13))
brick = use('brick', mat_brick, (0.25, 0.09, 0.06)); wood = use('wood', mat_wood, (0.12, 0.07, 0.04), 14.0)
iron = use('iron', mat_surface, (0.04, 0.04, 0.045), 0.5, 0.9, 5.0, 0.4); rust = use('rust', mat_surface, (0.2, 0.08, 0.035), 0.7, 0.8, 6.0, 0.6, 0.5)
shell(W, D, H, floor, brick, use('ceil', mat_wood, (0.1, 0.06, 0.035), 12.0), y0=-3.0)
by = -3.0 + D
for k in range(-3, 4): box('joist', (k * 0.9, 0.5, H - 0.12), (0.12, D, 0.22), wood, bevel=0.01)
# furnace in the middle of the back wall: big cylinder + firebox door + flues
cyl('furnace', (0.0, by - 1.1, 0.8), 0.75, 1.6, rust, seg=32)
box('firedoor', (0.0, by - 1.88, 0.55), (0.42, 0.06, 0.38), iron, bevel=0.012); box('firegrate', (0.0, by - 1.92, 0.55), (0.28, 0.02, 0.22), use('fireglow', mat_surface, (0.01, 0.005, 0.003), 0.8), bevel=0)
cyl('flue', (0.0, by - 1.1, 2.0), 0.16, 1.0, rust, seg=16)
for sx in (-1, 1): cyl('pipe%d' % sx, (sx * 0.55, by - 1.0, 2.0), 0.05, 1.0, iron, seg=12)
cyl('mainpipe', (0.0, 0.0, 2.2), 0.07, W, iron, rot=(0, 90, 0), seg=12)
cyl('pipe2', (-2.4, 0.0, 2.1), 0.05, D, iron, rot=(90, 0, 0), seg=12)
box('coal', (2.2, by - 0.7, 0.3), (1.2, 1.0, 0.6), use('coalm', mat_surface, (0.015, 0.015, 0.015), 0.6, 0.0, 30.0, 0.5, 1.2))
# stairs up on the right side, to a door
for i in range(9): box('stair%d' % i, (W / 2 - 0.55, -0.6 + i * 0.28, (0.1 + i * 0.2) / 2), (1.0, 0.28, 0.1 + i * 0.2), wood, bevel=0.01)
box('stairwallrail', (W / 2 - 1.1, 0.7, 1.0), (0.05, 3.0, 0.06), wood)
# shelves w/ jars on the left wall
for z in (0.5, 1.0, 1.5): box('shelf', (-W / 2 + 0.2, 0.8, z), (0.35, 2.2, 0.04), wood)
for i in range(11):
    for z in (0.5, 1.0, 1.5):
        if (i + int(z * 4)) % 3: cyl('jar', (-W / 2 + 0.2, -0.2 + i * 0.2, z + 0.1), 0.045, 0.16, use('jarg', mat_surface, (0.12, 0.09, 0.03), 0.15, 0.0, 12.0, 0.5, 0.1, 1.0), seg=12)
barrel('b1', (-2.0, 2.0, 0)); barrel('b2', (-1.35, 2.3, 0)); crate('cr1', (1.6, 0.2, 0), 0.6, 18); crate('cr2', (1.6, 0.2, 0.6), 0.45, -8)
box('workbench', (-1.0, -2.0, 0.45), (1.8, 0.7, 0.05), wood)
for sx in (-1, 1):
    for sy in (-1, 1): box('wl', (-1.0 + sx * 0.8, -2.0 + sy * 0.3, 0.22), (0.06, 0.06, 0.44), wood)
box('vice', (-1.6, -2.0, 0.54), (0.1, 0.12, 0.12), iron)
door('cellardoor', (-1.5, -3.0 + 0.02, 0), 0.9, 2.0, use('cdw', mat_wood, (0.09, 0.05, 0.03), 22.0), axis='Yb')
sheet_cover('cloth', (2.4, 2.3, 0), (0.9, 0.9, 0.7))
lamp_cord(0.0, -0.4, H, 2.0); bulb((0.0, -0.4, 1.92), watts=330)
camera((0, -1.4, 1.5))
render(o)
