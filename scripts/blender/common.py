"""ART // LOGIN - shared Blender helpers for the six room plates (MIT, original).
Run a room:  blender -b -P scripts/blender/room_attic.py -- --out assets/rooms/attic.jpg [--samples 48] [--w 3072] [--h 1536] [--quality 82]
Conventions: metres, +Y is 'front' (the plate centre = the direction the game faces at rest), camera at eye height 1.5 m,
equirectangular 360 panorama, Cycles CPU, ONE hard tungsten bulb + a near-black world. Materials are procedural (no image files)."""
import bpy, bmesh, math, sys, os, random
from mathutils import Vector

def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    o = {'out': 'render.jpg', 'samples': 48, 'w': 3072, 'h': 1536, 'quality': 82, 'seed': 7, 'exposure': None}
    i = 0
    while i < len(a):
        k = a[i].lstrip('-')
        if k in o:
            v = a[i + 1]; o[k] = type(o[k])(v) if o[k] is not None else float(v); i += 2
        else: i += 1
    return o

# ------------------------------------------------------------------ scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def setup_render(o, exposure=0.0):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    c = sc.cycles
    c.device = 'CPU'; c.samples = o['samples']; c.use_denoising = True
    try: c.denoiser = 'OPENIMAGEDENOISE'
    except Exception: pass
    c.max_bounces = 6; c.diffuse_bounces = 4; c.glossy_bounces = 3; c.transmission_bounces = 2
    c.sample_clamp_indirect = 8; c.use_adaptive_sampling = True
    sc.render.resolution_x = o['w']; sc.render.resolution_y = o['h']; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = o['quality']
    sc.render.image_settings.color_mode = 'RGB'
    for vt in ('Filmic', 'AgX', 'Standard'):
        try: sc.view_settings.view_transform = vt; break
        except Exception: pass
    try: sc.view_settings.look = 'None'
    except Exception: pass
    sc.view_settings.exposure = o['exposure'] if o['exposure'] is not None else exposure
    sc.render.film_transparent = False
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.004, 0.005, 0.008, 1); bg.inputs[1].default_value = 1.0
    random.seed(o['seed'])

def camera(pos=(0, 0, 1.5), yaw_deg=0.0):
    cam = bpy.data.cameras.new('cam'); cam.type = 'PANO'
    try: cam.panorama_type = 'EQUIRECTANGULAR'
    except Exception: cam.cycles.panorama_type = 'EQUIRECTANGULAR'
    for k, v in (('latitude_min', -math.pi / 2), ('latitude_max', math.pi / 2), ('longitude_min', -math.pi), ('longitude_max', math.pi)):
        try: setattr(cam, k, v)
        except Exception: setattr(cam.cycles, k, v)
    ob = bpy.data.objects.new('cam', cam); bpy.context.scene.collection.objects.link(ob)
    ob.location = pos; ob.rotation_euler = (math.pi / 2, 0, math.radians(yaw_deg))   # looks along +Y
    bpy.context.scene.camera = ob
    return ob

def bulb(pos, watts=420, color=(1.0, 0.56, 0.24), radius=0.035, visible=True, size=0.06):
    """THE one light: hard tungsten point source (+ an emissive bulb mesh that does not shadow)."""
    l = bpy.data.lights.new('tungsten', 'POINT'); l.energy = watts; l.color = color; l.shadow_soft_size = radius
    ob = bpy.data.objects.new('tungsten', l); bpy.context.scene.collection.objects.link(ob); ob.location = pos
    if visible:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=size, location=pos, segments=24, ring_count=12)
        s = bpy.context.object; s.name = 'bulb_glass'
        m = bpy.data.materials.new('bulbmat'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
        e = nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = (1.0, 0.7, 0.4, 1); e.inputs[1].default_value = 60
        out = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0], out.inputs[0])
        s.data.materials.append(m)
        try: s.visible_shadow = False
        except Exception: pass
        s.visible_glossy = False
    return ob

def render(o):
    sc = bpy.context.scene
    out = os.path.abspath(o['out']); os.makedirs(os.path.dirname(out), exist_ok=True)
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('RENDERED', out, os.path.getsize(out))

