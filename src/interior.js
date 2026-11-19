import * as THREE from 'three';

// Keep the visible ceiling at wall height; a separate closed slab blocks sunlight.
export function createCeiling(house, height) {
  const visiblePositions = [], shadowPositions = [];
  const padding = .05, thickness = .18;
  const triangle = (out,a,b,c) => out.push(...a,...b,...c);
  for (const surface of house.children) {
    const p = surface.geometry?.attributes.position, n = surface.geometry?.attributes.normal;
    if (!p || n.getY(0) < .9) continue;
    if (surface.userData.category !== 'floor' && p.getY(0) < height - .01) continue;
    for (let i=0;i<p.count;i+=3) {
      const points=[i,i+1,i+2].map(j=>new THREE.Vector2(p.getX(j),p.getZ(j)));
      const area=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
      if(Math.abs(area)<1e-8)continue;
      // Offset edges outwards so adjacent panels overlap despite scan rounding.
      const expanded=points.map((v,j)=>{
        const previous=points[(j+2)%3],next=points[(j+1)%3];
        const a=v.clone().sub(previous).normalize(),b=next.clone().sub(v).normalize();
        const normalA=new THREE.Vector2(a.y,-a.x).multiplyScalar(Math.sign(area));
        const normalB=new THREE.Vector2(b.y,-b.x).multiplyScalar(Math.sign(area));
        const bisector=normalA.clone().add(normalB).normalize();
        return v.clone().addScaledVector(bisector,Math.min(padding/Math.max(.05,bisector.dot(normalA)),padding*4));
      });
      const stitched=points.map((v,j)=>v.clone().lerp(expanded[j],.06));
      triangle(visiblePositions,...[stitched[0],stitched[2],stitched[1]].map(v=>[v.x,height,v.y]));
      const bottom=expanded.map(v=>[v.x,height,v.y]),top=expanded.map(v=>[v.x,height+thickness,v.y]);
      triangle(shadowPositions,bottom[0],bottom[2],bottom[1]);
      triangle(shadowPositions,top[0],top[1],top[2]);
      for(let j=0;j<3;j++){const k=(j+1)%3;triangle(shadowPositions,bottom[j],bottom[k],top[k]);triangle(shadowPositions,bottom[j],top[k],top[j]);}
    }
  }
  const makeGeometry=positions=>{
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.computeVertexNormals();return geometry;
  };
  const visible = new THREE.Mesh(makeGeometry(visiblePositions), new THREE.MeshStandardMaterial({ color: '#f1eee6', roughness: .95, side: THREE.DoubleSide }));
  visible.name = 'interior-ceiling';visible.receiveShadow = true;visible.visible = false;
  const occluder = new THREE.Mesh(makeGeometry(shadowPositions),new THREE.MeshBasicMaterial({ colorWrite:false,depthWrite:false,side:THREE.DoubleSide }));
  occluder.name = 'ceiling-shadow-only';occluder.castShadow = true;
  return {visible,occluder};
}

export function roomLightPositions(house, floorY) {
  const rooms = new Map();
  for (const surface of house.children) {
    if (surface.userData.category !== 'floor' || surface.geometry.attributes.normal.getY(0) < .9) continue;
    const name = surface.name.split(':')[0];
    if (!rooms.has(name)) rooms.set(name, []);
    const p = surface.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
      const area = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
      if (area > 1e-6) rooms.get(name).push({ a, b, c, area });
    }
  }
  const positions = [];
  for (const [name, triangles] of rooms) {
    const bounds = new THREE.Box3();
    triangles.forEach(t => { bounds.expandByPoint(t.a); bounds.expandByPoint(t.b); bounds.expandByPoint(t.c); });
    const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    const large = triangles.reduce((sum, t) => sum + t.area, 0) > 16;
    const axis = size.x > size.z ? 'x' : 'z';
    for (const fraction of large ? [.3, .7] : [.5]) {
      let point = center.clone();
      point[axis] = bounds.min[axis] + size[axis] * fraction;
      point.y = floorY;
      if (!triangles.some(t => new THREE.Triangle(t.a, t.b, t.c).containsPoint(point))) {
        // An L-shaped room's box center can be outside its floor polygon.
        point = triangles.map(t => ({ area: t.area, center: t.a.clone().add(t.b).add(t.c).divideScalar(3) }))
          .sort((a, b) => b.area - a.area || a.center.distanceToSquared(center) - b.center.distanceToSquared(center))[0].center;
      }
      positions.push({ name: `${name}-${fraction}`, point });
    }
  }
  return positions;
}
