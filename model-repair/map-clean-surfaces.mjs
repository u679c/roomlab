import fs from 'node:fs';
import * as T from 'three';
import {planes} from './surface-planes.mjs';
const source='model-repair/apartment-repaired.glb',target='model-repair/apartment-clean.glb';
const before=await planes(source),after=await planes(target),aliases=new Map(),removed=[];
for(const [name,old] of before){
 const current=after.get(name);if(!current)throw Error(`Missing mesh ${name}`);
 const mapping={};
 for(const [id,p] of old){
  if(current.has(id))continue;
  const candidates=[...current].filter(([,q])=>p.normal.dot(q.normal)>.99999&&Math.abs(p.distance-q.distance)<.081).sort((a,b)=>Math.abs(a[1].distance-p.distance)-Math.abs(b[1].distance-p.distance));
  if(!candidates.length){if(p.area<1e-6)removed.push(id);else throw Error(`Unmapped surface ${id} area ${p.area}`);}else mapping[id]=candidates[0][0];
 }
 aliases.set(name,mapping);
}
function read(file){const b=fs.readFileSync(file);return {b,doc:JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString())};}
const oldDoc=read(source).doc,{b,doc}=read(target);
for(const node of doc.nodes){
 const name=T.PropertyBinding.sanitizeNodeName(node.name||'');if(!before.has(name))continue;
 const oldNode=oldDoc.nodes.find(n=>T.PropertyBinding.sanitizeNodeName(n.name||'')===name),extra=oldNode.extras||{},map=aliases.get(name);
 const oldRemoved=JSON.parse(extra.roomlab_removed_planes||'[]'),sourceIds=JSON.parse(extra.roomlab_source_planes||'[]'),oldMap=JSON.parse(extra.roomlab_surface_aliases||'{}');
 const composed={},sourceRemoved=[...oldRemoved];
 for(const id of sourceIds){if(oldRemoved.includes(id))continue;const middle=oldMap[id]||id;if(removed.includes(middle)){sourceRemoved.push(id);continue;}const final=map[middle]||middle;if(final!==id)composed[id]=final;}
 node.extras={...extra,roomlab_source_planes:JSON.stringify(sourceIds),roomlab_surface_aliases:JSON.stringify(composed),roomlab_removed_planes:JSON.stringify(sourceRemoved),roomlab_previous_planes:JSON.stringify([...before.get(name).keys()]),roomlab_previous_aliases:JSON.stringify(map),roomlab_previous_removed:JSON.stringify(removed.filter(id=>id.startsWith(name+':')))};
}
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const rest=b.subarray(20+b.readUInt32LE(12)),header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+json.length+rest.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
fs.writeFileSync(target,Buffer.concat([header,json,rest]));
console.log({previous:[...before.values()].reduce((s,m)=>s+m.size,0),current:[...after.values()].reduce((s,m)=>s+m.size,0),aliases:Object.fromEntries([...aliases.values()].flatMap(Object.entries)),removed});
