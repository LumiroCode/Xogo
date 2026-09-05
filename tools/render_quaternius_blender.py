"""Blender 4.x helper: render a Quaternius FBX/glTF model into 8 transparent iso sprites.

Run:
  blender --background --python tools/render_quaternius_blender.py -- model.glb out_dir visual_key

This is a source-art pipeline tool; Blender and the source model are not runtime dependencies.
"""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) < 3:
    raise SystemExit('usage: blender --background --python ... -- MODEL OUT_DIR KEY')
source, out_dir, key = Path(args[0]), Path(args[1]), args[2]
out_dir.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
if source.suffix.lower() in {'.glb','.gltf'}:
    bpy.ops.import_scene.gltf(filepath=str(source))
elif source.suffix.lower()=='.fbx':
    bpy.ops.import_scene.fbx(filepath=str(source))
else:
    raise SystemExit('supported source formats: .glb/.gltf/.fbx')

objects=[o for o in bpy.context.scene.objects if o.type in {'MESH','ARMATURE','EMPTY'}]
root=bpy.data.objects.new('SPRITE_ROOT',None); bpy.context.scene.collection.objects.link(root)
for o in objects:
    if o.parent is None and o is not root: o.parent=root

# Center source around XY origin and put lowest world-space vertex at Z=0.
def bounds():
    pts=[]
    deps=bpy.context.evaluated_depsgraph_get()
    for o in bpy.context.scene.objects:
        if o.type!='MESH': continue
        eo=o.evaluated_get(deps)
        for c in eo.bound_box: pts.append(o.matrix_world @ Vector(c))
    return pts
pts=bounds()
if pts:
    mn=Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts)))
    mx=Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
    root.location -= Vector(((mn.x+mx.x)/2,(mn.y+mx.y)/2,mn.z))

world=bpy.context.scene.world or bpy.data.worlds.new('World'); bpy.context.scene.world=world
world.color=(0.04,0.05,0.055)

def area(name, loc, energy, size):
    data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size
    obj=bpy.data.objects.new(name,data); bpy.context.scene.collection.objects.link(obj); obj.location=loc
    direction=Vector((0,0,0))-obj.location; obj.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
area('Key',(4,-6,8),900,5); area('Fill',(-5,-1,5),450,4)

cam_data=bpy.data.cameras.new('IsoCamera'); cam=bpy.data.objects.new('IsoCamera',cam_data); bpy.context.scene.collection.objects.link(cam); bpy.context.scene.camera=cam
cam.location=(7,-7,6); cam.rotation_euler=(Vector((0,0,1.3))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'
pts=bounds(); span=max((max(p.x for p in pts)-min(p.x for p in pts)),(max(p.y for p in pts)-min(p.y for p in pts)),(max(p.z for p in pts)-min(p.z for p in pts))) if pts else 2
cam.data.ortho_scale=max(2.0,span*1.8)

scene=bpy.context.scene; scene.render.engine='BLENDER_EEVEE_NEXT'; scene.render.resolution_x=256; scene.render.resolution_y=256; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=True
scene.view_settings.look='AgX - Medium High Contrast'

names=['N','NE','E','SE','S','SW','W','NW']
for i,name in enumerate(names):
    root.rotation_euler[2]=math.radians(i*45)
    scene.render.filepath=str(out_dir/f'{key}_{name}.png')
    bpy.ops.render.render(write_still=True)
print(f'rendered {len(names)} sprites to {out_dir}')
