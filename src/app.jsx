import React, { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import {
  collection, doc, setDoc, deleteDoc, getDocs, writeBatch
} from "firebase/firestore";

const genId = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_TAGS = [
  { id: "study", label: "Study", emoji: "📚", color: "#A0C4FF" },
  { id: "work", label: "Work", emoji: "💼", color: "#FFD6A5" },
  { id: "personal", label: "Personal", emoji: "🏠", color: "#CAFFBF" },
  { id: "leisure", label: "Leisure", emoji: "🎮", color: "#BDB2FF" },
  { id: "errands", label: "Errands", emoji: "🛒", color: "#FFC6FF" },
  { id: "misc", label: "Misc", emoji: "💡", color: "#FDFFB6" },
];

const SECTIONS = [
  { key: "today", label: "🔥 Must Do Today", jp: "今日やる", color: "#FF6B6B", bg: "#2A1A1A" },
  { key: "normal", label: "📋 Normal", jp: "普通", color: "#A0C4FF", bg: "#1A2233" },
  { key: "later", label: "🕐 Do Later", jp: "後で", color: "#B5EAD7", bg: "#1A2E24" },
];

const MOVE_OPTIONS = {
  today:  [{ to: "normal", label: "→ Normal" }, { to: "later", label: "→ Later" }],
  normal: [{ to: "today", label: "→ Today" }, { to: "later", label: "→ Later" }],
  later:  [{ to: "today", label: "→ Today" }, { to: "normal", label: "→ Normal" }],
};

// ── Audio ──
const playWorkEnd = () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  [0,0.18,0.36].forEach((t,i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime([880,1100,1320][i], ctx.currentTime+t);
    g.gain.setValueAtTime(0.3, ctx.currentTime+t);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+t+0.4);
    o.start(ctx.currentTime+t); o.stop(ctx.currentTime+t+0.4);
  });
};
const playBreakEnd = () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  [0,0.25,0.5,0.75].forEach((t,i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "triangle";
    o.frequency.setValueAtTime([523,659,784,523][i], ctx.currentTime+t);
    g.gain.setValueAtTime(0.25, ctx.currentTime+t);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+t+0.35);
    o.start(ctx.currentTime+t); o.stop(ctx.currentTime+t+0.35);
  });
};

// ── Styles ──
const S = {
  app: { minHeight:"100vh", background:"#111", color:"#E0E0E0", fontFamily:"system-ui, sans-serif", padding:"1.25rem", boxSizing:"border-box" },
  card: (bg) => ({ background:bg||"#1A1A1A", border:"1px solid #2A2A2A", borderRadius:14, padding:"1rem 1.25rem", display:"flex", flexDirection:"column", gap:12 }),
  input: { fontSize:16, padding:"11px 14px", background:"#222", border:"1px solid #3A3A3A", borderRadius:10, color:"#F0F0F0", outline:"none", boxSizing:"border-box", width:"100%" },
  btn: (color, full) => ({ padding:"11px 18px", fontSize:15, fontWeight:500, cursor:"pointer", border:`1px solid ${color||"#555"}`, borderRadius:10, background:"transparent", color:color||"#CCC", whiteSpace:"nowrap", width:full?"100%":undefined }),
  smBtn: (color) => ({ fontSize:12, padding:"3px 9px", cursor:"pointer", border:`1px solid ${color||"#3A3A3A"}`, borderRadius:8, background:"transparent", color:color||"#AAA" }),
  dtInput: { fontSize:15, padding:"11px 12px", background:"#222", border:"1px solid #3A3A3A", borderRadius:10, color:"#CCC", outline:"none", width:"100%", boxSizing:"border-box" },
  numInput: { width:64, fontSize:15, padding:"8px 10px", background:"#222", border:"1px solid #3A3A3A", borderRadius:10, color:"#F0F0F0", outline:"none", textAlign:"center" },
  tag: (color) => ({ fontSize:12, padding:"2px 8px", borderRadius:20, background:color+"22", border:`1px solid ${color}55`, color, fontWeight:500, whiteSpace:"nowrap" }),
};

