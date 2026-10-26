#!/usr/bin/env python3
"""Procedural equirectangular room plates (placeholder art, original, MIT).
Ray-casts a box room per pixel and shades floor/ceiling/walls with simple procedural textures.
Run: python3 scripts/make_rooms.py   ->  assets/rooms/<name>.jpg (2048x1024)
Phase C replaces these with Blender renders; same filenames."""
import numpy as np, os, sys
from PIL import Image, ImageFilter
W, H = 2048, 1024
EYE = 1.5
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'rooms')

def hsh(ix, iy, seed):
    n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    n ^= n >> 16
    return (n & 0xFFFF) / 65535.0

def vn(u, v, s, seed=0):
    x, y = u * s, v * s
    ix, iy = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    fx, fy = x - ix, y - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = hsh(ix, iy, seed), hsh(ix + 1, iy, seed)
    c, d = hsh(ix, iy + 1, seed), hsh(ix + 1, iy + 1, seed)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

def fbm(u, v, s, seed=0, o=4):
    t, amp, tot = 0, 1.0, 0
    for i in range(o):
        t = t + amp * vn(u, v, s * (2 ** i), seed + i); tot += amp; amp *= 0.5
    return t / tot

def rect(u, v, x0, x1, y0, y1):
    return (u >= x0) & (u <= x1) & (v >= y0) & (v <= y1)

def col(c):
    return np.array(c, dtype=np.float32) / 255.0

def paint(img, m, c):
    c = np.asarray(c, dtype=np.float32)
    if c.ndim == 1: img[m] = c
    else: img[m] = c[m]

ROOMS = {}
def room(name, w, d, h, light, tint, amb):
    def deco(fn):
        ROOMS[name] = dict(w=w, d=d, h=h, light=light, tint=tint, amb=amb, fn=fn); return fn
    return deco

# surface fns: fn(surf, u, v, P) -> rgb (N,3). surf in floor/ceil/xp/xn/zp/zn ; u,v surface coords (v = height above floor on walls)
def planks(u, v, wd, c1, c2, seed):
    k = np.floor(u / wd); f = u / wd - k
    n = hsh(k.astype(np.int64), np.zeros_like(k, dtype=np.int64), seed)[..., None]
    base = c1 * (1 - n) + c2 * n
    grain = fbm(u * 3, v * 0.5, 9, seed)[..., None]
    base = base * (0.65 + 0.7 * grain)
    gap = (f < 0.03)[..., None]
    return np.where(gap, base * 0.2, base)

def tiles(u, v, sz, c1, c2, seed, grout=0.03, checker=False):
    iu, iv = np.floor(u / sz), np.floor(v / sz)
    fu, fv = u / sz - iu, v / sz - iv
    n = hsh(iu.astype(np.int64), iv.astype(np.int64), seed)[..., None]
    if checker: base = np.where((((iu + iv) % 2) == 0)[..., None], c1, c2) * (0.85 + 0.3 * n)
    else: base = (c1 * (1 - n) + c2 * n)
    g = ((fu < grout) | (fv < grout))[..., None]
    return np.where(g, base * 0.25, base)