# ------------------------------------------------------------------ materials (procedural)
def _mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    return m, nt, nt.nodes['Material Output']

def _tex(nt, kind, scale, **kw):
    n = nt.nodes.new('ShaderNode' + kind)
    if 'Scale' in n.inputs: n.inputs['Scale'].default_value = scale
    for k, v in kw.items():
        if k in n.inputs: n.inputs[k].default_value = v
        else: setattr(n, k, v)
    return n

def _geo(nt):
    g = nt.nodes.new('ShaderNodeNewGeometry'); return g.outputs['Position']

def _ramp(nt, fac, stops):
    r = nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements.remove(r.color_ramp.elements[0])
    r.color_ramp.elements[0].position = stops[0][0]; r.color_ramp.elements[0].color = stops[0][1]
    for p, c in stops[1:]:
        e = r.color_ramp.elements.new(p); e.color = c
    nt.links.new(fac, r.inputs[0]); return r.outputs[0]

def _principled(nt, out, color, rough, metal=0.0, bump=None, bump_str=0.3, spec=0.4):
    p = nt.nodes.new('ShaderNodeBsdfPrincipled')
    if isinstance(color, tuple): p.inputs['Base Color'].default_value = color
    else: nt.links.new(color, p.inputs['Base Color'])
    if isinstance(rough, (int, float)): p.inputs['Roughness'].default_value = rough
    else: nt.links.new(rough, p.inputs['Roughness'])
    p.inputs['Metallic'].default_value = metal
    for k in ('Specular IOR Level', 'Specular'):
        if k in p.inputs: p.inputs[k].default_value = spec; break
    if bump is not None:
        b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = bump_str; b.inputs['Distance'].default_value = 0.02
        nt.links.new(bump, b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    nt.links.new(p.outputs[0], out.inputs['Surface']); return p

def _mix(nt, a, b, fac, blend='MIX'):
    m = nt.nodes.new('ShaderNodeMix'); m.data_type = 'RGBA'; m.blend_type = blend
    if isinstance(fac, float): m.inputs[0].default_value = fac
    else: nt.links.new(fac, m.inputs[0])
    for i, v in ((6, a), (7, b)):
        if isinstance(v, tuple): m.inputs[i].default_value = v
        else: nt.links.new(v, m.inputs[i])
    return m.outputs[2]

def mat_wood_floor(name='floor', tone=(0.20, 0.105, 0.05), plank_w=0.16, worn=1.0):
    """wood plank floor: brick-tex plank seams + stretched grain + grime"""
    m, nt, out = _mat(name); pos = _geo(nt)
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1, 1, 1); nt.links.new(pos, mp.inputs[0])
    br = _tex(nt, 'TexBrick', 1.0, Color1=(tone[0], tone[1], tone[2], 1), Color2=(tone[0] * 0.55, tone[1] * 0.55, tone[2] * 0.55, 1),
              Mortar=(0.005, 0.003, 0.002, 1)); br.offset = 0.5; br.offset_frequency = 2; br.squash = 8.0; br.squash_frequency = 1
    br.inputs['Mortar Size'].default_value = 0.012; br.inputs['Brick Width'].default_value = 1.4; br.inputs['Row Height'].default_value = plank_w
    br.inputs['Bias'].default_value = 0.0; br.inputs['Mortar Smooth'].default_value = 0.3
    nt.links.new(mp.outputs[0], br.inputs['Vector'])
    gm = nt.nodes.new('ShaderNodeMapping'); gm.inputs['Scale'].default_value = (14, 1.2, 1); nt.links.new(pos, gm.inputs[0])
    gr = _tex(nt, 'TexNoise', 6.0, Detail=8.0, Roughness=0.6, Distortion=0.4); nt.links.new(gm.outputs[0], gr.inputs['Vector'])
    gc = _ramp(nt, gr.outputs[0], [(0.25, (0.35, 0.35, 0.35, 1)), (0.7, (1.1, 1.1, 1.1, 1))])
    gl = _tex(nt, 'TexNoise', 1.6, Detail=6.0, Roughness=0.7); nt.links.new(pos, gl.inputs['Vector'])
    grime = _ramp(nt, gl.outputs[0], [(0.35, (1, 1, 1, 1)), (0.65, (0.35 / worn, 0.33 / worn, 0.3 / worn, 1))])
    c = _mix(nt, br.outputs['Color'], gc, 0.55, 'MULTIPLY'); c = _mix(nt, c, grime, 0.8, 'MULTIPLY')
    rf = _ramp(nt, gr.outputs[0], [(0.3, (0.38, 0.38, 0.38, 1)), (0.8, (0.7, 0.7, 0.7, 1))])
    _principled(nt, out, c, rf, bump=gr.outputs[0], bump_str=0.25, spec=0.35)
    return m

