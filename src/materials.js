import * as THREE from 'three';

export const FINISHES = [
  { id:'paint', name:'哑光墙漆', category:'墙面', color:'#e9e5dc', roughness:.9, pattern:'none', unit:1 },
  { id:'satin-paint', name:'柔光墙漆', category:'墙面', color:'#e7e9e2', roughness:.45, pattern:'none', unit:1 },
  { id:'limewash', name:'石灰涂料', category:'墙面', color:'#ddd3c0', roughness:1, pattern:'limewash', unit:1 },
  { id:'plaster', name:'微水泥', category:'墙面', color:'#c6c1b5', roughness:.95, pattern:'plaster', unit:1 },
  { id:'concrete', name:'清水混凝土', category:'墙面', color:'#aeb1ad', roughness:.92, pattern:'concrete', unit:2 },
  { id:'wood', name:'原木地板', category:'木纹', color:'#c89d6e', roughness:.65, pattern:'wood', unit:2 },
  { id:'oak', name:'浅橡木', category:'木纹', color:'#d6b98e', roughness:.7, pattern:'wood', unit:2 },
  { id:'walnut', name:'胡桃木', category:'木纹', color:'#886344', roughness:.6, pattern:'walnut', unit:2 },
  { id:'wood-chevron', name:'鱼骨拼木纹', category:'木纹', color:'#b99266', roughness:.7, pattern:'chevron', unit:1 },
  { id:'wood-slats', name:'木格栅', category:'木纹', color:'#b28d62', roughness:.75, pattern:'slats', unit:1 },
  { id:'tile', name:'素色瓷砖', category:'瓷砖', color:'#dcd9d1', roughness:.35, pattern:'tile', unit:.6 },
  { id:'large-tile', name:'大规格地砖', category:'瓷砖', color:'#c9c8c3', roughness:.3, pattern:'tile', unit:1.2 },
  { id:'subway-tile', name:'长条墙砖', category:'瓷砖', color:'#ecebe5', roughness:.3, pattern:'subway', unit:.6 },
  { id:'checker-tile', name:'棋盘格地砖', category:'瓷砖', color:'#e4e1d8', roughness:.4, pattern:'checker', unit:1.2 },
  { id:'mosaic', name:'马赛克', category:'瓷砖', color:'#b8c9c1', roughness:.35, pattern:'mosaic', unit:.6 },
  { id:'stone', name:'浅纹石材', category:'石材', color:'#dedbd2', roughness:.3, pattern:'stone', unit:1 },
  { id:'marble', name:'大理石', category:'石材', color:'#efeee9', roughness:.2, pattern:'marble', unit:1.2 },
  { id:'granite', name:'花岗岩', category:'石材', color:'#a5a8a6', roughness:.6, pattern:'granite', unit:.6 },
  { id:'terrazzo', name:'水磨石', category:'石材', color:'#e1d7c5', roughness:.55, pattern:'terrazzo', unit:1 },
  { id:'brick', name:'红砖', category:'墙面', color:'#b77b61', roughness:.95, pattern:'brick', unit:.8 },
  { id:'wallpaper-stripe', name:'竖纹墙纸', category:'墙纸', color:'#d6d4c3', roughness:.85, pattern:'stripe', unit:.5 },
  { id:'wallpaper-dot', name:'点纹墙纸', category:'墙纸', color:'#ddd7cb', roughness:.9, pattern:'dot', unit:.5 },
  { id:'wallpaper-linen', name:'亚麻墙纸', category:'墙纸', color:'#cfbfa9', roughness:.95, pattern:'linen', unit:.5 },
  { id:'fabric-linen', name:'亚麻布', category:'织物', color:'#cec3ac', roughness:1, pattern:'linen', unit:.4 },
  { id:'fabric-wool', name:'粗织布', category:'织物', color:'#a9b09c', roughness:1, pattern:'wool', unit:.4 },
  { id:'carpet', name:'素色地毯', category:'织物', color:'#a5a095', roughness:1, pattern:'carpet', unit:.5 },
];
export const FINISH_CATEGORIES = ['全部','墙面','木纹','瓷砖','石材','墙纸','织物'];
export const COLORS = ['#eeeae1','#d1c9b8','#b5bba8','#8b9b88','#b6c6cd','#7b909e','#d7b4a0','#ac8171','#555d57','#ffffff'];
export const defaultFinish = (floor=false) => ({finish:floor?'wood':'paint',color:floor?'#c7a47a':'#eeeae1',size:1,rotation:0,roughness:floor ? .7 : .9,image:null});