@room('attic', 6, 8, 2.9, (0, 2.5, 0), (1.0, 0.85, 0.7), 0.10)
def attic(s, u, v, P):
    n = len(u)
    if s == 'floor': return planks(u, v, 0.28, col((70, 48, 30)), col((95, 66, 40)), 3)
    if s == 'ceil':
        c = planks(u, v, 0.3, col((40, 30, 22)), col((58, 42, 30)), 5)
        beam = ((np.floor(P[:, 0] / 1.0) * 1.0 + 0.5 - P[:, 0]) ** 2 < 0.012)[:, None]
        return np.where(beam, col((22, 15, 10)), c)
    c = planks(v, u, 0.25, col((62, 46, 34)), col((84, 62, 44)), 7)  # vertical boards
    if s == 'zn':  # door wall (-z): the door the player locks
        door = rect(u, v, -0.55, 0.55, 0.0, 2.05)
        frame = rect(u, v, -0.68, 0.68, 0.0, 2.18) & ~door
        c = np.where(frame[:, None], col((25, 16, 10)), c)
        dc = planks(u, v, 0.18, col((40, 26, 16)), col((52, 34, 20)), 11)
        panel = rect(u, v, -0.4, 0.4, 0.25, 0.95) | rect(u, v, -0.4, 0.4, 1.1, 1.85)
        dc = np.where(panel[:, None], dc * 0.7, dc)
        c = np.where(door[:, None], dc, c)
        c = np.where(rect(u, v, 0.38, 0.46, 0.95, 1.08)[:, None], col((190, 150, 70)), c)
    if s == 'xp':
        win = (u ** 2 + (v - 1.6) ** 2) < 0.42 ** 2
        c = np.where(win[:, None], col((120, 150, 190)) * (0.6 + 0.4 * fbm(u, v, 4, 2)[:, None]), c)
        ring = ((u ** 2 + (v - 1.6) ** 2) < 0.5 ** 2) & ~win
        c = np.where(ring[:, None], col((20, 14, 10)), c)
        bar = win & ((np.abs(u) < 0.025) | (np.abs(v - 1.6) < 0.025))
        c = np.where(bar[:, None], col((18, 12, 9)), c)
    if s in ('zp', 'xn'):  # crates + sheet-covered furniture
        for i, (a, b, hh) in enumerate([(-2.2, -1.0, 0.8), (-0.6, 0.5, 1.3), (1.0, 2.3, 0.6)]):
            m = rect(u, v, a, b, 0, hh)
            c = np.where(m[:, None], planks(u * 1.3, v, 0.22, col((90, 80, 60)), col((110, 96, 70)), 21 + i) * 0.9, c)
            if i == 1: c = np.where(m[:, None], col((150, 148, 140)) * (0.5 + 0.5 * fbm(u, v, 5, 4)[:, None]), c)
    return c

@room('hallway', 2.2, 14, 2.6, (0, 2.3, -2), (1.0, 0.82, 0.62), 0.07)
def hallway(s, u, v, P):
    if s == 'floor':
        c = col((95, 22, 28)) * (0.6 + 0.6 * fbm(u, v, 6, 1)[:, None])
        edge = (np.abs(P[:, 0]) > 0.7)[:, None]
        return np.where(edge, planks(P[:, 0] * 2, P[:, 2], 0.3, col((50, 36, 24)), col((70, 50, 34)), 9), c)
    if s == 'ceil': return col((120, 112, 98)) * (0.5 + 0.5 * fbm(u, v, 3, 3)[:, None])
    stripe = (np.floor(u / 0.18) % 2 == 0)[:, None]
    c = np.where(stripe, col((110, 90, 68)), col((92, 72, 54))) * (0.6 + 0.5 * fbm(u, v, 5, 6)[:, None])
    c = np.where((v < 0.9)[:, None], col((60, 40, 28)) * (0.7 + 0.5 * fbm(u, v, 8, 8)[:, None]), c)
    c = np.where((np.abs(v - 0.9) < 0.04)[:, None], col((30, 20, 14)), c)
    if s in ('xp', 'xn'):
        for k, z in enumerate([-5.0, -2.5, 0.8, 3.5]):
            m = rect(u, v, z - 0.45, z + 0.45, 0, 2.0)
            c = np.where(m[:, None], planks(v, u, 0.2, col((44, 30, 20)), col((58, 40, 26)), 31 + k) * (0.8 if (k % 2) else 1), c)
            c = np.where(rect(u, v, z + 0.28, z + 0.34, 0.9, 1.0)[:, None], col((180, 140, 60)), c)
            fr = rect(u, v, z + 1.0, z + 1.5, 1.2, 1.7) if k % 2 else rect(u, v, z - 1.4, z - 0.95, 1.2, 1.7)
            c = np.where(fr[:, None], col((24, 18, 14)), c)
    if s == 'zn':  # far end: tall dark doorway
        m = rect(u, v, -0.6, 0.6, 0, 2.2)
        c = np.where(m[:, None], col((6, 6, 8)) * (0.5 + 0.8 * fbm(u, v, 3, 5)[:, None]), c)
    if s == 'zp':  # behind (toward the attic stairs)
        m = rect(u, v, -0.6, 0.6, 0, 2.2)
        c = np.where(m[:, None], col((34, 24, 18)), c)
    return c