def mat_wood(name='wood', tone=(0.17, 0.09, 0.045), grain=22.0):
    m, nt, out = _mat(name); pos = _geo(nt)
    gm = nt.nodes.new('ShaderNodeMapping'); gm.inputs['Scale'].default_value = (grain * 0.2, grain * 0.2, 1.2); nt.links.new(pos, gm.inputs[0])
    w = _tex(nt, 'TexWave', 3.0, Distortion=3.0, Detail=2.0); w.wave_type = 'BANDS'; w.bands_direction = 'Z'
    w.inputs['Detail Scale'].default_value = 2.0
    nt.links.new(gm.outputs[0], w.inputs['Vector'])
    c = _ramp(nt, w.outputs[0], [(0.0, (tone[0] * 0.7, tone[1] * 0.7, tone[2] * 0.7, 1)), (1.0, (tone[0] * 1.15, tone[1] * 1.15, tone[2] * 1.15, 1))])
    gl = _tex(nt, 'TexNoise', 2.0, Detail=6.0); nt.links.new(pos, gl.inputs['Vector'])
    g = _ramp(nt, gl.outputs[0], [(0.3, (1, 1, 1, 1)), (0.7, (0.4, 0.38, 0.35, 1))]); c = _mix(nt, c, g, 0.7, 'MULTIPLY')
    _principled(nt, out, c, 0.5, bump=w.outputs[0], bump_str=0.15, spec=0.35)
    return m

def mat_plaster(name='plaster', tone=(0.42, 0.37, 0.29), stain=1.0, rough=0.9):
    """peeling, stained plaster wall"""
    m, nt, out = _mat(name); pos = _geo(nt)
    n1 = _tex(nt, 'TexNoise', 0.9, Detail=7.0, Roughness=0.65); nt.links.new(pos, n1.inputs['Vector'])
    n2 = _tex(nt, 'TexNoise', 9.0, Detail=10.0, Roughness=0.75); nt.links.new(pos, n2.inputs['Vector'])
    n3 = _tex(nt, 'TexNoise', 38.0, Detail=4.0); nt.links.new(pos, n3.inputs['Vector'])
    base = _ramp(nt, n1.outputs[0], [(0.25, (tone[0] * 0.35 / stain, tone[1] * 0.33 / stain, tone[2] * 0.3 / stain, 1)), (0.6, (tone[0], tone[1], tone[2], 1)), (0.85, (tone[0] * 1.15, tone[1] * 1.12, tone[2] * 1.08, 1))])
    ch = _ramp(nt, n2.outputs[0], [(0.4, (1, 1, 1, 1)), (0.55, (0.55, 0.52, 0.48, 1))]); c = _mix(nt, base, ch, 0.8, 'MULTIPLY')
    hb = _mix(nt, n2.outputs[0], n3.outputs[0], 0.4)
    h = nt.nodes.new('ShaderNodeMath'); h.operation = 'ADD'
    nt.links.new(n2.outputs[0], h.inputs[0]); nt.links.new(n3.outputs[0], h.inputs[1])
    _principled(nt, out, c, rough, bump=h.outputs[0], bump_str=0.5, spec=0.25)
    return m

