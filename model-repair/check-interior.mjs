import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCeiling, roomLightPositions } from '../src/interior.js';
import { createFurniture, setLampState, setLampView, isLampType, CATALOG } from '../src/furniture.js';
import { createRoomPlan, roomAtPosition } from '../src/rooms.js';
import { Studio } from '../src/studio.js';
import { DEFAULT_LIGHTING } from '../src/lighting.js';
import { defaultFinish } from '../src/materials.js';
import { planes } from './surface-planes.mjs';
const bytes=fs.readFileSync('public/models/apartment-clean.glb');
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
scene.updateMatrixWorld(true);
const house=new T.Group();
scene.traverse(object=>{
 if(!object.isMesh)return;
 const g=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();g.applyMatrix4(object.matrixWorld);
 const p=g.attributes.position,positions=[];
 for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2);if(b.sub(a).cross(c.sub(a)).normalize().y>.9)for(let j=i;j<i+3;j++)positions.push(p.getX(j),p.getY(j),p.getZ(j));}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
 const mesh=new T.Mesh(geometry);mesh.name=object.name;mesh.userData.category=object.name.startsWith('地板')?'floor':'wall';house.add(mesh);g.dispose();
});
const height=2.605423665,floorY=.005423665,ceiling=createCeiling(house,height),positions=roomLightPositions(house,floorY);
assert.equal(ceiling.visible.visible,false);assert.equal(ceiling.occluder.visible,true);assert.equal(ceiling.occluder.castShadow,true);assert.equal(ceiling.occluder.material.colorWrite,false);assert.equal(ceiling.occluder.material.depthWrite,false);
assert.equal(positions.length,9);
ceiling.visible.updateMatrixWorld(true);
for(const {point} of positions){const ray=new T.Raycaster(new T.Vector3(point.x,1.65,point.z),new T.Vector3(0,1,0));assert(ray.intersectObject(ceiling.visible).length,'Light position has no ceiling');}
for(const type of ['ceiling-light','pendant-light','floor-lamp']){
 const lamp=createFurniture(type),light=lamp.getObjectByName('fixture-light');assert(light.isSpotLight);assert.equal(light.shadow.autoUpdate,false);assert.equal(light.target.parent,light);
 lamp.updateMatrixWorld(true);assert(light.target.getWorldPosition(new T.Vector3()).y<light.getWorldPosition(new T.Vector3()).y,'Lamp does not point down');
 setLampState(lamp,{on:false});assert.equal(light.intensity,0);assert.equal(lamp.getObjectByName('fixture-emitter').material.emissiveIntensity,0);setLampState(lamp,{on:true});assert(light.intensity>0);
 setLampView(lamp,'orbit');
 lamp.traverse(object=>{if(object.isMesh)assert.equal(object.visible,type==='floor-lamp');});
 assert.equal(light.visible,true);assert(light.intensity>0);
 setLampView(lamp,'walk');lamp.traverse(object=>{if(object.isMesh)assert.equal(object.visible,true);});
 const box=new T.Box3().setFromObject(lamp);assert(box.getSize(new T.Vector3()).toArray().every(n=>n>0));
 if(lamp.userData.mount==='ceiling'){lamp.userData.category='furniture';Studio.prototype.mountFurniture.call({ceilingY:height},lamp);assert(Math.abs(new T.Box3().setFromObject(lamp).max.y-(height-.012))<1e-6);}
}
const surfaceMap=new Map([...await planes('public/models/apartment-clean.glb')].flatMap(([,m])=>[...m.keys()].map(id=>[id,defaultFinish()])));
const studio=Object.create(Studio.prototype);Object.assign(studio,{house,ceilingY:height,floorY,defaultLightPositions:positions,furniture:new T.Group(),furnitureMap:new Map(),assets:new Map(),surfaceMap:new Map([...surfaceMap].map(([id,spec])=>[id,{userData:{spec}}])),mode:'orbit',lighting:{...DEFAULT_LIGHTING},history:[],cursor:-1,events:{},reducedMotion:true});
studio.emit=()=>{};studio.select=()=>{};studio.clearDoorHover=()=>{};studio.updateLighting=next=>{studio.lighting=next;};
studio.seedInteriorLights();assert.equal(studio.furniture.children.length,9);
const first=studio.furniture.children[0];studio.toggleFixture(first.userData.id);assert.equal(first.userData.lamp.on,false);
const saved=studio.snapshot();const project={...saved,assets:[]};studio.validateProject(project);studio.restore(saved);assert.equal(studio.furniture.children.length,9);assert.equal(studio.furniture.children[0].userData.lamp.on,false);
// A deleted fixture stays deleted after refresh / restore.
const reduced={...saved,furniture:saved.furniture.slice(1)};studio.restore(reduced);assert.equal(studio.furniture.children.length,8);
// Older projects receive lights once without changing their existing surface set.
const legacy={...saved,furniture:[]};delete legacy.interiorVersion;studio.restore(legacy);assert.equal(studio.furniture.children.length,9);assert.equal(studio.snapshot().interiorVersion,1);
const before=studio.furniture.children[0];studio.selection=before;studio.duplicateSelected();const duplicate=studio.furniture.children.at(-1);setLampState(duplicate,{on:false});assert.equal(before.userData.lamp.on,true);assert(before.getObjectByName('fixture-emitter').material!==duplicate.getObjectByName('fixture-emitter').material);
console.log({ceilings:'camera-hidden / shadow-enabled',fixtures:positions.length,lampState:'toggle, restore, deletion, legacy migration, independent copies passed',catalog:CATALOG.length});