@room('kitchen', 5, 5, 2.6, (0, 2.3, 0), (0.9, 1.0, 0.75), 0.08)
def kitchen(s, u, v, P):
    if s == 'floor': return tiles(u, v, 0.45, col((190, 186, 170)), col((34, 32, 30)), 2, 0.025, True) * (0.6 + 0.5 * fbm(u, v, 5, 3)[:, None])
    if s == 'ceil': return col((130, 124, 100)) * (0.5 + 0.5 * fbm(u, v, 4, 2)[:, None])
    wall = col((150, 150, 100)) * (0.55 + 0.6 * fbm(u, v, 4, 7)[:, None])
    tl = tiles(u, v, 0.18, col((200, 200, 188)), col((170, 172, 160)), 4, 0.04) * (0.6 + 0.5 * fbm(u, v, 6, 9)[:, None])
    c = np.where((v < 1.3)[:, None] & (v > 0.9)[:, None], tl, wall)
    c = np.where((v < 0.9)[:, None], col((70, 54, 40)) * (0.7 + 0.5 * fbm(u, v, 7, 11)[:, None]), c)  # lower cabinets
    c = np.where((np.abs(v - 0.9) < 0.04)[:, None], col((190, 188, 180)), c)
    c = np.where(rect(u, v, -9, 9, 1.8, 2.5)[:, None] & (np.floor(u / 0.6) % 2 == 0)[:, None], col((66, 50, 36)), c)
    if s == 'xn':
        win = rect(u, v, -0.7, 0.7, 1.2, 2.1)
        c = np.where(win[:, None], col((10, 16, 34)) * (0.7 + 0.6 * fbm(u, v, 4, 3)[:, None]), c)
        c = np.where((win & ((np.abs(u) < 0.03) | (np.abs(v - 1.65) < 0.03)))[:, None], col((190, 188, 180)), c)
    if s == 'zn':
        fr = rect(u, v, -0.8, 0.2, 0, 1.9)
        c = np.where(fr[:, None], col((205, 205, 200)) * (0.5 + 0.5 * fbm(u, v, 9, 3)[:, None]), c)
        c = np.where(rect(u, v, 0.1, 0.14, 0.9, 1.4)[:, None], col((60, 60, 60)), c)
        st = rect(u, v, 0.6, 1.5, 0, 0.92)
        c = np.where(st[:, None], col((24, 24, 26)), c)
    if s == 'xp':
        c = np.where(rect(u, v, -0.4, 0.4, 0.88, 1.0)[:, None], col((170, 172, 170)), c)  # sink
    return c

@room('basement', 6, 6, 2.4, (0, 2.1, 0), (0.75, 0.9, 1.0), 0.05)
def basement(s, u, v, P):
    cc = col((86, 88, 86)) * (0.45 + 0.8 * fbm(u * 1.2, v * 1.2, 5, 4)[:, None])
    cc = cc * (0.75 + 0.5 * vn(u, v, 40, 8)[:, None])
    if s == 'floor':
        cc = np.where((P[:, 0] ** 2 + P[:, 2] ** 2 < 0.09)[:, None], col((10, 10, 10)), cc)
        return np.where(fbm(u, v, 3, 6)[:, None] > 0.62, col((26, 34, 40)), cc)
    if s == 'ceil':
        for i, x in enumerate([-1.8, -0.6, 0.9]):
            pipe = (np.abs(P[:, 0] - x) < 0.09)[:, None]
            cc = np.where(pipe, col((90, 64, 40)) * (0.5 + 0.8 * (1 - np.abs(P[:, 0] - x) / 0.09)[:, None]), cc)
        return cc * 0.7
    cc = np.where(((np.floor(u / 1.2) + 0.5 - u / 1.2) ** 2 < 0.0016)[:, None] & (v < 2.4)[:, None], cc * 0.55, cc)  # block seams
    if s == 'zp':
        m = rect(u, v, -1.4, -0.2, 0, 1.6)
        cc = np.where(m[:, None], col((70, 60, 54)) * (0.6 + 0.6 * fbm(u, v, 12, 3)[:, None]), cc)
        cc = np.where(rect(u, v, -1.2, -0.4, 1.0, 1.3)[:, None], col((20, 20, 20)), cc)
    if s == 'xn':
        for k in range(8):  # stairs silhouette
            cc = np.where(rect(u, v, -2.4 + k * 0.3, 2.9, 0, 0.2 + k * 0.28)[:, None], col((44, 36, 30)), cc)
    if s == 'xp':
        cc = np.where(rect(u, v, 0.8, 1.6, 1.5, 1.9)[:, None], col((8, 12, 20)), cc)  # grimy window
    return cc

