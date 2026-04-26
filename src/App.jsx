import { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import {
  Search, Plus, MapPin, Clock, X, Check, AlertCircle, Settings,
  Inbox, CheckCircle2, Circle, RefreshCw, MoreHorizontal,
  Wifi, Signal, Battery, Loader2, ChevronDown, Phone, MessageCircle, Tag,
} from "lucide-react";

// ---------- Environment-configured URLs (set in Vercel dashboard) ----------
const ENV_CSV_URL = import.meta.env.VITE_CSV_URL || "";
const ENV_WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL || "";

// ---------- CONFIG ----------
const STATUSES = {
  Pending: { label: "Pending", color: "#B45309", bg: "#FEF3C7" },
  "In Progress": { label: "In progress", color: "#1D4ED8", bg: "#DBEAFE" },
  Done: { label: "Done", color: "#15803D", bg: "#DCFCE7" },
};
const STATUS_KEYS = Object.keys(STATUSES);
const DONE_STATUS = "Done";

// Avatar color palette — deterministic per name
const AVATAR_PALETTE = ["#0F4C5C", "#7C2D12", "#374151", "#5B21B6", "#9F1239", "#065F46", "#9A3412", "#1E3A8A"];

const SEED_TASKS = [
  {
    id: "DEMO-001",
    title: "Connecting to your sheet...",
    property: "Demo Property",
    category: "Setup",
    assignee: "Thando",
    phone: "",
    status: "Pending",
    dueDate: new Date().toISOString().slice(0, 10),
  },
];

// ---------- Helpers ----------
const fmtDue = (val) => {
  if (!val) return { text: "—" };
  const d = new Date(val);
  if (isNaN(d)) return { text: String(val) };
  const now = new Date();
  const diff = (d - now) / (1000 * 60 * 60);
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (diff < 0) return { text: `Overdue · ${day}`, overdue: true };
  if (diff < 24) return { text: `Due soon · ${day}`, urgent: true };
  if (diff < 48) return { text: `Tomorrow · ${day}` };
  return { text: day };
};

const timeAgo = (iso) => {
  const mins = Math.floor((new Date() - new Date(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, [key, state]);
  return [state, setState];
}

const rowToTask = (row) => ({
  id: row["Task ID"] || "",
  title: row["Task Description"] || "",
  property: row["Property"] || "",
  category: row["Category"] || "",
  assignee: row["Assigned To"] || "Unassigned",
  phone: row["Phone Number"] || "",
  status: STATUS_KEYS.includes(row["Status"]) ? row["Status"] : "Pending",
  dueDate: row["Due Date"] || "",
});

const nextIdFor = (property, tasks) => {
  const prefix = (property || "TASK").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "TASK";
  const nums = tasks
    .filter((t) => t.id && t.id.startsWith(prefix + "-"))
    .map((t) => parseInt(t.id.split("-")[1], 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
};

// Look up an existing phone number for a given assignee from past tasks
const phoneFor = (assignee, tasks) => {
  if (!assignee || assignee === "Unassigned") return "";
  const match = tasks.find((t) => t.assignee === assignee && t.phone);
  return match ? match.phone : "";
};

// ---------- Main ----------
export default function App() {
  const [tasks, setTasks] = usePersistedState("ops.tasks", SEED_TASKS);
  const [csvOverride, setCsvOverride] = usePersistedState("ops.csvUrl", "");
  const [webhookOverride, setWebhookOverride] = usePersistedState("ops.webhookUrl", "");

  const csvUrl = ENV_CSV_URL || csvOverride;
  const webhookUrl = ENV_WEBHOOK_URL || webhookOverride;

  const [activeStatus, setActiveStatus] = useState("all");
  const [activeProperty, setActiveProperty] = useState("All properties");
  const [search, setSearch] = useState("");
  const [openTask, setOpenTask] = useState(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = usePersistedState("ops.lastSync", new Date().toISOString());
  const [syncError, setSyncError] = useState("");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (csvUrl) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const propertyOptions = useMemo(() => {
    const set = new Set(tasks.map((t) => t.property).filter(Boolean));
    return ["All properties", ...Array.from(set).sort()];
  }, [tasks]);

  const categoryOptions = useMemo(() => {
    const set = new Set(tasks.map((t) => t.category).filter(Boolean));
    return Array.from(set).sort();
  }, [tasks]);

  const teamOptions = useMemo(() => {
    const set = new Set(tasks.map((t) => t.assignee).filter(Boolean));
    set.delete("Unassigned");
    return ["Unassigned", ...Array.from(set).sort()];
  }, [tasks]);

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => activeStatus === "all" || t.status === activeStatus)
      .filter((t) => activeProperty === "All properties" || t.property === activeProperty)
      .filter((t) =>
        search.trim() === ""
          ? true
          : (t.title + t.property + t.category + t.assignee).toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        const aDone = a.status === DONE_STATUS;
        const bDone = b.status === DONE_STATUS;
        if (aDone && !bDone) return 1;
        if (bDone && !aDone) return -1;
        return new Date(a.dueDate || "9999-12-31") - new Date(b.dueDate || "9999-12-31");
      });
  }, [tasks, activeStatus, activeProperty, search]);

  const counts = useMemo(() => {
    const props = activeProperty === "All properties" ? tasks : tasks.filter((t) => t.property === activeProperty);
    const c = { all: props.length };
    STATUS_KEYS.forEach((k) => { c[k] = props.filter((t) => t.status === k).length; });
    return c;
  }, [tasks, activeProperty]);

  const pushChange = (payload) => {
    if (!webhookUrl) return;
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  };

  const updateTask = (id, patch) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setOpenTask((cur) => (cur && cur.id === id ? { ...cur, ...patch } : cur));
    pushChange({ action: "update", id, patch });
  };

  const addTask = (data) => {
    const id = data.id || nextIdFor(data.property, tasks);
    const t = { id, ...data };
    setTasks((prev) => [t, ...prev]);
    pushChange({ action: "create", task: t });
  };

  const refresh = async () => {
    setSyncError("");
    setSyncing(true);
    if (!csvUrl) {
      await new Promise((r) => setTimeout(r, 400));
      setLastSync(new Date().toISOString());
      setSyncing(false);
      return;
    }
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const fetched = parsed.data.map(rowToTask).filter((t) => t.id);
      if (fetched.length > 0) setTasks(fetched);
      setLastSync(new Date().toISOString());
    } catch (e) {
      setSyncError(e.message || "Fetch failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-0 sm:p-6"
      style={{ background: "radial-gradient(ellipse at top, #E8DFD0 0%, #D4C7B0 50%, #B8A88A 100%)" }}
    >
      <style>{`
        .font-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { scrollbar-width: none; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .sheet-anim { animation: slideUp 280ms cubic-bezier(0.32, 0.72, 0, 1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .fade-anim { animation: fadeIn 200ms ease-out; }
      `}</style>

      <div
        className="relative w-full sm:w-96 bg-white sm:rounded-3xl overflow-hidden shadow-2xl"
        style={{
          height: "100vh", maxHeight: "844px", minHeight: "640px",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex items-center justify-between px-6 pt-3 pb-1 text-xs font-semibold" style={{ color: "#0F0F0F" }}>
          <span>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
          <div className="flex items-center gap-1"><Signal size={12} /><Wifi size={12} /><Battery size={14} /></div>
        </div>

        <div className="px-6 pt-3 pb-4" style={{ background: "#FAF6EE" }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs uppercase" style={{ color: "#8A7A5C", letterSpacing: "0.15em" }}>Operations</p>
              <h1 className="font-display text-3xl leading-none mt-1" style={{ color: "#0F0F0F", fontWeight: 500 }}>Today</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={refresh} className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95" style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)" }}>
                {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              </button>
              <button onClick={() => setSettingsOpen(true)} className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95" style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)" }}>
                <Settings size={15} />
              </button>
            </div>
          </div>

          <PropertyDropdown value={activeProperty} onChange={setActiveProperty} options={propertyOptions} />

          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
            <Search size={15} style={{ color: "#8A7A5C" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks, locations..." className="flex-1 bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
            {search && <button onClick={() => setSearch("")}><X size={14} style={{ color: "#8A7A5C" }} /></button>}
          </div>
        </div>

        <div className="px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide" style={{ background: "#FAF6EE", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          {[{ key: "all", label: "All" }, ...STATUS_KEYS.map((k) => ({ key: k, label: STATUSES[k].label }))].map((p) => (
            <button key={p.key} onClick={() => setActiveStatus(p.key)} className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all active:scale-95" style={{ background: activeStatus === p.key ? "#0F0F0F" : "white", color: activeStatus === p.key ? "white" : "#0F0F0F", border: "1px solid rgba(0,0,0,0.08)" }}>
              {p.label}
              <span className="px-1.5 rounded-full" style={{ fontSize: "10px", background: activeStatus === p.key ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.05)" }}>{counts[p.key] ?? 0}</span>
            </button>
          ))}
        </div>

        {syncError && (
          <div className="px-5 py-2 text-xs flex items-center gap-2" style={{ background: "#FEE2E2", color: "#991B1B" }}>
            <AlertCircle size={12} />Sync failed: {syncError}
          </div>
        )}

        <div className="overflow-y-auto scrollbar-hide" style={{ height: `calc(100% - ${syncError ? 312 : 280}px)`, background: "#FAF6EE" }}>
          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-xs" style={{ color: "#8A7A5C" }}>
              {filtered.length} {filtered.length === 1 ? "task" : "tasks"} · synced {timeAgo(lastSync)}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                <Inbox size={22} style={{ color: "#8A7A5C" }} />
              </div>
              <p className="font-display text-lg" style={{ color: "#0F0F0F" }}>All clear</p>
              <p className="text-sm mt-1" style={{ color: "#8A7A5C" }}>No tasks match these filters.</p>
            </div>
          ) : (
            <div className="px-4 pb-32 space-y-2">
              {filtered.map((t) => (
                <TaskCard key={t.id} task={t} onClick={() => setOpenTask(t)} onToggle={() => updateTask(t.id, { status: t.status === DONE_STATUS ? "Pending" : DONE_STATUS })} />
              ))}
            </div>
          )}
        </div>

        <button onClick={() => setNewTaskOpen(true)} className="absolute bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95" style={{ background: "#0F0F0F", color: "white", boxShadow: "0 10px 30px -5px rgba(0,0,0,0.4)" }}>
          <Plus size={22} strokeWidth={2.5} />
        </button>

        {openTask && (
          <TaskDetailSheet
            task={openTask}
            team={teamOptions}
            onClose={() => setOpenTask(null)}
            onUpdate={(patch) => updateTask(openTask.id, patch)}
            tasks={tasks}
          />
        )}
        {newTaskOpen && (
          <NewTaskSheet
            propertyOptions={propertyOptions.filter((p) => p !== "All properties")}
            categoryOptions={categoryOptions}
            team={teamOptions}
            tasks={tasks}
            onClose={() => setNewTaskOpen(false)}
            onCreate={(data) => { addTask(data); setNewTaskOpen(false); }}
          />
        )}
        {settingsOpen && (
          <SettingsSheet
            envCsvUrl={ENV_CSV_URL}
            envWebhookUrl={ENV_WEBHOOK_URL}
            csvOverride={csvOverride}
            webhookOverride={webhookOverride}
            onSave={(c, w) => { setCsvOverride(c); setWebhookOverride(w); setSettingsOpen(false); if (csvUrl) refresh(); }}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// ---------- Task card ----------
function TaskCard({ task, onClick, onToggle }) {
  const due = fmtDue(task.dueDate);
  const status = STATUSES[task.status] || STATUSES.Pending;
  const done = task.status === DONE_STATUS;

  return (
    <div onClick={onClick} className="rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.99]" style={{ background: "white", border: "1px solid rgba(0,0,0,0.05)", opacity: done ? 0.6 : 1 }}>
      <div className="flex items-start gap-3">
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="mt-0.5 transition-transform active:scale-90">
          {done ? <CheckCircle2 size={20} style={{ color: "#15803D" }} /> : <Circle size={20} style={{ color: "#D4C7B0" }} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-1.5 py-0.5 rounded-md font-semibold uppercase" style={{ fontSize: "10px", background: status.bg, color: status.color, letterSpacing: "0.05em" }}>{status.label}</span>
            {task.category && <span className="text-xs" style={{ color: "#8A7A5C" }}>{task.category}</span>}
          </div>
          <h3 className="font-display text-base leading-snug" style={{ color: "#0F0F0F", fontWeight: 500, textDecoration: done ? "line-through" : "none" }}>{task.title}</h3>
          <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "#8A7A5C" }}>
            <span className="flex items-center gap-1 truncate"><MapPin size={11} /><span className="truncate">{task.property}</span></span>
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-2">
              <Avatar name={task.assignee} size={20} />
              <span className="text-xs font-medium" style={{ color: "#0F0F0F" }}>{task.assignee}</span>
            </div>
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: due.overdue ? "#B91C1C" : due.urgent ? "#C2410C" : "#8A7A5C" }}>
              <Clock size={11} />{due.text}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, size = 24 }) {
  const isUnassigned = !name || name === "Unassigned";
  const initials = isUnassigned ? "?" : name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  let bg = "#E8DFD0";
  if (!isUnassigned) {
    const sum = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
    bg = AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
  }
  return (
    <div className="rounded-full flex items-center justify-center font-semibold" style={{ width: size, height: size, background: bg, color: isUnassigned ? "#8A7A5C" : "white", fontSize: size * 0.42 }}>
      {initials}
    </div>
  );
}

function PropertyDropdown({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)", color: "#0F0F0F" }}>
        <span className="flex items-center gap-2 truncate"><MapPin size={14} style={{ color: "#8A7A5C" }} /><span className="truncate">{value}</span></span>
        <ChevronDown size={14} style={{ color: "#8A7A5C", transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
      </button>
      {open && (
        <div className="absolute top-full mt-2 left-0 right-0 rounded-xl overflow-hidden z-20 fade-anim max-h-72 overflow-y-auto" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 12px 30px -10px rgba(0,0,0,0.2)" }}>
          {options.map((p) => (
            <button key={p} onClick={() => { onChange(p); setOpen(false); }} className="w-full px-3 py-2.5 text-left text-sm flex items-center justify-between" style={{ color: "#0F0F0F", background: value === p ? "#FAF6EE" : "white" }}>
              <span className="truncate">{p}</span>
              {value === p && <Check size={14} style={{ color: "#0F0F0F" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AssigneeDropdown({ value, onChange, options, allowCustom }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const commitCustom = () => {
    if (custom.trim()) {
      onChange(custom.trim());
      setCustom("");
      setShowCustom(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
        style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)", color: "#0F0F0F" }}
      >
        <span className="flex items-center gap-2 truncate">
          <Avatar name={value} size={20} />
          <span className="truncate">{value || "Select..."}</span>
        </span>
        <ChevronDown size={14} style={{ color: "#8A7A5C", transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
      </button>
      {open && (
        <div
          className="absolute top-full mt-2 left-0 right-0 rounded-xl overflow-hidden z-30 fade-anim max-h-72 overflow-y-auto"
          style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 12px 30px -10px rgba(0,0,0,0.2)" }}
        >
          {options.map((p) => (
            <button
              key={p}
              onClick={() => { onChange(p); setOpen(false); setShowCustom(false); }}
              className="w-full px-3 py-2.5 text-left text-sm flex items-center justify-between hover:bg-stone-50"
              style={{ color: "#0F0F0F", background: value === p ? "#FAF6EE" : "white" }}
            >
              <span className="flex items-center gap-2 truncate">
                <Avatar name={p} size={20} />
                <span className="truncate">{p}</span>
              </span>
              {value === p && <Check size={14} style={{ color: "#0F0F0F" }} />}
            </button>
          ))}
          {allowCustom && !showCustom && (
            <button
              onClick={() => setShowCustom(true)}
              className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-2"
              style={{ color: "#8A7A5C", borderTop: "1px solid rgba(0,0,0,0.05)" }}
            >
              <Plus size={14} />
              Add new person...
            </button>
          )}
          {allowCustom && showCustom && (
            <div className="px-3 py-2.5 flex gap-2" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
              <input
                autoFocus
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commitCustom()}
                placeholder="Type a name..."
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "#0F0F0F" }}
              />
              <button
                onClick={commitCustom}
                className="text-xs font-semibold px-2 py-1 rounded-md"
                style={{ background: "#0F0F0F", color: "white" }}
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskDetailSheet({ task, team, tasks, onClose, onUpdate }) {
  const due = fmtDue(task.dueDate);
  const status = STATUSES[task.status] || STATUSES.Pending;
  const waLink = task.phone ? `https://wa.me/${task.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hi ${task.assignee}, regarding ${task.id}: ${task.title}`)}` : null;
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [tempDueDate, setTempDueDate] = useState(task.dueDate);

  // When the assignee changes, also patch the phone if we know one for them
  const handleAssigneeChange = (name) => {
    const knownPhone = phoneFor(name, tasks);
    const patch = { assignee: name };
    if (knownPhone && !task.phone) patch.phone = knownPhone;
    if (knownPhone && task.phone && task.assignee !== name) patch.phone = knownPhone;
    onUpdate(patch);
  };

  const handleDueDateSave = () => {
    if (tempDueDate !== task.dueDate) {
      onUpdate({ dueDate: tempDueDate });
    }
    setEditingDueDate(false);
  };

  return (
    <div className="absolute inset-0 z-30 fade-anim" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col sheet-anim" style={{ background: "#FAF6EE", maxHeight: "92%", height: "92%" }} onClick={(e) => e.stopPropagation()}>
        <div className="pt-2 pb-1 flex justify-center"><div className="w-10 h-1 rounded-full" style={{ background: "rgba(0,0,0,0.15)" }} /></div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}><X size={16} /></button>
          <span className="text-xs font-mono" style={{ color: "#8A7A5C" }}>{task.id}</span>
          <button className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}><MoreHorizontal size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 scrollbar-hide pb-6">
          <div className="flex gap-2 mb-3 flex-wrap">
            <span className="px-2 py-1 rounded-md font-semibold uppercase" style={{ fontSize: "10px", background: status.bg, color: status.color, letterSpacing: "0.05em" }}>{status.label}</span>
            {task.category && <span className="px-2 py-1 rounded-md font-semibold uppercase flex items-center gap-1" style={{ fontSize: "10px", background: "white", color: "#374151", border: "1px solid rgba(0,0,0,0.08)", letterSpacing: "0.05em" }}><Tag size={10} />{task.category}</span>}
          </div>
          <h2 className="font-display text-2xl leading-tight mb-4" style={{ color: "#0F0F0F", fontWeight: 500 }}>{task.title}</h2>
          <div className="rounded-2xl mb-4" style={{ background: "white", border: "1px solid rgba(0,0,0,0.05)" }}>
            <DetailRow icon={<MapPin size={14} />} label="Property"><div className="text-sm font-semibold" style={{ color: "#0F0F0F" }}>{task.property || "—"}</div></DetailRow>
            <DetailRow icon={<Clock size={14} />} label="Due" border interactive onClick={() => setEditingDueDate(true)}>
              {editingDueDate ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={tempDueDate}
                    onChange={(e) => setTempDueDate(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm font-semibold"
                    style={{ color: "#0F0F0F" }}
                    autoFocus
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDueDateSave(); }}
                    className="px-2 py-1 rounded-lg text-xs font-semibold transition active:scale-95"
                    style={{ background: "#0F0F0F", color: "white" }}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="text-sm font-semibold cursor-pointer" style={{ color: due.overdue ? "#B91C1C" : "#0F0F0F" }}>{due.text}</div>
              )}
            </DetailRow>
            {task.phone && (
              <DetailRow icon={<Phone size={14} />} label="Phone" border>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#0F0F0F" }}>{task.phone}</span>
                  {waLink && <a href={waLink} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95" style={{ background: "#25D366", color: "white" }}><MessageCircle size={11} />WhatsApp</a>}
                </div>
              </DetailRow>
            )}
          </div>
          <div className="mb-4">
            <p className="uppercase mb-2" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Assigned to</p>
            <AssigneeDropdown
              value={task.assignee}
              onChange={handleAssigneeChange}
              options={team}
              allowCustom={true}
            />
          </div>
          <div className="mb-2">
            <p className="uppercase mb-2" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Status</p>
            <div className="flex gap-2">
              {STATUS_KEYS.map((key) => {
                const s = STATUSES[key];
                return (
                  <button key={key} onClick={() => onUpdate({ status: key })} className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition active:scale-95" style={{ background: task.status === key ? s.color : "white", color: task.status === key ? "white" : s.color, border: `1px solid ${task.status === key ? s.color : "rgba(0,0,0,0.06)"}` }}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, children, border, interactive, onClick }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${interactive ? "cursor-pointer hover:bg-gray-50" : ""}`}
      style={{ borderTop: border ? "1px solid rgba(0,0,0,0.05)" : "none" }}
      onClick={interactive ? onClick : undefined}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FAF6EE", color: "#8A7A5C" }}>{icon}</div>
      <div className="flex-1">
        <div className="uppercase" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>{label}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function NewTaskSheet({ propertyOptions, categoryOptions, team, tasks, onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [property, setProperty] = useState(propertyOptions[0] || "");
  const [category, setCategory] = useState(categoryOptions[0] || "");
  const [customCategory, setCustomCategory] = useState("");
  const [assignee, setAssignee] = useState(team[0] || "Unassigned");
  const [phone, setPhone] = useState(() => phoneFor(team[0] || "", tasks));
  const [phoneEdited, setPhoneEdited] = useState(false);
  const [dueDate, setDueDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 2); return d.toISOString().slice(0, 10); });

  const valid = title.trim() && property;
  const previewId = property ? nextIdFor(property, tasks) : "—";

  const handleAssigneeChange = (name) => {
    setAssignee(name);
    if (!phoneEdited) {
      setPhone(phoneFor(name, tasks));
    }
  };

  const submit = () => {
    if (!valid) return;
    onCreate({
      title: title.trim(),
      property,
      category: customCategory.trim() || category,
      assignee,
      phone: phone.trim(),
      status: "Pending",
      dueDate,
    });
  };

  return (
    <div className="absolute inset-0 z-30 fade-anim" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col sheet-anim" style={{ background: "#FAF6EE", maxHeight: "92%", height: "92%" }} onClick={(e) => e.stopPropagation()}>
        <div className="pt-2 pb-1 flex justify-center"><div className="w-10 h-1 rounded-full" style={{ background: "rgba(0,0,0,0.15)" }} /></div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <button onClick={onClose} className="text-sm font-semibold" style={{ color: "#8A7A5C" }}>Cancel</button>
          <span className="font-display text-base font-semibold" style={{ color: "#0F0F0F" }}>New task</span>
          <button onClick={submit} disabled={!valid} className="text-sm font-semibold" style={{ color: valid ? "#0F0F0F" : "#D4C7B0" }}>Create</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 scrollbar-hide pb-6">
          <p className="text-xs mb-2" style={{ color: "#8A7A5C" }}>ID will be: <span className="font-mono font-semibold" style={{ color: "#0F0F0F" }}>{previewId}</span></p>
          <textarea value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Describe the task..." rows={3} className="w-full bg-transparent outline-none font-display text-xl mb-4 resize-none" style={{ color: "#0F0F0F", fontWeight: 500 }} />
          <FieldGroup label="Property">
            <select value={property} onChange={(e) => setProperty(e.target.value)} className="w-full bg-transparent outline-none text-sm font-medium" style={{ color: "#0F0F0F" }}>
              {propertyOptions.length === 0 && <option value="">—</option>}
              {propertyOptions.map((p) => <option key={p}>{p}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Category">
            {categoryOptions.length > 0 && (
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-transparent outline-none text-sm font-medium mb-2" style={{ color: "#0F0F0F" }}>
                {categoryOptions.map((c) => <option key={c}>{c}</option>)}
              </select>
            )}
            <input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Or type a new category..." className="w-full bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
          </FieldGroup>
          <p className="uppercase mb-2 mt-4" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Assign to</p>
          <AssigneeDropdown
            value={assignee}
            onChange={handleAssigneeChange}
            options={team}
            allowCustom={true}
          />
          <div className="mt-4" />
          <FieldGroup label="Phone (for WhatsApp)">
            <input
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneEdited(true); }}
              placeholder="Auto-filled from assignee"
              inputMode="tel"
              className="w-full bg-transparent outline-none text-sm font-medium"
              style={{ color: "#0F0F0F" }}
            />
          </FieldGroup>
          <FieldGroup label="Due date">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-transparent outline-none text-sm font-medium" style={{ color: "#0F0F0F" }} />
          </FieldGroup>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }) {
  return (
    <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="uppercase mb-1" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>{label}</div>
      {children}
    </div>
  );
}

function SettingsSheet({ envCsvUrl, envWebhookUrl, csvOverride, webhookOverride, onSave, onClose }) {
  const [c, setC] = useState(csvOverride);
  const [w, setW] = useState(webhookOverride);
  const csvManaged = !!envCsvUrl;
  const webhookManaged = !!envWebhookUrl;

  return (
    <div className="absolute inset-0 z-30 fade-anim" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col sheet-anim" style={{ background: "#FAF6EE", maxHeight: "85%" }} onClick={(e) => e.stopPropagation()}>
        <div className="pt-2 pb-1 flex justify-center"><div className="w-10 h-1 rounded-full" style={{ background: "rgba(0,0,0,0.15)" }} /></div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <button onClick={onClose} className="text-sm font-semibold" style={{ color: "#8A7A5C" }}>Cancel</button>
          <span className="font-display text-base font-semibold" style={{ color: "#0F0F0F" }}>Connections</span>
          <button onClick={() => onSave(c, w)} className="text-sm font-semibold" style={{ color: "#0F0F0F" }}>Save</button>
        </div>
        <div className="px-5 pb-6 overflow-y-auto scrollbar-hide">
          {csvManaged && webhookManaged ? (
            <div className="rounded-xl px-4 py-3 mb-4" style={{ background: "rgba(21,128,61,0.08)", border: "1px solid rgba(21,128,61,0.2)" }}>
              <div className="flex items-start gap-2">
                <Check size={14} style={{ color: "#15803D", flexShrink: 0, marginTop: 2 }} />
                <div className="text-xs leading-relaxed" style={{ color: "#15803D" }}>Connections managed by deployment. No setup needed on this device.</div>
              </div>
            </div>
          ) : (
            <p className="text-sm mb-4" style={{ color: "#3F3A2E" }}>Connect your Google Sheet and n8n webhook.</p>
          )}
          <UrlField label="Published CSV URL (read)" value={csvManaged ? "Configured via Vercel" : c} onChange={setC} disabled={csvManaged} />
          <UrlField label="n8n webhook URL (write)" value={webhookManaged ? "Configured via Vercel" : w} onChange={setW} disabled={webhookManaged} />
          {(csvManaged || webhookManaged) && <p className="text-xs mt-3" style={{ color: "#8A7A5C" }}>To change managed URLs, update environment variables in your Vercel project settings.</p>}
        </div>
      </div>
    </div>
  );
}

function UrlField({ label, value, onChange, disabled }) {
  return (
    <div className="rounded-xl px-4 py-3 mb-3" style={{ background: disabled ? "#F0EBE0" : "white", border: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="uppercase mb-1" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>{label}</div>
      <input value={value} onChange={(e) => !disabled && onChange(e.target.value)} disabled={disabled} placeholder={disabled ? "" : "Paste URL..."} className="w-full bg-transparent outline-none text-sm" style={{ color: disabled ? "#8A7A5C" : "#0F0F0F" }} />
    </div>
  );
}
