const rounded = value => Math.round(value * 10000) / 10000;
const pointKey = point => point.map(rounded).join(',');
const move = point => `${rounded(point[0])} ${rounded(point[1])}`;
function triangleContains(point, triangle) {
  const [a,b,c] = triangle;
  const cross = (p,q) => (q[0]-p[0])*(point[1]-p[1])-(q[1]-p[1])*(point[0]-p[0]);
  const signs = [cross(a,b),cross(b,c),cross(c,a)];
  return !(signs.some(n=>n < -1e-6) && signs.some(n=>n > 1e-6));
}
export function roomAtPosition(rooms, position) {
  return rooms.find(room => room.triangles.some(triangle => triangleContains([position.x,position.z],triangle)))?.id || null;
}
export function createRoomPlan(house, floorY) {
  const grouped = new Map();
  let walls = '';
  for (const mesh of house.children) {
    const p = mesh.geometry?.attributes.position;
    if (!p) continue;
    const floor = mesh.userData.category === 'floor' && mesh.geometry.attributes.normal.getY(0) > .9;
    const name = mesh.name.split(':')[0];
    if (floor && !grouped.has(name)) grouped.set(name,[]);
    for (let i=0;i<p.count;i+=3) {
      const vertices = [i,i+1,i+2].map(j=>[p.getX(j),p.getY(j),p.getZ(j)]);
      if (floor) grouped.get(name).push(vertices.map(v=>[v[0],v[2]]));
      else if (mesh.userData.category === 'wall') {
        const intersections = [];
        for (let j=0;j<3;j++) {
          const a=vertices[j],b=vertices[(j+1)%3],height=floorY+.2;
          if ((a[1]-height)*(b[1]-height) >= 0) continue;
          const t=(height-a[1])/(b[1]-a[1]);
          intersections.push([a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t]);
        }
        if (intersections.length===2) walls+=`M${move(intersections[0])}L${move(intersections[1])}`;
      }
    }
  }
  const rooms = [...grouped].sort(([a],[b])=>a.localeCompare(b,'en',{numeric:true})).map(([floor,triangles],index)=>{
    const edges=new Map();let area=0,cx=0,cz=0,largest=null;
    for (const triangle of triangles) {
      const [a,b,c]=triangle,weight=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
      const center=[(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3];
      area+=weight;cx+=center[0]*weight;cz+=center[1]*weight;
      if (!largest || largest.area<weight) largest={area:weight,center};
      for(let j=0;j<3;j++) {
        const p=triangle[j],q=triangle[(j+1)%3],key=[pointKey(p),pointKey(q)].sort().join('|');
        const edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{p,q,count:1});
      }
    }
    let center=area ? [cx/area,cz/area] : largest.center;
    if(!triangles.some(triangle=>triangleContains(center,triangle)))center=largest.center;
    return {id:`room-${floor}`,name:`房间 ${index+1}`,number:index+1,triangles,center,
      path:triangles.map(([a,b,c])=>`M${move(a)}L${move(b)}L${move(c)}Z`).join(''),
      outline:[...edges.values()].filter(edge=>edge.count===1).map(edge=>`M${move(edge.p)}L${move(edge.q)}`).join('')};
  });
  const points=rooms.flatMap(room=>room.triangles.flat()),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
  const minX=Math.min(...xs)-.35,minZ=Math.min(...zs)-.35,maxX=Math.max(...xs)+.35,maxZ=Math.max(...zs)+.35;
  return {rooms,walls,viewBox:`${minX} ${minZ} ${maxX-minX} ${maxZ-minZ}`};
}
