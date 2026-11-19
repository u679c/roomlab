import React, { useEffect, useRef, useState } from 'react';
import { LampFloor, Map, Plus, ChevronDown } from 'lucide-react';

function RoomName({ room, onRename, disabled }) {
  const [draft,setDraft] = useState(room.name);
  const cancelBlur = useRef(false);
  useEffect(()=>setDraft(room.name),[room.id,room.name]);
  const commit = () => {
    if (cancelBlur.current) { cancelBlur.current=false; return; }
    const value=draft.trim();
    if (value && value.length<=32) { setDraft(value); onRename(room.id,value); }
    else setDraft(room.name);
  };
  return <label className="room-name-field"><span>房间 {room.number} 名称</span><input disabled={disabled} maxLength={32} value={draft} onChange={event=>setDraft(event.target.value)} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();if(event.key==='Escape'){cancelBlur.current=true;setDraft(room.name);event.currentTarget.blur();}}}/></label>;
}

function RoomPlan({ plan, lights, selected, onSelect }) {
  return <svg className="room-plan" viewBox={plan.viewBox} role="group" aria-label="房间平面图">
    {plan.rooms.map(room=><g key={room.id} className={`plan-room ${selected===room.id?'selected':''}`} role="button" tabIndex={0} aria-label={`${room.number} 号，${room.name}`} aria-pressed={selected===room.id} onClick={()=>onSelect(room.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(room.id);}}}>
      <title>{room.name}</title><path className="room-fill" d={room.path}/><path className="room-outline" d={room.outline}/>
      <text x={room.center[0]} y={room.center[1]} textAnchor="middle" dominantBaseline="middle">{room.name.length>6?`${room.name.slice(0,6)}…`:room.name}</text>
    </g>)}
    <path className="plan-walls" d={plan.walls}/>
    {lights.map(light=><circle key={light.id} className={`plan-light ${light.on?'on':''}`} cx={light.position[0]} cy={light.position[2]} r=".065"><title>{light.name} · {light.roomName}</title></circle>)}
  </svg>;
}

export function InspectorTabs({ active, onChange }) {
  return <div className="inspector-tabs" role="tablist" aria-label="右侧面板" onKeyDown={event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const next=event.key==='Home'?'objects':event.key==='End'?'lights':active==='objects'?'lights':'objects';
    onChange(next);event.currentTarget.querySelector(`#inspector-tab-${next}`)?.focus();
  }}>{[['objects','对象'],['lights','光源']].map(([id,label])=><button key={id} id={`inspector-tab-${id}`} role="tab" aria-selected={active===id} aria-controls={`inspector-${id}`} tabIndex={active===id?0:-1} className={active===id?'selected':''} onClick={()=>onChange(id)}>{label}</button>)}</div>;
}

export function LightPanel({ lights=[], plan, selectedId, disabled, onSelect, onToggle, onToggleAll, onAssign, onRename, onAdd }) {
  const [editingRooms,setEditingRooms] = useState(false),[selectedRoom,setSelectedRoom] = useState(null);
  const rooms=plan?.rooms || [],room=rooms.find(item=>item.id===selectedRoom)||rooms[0];
  const onCount=lights.filter(light=>light.on).length;
  return <div className="light-panel">
    <fieldset className="light-toolbar" disabled={disabled}>
      <div className="light-summary"><span>{lights.length} 盏灯</span><span>{onCount} 盏已开</span></div>
      <div className="light-bulk-actions"><button className="button secondary" disabled={!lights.length || onCount===lights.length} onClick={()=>onToggleAll(true)}>全部开</button><button className="button secondary" disabled={!onCount} onClick={()=>onToggleAll(false)}>全部关</button></div>
      <button className="button secondary full-width" onClick={onAdd}><Plus size={14}/>添加吸顶灯</button>
    </fieldset>
    <div className="light-panel-scroll">
      <button className="room-editor-toggle" disabled={disabled || !rooms.length} aria-expanded={editingRooms} aria-controls="room-editor" onClick={()=>setEditingRooms(!editingRooms)}><Map size={15}/><span>编辑房间</span><ChevronDown size={14} className={editingRooms?'expanded':''}/></button>
      {editingRooms && room && <div className="room-editor" id="room-editor">
        <p>点击房间修改名称</p><RoomPlan plan={plan} lights={lights} selected={room.id} onSelect={setSelectedRoom}/>
        <RoomName room={room} onRename={onRename} disabled={disabled}/>
      </div>}
      <fieldset className="light-list" disabled={disabled}>
        {lights.map(light=><div className={`light-row ${selectedId===light.id?'selected':''}`} key={light.id}>
          <div className="light-row-heading"><button className="light-name" onClick={()=>onSelect(light.id)} title={`选中${light.name}`}><LampFloor size={16}/><span>{light.name}</span></button><button role="switch" aria-checked={light.on} aria-label={`${light.name}，${light.roomName}`} title={light.on?'关灯':'开灯'} className={`light-switch ${light.on?'on':''}`} onClick={()=>onToggle(light.id)}><span/>{light.on?'开':'关'}</button></div>
          <label className="light-room-field"><span>房间</span><select aria-label={`${light.name}所在房间`} value={light.roomAssignment} onChange={event=>onAssign(light.id,event.target.value)}><option value="">自动 · {light.autoRoomName}</option>{rooms.map(room=><option key={room.id} value={room.id}>{room.name}</option>)}<option value="unassigned">未分配</option></select></label>
        </div>)}
        {!lights.length && <div className="empty-lights"><LampFloor size={22}/><span>暂无灯具</span></div>}
      </fieldset>
    </div>
  </div>;
}
