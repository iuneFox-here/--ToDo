import React, { useState, useEffect, useMemo } from "react";
import { db } from "./firebase";
import {
  collection, doc, setDoc, deleteDoc, getDocs, writeBatch
} from "firebase/firestore";

const genId = () => Math.random().toString(36).slice(2, 9);

const SECTIONS = [
  { key: "today", label: "🔥 Must Do Today", short: "🔥 Today", jp: "今日やる", color: "#FF6B6B", bg: "#2A1A1A" },
  { key: "normal", label: "📋 Normal", short: "📋 Normal", jp: "普通", color: "#A0C4FF", bg: "#1A2233" },
  { key: "later", label: "🕐 Do Later", short: "🕐 Later", jp: "後で", color: "#B5EAD7", bg: "#1A2E24" },
];
const SECTION_BY_KEY = Object.fromEntries(SECTIONS.map(s => [s.key, s]));

// ── Date helpers ──
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"]; // Sunday first
const pad = (n) => String(n).padStart(2, "0");
const dateKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayKey = () => {
  const n = new Date();
  return dateKey(n.getFullYear(), n.getMonth(), n.getDate());
};
const parseKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m: m - 1, d };
};
const weekdayOf = (key) => {
  const { y, m, d } = parseKey(key);
  return new Date(y, m, d).getDay();
};
const validDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
const timeOf = (v) => (validDate(v) && v.length >= 16 ? v.slice(11, 16) : "");
const fmtWhen = (v) => {
  if (!v) return "";
  if (!validDate(v)) return v;
  const date = v.slice(0, 10);
  const { m, d } = parseKey(date);
  const t = timeOf(v);
  return `${m + 1}/${d}(${WEEKDAYS[weekdayOf(date)]})${t ? " " + t : ""}`;
};

