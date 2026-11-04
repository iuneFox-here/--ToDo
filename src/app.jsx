import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, doc, setDoc, deleteDoc, getDocs, writeBatch
} from "firebase/firestore";

const genId = () => Math.random().toString(36).slice(2, 9);

const SECTIONS = [
  { key: "today", label: "🔥 Must Do Today", jp: "今日やる", color: "#FF6B6B", bg: "#2A1A1A" },
  { key: "normal", label: "📋 Normal", jp: "普通", color: "#A0C4FF", bg: "#1A2233" },
  { key: "later", label: "🕐 Do Later", jp: "後で", color: "#B5EAD7", bg: "#1A2E24" },
];

// ── Styles ──
const S = {
  app: { minHeight:"100vh", background:"#111", color:"#E0E0E0", fontFamily:"system-ui, sans-serif", padding:"1rem", boxSizing:"border-box" },
  card: (bg) => ({ background:bg||"#1A1A1A", border:"1px solid #2A2A2A", borderRadius:14, padding:"1rem 1.25rem", display:"flex", flexDirection:"column", gap:12, minWidth:0 }),
  input: { fontSize:16, padding:"11px 14px", background:"#222", border:"1px solid #3A3A3A", borderRadius:10, color:"#F0F0F0", outline:"none", boxSizing:"border-box", width:"100%" },
  btn: (color, full) => ({ padding:"11px 18px", fontSize:15, fontWeight:500, cursor:"pointer", border:`1px solid ${color||"#555"}`, borderRadius:10, background:"transparent", color:color||"#CCC", whiteSpace:"nowrap", width:full?"100%":undefined }),
  smBtn: (color) => ({ fontSize:13, padding:"5px 10px", cursor:"pointer", border:`1px solid ${color||"#3A3A3A"}`, borderRadius:8, background:"transparent", color:color||"#AAA", whiteSpace:"nowrap" }),
  dtInput: { fontSize:15, padding:"11px 12px", background:"#222", border:"1px solid #3A3A3A", borderRadius:10, color:"#CCC", outline:"none", width:"100%", boxSizing:"border-box" },
};

// ── Firebase helpers ──
const tasksCol = collection(db, "tasks");

async function fbLoadTasks() {
  const snap = await getDocs(tasksCol);
  return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}
async function fbSaveTask(task) {
  await setDoc(doc(db, "tasks", task.id), task);
}
async function fbDeleteTask(id) {
  await deleteDoc(doc(db, "tasks", id));
}
async function fbSaveTasksBatch(tasks) {
  const batch = writeBatch(db);
  tasks.forEach(t => batch.set(doc(db, "tasks", t.id), t));
  await batch.commit();
}

// ── Components ──
function SyncBadge({ status }) {
  const cfg = {
    idle: { color:"#555", text:"" },
    saving: { color:"#FFD6A5", text:"⟳ Saving..." },
    saved: { color:"#7CBA5A", text:"✓ Synced" },
    error: { color:"#E07070", text:"✗ Sync error" },
  }[status];
  if (!cfg.text) return null;
  return <span style={{ fontSize:13, color:cfg.color, marginLeft:8 }}>{cfg.text}</span>;
}

function TaskItem({ task, onComplete, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  return (
    <div style={{ background:"#1A1A1A", borderRadius:10, border:"1px solid #2A2A2A", padding:"10px 12px", display:"flex", flexDirection:"column", gap:10 }}>
      {/* Row 1: checkbox + full-width text */}
      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
        <input type="checkbox" checked={false} onChange={() => onComplete(task.id)}
          style={{ marginTop:3, cursor:"pointer", accentColor:"#7CBA5A", width:20, height:20, flexShrink:0 }} />
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ margin:0, fontSize:16, lineHeight:1.5, color:"#E0E0E0", overflowWrap:"anywhere" }}>{task.text}</p>
          {task.reminder && <p style={{ margin:"4px 0 0", fontSize:13, color:"#777" }}>⏰ {task.reminder}</p>}
        </div>
      </div>

      {/* Row 2: reorder + delete */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
        <button onClick={onMoveUp} disabled={isFirst}
          style={{ ...S.smBtn(isFirst ? "#2A2A2A" : "#3A3A3A"), color:isFirst?"#333":"#AAA", cursor:isFirst?"default":"pointer" }}>▲</button>
        <button onClick={onMoveDown} disabled={isLast}
          style={{ ...S.smBtn(isLast ? "#2A2A2A" : "#3A3A3A"), color:isLast?"#333":"#AAA", cursor:isLast?"default":"pointer" }}>▼</button>
        <button style={{ ...S.smBtn("#A32D2D"), marginLeft:"auto" }} onClick={() => onDelete(task.id)}>🗑 Delete</button>
      </div>
    </div>
  );
}