def mat_surface(name, color, rough=0.6, metal=0.0, noise=6.0, var=0.35, bump=0.15, spec=0.4):
    """generic mottled surface (metal, cloth, tile, enamel...)"""
    m, nt, out = _mat(name); pos = _geo(nt)
    n = _tex(nt, 'TexNoise', noise, Detail=8.0, Roughness=0.6); nt.links.new(pos, n.inputs['Vector'])
    c = _ramp(nt, n.outputs[0], [(0.3, (color[0] * (1 - var), color[1] * (1 - var), color[2] * (1 - var), 1)), (0.7, (color[0] * (1 + var * 0.3), color[1] * (1 + var * 0.3), color[2] * (1 + var * 0.3), 1))])
    r = _ramp(nt, n.outputs[0], [(0.3, (max(0.05, rough - 0.2),) * 3 + (1,)), (0.75, (min(1, rough + 0.2),) * 3 + (1,))])
    _principled(nt, out, c, r, metal=metal, bump=n.outputs[0], bump_str=bump, spec=spec)
    return m

def mat_tile(name='tile', color=(0.55, 0.57, 0.52), size=0.15, grout=(0.05, 0.05, 0.045)):
    m, nt, out = _mat(name); pos = _geo(nt)
    mp = nt.nodes.new('ShaderNodeMapping'); nt.links.new(pos, mp.inputs[0])
    b = _tex(nt, 'TexChecker', 1.0 / size / 1.0)  # alternate shading per tile
    nt.links.new(mp.outputs[0], b.inputs['Vector']); b.inputs['Color1'].default_value = (1, 1, 1, 1); b.inputs['Color2'].default_value = (0.82, 0.82, 0.8, 1)
    br = _tex(nt, 'TexBrick', 1.0, Color1=(color[0], color[1], color[2], 1), Color2=(color[0] * 0.85, color[1] * 0.85, color[2] * 0.85, 1), Mortar=(grout[0], grout[1], grout[2], 1))
    br.inputs['Mortar Size'].default_value = 0.012; br.inputs['Mortar Smooth'].default_value = 0.4; br.inputs['Brick Width'].default_value = size; br.inputs['Row Height'].default_value = size; br.offset = 0.0
    nt.links.new(mp.outputs[0], br.inputs['Vector'])
    n = _tex(nt, 'TexNoise', 3.0, Detail=8.0); nt.links.new(pos, n.inputs['Vector'])
    g = _ramp(nt, n.outputs[0], [(0.3, (1, 1, 1, 1)), (0.7, (0.3, 0.28, 0.25, 1))])
    c = _mix(nt, br.outputs['Color'], g, 0.85, 'MULTIPLY')
    _principled(nt, out, c, 0.42, bump=br.outputs['Fac'], bump_str=0.4, spec=0.4)
    return m

def mat_brick(name='brick', color=(0.28, 0.1, 0.07)):
    m, nt, out = _mat(name); pos = _geo(nt)
    br = _tex(nt, 'TexBrick', 1.0, Color1=(color[0], color[1], color[2], 1), Color2=(color[0] * 0.55, color[1] * 0.6, color[2] * 0.7, 1), Mortar=(0.18, 0.17, 0.15, 1))
    br.inputs['Mortar Size'].default_value = 0.012; br.inputs['Brick Width'].default_value = 0.22; br.inputs['Row Height'].default_value = 0.07; br.offset = 0.5
    nt.links.new(pos, br.inputs['Vector'])
    n = _tex(nt, 'TexNoise', 5.0, Detail=9.0); nt.links.new(pos, n.inputs['Vector'])
    g = _ramp(nt, n.outputs[0], [(0.3, (1, 1, 1, 1)), (0.7, (0.3, 0.3, 0.3, 1))]); c = _mix(nt, br.outputs['Color'], g, 0.9, 'MULTIPLY')
    _principled(nt, out, c, 0.9, bump=br.outputs['Fac'], bump_str=0.8, spec=0.2)
    return m

def mat_concrete(name='concrete', tone=(0.2, 0.2, 0.19)):
    return mat_plaster(name, tone, stain=1.6, rough=0.95)

def mat_cloth(name='cloth', color=(0.3, 0.05, 0.05)):
    return mat_surface(name, color, rough=0.95, noise=60.0, var=0.35, bump=0.6, spec=0.1)

def mat_blood(name='blood'):
    m, nt, out = _mat(name); p = _principled(nt, out, (0.12, 0.003, 0.003, 1), 0.18, spec=0.7); return m