// ── Styles ──
const S = {
  app: { minHeight:"100vh", background:"#111", color:"#E0E0E0", fontFamily:"system-ui, sans-serif", padding:"1rem", boxSizing:"border-box" },
  card: (bg) => ({ background:bg||"#1A1A1A", border:"1px solid #2A2A2A", borderRadius:14, padding:"1rem 1.25rem", display:"flex", flexDirection:"column", gap:12, minWidth:0 }),
  input: { fontSize:16, padding:"11px 14px", background:"#222", border:"1px solid #3A3A3A", borderRadius:10, color:"#F0F0F0", outline:"none", boxSizing:"border-box", width:"100%" },
  btn: (color, full) => ({ padding:"11px 18px", fontSize:15, fontWeight:500, cursor:"pointer", border:`1px solid ${color||"#555"}`, borderRadius:10, background:"transparent", color:color||"#CCC", whiteSpace:"nowrap", width:full?"100%":undefined }),
  smBtn: (color) => ({ fontSize:13, padding:"5px 10px", cursor:"pointer", border:`1px solid ${color||"#3A3A3A"}`, borderRadius:8, background:"transparent", color:color||"#AAA", whiteSpace:"nowrap" }),
  dtInput: { fontSize:15, padding:"11px 12px", background:"#222", border:"1px solid #3A3A3A", borderRadius:10, color:"#CCC", outline:"none", width:"100%", boxSizing:"border-box", colorScheme:"dark" },
  select: { fontSize:15, padding:"10px 8px", background:"#222", border:"1px solid #3A3A3A", borderRadius:10, color:"#CCC", outline:"none", flex:1, minWidth:0, colorScheme:"dark" },
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

// ── Small components ──
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

// Date + 24-hour time picker. Value: "" | "YYYY-MM-DD" | "YYYY-MM-DDTHH:mm"
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

function DateTimeField({ value, onChange }) {
  const date = validDate(value) ? value.slice(0, 10) : "";
  const t = timeOf(value);
  const hh = t ? t.slice(0, 2) : "";
  const mm = t ? t.slice(3, 5) : "";
  const minuteOptions = mm && !MINUTES.includes(mm) ? [...MINUTES, mm].sort() : MINUTES;

  const build = (d, h, m) => {
    if (!d) return "";
    if (!h) return d;
    return `${d}T${h}:${m || "00"}`;
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <input type="date" value={date} onChange={e => onChange(build(e.target.value, hh, mm))} style={S.dtInput} />
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <select value={hh} disabled={!date} onChange={e => onChange(build(date, e.target.value, mm))} style={S.select}>
          <option value="">-- (no time)</option>
          {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <span style={{ color:"#888" }}>:</span>
        <select value={mm} disabled={!date || !hh} onChange={e => onChange(build(date, hh, e.target.value))} style={S.select}>
          {!hh && <option value="">--</option>}
          {minuteOptions.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}

// ── Calendar ──
function Calendar({ tasksByDate, viewYM, setViewYM, selected, setSelected }) {
  const { y, m } = viewYM;
  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const today = todayKey();

  const go = (delta) => {
    const d = new Date(y, m + delta, 1);
    setViewYM({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goToday = () => {
    const n = new Date();
    setViewYM({ y: n.getFullYear(), m: n.getMonth() });
    setSelected(today);
  };

  return (
    <div style={S.card()}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:19, fontWeight:600, color:"#F0F0F0" }}>📅 {y}年{m + 1}月</span>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={goToday} style={S.smBtn("#FFD6A5")}>Today</button>
          <button onClick={() => go(-1)} style={{ ...S.smBtn(), padding:"5px 14px" }} aria-label="Previous month">◀</button>
          <button onClick={() => go(1)} style={{ ...S.smBtn(), padding:"5px 14px" }} aria-label="Next month">▶</button>
        </div>
      </div>

      {/* Weekday row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7, minmax(0, 1fr))", gap:4 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} style={{ textAlign:"center", fontSize:12, color: i===0 ? "#FF8A8A" : i===6 ? "#8AB4FF" : "#777" }}>{w}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7, minmax(0, 1fr))", gap:4 }}>
        {cells.map((d, idx) => {
          if (d === null) return <div key={`e${idx}`} />;
          const key = dateKey(y, m, d);
          const items = tasksByDate[key] || [];
          const isToday = key === today;
          const isSel = key === selected;
          const numColor = idx % 7 === 0 ? "#FF8A8A" : idx % 7 === 6 ? "#8AB4FF" : "#E0E0E0";
          return (
            <button key={key} onClick={() => setSelected(key)}
              style={{
                minHeight:48, minWidth:0, padding:"4px 2px", cursor:"pointer",
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4,
                background: isSel ? "#2C3A55" : "#1E1E1E",
                border: isToday ? "1.5px solid #FFD6A5" : isSel ? "1px solid #4A6A9A" : "1px solid #262626",
                borderRadius:10, color:numColor, fontSize:15, fontWeight: isToday ? 700 : 400,
              }}>
              <span>{d}</span>
              <span style={{ display:"flex", gap:2, height:6, alignItems:"center" }}>
                {items.slice(0, 3).map((it, i) => (
                  <span key={i} style={{ width:5, height:5, borderRadius:"50%", background: SECTION_BY_KEY[it.section]?.color || "#888" }} />
                ))}
                {items.length > 3 && <span style={{ fontSize:9, color:"#888", lineHeight:1 }}>+</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontSize:12, color:"#666" }}>
        {SECTIONS.map(s => (
          <span key={s.key}><span style={{ color:s.color }}>●</span> {s.short}</span>
        ))}
      </div>
    </div>
  );
}

function DayPanel({ selected, items }) {
  const { m, d } = parseKey(selected);
  const sorted = [...items].sort((a, b) => timeOf(a.task.reminder).localeCompare(timeOf(b.task.reminder)));
  return (
    <div style={S.card("#1A1F2B")}>
      <div>
        <span style={{ fontSize:17, fontWeight:600, color:"#F0F0F0" }}>
          {m + 1}月{d}日({WEEKDAYS[weekdayOf(selected)]})
        </span>
        <span style={{ fontSize:13, color:"#666", marginLeft:8 }}>{items.length} item{items.length === 1 ? "" : "s"}</span>
      </div>
      {sorted.length === 0
        ? <p style={{ margin:0, fontSize:14, color:"#555" }}>Nothing scheduled on this day.</p>
        : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {sorted.map(({ task, section }) => {
              const t = timeOf(task.reminder);
              const sec = SECTION_BY_KEY[section];
              return (
                <div key={task.id} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"8px 10px", background:"#161A24", borderRadius:10, border:"1px solid #252B3A" }}>
                  <span style={{ width:52, flexShrink:0, fontSize:t ? 15 : 12, color:t ? "#FFD6A5" : "#666", fontVariantNumeric:"tabular-nums", paddingTop:t ? 0 : 2 }}>
                    {t || "All day"}
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:15, lineHeight:1.5, color:"#E0E0E0", overflowWrap:"anywhere" }}>{task.text}</p>
                    <span style={{ fontSize:12, color:sec?.color }}>{sec?.short}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}

// ── Task list pieces ──
function TaskItem({ task, section, onComplete, onDelete, onMove, onMoveUp, onMoveDown, onSetDate, isFirst, isLast }) {
  const [panel, setPanel] = useState(null); // null | "date" | "move"
  const [draft, setDraft] = useState(task.reminder || "");

  const toggleDate = () => {
    setDraft(task.reminder || "");
    setPanel(p => (p === "date" ? null : "date"));
  };
  const toggleMove = () => setPanel(p => (p === "move" ? null : "move"));
  const save = () => { onSetDate(task.id, draft); setPanel(null); };
  const clear = () => { onSetDate(task.id, ""); setPanel(null); };

  return (
    <div style={{ background:"#1A1A1A", borderRadius:10, border:"1px solid #2A2A2A", padding:"10px 12px", display:"flex", flexDirection:"column", gap:10 }}>
      {/* Row 1: checkbox + full-width text */}
      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
        <input type="checkbox" checked={false} onChange={() => onComplete(task.id)}
          style={{ marginTop:3, cursor:"pointer", accentColor:"#7CBA5A", width:20, height:20, flexShrink:0 }} />
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ margin:0, fontSize:16, lineHeight:1.5, color:"#E0E0E0", overflowWrap:"anywhere" }}>{task.text}</p>
          {task.reminder && <p style={{ margin:"4px 0 0", fontSize:13, color:"#FFD6A5" }}>📅 {fmtWhen(task.reminder)}</p>}
        </div>
      </div>

      {/* Row 2: reorder + date + move + delete */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
        <button onClick={onMoveUp} disabled={isFirst}
          style={{ ...S.smBtn(isFirst ? "#2A2A2A" : "#3A3A3A"), color:isFirst?"#333":"#AAA", cursor:isFirst?"default":"pointer" }}>▲</button>
        <button onClick={onMoveDown} disabled={isLast}
          style={{ ...S.smBtn(isLast ? "#2A2A2A" : "#3A3A3A"), color:isLast?"#333":"#AAA", cursor:isLast?"default":"pointer" }}>▼</button>
        <button onClick={toggleDate} style={S.smBtn(panel === "date" ? "#FFD6A5" : "#3A3A3A")}>📅 Date</button>
        <button onClick={toggleMove} style={S.smBtn(panel === "move" ? "#A0C4FF" : "#3A3A3A")}>↔ Move</button>
        <button style={{ ...S.smBtn("#A32D2D"), marginLeft:"auto" }} onClick={() => onDelete(task.id)}>Delete</button>
      </div>

      {/* Inline date editor */}
      {panel === "date" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8, paddingTop:8, borderTop:"1px solid #252525" }}>
          <DateTimeField value={draft} onChange={setDraft} />
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={save} style={S.smBtn("#7CBA5A")}>Save</button>
            <button onClick={clear} style={S.smBtn("#A32D2D")}>Clear date</button>
            <button onClick={() => setPanel(null)} style={S.smBtn()}>Cancel</button>
          </div>
        </div>
      )}

      {/* Inline move picker */}
      {panel === "move" && (
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", paddingTop:8, borderTop:"1px solid #252525" }}>
          <span style={{ fontSize:13, color:"#888" }}>Move to:</span>
          {SECTIONS.filter(s => s.key !== section).map(s => (
            <button key={s.key} onClick={() => onMove(task.id, s.key)} style={S.smBtn(s.color)}>{s.short}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ meta, tasks, onAdd, onComplete, onDelete, onMove, onReorder, onSetDate }) {
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
        <DateTimeField value={reminder} onChange={setReminder} />
        <button onClick={add} style={S.btn(meta.color, true)}>+ Add</button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {tasks.length === 0
          ? <p style={{ fontSize:14, color:"#444", textAlign:"center", padding:"1rem 0", margin:0 }}>No tasks here yet!</p>
          : tasks.map((t, i) => (
              <TaskItem key={t.id} task={t} section={meta.key}
                onComplete={onComplete} onDelete={onDelete} onMove={onMove} onSetDate={onSetDate}
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
  const clearAll = () => {
    if (window.confirm("Clear all completed tasks?")) onClearAll();
  };
  return (
    <div style={{ ...S.card(), marginTop:"1rem" }}>
      {/* Header: title on the left, Clear All + hide/show on the right */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <button onClick={() => setOpen(o=>!o)} style={{ background:"none", border:"none", cursor:"pointer", color:"#E0E0E0", padding:0, textAlign:"left", flex:1 }}>
          <span style={{ fontSize:17, fontWeight:600 }}>✅ Completed <span style={{ fontSize:14, fontWeight:400, color:"#555" }}>({tasks.length})</span></span>
        </button>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {tasks.length > 0 && <button onClick={clearAll} style={S.smBtn("#A32D2D")}>Clear All</button>}
          <button onClick={() => setOpen(o=>!o)} style={S.smBtn()}>{open ? "▲ hide" : "▼ show"}</button>
        </div>
      </div>

      {open && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {tasks.length === 0
            ? <p style={{ fontSize:14, color:"#444", textAlign:"center", padding:"0.5rem 0", margin:0 }}>Nothing completed yet!</p>
            : tasks.map(t => (
                <div key={t.id} style={{ display:"flex", flexDirection:"column", gap:8, padding:"10px 12px", background:"#161616", borderRadius:10, border:"1px solid #2A2A2A" }}>
                  <p style={{ margin:0, fontSize:15, color:"#555", textDecoration:"line-through", overflowWrap:"anywhere" }}>{t.text}</p>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                    {t.completedFrom && <span style={{ fontSize:12, color:"#444" }}>from {t.completedFrom}</span>}
                    <button onClick={() => onRestore(t.id)} style={{ ...S.smBtn("#A0C4FF"), marginLeft:"auto" }}>Restore</button>
                  </div>
                </div>
              ))
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

  const [viewYM, setViewYM] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [selected, setSelected] = useState(todayKey());

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

  // Map of "YYYY-MM-DD" -> [{ task, section }] for active tasks that have a date
  const tasksByDate = useMemo(() => {
    const map = {};
    ["today", "normal", "later"].forEach(sec => {
      allTasks[sec].forEach(t => {
        if (!validDate(t.reminder)) return;
        const k = t.reminder.slice(0, 10);
        (map[k] = map[k] || []).push({ task: t, section: sec });
      });
    });
    return map;
  }, [allTasks]);

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

  // Move a task to another list. Its date/time stays, so it keeps showing on the calendar.
  const moveTask = async (taskId, from, to) => {
    const task = allTasks[from].find(t => t.id === taskId);
    if (!task) return;
    const moved = { ...task, section:to, order:allTasks[to].length };
    setAllTasks(prev => ({
      ...prev,
      [from]: prev[from].filter(t => t.id !== taskId),
      [to]: [...prev[to], moved],
    }));
    sync("saving");
    try { await fbSaveTask(moved); sync("saved"); } catch { sync("error"); }
  };

  const setTaskDate = async (section, id, value) => {
    const task = allTasks[section].find(t => t.id === id);
    if (!task) return;
    const updated = { ...task, reminder:value };
    setAllTasks(prev => ({
      ...prev,
      [section]: prev[section].map(t => (t.id === id ? updated : t)),
    }));
    sync("saving");
    try { await fbSaveTask(updated); sync("saved"); } catch { sync("error"); }
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
      <div style={{ marginBottom:"1rem" }}>
        <p style={{ margin:0, fontSize:24, fontWeight:600, color:"#F0F0F0" }}>
          タスク管理 <span style={{ fontSize:16, fontWeight:400, color:"#555" }}>/ Task Manager</span>
          <SyncBadge status={syncStatus} />
        </p>
        <p style={{ margin:"4px 0 0", fontSize:15, color:"#666" }}>{total} active · {allTasks.completed.length} completed</p>
      </div>

      {/* Calendar + selected day */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap:"1rem", marginBottom:"1rem" }}>
        <Calendar tasksByDate={tasksByDate} viewYM={viewYM} setViewYM={setViewYM} selected={selected} setSelected={setSelected} />
        <DayPanel selected={selected} items={tasksByDate[selected] || []} />
      </div>

      {/* Lists */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap:"1rem" }}>
        {SECTIONS.map(s => (
          <Section key={s.key} meta={s} tasks={allTasks[s.key]}
            onAdd={addTask}
            onComplete={(id) => completeTask(s.key, id)}
            onDelete={(id) => deleteTask(s.key, id)}
            onMove={(id, to) => moveTask(id, s.key, to)}
            onSetDate={(id, value) => setTaskDate(s.key, id, value)}
            onReorder={reorderTask} />
        ))}
      </div>

      <CompletedSection tasks={allTasks.completed} onRestore={restoreTask} onClearAll={clearCompleted} />
    </div>
  );
}
