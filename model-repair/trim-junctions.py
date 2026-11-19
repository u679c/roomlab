"""Trim only short wall-end overshoots; never translate walls or change thickness."""
import bpy,bmesh,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'apartment-repaired.blend'))
walls=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('立方体')]
straightened=[]
# Snap only sub-2 mm coordinate drift within each wall; preserve openings and wall centers.
for wall in walls:
 moved=0;max_delta=0
 for axis in range(3):
  values=sorted(set(v.co[axis] for v in wall.data.vertices));clusters=[]
  for value in values:
   if not clusters or value-clusters[-1][0]>.002:clusters.append([value])
   else:clusters[-1].append(value)
  mapping={value:(group[0]+group[-1])/2 for group in clusters for value in group}
  for v in wall.data.vertices:
   old=v.co[axis];new=mapping[old];max_delta=max(max_delta,abs(new-old))
   if abs(new-old)>1e-7:moved+=1
   v.co[axis]=new
 wall.data.update()
 if moved:straightened.append({'wall':wall.name,'coordinates_adjusted':moved,'max_adjustment_m':max_delta})
bounds={o.name:([min(v.co[i] for v in o.data.vertices) for i in range(3)],[max(v.co[i] for v in o.data.vertices) for i in range(3)]) for o in walls}
changes=[]
for wall in walls:
 low,high=bounds[wall.name];axis=max(range(2),key=lambda i:high[i]-low[i]);other=1-axis
 if high[axis]-low[axis]<.7:continue
 for side in (0,1):
  endpoint=(low,high)[side][axis];options=[]
  for neighbor in walls:
   if wall==neighbor:continue
   nl,nh=bounds[neighbor.name];na=max(range(2),key=lambda i:nh[i]-nl[i])
   if na==axis or nl[other]>low[other]+.001 or nh[other]<high[other]-.001:continue
   target=(nl,nh)[side][axis];excess=(target-endpoint)*(1 if side==0 else -1)
   if .0001<excess<.08:options.append((excess,target,neighbor.name))
  if not options:continue
  excess,target,neighbor=max(options)
  bm=bmesh.new();bm.from_mesh(wall.data)
  normal=Vector((0,0,0));normal[axis]=1 if side else -1
  point=Vector((0,0,0));point[axis]=target
  bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=point,plane_no=normal,clear_outer=True,clear_inner=False)
  boundary=[e for e in bm.edges if e.is_boundary]
  if boundary:bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
  if any(not e.is_manifold for e in bm.edges):raise ValueError('Non manifold '+wall.name)
  bm.to_mesh(wall.data);bm.free();wall.data.update()
  changes.append({'wall':wall.name,'axis':axis,'side':side,'old':endpoint,'new':target,'removed_m':excess,'aligned_to':neighbor})
# Remove numerical slivers left by the cuts, keeping every wall a closed solid.
for wall in walls:
 for axis in range(3):
  values=sorted(set(v.co[axis] for v in wall.data.vertices));groups=[]
  for value in values:
   if not groups or value-groups[-1][0]>.00002:groups.append([value])
   else:groups[-1].append(value)
  mapping={value:(group[0]+group[-1])/2 for group in groups for value in group}
  for v in wall.data.vertices:v.co[axis]=mapping[v.co[axis]]
 bm=bmesh.new();bm.from_mesh(wall.data)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
 bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00001)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 if any(not e.is_manifold for e in bm.edges):raise ValueError('Non manifold after cleanup '+wall.name)
 bm.to_mesh(wall.data);bm.free();wall.data.update()
(root/'junction-report.json').write_text(json.dumps({'trimmed':changes,'straightened':straightened},ensure_ascii=False,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(root/'apartment-clean.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'apartment-clean.glb'),export_format='GLB',export_apply=True,export_texcoords=True,export_normals=True,export_materials='NONE',export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
print('TRIMMED_JUNCTIONS',json.dumps(changes,ensure_ascii=False))