# ------------------------------------------------------------------ geometry
_mats = {}
def use(name, factory=None, *a, **k):
    if name not in _mats:
        if name == 'brass' and factory is None: factory, a = mat_surface, ((0.55, 0.38, 0.12), 0.35, 0.9, 8.0, 0.4, 0.0, 0.6)
        if name == 'void' and factory is None: factory, a = mat_surface, ((0.005, 0.005, 0.006), 1.0)
        _mats[name] = factory(name, *a, **k)
    return _mats[name]

def _finish(ob, mat, bevel=0.008, smooth=False):
    if mat is not None: ob.data.materials.append(mat)
    if bevel:
        m = ob.modifiers.new('bev', 'BEVEL'); m.width = bevel; m.segments = 2; m.limit_method = 'ANGLE'
    if smooth: bpy.ops.object.shade_smooth()
    return ob

def box(name, loc, size, mat=None, rot=(0, 0, 0), bevel=0.008):
    """size = full dimensions (x, y, z); loc = centre. Vertices are real (no object scale) so procedural textures keep scale."""
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc; ob.rotation_euler = tuple(math.radians(r) for r in rot)
    bpy.context.view_layer.objects.active = ob
    return _finish(ob, mat, bevel)

def cyl(name, loc, r, h, mat=None, rot=(0, 0, 0), seg=32, bevel=0.0, r2=None):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=(r if r2 is None else r2), depth=h)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc; ob.rotation_euler = tuple(math.radians(x) for x in rot)
    return _finish(ob, mat, bevel)

def sphere(name, loc, r, mat=None, squash=(1, 1, 1)):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=r)
    for v in bm.verts: v.co.x *= squash[0]; v.co.y *= squash[1]; v.co.z *= squash[2]
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); ob.location = loc
    return _finish(ob, mat, 0)

def poly_prism(name, pts, thick, mat, loc=(0, 0, 0), plane='XZ'):
    """extrude a 2D outline (list of (a,b)) by thick; plane XZ extrudes along Y"""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    if plane == 'XZ': vs = [bm.verts.new((a, -thick / 2, b)) for a, b in pts]
    else: vs = [bm.verts.new((a, b, -thick / 2)) for a, b in pts]
    f = bm.faces.new(vs); r = bmesh.ops.extrude_face_region(bm, geom=[f])
    vv = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, thick, 0) if plane == 'XZ' else (0, 0, thick), verts=vv)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); ob.location = loc
    return _finish(ob, mat, 0)

def shell(W, D, H, floor, wall, ceil=None, y0=None, t=0.15, wainscot=None, wainscot_h=1.1, base=None):
    """closed room: x in [-W/2,W/2], y in [y0,y0+D], z in [0,H]. Returns dict of bounds. Walls are slabs so light cannot leak."""
    y0 = -D / 2 if y0 is None else y0; cy = y0 + D / 2
    box('floor', (0, cy, -t / 2), (W + 2 * t, D + 2 * t, t), floor, bevel=0)
    if ceil is not False: box('ceiling', (0, cy, H + t / 2), (W + 2 * t, D + 2 * t, t), ceil or wall, bevel=0)
    box('wall_back', (0, y0 + D + t / 2, H / 2), (W + 2 * t, t, H), wall, bevel=0)
    box('wall_front', (0, y0 - t / 2, H / 2), (W + 2 * t, t, H), wall, bevel=0)
    box('wall_left', (-W / 2 - t / 2, cy, H / 2), (t, D, H), wall, bevel=0)
    box('wall_right', (W / 2 + t / 2, cy, H / 2), (t, D, H), wall, bevel=0)
    if wainscot is not None:
        for nm, loc, sz in (('wb', (0, y0 + D - 0.02, wainscot_h / 2), (W, 0.04, wainscot_h)), ('wf', (0, y0 + 0.02, wainscot_h / 2), (W, 0.04, wainscot_h)),
                            ('wl', (-W / 2 + 0.02, cy, wainscot_h / 2), (0.04, D, wainscot_h)), ('wr', (W / 2 - 0.02, cy, wainscot_h / 2), (0.04, D, wainscot_h))):
            box(nm, loc, sz, wainscot, bevel=0.004)
    if base is not None:
        h = 0.14
        for nm, loc, sz in (('bb', (0, y0 + D - 0.02, h / 2), (W, 0.05, h)), ('bf', (0, y0 + 0.02, h / 2), (W, 0.05, h)),
                            ('bl', (-W / 2 + 0.02, cy, h / 2), (0.05, D, h)), ('br', (W / 2 - 0.02, cy, h / 2), (0.05, D, h))):
            box(nm, loc, sz, base, bevel=0.006)
    return dict(x0=-W / 2, x1=W / 2, y0=y0, y1=y0 + D, H=H)

