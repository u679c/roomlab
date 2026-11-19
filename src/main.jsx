import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownToLine, Armchair, Bath, BedDouble, BookOpen, Box, Camera, Check, CheckCheck, ChevronDown, ChevronRight, CookingPot, Copy, Crosshair, DoorOpen, Download, Expand, Focus, FolderOpen, Footprints, Grid2X2, ImagePlus, LampFloor, Layers3, Leaf, LoaderCircle, Maximize2, Monitor, MousePointer2, Move3D, PaintRoller, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, RectangleHorizontal, Redo2, Refrigerator, Rotate3D, Save, Search, Settings2, Sofa, Sun, Sunset, Table2, Trash2, Undo2, Upload, X } from 'lucide-react';
import { Studio, download } from './studio.js';
import { FINISHES, FINISH_CATEGORIES, COLORS, defaultFinish, materialPreview } from './materials.js';
import { FURNITURE_CATEGORIES, searchFurniture } from './furniture.js';
import { readLocal, createAutosaver } from './storage.js';
import { DEFAULT_LIGHTING, SEASONS, WEATHER, sunState, timeLabel, timePresets } from './lighting.js';
import { LightPanel, InspectorTabs } from './LightPanel.jsx';
import './style.css';

const initialView = { lights: [], roomPlan: null, lighting: DEFAULT_LIGHTING, selected: null, mode: 'orbit', tool: 'select', snap: true, canUndo: false, canRedo: false, furniture: [], furnitureCount: 0, wallCount: 0, floorCount: 0, transform: 'translate' };
const iconMap = { sofa: Sofa, chair: Armchair, table: Table2, bed: BedDouble, cabinet: Box, plant: Leaf, tv: Monitor, shelf: BookOpen, fridge: Refrigerator, kitchen: CookingPot, bath: Bath, door: DoorOpen, rug: RectangleHorizontal, lamp: LampFloor };
function IconButton({ icon: Icon, label, active = false, ...props }) { return <button type="button" className={`icon-button ${active ? 'active' : ''}`} title={label} aria-label={label} {...props}><Icon size={18} /></button>; }
function NumberField({ label, value, onCommit, step = .1, min }) {
  const [draft, setDraft] = useState(String(value)); useEffect(() => setDraft(String(Math.round(value * 100) / 100)), [value]);
  const commit = () => { const n = Number(draft); if (draft.trim() !== '' && Number.isFinite(n) && (min === undefined || n >= min)) onCommit(n); else setDraft(String(value)); };
  return <label className="number-field"><span>{label}</span><input aria-label={label} type="number" step={step} min={min} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>;
}
function LightingControls({ settings, onChange, onCommit }) {
  const state = sunState(settings);
  return <div className="lighting-controls">
    <div className="section-heading"><h2>季节</h2></div>
    <div className="lighting-options seasons">{SEASONS.map(s => <button key={s.id} aria-pressed={settings.season === s.id} className={settings.season === s.id ? 'selected' : ''} onClick={() => onChange({ season: s.id }, true)}>{s.name}</button>)}</div>
    <div className="section-heading lighting-section"><h2>天气</h2></div>
    <div className="lighting-options">{WEATHER.map(w => <button key={w.id} aria-pressed={settings.weather === w.id} className={settings.weather === w.id ? 'selected' : ''} onClick={() => onChange({ weather: w.id }, true)}>{w.name}</button>)}</div>
    <div className="lighting-section"><label className="range-label"><span>日照方向</span><strong>{settings.direction}°</strong><input aria-label="日照方向" type="range" min="0" max="360" step="5" value={settings.direction} onChange={e => onChange({ direction: Number(e.target.value) })} onPointerUp={onCommit} onKeyUp={onCommit} onBlur={onCommit} /></label><div className="range-endpoints"><span>向左旋转</span><span>向右旋转</span></div></div>
    <div className="lighting-section"><label className="range-label"><span>阳光强度</span><strong>{Math.round(settings.intensity * 100)}%</strong><input aria-label="阳光强度" type="range" min="0" max="2" step="0.05" value={settings.intensity} onChange={e => onChange({ intensity: Number(e.target.value) })} onPointerUp={onCommit} onKeyUp={onCommit} onBlur={onCommit} /></label><div className="range-endpoints"><span>无直射光</span><span>200%</span></div></div>
    <div className="sun-hours"><span>日出 <strong>{timeLabel(state.sunrise)}</strong></span><span>日落 <strong>{timeLabel(state.sunset)}</strong></span></div>
    <button className="button secondary full-width" onClick={() => onChange(DEFAULT_LIGHTING, true)}>恢复默认日照</button>
    <p className="inspector-note">季节日照为近似预览，未按房屋地址计算。</p>
  </div>;
}
const LIST_RATIO_KEY = 'roomlab-furniture-list-ratio';
const clampListRatio = value => Math.max(.15, Math.min(.7, value));
function App() {
  const listResize = useRef(null);
  const [listRatio, setListRatio] = useState(() => {
    try {
      const saved = localStorage.getItem(LIST_RATIO_KEY);
      const ratio = saved === null ? .3 : Number(saved);
      return Number.isFinite(ratio) && ratio >= .15 && ratio <= .7 ? ratio : .3;
    } catch { return .3; }
  });
  useEffect(() => { try { localStorage.setItem(LIST_RATIO_KEY, String(listRatio)); } catch {} }, [listRatio]);
  const beginListResize = event => {
    if (event.button !== 0) return;
    const height = event.currentTarget.closest('.inspector-panel').getBoundingClientRect().height;
    if (!height) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    listResize.current = { pointerId: event.pointerId, y: event.clientY, ratio: listRatio, height };
  };
  const moveListResize = event => {
    const start = listResize.current;
    if (start?.pointerId !== event.pointerId) return;
    setListRatio(clampListRatio(start.ratio + (event.clientY-start.y)/start.height));
  };
  const endListResize = event => {
    listResize.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const autosaveReady = useRef(false), queueAutosave = useRef(() => {}), autosaver = useRef(null);
  const host = useRef(null), engine = useRef(null), importInput = useRef(null), textureInput = useRef(null), projectInput = useRef(null), toastTimer = useRef(null);
  const [inspectorTab,setInspectorTab] = useState('objects');
  const [view, setView] = useState(initialView), [loading, setLoading] = useState(true), [progress, setProgress] = useState(0), [error, setError] = useState('');
  const [tab, setTab] = useState('material'), [brush, setBrush] = useState(defaultFinish()), [toast, setToast] = useState(''), [busy, setBusy] = useState(''), [menu, setMenu] = useState(false), [saveStatus, setSaveStatus] = useState('loading'), [recoveryProject, setRecoveryProject] = useState(null), [filter, setFilter] = useState('全部'), [help, setHelp] = useState(false), [libraryOpen, setLibraryOpen] = useState(true), [inspectorOpen, setInspectorOpen] = useState(true), [furnitureSearch, setFurnitureSearch] = useState(''), [doorHover, setDoorHover] = useState(null), [materialFilter, setMaterialFilter] = useState('全部');
  const notify = message => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 4200); };
  useEffect(() => {
    let studio, active=true;
    const saver=createAutosaver({onStatus:setSaveStatus,onError:()=>notify('自动保存失败，请检查浏览器存储或通过导出备份方案')});
    autosaver.current=saver;
    const enqueue=()=>{
      if(active && autosaveReady.current && studio && !studio.disposed && !studio.restoring)saver.enqueue(studio.project());
    };
    queueAutosave.current=enqueue;
    const onLeaving=()=>enqueue();
    const onHidden=()=>{if(document.visibilityState==='hidden')enqueue();};
    window.addEventListener('pagehide',onLeaving);
    document.addEventListener('visibilitychange',onHidden);
    const localData=readLocal().then(data=>({data})).catch(error=>({error}));
    try {
      studio=new Studio(host.current,{change:setView,progress:setProgress,toast:notify,doorHover:setDoorHover,projectChange:enqueue});
      engine.current=studio;
      (async()=>{
        await studio.load();
        const result=await localData;
        if(!active)return;
        if(result.error){
          setSaveStatus('error');
          notify('无法读取本地数据，暂未开启自动保存；可通过导出备份方案');
        } else {
          try {
            if(result.data?.project)await studio.openProject(result.data.project);
            if(!active)return;
            autosaveReady.current=true;
            setSaveStatus(result.data?.project?'saved':'ready');
          } catch(error){
            console.error(error);setRecoveryProject(result.data?.project || null);setSaveStatus('restore-error');
            notify('本地方案无法恢复，原数据已保留；请打开备份方案');
          }
        }
        if(active)setLoading(false);
      })().catch(error=>{if(active){console.error(error);setError('模型加载失败，请刷新重试');}});
    } catch(error){console.error(error);setError('无法初始化 3D 视图，请使用支持 WebGL 的桌面浏览器');}
    return ()=>{
      enqueue();active=false;autosaveReady.current=false;saver.close();
      queueAutosave.current=()=>{};
      window.removeEventListener('pagehide',onLeaving);document.removeEventListener('visibilitychange',onHidden);
      clearTimeout(toastTimer.current);studio?.dispose();
    };
  }, []);
  const selection = view.selected;
  const selectedSignature = selection && JSON.stringify(selection.spec);
  useEffect(() => { if (selection && selection.category !== 'furniture') { setBrush(selection.spec); setTab(current => current === 'lighting' ? current : 'material'); } }, [selection?.id, selectedSignature]);
  useEffect(() => { engine.current?.setBrush(brush); }, [brush]);
  const run = async (label, action) => {
    if (busy || loading) return; setBusy(label); if (engine.current) engine.current.busy = true;
    try { await action(); } catch (e) { console.error(e); notify(e.message || '操作失败，请重试'); }
    finally { if (engine.current) engine.current.busy = false; setBusy(''); }
  };
  const editBrush = (patch, apply = false) => { const next = { ...brush, ...patch }; setBrush(next); engine.current?.setBrush(next); if (apply) engine.current?.applySurface(next); };
  const exportProject = () => run('导出方案', async () => {
    const project=engine.current.project();
    download(new Blob([JSON.stringify(project)],{type:'application/json'}),'roomlab-project.json');
    notify('方案已导出');
  });
  const importProject = e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; run('打开方案', async () => { if (file.size > 250 * 1024 * 1024) throw new Error('方案超过 250 MB，请减少家具贴图后再试'); const project = JSON.parse(await file.text()); await engine.current.openProject(project); autosaveReady.current=true;setRecoveryProject(null);queueAutosave.current();notify('已打开方案'); }); };
  const importModel = e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) run('导入家具', async () => { await engine.current.importFurniture(file); }); };
  const importTexture = e => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; run('导入纹理', async () => {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('请选择 PNG、JPG 或 WebP 图片');
      if (file.size > 8 * 1024 * 1024) throw new Error('纹理图片请控制在 8 MB 以内');
      const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
      editBrush({ finish: 'custom', image: data, color: '#ffffff' }, true); notify('已导入纹理');
    });
  };
  const surfaceSelected = selection && selection.category !== 'furniture';
  const furnitureSelected = selection?.category === 'furniture';
  const lighting = view.lighting || DEFAULT_LIGHTING;
  const sunlight = sunState(lighting);
  const setLighting = (patch, commit = false) => engine.current?.updateLighting(patch, commit);
  const commitLighting = () => engine.current?.commit();
  const materialsVisible = FINISHES.filter(f => materialFilter === '全部' || f.category === materialFilter);
  const furnitureVisible = searchFurniture(furnitureSearch, filter);
  return <div className={`app-shell ${libraryOpen ? '' : 'library-collapsed'} ${selection ? 'has-selection' : 'no-selection'} ${inspectorOpen ? '' : 'inspector-collapsed'}`} aria-busy={!!busy}>
    <header className="topbar">
      {/* <div className="brand"><Layers3 size={20} /><span>ROOMLAB</span></div> */}
      {/* <div className="project-title">孔雀城<span>装修方案</span></div> */}
      <div className="document-actions"><button className="button plain" disabled={loading || !!busy} onClick={() => projectInput.current.click()}><FolderOpen size={15} />打开</button><span className="divider" /><IconButton label="撤销 Ctrl / ⌘ Z" icon={Undo2} disabled={!view.canUndo || !!busy} onClick={() => engine.current.undo(-1)} /><IconButton label="重做 Shift Ctrl / ⌘ Z" icon={Redo2} disabled={!view.canRedo || !!busy} onClick={() => engine.current.undo(1)} /></div>
      <div className="top-actions"><button className={`button plain ${tab === 'lighting' && libraryOpen ? 'active' : ''}`} disabled={loading || !!busy} onClick={() => { setLibraryOpen(true); setTab('lighting'); }}><Sun size={15} />日照</button><button className={`button plain ${libraryOpen ? 'active' : ''}`} aria-expanded={libraryOpen} onClick={() => setLibraryOpen(!libraryOpen)}>{libraryOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}素材</button><button className={`button plain ${inspectorOpen ? 'active' : ''}`} aria-expanded={inspectorOpen} onClick={() => setInspectorOpen(!inspectorOpen)}>{inspectorOpen ? <PanelRightClose size={15}/> : <PanelRightOpen size={15}/>}对象</button><span className="divider" />
        <span className={`autosave-status ${saveStatus}`} role="status">{{loading:'恢复中…',ready:'自动保存已开启',saving:'保存中…',saved:'已自动保存',error:'保存不可用','restore-error':'恢复失败'}[saveStatus]}</span>
        {recoveryProject && <button className="button plain" onClick={()=>download(new Blob([JSON.stringify(recoveryProject)],{type:'application/json'}),'roomlab-recovery.json')}>下载本地备份</button>}
        {saveStatus==='error' && !loading && <button className="button plain" disabled={!!busy} onClick={async()=>{try{if(!autosaveReady.current){const data=await readLocal();if(data?.project)await engine.current.openProject(data.project);autosaveReady.current=true;}queueAutosave.current();await autosaver.current.flush();}catch{notify('本地存储仍不可用，请通过导出备份方案');}}}>重试保存</button>}
        <div className="export-wrap"><button className="button primary" disabled={loading || !!busy} aria-expanded={menu} onClick={() => setMenu(!menu)}><Download size={16} />导出<ChevronDown size={13} /></button>
          {menu && <><button className="menu-backdrop" aria-label="关闭导出菜单" onClick={() => setMenu(false)} /><div className="export-menu"><button onClick={() => { setMenu(false); run('导出 GLB', () => engine.current.exportGLB()); }}><Box size={17} /><span>装修模型<small>GLB · 包含材质与家具</small></span></button><button onClick={() => { setMenu(false); exportProject(); }}><Save size={17} /><span>可编辑方案<small>JSON · 包含导入资源</small></span></button><button onClick={() => { setMenu(false); engine.current.screenshot(); }}><Camera size={17} /><span>当前视角图片<small>PNG</small></span></button></div></>}
        </div>
      </div>
    </header>
    <main className="workspace">
      <aside className="library-panel" aria-label="素材与日照" hidden={!libraryOpen}>
        <div className="panel-heading"><h1>{tab === 'lighting' ? '日照' : '素材'}</h1><IconButton icon={PanelLeftClose} label="收起素材" onClick={() => setLibraryOpen(false)} /></div>
        <div className="tabs" aria-label="素材分类"><button aria-pressed={tab === 'material'} className={tab === 'material' ? 'selected' : ''} onClick={() => setTab('material')}><PaintRoller size={16} />材质</button><button aria-pressed={tab === 'furniture'} className={tab === 'furniture' ? 'selected' : ''} onClick={() => setTab('furniture')}><Armchair size={16} />家具</button><button aria-pressed={tab === 'lighting'} className={tab === 'lighting' ? 'selected' : ''} onClick={() => setTab('lighting')}><Sun size={16} />日照</button></div>
        {tab === 'material' && <div className="material-library-controls"><div className="category-tabs" aria-label="材质分类">{FINISH_CATEGORIES.map(category=><button key={category} className={materialFilter === category ? 'selected' : ''} aria-pressed={materialFilter === category} onClick={()=>setMaterialFilter(category)}>{category}</button>)}</div></div>}
        {tab === 'furniture' && <div className="furniture-library-controls">
            <button className="import-card" disabled={loading || !!busy} onClick={() => importInput.current.click()}><span><Upload size={20} /></span><div><strong>导入家具</strong><small>GLB 格式</small></div><Plus size={16} /></button>
            <div className="furniture-search"><Search size={15}/><input type="search" aria-label="搜索家具" placeholder="搜索家具" value={furnitureSearch} onChange={e => setFurnitureSearch(e.target.value)}/>{furnitureSearch && <button aria-label="清空家具搜索" onClick={() => setFurnitureSearch('')}><X size={13}/></button>}</div>
            <div className="category-tabs">{FURNITURE_CATEGORIES.map(f => <button className={filter === f ? 'selected' : ''} key={f} onClick={() => setFilter(f)}>{f}</button>)}</div>
            <div className="search-result-count" role="status">{furnitureVisible.length} 件家具</div>
        </div>}
        <div className={`library-scroll ${tab === 'furniture' ? 'furniture-results' : ''}`}>
          {tab === 'lighting' ? <fieldset className="lighting-fieldset" disabled={loading || !!busy}><LightingControls settings={lighting} onChange={setLighting} onCommit={commitLighting} /></fieldset> : tab === 'material' ? <>
            <div className="section-heading"><h2>表面材质</h2><span>{materialsVisible.length} 种</span></div>
            <div className="finish-grid">{materialsVisible.map(f => <button key={f.id} title={f.name} aria-pressed={brush.finish === f.id} className={`finish-card ${brush.finish === f.id ? 'selected' : ''}`} onClick={() => editBrush({ finish: f.id, color: f.color, roughness: f.roughness, image: null }, true)}><div className={`finish-preview ${f.id}`} style={materialPreview({finish:f.id,color:f.color})}>{brush.finish === f.id && <span className="finish-check"><Check size={12} /></span>}</div><span>{f.name}</span></button>)}<button className={`finish-card custom-card ${brush.finish === 'custom' ? 'selected' : ''}`} onClick={() => textureInput.current.click()}><div className="finish-preview custom" style={brush.image ? { backgroundImage: `url(${brush.image})`, backgroundSize: 'cover' } : {}}><ImagePlus size={22} /></div><span>导入纹理</span></button></div>


          </> : <>
            <div className="furniture-grid">{furnitureVisible.map(item => { const Icon = iconMap[item.icon]; return <button className="furniture-card" key={item.id} disabled={loading || !!busy} onClick={() => engine.current.addFurniture(item.id)}><div className={`furniture-preview ${item.id}`}><Icon size={48} strokeWidth={1.1} /><span className="add-furniture"><Plus size={14} /></span></div><strong>{item.name}</strong><small>{item.size}</small></button>; })}</div>
            {/* {!furnitureVisible.length && <div className="empty-search"><p>没有匹配的家具</p><button className="button secondary" onClick={() => {setFurnitureSearch('');setFilter('全部');}}>清除筛选</button></div>} */}
          </>}

        </div>
        {tab === 'material' && <section className="color-panel" aria-label="材质颜色">
            <div className="section-heading color-heading"><h2>颜色</h2><span>{brush.color.toUpperCase()}</span></div>
            <div className="swatch-grid">{COLORS.map(color => <button key={color} title={color} aria-label={`颜色 ${color}`} style={{ background: color }} className={brush.color === color ? 'selected' : ''} onClick={() => editBrush({ color }, true)}>{brush.color === color && <Check size={15} color={['#555d57', '#7b909e', '#ac8171'].includes(color) ? 'white' : '#253451'} />}</button>)}</div>
            <label className="custom-color"><span><span className="color-dot" style={{ background: brush.color }} />自定义颜色</span><input aria-label="自定义材质颜色" type="color" value={brush.color} onChange={e => editBrush({ color: e.target.value }, true)} /><Plus size={14} /></label>
        </section>}
      </aside>
      <section className={`viewport-panel tool-${view.tool} ${view.mode === 'walk' ? 'walking' : ''}`} aria-label="三维装修视图">
        <div className="viewport" ref={host} />
        <div className="viewport-toolbar" role="toolbar" aria-label="编辑工具">
          <div className="tool-group"><button className={`tool-button ${view.tool === 'select' ? 'active' : ''}`} aria-pressed={view.tool === 'select'} disabled={loading} onClick={() => engine.current.setTool('select')}><MousePointer2 size={16} />选择</button><button className={`tool-button ${view.tool === 'paint' ? 'active' : ''}`} aria-pressed={view.tool === 'paint'} disabled={loading} onClick={() => engine.current.setTool('paint')}><PaintRoller size={16} />涂刷</button></div>
          {furnitureSelected && <div className="tool-group furniture-tools"><span className="divider" /><IconButton label="移动家具 G" icon={Move3D} active={view.transform === 'translate'} onClick={() => engine.current.setTransform('translate')} /><IconButton label="旋转家具 R" icon={Rotate3D} active={view.transform === 'rotate'} onClick={() => engine.current.setTransform('rotate')} /><IconButton label="缩放家具" icon={Expand} active={view.transform === 'scale'} onClick={() => engine.current.setTransform('scale')} /></div>}
          <div className="view-switch" aria-label="视角"><button className={view.mode === 'orbit' ? 'selected' : ''} aria-pressed={view.mode === 'orbit'} disabled={loading} onClick={() => engine.current.setMode('orbit')}><Layers3 size={14} />自由视角</button><button className={view.mode === 'walk' ? 'selected' : ''} aria-pressed={view.mode === 'walk'} disabled={loading} onClick={() => engine.current.setMode('walk')}><Footprints size={14} />第一人称</button></div>
          <div className="tool-group view-actions"><IconButton label="恢复全景" icon={Maximize2} disabled={loading} onClick={() => engine.current.home()} /><IconButton label="俯视户型" icon={Grid2X2} disabled={loading} onClick={() => engine.current.home(true)} /><IconButton label="选择第一人称起点" icon={Crosshair} disabled={loading} active={view.tool === 'spawn'} onClick={() => { engine.current.setMode('orbit'); engine.current.setTool('spawn'); }} /><IconButton label="操作说明" icon={Settings2} aria-expanded={help} onClick={() => setHelp(!help)} /></div>
        </div>
        {help && <div className="help-card"><div><strong>操作指南</strong><IconButton label="关闭操作说明" icon={X} onClick={() => setHelp(false)} /></div><p>左键选择 · 自由视角中拖动旋转、右键平移</p><p>第一人称：WASD 移动 · 左键拖动转向</p><p>家具：G 移动 / R 旋转 / Delete 删除</p><p>缩放使用工具栏，自由视角也可按 S</p><p>Ctrl / ⌘ + Z 撤销，Shift + Z 重做</p></div>}
        {view.tool === 'spawn' && <div className="tool-hint"><Crosshair size={16} />点击一处开阔地板，从这里开始漫游</div>}
        {view.tool === 'paint' && <div className="tool-hint"><PaintRoller size={16} />连续涂刷 · 点击表面应用当前材质</div>}
        {doorHover && !busy && <button className="door-interaction" style={{left:doorHover.x,top:doorHover.y}} onPointerDown={e=>e.stopPropagation()} onPointerLeave={()=>engine.current.clearDoorHover()} onClick={()=>engine.current.toggleFixture(doorHover.id)}>{doorHover.kind === 'lamp' ? <><LampFloor size={16}/>{doorHover.on ? '关灯' : '开灯'}</> : <><DoorOpen size={16}/>{doorHover.open ? '关门' : '开门'}</>}</button>}
        <fieldset className="sun-timeline" disabled={loading || !!busy}>
          <div className="timeline-heading"><div className="timeline-time"><Sunset size={16} /><strong>{timeLabel(lighting.time)}</strong><span>{sunlight.period}</span></div><div className="time-presets">{timePresets(lighting).map(p => <button key={p.name} className={Math.abs(lighting.time - p.time) < .13 ? 'selected' : ''} aria-pressed={Math.abs(lighting.time - p.time) < .13} onClick={() => setLighting({ time: p.time }, true)}>{p.name}</button>)}</div></div>
          <input className="time-slider" aria-label="日照时间" aria-valuetext={timeLabel(lighting.time)} type="range" min="0" max="24" step="0.25" value={lighting.time} onChange={e => setLighting({ time: Number(e.target.value) })} onPointerUp={commitLighting} onKeyUp={commitLighting} onBlur={commitLighting} />
          <div className="timeline-ticks" aria-hidden="true">{['00:00', '06:00', '12:00', '18:00', '24:00'].map(t => <span key={t}>{t}</span>)}</div>
        </fieldset>
        <div className="viewport-bottom"><span className="orbit-hint">{view.mode === 'orbit' ? '单击选择 · 拖动旋转 · 右键平移' : '单击选择 · 左键拖动转向 · WASD 移动'}</span><button className="capture-button" title="下载当前视角 PNG" disabled={loading} onClick={() => engine.current.screenshot()}><Camera size={14} /><span>截图</span></button></div>
        {(loading || error) && <div className="loading-overlay"><div className="loading-mark"><Layers3 size={32} /></div><h2>{error ? '暂时无法打开空间' : '加载户型…'}</h2><p>{error || ''}</p>{error ? <button className="button primary" onClick={() => window.location.reload()}>重新加载</button> : <><div className="loading-track"><span style={{ width: `${progress}%` }} /></div><small>{progress}%</small></>}</div>}
      </section>
      <aside className="inspector-panel" aria-label="对象与光源设置" hidden={!inspectorOpen} style={{'--furniture-list-height': `${listRatio*100}%`}}>
        <div className="panel-heading"><InspectorTabs active={inspectorTab} onChange={setInspectorTab}/><IconButton icon={PanelRightClose} label="收起右侧栏" onClick={() => setInspectorOpen(false)}/></div>
        <div id="inspector-objects" role="tabpanel" aria-labelledby="inspector-tab-objects" className="object-panel-content" hidden={inspectorTab!=='objects'}>
        <div className="scene-section"><div className="section-heading"><h2>已放置家具</h2><span>{view.furnitureCount}</span></div>{view.furniture.length ? <div className="scene-list">{view.furniture.map(item => <button key={item.id} className={selection?.id === item.id ? 'selected' : ''} onClick={() => engine.current.selectFurniture(item.id)}><Box size={14} /><span>{item.name}</span><ChevronRight size={13} /></button>)}</div> : <div className="empty-furniture"><Armchair size={20} /><span>暂无家具</span></div>}</div>
        <div className="scene-resize-handle" role="separator" aria-label="调整家具列表高度" aria-orientation="horizontal" aria-valuemin={15} aria-valuemax={70} aria-valuenow={Math.round(listRatio*100)} aria-valuetext={`${Math.round(listRatio*100)}%`} tabIndex={0} title="拖动调整高度，双击恢复 30%" onPointerDown={beginListResize} onPointerMove={moveListResize} onPointerUp={endListResize} onPointerCancel={endListResize} onLostPointerCapture={()=>{listResize.current=null;}} onDoubleClick={()=>setListRatio(.3)} onKeyDown={event=>{if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();event.stopPropagation();setListRatio(ratio=>clampListRatio(ratio+(event.key === 'ArrowDown' ? .025 : -.025)));}else if(event.key==='Home'){event.preventDefault();setListRatio(.3);}}}/>
        {selection && <><div className="inspector-heading"><h2>{furnitureSelected ? '家具' : selection.category === 'floor' ? '地板' : '墙面'}</h2><IconButton icon={X} label="取消选择" onClick={() => engine.current.select(null)} /></div>
        <div className="inspector-scroll">
          {selection ? <>
            <div className="selected-object"><span className="object-icon">{furnitureSelected ? <Armchair size={23} /> : <Layers3 size={23} />}</span><div><h2>{selection.name}</h2></div><IconButton label="聚焦所选对象" icon={Focus} onClick={() => engine.current.focusSelected()} /></div>
            <div className="dimension-row"><span>尺寸</span><strong>{selection.dimensions.map(n => n.toFixed(2)).join(' × ')}<small> m</small></strong></div>
            {surfaceSelected ? <>
              <div className="inspector-section"><div className="section-heading"><h2>材质预览</h2></div><div className={`large-material-preview ${brush.finish}`} style={materialPreview(brush)} /><div className="active-finish"><span>{FINISHES.find(f => f.id === brush.finish)?.name || '自定义纹理'}</span><span className="hex-tag">{brush.color.toUpperCase()}</span></div></div>
              <div className="inspector-section"><h2 className="section-title">铺贴设置</h2><label className="range-label"><span>纹理大小</span><strong>{brush.size.toFixed(1)}×</strong><input type="range" min="0.1" max="4" step="0.1" value={brush.size} onChange={e => editBrush({ size: Number(e.target.value) })} /></label><div className="range-endpoints"><span>更密</span><span>更疏</span></div>
                <label className="range-label"><span>纹理方向</span><strong>{brush.rotation}°</strong><input type="range" min="0" max="180" step="15" value={brush.rotation} onChange={e => editBrush({ rotation: Number(e.target.value) })} /></label>
                <label className="range-label"><span>表面质感</span><strong>{Math.round(brush.roughness * 100)}%</strong><input type="range" min="0" max="1" step="0.05" value={brush.roughness} onChange={e => editBrush({ roughness: Number(e.target.value) })} /></label>
                <button className="button primary full-width" onClick={() => engine.current.applySurface(brush)}><Check size={15} />应用到所选面</button><button className="button subtle full-width" onClick={() => { engine.current.applySurface(brush, true); notify(`已应用到全部${selection.category === 'floor' ? '地板' : '墙体'}表面`); }}><CheckCheck size={15} />应用到全部{selection.category === 'floor' ? '地板' : '墙体'}</button>
              </div>
              <p className="inspector-note">调整后点击应用</p>
            </> : <>
              <div className="inspector-section"><div className="section-heading"><h2>位置</h2><span>米</span></div><div className="number-grid">{['左右 X', '高度 Y', '前后 Z'].map((a, i) => <NumberField key={`${selection.id}-${a}`} label={a} value={selection.position[i]} onCommit={n => { const p = [...selection.position]; p[i] = n; engine.current.updateTransform({ position: p }); }} />)}</div></div>
              {selection.type === 'door' && <div className="inspector-section"><h2 className="section-title">门的开关</h2><button className="button secondary full-width" onClick={()=>engine.current.toggleDoor(selection.id)}><DoorOpen size={15}/>{selection.door?.open ? '关门' : '开门'}</button><div className="lighting-options door-hinge-options">{[['left','左开'],['right','右开']].map(([hinge,label])=><button key={hinge} aria-pressed={selection.door?.hinge===hinge} className={selection.door?.hinge===hinge ? 'selected' : ''} onClick={()=>engine.current.changeDoor(selection.id,{hinge})}>{label}</button>)}</div></div>}
              {selection.lamp && <div className="inspector-section"><h2 className="section-title">灯光</h2><button className="button secondary full-width" aria-pressed={selection.lamp.on} onClick={()=>engine.current.toggleFixture(selection.id)}><LampFloor size={15}/>{selection.lamp.on ? '关灯' : '开灯'}</button></div>}
              <div className="inspector-section"><div className="section-heading"><h2>尺寸</h2><span>米</span></div><div className="number-grid">{[['宽',0],['深',2],['高',1]].map(([label,i])=><NumberField key={`${selection.id}-dimension-${i}`} label={label} min={.01} step={.05} value={selection.dimensions[i]} onCommit={n=>{const dimensions=[...selection.dimensions];dimensions[i]=n;engine.current.setDimensions(dimensions);}}/>)}</div></div>
              <div className="inspector-section"><h2 className="section-title">朝向</h2><div className="rotation-controls"><NumberField label="水平旋转 °" value={selection.rotation} step={15} onCommit={n => engine.current.updateTransform({ rotation: n })} /><button className="rotation-step-button" title="旋转 90°" aria-label="水平旋转增加90度" onClick={() => engine.current.rotateSelected(90)}><Rotate3D size={14}/></button></div><label className="toggle-row"><span>网格吸附<small>移动 0.1 m · 旋转 15°</small></span><input type="checkbox" checked={view.snap} onChange={e => engine.current.setSnap(e.target.checked)} /></label><button className="button secondary full-width" onClick={() => { engine.current.groundSelected(); engine.current.commit(); }}><ArrowDownToLine size={15} />{selection.mount === 'ceiling' ? '贴合天花板' : '贴合地板'}</button></div>
              <div className="furniture-actions"><button className="button secondary" onClick={() => engine.current.duplicateSelected()}><Copy size={15} />复制</button><button className="button danger" onClick={() => engine.current.deleteSelected()}><Trash2 size={15} />删除</button></div><p className="inspector-note">宽、深、高按家具自身方向计算。</p>
            </>}
          </> : <div className="empty-inspector"><div className="selection-illustration"><MousePointer2 size={33} strokeWidth={1.3} /><span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" /></div><h2>未选择对象</h2><p>点击墙面、地板或家具</p></div>}
        </div>
        </>}
        </div>
        <div id="inspector-lights" role="tabpanel" aria-labelledby="inspector-tab-lights" className="light-panel-content" hidden={inspectorTab!=='lights'}>
          <LightPanel lights={view.lights} plan={view.roomPlan} selectedId={selection?.id} disabled={loading || !!busy} onSelect={id=>engine.current.selectFurniture(id)} onToggle={id=>engine.current.toggleFixture(id)} onToggleAll={on=>engine.current.setAllFixtures(on)} onAssign={(id,roomId)=>engine.current.assignLampRoom(id,roomId)} onRename={(id,name)=>engine.current.renameRoom(id,name)} onAdd={()=>engine.current.addFurniture('ceiling-light')}/>
        </div>
      </aside>
    </main>
    <footer className="statusbar"><span>{error ? '加载失败' : loading ? '加载中' : ''}</span><span>{selection ? selection.name : '选择墙面、地板或家具进行编辑'}</span><span>{view.wallCount} 墙体 <span className="status-separator">·</span> {view.floorCount} 地板 <span className="status-separator">·</span> {view.furnitureCount} 家具</span></footer>
    {toast && <div className="toast" role="status"><Check size={17} />{toast}<button aria-label="关闭提示" onClick={() => setToast('')}><X size={14} /></button></div>}
    {busy && <div className="busy-overlay"><LoaderCircle className="spin" size={22} /><span>{busy}…</span></div>}
    <input type="file" hidden ref={importInput} accept=".glb" onChange={importModel} /><input type="file" hidden ref={textureInput} accept="image/png,image/jpeg,image/webp" onChange={importTexture} /><input type="file" hidden ref={projectInput} accept=".json" onChange={importProject} />
  </div>;
}
createRoot(document.getElementById('root')).render(<App />);