function random(seed) { let a=seed; return ()=>{a=(a*1664525+1013904223)>>>0;return a/4294967296;}; }
const patternCache=new Map(), previewCache=new Map();
function patternCanvas(kind) {
  if(patternCache.has(kind))return patternCache.get(kind);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const c=canvas.getContext('2d'), rand=random(9821);const S=256;
  c.fillStyle='#ffffff';c.fillRect(0,0,S,S);
  const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const line=(x1,y1,x2,y2,color='#bdbdbd',width=1)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();};
  const noise=(count,alpha=.08)=>{for(let i=0;i<count;i++)rect(rand()*S,rand()*S,1,1,`rgba(30,30,30,${rand()*alpha})`);};
  if(kind==='wood'||kind==='walnut') {
    for(let i=0;i<8;i++){
      const g=225+rand()*27;rect(i*32,0,32,S,`rgb(${g},${g},${g})`);
      for(let j=0;j<38;j++){
        const x=i*32+rand()*30;c.strokeStyle=`rgba(50,45,40,${rand()*(kind==='walnut'?.22:.13)})`;c.lineWidth=rand()*.8;
        c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+3,80,x-3,180,x+1,S);c.stroke();
      }
      line(i*32,0,i*32,S,'#b4b4b4');line(i*32,i%2?160:80,(i+1)*32,i%2?160:80,'#b4b4b4');
    }
  } else if(kind==='slats') {
    for(let x=0;x<S;x+=16){rect(x,0,12,S,'#f6f6f6');rect(x+12,0,4,S,'#777777');line(x+1,0,x+1,S,'#ffffff');for(let j=0;j<4;j++)line(x+3+j*2,0,x+2+j*2,S,'#dedede',.5);}
  } else if(kind==='chevron') {
    for(let x=0;x<S;x+=64)for(let y=-64;y<S;y+=32){
      const up=(x/64)%2===0, shift=up?32:-32;
      c.fillStyle=`rgb(${220+rand()*30},${220+rand()*30},${220+rand()*30})`;
      c.beginPath();c.moveTo(x,y);c.lineTo(x+64,y+shift);c.lineTo(x+64,y+shift+32);c.lineTo(x,y+32);c.closePath();c.fill();c.strokeStyle='#adadad';c.lineWidth=1;c.stroke();
      for(let j=1;j<4;j++)line(x,y+j*7,x+64,y+shift+j*7,'#c8c8c8',.5);
    }
  } else if(kind==='tile') {
    rect(0,0,S,2,'#aeb1ad');rect(0,0,2,S,'#aeb1ad');
  } else if(kind==='subway'||kind==='brick') {
    const h=kind==='brick'?32:64,w=128,grout=kind==='brick'?3:2;
    rect(0,0,S,S,'#a8a8a8');
    for(let row=0;row<S/h;row++)for(let col=-1;col<3;col++){
      const gray=kind==='brick'?210+rand()*40:240+rand()*15;
      rect(col*w+(row%2)*w/2+grout,row*h+grout,w-grout,h-grout,`rgb(${gray},${gray},${gray})`);
    }
  } else if(kind==='checker') {
    rect(0,0,128,128,'#72777b');rect(128,128,128,128,'#72777b');
    for(let t=0;t<S;t+=128){line(t,0,t,S,'#b5b5b5');line(0,t,S,t,'#b5b5b5');}
  } else if(kind==='mosaic') {
    rect(0,0,S,S,'#9b9b9b');for(let x=0;x<S;x+=32)for(let y=0;y<S;y+=32){const g=203+rand()*50;rect(x+2,y+2,29,29,`rgb(${g},${g},${g})`);}
  } else if(kind==='stone'||kind==='marble') {
    const count=kind==='marble'?12:32;
    // Periodic waves wrap exactly across the texture's top and bottom edges.
    for(let i=0;i<count;i++){
      const x=rand()*S,amp=4+rand()*17,phase=rand()*Math.PI*2;
      c.strokeStyle=`rgba(70,75,80,${.06+rand()*(kind==='marble'?.26:.12)})`;c.lineWidth=.5+rand()*1.4;
      for(const offset of [-S,0,S]){c.beginPath();for(let y=0;y<=S;y+=4){const px=x+offset+Math.sin(y/S*Math.PI*2+phase)*amp;if(y===0)c.moveTo(px,y);else c.lineTo(px,y);}c.stroke();}
    }
  } else if(kind==='granite'||kind==='terrazzo') {
    const count=kind==='granite'?4800:330;
    for(let i=0;i<count;i++){
      const x=rand()*S,y=rand()*S,r=kind==='granite'?.5+rand()*1.7:1+rand()*5,g=95+rand()*140;
      c.fillStyle=`rgb(${g},${g},${g})`;
      for(const dx of [-S,0,S])for(const dy of [-S,0,S]){c.beginPath();c.moveTo(x+dx-r,y+dy);c.lineTo(x+dx+r*.6,y+dy-r);c.lineTo(x+dx+r,y+dy+r*.7);c.lineTo(x+dx-r*.4,y+dy+r);c.closePath();c.fill();}
    }
  } else if(kind==='stripe') {
    for(let x=0;x<S;x+=32){rect(x,0,12,S,'#cecece');rect(x+13,0,1,S,'#ababab');}
  } else if(kind==='dot') {
    for(let x=16;x<S;x+=32)for(let y=16;y<S;y+=32){c.fillStyle='#aeb3b0';c.beginPath();c.arc(x,y,3,0,Math.PI*2);c.fill();}
  } else if(kind==='linen'||kind==='wool') {
    const spacing=kind==='wool'?8:4;
    rect(0,0,S,S,'#ededed');
    for(let x=0;x<S;x+=spacing){line(x,0,x,S,'#b5b5b5',1);line(0,x,S,x,'#cdcdcd',1);}
    if(kind==='wool')for(let x=0;x<S;x+=8)for(let y=0;y<S;y+=8){const flip=(x+y)%16===0;rect(x+(flip?1:3),y+1,flip?5:2,flip?2:5,'#fafafa');}
  } else if(kind==='limewash'||kind==='concrete') {
    for(let i=0;i<200;i++){
      const x=rand()*S,y=rand()*S,r=6+rand()*26;c.fillStyle=`rgba(90,90,90,${rand()*.035})`;
      for(const dx of [-S,0,S])for(const dy of [-S,0,S]){c.beginPath();c.ellipse(x+dx,y+dy,r,r*.6,rand(),0,Math.PI*2);c.fill();}
    }
    if(kind==='concrete')for(const x of [16,240])for(const y of [16,240]){c.fillStyle='#b1b1b1';c.beginPath();c.arc(x,y,1.6,0,Math.PI*2);c.fill();}
  } else if(kind==='carpet') {
    rect(0,0,S,S,'#e5e5e5');for(let i=0;i<11000;i++){const x=rand()*S,y=rand()*S;line(x,y,x+rand()*2-1,y+2,`rgba(70,70,70,${rand()*.18})`,.7);}
  }
  noise(kind==='plaster'?15000:5000,kind==='plaster'?.13:.035);
  patternCache.set(kind,canvas);return canvas;
}
export function materialPreview(spec) {
  const finish=FINISHES.find(f=>f.id===spec.finish);
  if(spec.finish==='custom')return {backgroundColor:spec.color,backgroundImage:spec.image?`url(${spec.image})`:'none',backgroundSize:'cover'};
  if(!finish||finish.pattern==='none')return {backgroundColor:spec.color||finish?.color,backgroundImage:'none'};
  if(!previewCache.has(finish.pattern))previewCache.set(finish.pattern,patternCanvas(finish.pattern).toDataURL('image/png'));
  return {backgroundColor:spec.color||finish.color,backgroundImage:`url(${previewCache.get(finish.pattern)})`,backgroundSize:finish.pattern==='tile'?'48px 48px':'128px 128px',backgroundBlendMode:'multiply'};
}
export function createMaterial(spec) {
  const finish=FINISHES.find(f=>f.id===spec.finish);
  const material=new THREE.MeshStandardMaterial({color:spec.color,roughness:spec.roughness,metalness:0,side:THREE.DoubleSide});
  if(spec.finish==='custom'&&spec.image)material.map=new THREE.TextureLoader().load(spec.image);
  else if(finish&&finish.pattern!=='none')material.map=new THREE.CanvasTexture(patternCanvas(finish.pattern));
  if(material.map){
    const texture=material.map, unit=finish?.unit||1;
    texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(1/(unit*spec.size),1/(unit*spec.size));texture.center.set(.5,.5);texture.rotation=THREE.MathUtils.degToRad(spec.rotation);texture.anisotropy=4;
  }
  return material;
}
export function disposeMaterial(material) {
  for(const m of Array.isArray(material)?material:[material]){m?.map?.dispose();m?.dispose();}
}