# ------------------------------------------------------------------ props
def door(name, loc, w=0.95, h=2.05, mat=None, frame=None, axis='Y', open_deg=0, knob=True, panels=True):
    """door in a wall facing the room centre. axis 'Y' = door lies in an X-Z wall (front/back); 'X' = in a Y-Z wall."""
    mat = mat or use('doorwood', mat_wood, (0.12, 0.065, 0.035)); frame = frame or mat
    rot = (0, 0, {'Y': 0, 'X': 90, 'Yb': 180, 'Xm': 270}[axis])
    pivot = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(pivot); pivot.location = loc; pivot.rotation_euler = tuple(math.radians(r) for r in rot)
    parts = []
    parts.append(box(name + '_leaf', (0, 0, h / 2), (w, 0.045, h), mat, bevel=0.006))
    if panels:
        for i, (pz, ph) in enumerate(((h * 0.73, h * 0.3), (h * 0.3, h * 0.38))):
            parts.append(box(name + '_pan%d' % i, (0, -0.025, pz), (w * 0.68, 0.012, ph), frame, bevel=0.004))
    parts.append(box(name + '_fl', (-w / 2 - 0.05, 0, h / 2 + 0.03), (0.1, 0.12, h + 0.06), frame, bevel=0.006))
    parts.append(box(name + '_fr', (w / 2 + 0.05, 0, h / 2 + 0.03), (0.1, 0.12, h + 0.06), frame, bevel=0.006))
    parts.append(box(name + '_ft', (0, 0, h + 0.05), (w + 0.2, 0.12, 0.1), frame, bevel=0.006))
    if knob:
        parts.append(sphere(name + '_knob', (w / 2 - 0.1, -0.06, h * 0.48), 0.035, use('brass', mat_surface, (0.55, 0.38, 0.12), 0.35, 0.9, 8.0, 0.4, 0.0, 0.6)))
    for p in parts: p.parent = pivot
    return pivot

def table(name, loc, w=1.2, d=0.7, h=0.75, mat=None, leg=0.06, rot=0):
    mat = mat or use('wood', mat_wood)
    top = box(name + '_top', (loc[0], loc[1], loc[2] + h), (w, d, 0.05), mat, rot=(0, 0, rot))
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    for sx in (-1, 1):
        for sy in (-1, 1):
            lx, ly = sx * (w / 2 - leg), sy * (d / 2 - leg)
            box(name + '_leg', (loc[0] + lx * c - ly * s, loc[1] + lx * s + ly * c, loc[2] + h / 2), (leg, leg, h), mat, bevel=0.004)
    return top

def chair(name, loc, rot=0, mat=None, h=0.46):
    mat = mat or use('chairwood', mat_wood, (0.1, 0.06, 0.035))
    ob = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(ob); ob.location = loc; ob.rotation_euler = (0, 0, math.radians(rot))
    parts = [box(name + '_seat', (0, 0, h), (0.42, 0.4, 0.04), mat)]
    for sx in (-1, 1):
        for sy in (-1, 1): parts.append(box(name + '_leg', (sx * 0.18, sy * 0.17, h / 2), (0.04, 0.04, h), mat, bevel=0.003))
    for sx in (-1, 1): parts.append(box(name + '_post', (sx * 0.18, 0.18, h + 0.4), (0.04, 0.04, 0.8), mat, bevel=0.003))
    for z in (h + 0.45, h + 0.62): parts.append(box(name + '_rail', (0, 0.18, z), (0.38, 0.03, 0.07), mat, bevel=0.003))
    for p in parts: p.parent = ob
    return ob

