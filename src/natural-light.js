import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';

function samplePoints(room) {
  const candidates=[room.center];
  for(const [a,b,c] of room.triangles){
    if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<.001)continue;
    const center=[(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3];
    candidates.push(center,...[a,b,c].map(p=>[p[0]*.8+center[0]*.2,p[1]*.8+center[1]*.2]));
  }
  const selected=[candidates[0]];
  while(selected.length<10){
    let best=null,distance=.01;
    for(const candidate of candidates){
      const nearest=Math.min(...selected.map(p=>(p[0]-candidate[0])**2+(p[1]-candidate[1])**2));
      if(nearest>distance){distance=nearest;best=candidate;}
    }
    if(!best)break;
    selected.push(best);
  }
  return selected;
}

// Cache sky access and open-room connections; only sun direction is resampled.
// This is diffuse preview lighting, not multi-bounce ray tracing.
export class NaturalLight {
  constructor(content, plan, floorY) {
    const positions=[];
    content.updateWorldMatrix(true,true);
    content.traverse(object=>{
      if(!object.isMesh || object.name==='interior-ceiling')return;
      const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      const p=geometry.attributes.position;
      for(let i=0;i<p.count;i++)positions.push(p.getX(i),p.getY(i),p.getZ(i));
      geometry.dispose();
    });
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.computeBoundingSphere();
    this.occlusion=new Mesh(geometry,new MeshBasicMaterial({side:DoubleSide}));
    this.occlusion.updateMatrixWorld(true);
    this.raycaster=new Raycaster();this.raycaster.near=.01;
    this.floorY=floorY;
    this.samples=plan.rooms.map(samplePoints);
    const sky=[];
    for(const elevation of [.15,.5])for(let i=0;i<8;i++){
      const a=i*Math.PI/4;sky.push(new Vector3(Math.cos(a),elevation,Math.sin(a)).normalize());
    }
    this.skyAccess=this.samples.map(points=>{
      let open=0,total=0;
      for(const point of points)for(const direction of sky){
        total++;
        if(this.isOpen(new Vector3(point[0],floorY+1.55,point[1]),direction))open++;
      }
      return open/total;
    });
    const bounds=plan.rooms.map(room=>{
      const points=room.triangles.flat();return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
    });
    this.connections=this.samples.map(()=>[]);
    for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){
      const a=bounds[i],b=bounds[j];
      if(Math.hypot(Math.max(0,a[0]-b[2],b[0]-a[2]),Math.max(0,a[1]-b[3],b[1]-a[3]))>.4)continue;
      const connected=this.samples[i].some(p=>this.samples[j].some(q=>{
        const origin=new Vector3(p[0],floorY+1.25,p[1]),direction=new Vector3(q[0],floorY+1.25,q[1]).sub(origin),distance=direction.length();
        return distance>.01 && this.isOpen(origin,direction.normalize(),distance-.02);
      }));
      if(connected){this.connections[i].push(j);this.connections[j].push(i);}
    }
  }
  isOpen(origin,direction,distance=40) {
    this.raycaster.set(origin,direction);
    this.raycaster.far=distance;
    return this.raycaster.intersectObject(this.occlusion,false).length===0;
  }
  evaluate(state) {
    const direction=new Vector3(...state.position).normalize();
    const sunKey=state.position.map(value=>value.toFixed(5)).join(',');
    if(state.direct>0 && (this.sunKey!==sunKey || !this.sunAccess)) {
      this.sunAccess=this.samples.map(points=>{
        let direct=0;
        for(const point of points)for(const height of [.65,1.55]){
          if(this.isOpen(new Vector3(point[0],this.floorY+height,point[1]),direction))direct++;
        }
        return direct/(points.length*2);
      });
      this.sunKey=sunKey;
    }
    const energy=this.samples.map((points,index)=>({
      sky:3.2*Math.sqrt(this.skyAccess[index])*state.daylight*state.weather.ambient,
      sun:state.direct*(this.sunAccess?.[index] || 0),
    }));
    // Open doorways share some of the adjacent room's daylight, with attenuation.
    let indirect=energy.map(e=>({...e}));
    for(let bounce=0;bounce<2;bounce++)indirect=energy.map((own,i)=>({
      sky:own.sky+.22*Math.max(0,...this.connections[i].map(j=>indirect[j].sky)),
      sun:own.sun+.22*Math.max(0,...this.connections[i].map(j=>indirect[j].sun)),
    }));
    const skyColor=new Color('#edf3ff'),sunColor=new Color('#fff5df').lerp(new Color('#ffba7c'),state.warmth);
    return indirect.map(e=>new Vector3(skyColor.r*e.sky+sunColor.r*e.sun,skyColor.g*e.sky+sunColor.g*e.sun,skyColor.b*e.sky+sunColor.b*e.sun));
  }
  dispose(){this.occlusion.geometry.dispose();this.occlusion.material.dispose();}
}
