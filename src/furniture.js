import * as THREE from "three";
export const CATALOG = [
  { id: "sofa", name: "双人沙发", category: "客厅", size: "1.9 × 0.85 m", icon: "sofa" },
  { id: "table", name: "圆形茶几", category: "客厅", size: "Ø 0.8 × 0.42 m", icon: "table" },
  { id: "chair", name: "休闲椅", category: "客厅", size: "0.65 × 0.7 m", icon: "chair" },
  { id: "bed", name: "双人床", category: "卧室", size: "1.8 × 2.1 m", icon: "bed" },
  { id: "cabinet", name: "边柜", category: "收纳", size: "1.2 × 0.4 m", icon: "cabinet" },
  { id: "plant", name: "室内绿植", category: "装饰", size: "Ø 0.5 × 1.25 m", icon: "plant" },
];
const extraFurniture = [
  ['sofa-wide', '三人沙发', '客厅', '2.4 × 0.9 m', 'sofa', '沙发 三人 sofa'],
  ['sofa-corner', 'L 形沙发', '客厅', '2.6 × 1.6 m', 'sofa', '转角 贵妃 沙发 sofa'],
  ['coffee-table', '长方茶几', '客厅', '1.1 × 0.55 m', 'table', '茶几 coffee'],
  ['tv-stand', '电视柜', '客厅', '1.8 × 0.4 m', 'cabinet', '电视 地柜 tv'],
  ['tv', '电视', '客厅', '1.24 × 0.2 m', 'tv', '电视 屏幕 显示器 tv'],
  ['single-bed', '单人床', '卧室', '1.0 × 2.05 m', 'bed', '床 单人 bed'],
  ['nightstand', '床头柜', '卧室', '0.45 × 0.4 m', 'cabinet', '床头柜 bedside'],
  ['wardrobe', '衣柜', '卧室', '1.8 × 0.6 m', 'cabinet', '衣柜 wardrobe'],
  ['dining-table', '长餐桌', '餐厅', '1.6 × 0.8 m', 'table', '餐桌 dining'],
  ['round-dining-table', '圆餐桌', '餐厅', '直径 1.2 m', 'table', '餐桌 圆桌 dining'],
  ['dining-chair', '餐椅', '餐厅', '0.46 × 0.5 m', 'chair', '餐椅 椅子 chair'],
  ['desk', '书桌', '工作区', '1.2 × 0.6 m', 'table', '书桌 学习 写字 desk'],
  ['office-desk', '办公桌', '工作区', '1.6 × 0.75 m', 'table', '办公 写字 desk'],
  ['office-chair', '办公椅', '工作区', '0.65 × 0.65 m', 'chair', '办公椅 转椅 chair'],
  ['bookshelf', '书架', '工作区', '0.9 × 0.32 m', 'shelf', '书架 书柜 bookshelf'],
  ['shoe-cabinet', '鞋柜', '收纳', '1.0 × 0.32 m', 'cabinet', '鞋柜 玄关 shoe'],
  ['storage-shelf', '储物架', '收纳', '0.9 × 0.4 m', 'shelf', '架子 置物架 储物 shelf'],
  ['fridge', '冰箱', '厨房', '0.7 × 0.7 m', 'fridge', '冰箱 refrigerator fridge'],
  ['kitchen-counter', '橱柜', '厨房', '1.2 × 0.6 m', 'cabinet', '橱柜 台面 厨柜 kitchen'],
  ['stove', '灶台', '厨房', '0.8 × 0.6 m', 'kitchen', '灶台 燃气灶 stove'],
  ['sink', '水槽', '厨房', '0.8 × 0.6 m', 'kitchen', '水槽 洗菜池 sink'],
  ['toilet', '马桶', '卫浴', '0.4 × 0.7 m', 'bath', '马桶 卫生间 toilet'],
  ['vanity', '洗手台', '卫浴', '0.8 × 0.5 m', 'bath', '洗手台 浴室柜 洗脸盆 vanity'],
  ['shower', '淋浴区', '卫浴', '0.9 × 0.9 m', 'bath', '淋浴 花洒 shower'],
  ['door', '平开门', '门窗', '1.0 × 2.16 m', 'door', '房门 门 door'],
  ['rug', '地毯', '装饰', '2.0 × 1.4 m', 'rug', '地毯 carpet rug'],
  ['ceiling-light', '圆形吸顶灯', '灯具', '直径 0.45 m', 'lamp', '吸顶灯 顶灯 灯 照明 light lamp'],
  ['pendant-light', '吊灯', '灯具', '直径 0.4 m', 'lamp', '吊灯 餐灯 灯 照明 light lamp'],
  ['floor-lamp', '落地灯', '灯具', '直径 0.44 m', 'lamp', '落地灯 灯 lamp'],
];
CATALOG.push(...extraFurniture.map(([id,name,category,size,icon,keywords])=>({id,name,category,size,icon,keywords})));
export const FURNITURE_CATEGORIES = ['全部', ...new Set(CATALOG.map(item=>item.category))];
export function searchFurniture(query, category = '全部') {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return CATALOG.filter(item => (category === '全部' || item.category === category) && terms.every(term => `${item.name} ${item.category} ${item.keywords || ''} ${item.id}`.toLowerCase().includes(term)));
}
export function setDoorPose(root, door, immediate = false) {
  const hinge = root.getObjectByName('door-hinge');
  if (!hinge) return;
  root.userData.door = { open: !!door.open, hinge: door.hinge === 'right' ? 'right' : 'left' };
  const left = root.userData.door.hinge === 'left';
  hinge.position.x = left ? -.44 : .44;
  root.getObjectByName('door-leaf').scale.x = left ? 1 : -1;
  const angle = root.userData.door.open ? (left ? -Math.PI/2 : Math.PI/2) : 0;
  hinge.userData.targetAngle = angle;
  if (immediate) hinge.rotation.y = angle;
}

