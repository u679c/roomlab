import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export async function planes(file){
  const bytes=fs.readFileSync(file),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const groups=new Map();gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o=>{
    if(!o.isMesh)return;
    const group=new Map(),geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geometry.applyMatrix4(o.matrixWorld);
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i+=3){
      const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);
      const normal=b.sub(a).cross(c.sub(a));const area=normal.length()/2;normal.normalize();if(normal.lengthSq()<.5)continue;
      const distance=normal.dot(a),key=`${o.name}:${[...normal.toArray().map(x=>Math.round(x*500)),Math.round(distance*50)].join('_')}`;
      group.set(key,{normal,distance,area:Math.max(area,group.get(key)?.area || 0)});
    }
    groups.set(o.name,group);geometry.dispose();
  });return groups;
}
