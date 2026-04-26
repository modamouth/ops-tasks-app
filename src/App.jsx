import { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import {
  Search,
  Plus,
  MapPin,
  Clock,
  X,
  Check,
  AlertCircle,
  MessageCircle,
  Send,
  Settings,
  Inbox,
  CheckCircle2,
  Circle,
  Calendar,
  RefreshCw,
  MoreHorizontal,
  Wifi,
  Signal,
  Battery,
  Loader2,
  ChevronDown,
} from "lucide-react";

// ---------- Seed data (used only on first load before CSV connects) ----------
const SEED_TASKS = [
  {
    id: "t-2401",
    title: "AHU failure — Food Court",
    description:
      "Air handling unit serving the food court is making a grinding noise and not cooling. Three tenants have complained since opening.",
    property: "Ondangwa Shopping Centre",
    zone: "Food Court",
    status: "in_progress",
    priority: "high",
    assignee: "Jonas",
    createdAt: "2026-04-25T08:14:00",
    dueDate: "2026-04-26T17:00:00",
    comments: [
      { author: "Jonas", text: "On site. Inspecting compressor.", time: "09:42" },
      { author: "Jonas", text: "Capacitor failed. Sourcing from Windhoek.", time: "11:18" },
    ],
  },
  {
    id: "t-2402",
    title: "Taxi rank canopy — concrete crack inspection",
    description:
      "Tenant reported a hairline crack along the eastern column. Need structural engineer sign-off before next rains.",
    property: "Oshakati Shopping Centre",
    zone: "Taxi Rank",
    status: "pending",
    priority: "urgent",
    assignee: "Unassigned",
    createdAt: "2026-04-26T06:02:00",
    dueDate: "2026-04-28T17:00:00",
    comments: [],
  },
  {
    id: "t-2403",
    title: "Replace soap dispensers — male ablution",
    description: "All three dispensers have been damaged. Replace with stainless steel units.",
    property: "44 on Post",
    zone: "Ground Floor Ablution",
    status: "pending",
    priority: "low",
    assignee: "Jonas",
    createdAt: "2026-04-24T14:20:00",
    dueDate: "2026-04-30T17:00:00",
    comments: [{ author: "Thando", text: "Stainless only — no plastic.", time: "14:22" }],
  },
];

const TEAM = ["Unassigned", "Jonas", "Thando"];
const PROPERTIES = [
  "All properties",
  "Ondangwa Shopping Centre",
  "Oshakati Shopping Centre",
  "44 on Post",
  "269 Independence Avenue",
  "Shoprite LiquorShop",
];

const STATUSES = {
  pending: { label: "Pending", color: "#B45309", bg: "#FEF3C7" },
  in_progress: { label: "In progress", color: "#1D4ED8", bg: "#DBEAFE" },
  completed: { label: "Completed", color: "#15803D", bg: "#DCFCE7" },
};
const PRIORITIES = {
  low: { label: "Low", color: "#6B7280" },
  medium: { label: "Medium", color: "#0F766E" },
  high: { label: "High", color: "#C2410C" },
  urgent: { label: "Urgent", color: "#B91C1C" },
};

// ---------- Helpers ----------
const fmtDue = (iso) => {
  if (!iso) return { text: "—", overdue: false };
  const d = new Date(iso);
  const now = new Date();
  const diff = (d - now) / (1000 * 60 * 60);
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (diff < 0) return { text: `Overdue · ${day}`, overdue: true };
  if (diff < 24)
    return {
      text: `Due today · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      urgent: true,
    };
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

// localStorage-backed state hook
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
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState];
}

// CSV row → task object
const rowToTask = (row) => ({
  id: row.id,
  title: row.title || "",
  description: row.description || "",
  property: row.property || "",
  zone: row.zone || "",
  status: row.status || "pending",
  priority: row.priority || "medium",
  assignee: row.assignee || "Unassigned",
  createdAt: row.createdAt || new Date().toISOString(),
  dueDate: row.dueDate || new Date().toISOString(),
  comments: (() => {
    try {
      const parsed = JSON.parse(row.comments || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })(),
});

// ---------- Main component ----------
export default function App() {
  const [tasks, setTasks] = usePersistedState("ops.tasks", SEED_TASKS);
  const [csvUrl, setCsvUrl] = usePersistedState("ops.csvUrl", "");
  const [webhookUrl, setWebhookUrl] = usePersistedState("ops.webhookUrl", "");
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

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Auto-fetch on mount if URL is configured
  useEffect(() => {
    if (csvUrl) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtered list
  const filtered = useMemo(() => {
    return tasks
      .filter((t) => activeStatus === "all" || t.status === activeStatus)
      .filter((t) => activeProperty === "All properties" || t.property === activeProperty)
      .filter((t) =>
        search.trim() === ""
          ? true
          : (t.title + t.description + t.property + t.zone)
              .toLowerCase()
              .includes(search.toLowerCase())
      )
      .sort((a, b) => {
        const order = { urgent: 0, high: 1, medium: 2, low: 3 };
        if (a.status === "completed" && b.status !== "completed") return 1;
        if (b.status === "completed" && a.status !== "completed") return -1;
        return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
      });
  }, [tasks, activeStatus, activeProperty, search]);

  const counts = useMemo(() => {
    const props =
      activeProperty === "All properties"
        ? tasks
        : tasks.filter((t) => t.property === activeProperty);
    return {
      all: props.length,
      pending: props.filter((t) => t.status === "pending").length,
      in_progress: props.filter((t) => t.status === "in_progress").length,
      completed: props.filter((t) => t.status === "completed").length,
    };
  }, [tasks, activeProperty]);

  // POST change to webhook (fire-and-forget; UI updates optimistically)
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

  const addComment = (id, text) => {
    const c = {
      author: "Thando",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, comments: [...t.comments, c] } : t))
    );
    setOpenTask((cur) =>
      cur && cur.id === id ? { ...cur, comments: [...cur.comments, c] } : cur
    );
    pushChange({ action: "comment", id, comment: c });
  };

  const addTask = (data) => {
    const t = {
      id: `t-${Date.now().toString(36).slice(-5)}`,
      ...data,
      createdAt: new Date().toISOString(),
      comments: [],
    };
    setTasks((prev) => [t, ...prev]);
    pushChange({ action: "create", task: t });
  };

  const refresh = async () => {
    setSyncError("");
    setSyncing(true);

    if (!csvUrl) {
      await new Promise((r) => setTimeout(r, 600));
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
      style={{
        background:
          "radial-gradient(ellipse at top, #E8DFD0 0%, #D4C7B0 50%, #B8A88A 100%)",
      }}
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
          height: "100vh",
          maxHeight: "844px",
          minHeight: "640px",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.06)",
        }}
      >
        {/* Status bar */}
        <div
          className="flex items-center justify-between px-6 pt-3 pb-1 text-xs font-semibold"
          style={{ color: "#0F0F0F" }}
        >
          <span>
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
          </span>
          <div className="flex items-center gap-1">
            <Signal size={12} />
            <Wifi size={12} />
            <Battery size={14} />
          </div>
        </div>

        {/* Header */}
        <div className="px-6 pt-3 pb-4" style={{ background: "#FAF6EE" }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p
                className="text-xs uppercase"
                style={{ color: "#8A7A5C", letterSpacing: "0.15em" }}
              >
                Operations
              </p>
              <h1
                className="font-display text-3xl leading-none mt-1"
                style={{ color: "#0F0F0F", fontWeight: 500 }}
              >
                Today
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                {syncing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <RefreshCw size={15} />
                )}
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <Settings size={15} />
              </button>
            </div>
          </div>

          <PropertyDropdown value={activeProperty} onChange={setActiveProperty} />

          <div
            className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <Search size={15} style={{ color: "#8A7A5C" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks, locations..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "#0F0F0F" }}
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X size={14} style={{ color: "#8A7A5C" }} />
              </button>
            )}
          </div>
        </div>

        {/* Status filter pills */}
        <div
          className="px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide"
          style={{ background: "#FAF6EE", borderBottom: "1px solid rgba(0,0,0,0.06)" }}
        >
          {[
            { key: "all", label: "All", count: counts.all },
            { key: "pending", label: "Pending", count: counts.pending },
            { key: "in_progress", label: "Active", count: counts.in_progress },
            { key: "completed", label: "Done", count: counts.completed },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setActiveStatus(p.key)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all active:scale-95"
              style={{
                background: activeStatus === p.key ? "#0F0F0F" : "white",
                color: activeStatus === p.key ? "white" : "#0F0F0F",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              {p.label}
              <span
                className="px-1.5 rounded-full"
                style={{
                  fontSize: "10px",
                  background:
                    activeStatus === p.key ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.05)",
                }}
              >
                {p.count}
              </span>
            </button>
          ))}
        </div>

        {/* Sync error banner */}
        {syncError && (
          <div
            className="px-5 py-2 text-xs flex items-center gap-2"
            style={{ background: "#FEE2E2", color: "#991B1B" }}
          >
            <AlertCircle size={12} />
            Sync failed: {syncError}
          </div>
        )}

        {/* Task list */}
        <div
          className="overflow-y-auto scrollbar-hide"
          style={{
            height: `calc(100% - ${syncError ? 312 : 280}px)`,
            background: "#FAF6EE",
          }}
        >
          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-xs" style={{ color: "#8A7A5C" }}>
              {filtered.length} {filtered.length === 1 ? "task" : "tasks"} · synced{" "}
              {timeAgo(lastSync)}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div
                className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3"
                style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}
              >
                <Inbox size={22} style={{ color: "#8A7A5C" }} />
              </div>
              <p className="font-display text-lg" style={{ color: "#0F0F0F" }}>
                All clear
              </p>
              <p className="text-sm mt-1" style={{ color: "#8A7A5C" }}>
                No tasks match these filters.
              </p>
            </div>
          ) : (
            <div className="px-4 pb-32 space-y-2">
              {filtered.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onClick={() => setOpenTask(t)}
                  onToggle={() =>
                    updateTask(t.id, {
                      status: t.status === "completed" ? "pending" : "completed",
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => setNewTaskOpen(true)}
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95"
          style={{
            background: "#0F0F0F",
            color: "white",
            boxShadow: "0 10px 30px -5px rgba(0,0,0,0.4)",
          }}
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>

        {openTask && (
          <TaskDetailSheet
            task={openTask}
            onClose={() => setOpenTask(null)}
            onUpdate={(patch) => updateTask(openTask.id, patch)}
            onComment={(text) => addComment(openTask.id, text)}
          />
        )}

        {newTaskOpen && (
          <NewTaskSheet
            onClose={() => setNewTaskOpen(false)}
            onCreate={(data) => {
              addTask(data);
              setNewTaskOpen(false);
            }}
          />
        )}

        {settingsOpen && (
          <SettingsSheet
            csvUrl={csvUrl}
            webhookUrl={webhookUrl}
            onSave={(c, w) => {
              setCsvUrl(c);
              setWebhookUrl(w);
              setSettingsOpen(false);
              if (c) refresh();
            }}
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
  const status = STATUSES[task.status] || STATUSES.pending;
  const priority = PRIORITIES[task.priority] || PRIORITIES.medium;
  const done = task.status === "completed";

  return (
    <div
      onClick={onClick}
      className="rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.99]"
      style={{
        background: "white",
        border: "1px solid rgba(0,0,0,0.05)",
        opacity: done ? 0.6 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="mt-0.5 transition-transform active:scale-90"
        >
          {done ? (
            <CheckCircle2 size={20} style={{ color: "#15803D" }} />
          ) : (
            <Circle size={20} style={{ color: "#D4C7B0" }} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: priority.color }}
            />
            <span
              className="uppercase font-semibold"
              style={{
                color: priority.color,
                fontSize: "10px",
                letterSpacing: "0.1em",
              }}
            >
              {priority.label}
            </span>
            <span style={{ color: "#D4C7B0" }}>·</span>
            <span
              className="px-1.5 py-0.5 rounded-md font-semibold uppercase"
              style={{
                fontSize: "10px",
                background: status.bg,
                color: status.color,
                letterSpacing: "0.05em",
              }}
            >
              {status.label}
            </span>
          </div>

          <h3
            className="font-display text-base leading-snug"
            style={{
              color: "#0F0F0F",
              fontWeight: 500,
              textDecoration: done ? "line-through" : "none",
            }}
          >
            {task.title}
          </h3>

          <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "#8A7A5C" }}>
            <span className="flex items-center gap-1 truncate">
              <MapPin size={11} />
              <span className="truncate">{task.property}</span>
            </span>
          </div>

          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-2">
              <Avatar name={task.assignee} size={20} />
              <span className="text-xs font-medium" style={{ color: "#0F0F0F" }}>
                {task.assignee}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {task.comments.length > 0 && (
                <span
                  className="flex items-center gap-1 text-xs"
                  style={{ color: "#8A7A5C" }}
                >
                  <MessageCircle size={11} />
                  {task.comments.length}
                </span>
              )}
              <span
                className="flex items-center gap-1 text-xs font-medium"
                style={{
                  color: due.overdue ? "#B91C1C" : due.urgent ? "#C2410C" : "#8A7A5C",
                }}
              >
                <Clock size={11} />
                {due.text}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, size = 24 }) {
  const initials =
    name === "Unassigned"
      ? "?"
      : (name || "")
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2);
  const bg =
    name === "Unassigned" ? "#E8DFD0" : name === "Jonas" ? "#0F4C5C" : "#7C2D12";
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold"
      style={{
        width: size,
        height: size,
        background: bg,
        color: name === "Unassigned" ? "#8A7A5C" : "white",
        fontSize: size * 0.42,
      }}
    >
      {initials}
    </div>
  );
}

function PropertyDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
        style={{
          background: "white",
          border: "1px solid rgba(0,0,0,0.06)",
          color: "#0F0F0F",
        }}
      >
        <span className="flex items-center gap-2 truncate">
          <MapPin size={14} style={{ color: "#8A7A5C" }} />
          {value}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: "#8A7A5C",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 200ms",
          }}
        />
      </button>
      {open && (
        <div
          className="absolute top-full mt-2 left-0 right-0 rounded-xl overflow-hidden z-20 fade-anim"
          style={{
            background: "white",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 12px 30px -10px rgba(0,0,0,0.2)",
          }}
        >
          {PROPERTIES.map((p) => (
            <button
              key={p}
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
              className="w-full px-3 py-2.5 text-left text-sm flex items-center justify-between"
              style={{
                color: "#0F0F0F",
                background: value === p ? "#FAF6EE" : "white",
              }}
            >
              <span className="truncate">{p}</span>
              {value === p && <Check size={14} style={{ color: "#0F0F0F" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskDetailSheet({ task, onClose, onUpdate, onComment }) {
  const [comment, setComment] = useState("");
  const due = fmtDue(task.dueDate);
  const status = STATUSES[task.status] || STATUSES.pending;
  const priority = PRIORITIES[task.priority] || PRIORITIES.medium;

  const submitComment = () => {
    if (comment.trim()) {
      onComment(comment.trim());
      setComment("");
    }
  };

  return (
    <div
      className="absolute inset-0 z-30 fade-anim"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col sheet-anim"
        style={{ background: "#FAF6EE", maxHeight: "92%", height: "92%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-2 pb-1 flex justify-center">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "rgba(0,0,0,0.15)" }}
          />
        </div>

        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <X size={16} />
          </button>
          <span className="text-xs font-mono" style={{ color: "#8A7A5C" }}>
            {task.id}
          </span>
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 scrollbar-hide">
          <div className="flex gap-2 mb-3">
            <span
              className="px-2 py-1 rounded-md font-semibold uppercase"
              style={{
                fontSize: "10px",
                background: status.bg,
                color: status.color,
                letterSpacing: "0.05em",
              }}
            >
              {status.label}
            </span>
            <span
              className="px-2 py-1 rounded-md font-semibold uppercase"
              style={{
                fontSize: "10px",
                background: "white",
                color: priority.color,
                border: `1px solid ${priority.color}33`,
                letterSpacing: "0.05em",
              }}
            >
              {priority.label} priority
            </span>
          </div>

          <h2
            className="font-display text-2xl leading-tight mb-3"
            style={{ color: "#0F0F0F", fontWeight: 500 }}
          >
            {task.title}
          </h2>

          <p className="text-sm leading-relaxed mb-5" style={{ color: "#3F3A2E" }}>
            {task.description}
          </p>

          <div
            className="rounded-2xl mb-4"
            style={{ background: "white", border: "1px solid rgba(0,0,0,0.05)" }}
          >
            <DetailRow icon={<MapPin size={14} />} label="Location">
              <div>
                <div className="text-sm font-semibold" style={{ color: "#0F0F0F" }}>
                  {task.property}
                </div>
                <div className="text-xs" style={{ color: "#8A7A5C" }}>
                  {task.zone}
                </div>
              </div>
            </DetailRow>

            <DetailRow icon={<Clock size={14} />} label="Due" border>
              <div
                className="text-sm font-semibold"
                style={{ color: due.overdue ? "#B91C1C" : "#0F0F0F" }}
              >
                {due.text}
              </div>
            </DetailRow>

            <DetailRow icon={<Calendar size={14} />} label="Created" border>
              <div className="text-sm" style={{ color: "#0F0F0F" }}>
                {new Date(task.createdAt).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </DetailRow>
          </div>

          <div className="mb-4">
            <p
              className="uppercase mb-2"
              style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}
            >
              Assigned to
            </p>
            <div className="flex gap-2 flex-wrap">
              {TEAM.map((m) => (
                <button
                  key={m}
                  onClick={() => onUpdate({ assignee: m })}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition active:scale-95"
                  style={{
                    background: task.assignee === m ? "#0F0F0F" : "white",
                    color: task.assignee === m ? "white" : "#0F0F0F",
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <Avatar name={m} size={18} />
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <p
              className="uppercase mb-2"
              style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}
            >
              Status
            </p>
            <div className="flex gap-2">
              {Object.entries(STATUSES).map(([key, s]) => (
                <button
                  key={key}
                  onClick={() => onUpdate({ status: key })}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition active:scale-95"
                  style={{
                    background: task.status === key ? s.color : "white",
                    color: task.status === key ? "white" : s.color,
                    border: `1px solid ${task.status === key ? s.color : "rgba(0,0,0,0.06)"}`,
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p
              className="uppercase mb-3"
              style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}
            >
              Activity ({task.comments.length})
            </p>
            <div className="space-y-3">
              {task.comments.length === 0 ? (
                <p className="text-sm italic" style={{ color: "#8A7A5C" }}>
                  No activity yet.
                </p>
              ) : (
                task.comments.map((c, i) => (
                  <div key={i} className="flex gap-3">
                    <Avatar name={c.author} size={28} />
                    <div
                      className="flex-1 rounded-2xl rounded-tl-sm px-3 py-2"
                      style={{
                        background: "white",
                        border: "1px solid rgba(0,0,0,0.05)",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold" style={{ color: "#0F0F0F" }}>
                          {c.author}
                        </span>
                        <span style={{ color: "#8A7A5C", fontSize: "10px" }}>{c.time}</span>
                      </div>
                      <p className="text-sm" style={{ color: "#3F3A2E" }}>
                        {c.text}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div
          className="px-5 py-3"
          style={{ background: "#FAF6EE", borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder="Add a note..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "#0F0F0F" }}
            />
            <button
              onClick={submitComment}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-90"
              style={{
                background: comment.trim() ? "#0F0F0F" : "#E8DFD0",
                color: comment.trim() ? "white" : "#8A7A5C",
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, children, border }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderTop: border ? "1px solid rgba(0,0,0,0.05)" : "none" }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: "#FAF6EE", color: "#8A7A5C" }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div
          className="uppercase"
          style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}
        >
          {label}
        </div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function NewTaskSheet({ onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [property, setProperty] = useState(PROPERTIES[1]);
  const [zone, setZone] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState("Unassigned");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });

  const valid = title.trim() && property;

  const submit = () => {
    if (!valid) return;
    onCreate({
      title: title.trim(),
      description: description.trim(),
      property,
      zone: zone.trim() || "—",
      status: "pending",
      priority,
      assignee,
      dueDate: new Date(dueDate + "T17:00:00").toISOString(),
    });
  };

  return (
    <div
      className="absolute inset-0 z-30 fade-anim"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col sheet-anim"
        style={{ background: "#FAF6EE", maxHeight: "92%", height: "92%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-2 pb-1 flex justify-center">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "rgba(0,0,0,0.15)" }}
          />
        </div>

        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-sm font-semibold"
            style={{ color: "#8A7A5C" }}
          >
            Cancel
          </button>
          <span
            className="font-display text-base font-semibold"
            style={{ color: "#0F0F0F" }}
          >
            New task
          </span>
          <button
            onClick={submit}
            disabled={!valid}
            className="text-sm font-semibold"
            style={{ color: valid ? "#0F0F0F" : "#D4C7B0" }}
          >
            Create
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 scrollbar-hide pb-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full bg-transparent outline-none font-display text-2xl mb-3"
            style={{ color: "#0F0F0F", fontWeight: 500 }}
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue, what's needed, any context..."
            rows={4}
            className="w-full bg-transparent outline-none text-sm resize-none mb-4"
            style={{ color: "#3F3A2E" }}
          />

          <FieldGroup label="Property">
            <select
              value={property}
              onChange={(e) => setProperty(e.target.value)}
              className="w-full bg-transparent outline-none text-sm font-medium"
              style={{ color: "#0F0F0F" }}
            >
              {PROPERTIES.slice(1).map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </FieldGroup>

          <FieldGroup label="Zone / area">
            <input
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder="e.g. Food Court, Parking, Bay 14"
              className="w-full bg-transparent outline-none text-sm font-medium"
              style={{ color: "#0F0F0F" }}
            />
          </FieldGroup>

          <FieldGroup label="Due date">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-transparent outline-none text-sm font-medium"
              style={{ color: "#0F0F0F" }}
            />
          </FieldGroup>

          <p
            className="uppercase mb-2 mt-4"
            style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}
          >
            Priority
          </p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {Object.entries(PRIORITIES).map(([key, p]) => (
              <button
                key={key}
                onClick={() => setPriority(key)}
                className="px-2 py-2 rounded-xl text-xs font-semibold transition active:scale-95"
                style={{
                  background: priority === key ? p.color : "white",
                  color: priority === key ? "white" : p.color,
                  border: `1px solid ${priority === key ? p.color : "rgba(0,0,0,0.06)"}`,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <p
            className="uppercase mb-2"
            style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}
          >
            Assign to
          </p>
          <div className="flex gap-2 flex-wrap">
            {TEAM.map((m) => (
              <button
                key={m}
                onClick={() => setAssignee(m)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition active:scale-95"
                style={{
                  background: assignee === m ? "#0F0F0F" : "white",
                  color: assignee === m ? "white" : "#0F0F0F",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <Avatar name={m} size={18} />
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }) {
  return (
    <div
      className="rounded-xl px-4 py-3 mb-2"
      style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}
    >
      <div
        className="uppercase mb-1"
        style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function SettingsSheet({ csvUrl, webhookUrl, onSave, onClose }) {
  const [c, setC] = useState(csvUrl);
  const [w, setW] = useState(webhookUrl);

  return (
    <div
      className="absolute inset-0 z-30 fade-anim"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col sheet-anim"
        style={{ background: "#FAF6EE", maxHeight: "85%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-2 pb-1 flex justify-center">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "rgba(0,0,0,0.15)" }}
          />
        </div>

        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-sm font-semibold"
            style={{ color: "#8A7A5C" }}
          >
            Cancel
          </button>
          <span
            className="font-display text-base font-semibold"
            style={{ color: "#0F0F0F" }}
          >
            Connections
          </span>
          <button
            onClick={() => onSave(c, w)}
            className="text-sm font-semibold"
            style={{ color: "#0F0F0F" }}
          >
            Save
          </button>
        </div>

        <div className="px-5 pb-6 overflow-y-auto scrollbar-hide">
          <p className="text-sm mb-4" style={{ color: "#3F3A2E" }}>
            Connect your Google Sheet for reads, and an n8n webhook for writes.
          </p>

          <div
            className="rounded-xl px-4 py-3 mb-3"
            style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <div
              className="uppercase mb-1"
              style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}
            >
              Published CSV URL (read)
            </div>
            <input
              value={c}
              onChange={(e) => setC(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
              className="w-full bg-transparent outline-none text-sm"
              style={{ color: "#0F0F0F" }}
            />
          </div>

          <div
            className="rounded-xl px-4 py-3 mb-4"
            style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <div
              className="uppercase mb-1"
              style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}
            >
              n8n webhook URL (write)
            </div>
            <input
              value={w}
              onChange={(e) => setW(e.target.value)}
              placeholder="https://n8n.yoursite.com/webhook/ops-tasks"
              className="w-full bg-transparent outline-none text-sm"
              style={{ color: "#0F0F0F" }}
            />
          </div>

          <div
            className="rounded-xl px-4 py-3"
            style={{
              background: "rgba(15,76,92,0.08)",
              border: "1px solid rgba(15,76,92,0.15)",
            }}
          >
            <div className="flex items-start gap-2">
              <AlertCircle
                size={14}
                style={{ color: "#0F4C5C", flexShrink: 0, marginTop: 2 }}
              />
              <div className="text-xs leading-relaxed" style={{ color: "#0F4C5C" }}>
                Settings are saved on this device only. Webhook receives JSON with{" "}
                <code className="font-mono">action</code> (create, update, comment).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
