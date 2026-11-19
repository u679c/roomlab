import bpy,bmesh,json
from pathlib import Path
root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'apartment-repaired.blend'))
rows=[]
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 verts=[list(o.matrix_world@v.co) for v in o.data.vertices]
 if o.name.startswith('立方体'):
  bm=bmesh.new();bm.from_mesh(o.data)
  bad=sum(not e.is_manifold for e in bm.edges);bm.free()
  if bad:raise ValueError('Non-manifold wall: '+o.name+' '+str(bad))
 rows.append({'name':o.name,'vertices':verts,'faces':[list(p.vertices) for p in o.data.polygons],'min':[min(v[i] for v in verts) for i in range(3)],'max':[max(v[i] for v in verts) for i in range(3)]})
(root/'repaired-inspection.json').write_text(json.dumps(rows,ensure_ascii=False))
print('REPAIRED_GEOMETRY_OK',len(rows))
