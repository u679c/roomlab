import * as THREE from 'three';

// Project the existing room floors and wall tops to the ceiling height.
export function createCeiling(house, height) {
  const positions=[];
  for(const surface of house.children) {
    const p=surface.geometry?.attributes.position,n=surface.geometry?.attributes.normal;
    if(!p || n.getY(0)<.9)continue;
    if(surface.userData.category!=='floor' && p.getY(0)<height-.01)continue;
    for(let i=0;i<p.count;i+=3)for(const j of [i,i+2,i+1])positions.push(p.getX(j),height,p.getZ(j));
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
  const visible=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#f1eee6',roughness:.95,side:THREE.DoubleSide}));
  visible.name='interior-ceiling';visible.receiveShadow=true;visible.visible=false;
  const occluder=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:THREE.DoubleSide}));
  occluder.name='ceiling-shadow-only';occluder.castShadow=true;
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
