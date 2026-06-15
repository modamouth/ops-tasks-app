import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Papa from "papaparse";
import {
  Search, Plus, MapPin, Clock, X, Check, AlertCircle, Settings,
  Inbox, CheckCircle2, Circle, RefreshCw, MoreHorizontal,
  Loader2, ChevronDown, Phone, MessageCircle, Tag, Camera, Trash2,
  Wifi, WifiOff, ChevronRight, ListFilter, ArrowUpDown, Download,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ---------- Environment-configured URLs (set in Vercel dashboard) ----------
const ENV_CSV_URL = import.meta.env.VITE_CSV_URL || "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHe-qEY2VB71JlIVsx40UPWQGGMRXmAuJ0-hWKTmkvbrzJJt6jDJv2Evw9au27nX705LEwwPzkjLr8/pub?output=csv";
const ENV_WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL || "";

// ---------- CONFIG ----------
const STATUSES = {
  Pending: { label: "Pending", color: "#B45309", bg: "#FEF3C7" },
  "In Progress": { label: "In progress", color: "#1D4ED8", bg: "#DBEAFE" },
  Done: { label: "Done", color: "#15803D", bg: "#DCFCE7" },
};
const STATUS_KEYS = Object.keys(STATUSES);
const DONE_STATUS = "Done";
const ARCHIVED_STATUS = "Archived";
const ARCHIVED_STYLE = { label: "Archived", color: "#6B7280", bg: "#F3F4F6" };

// Photo upload constraints
const MAX_PHOTO_WIDTH = 1024;
const PHOTO_QUALITY = 0.82;

// Offline / sync config
const FLUSH_INTERVAL_MS = 30000;
const STORAGE_WARN_BYTES = 4 * 1024 * 1024;

// Avatar palette
const AVATAR_PALETTE = ["#0F4C5C", "#7C2D12", "#374151", "#5B21B6", "#9F1239", "#065F46", "#9A3412", "#1E3A8A"];

// Master property list
const MASTER_PROPERTIES = [
  "269 Independence",
  "44 On Post",
  "Arandis Convenience Centre",
  "Forum Building",
  "Katutura Shopping Centre",
  "Keetmanshoop Shopping Centre",
  "Kenya House",
  "Maerua Lifestyle Shopping Centre",
  "Mediva House",
  "Mutual Tower",
  "Ondangwa",
  "Oshakati Shopping Centre",
  "Oshikango Shopping Centre",
  "Otjivanda Shopping Centre",
  "Rehoboth Shopping Centre",
  "Schuster House",
  "Windhoek Sanlam Centre",
];

const SEED_TASKS = [
  { id: "OTJ-001", title: "Shoprite — Generator service/repair", property: "Otjivanda Shopping Centre", category: "Mechanical", assignee: "Chanelle", phone: "27711918399", status: "Done", dueDate: "2026-04-23", photoUrl: "" },
  { id: "OTJ-002", title: "Shoprite — Front door repair/replacement", property: "Otjivanda Shopping Centre", category: "Maintenance", assignee: "Jonas", phone: "264812459553", status: "Done", dueDate: "2026-04-30", photoUrl: "" },
  { id: "OTJ-003", title: "Clicks — Roof leak and ceiling repair", property: "Otjivanda Shopping Centre", category: "Civil/Roofing", assignee: "Jonas", phone: "264812459553", status: "Done", dueDate: "2026-04-23", photoUrl: "" },
  { id: "OTJ-004", title: "Main Entrance — Glass replacement", property: "Otjivanda Shopping Centre", category: "Civil/Glazing", assignee: "Jonas", phone: "264812459553", status: "In Progress", dueDate: "2026-05-15", photoUrl: "" },
  { id: "ARA-001", title: "Standard Bank Premises — Roof leak and bulkhead repair", property: "Arandis Convenience Centre", category: "Civil/Roofing", assignee: "Jonas", phone: "264812459553", status: "Done", dueDate: "2026-04-23", photoUrl: "" },
  { id: "MUT-001", title: "Sump pump quotes", property: "Mutual Tower", category: "Mechanical/Plumbing", assignee: "Thando", phone: "27711918399", status: "Archived", dueDate: "2026-04-23", photoUrl: "" },
  { id: "MUT-002", title: "Bats — investigation and removal", property: "Mutual Tower", category: "Pest Control", assignee: "Jonas", phone: "264812459553", status: "Done", dueDate: "2026-05-22", photoUrl: "" },
  { id: "OSH-001", title: "Shop 05 — Aircon replacement", property: "Oshikango Shopping Centre", category: "HVAC", assignee: "Kennedy", phone: "264814311354", status: "In Progress", dueDate: "2026-05-20", photoUrl: "" },
  { id: "OSH-002", title: "Peters Take Away — Blocked zinc / drain", property: "Oshikango Shopping Centre", category: "Plumbing", assignee: "Kennedy", phone: "264814311354", status: "Done", dueDate: "2026-04-23", photoUrl: "" },
  { id: "OSH-003", title: "Transformers services", property: "Oshikango Shopping Centre", category: "Electrical", assignee: "Kennedy", phone: "264814311354", status: "Done", dueDate: "2026-04-23", photoUrl: "" },
  { id: "MAE-001", title: "Spar Health Section — Roof repair", property: "Maerua Lifestyle Shopping Centre", category: "Civil/Roofing", assignee: "Chanelle", phone: "264816757974", status: "Done", dueDate: "2026-04-23", photoUrl: "" },
  { id: "MAE-002", title: "Office block toilets — attend to faults", property: "Maerua Lifestyle Shopping Centre", category: "Plumbing", assignee: "Jonas", phone: "264812459553", status: "Done", dueDate: "2026-04-23", photoUrl: "" },
  { id: "MAE-003", title: "Attend to photo report items", property: "Maerua Lifestyle Shopping Centre", category: "General Maintenance", assignee: "Jonas", phone: "264812459553", status: "Done", dueDate: "2026-04-23", photoUrl: "" },
  { id: "REH-001", title: "Fire signage — transformers compliance", property: "Rehoboth Shopping Centre", category: "Fire/Safety", assignee: "Jonas", phone: "264812459553", status: "Done", dueDate: "2026-04-23", photoUrl: "" },
  { id: "REH-002", title: "Fire extinguishers — inspection/replacement", property: "Rehoboth Shopping Centre", category: "Fire/Safety", assignee: "Jonas", phone: "264812459553", status: "Done", dueDate: "2026-04-23", photoUrl: "" },
  { id: "REH-003", title: "DB room — attend to faults", property: "Rehoboth Shopping Centre", category: "Electrical", assignee: "Jonas", phone: "264812459553", status: "In Progress", dueDate: "2026-04-23", photoUrl: "" },
  { id: "FOR-001", title: "Hydrant repairs", property: "Forum Building", category: "Fire/Safety", assignee: "Jonas", phone: "264812459553", status: "Pending", dueDate: "2026-04-23", photoUrl: "" },
  { id: "FOR-002", title: "Vacancy inspections — Windows", property: "Forum Building", category: "Maintenance", assignee: "Thando", phone: "27711918399", status: "Archived", dueDate: "2026-04-23", photoUrl: "" },
  { id: "FOR-003", title: "Clean vacant offices 1st floor", property: "Forum Building", category: "Civil/Glazing", assignee: "Jonas", phone: "264812459553", status: "Done", dueDate: "2026-04-28", photoUrl: "" },
  { id: "WSC-001", title: "Shop 11 — Fire door installation", property: "Windhoek Sanlam Centre", category: "Fire/Safety", assignee: "Thando", phone: "27711918399", status: "Archived", dueDate: "2026-04-23", photoUrl: "" },
  { id: "WSC-002", title: "Coffee shop — shade nets installation", property: "Windhoek Sanlam Centre", category: "Civil/Structures", assignee: "Thando", phone: "27711918399", status: "Archived", dueDate: "2026-04-23", photoUrl: "" },
  { id: "WIN-001", title: "Please get quotations for pest control services", property: "Windhoek Sanlam Centre", category: "Pest Control", assignee: "Thando", phone: "27711918399", status: "Archived", dueDate: "2026-04-26", photoUrl: "" },
  { id: "WIN-002", title: "Installation of x 3 air dispenser minus 2 toilets and passage", property: "Windhoek Sanlam Centre", category: "Maintenance", assignee: "Kennedy", phone: "264814311354", status: "Done", dueDate: "2026-05-06", photoUrl: "" },
  { id: "MUT-003", title: "Maintenance task to be completed", property: "Mutual Tower", category: "Maintenance", assignee: "Thando", phone: "27711918399", status: "Archived", dueDate: "2026-04-28", photoUrl: "" },
  { id: "MUT-004", title: "Men's toilet 5th floor — out of order, lights not working", property: "Mutual Tower", category: "Plumbing", assignee: "Jonas", phone: "264812459553", status: "Pending", dueDate: "2026-04-28", photoUrl: "" },
  { id: "ARA-002", title: "Arandis cleaning", property: "Arandis Convenience Centre", category: "Maintenance", assignee: "Thando", phone: "27711918399", status: "Archived", dueDate: "2026-04-28", photoUrl: "" },
  { id: "OSH-004", title: "Please trim the tree", property: "Oshikango Shopping Centre", category: "Maintenance", assignee: "Lilian", phone: "264816064802", status: "Archived", dueDate: "2026-04-30", photoUrl: "" },
  { id: "OND-001", title: "Test Task", property: "Ondangwa", category: "Mechanical", assignee: "Thando", phone: "27711918399", status: "Archived", dueDate: "2026-04-30", photoUrl: "" },
  { id: "OND-002", title: "Shop 6 water metre leak and cleaning of algae off bricks", property: "Ondangwa", category: "Plumbing", assignee: "Kennedy", phone: "264814311354", status: "Done", dueDate: "2026-05-06", photoUrl: "" },
  { id: "ONP-001", title: "Test WhatsApp Notification Task", property: "44 On Post", category: "Maintenance", assignee: "Thando", phone: "27711918399", status: "Archived", dueDate: "2026-04-28", photoUrl: "" },
  { id: "IND-001", title: "Test WhatsApp Notifications", property: "269 Independence", category: "Civil/Glazing", assignee: "Thando", phone: "27711918399", status: "Archived", dueDate: "2026-04-28", photoUrl: "" },
  { id: "IND-002", title: "Test WhatsApp Notification Task", property: "269 Independence", category: "Civil/Glazing", assignee: "Lilian", phone: "264816064802", status: "Done", dueDate: "2026-04-28", photoUrl: "" },
  { id: "IND-003", title: "Leak basement bay65", property: "269 Independence", category: "Security", assignee: "Thando", phone: "27711918399", status: "Archived", dueDate: "2026-04-28", photoUrl: "" },
  { id: "IND-004", title: "Test Image Upload", property: "269 Independence", category: "Civil/Glazing", assignee: "Thando", phone: "27711918399", status: "Archived", dueDate: "2026-04-29", photoUrl: "" },
  { id: "SCH-001", title: "Test Image Upload 6", property: "Schuster House", category: "Civil/Glazing", assignee: "Thando", phone: "27711918399", status: "Done", dueDate: "2026-04-29", photoUrl: "https://drive.google.com/file/d/1cnNzhWUvVwax3z8jKSaoLguYv2FVP-oo/view?usp=drivesdk" },
];

// Bump this string any time SEED_TASKS or MASTER_PROPERTIES change.
// On first load after a version change, localStorage is cleared so stale
// cached tasks (with old property names) don't bleed into the new filters.
const SEED_VERSION = "v5";

// ---------- Helpers ----------
const fmtDue = (val) => {
  if (!val) return { text: "—" };
  const d = new Date(val);
  if (isNaN(d)) return { text: String(val) };
  const now = new Date();
  const diff = (d - now) / (1000 * 60 * 60);
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (diff < 0) {
    const daysOverdue = Math.floor(Math.abs(diff) / 24);
    return { text: `Overdue · ${day}`, overdue: true, daysOverdue };
  }
  if (diff < 24) return { text: `Due soon · ${day}`, urgent: true };
  if (diff < 48) return { text: `Tomorrow · ${day}` };
  return { text: day };
};

const fmtCreatedAt = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).replace(",", " at");
};