// ── Firebase helpers ──
const tasksCol = collection(db, "tasks");
const tagsCol = collection(db, "customTags");

async function fbLoadTasks() {
  const snap = await getDocs(tasksCol);
  return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}
async function fbLoadTags() {
  const snap = await getDocs(tagsCol);
  return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}
async function fbSaveTask(task) {
  await setDoc(doc(db, "tasks", task.id), task);
}
async function fbDeleteTask(id) {
  await deleteDoc(doc(db, "tasks", id));
}
async function fbSaveTag(tag) {
  await setDoc(doc(db, "customTags", tag.id), tag);
}
async function fbDeleteTag(id) {
  await deleteDoc(doc(db, "customTags", id));
}
async function fbSaveTasksBatch(tasks) {
  const batch = writeBatch(db);
  tasks.forEach(t => batch.set(doc(db, "tasks", t.id), t));
  await batch.commit();
}

// ── Components ──
function SyncBadge({ status }) {
  const cfg = { idle:{color:"#555",text:""}, saving:{color:"#FFD6A5",text:"⟳ Saving..."}, saved:{color:"#7CBA5A",text:"✓ Synced"}, error:{color:"#E07070",text:"✗ Sync error"} }[status];
  if (!cfg.text) return null;
  return <span style={{ fontSize:13, color:cfg.color, marginLeft:8 }}>{cfg.text}</span>;
}

function TagSelector({ allTags, value, onChange }) {
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
      <button onClick={() => onChange(null)} style={{ ...S.smBtn(value===null?"#888":"#444"), background:value===null?"#333":"transparent" }}>None</button>
      {allTags.map(tag => (
        <button key={tag.id} onClick={() => onChange(tag.id===value ? null : tag.id)}
          style={{ ...S.tag(tag.color), cursor:"pointer", opacity:value&&value!==tag.id?0.4:1, outline:value===tag.id?`2px solid ${tag.color}`:"none" }}>
          {tag.emoji} {tag.label}
        </button>
      ))}
    </div>
  );
}

function TaskItem({ task, section, allTags, onComplete, onDelete, onMove, onMoveUp, onMoveDown, onTagChange, isFirst, isLast }) {
  const [editingTag, setEditingTag] = useState(false);
  const tag = allTags.find(t => t.id === task.tag);
  return (
    <div style={{ background:"#1A1A1A", borderRadius:10, border:"1px solid #2A2A2A", overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 12px" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:2, flexShrink:0, marginTop:1 }}>
          <button onClick={onMoveUp} disabled={isFirst} style={{ fontSize:11, lineHeight:1, padding:"2px 5px", cursor:isFirst?"default":"pointer", border:"1px solid #333", borderRadius:5, background:"transparent", color:isFirst?"#333":"#888" }}>▲</button>
          <button onClick={onMoveDown} disabled={isLast} style={{ fontSize:11, lineHeight:1, padding:"2px 5px", cursor:isLast?"default":"pointer", border:"1px solid #333", borderRadius:5, background:"transparent", color:isLast?"#333":"#888" }}>▼</button>
        </div>
        <input type="checkbox" checked={false} onChange={() => onComplete(task.id)}
          style={{ marginTop:3, cursor:"pointer", accentColor:"#7CBA5A", width:18, height:18, flexShrink:0 }} />
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ margin:0, fontSize:15, lineHeight:1.55, color:"#E0E0E0", wordBreak:"break-word" }}>{task.text}</p>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:4, alignItems:"center" }}>
            {task.reminder && <span style={{ fontSize:13, color:"#777" }}>⏰ {task.reminder}</span>}
            {tag && <span style={S.tag(tag.color)}>{tag.emoji} {tag.label}</span>}
            <button onClick={() => setEditingTag(e=>!e)} style={{ ...S.smBtn("#555"), fontSize:11 }}>{editingTag?"✕ close":"🏷 tag"}</button>
          </div>
        </div>
        <div style={{ display:"flex", gap:5, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
          {MOVE_OPTIONS[section]?.map(({to,label}) => (
            <button key={to} style={S.smBtn()} onClick={() => onMove(task.id, to)}>{label}</button>
          ))}
          <button style={{ ...S.smBtn("#A32D2D"), fontSize:15, padding:"3px 8px" }} onClick={() => onDelete(task.id)}>×</button>
        </div>
      </div>
      {editingTag && (
        <div style={{ padding:"8px 12px 10px", borderTop:"1px solid #252525", background:"#161616" }}>
          <TagSelector allTags={allTags} value={task.tag||null} onChange={(id) => { onTagChange(task.id, id); setEditingTag(false); }} />
        </div>
      )}
    </div>
  );
}

