import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Octree} from 'three/addons/math/Octree.js';
import {Capsule} from 'three/addons/math/Capsule.js';
import {readSurfaceMigration,migrateSurfaceProject} from '../src/model-migration.js';
import {Studio} from '../src/studio.js';
import {defaultFinish} from '../src/materials.js';
async function load(file){const b=fs.readFileSync(file);const g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');g.scene.updateMatrixWorld(true);return g.scene;}
function surfaces(root){const result=new Map();root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);const p=g.attributes.position;for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2),n=b.sub(a).cross(c.sub(a)).normalize();if(n.lengthSq()<.5)continue;const id=`${o.name}:${[...n.toArray().map(x=>Math.round(x*500)),Math.round(n.dot(a)*50)].join('_')}`;result.set(id,defaultFinish(o.name.startsWith('地板')&&n.y>.5));}g.dispose();});return result;}
const source=await load('public/models/apartment.glb'),repaired=await load('model-repair/apartment-repaired.glb');
let walls=0;repaired.traverse(o=>{if(o.isMesh&&o.name.startsWith('立方体')){walls++;assert(Math.abs(new T.Box3().setFromObject(o).max.y-2.605423665)<1e-5);}});assert.equal(walls,21);
const octree=new Octree().fromGraphNode(repaired),floor=.005423665;
for(let y=1.7;y<2.5;y+=.025){const hit=octree.capsuleIntersect(new Capsule(new T.Vector3(.4436,floor+.27,-y),new T.Vector3(.4436,floor+1.4,-y),.24));assert(!hit,`Blocked doorway at ${y}: ${JSON.stringify(hit)}`);}
assert(octree.capsuleIntersect(new Capsule(new T.Vector3(-.4,floor+.27,-2.0415),new T.Vector3(-.4,floor+1.4,-2.0415),.24)),'Adjacent wall missing');
const lintel=new T.Raycaster(new T.Vector3(.4436,2.3,-1.7),new T.Vector3(0,0,-1),0,.8);assert(lintel.intersectObject(repaired,true).length,'Lintel missing');
const old=surfaces(source),defaults=surfaces(repaired),metadata=readSurfaceMigration(repaired);
const project={version:1,model:'apartment-v1',surfaces:[...old].map(([id,spec])=>({id,spec:{...spec,color:'#aabbcc'}})),furniture:[],assets:[]};
const migrated=migrateSurfaceProject(project,defaults,metadata);
assert.equal(migrated.surfaces.length,defaults.size);assert.equal(migrated.furniture,project.furniture);assert.equal(migrated.assets,project.assets);
for(const {id,spec} of project.surfaces){if(metadata.removed.has(id))continue;assert.equal(migrated.surfaces.find(e=>e.id===(metadata.aliases.get(id)||id)).spec,spec);}
Studio.prototype.validateProject.call({surfaceMap:defaults},migrated);
assert.equal(migrateSurfaceProject(migrated,defaults,metadata),migrated);
console.log(JSON.stringify({walls,wallTop:2.605423665,doorway:'0.85m × 2.10m; capsule passage clear; adjacent wall and lintel present',sourceSurfaces:old.size,repairedSurfaces:defaults.size,migration:'passed'}));