@room('mortuary', 5, 6, 2.7, (0, 2.5, 0), (0.75, 1.0, 0.95), 0.10)
def mortuary(s, u, v, P):
    if s == 'floor':
        return tiles(u, v, 0.3, col((120, 130, 124)), col((100, 108, 104)), 3, 0.03) * (0.5 + 0.7 * fbm(u, v, 5, 3)[:, None])
    if s == 'ceil': return col((150, 160, 156)) * (0.4 + 0.5 * fbm(u, v, 4, 3)[:, None])
    c = tiles(u, v, 0.15, col((170, 182, 176)), col((150, 162, 156)), 4, 0.05) * (0.5 + 0.6 * fbm(u, v, 6, 9)[:, None])
    c = np.where((v > 2.0)[:, None], col((70, 100, 96)) * (0.7 + 0.5 * fbm(u, v, 5, 2)[:, None]), c)
    if s == 'zn':
        for r in range(3):
            for k in range(4):
                x0 = -2.0 + k * 1.0; y0 = 0.15 + r * 0.8
                m = rect(u, v, x0, x0 + 0.88, y0, y0 + 0.7)
                c = np.where(m[:, None], col((150, 156, 158)) * (0.65 + 0.5 * vn(u, v, 20, k + r * 7)[:, None]), c)
                c = np.where(rect(u, v, x0 + 0.34, x0 + 0.54, y0 + 0.44, y0 + 0.5)[:, None], col((40, 40, 44)), c)
    if s == 'xp':
        c = np.where(rect(u, v, -0.4, 0.6, 0, 2.1)[:, None], col((80, 90, 90)), c)
        c = np.where(rect(u, v, -0.25, 0.45, 0.2, 1.9)[:, None], col((10, 14, 14)), c)
    return c

@room('frontdoor', 3, 5, 2.6, (0, 2.3, 0), (1.0, 0.9, 0.78), 0.06)
def frontdoor(s, u, v, P):
    if s == 'floor': return tiles(u, v, 0.4, col((120, 90, 60)), col((90, 64, 42)), 3, 0.03) * (0.5 + 0.6 * fbm(u, v, 5, 3)[:, None])
    if s == 'ceil': return col((100, 94, 84)) * (0.5 + 0.5 * fbm(u, v, 4, 3)[:, None])
    c = col((120, 100, 80)) * (0.55 + 0.6 * fbm(u, v, 5, 7)[:, None])
    c = np.where((v < 0.95)[:, None], col((64, 44, 30)) * (0.7 + 0.5 * fbm(u, v, 7, 9)[:, None]), c)
    if s == 'zn':  # the big front door, chained
        m = rect(u, v, -0.7, 0.7, 0, 2.3)
        dc = planks(v, u, 0.22, col((54, 34, 20)), col((72, 46, 28)), 14)
        c = np.where(m[:, None], dc, c)
        c = np.where(rect(u, v, -0.1, 0.1, 1.6, 2.0)[:, None], col((190, 210, 235)) * (0.5 + 0.5 * fbm(u, v, 5, 3)[:, None]), c)  # peephole window glow
        c = np.where(rect(u, v, -0.7, 0.7, 1.2, 1.26)[:, None], col((90, 90, 96)), c)  # chain bar
        c = np.where(rect(u, v, 0.45, 0.55, 0.95, 1.05)[:, None], col((200, 160, 70)), c)
    if s == 'xp':
        c = np.where(rect(u, v, -0.3, 0.3, 0.0, 1.9)[:, None], col((26, 18, 14)), c)  # coat rack
        for k in range(3): c = np.where(rect(u, v, -0.28 + k * 0.2, -0.12 + k * 0.2, 0.4, 1.7)[:, None], col((18, 18, 22)), c)
    return c