function Section({ meta, tasks, allTags, onAdd, onComplete, onDelete, onMove, onReorder, onTagChange, filterTag }) {
  const [text, setText] = useState("");
  const [reminder, setReminder] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);
  const add = () => {
    const trimmed = text.trim(); if (!trimmed) return;
    onAdd({ id:genId(), text:trimmed, reminder, tag:selectedTag, section:meta.key, order:tasks.length, done:false });
    setText(""); setReminder(""); setSelectedTag(null);
  };
  const filtered = filterTag ? tasks.filter(t => t.tag===filterTag) : tasks;
  return (
    <div style={S.card(meta.bg)}>
      <div>
        <span style={{ fontSize:18, fontWeight:600, color:meta.color }}>{meta.label}</span>
        <span style={{ fontSize:13, color:"#666", marginLeft:8 }}>{meta.jp} · {tasks.length} tasks</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Add a task..." style={S.input} />
        <input type="datetime-local" value={reminder} onChange={e=>setReminder(e.target.value)} style={S.dtInput} />
        <div style={{ background:"#161616", borderRadius:10, padding:"8px 10px", border:"1px solid #2A2A2A" }}>
          <p style={{ margin:"0 0 6px", fontSize:12, color:"#666" }}>Tag (optional)</p>
          <TagSelector allTags={allTags} value={selectedTag} onChange={setSelectedTag} />
        </div>
        <button onClick={add} style={S.btn(meta.color, true)}>+ Add</button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8, overflowY:"auto", maxHeight:"none" }}>
        {filtered.length===0
          ? <p style={{ fontSize:14, color:"#444", textAlign:"center", padding:"1rem 0", margin:0 }}>{filterTag?"No tasks with this tag.":"No tasks here yet!"}</p>
          : filtered.map(t => {
              const realIdx = tasks.indexOf(t);
              return <TaskItem key={t.id} task={t} section={meta.key} allTags={allTags}
                onComplete={onComplete} onDelete={onDelete} onMove={onMove}
                onMoveUp={() => onReorder(meta.key, realIdx, -1)}
                onMoveDown={() => onReorder(meta.key, realIdx, 1)}
                onTagChange={onTagChange} isFirst={realIdx===0} isLast={realIdx===tasks.length-1} />;
            })
        }
      </div>
    </div>
  );
}