const plan=createRoomPlan(house,floorY);assert.equal(plan.rooms.length,8);
studio.roomPlan=plan;studio.roomNames=new Map(plan.rooms.map(room=>[room.id,room.name]));
for(const fixture of studio.furniture.children){const auto=roomAtPosition(plan.rooms,fixture.position);assert(auto,'Default light outside rooms');}
const [roomA,roomB]=plan.rooms,fixture=studio.furniture.children[0];
studio.renameRoom(roomA.id,'客厅');assert.equal(studio.roomNames.get(roomA.id),'客厅');
studio.assignLampRoom(fixture.userData.id,roomB.id);assert.equal(studio.lampRoom(fixture).id,roomB.id);
studio.setAllFixtures(false);assert(studio.furniture.children.every(o=>!o.userData.lamp.on));
const roomProject={...studio.snapshot(),assets:[]};studio.validateProject(roomProject);
studio.renameRoom(roomA.id,'临时名称');studio.assignLampRoom(fixture.userData.id,'unassigned');
studio.restore(roomProject);assert.equal(studio.roomNames.get(roomA.id),'客厅');assert.equal(studio.lampRoom(studio.furniture.children[0]).id,roomB.id);
assert(studio.furniture.children.every(o=>!o.userData.lamp.on));
studio.setAllFixtures(true);assert(studio.furniture.children.every(o=>o.userData.lamp.on));
studio.assignLampRoom(fixture.userData.id,'');assert.equal(studio.lampRoom(fixture).assignment,'');assert.equal(studio.lampRoom(fixture).id,roomAtPosition(plan.rooms,fixture.position));
studio.assignLampRoom(fixture.userData.id,'unassigned');assert.equal(studio.lampRoom(fixture).id,null);
assert.throws(()=>studio.validateProject({...roomProject,rooms:[{id:'bad',name:'错误'}]}));
assert.throws(()=>studio.validateProject({...roomProject,furniture:[{...roomProject.furniture[0],roomId:'bad'}]}));
// Renaming never mutates the geometry or room IDs in the plan.
assert.equal(plan.rooms[0].name,'房间 1');assert(plan.rooms.every(room=>room.path&&room.outline));
console.log({rooms:plan.rooms.length,names:'rename and restore passed',lampRooms:'automatic, manual, unassigned, restore passed',bulk:'all on/off and saved state passed'});
studio.renameRoom(roomA.id,'起居室');studio.undo(-1);assert.equal(studio.roomNames.get(roomA.id),'客厅');studio.undo(1);assert.equal(studio.roomNames.get(roomA.id),'起居室');
const cursor=studio.cursor;studio.setAllFixtures(false);assert.equal(studio.cursor,cursor+1);studio.undo(-1);assert(studio.furniture.children.every(o=>o.userData.lamp.on));studio.undo(1);assert(studio.furniture.children.every(o=>!o.userData.lamp.on));
const wallsHouse=house.clone();scene.traverse(object=>{if(!object.isMesh||object.name.startsWith('地板'))return;const mesh=new T.Mesh(object.geometry.clone());mesh.geometry.applyMatrix4(object.matrixWorld);mesh.name=object.name;mesh.userData.category='wall';wallsHouse.add(mesh);});
assert(createRoomPlan(wallsHouse,floorY).walls.length>0);
console.log('Room rename and bulk switches undo/redo; actual wall plan: passed');
const {RoomBounce}=await import('../src/room-bounce.js');
const shadowBounds=new T.Box3().setFromObject(ceiling.occluder);assert(Math.abs(shadowBounds.max.y-height-.18)<1e-6);assert(Math.abs(shadowBounds.min.y-height)<1e-6);
// Every original roof triangle center remains covered by a solid shadow slab.
const originalRoof=ceiling.visible.geometry.attributes.position;ceiling.occluder.updateMatrixWorld(true);
for(let i=0;i<originalRoof.count;i+=3){const center=new T.Vector3();for(let j=i;j<i+3;j++)center.add(new T.Vector3().fromBufferAttribute(originalRoof,j));center.divideScalar(3);const ray=new T.Raycaster(new T.Vector3(center.x,height+1,center.z),new T.Vector3(0,-1,0));assert(ray.intersectObject(ceiling.occluder).length>=2,'Roof slab must have top and bottom');}
const bounceContent=new T.Group(),bounceCamera=new T.PerspectiveCamera(),bounceMaterial=new T.MeshStandardMaterial();bounceContent.add(new T.Mesh(new T.BoxGeometry(),bounceMaterial));
const bounce=new RoomBounce(plan,bounceCamera,height),firstRoom=plan.rooms[0];
const bounceFixture=createFurniture('ceiling-light');bounceFixture.userData.type='ceiling-light';bounceFixture.position.set(firstRoom.center[0],2.5,firstRoom.center[1]);bounce.sync(bounceContent,[bounceFixture]);
assert(bounce.colors.value[0].length()>0);assert(bounce.colors.value.slice(1).every(v=>v.length()===0),'Bounce must not light adjacent rooms');
const shader={uniforms:{},fragmentShader:T.ShaderLib.standard.fragmentShader};bounceMaterial.onBeforeCompile(shader,{});assert(shader.fragmentShader.includes('irradiance+=roomBounceColors[0]'));assert.equal(shader.uniforms.roomBounceColors,bounce.colors);assert.equal(shader.uniforms.roomBounceWorldFromView.value,bounceCamera.matrixWorld);
const cacheKey=bounceMaterial.customProgramCacheKey();setLampState(bounceFixture,{on:false});bounce.sync(bounceContent,[bounceFixture]);assert(bounce.colors.value.every(v=>v.length()===0));assert.equal(bounceMaterial.customProgramCacheKey(),cacheKey,'Switching lights must not recompile materials');
console.log('Closed roof coverage, room-scoped bounce and lamp off state: passed');
