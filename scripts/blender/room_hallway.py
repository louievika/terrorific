"""Hallway (CAM 1): a long corridor, wallpaper-and-wainscot, red runner, doors both sides, dark door at the far end."""
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
o = args(); reset(); setup_render(o, exposure=-0.5)
W, D, H = 2.5, 15.0, 2.9
floor = use('floor', mat_wood_floor, (0.15, 0.08, 0.04), 0.15, 1.5)
paper = use('wallpaper', mat_plaster, (0.30, 0.25, 0.17), 1.5)
pan = use('panel', mat_wood, (0.10, 0.055, 0.03), 18.0)
ceil = use('ceil', mat_plaster, (0.30, 0.27, 0.22), 1.8)
shell(W, D, H, floor, paper, ceil, y0=-6.0, wainscot=pan, wainscot_h=1.05, base=pan)
for y in (-6, -3.5): pass
# chair rail + runner
for sx in (-1, 1): box('rail', (sx * (W / 2 - 0.03), 1.5, 1.07), (0.06, D, 0.06), pan, bevel=0.01)
box('runner', (0, 1.5, 0.008), (1.0, D - 0.2, 0.016), use('carpet', mat_cloth, (0.22, 0.025, 0.025)), bevel=0)
for sx in (-1, 1): box('runnerhem', (sx * 0.5, 1.5, 0.012), (0.04, D - 0.2, 0.012), use('brass'), bevel=0)
# doors: left (axis X faces +x) and right (Xm faces -x), staggered
ds = use('hdoor', mat_wood, (0.1, 0.055, 0.03), 22.0)
for y in (-2.5, 1.5, 5.0): door('dl%d' % int(y), (-W / 2 + 0.02, y, 0), 0.95, 2.1, ds, axis='X')
for y in (-0.5, 3.3, 6.5): door('dr%d' % int(y * 10), (W / 2 - 0.02, y, 0), 0.95, 2.1, ds, axis='Xm')
# end of hall: a heavy dark door
door('enddoor', (0, 9.0 - 0.02, 0), 1.1, 2.3, use('enddw', mat_wood, (0.05, 0.03, 0.02), 20.0), use('dframe', mat_wood, (0.09, 0.05, 0.03)), axis='Y')
# portraits and a wall sconce (unlit)
for i, (y, sx) in enumerate(((-4.5, -1), (-1.0, 1), (3.0, -1), (4.5, 1), (7.8, -1))):
    frame_picture('pic%d' % i, (sx * (W / 2 - 0.03), y, 1.7), 0.5, 0.65, axis='X', face=1 if sx < 0 else -1)
box('sconce1', (-W / 2 + 0.05, -0.5, 1.9), (0.08, 0.1, 0.18), use('brass'), bevel=0.01)
box('sconce2', (W / 2 - 0.05, 4.2, 1.9), (0.08, 0.1, 0.18), use('brass'), bevel=0.01)
# a toppled chair and a side table, deep in the dark
table('console', (-W / 2 + 0.28, -4.0, 0), 0.5, 0.9, 0.8, use('hdoor'), rot=0)
chair('chairtip', (0.6, 4.0, 0.0), 70)
# bare bulb on a cord at y=-1
lamp_cord(0.0, -0.8, H, 2.25); bulb((0.0, -0.8, 2.15), watts=300)
camera((0, -5.0, 1.5))
render(o)