function CompletedSection({ tasks, allTags, onRestore, onClearAll }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...S.card(), marginTop:"1rem" }}>
      <button onClick={() => setOpen(o=>!o)} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", color:"#E0E0E0", padding:0 }}>
        <span style={{ fontSize:17, fontWeight:600 }}>✅ Completed <span style={{ fontSize:14, fontWeight:400, color:"#555" }}>({tasks.length})</span></span>
        <span style={{ fontSize:13, color:"#555" }}>{open?"▲ hide":"▼ show"}</span>
      </button>
      {open && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {tasks.length===0
            ? <p style={{ fontSize:14, color:"#444", textAlign:"center", padding:"0.5rem 0", margin:0 }}>Nothing completed yet!</p>
            : <>
                {tasks.map(t => {
                  const tag = allTags.find(tg=>tg.id===t.tag);
                  return (
                    <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background:"#161616", borderRadius:10, border:"1px solid #2A2A2A" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ margin:0, fontSize:15, color:"#555", textDecoration:"line-through", wordBreak:"break-word" }}>{t.text}</p>
                        <div style={{ display:"flex", gap:6, marginTop:3, flexWrap:"wrap" }}>
                          {t.completedFrom && <span style={{ fontSize:12, color:"#444" }}>from {t.completedFrom}</span>}
                          {tag && <span style={S.tag(tag.color)}>{tag.emoji} {tag.label}</span>}
                        </div>
                      </div>
                      <button onClick={() => onRestore(t.id)} style={S.smBtn("#A0C4FF")}>Restore</button>
                    </div>
                  );
                })}
                <button onClick={onClearAll} style={S.btn("#A32D2D", true)}>🗑 Clear All Completed</button>
              </>
          }
        </div>
      )}
    </div>
  );
}