export const isLampType = type => ['ceiling-light', 'pendant-light', 'floor-lamp'].includes(type);
export function setLampView(root, mode) {
  if (root.userData.mount !== 'ceiling') return;
  root.traverse(object => { if (object.isMesh) object.visible = mode === 'walk'; });
}
export function setLampState(root, lamp = { on: true }) {
  const light = root.getObjectByName('fixture-light');
  if (!light) return;
  root.userData.lamp = { on: lamp.on !== false };
  light.target = root.getObjectByName('fixture-target');
  light.intensity = root.userData.lamp.on ? 28 : 0;
  light.shadow.needsUpdate = true;
  const emitter = root.getObjectByName('fixture-emitter');
  if (emitter) emitter.material.emissiveIntensity = root.userData.lamp.on ? 1.2 : 0;
}

export function createFurniture(type) {
  const root = new THREE.Group();
  const fabric = new THREE.MeshStandardMaterial({ color: "#b5bba4", roughness: 0.96 });
  const wood = new THREE.MeshStandardMaterial({ color: "#a37d56", roughness: 0.65 });
  const cream = new THREE.MeshStandardMaterial({ color: "#e5ded0", roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: "#3b4238", roughness: 0.8 });
  function add(geometry, material, position, rotation) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }
  const box = (size, pos, mat = wood) => add(new THREE.BoxGeometry(...size), mat, pos);
  const cylinder = (rt, rb, h, pos, mat = wood) => add(new THREE.CylinderGeometry(rt, rb, h, 32), mat, pos);
  if (type === "sofa") {
    box([1.9, 0.2, 0.85], [0, 0.26, 0]);
    box([1.72, 0.25, 0.68], [0, 0.47, -0.02], fabric);
    box([1.9, 0.5, 0.17], [0, 0.65, -0.36], fabric);
    for (const x of [-0.89, 0.89]) box([0.16, 0.36, 0.85], [x, 0.55, 0], fabric);
    for (const x of [-0.73, 0.73]) for (const z of [-0.28, 0.28]) box([0.07, 0.16, 0.07], [x, 0.08, z], dark);
  } else if (type === "table") {
    cylinder(0.4, 0.4, 0.055, [0, 0.4, 0]);
    cylinder(0.11, 0.16, 0.37, [0, 0.185, 0]);
  } else if (type === "chair") {
    box([0.64, 0.14, 0.66], [0, 0.43, 0], cream);
    box([0.64, 0.48, 0.1], [0, 0.7, -0.29], fabric);
    for (const x of [-0.25, 0.25]) for (const z of [-0.24, 0.24]) box([0.045, 0.36, 0.045], [x, 0.18, z]);
    for (const x of [-0.3, 0.3]) box([0.055, 0.055, 0.6], [x, 0.64, 0]);
  } else if (type === "bed") {
    box([1.8, 0.25, 2.1], [0, 0.2, 0]);
    box([1.75, 0.22, 2.02], [0, 0.435, 0], cream);
    box([1.85, 0.85, 0.09], [0, 0.52, -1], wood);
    box([1.76, 0.04, 1.1], [0, 0.56, 0.4], fabric);
    for (const x of [-0.46, 0.46]) box([0.7, 0.14, 0.42], [x, 0.61, -0.65], cream);
  } else if (type === "cabinet") {
    box([1.2, 0.65, 0.4], [0, 0.465, 0]);
    for (const x of [-0.3, 0.3]) box([0.58, 0.57, 0.025], [x, 0.46, 0.213], cream);
    for (const x of [-0.08, 0.08]) box([0.02, 0.09, 0.025], [x, 0.49, 0.24], dark);
    for (const x of [-0.5, 0.5]) for (const z of [-0.14, 0.14]) box([0.045, 0.14, 0.045], [x, 0.07, z], dark);
  } else if (type === "plant") {
    cylinder(0.19, 0.13, 0.33, [0, 0.165, 0], cream);
    cylinder(0.015, 0.022, 0.7, [0, 0.66, 0], wood);
    const leaf = new THREE.MeshStandardMaterial({ color: "#617953", roughness: 0.85 });
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4,
        y = 0.6 + (i % 4) * 0.16;
      const l = add(new THREE.SphereGeometry(1, 12, 8), leaf, [Math.cos(a) * 0.15, y, Math.sin(a) * 0.15]);
      l.scale.set(0.16, 0.25, 0.055);
      l.rotation.set(0.4, a, 0.5);
    }
  }
  else if (type === 'sofa-wide' || type === 'sofa-corner') {
    const w = type === 'sofa-wide' ? 2.4 : 2.6;
    box([w,.2,.9],[0,.25,0]);
    box([w,.5,.16],[0,.65,-.37],fabric);
    for (const x of [-w/2+.08,w/2-.08]) box([.16,.36,.9],[x,.55,0],fabric);
    for (let i=0;i<3;i++) box([(w-.4)/3,.23,.7],[-(w-.4)/3+i*(w-.4)/3,.465,.015],fabric);
    for (const x of [-w/2+.2,w/2-.2]) for (const z of [-.3,.3]) box([.07,.15,.07],[x,.075,z],dark);
    if(type === 'sofa-corner') { box([.82,.2,1.6],[-w/2+.5,.25,.35]); box([.78,.23,1.35],[-w/2+.5,.465,.4],fabric); }
  } else if (type === 'coffee-table' || type === 'dining-table' || type === 'desk' || type === 'office-desk') {
    const specs = {'coffee-table':[1.1,.55,.42], 'dining-table':[1.6,.8,.75], desk:[1.2,.6,.75], 'office-desk':[1.6,.75,.75]};
    const [w,d,h] = specs[type];
    box([w,.06,d],[0,h-.03,0]);
    for(const x of [-w/2+.08,w/2-.08]) for(const z of [-d/2+.08,d/2-.08]) box([.055,h-.06,.055],[x,(h-.06)/2,z],type==='office-desk'?dark:wood);
    if(type==='office-desk') { box([.4,.52,d-.1],[w/2-.28,.43,0],cream); for(const y of [.32,.5,.68]) {box([.37,.012,.018],[w/2-.28,y,d/2-.04],wood);box([.1,.018,.025],[w/2-.28,y+.055,d/2-.02],dark);} }
    if(type==='desk') box([w-.16,.1,.2],[0,.64,-d/2+.13],cream);
  } else if (type === 'round-dining-table') {
    cylinder(.6,.6,.06,[0,.72,0]); cylinder(.09,.15,.69,[0,.345,0]); cylinder(.33,.36,.04,[0,.02,0]);
  } else if (type === 'dining-chair') {
    box([.46,.07,.48],[0,.455,0],cream);box([.46,.36,.055],[0,.69,-.215]);
    for(const x of [-.18,.18])for(const z of [-.18,.18])box([.04,.42,.04],[x,.21,z]);
  } else if (type === 'office-chair') {
    cylinder(.22,.25,.045,[0,.025,0],dark);cylinder(.035,.04,.38,[0,.23,0],dark);
    box([.5,.09,.48],[0,.46,0],fabric);box([.5,.5,.07],[0,.71,-.21],fabric);
    for(const x of [-.29,.29]){box([.045,.22,.045],[x,.55,0],dark);box([.07,.045,.38],[x,.66,0],dark);}
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const leg=box([.29,.025,.035],[Math.cos(a)*.14,.06,Math.sin(a)*.14],dark);leg.rotation.y=-a;}
  } else if (type === 'single-bed') {
    box([1,.24,2.05],[0,.18,0]);box([.96,.2,1.98],[0,.4,.01],cream);box([1,.85,.08],[0,.425,-.985]);
    box([.95,.035,1.05],[0,.517,.42],fabric);box([.7,.12,.4],[0,.56,-.65],cream);
  } else if (['nightstand','wardrobe','shoe-cabinet','tv-stand','kitchen-counter','stove','sink','vanity'].includes(type)) {
    const sizes={nightstand:[.45,.4,.5],wardrobe:[1.8,.6,2.2],'shoe-cabinet':[1,.32,1.05],'tv-stand':[1.8,.4,.48],'kitchen-counter':[1.2,.6,.9],stove:[.8,.6,.9],sink:[.8,.6,.9],vanity:[.8,.5,.85]};
    const [w,d,h]=sizes[type];
    box([w,h-.06,d],[0,(h-.06)/2,0]);box([w,.06,d],[0,h-.03,0],type==='nightstand'?wood:cream);
    const doors=type==='wardrobe'?3:2;
    for(let i=0;i<doors;i++){const x=-w/2+(i+.5)*w/doors;box([w/doors-.025,h-.14,.022],[x,(h-.14)/2+.035,d/2+.012],cream);box([.016,Math.min(.12,h*.15),.025],[x+w/doors*.3,h*.5,d/2+.035],dark);}
    if(type==='stove'){box([w-.08,.018,d-.08],[0,h+.009,0],dark);for(const x of [-.18,.18])for(const z of [-.14,.14])cylinder(.09,.09,.018,[x,h+.027,z],dark);}
    if(type==='sink'||type==='vanity'){
      const basin=new THREE.MeshStandardMaterial({color:'#929e9c',roughness:.65});
      box([w*.65,.012,d*.6],[0,h+.007,0],basin);box([w*.62,.04,.025],[0,h+.02,-d*.3],cream);box([w*.62,.04,.025],[0,h+.02,d*.3],cream);
      cylinder(.015,.015,.24,[0,h+.12,-d*.35],dark);box([.03,.025,.18],[0,h+.23,-d*.35+.075],dark);
    }
  } else if (type === 'bookshelf' || type === 'storage-shelf') {
    const h=type==='bookshelf'?1.8:1.5,d=type==='bookshelf'?.32:.4;
    for(const x of [-.43,.43])box([.04,h,d],[x,h/2,0]);
    for(let i=0;i<5;i++)box([.9,.035,d],[0,.02+i*(h-.04)/4,0]);
    if(type==='bookshelf')box([.9,h,.025],[0,h/2,-d/2+.012],cream);
  } else if (type === 'tv') {
    box([1.24,.72,.065],[0,.49,0],dark);box([1.17,.65,.008],[0,.49,.037],new THREE.MeshStandardMaterial({color:'#344a5d',roughness:.4}));
    for(const x of [-.4,.4]){const foot=box([.2,.035,.2],[x,.025,0],dark);foot.rotation.y=x>0?.3:-.3;}box([.04,.1,.04],[.4,.08,0],dark);box([.04,.1,.04],[-.4,.08,0],dark);
  } else if (type === 'fridge') {
    box([.7,1.8,.7],[0,.9,0],cream);box([.66,1.02,.025],[0,1.25,.365],cream);box([.66,.67,.025],[0,.36,.365],cream);
    box([.66,.02,.018],[0,.715,.385],dark);for(const y of [.5,1.1])box([.025,.22,.04],[-.23,y,.4],dark);
  } else if (type === 'toilet') {
    cylinder(.14,.18,.32,[0,.16,.08],cream);const bowl=add(new THREE.SphereGeometry(1,16,10),cream,[0,.34,.1]);bowl.scale.set(.2,.13,.28);
    const seat=add(new THREE.TorusGeometry(.15,.025,8,20),cream,[0,.45,.1],[Math.PI/2,0,0]);seat.scale.set(1,1.3,1);
    box([.36,.55,.18],[0,.36,-.25],cream);box([.36,.025,.19],[0,.65,-.25],cream);box([.05,.012,.035],[0,.67,-.25],dark);
  } else if (type === 'shower') {
    box([.9,.06,.9],[0,.03,0],cream);
    const glass=new THREE.MeshStandardMaterial({color:'#b5c8cd',transparent:true,opacity:.22,roughness:.2,depthWrite:false,side:THREE.DoubleSide});
    box([.018,1.9,.9],[-.44,1.01,0],glass);box([.9,1.9,.018],[0,1.01,-.44],glass);
    cylinder(.018,.018,1.75,[-.3,.94,-.37],dark);box([.04,.035,.23],[-.3,1.83,-.27],dark);cylinder(.09,.09,.025,[-.3,1.81,-.16],dark);
  } else if (type === 'rug') {
    box([2,.018,1.4],[0,.009,0],fabric);for(const x of [-.85,.85])box([.045,.002,1.3],[x,.019,0],cream);
  } else if (type === 'ceiling-light') {
    cylinder(.225,.225,.075,[0,.0375,0],cream);
  } else if (type === 'pendant-light') {
    cylinder(.055,.055,.035,[0,.565,0],dark);
    cylinder(.008,.008,.38,[0,.36,0],dark);
    cylinder(.09,.2,.18,[0,.11,0],cream);
  } else if (type === 'floor-lamp') {
    cylinder(.2,.22,.04,[0,.02,0],dark);cylinder(.018,.018,1.35,[0,.705,0],dark);cylinder(.15,.23,.32,[0,1.47,0],cream);
  } else if (type === 'door') {
    for(const x of [-.47,.47])box([.06,2.16,.14],[x,1.08,0],cream);box([1,.06,.14],[0,2.13,0],cream);
    const hinge=new THREE.Group();hinge.name='door-hinge';root.add(hinge);
    const leaf=new THREE.Group();leaf.name='door-leaf';hinge.add(leaf);
    const panel=new THREE.Mesh(new THREE.BoxGeometry(.88,2.06,.045),wood);panel.position.set(.44,1.06,0);panel.castShadow=panel.receiveShadow=true;leaf.add(panel);
    const handle=new THREE.Mesh(new THREE.BoxGeometry(.13,.028,.035),dark);handle.position.set(.76,1.05,.04);handle.castShadow=true;leaf.add(handle);
    setDoorPose(root,{open:false,hinge:'left'},true);
  }
  if (isLampType(type)) {
    root.userData.mount = type === 'floor-lamp' ? 'floor' : 'ceiling';
    const y = type === 'floor-lamp' ? 1.3 : (type === 'pendant-light' ? .012 : -.006);
    const diffuser = cylinder(type === 'ceiling-light' ? .205 : .14, type === 'ceiling-light' ? .205 : .14, .012, [0,y,0], new THREE.MeshStandardMaterial({color:'#fff7e6',emissive:'#ffe8bd',emissiveIntensity:1.2,roughness:.7}));
    diffuser.name = 'fixture-emitter';
    // A fixture must not cast a shadow over its own light source.
    diffuser.castShadow = false;
    const light = new THREE.SpotLight('#fff0d7',28,7,Math.PI*.4,.65,2);
    light.name = 'fixture-light';
    light.position.set(0,y-.035,type === 'floor-lamp' ? .07 : 0);
    light.rotation.x = -Math.PI/2;
    light.castShadow = true;
    light.shadow.mapSize.set(512,512);
    light.shadow.camera.near = .05;
    light.shadow.bias = -.0004;
    light.shadow.normalBias = .025;
    light.shadow.radius = 2;
    light.shadow.autoUpdate = false;
    const target = new THREE.Object3D();target.name = 'fixture-target';target.position.set(0,0,-1);
    light.add(target);
    root.add(light);
    setLampState(root);
  }
  const bounds = new THREE.Box3().setFromObject(root);
  root.userData.baseDimensions = bounds.getSize(new THREE.Vector3()).toArray();
  return root;
}