function Section({ meta, tasks, onAdd, onComplete, onDelete, onReorder }) {
  const [text, setText] = useState("");
  const [reminder, setReminder] = useState("");

  const add = () => {
    const trimmed = text.trim(); if (!trimmed) return;
    onAdd({ id:genId(), text:trimmed, reminder, section:meta.key, order:tasks.length, done:false });
    setText(""); setReminder("");
  };

  return (
    <div style={S.card(meta.bg)}>
      <div>
        <span style={{ fontSize:18, fontWeight:600, color:meta.color }}>{meta.label}</span>
        <span style={{ fontSize:13, color:"#666", marginLeft:8 }}>{meta.jp} · {tasks.length} tasks</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Add a task..." style={S.input} />
        <input type="datetime-local" value={reminder} onChange={e=>setReminder(e.target.value)} style={S.dtInput} />
        <button onClick={add} style={S.btn(meta.color, true)}>+ Add</button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {tasks.length === 0
          ? <p style={{ fontSize:14, color:"#444", textAlign:"center", padding:"1rem 0", margin:0 }}>No tasks here yet!</p>
          : tasks.map((t, i) => (
              <TaskItem key={t.id} task={t}
                onComplete={onComplete} onDelete={onDelete}
                onMoveUp={() => onReorder(meta.key, i, -1)}
                onMoveDown={() => onReorder(meta.key, i, 1)}
                isFirst={i===0} isLast={i===tasks.length-1} />
            ))
        }
      </div>
    </div>
  );
}

function CompletedSection({ tasks, onRestore, onClearAll }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...S.card(), marginTop:"1rem" }}>
      <button onClick={() => setOpen(o=>!o)} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", color:"#E0E0E0", padding:0 }}>
        <span style={{ fontSize:17, fontWeight:600 }}>✅ Completed <span style={{ fontSize:14, fontWeight:400, color:"#555" }}>({tasks.length})</span></span>
        <span style={{ fontSize:13, color:"#555" }}>{open?"▲ hide":"▼ show"}</span>
      </button>
      {open && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {tasks.length === 0
            ? <p style={{ fontSize:14, color:"#444", textAlign:"center", padding:"0.5rem 0", margin:0 }}>Nothing completed yet!</p>
            : <>
                {tasks.map(t => (
                  <div key={t.id} style={{ display:"flex", flexDirection:"column", gap:8, padding:"10px 12px", background:"#161616", borderRadius:10, border:"1px solid #2A2A2A" }}>
                    <p style={{ margin:0, fontSize:15, color:"#555", textDecoration:"line-through", overflowWrap:"anywhere" }}>{t.text}</p>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                      {t.completedFrom && <span style={{ fontSize:12, color:"#444" }}>from {t.completedFrom}</span>}
                      <button onClick={() => onRestore(t.id)} style={{ ...S.smBtn("#A0C4FF"), marginLeft:"auto" }}>Restore</button>
                    </div>
                  </div>
                ))}
                <button onClick={onClearAll} style={S.btn("#A32D2D", true)}>🗑 Clear All Completed</button>
              </>
          }
        </div>
      )}
    </div>
  );
}