function TagManager({ customTags, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("⭐");
  const [newColor, setNewColor] = useState("#A0C4FF");
  const add = () => {
    const label = newLabel.trim(); if (!label) return;
    onAdd({ id:genId(), label, emoji:newEmoji, color:newColor, custom:true });
    setNewLabel(""); setNewEmoji("⭐"); setNewColor("#A0C4FF");
  };
  return (
    <div style={{ ...S.card(), marginBottom:"1.25rem" }}>
      <button onClick={() => setOpen(o=>!o)} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", color:"#E0E0E0", padding:0 }}>
        <span style={{ fontSize:17, fontWeight:600 }}>🏷 Manage Tags</span>
        <span style={{ fontSize:13, color:"#666" }}>{open?"▲ collapse":"▼ expand"}</span>
      </button>
      {open && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div>
            <p style={{ margin:"0 0 6px", fontSize:13, color:"#777" }}>Default tags</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {DEFAULT_TAGS.map(t => <span key={t.id} style={S.tag(t.color)}>{t.emoji} {t.label}</span>)}
            </div>
          </div>
          {customTags.length>0 && (
            <div>
              <p style={{ margin:"0 0 6px", fontSize:13, color:"#777" }}>Custom tags</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {customTags.map(t => (
                  <div key={t.id} style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={S.tag(t.color)}>{t.emoji} {t.label}</span>
                    <button onClick={() => onRemove(t.id)} style={{ fontSize:13, background:"none", border:"none", color:"#A32D2D", cursor:"pointer", padding:"0 2px" }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <input value={newEmoji} onChange={e=>setNewEmoji(e.target.value)} placeholder="🏷" style={{ ...S.input, width:56, textAlign:"center", fontSize:20, padding:"8px" }} />
            <input value={newLabel} onChange={e=>setNewLabel(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Tag name..." style={{ ...S.input, flex:1, minWidth:120 }} />
            <input type="color" value={newColor} onChange={e=>setNewColor(e.target.value)} style={{ width:44, height:44, padding:2, background:"#222", border:"1px solid #3A3A3A", borderRadius:10, cursor:"pointer" }} />
            <button onClick={add} style={S.btn("#FDFFB6")}>+ Add Tag</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Pomodoro() {
  const [open, setOpen] = useState(false);
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [phase, setPhase] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [waterReminder, setWaterReminder] = useState(false);
  const intervalRef = useRef(null);
  const sessRef = useRef(0);
  const phaseRef = useRef("idle");
  const breakMinRef = useRef(5);
  breakMinRef.current = breakMin;

  const clearTimer = () => { clearInterval(intervalRef.current); intervalRef.current = null; };

  const startBreakPhase = useCallback((sCount) => {
    const isLong = sCount % 3 === 0;
    const p = isLong ? "longbreak" : "break";
    phaseRef.current = p; setPhase(p);
    setSeconds(isLong ? (breakMinRef.current+10)*60 : breakMinRef.current*60);
    setPaused(false);
  }, []);

  const tick = useCallback(() => {
    setSeconds(s => {
      if (s <= 1) {
        clearTimer();
        if (phaseRef.current === "work") {
          playWorkEnd(); setWaterReminder(true);
          const ns = sessRef.current + 1; sessRef.current = ns; setSessions(ns);
          startBreakPhase(ns);
        } else {
          playBreakEnd(); setWaterReminder(false);
          phaseRef.current = "idle"; setPhase("idle"); setPaused(false);
        }
        return 0;
      }
      return s - 1;
    });
  }, [startBreakPhase]);

  const startTimer = useCallback(() => { clearTimer(); intervalRef.current = setInterval(tick, 1000); }, [tick]);
  const startWork = () => { phaseRef.current="work"; setPhase("work"); setSeconds(workMin*60); setPaused(false); setWaterReminder(false); clearTimer(); intervalRef.current = setInterval(tick, 1000); };
  const togglePause = () => { if (paused) { startTimer(); setPaused(false); } else { clearTimer(); setPaused(true); } };
  const reset = () => { clearTimer(); phaseRef.current="idle"; setPhase("idle"); setSeconds(0); setPaused(false); setWaterReminder(false); };
  useEffect(() => () => clearTimer(), []);

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const totalSecs = phase==="work"?workMin*60:phase==="break"?breakMin*60:(breakMin+10)*60;
  const pct = phase!=="idle" ? ((totalSecs-seconds)/totalSecs)*100 : 0;
  const phaseColor = {idle:"#888",work:"#FF6B6B",break:"#B5EAD7",longbreak:"#A0C4FF"}[phase];
  const phaseLabel = {idle:"Ready",work:"🔥 Work",break:"☕ Break",longbreak:"🌙 Long Break"}[phase];

  return (
    <div style={{ ...S.card(), marginBottom:"1.25rem" }}>
      <button onClick={() => setOpen(o=>!o)} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", color:"#E0E0E0", padding:0 }}>
        <span style={{ fontSize:17, fontWeight:600 }}>🍅 Pomodoro Timer</span>
        <span style={{ fontSize:13, color:"#666" }}>{open?"▲ collapse":"▼ expand"}</span>
      </button>
      {open && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:14, color:"#AAA" }}>Work (min)</span>
              <input type="number" min={1} max={90} value={workMin} onChange={e=>setWorkMin(+e.target.value)} style={S.numInput} disabled={phase!=="idle"} />
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:14, color:"#AAA" }}>Break (min)</span>
              <input type="number" min={1} max={30} value={breakMin} onChange={e=>setBreakMin(+e.target.value)} style={S.numInput} disabled={phase!=="idle"} />
            </div>
            <span style={{ fontSize:13, color:"#555" }}>Every 3 sessions → +10 min long break</span>
          </div>
          {waterReminder && (
            <div style={{ background:"#1A2E3A", border:"1px solid #1E5F74", borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:22 }}>💧</span>
              <span style={{ fontSize:15, color:"#A0D8EF" }}>Time for a break! Don't forget to drink water! 水分補給しよう！</span>
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
            <div style={{ position:"relative", width:140, height:140 }}>
              <svg width={140} height={140} style={{ transform:"rotate(-90deg)" }}>
                <circle cx={70} cy={70} r={60} fill="none" stroke="#2A2A2A" strokeWidth={10} />
                <circle cx={70} cy={70} r={60} fill="none" stroke={phaseColor} strokeWidth={10}
                  strokeDasharray={`${2*Math.PI*60}`} strokeDashoffset={`${2*Math.PI*60*(1-pct/100)}`}
                  strokeLinecap="round" style={{ transition:"stroke-dashoffset 0.9s linear" }} />
              </svg>
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:28, fontWeight:700, color:phaseColor, fontVariantNumeric:"tabular-nums" }}>
                  {phase!=="idle" ? fmt(seconds) : fmt(workMin*60)}
                </span>
                <span style={{ fontSize:12, color:"#666" }}>{paused?"⏸ Paused":phaseLabel}</span>
              </div>
            </div>
            <div style={{ fontSize:13, color:"#555" }}>Sessions completed: {sessions}</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
              {phase==="idle" && <button style={S.btn("#FF6B6B")} onClick={startWork}>▶ Start Work</button>}
              {phase!=="idle" && <button style={S.btn(paused?"#7CBA5A":"#FFD6A5")} onClick={togglePause}>{paused?"▶ Resume":"⏸ Pause"}</button>}
              {phase!=="idle" && <button style={S.btn("#888")} onClick={reset}>⏹ Reset</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── App ──
export default function App() {
  const [allTasks, setAllTasks] = useState({ today:[], normal:[], later:[], completed:[] });
  const [customTags, setCustomTags] = useState([]);
  const [filterTag, setFilterTag] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const allTags = [...DEFAULT_TAGS, ...customTags];

  useEffect(() => {
    (async () => {
      try {
        const [rows, tags] = await Promise.all([fbLoadTasks(), fbLoadTags()]);
        const buckets = { today:[], normal:[], later:[], completed:[] };
        rows.sort((a,b) => (a.order||0)-(b.order||0)).forEach(r => {
          const sec = r.done ? "completed" : (buckets[r.section]!==undefined ? r.section : "normal");
          buckets[sec].push(r);
        });
        setAllTasks(buckets);
        setCustomTags(tags.filter(t => t.custom));
      } catch(e) {
        setLoadError("Could not connect to Firebase. Check your internet connection.");
      }
      setLoading(false);
    })();
  }, []);

  const sync = (status) => {
    setSyncStatus(status);
    if (status==="saved") setTimeout(() => setSyncStatus("idle"), 2000);
  };

  const addTask = async (task) => {
    setAllTasks(prev => ({ ...prev, [task.section]: [...prev[task.section], task] }));
    sync("saving");
    try { await fbSaveTask(task); sync("saved"); } catch { sync("error"); }
  };

  const completeTask = async (section, id) => {
    setAllTasks(prev => {
      const task = prev[section].find(t=>t.id===id); if (!task) return prev;
      const updated = { ...task, done:true, completedFrom:section };
      fbSaveTask(updated).then(() => sync("saved")).catch(() => sync("error"));
      return { ...prev, [section]: prev[section].filter(t=>t.id!==id), completed:[updated, ...prev.completed] };
    });
    sync("saving");
  };

  const deleteTask = async (section, id) => {
    setAllTasks(prev => ({ ...prev, [section]: prev[section].filter(t=>t.id!==id) }));
    sync("saving");
    try { await fbDeleteTask(id); sync("saved"); } catch { sync("error"); }
  };

  const moveTask = async (taskId, from, to) => {
    let moved;
    setAllTasks(prev => {
      moved = prev[from].find(t=>t.id===taskId); if (!moved) return prev;
      moved = { ...moved, section:to };
      return { ...prev, [from]: prev[from].filter(t=>t.id!==taskId), [to]: [...prev[to], moved] };
    });
    sync("saving");
    try { await fbSaveTask({ ...moved, section:to }); sync("saved"); } catch { sync("error"); }
  };

  const reorderTask = async (section, idx, dir) => {
    let toSave = [];
    setAllTasks(prev => {
      const arr = [...prev[section]]; const ni = idx+dir;
      if (ni<0||ni>=arr.length) return prev;
      [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
      toSave = arr.map((t,i) => ({ ...t, order:i }));
      return { ...prev, [section]: toSave };
    });
    sync("saving");
    try { await fbSaveTasksBatch(toSave); sync("saved"); } catch { sync("error"); }
  };

  const changeTag = async (section, taskId, tagId) => {
    let updated;
    setAllTasks(prev => {
      const arr = prev[section].map(t => t.id===taskId ? {...t, tag:tagId} : t);
      updated = arr.find(t=>t.id===taskId);
      return { ...prev, [section]: arr };
    });
    sync("saving");
    try { await fbSaveTask(updated); sync("saved"); } catch { sync("error"); }
  };

  const restoreTask = async (id) => {
    let restored;
    setAllTasks(prev => {
      const task = prev.completed.find(t=>t.id===id); if (!task) return prev;
      const { completedFrom, ...rest } = task;
      const dest = SECTIONS.find(s=>s.key===completedFrom) ? completedFrom : "normal";
      restored = { ...rest, done:false, section:dest };
      return { ...prev, completed: prev.completed.filter(t=>t.id!==id), [dest]:[...prev[dest], restored] };
    });
    sync("saving");
    try { await fbSaveTask(restored); sync("saved"); } catch { sync("error"); }
  };

  const clearCompleted = async () => {
    let ids = [];
    setAllTasks(prev => { ids = prev.completed.map(t=>t.id); return { ...prev, completed:[] }; });
    sync("saving");
    try { await Promise.all(ids.map(fbDeleteTask)); sync("saved"); } catch { sync("error"); }
  };

  const addCustomTag = async (tag) => {
    setCustomTags(prev => [...prev, tag]);
    try { await fbSaveTag(tag); } catch {}
  };

  const removeCustomTag = async (id) => {
    setCustomTags(prev => prev.filter(t=>t.id!==id));
    try { await fbDeleteTag(id); } catch {}
  };

  const total = ["today","normal","later"].flatMap(k=>allTasks[k]).length;

  if (loading) return (
    <div style={{ ...S.app, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, minHeight:"60vh" }}>
      <span style={{ fontSize:36 }}>🗂</span>
      <p style={{ fontSize:16, color:"#888" }}>Loading your tasks...</p>
    </div>
  );

  if (loadError) return (
    <div style={{ ...S.app, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, minHeight:"60vh" }}>
      <span style={{ fontSize:36 }}>⚠️</span>
      <p style={{ fontSize:16, color:"#E07070", textAlign:"center", maxWidth:400 }}>{loadError}</p>
    </div>
  );

  return (
    <div style={S.app}>
      <div style={{ marginBottom:"1.25rem", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div>
          <p style={{ margin:0, fontSize:24, fontWeight:600, color:"#F0F0F0" }}>
            タスク管理 <span style={{ fontSize:16, fontWeight:400, color:"#555" }}>/ Task Manager</span>
            <SyncBadge status={syncStatus} />
          </p>
          <p style={{ margin:"4px 0 0", fontSize:15, color:"#666" }}>{total} active · {allTasks.completed.length} completed · synced to Firebase</p>
        </div>
        <button onClick={() => { if ("Notification" in window && Notification.permission==="default") Notification.requestPermission(); }}
          style={{ fontSize:13, padding:"6px 12px", cursor:"pointer", border:"1px solid #333", borderRadius:10, background:"transparent", color:"#777" }}>
          🔔 Notifications
        </button>
      </div>

      <Pomodoro />

      <TagManager customTags={customTags} onAdd={addCustomTag} onRemove={removeCustomTag} />

      <div style={{ ...S.card(), marginBottom:"1.25rem" }}>
        <p style={{ margin:"0 0 8px", fontSize:14, color:"#888" }}>🔍 Filter all sections by tag</p>
        <TagSelector allTags={allTags} value={filterTag} onChange={setFilterTag} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:"1rem" }}>
        {SECTIONS.map(s => (
          <Section key={s.key} meta={s} tasks={allTasks[s.key]} allTags={allTags}
            onAdd={addTask}
            onComplete={(id) => completeTask(s.key, id)}
            onDelete={(id) => deleteTask(s.key, id)}
            onMove={(taskId, to) => moveTask(taskId, s.key, to)}
            onReorder={reorderTask}
            onTagChange={(taskId, tagId) => changeTag(s.key, taskId, tagId)}
            filterTag={filterTag} />
        ))}
      </div>

      <CompletedSection tasks={allTasks.completed} allTags={allTags} onRestore={restoreTask} onClearAll={clearCompleted} />
    </div>
  );
}
