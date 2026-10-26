"""Kitchen (CAM 2): cast-iron range, sink, deal table, tile backsplash, hanging pots."""
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
o = args(); reset(); setup_render(o, exposure=-0.4)
W, D, H = 5.2, 5.4, 2.8
floor = use('floor', mat_tile, (0.32, 0.30, 0.24), 0.2, (0.03, 0.03, 0.03))
wall = use('wall', mat_plaster, (0.33, 0.35, 0.28), 1.6)
tile = use('tile', mat_tile, (0.46, 0.5, 0.45), 0.1)
wood = use('wood', mat_wood, (0.13, 0.075, 0.04)); iron = use('iron', mat_surface, (0.05, 0.05, 0.055), 0.45, 0.9, 6.0, 0.4)
enamel = use('enamel', mat_surface, (0.55, 0.55, 0.5), 0.25, 0.0, 5.0, 0.3, 0.4)
shell(W, D, H, floor, wall, use('ceil', mat_plaster, (0.28, 0.27, 0.2), 1.8), y0=-2.2, base=wood)
by = -2.2 + D                                          # back wall y
box('backsplash', (0, by - 0.03, 1.25), (W - 0.1, 0.05, 1.0), tile, bevel=0.003)
# range (stove) in the middle of the back wall
box('range', (0, by - 0.42, 0.45), (0.95, 0.75, 0.9), iron, bevel=0.02)
for i in range(4): cyl('burner%d' % i, (-0.25 + (i % 2) * 0.5, by - 0.42 + (i // 2 - 0.5) * 0.3, 0.915), 0.1, 0.015, use('burnerb', mat_surface, (0.02, 0.02, 0.02), 0.6), seg=20)
box('oven', (0, by - 0.8, 0.4), (0.7, 0.04, 0.45), use('ovenglass', mat_surface, (0.01, 0.01, 0.012), 0.1), bevel=0.01)
box('hood', (0, by - 0.4, 2.0), (1.2, 0.7, 0.5), iron, bevel=0.03); cyl('flue', (0, by - 0.35, 2.55), 0.18, 0.6, iron, seg=16)
# counters + sink left, cupboards right
for sx in (-1, 1):
    box('counter%d' % sx, (sx * 1.9, by - 0.35, 0.45), (1.9, 0.65, 0.9), wood, bevel=0.01)
    box('ctop%d' % sx, (sx * 1.9, by - 0.35, 0.92), (1.95, 0.7, 0.05), use('ctopm', mat_surface, (0.5, 0.5, 0.46), 0.3, 0.0, 6.0, 0.3), bevel=0.006)
box('sink', (-1.9, by - 0.35, 0.93), (0.7, 0.45, 0.04), use('sinkdark', mat_surface, (0.02, 0.02, 0.02), 0.2), bevel=0.01)
cyl('tap', (-1.9, by - 0.6, 1.15), 0.015, 0.4, use('brass'), seg=8); cyl('tapspout', (-1.9, by - 0.5, 1.33), 0.015, 0.25, use('brass'), rot=(90, 0, 0), seg=8)
for sx in (-1, 1): box('upper%d' % sx, (sx * 1.9, by - 0.2, 1.95), (1.9, 0.35, 0.8), wood, bevel=0.01)
# hanging pots
rack = box('potrack', (0.0, by - 1.0, 2.35), (1.4, 0.04, 0.04), iron)
for i, x in enumerate((-0.5, -0.15, 0.2, 0.55)):
    cyl('pot%d' % i, (x, by - 1.0, 2.05 - 0.04 * i), 0.1 + 0.02 * (i % 2), 0.15, iron, seg=20); box('hook', (x, by - 1.0, 2.28), (0.01, 0.01, 0.12), iron)
# deal table + chairs, centre room
table('dealtable', (0.0, 0.4, 0), 1.8, 0.95, 0.78, wood)
for sx, r in ((-1, 90), (1, -90)): chair('kc%d' % sx, (sx * 1.15, 0.4, 0), r)
chair('kcf', (-0.4, -0.4, 0), 175); chair('kcb', (0.5, 1.4, 0), 5)
box('bowl', (0.3, 0.45, 0.82), (0.28, 0.28, 0.06), enamel, bevel=0.02); box('knifeblock', (-0.4, 0.5, 0.88), (0.12, 0.1, 0.2), wood)
# fridge (old rounded) left corner, door to the right wall
box('fridge', (-W / 2 + 0.45, 0.6, 0.85), (0.8, 0.8, 1.7), enamel, bevel=0.06); box('fridgeh', (-W / 2 + 0.88, 0.2, 1.1), (0.04, 0.04, 0.4), use('iron'))
door('kdoor', (W / 2 - 0.02, 0.9, 0), 0.9, 2.05, use('hdoor', mat_wood, (0.1, 0.055, 0.03), 22.0), axis='Xm')
window_boards('kwin', (-W / 2 + 0.1, -0.6, 1.5), 1.0, 1.1, axis='X')
sheet = box('rug', (0.0, 0.4, 0.006), (2.4, 1.6, 0.012), use('rug', mat_cloth, (0.18, 0.05, 0.04)), bevel=0)
lamp_cord(0.0, 0.2, H, 2.3); bulb((0.0, 0.2, 2.2), watts=320)
camera((0, -1.2, 1.5))
render(o)
