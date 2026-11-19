// Reconcile the exact surface IDs produced by the editor's Three.js loader.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {planes} from './surface-planes.mjs';
const source=process.argv[2] || 'public/models/apartment.glb';
const target=process.argv[3] || 'model-repair/apartment-levelled.glb';

const before=await planes(source),after=await planes(target),aliases=new Map(),unmapped=[],removed=[];
for(const [name,old] of before){
  const current=after.get(name);if(!current)throw new Error(`Missing mesh ${name}`);
  const map={};
  for(const [id,plane] of old){
    if(current.has(id))continue;
    const top=plane.normal.y>.99&&plane.distance>2.3;
    const candidates=[...current].filter(([,p])=>p.normal.dot(plane.normal)>.99999&&Math.abs(p.distance-plane.distance)<(top?.2:.005)).sort((a,b)=>Math.abs(a[1].distance-plane.distance)-Math.abs(b[1].distance-plane.distance));
    if(!candidates.length){if(plane.area<1e-7)removed.push(id);else unmapped.push(id);}else map[id]=candidates[0][0];
  }
  aliases.set(name,map);
}
if(unmapped.length)throw new Error('Unmapped surfaces: '+unmapped.join(', '));
const bytes=fs.readFileSync(target),jsonLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
for(const node of doc.nodes){
  const name=THREE.PropertyBinding.sanitizeNodeName(node.name || '');
  if(!before.has(name))continue;
  node.extras={...node.extras,roomlab_source_planes:JSON.stringify([...before.get(name).keys()]),roomlab_surface_aliases:JSON.stringify(aliases.get(name)),roomlab_removed_planes:JSON.stringify(removed.filter(id=>id.startsWith(name+':')))};
}
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const rest=bytes.subarray(20+jsonLength),header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+json.length+rest.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
fs.writeFileSync(target,Buffer.concat([header,json,rest]));
const report={source,target,sourcePlanes:[...before.values()].reduce((sum,m)=>sum+m.size,0),currentPlanes:[...after.values()].reduce((sum,m)=>sum+m.size,0),removedPlanes:removed,aliases:Object.fromEntries([...aliases.values()].flatMap(Object.entries))};
fs.writeFileSync(path.join(path.dirname(target),'surface-migration.json'),JSON.stringify(report,null,2));
console.log(report);