// ── App ──
export default function App() {
  const [allTasks, setAllTasks] = useState({ today:[], normal:[], later:[], completed:[] });
  const [syncStatus, setSyncStatus] = useState("idle");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const rows = await fbLoadTasks();
        const buckets = { today:[], normal:[], later:[], completed:[] };
        rows.sort((a,b) => (a.order||0)-(b.order||0)).forEach(r => {
          const sec = r.done ? "completed" : (buckets[r.section] !== undefined ? r.section : "normal");
          buckets[sec].push(r);
        });
        setAllTasks(buckets);
      } catch (e) {
        setLoadError("Could not connect to Firebase. Check your internet connection.");
      }
      setLoading(false);
    })();
  }, []);

  const sync = (status) => {
    setSyncStatus(status);
    if (status === "saved") setTimeout(() => setSyncStatus("idle"), 2000);
  };

  const addTask = async (task) => {
    setAllTasks(prev => ({ ...prev, [task.section]: [...prev[task.section], task] }));
    sync("saving");
    try { await fbSaveTask(task); sync("saved"); } catch { sync("error"); }
  };

  const completeTask = async (section, id) => {
    const task = allTasks[section].find(t => t.id === id);
    if (!task) return;
    const updated = { ...task, done:true, completedFrom:section };
    setAllTasks(prev => ({
      ...prev,
      [section]: prev[section].filter(t => t.id !== id),
      completed: [updated, ...prev.completed],
    }));
    sync("saving");
    try { await fbSaveTask(updated); sync("saved"); } catch { sync("error"); }
  };

  const deleteTask = async (section, id) => {
    setAllTasks(prev => ({ ...prev, [section]: prev[section].filter(t => t.id !== id) }));
    sync("saving");
    try { await fbDeleteTask(id); sync("saved"); } catch { sync("error"); }
  };

  const reorderTask = async (section, idx, dir) => {
    const arr = [...allTasks[section]];
    const ni = idx + dir;
    if (ni < 0 || ni >= arr.length) return;
    [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
    const reordered = arr.map((t, i) => ({ ...t, order:i }));
    setAllTasks(prev => ({ ...prev, [section]: reordered }));
    sync("saving");
    try { await fbSaveTasksBatch(reordered); sync("saved"); } catch { sync("error"); }
  };

  const restoreTask = async (id) => {
    const task = allTasks.completed.find(t => t.id === id);
    if (!task) return;
    const { completedFrom, ...rest } = task;
    const dest = SECTIONS.find(s => s.key === completedFrom) ? completedFrom : "normal";
    const restored = { ...rest, done:false, section:dest, order:allTasks[dest].length };
    setAllTasks(prev => ({
      ...prev,
      completed: prev.completed.filter(t => t.id !== id),
      [dest]: [...prev[dest], restored],
    }));
    sync("saving");
    try { await fbSaveTask(restored); sync("saved"); } catch { sync("error"); }
  };

  const clearCompleted = async () => {
    const ids = allTasks.completed.map(t => t.id);
    setAllTasks(prev => ({ ...prev, completed:[] }));
    sync("saving");
    try { await Promise.all(ids.map(fbDeleteTask)); sync("saved"); } catch { sync("error"); }
  };

  const total = ["today","normal","later"].flatMap(k => allTasks[k]).length;

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
      <div style={{ marginBottom:"1.25rem" }}>
        <p style={{ margin:0, fontSize:24, fontWeight:600, color:"#F0F0F0" }}>
          タスク管理 <span style={{ fontSize:16, fontWeight:400, color:"#555" }}>/ Task Manager</span>
          <SyncBadge status={syncStatus} />
        </p>
        <p style={{ margin:"4px 0 0", fontSize:15, color:"#666" }}>{total} active · {allTasks.completed.length} completed</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap:"1rem" }}>
        {SECTIONS.map(s => (
          <Section key={s.key} meta={s} tasks={allTasks[s.key]}
            onAdd={addTask}
            onComplete={(id) => completeTask(s.key, id)}
            onDelete={(id) => deleteTask(s.key, id)}
            onReorder={reorderTask} />
        ))}
      </div>

      <CompletedSection tasks={allTasks.completed} onRestore={restoreTask} onClearAll={clearCompleted} />
    </div>
  );
}