const timeAgo = (iso) => {
  const mins = Math.floor((new Date() - new Date(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// "April 2026" style label for a month bucket key (YYYY-MM)
const fmtMonthLabel = (key) => {
  if (key === "older") return "Older";
  if (key === "unknown") return "Date unknown";
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};

// Resize image
const resizeImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_PHOTO_WIDTH / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", PHOTO_QUALITY));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Drive URL conversion
const driveImageSrc = (url) => {
  if (!url) return "";
  const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1600`;
  return url;
};

const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

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
  id: (row["Task ID"] || "").trim(),
  title: (row["Task Description"] || "").trim(),
  property: (row["Property"] || "").trim(),
  category: (row["Category"] || "").trim(),
  assignee: (row["Assigned To"] || "Unassigned").trim(),
  phone: (row["Phone Number"] || "").trim(),
  status: STATUS_KEYS.includes(row["Status"]) || row["Status"] === ARCHIVED_STATUS
    ? row["Status"]
    : "Pending",
  dueDate: (row["Due Date"] || "").trim(),
  photoUrl: (row["Photo URL"] || "").trim(),
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

const phoneFor = (assignee, tasks) => {
  if (!assignee || assignee === "Unassigned") return "";
  // Count how often each phone appears for this assignee
  const counts = {};
  for (const t of tasks) {
    if (t.assignee === assignee && t.phone) {
      counts[t.phone] = (counts[t.phone] || 0) + 1;
    }
  }
  // Return the most-used phone, falling back to first match if tied
  let bestPhone = "";
  let bestCount = 0;
  for (const phone in counts) {
    if (counts[phone] > bestCount) {
      bestCount = counts[phone];
      bestPhone = phone;
    }
  }
  return bestPhone;
};

const RECUR_OPTIONS = [
  { value: "none", label: "Once-off" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// currentDue (YYYY-MM-DD) is used as the base for quarterly/annually calculations.
const nextRecurringDue = (recurring, recurringDay, currentDue) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (recurring === "weekly") {
    const target = recurringDay ?? 5;
    const d = new Date(today);
    let diff = (target - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }
  if (recurring === "monthly") {
    const target = recurringDay ?? 1;
    const d = new Date(today);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(target, max));
    return d.toISOString().slice(0, 10);
  }
  if (recurring === "quarterly" || recurring === "annually") {
    const months = recurring === "quarterly" ? 3 : 12;
    const base = currentDue ? new Date(currentDue + "T00:00:00") : new Date(today);
    base.setMonth(base.getMonth() + months);
    return base.toISOString().slice(0, 10);
  }
  return null;
};

const downloadPersonPDF = (name, tasks) => {
  const outstanding = tasks.filter(
    (t) => t.assignee === name && t.status !== DONE_STATUS && t.status !== ARCHIVED_STATUS
  );

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const today = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`Outstanding Tasks — ${name}`, 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 110, 90);
  doc.text(`Generated ${today} · ${outstanding.length} task${outstanding.length !== 1 ? "s" : ""}`, 14, 27);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 33,
    head: [["ID", "Task", "Property", "Category", "Status", "Due Date"]],
    body: outstanding.map((t) => [
      t.id || "",
      t.title || "",
      t.property || "",
      t.category || "",
      t.status || "",
      t.dueDate || "",
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 15, 15], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 65 },
      2: { cellWidth: 35 },
      3: { cellWidth: 28 },
      4: { cellWidth: 20 },
      5: { cellWidth: 22 },
    },
    alternateRowStyles: { fillColor: [250, 246, 238] },
  });

  doc.save(`tasks-${name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
};

const queueBytes = (queue) => {
  try {
    return new Blob([JSON.stringify(queue)]).size;
  } catch {
    return 0;
  }
};

// Group archived tasks into month buckets keyed by 'YYYY-MM' or 'unknown'.
// Returns: [{ key: '2026-04', label: 'April 2026', tasks: [...] }, ...] sorted newest-first.
const bucketByArchivedMonth = (tasks, archivedAtMap) => {
  const buckets = new Map();
  for (const t of tasks) {
    const ts = archivedAtMap[t.id];
    let key;
    if (!ts) {
      key = "unknown";
    } else {
      const d = new Date(ts);
      if (isNaN(d)) {
        key = "unknown";
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(t);
  }

  // Sort: known months descending by year-month, then 'unknown' last
  const entries = Array.from(buckets.entries());
  entries.sort(([a], [b]) => {
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return b.localeCompare(a);
  });

  return entries.map(([key, taskList]) => {
    // Sort each bucket's tasks by archive timestamp descending (most recent first)
    const sortedTasks = [...taskList].sort((x, y) => {
      const tx = archivedAtMap[x.id] ? new Date(archivedAtMap[x.id]).getTime() : 0;
      const ty = archivedAtMap[y.id] ? new Date(archivedAtMap[y.id]).getTime() : 0;
      return ty - tx;
    });
    return { key, label: fmtMonthLabel(key), tasks: sortedTasks };
  });
};

// ---------- Main ----------
export default function App() {
  // Clear stale localStorage when seed data version changes.
  (() => {
    try {
      if (localStorage.getItem("ops.seedVersion") !== SEED_VERSION) {
        ["ops.tasks", "ops.createdAt", "ops.archivedAt", "ops.pendingChanges", "ops.lastSync"].forEach(
          (k) => localStorage.removeItem(k)
        );
        localStorage.setItem("ops.seedVersion", SEED_VERSION);
      }
    } catch {}
  })();

  const [tasks, setTasks] = usePersistedState("ops.tasks", SEED_TASKS);
  const [createdAtMap, setCreatedAtMap] = usePersistedState("ops.createdAt", {});
  const [archivedAtMap, setArchivedAtMap] = usePersistedState("ops.archivedAt", {});
  const [pendingQueue, setPendingQueue] = usePersistedState("ops.pendingChanges", []);
  const [csvOverride, setCsvOverride] = usePersistedState("ops.csvUrl", "");
  const [webhookOverride, setWebhookOverride] = usePersistedState("ops.webhookUrl", "");
  const [groupBy, setGroupBy] = usePersistedState("ops.groupBy", "none");
  const [sortBy, setSortBy] = usePersistedState("ops.sortBy", "overdue");

  const csvUrl = ENV_CSV_URL || csvOverride;
  const webhookUrl = ENV_WEBHOOK_URL || webhookOverride;

  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [flushing, setFlushing] = useState(false);
  const flushingRef = useRef(false);

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
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const sendOne = useCallback(async (entry) => {
    if (!webhookUrl) return false;
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.payload),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [webhookUrl]);

  const flushPendingChanges = useCallback(async () => {
    if (flushingRef.current) return;
    if (!isOnline || !webhookUrl) return;
    if (pendingQueue.length === 0) return;

    flushingRef.current = true;
    setFlushing(true);
    try {
      let remaining = [...pendingQueue];
      while (remaining.length > 0) {
        const entry = remaining[0];
        const ok = await sendOne(entry);
        if (!ok) break;
        remaining = remaining.slice(1);
        setPendingQueue(remaining);
      }
    } finally {
      flushingRef.current = false;
      setFlushing(false);
    }
  }, [isOnline, webhookUrl, pendingQueue, sendOne, setPendingQueue]);

  useEffect(() => {
    if (csvUrl) refresh();
    flushPendingChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isOnline) flushPendingChanges();
  }, [isOnline, flushPendingChanges]);

  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => {
      if (pendingQueue.length > 0) flushPendingChanges();
    }, FLUSH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isOnline, pendingQueue.length, flushPendingChanges]);

  // Filter dropdown only shows properties that actually exist in tasks.
  // Avoids phantom MASTER_PROPERTIES entries matching nothing in the CSV.
  const propertyOptions = useMemo(() => {
    // MASTER_PROPERTIES is the canonical list — never derive from task data,
    // which can contain stale/misspelled names from the CSV or localStorage.
    return ["All properties", ...MASTER_PROPERTIES];
  }, []);

  // New-task form gets the full list so users can pick any known property.
  const newTaskPropertyOptions = useMemo(() => {
    const fromTasks = new Set(tasks.map((t) => t.property).filter(Boolean));
    const combined = new Set([...MASTER_PROPERTIES, ...fromTasks]);
    return Array.from(combined).sort();
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

  // Compute inline — no useMemo so there are zero caching/staleness issues.
  // For ≤300 tasks these array ops take < 1ms and are safe on every render.
  const _q = search.trim().toLowerCase();
  const filtered = tasks
    .filter((t) => {
      if (activeStatus === "all") return t.status !== ARCHIVED_STATUS;
      return t.status === activeStatus;
    })
    .filter((t) => {
      if (!_q) return true;
      return [t.title, t.property, t.category, t.assignee, t.id]
        .some((f) => (f || "").toLowerCase().includes(_q));
    })
    .sort((a, b) => {
      if (activeStatus === ARCHIVED_STATUS) return 0;
      const aDone = a.status === DONE_STATUS;
      const bDone = b.status === DONE_STATUS;
      if (aDone && !bDone) return 1;
      if (bDone && !aDone) return -1;
      const aDate = new Date(a.dueDate || "9999-12-31");
      const bDate = new Date(b.dueDate || "9999-12-31");
      if (sortBy === "overdue") {
        const now = new Date();
        const aOver = aDate < now;
        const bOver = bDate < now;
        if (aOver && !bOver) return -1;
        if (!aOver && bOver) return 1;
      }
      return aDate - bDate;
    });

  const visibleTasks = activeProperty === "All properties"
    ? filtered
    : filtered.filter((t) => t.property === activeProperty);

  const groupedTasks = useMemo(() => {
    if (activeStatus === ARCHIVED_STATUS || groupBy === "none" || search.trim()) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const DAY_MS = 86400000;
    const buckets = new Map();
    for (const t of visibleTasks) {
      let key;
      if (groupBy === "property") {
        key = t.property || "No property";
      } else if (groupBy === "assignee") {
        key = t.assignee || "Unassigned";
      } else {
        const d = t.dueDate ? new Date(t.dueDate + "T00:00:00") : null;
        if (!d || isNaN(d.getTime())) key = "No date";
        else if (d < now) key = "Overdue";
        else if (d.getTime() === now.getTime()) key = "Today";
        else if (d - now < 7 * DAY_MS) key = "This week";
        else key = "Upcoming";
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(t);
    }
    const entries = Array.from(buckets.entries());
    if (groupBy === "due") {
      const order = ["Overdue", "Today", "This week", "Upcoming", "No date"];
      entries.sort(([a], [b]) => {
        const ai = order.indexOf(a), bi = order.indexOf(b);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    } else {
      entries.sort(([a], [b]) => a.localeCompare(b));
    }
    return entries.map(([key, tasks]) => ({ key, tasks }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, activeStatus, activeProperty, search, sortBy, groupBy]);

  const counts = useMemo(() => {
    const props = activeProperty === "All properties" ? tasks : tasks.filter((t) => t.property === activeProperty);
    const c = { all: props.filter((t) => t.status !== ARCHIVED_STATUS).length };
    STATUS_KEYS.forEach((k) => { c[k] = props.filter((t) => t.status === k).length; });
    c[ARCHIVED_STATUS] = props.filter((t) => t.status === ARCHIVED_STATUS).length;
    return c;
  }, [tasks, activeProperty]);

  const enqueueChange = useCallback((payload) => {
    if (!webhookUrl) return;

    if (payload.task?.image || payload.patch?.image) {
      const projected = queueBytes([...pendingQueue, { id: "tmp", payload }]);
      if (projected > STORAGE_WARN_BYTES) {
        alert(`Pending changes are getting large (${(projected / 1024 / 1024).toFixed(1)} MB).\n\nReconnect to sync existing changes before adding more photos.`);
      }
    }

    const entry = { id: uuid(), payload, timestamp: Date.now() };
    setPendingQueue((q) => [...q, entry]);
  }, [webhookUrl, pendingQueue, setPendingQueue]);

  useEffect(() => {
    if (pendingQueue.length > 0 && isOnline) {
      flushPendingChanges();
    }
  }, [pendingQueue.length, isOnline, flushPendingChanges]);

  const updateTask = (id, patch) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setOpenTask((cur) => (cur && cur.id === id ? { ...cur, ...patch } : cur));

    if (patch.status === DONE_STATUS) {
      const task = tasks.find((t) => t.id === id);
      if (task && task.recurring && task.recurring !== "none") {
        const nextDue = nextRecurringDue(task.recurring, task.recurringDay, task.dueDate);
        if (nextDue) {
          addTask({
            title: task.title,
            property: task.property,
            category: task.category,
            assignee: task.assignee,
            phone: task.phone,
            status: "Pending",
            dueDate: nextDue,
            recurring: task.recurring,
            recurringDay: task.recurringDay,
          });
        }
      }
      enqueueChange({ action: "complete", id, patch });
    } else {
      enqueueChange({ action: "update", id, patch });
    }
  };

  const archiveTask = (id) => {
    const archivedIso = new Date().toISOString();
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: ARCHIVED_STATUS } : t)));
    setArchivedAtMap((prev) => ({ ...prev, [id]: archivedIso }));
    setOpenTask(null);
    enqueueChange({ action: "update", id, patch: { status: ARCHIVED_STATUS } });
  };

  const addTask = (data) => {
    const createdIso = new Date().toISOString();
    let resolvedId = data.id;
    setTasks((prev) => {
      const id = data.id || nextIdFor(data.property, prev);
      resolvedId = id;
      if (prev.some((t) => t.id === id)) return prev; // guard against duplicate IDs
      return [{ id, ...data }, ...prev];
    });
    setCreatedAtMap((prev) => ({ ...prev, [resolvedId]: createdIso }));
    enqueueChange({ action: "create", task: { id: resolvedId, ...data } });
  };

  const refresh = async () => {
    setSyncError("");

    if (pendingQueue.length > 0 && isOnline) {
      await flushPendingChanges();
      if (pendingQueue.length > 0) {
        setSyncError("Cannot pull fresh data while changes are unsynced");
        return;
      }
    }

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

  const statusChips = [
    { key: "all", label: "All" },
    ...STATUS_KEYS.map((k) => ({ key: k, label: STATUSES[k].label })),
    { key: ARCHIVED_STATUS, label: ARCHIVED_STYLE.label },
  ];

  const pendingCount = pendingQueue.length;
  const isArchivedView = activeStatus === ARCHIVED_STATUS;

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
        <div className="px-6 pt-6 pb-4" style={{ background: "#FAF6EE" }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs uppercase" style={{ color: "#8A7A5C", letterSpacing: "0.15em" }}>Operations</p>
              <h1 className="font-display text-3xl leading-none mt-1" style={{ color: "#0F0F0F", fontWeight: 500 }}>Today</h1>
              <p className="text-sm mt-1" style={{ color: "#8A7A5C" }}>
                {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </p>
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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks, people, locations..." className="flex-1 bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
            {search && <button onClick={() => setSearch("")}><X size={14} style={{ color: "#8A7A5C" }} /></button>}
          </div>
          {search.trim() && teamOptions.some((n) => n.toLowerCase() === search.trim().toLowerCase()) && (() => {
            const matchedName = teamOptions.find((n) => n.toLowerCase() === search.trim().toLowerCase());
            return (
              <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-xl fade-anim" style={{ background: "rgba(15,79,92,0.08)", border: "1px solid rgba(15,79,92,0.15)" }}>
                <Avatar name={matchedName} size={18} />
                <span className="text-xs font-medium flex-1" style={{ color: "#0F4C5C" }}>
                  Showing all tasks for {matchedName}
                </span>
                <button
                  onClick={() => downloadPersonPDF(matchedName, tasks)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95"
                  style={{ background: "#0F4C5C", color: "white" }}
                  title="Download outstanding tasks as PDF"
                >
                  <Download size={11} />
                  PDF
                </button>
              </div>
            );
          })()}
        </div>

        <div className="px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide" style={{ background: "#FAF6EE", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          {statusChips.map((p) => (
            <button key={p.key} onClick={() => setActiveStatus(p.key)} className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all active:scale-95" style={{ background: activeStatus === p.key ? "#0F0F0F" : "white", color: activeStatus === p.key ? "white" : "#0F0F0F", border: "1px solid rgba(0,0,0,0.08)" }}>
              {p.label}
              <span className="px-1.5 rounded-full" style={{ fontSize: "10px", background: activeStatus === p.key ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.05)" }}>{counts[p.key] ?? 0}</span>
            </button>
          ))}
        </div>

        <SyncBanner
          isOnline={isOnline}
          flushing={flushing}
          pendingCount={pendingCount}
          syncError={syncError}
        />

        <div className="overflow-y-auto scrollbar-hide" style={{ height: `calc(100% - ${(syncError || !isOnline || pendingCount > 0) ? 312 : 282}px)`, background: "#FAF6EE" }}>
          {isArchivedView ? (
            <div className="px-4 py-2.5">
              <p className="text-xs" style={{ color: "#8A7A5C" }}>
                {visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"} · synced {timeAgo(lastSync)}
              </p>
            </div>
          ) : (
            <SortGroupBar
              groupBy={groupBy} setGroupBy={setGroupBy}
              sortBy={sortBy} setSortBy={setSortBy}
              count={visibleTasks.length} lastSync={lastSync}
            />
          )}

          {visibleTasks.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                <Inbox size={22} style={{ color: "#8A7A5C" }} />
              </div>
              <p className="font-display text-lg" style={{ color: "#0F0F0F" }}>All clear</p>
              <p className="text-sm mt-1" style={{ color: "#8A7A5C" }}>No tasks match these filters.</p>
            </div>
          ) : isArchivedView ? (
            <ArchivedListView
              tasks={visibleTasks}
              archivedAtMap={archivedAtMap}
              onTaskClick={setOpenTask}
              onAssigneeClick={(name) => setSearch(name)}
            />
          ) : groupedTasks ? (
            <GroupedListView
              groups={groupedTasks}
              onTaskClick={setOpenTask}
              onToggle={(t) => updateTask(t.id, { status: t.status === DONE_STATUS ? "Pending" : DONE_STATUS })}
            />
          ) : (
            <div className="px-4 pb-32 pt-1">
              <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid rgba(0,0,0,0.05)" }}>
                {visibleTasks.map((t) => (
                  <TaskRow key={t.id} task={t} onClick={() => setOpenTask(t)} onToggle={() => updateTask(t.id, { status: t.status === DONE_STATUS ? "Pending" : DONE_STATUS })} />
                ))}
              </div>
            </div>
          )}
        </div>

        <button onClick={() => setNewTaskOpen(true)} className="absolute bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95" style={{ background: "#0F0F0F", color: "white", boxShadow: "0 10px 30px -5px rgba(0,0,0,0.4)" }}>
          <Plus size={22} strokeWidth={2.5} />
        </button>

        {openTask && (
          <TaskDetailSheet
            task={openTask}
            createdAt={createdAtMap[openTask.id]}
            archivedAt={archivedAtMap[openTask.id]}
            team={teamOptions}
            onClose={() => setOpenTask(null)}
            onUpdate={(patch) => updateTask(openTask.id, patch)}
            onArchive={() => archiveTask(openTask.id)}
            tasks={tasks}
          />
        )}
        {newTaskOpen && (
          <NewTaskSheet
            propertyOptions={newTaskPropertyOptions}
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

// ---------- Sort + group controls bar ----------
const GROUP_OPTS = [
  { value: "none", label: "No grouping" },
  { value: "property", label: "Property" },
  { value: "assignee", label: "Person" },
  { value: "due", label: "Due date" },
];
const SORT_OPTS = [
  { value: "overdue", label: "Overdue first" },
  { value: "date", label: "Soonest first" },
];

function SortGroupBar({ groupBy, setGroupBy, sortBy, setSortBy, count, lastSync }) {
  const [groupOpen, setGroupOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const groupLabel = GROUP_OPTS.find((o) => o.value === groupBy)?.label ?? "Group";
  const sortLabel = SORT_OPTS.find((o) => o.value === sortBy)?.label ?? "Sort";

  return (
    <div
      className="sticky top-0 z-10 px-4 py-2.5 flex items-center justify-between gap-2"
      style={{ background: "#FAF6EE", borderBottom: "1px solid rgba(0,0,0,0.05)" }}
    >
      <p className="text-xs flex-shrink-0" style={{ color: "#8A7A5C" }}>
        {count} {count === 1 ? "task" : "tasks"} · {timeAgo(lastSync)}
      </p>
      <div className="flex items-center gap-1.5">
        <div className="relative">
          {groupOpen && <div className="fixed inset-0 z-30" onClick={() => setGroupOpen(false)} />}
          <button
            type="button"
            onClick={() => { setGroupOpen((v) => !v); setSortOpen(false); }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all active:scale-95"
            style={{
              background: groupBy !== "none" ? "#0F0F0F" : "white",
              color: groupBy !== "none" ? "white" : "#0F0F0F",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <ListFilter size={11} />
            {groupBy === "none" ? "Group" : groupLabel}
          </button>
          {groupOpen && (
            <div
              className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-40 fade-anim"
              style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.2)", minWidth: "140px" }}
            >
              {GROUP_OPTS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { setGroupBy(o.value); setGroupOpen(false); }}
                  className="w-full px-3 py-2.5 text-left text-xs flex items-center justify-between"
                  style={{ color: "#0F0F0F", background: groupBy === o.value ? "#FAF6EE" : "white" }}
                >
                  {o.label}
                  {groupBy === o.value && <Check size={11} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          {sortOpen && <div className="fixed inset-0 z-30" onClick={() => setSortOpen(false)} />}
          <button
            type="button"
            onClick={() => { setSortOpen((v) => !v); setGroupOpen(false); }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all active:scale-95"
            style={{ background: "white", color: "#0F0F0F", border: "1px solid rgba(0,0,0,0.08)" }}
          >
            <ArrowUpDown size={11} />
            {sortLabel}
          </button>
          {sortOpen && (
            <div
              className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-40 fade-anim"
              style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.2)", minWidth: "140px" }}
            >
              {SORT_OPTS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { setSortBy(o.value); setSortOpen(false); }}
                  className="w-full px-3 py-2.5 text-left text-xs flex items-center justify-between"
                  style={{ color: "#0F0F0F", background: sortBy === o.value ? "#FAF6EE" : "white" }}
                >
                  {o.label}
                  {sortBy === o.value && <Check size={11} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Grouped list view ----------
function GroupedListView({ groups, onTaskClick, onToggle }) {
  const [openGroups, setOpenGroups] = useState(() => new Set(groups.map((g) => g.key)));

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      groups.forEach((g) => { if (!next.has(g.key)) next.add(g.key); });
      return next;
    });
  }, [groups]);

  const toggle = (key) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="px-4 pb-32 pt-2 space-y-2">
      {groups.map(({ key, tasks }) => {
        const isOpen = openGroups.has(key);
        const isOverdue = key === "Overdue";
        return (
          <div key={key}>
            <button
              type="button"
              onClick={() => toggle(key)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] mb-1"
              style={{
                background: isOverdue ? "#FEF2F2" : "white",
                border: `1px solid ${isOverdue ? "rgba(185,28,28,0.2)" : "rgba(0,0,0,0.06)"}`,
                color: isOverdue ? "#991B1B" : "#0F0F0F",
              }}
            >
              <span className="flex items-center gap-2 min-w-0">
                <ChevronRight
                  size={13}
                  style={{ flexShrink: 0, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 180ms" }}
                />
                {isOverdue && <AlertCircle size={12} style={{ flexShrink: 0 }} />}
                <span className="truncate">{key}</span>
              </span>
              <span
                className="flex-shrink-0 px-1.5 rounded-full ml-2"
                style={{ fontSize: "10px", background: isOverdue ? "rgba(185,28,28,0.12)" : "rgba(0,0,0,0.06)" }}
              >
                {tasks.length}
              </span>
            </button>
            {isOpen && (
              <div className="rounded-2xl overflow-hidden mb-1" style={{ background: "white", border: "1px solid rgba(0,0,0,0.05)" }}>
                {tasks.map((t) => (
                  <TaskRow key={t.id} task={t} onClick={() => onTaskClick(t)} onToggle={() => onToggle(t)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Archived view: month-grouped, recent expanded ----------
function ArchivedListView({ tasks, archivedAtMap, onTaskClick, onAssigneeClick }) {
  const buckets = useMemo(() => bucketByArchivedMonth(tasks, archivedAtMap), [tasks, archivedAtMap]);

  // Track which months are open. Default: only the first (most recent) month is open.
  const [openMonths, setOpenMonths] = useState(() => {
    if (buckets.length > 0) return new Set([buckets[0].key]);
    return new Set();
  });

  // Re-sync openMonths if buckets change (e.g. new archive added)
  useEffect(() => {
    if (buckets.length > 0) {
      setOpenMonths((prev) => {
        const next = new Set(prev);
        // If the most recent bucket isn't tracked yet, expand it
        if (!next.has(buckets[0].key) && prev.size === 0) {
          next.add(buckets[0].key);
        }
        return next;
      });
    }
  }, [buckets]);

  const toggleMonth = (key) => {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="px-4 pb-32 space-y-3">
      {buckets.map((bucket) => {
        const isOpen = openMonths.has(bucket.key);
        return (
          <div key={bucket.key}>
            <button
              onClick={() => toggleMonth(bucket.key)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] mb-2"
              style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)", color: "#0F0F0F" }}
            >
              <span className="flex items-center gap-2">
                <ChevronRight
                  size={14}
                  style={{
                    color: "#8A7A5C",
                    transform: isOpen ? "rotate(90deg)" : "none",
                    transition: "transform 200ms",
                  }}
                />
                <span>{bucket.label}</span>
              </span>
              <span
                className="px-1.5 rounded-full"
                style={{ fontSize: "10px", background: "rgba(0,0,0,0.05)" }}
              >
                {bucket.tasks.length}
              </span>
            </button>
            {isOpen && (
              <div className="rounded-2xl overflow-hidden mb-3" style={{ background: "white", border: "1px solid rgba(0,0,0,0.05)" }}>
                {bucket.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} onClick={() => onTaskClick(t)} onToggle={() => {}} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Sync banner ----------
function SyncBanner({ isOnline, flushing, pendingCount, syncError }) {
  if (syncError) {
    return (
      <div className="px-5 py-2 text-xs flex items-center gap-2" style={{ background: "#FEE2E2", color: "#991B1B" }}>
        <AlertCircle size={12} /> Sync failed: {syncError}
      </div>
    );
  }
  if (!isOnline && pendingCount > 0) {
    return (
      <div className="px-5 py-2 text-xs flex items-center gap-2" style={{ background: "#FEF3C7", color: "#92400E" }}>
        <WifiOff size={12} /> Offline · {pendingCount} unsynced {pendingCount === 1 ? "change" : "changes"} (will sync when online)
      </div>
    );
  }
  if (!isOnline) {
    return (
      <div className="px-5 py-2 text-xs flex items-center gap-2" style={{ background: "#FEF3C7", color: "#92400E" }}>
        <WifiOff size={12} /> Offline · changes will sync when you reconnect
      </div>
    );
  }
  if (flushing && pendingCount > 0) {
    return (
      <div className="px-5 py-2 text-xs flex items-center gap-2" style={{ background: "#DBEAFE", color: "#1E40AF" }}>
        <Loader2 size={12} className="animate-spin" /> Syncing {pendingCount} {pendingCount === 1 ? "change" : "changes"}...
      </div>
    );
  }
  if (pendingCount > 0) {
    return (
      <div className="px-5 py-2 text-xs flex items-center gap-2" style={{ background: "#DBEAFE", color: "#1E40AF" }}>
        <Wifi size={12} /> {pendingCount} {pendingCount === 1 ? "change" : "changes"} pending sync
      </div>
    );
  }
  return null;
}

// ---------- Compact task row ----------
function TaskRow({ task, onClick, onToggle }) {
  const due = fmtDue(task.dueDate);
  const isArchived = task.status === ARCHIVED_STATUS;
  const status = isArchived ? ARCHIVED_STYLE : (STATUSES[task.status] || STATUSES.Pending);
  const done = task.status === DONE_STATUS;
  const faded = done || isArchived;
  const dueLabel = due.text.replace(/^(Overdue|Due soon|Tomorrow) · /, "");

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors active:bg-black/[0.03]"
      style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", opacity: faded ? 0.5 : 1 }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-shrink-0 p-1.5 -m-1.5 transition-transform active:scale-90"
      >
        {done
          ? <CheckCircle2 size={16} style={{ color: "#15803D" }} />
          : <Circle size={16} style={{ color: "#D4C7B0" }} />}
      </button>

      <span
        className="flex-shrink-0 rounded font-semibold uppercase"
        style={{ fontSize: "9px", letterSpacing: "0.06em", padding: "2px 5px", background: status.bg, color: status.color, whiteSpace: "nowrap" }}
      >
        {status.label === "In progress" ? "In prog" : status.label}
      </span>

      <div className="flex-1 min-w-0">
        <p
          className="text-sm leading-tight truncate"
          style={{ color: "#0F0F0F", fontWeight: 500, textDecoration: faded ? "line-through" : "none" }}
        >
          {task.title}
        </p>
        <p className="text-xs truncate leading-tight mt-0.5" style={{ color: "#8A7A5C" }}>{task.property}</p>
      </div>

      <Avatar name={task.assignee} size={20} />

      <span
        className="flex-shrink-0 text-xs font-medium text-right"
        style={{ color: due.overdue ? "#B91C1C" : due.urgent ? "#C2410C" : "#8A7A5C", minWidth: "38px" }}
      >
        {dueLabel}
      </span>
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
      {open && <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
        style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)", color: "#0F0F0F" }}
      >
        <span className="flex items-center gap-2 truncate">
          <MapPin size={14} style={{ color: "#8A7A5C" }} />
          <span className="truncate">{value}</span>
        </span>
        <ChevronDown size={14} style={{ color: "#8A7A5C", transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
      </button>
      {open && (
        <div
          className="absolute top-full mt-2 left-0 right-0 rounded-xl overflow-hidden z-40 fade-anim max-h-72 overflow-y-auto"
          style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 12px 30px -10px rgba(0,0,0,0.2)" }}
        >
          {options.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { onChange(p); setOpen(false); }}
              className="w-full px-3 py-2.5 text-left text-sm flex items-center justify-between"
              style={{ color: "#0F0F0F", background: value === p ? "#FAF6EE" : "white" }}
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

function TaskDetailSheet({ task, createdAt, archivedAt, team, tasks, onClose, onUpdate, onArchive }) {
  const due = fmtDue(task.dueDate);
  const isArchived = task.status === ARCHIVED_STATUS;
  const status = isArchived ? ARCHIVED_STYLE : (STATUSES[task.status] || STATUSES.Pending);
  const waLink = task.phone ? `https://wa.me/${task.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hi ${task.assignee}, regarding ${task.id}: ${task.title}`)}` : null;
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [tempDueDate, setTempDueDate] = useState(task.dueDate);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(task.title);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  useEffect(() => {
    setTempTitle(task.title);
    setTempDueDate(task.dueDate);
    setEditingTitle(false);
    setEditingDueDate(false);
  }, [task.id, task.title, task.dueDate]);

  const handleAssigneeChange = (name) => {
    const knownPhone = phoneFor(name, tasks);
    const patch = { assignee: name };
    if (knownPhone && !task.phone) patch.phone = knownPhone;
    if (knownPhone && task.phone && task.assignee !== name) patch.phone = knownPhone;
    onUpdate(patch);
  };

  const handleTitleSave = () => {
    const nextTitle = tempTitle.trim();
    if (!nextTitle) return;
    if (nextTitle !== task.title) onUpdate({ title: nextTitle });
    setEditingTitle(false);
  };

  const handleDueDateSave = () => {
    if (tempDueDate !== task.dueDate) onUpdate({ dueDate: tempDueDate });
    setEditingDueDate(false);
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const dataUrl = await resizeImage(file);
      onUpdate({ image: dataUrl });
    } catch (err) {
      alert("Photo processing failed: " + err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const photoSrc = driveImageSrc(task.photoUrl) || task.image;
  const createdLine = fmtCreatedAt(createdAt);
  const archivedLine = fmtCreatedAt(archivedAt);

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
          <div className="mb-2 flex flex-col gap-2">
            {editingTitle ? (
              <div className="space-y-2">
                <textarea
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  rows={3}
                  className="w-full bg-transparent outline-none font-display text-2xl leading-tight resize-none"
                  style={{ color: "#0F0F0F", fontWeight: 500 }}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTitleSave}
                    disabled={tempTitle.trim() === task.title.trim() || tempTitle.trim() === ""}
                    className="px-3 py-2 rounded-xl text-sm font-semibold transition active:scale-95"
                    style={{ background: tempTitle.trim() === task.title.trim() || tempTitle.trim() === "" ? "#E5E7EB" : "#0F0F0F", color: tempTitle.trim() === task.title.trim() || tempTitle.trim() === "" ? "#9CA3AF" : "white" }}
                  >
                    Save description
                  </button>
                  <button
                    onClick={() => { setTempTitle(task.title); setEditingTitle(false); }}
                    className="px-3 py-2 rounded-xl text-sm font-semibold transition active:scale-95"
                    style={{ background: "white", color: "#0F0F0F", border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <h2
                className="font-display text-2xl leading-tight mb-0 cursor-text"
                style={{ color: "#0F0F0F", fontWeight: 500 }}
                onClick={() => setEditingTitle(true)}
              >
                {task.title}
              </h2>
            )}
          </div>
          {createdLine && (
            <p className="text-xs" style={{ color: "#8A7A5C" }}>Created {createdLine}</p>
          )}
          {isArchived && archivedLine && (
            <p className="text-xs mb-4" style={{ color: "#8A7A5C" }}>Archived {archivedLine}</p>
          )}
          {(!isArchived || !archivedLine) && createdLine && <div className="mb-4" />}

          <div className="mb-4">
            <p className="uppercase mb-2" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Photo</p>
            {photoSrc ? (
              <div className="relative rounded-2xl overflow-hidden">
                <img
                  src={photoSrc}
                  alt="Task"
                  className="w-full max-h-64 object-cover cursor-pointer"
                  onClick={() => setPhotoViewerOpen(true)}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <label className="absolute bottom-2 right-2 px-2 py-1 rounded-md text-xs font-semibold cursor-pointer flex items-center gap-1" style={{ background: "rgba(0,0,0,0.6)", color: "white" }}>
                  {uploadingPhoto ? <Loader2 size={11} className="animate-spin" /> : null}
                  {uploadingPhoto ? "Uploading..." : "Replace"}
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" disabled={uploadingPhoto} />
                </label>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 w-full py-6 rounded-xl text-sm font-medium cursor-pointer" style={{ background: "white", border: "1px dashed rgba(0,0,0,0.15)", color: "#8A7A5C" }}>
                {uploadingPhoto ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                {uploadingPhoto ? "Uploading..." : "Add photo"}
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" disabled={uploadingPhoto} />
              </label>
            )}
          </div>

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
          <div className="mb-6">
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

          {!isArchived && (
            <div className="mb-2">
              {confirmingArchive ? (
                <div className="rounded-xl p-3 space-y-2" style={{ background: "#FEE2E2", border: "1px solid rgba(185, 28, 28, 0.15)" }}>
                  <p className="text-xs font-medium" style={{ color: "#991B1B" }}>
                    Archive this task? It will be hidden from the main view but preserved in the sheet.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmingArchive(false)}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition active:scale-95"
                      style={{ background: "white", color: "#374151", border: "1px solid rgba(0,0,0,0.08)" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={onArchive}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition active:scale-95"
                      style={{ background: "#B91C1C", color: "white" }}
                    >
                      Yes, archive
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingArchive(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition active:scale-95"
                  style={{ background: "white", color: "#B91C1C", border: "1px solid rgba(185, 28, 28, 0.15)" }}
                >
                  <Trash2 size={14} />
                  Delete task
                </button>
              )}
            </div>
          )}
          {isArchived && (
            <div className="rounded-xl p-3 text-xs" style={{ background: "white", border: "1px solid rgba(0,0,0,0.05)", color: "#6B7280" }}>
              This task has been archived. To restore it, change its status in the Google Sheet directly.
            </div>
          )}
        </div>

        {photoViewerOpen && photoSrc && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.92)" }}
            onClick={() => setPhotoViewerOpen(false)}
          >
            <button
              onClick={() => setPhotoViewerOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
            >
              <X size={18} />
            </button>
            <img src={photoSrc} alt="Task" className="max-w-[95vw] max-h-[90vh] object-contain" />
          </div>
        )}
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
  const [image, setImage] = useState(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [recurrence, setRecurrence] = useState("none");
  const [recurDay, setRecurDay] = useState(5); // 5 = Friday
  const [recurMonthDay, setRecurMonthDay] = useState(() => new Date().getDate());

  const valid = title.trim() && property;
  const previewId = property ? nextIdFor(property, tasks) : "—";

  const handleAssigneeChange = (name) => {
    setAssignee(name);
    if (!phoneEdited) setPhone(phoneFor(name, tasks));
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageProcessing(true);
    try {
      const dataUrl = await resizeImage(file);
      setImage(dataUrl);
    } catch (err) {
      alert("Photo processing failed: " + err.message);
    } finally {
      setImageProcessing(false);
    }
  };

  const removeImage = () => { setImage(null); };

  const submit = () => {
    if (!valid) return;
    const recurringDay = recurrence === "weekly" ? recurDay : recurrence === "monthly" ? recurMonthDay : undefined;
    onCreate({
      title: title.trim(),
      property,
      category: customCategory.trim() || category,
      assignee,
      phone: phone.trim(),
      status: "Pending",
      dueDate,
      image: image || undefined,
      recurring: recurrence,
      recurringDay,
    });
  };

  return (
    <div className="absolute inset-0 z-30 fade-anim" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col sheet-anim" style={{ background: "#FAF6EE", maxHeight: "92%", height: "92%" }} onClick={(e) => e.stopPropagation()}>
        <div className="pt-2 pb-1 flex justify-center"><div className="w-10 h-1 rounded-full" style={{ background: "rgba(0,0,0,0.15)" }} /></div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <button onClick={onClose} className="text-sm font-semibold" style={{ color: "#8A7A5C" }}>Cancel</button>
          <span className="font-display text-base font-semibold" style={{ color: "#0F0F0F" }}>New task</span>
          <button onClick={submit} disabled={!valid || imageProcessing} className="text-sm font-semibold" style={{ color: (valid && !imageProcessing) ? "#0F0F0F" : "#D4C7B0" }}>Create</button>
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
          <AssigneeDropdown value={assignee} onChange={handleAssigneeChange} options={team} allowCustom={true} />
          <div className="mt-4" />
          <FieldGroup label="Phone (for WhatsApp)">
            <input value={phone} onChange={(e) => { setPhone(e.target.value); setPhoneEdited(true); }} placeholder="Auto-filled from assignee" inputMode="tel" className="w-full bg-transparent outline-none text-sm font-medium" style={{ color: "#0F0F0F" }} />
          </FieldGroup>
          <FieldGroup label="Due date">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-transparent outline-none text-sm font-medium" style={{ color: "#0F0F0F" }} />
          </FieldGroup>
          <FieldGroup label="Recurrence">
            <div className="flex gap-2 flex-wrap">
              {RECUR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRecurrence(opt.value)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: recurrence === opt.value ? "#0F0F0F" : "#F5F0E8",
                    color: recurrence === opt.value ? "#FAF6EE" : "#8A7A5C",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {recurrence === "weekly" && (
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {WEEK_DAYS.map((day, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRecurDay(idx)}
                    className="w-9 h-9 rounded-full text-xs font-semibold transition-all"
                    style={{
                      background: recurDay === idx ? "#8A7A5C" : "#F5F0E8",
                      color: recurDay === idx ? "#FAF6EE" : "#8A7A5C",
                    }}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}
            {recurrence === "monthly" && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs" style={{ color: "#8A7A5C" }}>Day of month:</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={recurMonthDay}
                  onChange={(e) => setRecurMonthDay(Math.max(1, Math.min(31, Number(e.target.value))))}
                  className="w-16 text-center rounded-lg px-2 py-1 text-sm font-semibold outline-none"
                  style={{ background: "#F5F0E8", color: "#0F0F0F" }}
                />
              </div>
            )}
          </FieldGroup>
          <FieldGroup label="Photo">
            {image ? (
              <div className="space-y-2">
                <img src={image} alt="Preview" className="w-full rounded-lg max-h-48 object-cover" />
                <button type="button" onClick={removeImage} className="w-full px-3 py-2 rounded-lg text-sm font-semibold transition active:scale-95" style={{ background: "#FEE2E2", color: "#991B1B" }}>
                  Remove image
                </button>
              </div>
            ) : (
              <label className="w-full">
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" disabled={imageProcessing} />
                <div className="w-full px-3 py-2 rounded-lg text-sm font-semibold text-center cursor-pointer transition active:scale-95 flex items-center justify-center gap-2" style={{ background: "#DBEAFE", color: "#1D4ED8" }}>
                  {imageProcessing ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  {imageProcessing ? "Processing..." : "Take photo or upload image"}
                </div>
              </label>
            )}
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