def crate(name, loc, s=0.5, rot=0, mat=None):
    mat = mat or use('crate', mat_wood, (0.16, 0.1, 0.055), 30.0)
    return box(name, (loc[0], loc[1], loc[2] + s / 2), (s, s, s), mat, rot=(0, 0, rot), bevel=0.01)

def barrel(name, loc, r=0.28, h=0.8, mat=None):
    mat = mat or use('barrel', mat_wood, (0.14, 0.08, 0.04))
    b = cyl(name, (loc[0], loc[1], loc[2] + h / 2), r, h, mat, seg=28, r2=r)
    for z in (0.12, 0.42, 0.7):
        cyl(name + '_hoop', (loc[0], loc[1], loc[2] + h * z / 0.8 * 0.95 + 0.02), r * 1.02, 0.025, use('iron', mat_surface, (0.08, 0.08, 0.08), 0.5, 0.9), seg=28)
    return b

def lamp_cord(x, y, z_top, z_bulb, mat=None):
    mat = mat or use('cord', mat_surface, (0.02, 0.02, 0.02), 0.7)
    cyl('cord', (x, y, (z_top + z_bulb) / 2), 0.006, z_top - z_bulb, mat, seg=6)
    cyl('socket', (x, y, z_bulb + 0.06), 0.022, 0.07, use('bakelite', mat_surface, (0.03, 0.025, 0.02), 0.4), seg=12)

def window_boards(name, loc, w=0.9, h=1.2, axis='Y', mat=None, gap_light=False):
    """boarded-up window: dark opening with crossed planks"""
    mat = mat or use('boards', mat_wood, (0.13, 0.08, 0.05), 30.0)
    rot = (0, 0, {'Y': 0, 'X': 90, 'Yb': 180, 'Xm': 270}[axis])
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root); root.location = loc; root.rotation_euler = tuple(math.radians(r) for r in rot)
    parts = [box(name + '_hole', (0, 0.01, 0), (w, 0.03, h), use('void', mat_surface, (0.005, 0.005, 0.006), 1.0), bevel=0)]
    for i, (z, a) in enumerate(((0.22, 4), (-0.05, -3), (-0.3, 5))):
        parts.append(box(name + '_pl%d' % i, (0, -0.04, z * h), (w * 1.2, 0.03, 0.14), mat, rot=(0, 0, a), bevel=0.004))
    for p in parts: p.parent = root
    return root

def sheet_cover(name, loc, size, mat=None, rot=0):
    """dust sheet over furniture: tapered slab"""
    mat = mat or use('sheet', mat_cloth, (0.42, 0.4, 0.34))
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        top = v.co.z > 0
        v.co.x *= size[0] * (0.82 if top else 1.0); v.co.y *= size[1] * (0.82 if top else 1.0); v.co.z = (v.co.z + 0.5) * size[2]
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); ob.location = loc; ob.rotation_euler = (0, 0, math.radians(rot))
    ms = ob.modifiers.new('sub', 'SUBSURF'); ms.levels = 2; ms.render_levels = 2
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.shade_smooth()
    me.materials.append(mat)
    return ob

def frame_picture(name, loc, w=0.5, h=0.65, axis='Y', face=1, mat=None, art=(0.03, 0.025, 0.02)):
    """framed dark portrait: gilt frame + near-black canvas. face=+1 normal toward +Y (or +X for axis X)"""
    fm = mat or use('gilt', mat_surface, (0.4, 0.28, 0.08), 0.4, 0.8, 10.0, 0.3, 0.2, 0.6)
    cv = use('canvas' + name, mat_surface, art, 0.8, 0.0, 14.0, 0.6, 0.6, 0.2)
    rot = (0, 0, 0) if axis == 'Y' else (0, 0, 90)
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root); root.location = loc
    root.rotation_euler = tuple(math.radians(r) for r in rot) if face > 0 else (0, 0, math.radians(rot[2] + 180))
    ps = [box(name + '_f', (0, 0, 0), (w, 0.04, h), fm, bevel=0.012), box(name + '_c', (0, 0.0, 0), (w - 0.08, 0.05, h - 0.08), cv, bevel=0)]
    for p in ps: p.parent = root
    return root