def render(name, spec):
    w, d, h = spec['w'], spec['d'], spec['h']
    x = (np.arange(W) + .5) / W; y = (np.arange(H) + .5) / H
    th = (x * 2 - 1) * np.pi; ph = (0.5 - y) * np.pi
    TH, PH = np.meshgrid(th, ph)
    dx = (np.cos(PH) * np.sin(TH)).ravel(); dy = np.sin(PH).ravel(); dz = (-np.cos(PH) * np.cos(TH)).ravel()
    inf = 1e9
    with np.errstate(divide='ignore', invalid='ignore'):
        tx = np.where(dx > 0, (w / 2) / dx, np.where(dx < 0, (-w / 2) / dx, inf))
        tz = np.where(dz > 0, (d / 2) / dz, np.where(dz < 0, (-d / 2) / dz, inf))
        ty = np.where(dy > 0, (h - EYE) / dy, np.where(dy < 0, (-EYE) / dy, inf))
    t = np.minimum(np.minimum(tx, tz), ty)
    P = np.stack([dx * t, dy * t, dz * t], 1)
    img = np.zeros((W * H, 3), dtype=np.float32)
    surfs = {
        'floor': (ty <= tx) & (ty <= tz) & (dy < 0), 'ceil': (ty <= tx) & (ty <= tz) & (dy >= 0),
        'xp': (tx < ty) & (tx <= tz) & (dx > 0), 'xn': (tx < ty) & (tx <= tz) & (dx <= 0),
        'zp': (tz < ty) & (tz < tx) & (dz > 0), 'zn': (tz < ty) & (tz < tx) & (dz <= 0)}
    for s, m in surfs.items():
        if not m.any(): continue
        Pm = P[m]
        if s in ('floor', 'ceil'): u, v = Pm[:, 0], Pm[:, 2]
        elif s in ('xp', 'xn'): u, v = Pm[:, 2], Pm[:, 1] + EYE
        else: u, v = Pm[:, 0], Pm[:, 1] + EYE
        img[m] = spec['fn'](s, u.astype(np.float64), v.astype(np.float64), Pm.astype(np.float64))
    # lighting: warm point light + ambient, falloff
    L = np.array([spec['light'][0], h - EYE - 0.25, spec['light'][2]], dtype=np.float64)
    dist2 = ((P - L) ** 2).sum(1)
    lum = (spec['amb'] * 2.2 + 4.0 / (1.0 + dist2 * 0.5))
    # soft contact darkening near edges (ambient occlusion-ish)
    ao = np.clip(np.minimum(np.minimum(np.abs(np.abs(P[:, 0]) - w / 2), np.abs(np.abs(P[:, 2]) - d / 2)), np.minimum(np.abs(P[:, 1] + EYE), np.abs(h - EYE - P[:, 1]))) * 2.2, 0.35, 1.0)
    img = img * (lum * ao)[:, None] * np.array(spec['tint'], dtype=np.float32)
    img = img.reshape(H, W, 3)
    rng = np.random.default_rng(7)
    img = img + rng.normal(0, 0.012, img.shape).astype(np.float32)
    img = np.clip(img, 0, 1) ** (1 / 1.15)
    im = Image.fromarray((img * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name + '.jpg'); im.save(p, quality=82, optimize=True)
    print(name, os.path.getsize(p) // 1024, 'KB')

if __name__ == '__main__':
    only = sys.argv[1:] or list(ROOMS)
    for n in only: render(n, ROOMS[n])
