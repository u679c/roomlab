"""Run with Blender --background --python this-file. Source remains unchanged.
Optional doorway in repair-config.json: wall, axis (x/y), center, width, height.
"""
import bpy,bmesh,json,math
from pathlib import Path
from mathutils import Vector,Matrix
root=Path(__file__).resolve().parent
source=root.parent/'public/models/apartment.glb'
config_path=root/'repair-config.json'
config=json.loads(config_path.read_text()) if config_path.exists() else {}
output=root/('apartment-repaired' if config.get('doorway') else 'apartment-levelled')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
def plane_ids(o):
 result=set()
 for p in o.data.polygons:
  vs=[o.data.vertices[i].co for i in p.vertices]
  for j in range(1,len(vs)-1):
   a,b,c=[Vector((v.x,v.z,-v.y)) for v in [vs[0],vs[j],vs[j+1]]]
   n=(b-a).cross(c-a)
   if n.length<1e-8:continue
   n.normalize();dist=n.dot(a)
   key='_'.join(str(math.floor(x+.5)) for x in [n.x*500,n.y*500,n.z*500,dist*50])
   result.add(o.name+':'+key)
 return result
original={}
for o in objects:
 world=o.matrix_world.copy()
 for v in o.data.vertices:v.co=world@v.co
 o.matrix_world=Matrix.Identity(4)
 original[o.name]=plane_ids(o)
floor_height=max(v.co.z for o in objects if o.name.startswith('地板') for v in o.data.vertices)
top=floor_height+config.get('wall_height',2.6)
changes=[]
for o in objects:
 if not o.name.startswith('立方体'):continue
 old=max(v.co.z for v in o.data.vertices)
 count=0
 for v in o.data.vertices:
  if abs(v.co.z-old)<.002:v.co.z=top;count+=1
 changes.append({'wall':o.name,'old_top':old,'new_top':top,'vertices_changed':count})
# Welding removes glTF seam duplication so wall meshes are solid for booleans.
for o in objects:
 bm=bmesh.new();bm.from_mesh(o.data)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 for polygon in o.data.polygons:polygon.use_smooth=False
 o.data.update()
doorway=config.get('doorway')
if doorway:
 wall=bpy.data.objects.get(doorway['wall'])
 if wall is None:raise ValueError('Doorway wall not found')
 coords=[v.co for v in wall.data.vertices]
 low=[min(v[i] for v in coords) for i in range(3)];high=[max(v[i] for v in coords) for i in range(3)]
 axis=0 if doorway['axis']=='x' else 1
 center=doorway['center'];width=doorway.get('width',.9);height=doorway.get('height',2.1)
 if center-width/2<=low[axis]+.05 or center+width/2>=high[axis]-.05:raise ValueError('Doorway needs solid jambs at each end')
 size=[high[0]-low[0]+.2,high[1]-low[1]+.2,height+.05]
 size[axis]=width
 position=[(low[0]+high[0])/2,(low[1]+high[1])/2,floor_height+(height-.05)/2]
 position[axis]=center
 bpy.ops.mesh.primitive_cube_add(size=1,location=position)
 cutter=bpy.context.object;cutter.name='doorway-cutter';cutter.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 bpy.context.view_layer.objects.active=wall
 modifier=wall.modifiers.new('Second bedroom doorway','BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
 bpy.ops.object.modifier_apply(modifier=modifier.name);bpy.data.objects.remove(cutter,do_unlink=True)
 wall.data.update()
aliases={};removed=[]
for o in objects:
 current=plane_ids(o);mapping={}
 for old_id in original[o.name]-current:
  normal=old_id.split(':')[-1].rsplit('_',1)[0]
  matches=[key for key in current if key.split(':')[-1].rsplit('_',1)[0]==normal]
  if normal=='0_500_0' and matches:
   top_old=max((key for key in original[o.name] if key.split(':')[-1].rsplit('_',1)[0]==normal),key=lambda key:int(key.rsplit('_',1)[-1]))
   if old_id==top_old:mapping[old_id]=max(matches,key=lambda key:int(key.rsplit('_',1)[-1]))
   else:removed.append(old_id)
  else:removed.append(old_id)
 aliases.update(mapping)
 o['roomlab_source_planes']=json.dumps(sorted(original[o.name]),ensure_ascii=False)
 o['roomlab_surface_aliases']=json.dumps(mapping,ensure_ascii=False)
report={'source':str(source),'floor_height':floor_height,'wall_top':top,'wall_height':top-floor_height,'changes':changes,'doorway':doorway,'aliases':aliases,'unmapped_removed_planes':removed}
(root/'repair-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
if removed:raise ValueError('Unexpected surface loss; inspect repair report before exporting')
bpy.ops.wm.save_as_mainfile(filepath=str(output.with_suffix('.blend')))
bpy.ops.export_scene.gltf(filepath=str(output.with_suffix('.glb')),export_format='GLB',export_apply=True,export_texcoords=True,export_normals=True,export_materials='NONE',export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
print('ROOMLAB_REPAIR',json.dumps({'file':str(output.with_suffix('.glb')),'top':top,'walls':len(changes),'aliases':len(aliases),'doorway':doorway},ensure_ascii=False))
