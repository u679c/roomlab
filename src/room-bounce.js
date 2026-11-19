import { Color, Vector3 } from 'three';
import { isLampType } from './furniture.js';
import { roomAtPosition } from './rooms.js';
const glsl = n => Number(n.toFixed(5)).toFixed(5);
const vec2 = p => `vec2(${glsl(p[0])},${glsl(p[1])})`;

// A room-scoped approximation of lamp bounce, added to diffuse irradiance.
// It follows the real floor polygons and needs no extra lights, shadow maps or passes.
export class RoomBounce {
  constructor(plan, camera, height) {
    this.rooms=plan.rooms;
    this.bound=new WeakSet();
    this.colors={value:this.rooms.map(()=>new Vector3())};
    this.daylight=this.rooms.map(()=>new Vector3());
    this.worldFromView={value:camera.matrixWorld};
    const declarations=`uniform vec3 roomBounceColors[${this.rooms.length}];
      uniform mat4 roomBounceWorldFromView;
      bool roomBounceTriangle(vec2 p, vec2 a, vec2 b, vec2 c) {
        vec2 ab=b-a,bc=c-b,ca=a-c;
        float x=ab.x*(p.y-a.y)-ab.y*(p.x-a.x);
        float y=bc.x*(p.y-b.y)-bc.y*(p.x-b.x);
        float z=ca.x*(p.y-c.y)-ca.y*(p.x-c.x);
        return (x>=-.025*length(ab)&&y>=-.025*length(bc)&&z>=-.025*length(ca))
            || (x<=.025*length(ab)&&y<=.025*length(bc)&&z<=.025*length(ca));
      }`;
    const regions=this.rooms.map((room,index)=>{
      const points=room.triangles.flat(),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
      const triangles=room.triangles.filter(([a,b,c])=>Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))>2e-6).map(([a,b,c])=>`roomBounceTriangle(roomBouncePoint,${vec2(a)},${vec2(b)},${vec2(c)})`).join('||') || 'false';
      return `if (dot(roomBounceColors[${index}],vec3(1.0))>.001
        && roomBouncePoint.x>${glsl(Math.min(...xs)-.03)} && roomBouncePoint.x<${glsl(Math.max(...xs)+.03)}
        && roomBouncePoint.y>${glsl(Math.min(...zs)-.03)} && roomBouncePoint.y<${glsl(Math.max(...zs)+.03)}
        && (${triangles})) irradiance+=roomBounceColors[${index}];`;
    }).join('\n');
    this.declarations=declarations;
    this.lighting=`#include <lights_fragment_begin>
      #if defined(RE_IndirectDiffuse)
        vec3 roomBounceWorld=(roomBounceWorldFromView*vec4(-vViewPosition,1.0)).xyz;
        vec2 roomBouncePoint=roomBounceWorld.xz;
        if(roomBounceWorld.y<${glsl(height+.02)} && roomBounceWorld.y>-.5) { ${regions} }
      #endif`;
    let hash=2166136261;
    for(const char of this.lighting)hash=Math.imul(hash^char.charCodeAt(0),16777619);
    this.key=`room-bounce-v1:${hash>>>0}`;
  }
  setDaylight(colors) {
    this.daylight.forEach((color,index)=>color.copy(colors[index] || new Vector3()));
  }
  sync(content, furniture) {
    const counts=new Map();
    for(const object of furniture){
      if(!isLampType(object.userData.type)||!object.userData.lamp?.on)continue;
      const roomId=roomAtPosition(this.rooms,object.position);
      counts.set(roomId,(counts.get(roomId)||0)+1);
    }
    const warm=new Color('#fff0dc');
    this.rooms.forEach((room,index)=>{
      const amount=1.6*(1-Math.exp(-.9*(counts.get(room.id)||0)));
      this.colors.value[index].set(warm.r*amount,warm.g*amount,warm.b*amount).add(this.daylight[index]);
    });
    content.traverse(object=>{
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        if(!material?.isMeshStandardMaterial||this.bound.has(material))continue;
        this.bound.add(material);
        const previous=material.onBeforeCompile,programKey=`${material.customProgramCacheKey()}:${this.key}`;
        material.onBeforeCompile=(shader,renderer)=>{
          previous.call(material,shader,renderer);
          shader.uniforms.roomBounceColors=this.colors;
          shader.uniforms.roomBounceWorldFromView=this.worldFromView;
          shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\n${this.declarations}`)
            .replace('#include <lights_fragment_begin>',this.lighting);
        };
        material.customProgramCacheKey=()=>programKey;
        material.needsUpdate=true;
      }
    });
  }
}
