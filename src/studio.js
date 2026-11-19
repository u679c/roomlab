import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { clone as cloneModel } from "three/addons/utils/SkeletonUtils.js";
import { Octree } from "three/addons/math/Octree.js";
import { Capsule } from "three/addons/math/Capsule.js";
import { FINISHES, createMaterial, defaultFinish, disposeMaterial } from "./materials.js";
import { CATALOG, createFurniture, setDoorPose, isLampType, setLampState, setLampView } from "./furniture.js";
import { DEFAULT_LIGHTING, sunState, validLighting } from "./lighting.js";
import { readSurfaceMigration, migrateSurfaceProject } from "./model-migration.js";
import { SceneEffects } from "./scene-effects.js";
import { createCeiling, roomLightPositions } from "./interior.js";
import { createRoomPlan, roomAtPosition } from "./rooms.js";
import { RoomBounce } from "./room-bounce.js";
import { NaturalLight } from "./natural-light.js";

const copy = (x) => JSON.parse(JSON.stringify(x));
const uid = () => crypto.randomUUID();
const v = () => new THREE.Vector3();
const MAX_HISTORY = 40;
export class Studio {
  constructor(host, events) {
    this.host = host;
    this.events = events;
    this.disposed = false;
    this.surfaceMap = new Map();
    this.furnitureMap = new Map();
    this.assets = new Map();
    this.roomNames = new Map();
    this.history = [];
    this.cursor = -1;
    this.mode = "orbit";
    this.tool = "select";
    this.snap = true;
    this.brush = defaultFinish();
    this.keys = new Set();
    this.velocity = v();
    this.busy = false;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor("#e8ecf2");
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    host.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.05, 250);
    this.camera.position.set(13, 15, 17);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.maxPolarAngle = Math.PI * 0.49;
    this.orbit.minDistance = 1;
    this.orbit.maxDistance = 60;
    this.lookDrag = null;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute("aria-label", "三维编辑视图");
    this.transform = new TransformControls(this.camera, this.renderer.domElement);
    this.scene.add(this.transform.getHelper());
    this.transform.addEventListener("dragging-changed", (e) => {
      this.orbit.enabled = !e.value && this.mode === "orbit";
    });
    this.transform.addEventListener("objectChange", () => { this.refreshSelection(); this.events.projectChange?.(); });
    this.transform.addEventListener("mouseUp", () => {
      if (this.snap && this.transform.mode === "translate") this.groundSelected();
      this.commit();
    });
    this.transform.setTranslationSnap(0.1);
    this.transform.setRotationSnap(Math.PI / 12);
    this.transform.setScaleSnap(0.1);
    this.content = new THREE.Group();
    this.scene.add(this.content);
    this.house = new THREE.Group();
    this.furniture = new THREE.Group();
    this.content.add(this.house, this.furniture);
    this.ambientLight = new THREE.HemisphereLight("#f6f8ff", "#a5afbf", 2.6);
    this.scene.add(this.ambientLight);
    const sun = this.sun = new THREE.DirectionalLight("#fff6e5", 3.2);
    sun.position.set(8, 17, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 0.1, far: 55 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 2;
    this.scene.add(sun);
    const fill = this.fillLight = new THREE.DirectionalLight("#ecf3ff", 1.2);
    fill.position.set(-8, 7, -9);
    this.scene.add(fill);
    this.lighting = { ...DEFAULT_LIGHTING };
    this.updateLighting();
    this.grid = new THREE.GridHelper(40, 80, "#a8bce4", "#d0daeb");
    this.grid.position.y = -0.5;
    this.scene.add(this.grid);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial({ color: "#eef1f6", roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.51;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.octree = new Octree();
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.hoverRay = new THREE.Raycaster();
    this.hoverPointer = null;
    this.doorHover = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.listeners = [];
    const on = (target, name, handler) => {
      target.addEventListener(name, handler);
      this.listeners.push(() => target.removeEventListener(name, handler));
    };
    on(this.renderer.domElement, "pointerdown", (e) => {
      this.renderer.domElement.focus({ preventScroll: true });
      this.down = [e.clientX, e.clientY];
      this.pointerDragged = false;
      this.wasTransform = !!this.transform.axis;
      if (this.mode === "walk" && e.button === 0 && !this.wasTransform && !this.busy && !this.transform.dragging) {
        this.lookDrag = { id: e.pointerId, x: e.clientX, y: e.clientY };
        this.renderer.domElement.setPointerCapture(e.pointerId);
      }
    });
    on(this.renderer.domElement, "pointermove", (e) => {
      this.hoverPointer = [e.clientX, e.clientY];
      if (!this.lookDrag || this.lookDrag.id !== e.pointerId) return;
      if (!this.pointerDragged && Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) <= 5) return;
      this.pointerDragged = true;
      const rotation = new THREE.Euler().setFromQuaternion(this.camera.quaternion, "YXZ");
      rotation.y -= (e.clientX - this.lookDrag.x) * 0.003;
      rotation.x = THREE.MathUtils.clamp(rotation.x - (e.clientY - this.lookDrag.y) * 0.003, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
      rotation.z = 0;
      this.camera.quaternion.setFromEuler(rotation);
      this.lookDrag.x = e.clientX;
      this.lookDrag.y = e.clientY;
    });
    on(this.renderer.domElement, 'pointerleave', (e) => {
      if (!(e.relatedTarget instanceof Element && e.relatedTarget.closest('.door-interaction'))) this.clearDoorHover();
    });
    on(this.renderer.domElement, "contextmenu", (e) => {
      if (this.mode === "walk") e.preventDefault();
    });
    on(this.renderer.domElement, "lostpointercapture", () => { this.lookDrag = null; });
    on(this.renderer.domElement, "pointercancel", () => { this.stopLooking(); this.down = null; });
    on(this.renderer.domElement, "pointerup", (e) => {
      this.stopLooking();
      if (e.button !== 0 || !this.down || this.pointerDragged || Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 5 || this.wasTransform || this.transform.dragging || this.busy) return;
      this.pick(e);
    });
    on(window, "keydown", (e) => {
      if ((e.target instanceof Element && (e.target.closest("input,select,textarea") || e.target.isContentEditable)) || this.busy) return;
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        e.preventDefault();
        this.undo(e.shiftKey ? 1 : -1);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") {
        e.preventDefault();
        this.undo(1);
        return;
      }
      this.keys.add(e.code);
      if (["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(e.code)) e.preventDefault();
      if (e.code === "Delete" || e.code === "Backspace") this.deleteSelected();
      if (e.code === "KeyG") this.setTransform("translate");
      if (e.code === "KeyR") this.setTransform("rotate");
      if (e.code === "KeyS" && this.mode === "orbit") this.setTransform("scale");
      if (e.code === "Escape") { this.stopLooking(); this.select(null); }
    });
    on(window, "keyup", (e) => this.keys.delete(e.code));
    on(window, "blur", () => { this.keys.clear(); this.stopLooking(); });
    on(document, "focusin", (e) => {
      if (e.target !== this.renderer.domElement) this.keys.clear();
    });
    on(this.renderer.domElement, "webglcontextlost", (e) => {
      e.preventDefault();
      this.toast("显卡上下文已丢失，请刷新页面重新加载");
    });
    this.effects = new SceneEffects(this.renderer, this.scene, this.camera, this.transform.getHelper(), () => this.ceiling?.occluder);
    this.resize = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      this.camera.aspect = width / Math.max(height, 1);
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.effects.setSize(width, height);
    });
    this.resize.observe(host);
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
    this.loader = new GLTFLoader();
    this.draco = new DRACOLoader();
    this.draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    this.loader.setDRACOLoader(this.draco);
    this.loader.setMeshoptDecoder(MeshoptDecoder);
  }
  updateLighting(patch = {}, commit = false) {
    const next = { ...this.lighting, ...patch };
    if (!validLighting(next)) return;
    this.lighting = next;
    const state = sunState(next);
    if (this.naturalLight) {
      this.roomBounce.setDaylight(this.naturalLight.evaluate(state));
      this.roomBounce.sync(this.content,this.furniture.children);
    }
    const center = this.bounds?.getCenter(v()) || v();
    center.y = 0;
    this.sun.position.fromArray(state.position).add(center);
    this.sun.target.position.copy(center);
    this.sun.target.updateMatrixWorld();
    this.fitSunShadow();
    this.sun.intensity = state.direct;
    this.sun.castShadow = state.direct > .01;
    this.sun.color.set('#fff5df').lerp(new THREE.Color('#ffab65'), state.warmth);
    this.ambientLight.intensity = state.ambient;
    this.ambientLight.color.set('#eef2fa').lerp(new THREE.Color('#f4c4a5'), state.warmth*.3);
    this.ambientLight.groundColor.set('#b1b6bf');
    this.fillLight.intensity = state.fill;
    this.fillLight.color.set(state.day ? '#d8e4ff' : '#6d8dc6');
    const sky = new THREE.Color('#182238').lerp(new THREE.Color(state.weather.sky), state.daylight);
    if (state.warmth > 0) sky.lerp(new THREE.Color('#d9b4a4'), state.warmth*.4);
    this.renderer.setClearColor(sky);
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.needsUpdate = true;
    if (commit && this.history.length) this.commit();
    else { this.emit(); this.events.projectChange?.(); }
  }
  fitSunShadow() {
    if (!this.bounds) return;
    // Concentrate shadow texels on the actual house instead of a 26 m-wide box.
    const light = this.sun, camera = light.shadow.camera;
    light.updateMatrixWorld(true);
    light.shadow.updateMatrices(light);
    const box = this.bounds.clone().expandByScalar(.65);
    const lightBounds = new THREE.Box3();
    for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
      lightBounds.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
    }
    Object.assign(camera, {
      left: lightBounds.min.x, right: lightBounds.max.x,
      bottom: lightBounds.min.y, top: lightBounds.max.y,
      near: Math.max(.1,-lightBounds.max.z), far: Math.max(1,-lightBounds.min.z),
    });
    camera.updateProjectionMatrix();
  }
  clearDoorHover() {
    this.hoverPointer = null;
    if (this.doorHover) { this.doorHover = null; this.events.doorHover?.(null); }
  }
  updateDoorHover() {
    if (!this.hoverPointer || this.busy || this.transform.dragging || (this.lookDrag && this.pointerDragged)) {
      if (this.doorHover) { this.doorHover = null; this.events.doorHover?.(null); }
      return;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    const [x,y] = this.hoverPointer;
    this.hoverRay.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1), this.camera);
    const hit = this.hoverRay.intersectObjects([this.house,this.furniture],true).find(hit => hit.object.visible);
    let object = hit?.object;
    while (object?.parent && object.parent !== this.furniture) object = object.parent;
    if (object?.parent !== this.furniture || (object.userData.type !== 'door' && !isLampType(object.userData.type))) {
      if (this.doorHover) { this.doorHover = null; this.events.doorHover?.(null); }
      return;
    }
    const anchor = object.localToWorld(new THREE.Vector3(0,object.userData.baseDimensions[1]*.5,0)).project(this.camera);
    if (anchor.z < -1 || anchor.z > 1) { this.clearDoorHover(); return; }
    const hover = {id:object.userData.id, kind:isLampType(object.userData.type) ? 'lamp' : 'door', open:!!object.userData.door?.open, on:!!object.userData.lamp?.on,
      x:Math.max(52,Math.min(rect.width-52,(anchor.x+1)*.5*rect.width))+this.host.offsetLeft,
      y:Math.max(20,Math.min(rect.height-25,(-anchor.y+1)*.5*rect.height))+this.host.offsetTop};
    if (!this.doorHover || hover.id!==this.doorHover.id || hover.open!==this.doorHover.open || hover.on!==this.doorHover.on || Math.abs(hover.x-this.doorHover.x)>1 || Math.abs(hover.y-this.doorHover.y)>1) {
      this.doorHover=hover; this.events.doorHover?.(hover);
    }
  }
  changeDoor(id, patch) {
    const object=this.furnitureMap.get(id);
    if (this.busy || object?.parent!==this.furniture || object.userData.type!=='door') return;
    setDoorPose(object,{...object.userData.door,...patch},this.reducedMotion);
    this.commit();this.refreshSelection();
  }
  toggleDoor(id) {
    const object=this.furnitureMap.get(id);
    if(object?.userData.type==='door')this.changeDoor(id,{open:!object.userData.door.open});
  }
  toggleFixture(id) {
    const object = this.furnitureMap.get(id);
    if (object?.userData.type === 'door') { this.toggleDoor(id); return; }
    if (this.busy || object?.parent !== this.furniture || !isLampType(object.userData.type)) return;
    setLampState(object, { on: !object.userData.lamp.on });
    this.refreshSelection();
    this.commit();
  }
  setAllFixtures(on) {
    if (this.busy) return;
    for (const object of this.furniture.children) {
      if (isLampType(object.userData.type)) setLampState(object,{on:!!on});
    }
    this.refreshSelection();
    this.commit();
  }
  lampRoom(object) {
    const automatic = roomAtPosition(this.roomPlan?.rooms || [],object.position);
    const assignment = object.userData.roomId || '';
    return { automatic, assignment, id: assignment === 'unassigned' ? null : assignment || automatic };
  }
  assignLampRoom(id,roomId) {
    const object = this.furnitureMap.get(id);
    if (this.busy || object?.parent !== this.furniture || !isLampType(object.userData.type)) return;
    if (roomId && roomId !== 'unassigned' && !this.roomPlan.rooms.some(room=>room.id===roomId)) return;
    object.userData.roomId = roomId || undefined;
    this.refreshSelection();this.commit();
  }
  renameRoom(id,name) {
    const trimmed = name.trim();
    if (this.busy || !this.roomNames.has(id) || !trimmed || trimmed.length>32) return;
    this.roomNames.set(id,trimmed);
    this.commit();
  }
  invalidateInteriorShadows() {
    this.roomBounce?.sync(this.content,this.furniture.children);
    for (const object of this.furniture.children) {
      const light = object.getObjectByName('fixture-light');
      if (light) light.shadow.needsUpdate = true;
    }
  }
  seedInteriorLights() {
    this.defaultLightPositions.forEach(({name, point}, index) => {
      const id = `interior-light-${name}`;
      const object = this.furnitureMap.get(id) || createFurniture('ceiling-light');
      object.userData = { ...object.userData, id, label: `吸顶灯 ${index + 1}`, category: 'furniture', type: 'ceiling-light', source: null };
      object.position.copy(point);
      object.rotation.set(0,0,0);
      object.scale.set(1,1,1);
      setLampState(object, { on: true });
      this.furniture.add(object);
      this.furnitureMap.set(id, object);
      this.mountFurniture(object);
      setLampView(object,this.mode);
    });
    this.invalidateInteriorShadows();
  }
  stopLooking() {
    const drag = this.lookDrag;
    this.lookDrag = null;
    if (drag && this.renderer.domElement.hasPointerCapture(drag.id)) this.renderer.domElement.releasePointerCapture(drag.id);
  }
  toast(message) {
    this.events.toast?.(message);
  }
  emit() {
    const selected = this.selection ? this.describeSelection() : null;
    this.events.change?.({
      selected,
      mode: this.mode,
      lighting: { ...this.lighting },
      tool: this.tool,
      snap: this.snap,
      canUndo: this.cursor > 0,
      canRedo: this.cursor < this.history.length - 1,
      roomPlan: this.roomPlan ? { ...this.roomPlan, rooms: this.roomPlan.rooms.map(room=>({...room,name:this.roomNames.get(room.id)||room.name})) } : null,
      lights: this.furniture.children.filter(object=>isLampType(object.userData.type)).map(object=>{
        const room=this.lampRoom(object);
        return {id:object.userData.id,name:object.userData.label,on:!!object.userData.lamp?.on,
          roomId:room.id,roomAssignment:room.assignment,roomName:this.roomNames.get(room.id)||'未分配',
          autoRoomName:this.roomNames.get(room.automatic)||'未分配',position:object.position.toArray()};
      }),
      furnitureCount: this.furniture.children.length,
      furniture: this.furniture.children.map((o) => ({ id: o.userData.id, name: o.userData.label })),
      wallCount: this.wallCount || 0,
      floorCount: this.floorCount || 0,
      transform: this.transform.mode,
    });
  }
  async load() {
    const gltf = await this.loader.loadAsync("/models/apartment-clean.glb", (e) => {
      if (!this.disposed) this.events.progress?.(e.total ? Math.round((e.loaded / e.total) * 85) : 25);
    });
    if (this.disposed) return;
    gltf.scene.updateMatrixWorld(true);
    this.modelSurfaceMigration = readSurfaceMigration(gltf.scene);
    let walls = 0,
      floors = 0;
    gltf.scene.traverse((object) => {
      if (!object.isMesh) return;
      const floor = object.name.startsWith("地板");
      if (floor) floors++;
      else walls++;
      this.splitSurface(object, floor, floor ? floors : walls);
    });
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        disposeMaterial(o.material);
      }
    });
    this.surfaceDefaults = new Map([...this.surfaceMap].map(([id, mesh]) => [id, copy(mesh.userData.spec)]));
    this.wallCount = walls;
    this.floorCount = floors;
    this.house.updateMatrixWorld(true);
    this.octree.fromGraphNode(this.house);
    const floorsBounds = new THREE.Box3();
    this.house.children.filter((o) => o.userData.category === "floor").forEach((o) => floorsBounds.expandByObject(o));
    this.floorY = floorsBounds.max.y;
    this.bounds = new THREE.Box3().setFromObject(this.house);
    this.ceilingY = this.bounds.max.y;
    this.ceiling = createCeiling(this.house, this.ceilingY);
    this.content.add(this.ceiling.visible, this.ceiling.occluder);
    this.roomPlan = createRoomPlan(this.house, this.floorY);
    this.roomNames = new Map(this.roomPlan.rooms.map(room=>[room.id,room.name]));
    this.roomBounce = new RoomBounce(this.roomPlan,this.camera,this.ceilingY);
    this.naturalLight = new NaturalLight(this.content,this.roomPlan,this.floorY);
    this.defaultLightPositions = roomLightPositions(this.house, this.floorY);
    this.seedInteriorLights();
    this.updateLighting();
    this.orbit.target.copy(this.bounds.getCenter(v()));
    this.orbit.target.y = 0.7;
    this.home();
    this.commit();
    this.events.progress?.(100);
    this.emit();
  }
  splitSurface(object, floor, ordinal) {
    const source = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    source.applyMatrix4(object.matrixWorld);
    const positions = source.getAttribute("position");
    const planes = new Map();
    const a = v(),
      b = v(),
      c = v(),
      normal = v();
    for (let i = 0; i < positions.count; i += 3) {
      a.fromBufferAttribute(positions, i);
      b.fromBufferAttribute(positions, i + 1);
      c.fromBufferAttribute(positions, i + 2);
      normal.subVectors(b, a).cross(c.clone().sub(a)).normalize();
      if (normal.lengthSq() < 0.5) continue;
      const distance = normal.dot(a);
      const key = [...normal.toArray().map((x) => Math.round(x * 500)), Math.round(distance * 50)].join("_");
      if (!planes.has(key)) planes.set(key, { positions: [], normal: normal.clone() });
      const plane = planes.get(key);
      plane.positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    }
    for (const [key, plane] of planes) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(plane.positions, 3));
      const uv = [];
      const n = plane.normal;
      const abs = n.clone().set(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z));
      for (let i = 0; i < plane.positions.length; i += 3) {
        const [x, y, z] = plane.positions.slice(i, i + 3);
        if (abs.y > 0.8) uv.push(x, z);
        else if (abs.x > abs.z) uv.push(z, y);
        else uv.push(x, y);
      }
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      const spec = defaultFinish(floor && n.y > 0.5);
      const mesh = new THREE.Mesh(g, createMaterial(spec));
      mesh.name = `${object.name}:${key}`;
      mesh.userData = {
        id: mesh.name,
        category: floor ? "floor" : "wall",
        label: `${floor ? "地板" : "墙体"} ${String(ordinal).padStart(2, "0")} · ${floor ? (n.y > 0.5 ? "表面" : "侧面") : Math.abs(n.y) > 0.8 ? "顶 / 底面" : "墙面"}`,
        spec,
      };
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.house.add(mesh);
      this.surfaceMap.set(mesh.userData.id, mesh);
    }
    source.dispose();
  }
  home(top = false) {
    if (this.mode === "walk") this.setMode("orbit");
    const center = this.bounds?.getCenter(v()) || v();
    center.y = 0.6;
    this.orbit.target.copy(center);
    this.camera.position.copy(center).add(top ? new THREE.Vector3(0.001, 21, 0.001) : new THREE.Vector3(12, 13, 15));
    this.orbit.update();
    this.emit();
  }
  pick(event) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, (-(event.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = this.ray.intersectObjects([this.house, this.furniture], true).find(hit => hit.object.visible);
    if (!hit) {
      this.select(null);
      return;
    }
    if (this.tool === "spawn" && hit.object.userData.category === "floor" && hit.face.normal.y > 0.5) {
      this.enterWalk(hit.point);
      return;
    }
    let object = hit.object;
    while (object.parent && object.parent !== this.furniture && !this.surfaceMap.has(object.userData.id)) object = object.parent;
    this.select(object);
    if (this.tool === "paint" && ["wall", "floor"].includes(object.userData.category)) this.applySurface(this.brush);
  }
  select(object) {
    this.selection = object;
    this.transform.detach();
    if (this.outline) {
      this.scene.remove(this.outline);
      this.outline.geometry.dispose();
      this.outline.material.dispose();
      this.outline = null;
    }
    if (object && !(object.userData.mount === 'ceiling' && this.mode === 'orbit')) {
      this.outline = new THREE.BoxHelper(object, "#2457dc");
      this.outline.material.depthTest = false;
      this.outline.material.transparent = true;
      this.outline.material.opacity = 0.8;
      this.outline.renderOrder = 100;
      this.scene.add(this.outline);
      if (object.userData.category === "furniture") this.transform.attach(object);
    }
    this.emit();
  }
  refreshSelection() {
    this.invalidateInteriorShadows();
    this.outline?.update();
    this.emit();
  }
  describeSelection() {
    const o = this.selection;
    const dims = o.userData.category === 'furniture' && o.userData.baseDimensions
      ? new THREE.Vector3(...o.userData.baseDimensions.map((n,i)=>n*Math.abs(o.scale.getComponent(i))))
      : new THREE.Box3().setFromObject(o).getSize(v());
    return {
      id: o.userData.id,
      type: o.userData.type,
      door: o.userData.door ? { ...o.userData.door } : null,
      lamp: o.userData.lamp ? { ...o.userData.lamp } : null,
      mount: o.userData.mount,
      name: o.userData.label,
      category: o.userData.category,
      spec: copy(o.userData.spec || this.brush),
      position: o.position.toArray(),
      rotation: THREE.MathUtils.radToDeg(o.rotation.y),
      scale: o.scale.toArray(),
      dimensions: dims.toArray(),
    };
  }
  setTool(tool) {
    this.tool = tool;
    this.emit();
  }
  setTransform(mode) {
    this.transform.setMode(mode);
    this.emit();
  }
  setSnap(value) {
    this.snap = value;
    this.transform.setTranslationSnap(value ? 0.1 : null);
    this.transform.setRotationSnap(value ? Math.PI / 12 : null);
    this.transform.setScaleSnap(value ? 0.1 : null);
    this.emit();
  }
  setBrush(spec) {
    this.brush = copy(spec);
  }
  applySurface(spec, all = false) {
    if (!this.selection || !["wall", "floor"].includes(this.selection.userData.category)) return;
    const targets = all ? [...this.surfaceMap.values()].filter((o) => o.userData.category === this.selection.userData.category) : [this.selection];
    for (const mesh of targets) {
      disposeMaterial(mesh.material);
      mesh.userData.spec = copy(spec);
      mesh.material = createMaterial(spec);
    }
    this.commit();
    this.emit();
  }
  setMode(mode) {
    if (mode === this.mode) return;
    if (mode === "walk") {
      this.enterWalk();
      return;
    }
    this.stopLooking();
    this.mode = "orbit";
    if (this.ceiling) this.ceiling.visible.visible = false;
    this.furniture.children.forEach(object => setLampView(object,'orbit'));
    if (this.selection?.userData.mount === 'ceiling') this.select(null);
    this.keys.clear();
    this.velocity.set(0, 0, 0);
    this.orbit.enabled = true;
    this.camera.up.set(0, 1, 0);
    if (this.savedOrbit) {
      this.camera.position.copy(this.savedOrbit.position);
      this.orbit.target.copy(this.savedOrbit.target);
    }
    this.orbit.update();
    if (this.selection?.userData.category === "furniture") this.transform.attach(this.selection);
    this.emit();
  }
  enterWalk(point) {
    const candidates = point
      ? [point]
      : this.house.children
          .filter((o) => o.userData.category === "floor" && o.geometry.attributes.normal.getY(0) > 0.5)
          .map((o) => new THREE.Box3().setFromObject(o).getCenter(v()));
    let spawn = null;
    for (const p of candidates) {
      const capsule = new Capsule(new THREE.Vector3(p.x, p.y + 0.27, p.z), new THREE.Vector3(p.x, p.y + 1.4, p.z), 0.24);
      if (!this.octree.capsuleIntersect(capsule)) {
        spawn = p;
        break;
      }
    }
    if (!spawn) {
      this.toast("此处空间不足，请点击“选择起点”后选择开阔地板");
      return;
    }
    if (this.mode !== "walk") this.savedOrbit = { position: this.camera.position.clone(), target: this.orbit.target.clone() };
    this.mode = "walk";
    this.ceiling.visible.visible = true;
    this.furniture.children.forEach(object => setLampView(object,'walk'));
    if (this.tool === "spawn") this.tool = "select";
    this.keys.clear();
    this.stopLooking();
    this.orbit.enabled = false;
    if (this.selection?.userData.category === "furniture") this.transform.attach(this.selection);
    this.velocity.set(0, 0, 0);
    this.collider = new Capsule(new THREE.Vector3(spawn.x, spawn.y + 0.27, spawn.z), new THREE.Vector3(spawn.x, spawn.y + 1.4, spawn.z), 0.24);
    this.camera.position.copy(this.collider.end).add(new THREE.Vector3(0, 0.25, 0));
    this.camera.rotation.set(0, 0, 0);
    this.renderer.domElement.focus({ preventScroll: true });
    this.emit();
  }
  movePlayer(dt) {
    const dir = v();
    this.camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const side = dir.clone().cross(this.camera.up).normalize();
    const forward = Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) - Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
    const right = Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) - Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
    const speed = this.keys.has("ShiftLeft") ? 3.5 : 2;
    const movement = dir.multiplyScalar(forward).addScaledVector(side, right);
    if (movement.lengthSq() > 0) movement.normalize().multiplyScalar(speed * dt);
    this.velocity.y -= 12 * dt;
    movement.y = this.velocity.y * dt;
    this.collider.translate(movement);
    for (let i = 0; i < 3; i++) {
      const collision = this.octree.capsuleIntersect(this.collider);
      if (!collision) break;
      this.collider.translate(collision.normal.clone().multiplyScalar(collision.depth));
      if (collision.normal.y > 0.3) this.velocity.y = 0;
    }
    this.camera.position.copy(this.collider.end);
    this.camera.position.y += 0.25;
    if (this.camera.position.y < this.floorY - 3) {
      this.setMode("orbit");
      this.toast("已返回俯视，请重新选择漫游起点");
    }
  }
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.mode === "walk" && this.collider && !this.transform.dragging && !this.busy) {
      const steps = 4;
      for (let i = 0; i < steps && this.mode === "walk"; i++) this.movePlayer(dt / steps);
    } else if (this.mode === "orbit") this.orbit.update();
    for (const object of this.furniture.children) {
      if (object.userData.type !== 'door') continue;
      const hinge=object.getObjectByName('door-hinge');
      const target=hinge.userData.targetAngle || 0;
      if (Math.abs(hinge.rotation.y-target)>.001) this.invalidateInteriorShadows();
      hinge.rotation.y=this.reducedMotion || Math.abs(hinge.rotation.y-target)<.001 ? target : THREE.MathUtils.damp(hinge.rotation.y,target,12,dt);
    }
    this.outline?.update();
    this.effects.render();
    this.updateDoorHover();
  }
  placementPoint() {
    if (this.mode === "walk") {
      const direction = v();
      this.camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      return this.camera.position.clone().addScaledVector(direction, 1.8).setY(this.floorY);
    }
    const point = this.orbit.target.clone();
    this.ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const floorHits = this.ray.intersectObjects(this.house.children).filter((h) => h.object.userData.category === "floor" && h.face.normal.y > 0.5);
    return floorHits[0]?.point.clone() || point.setY(this.floorY);
  }
  async addFurniture(type, source = null) {
    const asset = source ? this.assets.get(source) : null;
    const object = asset ? cloneModel(asset.model) : createFurniture(type);
    const baseDimensions = object.userData.baseDimensions || new THREE.Box3().setFromObject(object).getSize(v()).toArray();
    object.userData = { ...object.userData, baseDimensions, id: uid(), label: asset ? asset.name : CATALOG.find((x) => x.id === type)?.name || "家具", category: "furniture", type, source };
    object.position.copy(this.placementPoint());
    setLampView(object,this.mode);
    this.furniture.add(object);
    this.furnitureMap.set(object.userData.id, object);
    this.select(object);
    this.groundSelected();
    this.commit();
    this.emit();
    this.toast(`已添加${object.userData.label}，可在右侧调整位置`);
  }
  async importFurniture(file) {
    if (!/\.glb$/i.test(file.name)) throw new Error("请导入 .glb 家具，.gltf 请先在 Blender 中打包为 GLB");
    if (file.size > 150 * 1024 * 1024) throw new Error("家具文件超过 150 MB，请先压缩贴图或简化模型");
    const buffer = await file.arrayBuffer();
    const gltf = await this.loader.parseAsync(buffer, "");
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    if (bounds.isEmpty()) throw new Error("文件没有可显示的模型");
    const group = new THREE.Group();
    group.add(model);
    const center = bounds.getCenter(v());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= bounds.min.y;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.receiveShadow = true;
      }
    });
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("读取家具文件失败"));
      reader.readAsDataURL(file);
    });
    const id = uid();
    this.assets.set(id, { model: group, data, name: file.name.replace(/\.glb$/i, "") });
    await this.addFurniture("import", id);
    if (bounds.getSize(v()).length() > 20) this.toast("家具尺寸较大，请确认导出单位，并用右侧缩放调整");
  }
  groundSelected() {
    this.mountFurniture(this.selection);
    this.refreshSelection();
  }
  mountFurniture(o) {
    if (o?.userData.category !== "furniture") return;
    o.updateMatrixWorld(true);
    let bounds = new THREE.Box3().setFromObject(o);
    if (o.userData.mount === 'ceiling') {
      o.position.y += this.ceilingY - .012 - bounds.max.y;
      return;
    }
    const center = bounds.getCenter(v());
    this.ray.set(new THREE.Vector3(center.x, this.bounds.max.y + 10, center.z), new THREE.Vector3(0, -1, 0));
    const hits = this.ray.intersectObjects(this.house.children).filter((h) => h.object.userData.category === "floor" && h.face.normal.y > 0.5);
    const y = hits[0]?.point.y ?? this.floorY;
    o.position.y += y - bounds.min.y;
  }
  setDimensions(dimensions) {
    const object=this.selection;
    if (object?.userData.category!=='furniture' || !Array.isArray(dimensions) || dimensions.length!==3 || !dimensions.every(n=>Number.isFinite(n)&&n>=.01&&n<=100)) return;
    const base=object.userData.baseDimensions;
    if (!base || base.some(n=>n<=0)) return;
    const anchorBounds = new THREE.Box3().setFromObject(object);
    const bottom = anchorBounds.min.y;
    const top = anchorBounds.max.y;
    object.scale.fromArray(dimensions.map((n,i)=>n/base[i]));
    object.updateMatrixWorld(true);
    const resized = new THREE.Box3().setFromObject(object);
    object.position.y += object.userData.mount === 'ceiling' ? top-resized.max.y : bottom-resized.min.y;
    this.refreshSelection();this.commit();
  }
  rotateSelected(degrees) {
    if (this.selection?.userData.category !== 'furniture' || !Number.isFinite(degrees)) return;
    const rotation = THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(this.selection.rotation.y) + degrees, 360);
    this.updateTransform({ rotation });
  }
  updateTransform(values) {
    const o = this.selection;
    if (o?.userData.category !== "furniture") return;
    if (values.position) o.position.fromArray(values.position);
    if (values.rotation !== undefined) o.rotation.y = THREE.MathUtils.degToRad(values.rotation);
    if (values.scale) o.scale.fromArray(values.scale.map((x) => Math.max(0.01, x)));
    this.refreshSelection();
    this.commit();
  }
  duplicateSelected() {
    const o = this.selection;
    if (o?.userData.category !== "furniture") return;
    const duplicate = isLampType(o.userData.type) ? createFurniture(o.userData.type) : cloneModel(o);
    duplicate.position.copy(o.position);
    duplicate.rotation.copy(o.rotation);
    duplicate.scale.copy(o.scale);
    duplicate.userData = { ...o.userData, id: uid() };
    if (isLampType(o.userData.type)) setLampState(duplicate,o.userData.lamp);
    duplicate.position.x += 0.35;
    duplicate.position.z += 0.35;
    setLampView(duplicate,this.mode);
    this.furniture.add(duplicate);
    this.furnitureMap.set(duplicate.userData.id, duplicate);
    this.select(duplicate);
    this.commit();
  }
  deleteSelected() {
    if (this.selection?.userData.category !== "furniture") return;
    this.furniture.remove(this.selection);
    this.select(null);
    this.commit();
  }
  selectFurniture(id) {
    const o = this.furnitureMap.get(id);
    if (o?.parent === this.furniture) this.select(o);
  }
  focusSelected() {
    if (!this.selection) return;
    const bounds = new THREE.Box3().setFromObject(this.selection);
    const center = bounds.getCenter(v());
    if (this.mode === "walk") { this.camera.lookAt(center); return; }
    const size = Math.max(1, bounds.getSize(v()).length());
    this.orbit.target.copy(center);
    this.camera.position.copy(center).add(new THREE.Vector3(size * 0.7, size * 0.65, size * 0.8));
    this.orbit.update();
  }
  snapshot() {
    return {
      version: 1,
      model: "apartment-v1",
      interiorVersion: 1,
      rooms: this.roomPlan?.rooms.map(room=>({id:room.id,name:this.roomNames.get(room.id)||room.name})),
      lighting: { ...this.lighting },
      surfaces: [...this.surfaceMap].map(([id, o]) => ({ id, spec: copy(o.userData.spec) })),
      furniture: this.furniture.children.map((o) => ({
        id: o.userData.id,
        label: o.userData.label,
        type: o.userData.type,
        source: o.userData.source,
        door: o.userData.door ? { ...o.userData.door } : undefined,
        lamp: o.userData.lamp ? { ...o.userData.lamp } : undefined,
        roomId: isLampType(o.userData.type) ? o.userData.roomId : undefined,
        position: o.position.toArray(),
        rotation: o.rotation.toArray(),
        scale: o.scale.toArray(),
      })),
    };
  }
  commit() {
    this.invalidateInteriorShadows();
    const state = this.snapshot();
    const json = JSON.stringify(state);
    if (this.cursor >= 0 && JSON.stringify(this.history[this.cursor]) === json) return;
    this.history = this.history.slice(0, this.cursor + 1);
    this.history.push(state);
    if (this.history.length > MAX_HISTORY) this.history.shift();
    this.cursor = this.history.length - 1;
    this.emit();
    this.events.projectChange?.();
  }
  restore(state) {
    this.restoring = true;
    try {
    this.clearDoorHover();
    this.roomNames = new Map((this.roomPlan?.rooms || []).map(room=>[room.id,state.rooms?.find(saved=>saved.id===room.id)?.name || room.name]));
    this.updateLighting({ ...DEFAULT_LIGHTING, ...state.lighting });
    this.select(null);
    for (const { id, spec } of state.surfaces) {
      const o = this.surfaceMap.get(id);
      if (o && JSON.stringify(o.userData.spec) !== JSON.stringify(spec)) {
        disposeMaterial(o.material);
        o.material = createMaterial(spec);
        o.userData.spec = copy(spec);
      }
    }
    this.furniture.clear();
    for (const item of state.furniture) {
      let object = this.furnitureMap.get(item.id);
      if (!object) {
        const asset = item.source ? this.assets.get(item.source) : null;
        if (item.source && !asset) throw new Error("方案缺少家具资源");
        object = asset ? cloneModel(asset.model) : createFurniture(item.type);
        const baseDimensions=object.userData.baseDimensions || new THREE.Box3().setFromObject(object).getSize(v()).toArray();
        object.userData = { ...object.userData, baseDimensions, id: item.id, label: item.label, category: "furniture", type: item.type, source: item.source };
        this.furnitureMap.set(item.id, object);
      }
      if (item.type === 'door') setDoorPose(object,item.door || {open:false,hinge:'left'},true);
      if (isLampType(item.type)) {
        setLampState(object,item.lamp || {on:true});
        object.userData.roomId = item.roomId || undefined;
      }
      object.position.fromArray(item.position);
      object.rotation.fromArray(item.rotation);
      object.scale.fromArray(item.scale);
      setLampView(object,this.mode);
      this.furniture.add(object);
    }
    if (state.interiorVersion === undefined) this.seedInteriorLights();
    this.invalidateInteriorShadows();
    this.emit();
    } finally { this.restoring = false; }
    this.events.projectChange?.();
  }
  undo(delta) {
    const next = this.cursor + delta;
    if (next < 0 || next >= this.history.length) return;
    this.cursor = next;
    this.restore(this.history[next]);
  }
  project() {
    const state = this.snapshot();
    const used = new Set(state.furniture.map((f) => f.source).filter(Boolean));
    return { ...state, assets: [...this.assets].filter(([id]) => used.has(id)).map(([id, a]) => ({ id, name: a.name, data: a.data })) };
  }
  async openProject(project) {
    project = migrateSurfaceProject(project, this.surfaceDefaults, this.modelSurfaceMigration);
    this.validateProject(project);
    // Decode resources before mutating the active project.
    const decoded = [];
    for (const asset of project.assets || []) {
      if (this.assets.has(asset.id)) continue;
      const data = Uint8Array.from(atob(asset.data.split(",")[1]), (c) => c.charCodeAt(0)).buffer;
      const gltf = await this.loader.parseAsync(data, "");
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model),
        center = bounds.getCenter(v());
      const group = new THREE.Group();
      group.add(model);
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= bounds.min.y;
      model.traverse((o) => {
        if (o.isMesh) o.castShadow = o.receiveShadow = true;
      });
      decoded.push([asset.id, { ...asset, model: group }]);
    }
    decoded.forEach(([id, a]) => this.assets.set(id, a));
    this.restore(project);
    this.commit();
  }
  validateProject(p) {
    const fail = () => {
      throw new Error("方案文件格式不正确或不属于当前房屋");
    };
    const vec = (a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
    if (p?.version !== 1 || p.model !== "apartment-v1" || !Array.isArray(p.surfaces) || !Array.isArray(p.furniture) || !Array.isArray(p.assets)) fail();
    if (p.rooms !== undefined) {
      const known = new Set((this.roomPlan?.rooms || []).map(room=>room.id));
      if (!Array.isArray(p.rooms) || p.rooms.length !== known.size || new Set(p.rooms.map(room=>room?.id)).size !== known.size) fail();
      for (const room of p.rooms) if (!known.has(room?.id) || typeof room.name !== 'string' || !room.name.trim() || room.name.length>32) fail();
    }
    if (p.interiorVersion !== undefined && p.interiorVersion !== 1) fail();
    if (p.lighting !== undefined && !validLighting(p.lighting)) fail();
    if (p.surfaces.length !== this.surfaceMap.size || new Set(p.surfaces.map((s) => s.id)).size !== this.surfaceMap.size) fail();
    for (const s of p.surfaces) {
      const m = s.spec;
      if (
        !this.surfaceMap.has(s.id) ||
        !m ||
        !(m.finish === 'custom' || FINISHES.some(finish => finish.id === m.finish)) ||
        !/^#[0-9a-f]{6}$/i.test(m.color) ||
        !Number.isFinite(m.size) ||
        m.size < 0.1 ||
        m.size > 10 ||
        !Number.isFinite(m.rotation) ||
        !Number.isFinite(m.roughness) ||
        m.roughness < 0 ||
        m.roughness > 1
      )
        fail();
      if (m.finish === "custom" && !/^data:image\/(png|jpeg|webp);base64,/.test(m.image || "")) fail();
    }
    const ids = new Set();
    for (const a of p.assets) {
      if (typeof a.id !== "string" || ids.has(a.id) || typeof a.name !== "string" || !/^data:.*?;base64,[A-Za-z0-9+/=]+$/.test(a.data || "")) fail();
      ids.add(a.id);
    }
    const objectIds = new Set();
    for (const f of p.furniture) {
      if (
        typeof f.id !== "string" ||
        objectIds.has(f.id) ||
        typeof f.label !== "string" ||
        !vec(f.position) ||
        !vec(f.scale) ||
        f.scale.some((x) => x <= 0) ||
        !Array.isArray(f.rotation) ||
        f.rotation.length !== 4 ||
        !f.rotation.slice(0, 3).every(Number.isFinite) ||
        !["XYZ", "YXZ", "ZXY", "ZYX", "YZX", "XZY"].includes(f.rotation[3])
      )
        fail();
      if (f.source ? !ids.has(f.source) : !CATALOG.some((c) => c.id === f.type)) fail();
      if (f.door !== undefined && (f.type!=='door' || !f.door || typeof f.door.open!=='boolean' || !['left','right'].includes(f.door.hinge))) fail();
      if (f.lamp !== undefined && (!isLampType(f.type) || !f.lamp || typeof f.lamp.on !== 'boolean')) fail();
      if (f.roomId !== undefined && (!isLampType(f.type) || typeof f.roomId !== 'string' || (f.roomId && f.roomId !== 'unassigned' && !this.roomPlan?.rooms.some(room=>room.id===f.roomId)))) fail();
      objectIds.add(f.id);
    }
  }
  async exportGLB() {
    this.content.updateMatrixWorld(true);
    const exported = cloneModel(this.content);
    const shadowOnly = exported.getObjectByName('ceiling-shadow-only');
    shadowOnly?.removeFromParent();
    const ceiling = exported.getObjectByName('interior-ceiling');
    if (ceiling) ceiling.visible = true;
    exported.traverse((object) => {
      if (object.userData.type === 'door') setDoorPose(object,object.userData.door,true);
      if (isLampType(object.userData.type)) {
        setLampState(object,object.userData.lamp);
        setLampView(object,'walk');
      }
      object.userData = {};
    });
    const result = await new GLTFExporter().parseAsync(exported, { binary: true, onlyVisible: true, maxTextureSize: 2048 });
    download(new Blob([result], { type: "model/gltf-binary" }), "roomlab-renovation.glb");
  }
  screenshot() {
    this.effects.render();
    this.renderer.domElement.toBlob((blob) => blob && download(blob, "roomlab-view.png"));
  }
  dispose() {
    this.disposed = true;
    this.clearDoorHover();
    this.renderer.setAnimationLoop(null);
    this.resize.disconnect();
    this.listeners.forEach((f) => f());
    this.orbit.dispose();
    this.stopLooking();
    this.transform.dispose();
    this.draco.dispose();
    this.effects.dispose();
    this.naturalLight?.dispose();
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set(),
      shadows = new Set();
    const collect = (o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.isLight && o.shadow) shadows.add(o.shadow);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (m) {
          materials.add(m);
          for (const x of Object.values(m)) if (x?.isTexture) textures.add(x);
        }
    };
    this.scene.traverse(collect);
    this.furnitureMap.forEach((o) => o.traverse(collect));
    this.assets.forEach((a) => a.model.traverse(collect));
    shadows.forEach((shadow) => shadow.dispose());
    textures.forEach((t) => t.dispose());
    materials.forEach((m) => m.dispose());
    geometries.forEach((g) => g.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
