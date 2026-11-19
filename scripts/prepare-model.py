"""Extract the editable structure without changing the source GLB. Standard dense accessors only."""
import json, struct
from pathlib import Path
root = Path(__file__).resolve().parent.parent
with (root / 'main-model.glb').open('rb') as f:
    magic, version, length = struct.unpack('<III', f.read(12))
    assert magic == 0x46546C67 and version == 2
    size, kind = struct.unpack('<II', f.read(8))
    doc = json.loads(f.read(size))
    size, kind = struct.unpack('<II', f.read(8))
    binary = f.read(size)
keep = [n for n in doc['nodes'] if n.get('name','').startswith('立方体.') or (n.get('name','').startswith('地板.') and n['name'] != '地板.014')]
meshes, nodes, accessors, views, chunks = [], [], [], [], bytearray()
accessor_map, view_map = {}, {}
def remap_accessor(index):
    if index in accessor_map: return accessor_map[index]
    a = dict(doc['accessors'][index])
    assert 'sparse' not in a, 'Sparse accessors require additional handling'
    old = a['bufferView']
    if old not in view_map:
        v = dict(doc['bufferViews'][old]); offset = v.get('byteOffset',0)
        chunks.extend(b'\0' * ((-len(chunks)) % 4))
        data = binary[offset:offset+v['byteLength']]
        v.update(buffer=0, byteOffset=len(chunks))
        chunks.extend(data)
        view_map[old] = len(views); views.append(v)
    a['bufferView'] = view_map[old]
    accessor_map[index] = len(accessors); accessors.append(a)
    return accessor_map[index]
for n in keep:
    mesh = doc['meshes'][n['mesh']]
    primitives=[]
    for p in mesh['primitives']:
        q = {'attributes':{k:remap_accessor(v) for k,v in p['attributes'].items()},'mode':p.get('mode',4)}
        if 'indices' in p: q['indices']=remap_accessor(p['indices'])
        primitives.append(q)
    copy = dict(n); copy['mesh']=len(meshes); copy.pop('children',None)
    nodes.append(copy); meshes.append({'name':n['name'],'primitives':primitives})
out={'asset':{'version':'2.0','generator':'Roomlab structure extractor'},'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,'accessors':accessors,'bufferViews':views,'buffers':[{'byteLength':len(chunks)}]}
js=json.dumps(out,ensure_ascii=False,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
chunks.extend(b'\0'*((-len(chunks))%4))
target=root/'public/models/apartment.glb'
with target.open('wb') as f:
    f.write(struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(chunks)))
    f.write(struct.pack('<II',len(js),0x4E4F534A));f.write(js)
    f.write(struct.pack('<II',len(chunks),0x004E4942));f.write(chunks)
print(f'{len(nodes)} editable meshes → {target.name} ({target.stat().st_size:,} bytes)')
