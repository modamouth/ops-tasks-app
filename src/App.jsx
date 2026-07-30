import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Papa from "papaparse";
import {
  Search, Plus, MapPin, Clock, X, Check, AlertCircle, Settings,
  Inbox, CheckCircle2, Circle, RefreshCw, MoreHorizontal,
  Loader2, ChevronDown, Phone, MessageCircle, Tag, Camera, Trash2,
  Wifi, WifiOff, ChevronRight, ListFilter, ArrowUpDown, Download,
  ClipboardList, Send, Archive,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://wbntrynyoymukhswcvgm.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndibnRyeW55b3ltdWtoc3djdmdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMjUzMDQsImV4cCI6MjEwMDgwMTMwNH0.jtxR8OqtgtYHRdn1PFeXOb91NHhNwJFcfmjc0f-RWZc"
);

// ---------- Environment-configured URLs (set in Vercel dashboard) ----------
const ENV_CSV_URL = import.meta.env.VITE_CSV_URL || "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHe-qEY2VB71JlIVsx40UPWQGGMRXmAuJ0-hWKTmkvbrzJJt6jDJv2Evw9au27nX705LEwwPzkjLr8/pub?output=csv";
const ENV_WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL || "";
const ENV_APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || "";

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

const buildAndSavePDF = (name, tasks) => {
  const outstanding = tasks
    .filter((t) => t.assignee === name && t.status !== DONE_STATUS && t.status !== ARCHIVED_STATUS)
    .sort((a, b) => new Date(a.dueDate || "9999-12-31") - new Date(b.dueDate || "9999-12-31"));

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

const downloadPersonPDF = async (name, csvUrl) => {
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error(`Failed to fetch sheet: HTTP ${res.status}`);
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const allTasks = parsed.data.map(rowToTask).filter((t) => t.id);
  buildAndSavePDF(name, allTasks);
};

const generateChecklistPDF = (form) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const m = 15;
  const cW = pageW - m * 2;
  let y = 20;

  const checkY = (needed = 12) => {
    if (y + needed > 275) { doc.addPage(); y = 18; }
  };

  const sectionTitle = (title) => {
    checkY(14);
    doc.setFillColor(15, 15, 15);
    doc.rect(m, y, cW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(title, m + 3, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 10;
  };

  // Draw a checkbox (square) — filled teal when checked, light grey border when not
  const cb = (checked, label, indent = 0) => {
    checkY(7);
    const sz = 3.2;
    const bx = m + indent;
    const by = y - sz + 0.5;
    doc.setLineWidth(0.25);
    if (checked) {
      doc.setFillColor(15, 76, 92);
      doc.setDrawColor(15, 76, 92);
      doc.rect(bx, by, sz, sz, "FD");
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.55);
      doc.line(bx + 0.55, by + sz * 0.52, bx + sz * 0.42, by + sz * 0.84);
      doc.line(bx + sz * 0.42, by + sz * 0.84, bx + sz - 0.45, by + 0.55);
    } else {
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(180, 180, 180);
      doc.rect(bx, by, sz, sz, "FD");
    }
    doc.setLineWidth(0.2);
    doc.setDrawColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(label, cW - indent - sz - 2.5);
    doc.text(lines, bx + sz + 2, y);
    y += Math.max(5.5, lines.length * 5);
  };

  // Draw a radio button (circle) — filled when selected
  const rb = (selected, label, indent = 0) => {
    checkY(7);
    const r = 1.7;
    const cx = m + indent + r;
    const cy = y - r + 0.4;
    doc.setLineWidth(0.25);
    if (selected) {
      doc.setFillColor(15, 76, 92);
      doc.setDrawColor(15, 76, 92);
      doc.circle(cx, cy, r, "FD");
      doc.setFillColor(255, 255, 255);
      doc.circle(cx, cy, r * 0.42, "F");
    } else {
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(180, 180, 180);
      doc.circle(cx, cy, r, "FD");
    }
    doc.setLineWidth(0.2);
    doc.setDrawColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(label, cW - indent - r * 2 - 2.5);
    doc.text(lines, m + indent + r * 2 + 1.5, y);
    y += Math.max(5.5, lines.length * 5);
  };

  const bodyText = (text, indent = 0) => {
    if (!text) { checkY(6); doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.text("—", m + indent, y); y += 6; return; }
    const lines = doc.splitTextToSize(text, cW - indent);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    lines.forEach((line) => { checkY(6); doc.text(line, m + indent, y); y += 5; });
  };

  const boldLabel = (label) => {
    checkY(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label, m, y);
    y += 5;
  };

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Lift Breakdown / Maintenance Incident Report", m, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("RCA & Corrective Actions Checklist", m, y);
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, m + cW, y);
  y += 6;

  // Lift Details
  autoTable(doc, {
    startY: y,
    margin: { left: m, right: m },
    head: [["Lift Details", ""]],
    body: [
      ["Building / Location", form.building || "—"],
      ["Lift Identification", form.liftId || "—"],
      ["Date of Failure", form.dateOfFailure || "—"],
      ["Time of Failure", form.timeOfFailure || "—"],
      ["Time Reported", form.timeReported || "—"],
      ["Time Technician Arrived", form.timeTechArrived || "—"],
      ["Time Lift Restored", form.timeLiftRestored || "—"],
      ["Service Provider", form.serviceProvider || "—"],
      ["Technician Name", form.technicianName || "—"],
      ["Incident Reference No.", form.incidentRef || "—"],
    ],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 15, 15], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Section 1
  sectionTitle("1. Root Cause Analysis (RCA)");
  cb(form.rcaCompleted, "Detailed RCA completed and attached");
  y += 2;
  boldLabel("Actual Cause of Failure:");
  bodyText(form.actualCause, 3);
  y += 2;
  boldLabel("Failure Category:");
  [
    ["electrical", "Electrical Fault"],
    ["mechanical", "Mechanical Fault"],
    ["control", "Control System Fault"],
    ["door", "Door System Fault"],
    ["safety", "Safety Circuit Fault"],
    ["external", "External Cause (Power Surge / Electrical Disturbance / Other)"],
    ["other", "Other: " + (form.failureCategoryOther || "")],
  ].forEach(([key, label]) => rb(form.failureCategory === key, label, 3));
  y += 2;
  boldLabel("Description of Failure:");
  bodyText(form.failureDescription, 3);
  y += 4;

  // Section 2
  sectionTitle("2. Corrective Actions Undertaken");
  cb(form.correctiveActionsCompleted, "Corrective actions completed and documented");
  y += 2;
  const corrRows = (form.correctiveActions || []).filter((r) => r.action || r.dateCompleted || r.technician);
  if (corrRows.length) {
    autoTable(doc, {
      startY: y, margin: { left: m, right: m },
      head: [["Action", "Date Completed", "Technician"]],
      body: corrRows.map((r) => [r.action || "", r.dateCompleted || "", r.technician || ""]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255] },
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 35 } },
    });
    y = doc.lastAutoTable.finalY + 6;
  } else {
    doc.setFont("helvetica", "italic"); doc.setFontSize(9);
    doc.text("No corrective actions recorded.", m + 3, y); y += 8;
  }

  // Section 3
  sectionTitle("3. Components Repaired / Adjusted / Tested / Replaced");
  const compRows = (form.components || []).filter((r) => r.component || r.actionTaken || r.partNumber);
  if (compRows.length) {
    autoTable(doc, {
      startY: y, margin: { left: m, right: m },
      head: [["Component", "Action Taken", "Part Number", "Date Completed"]],
      body: compRows.map((r) => [r.component || "", r.actionTaken || "", r.partNumber || "", r.dateCompleted || ""]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255] },
    });
    y = doc.lastAutoTable.finalY + 4;
  } else {
    doc.setFont("helvetica", "italic"); doc.setFontSize(9);
    doc.text("No components recorded.", m + 3, y); y += 6;
  }
  cb(form.componentsRecorded, "All replaced components recorded");
  cb(form.testingCompleted, "Testing completed after repairs");
  cb(form.safetyChecksCompleted, "Lift safety checks completed");
  y += 4;

  // Section 4
  sectionTitle("4. Temporary Measures Implemented");
  cb(form.tempMeasuresImplemented, "Temporary measures implemented to restore service");
  y += 2;
  boldLabel("Details of Temporary Measures:");
  bodyText(form.tempMeasuresDetails, 3);
  y += 2;
  checkY(8);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("Duration: From", m, y);
  doc.setFont("helvetica", "normal");
  doc.text((form.tempMeasuresFrom || "—") + "   To:  " + (form.tempMeasuresTo || "—"), m + 32, y);
  y += 6;
  cb(form.tempMeasureRemoved, "Temporary measure removed after permanent repair");
  cb(form.tempMeasureStillActive, "Temporary measure still active");
  y += 4;

  // Section 5
  sectionTitle("5. Outstanding Remedial Actions");
  const outRows = (form.outstandingActions || []).filter((r) => r.action || r.responsiblePerson || r.dueDate || r.status);
  if (outRows.length) {
    autoTable(doc, {
      startY: y, margin: { left: m, right: m },
      head: [["Outstanding Action", "Responsible Person", "Due Date", "Status"]],
      body: outRows.map((r) => [r.action || "", r.responsiblePerson || "", r.dueDate || "", r.status || ""]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255] },
    });
    y = doc.lastAutoTable.finalY + 4;
  } else {
    doc.setFont("helvetica", "italic"); doc.setFontSize(9);
    doc.text("No outstanding actions recorded.", m + 3, y); y += 6;
  }
  cb(form.noOutstandingActions, "No outstanding actions");
  cb(form.outstandingCommunicated, "Outstanding actions communicated to Facilities Management");
  y += 4;

  // Section 6
  sectionTitle("6. Residual Operational / Reliability / Safety Risks");
  boldLabel("Remaining Risks Identified:");
  cb(form.noResidualRisks, "No residual risks identified", 3);
  cb(form.operationalRisk, "Operational Risk", 3);
  cb(form.reliabilityRisk, "Reliability Risk", 3);
  cb(form.safetyRisk, "Safety Risk", 3);
  cb(form.complianceRisk, "Compliance Risk", 3);
  y += 2;
  boldLabel("Risk Details:");
  bodyText(form.riskDetails, 3);
  y += 2;
  boldLabel("Recommended Mitigation Measures:");
  bodyText(form.mitigationMeasures, 3);
  y += 4;

  // Section 7
  sectionTitle("7. Final Verification & Sign-Off");
  boldLabel("Lift Operational Status:");
  rb(form.operationalStatus === "fully", "Fully Operational", 3);
  rb(form.operationalStatus === "monitoring", "Operational with Monitoring Required", 3);
  rb(form.operationalStatus === "outofservice", "Out of Service", 3);
  y += 2;
  boldLabel("Final Testing Completed:");
  rb(form.finalTestingCompleted === true, "Yes", 3);
  rb(form.finalTestingCompleted === false, "No", 3);
  y += 2;
  boldLabel("Monitoring Period Required:");
  bodyText(form.monitoringPeriod, 3);
  y += 4;

  checkY(32);
  autoTable(doc, {
    startY: y, margin: { left: m, right: m },
    body: [
      ["Service Provider Confirmation", "", "Facilities Management Verification", ""],
      ["Name:", form.serviceProviderName || "", "Name:", form.fmName || ""],
      ["Date:", form.serviceProviderDate || "", "Date:", form.fmDate || ""],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 }, 2: { fontStyle: "bold", cellWidth: 55 } },
  });
  y = doc.lastAutoTable.finalY + 4;

  boldLabel("Landlord Notification Completed:");
  rb(form.landlordNotified === true, "Yes", 3);
  rb(form.landlordNotified === false, "No", 3);
  y += 2;
  boldLabel("Incident Closed Date:");
  bodyText(form.incidentClosedDate, 3);

  return doc;
};

const generateGeneratorPDF = (form) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = 15;
  const cW = pageW - m * 2;
  let y = m;

  const checkY = (needed = 20) => {
    if (y + needed > pageH - m) { doc.addPage(); y = m; }
  };

  const sectionTitle = (title) => {
    checkY(12);
    doc.setFillColor(15, 15, 15);
    doc.rect(m, y, cW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(title, m + 3, y + 5);
    doc.setTextColor(15, 15, 15);
    y += 10;
  };

  // Title block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 15, 15);
  doc.text("Generator Information Audit", m, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(138, 122, 92);
  doc.text("Tenant & Centre Generator Audit: Installation, Diesel Storage & COC Certificates", m, y);
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, m + cW, y);
  doc.setTextColor(15, 15, 15);
  y += 6;

  // Header details table
  autoTable(doc, {
    startY: y,
    margin: { left: m, right: m },
    head: [["Report Details", ""]],
    body: [
      ["Building / Location", form.building || "—"],
      ["Incident Reference No.", form.incidentRef || "—"],
      ["Recipient Email", form.recipientEmail || "—"],
    ],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 15, 15], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
    alternateRowStyles: { fillColor: [250, 246, 238] },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Tenant generators section
  sectionTitle("1. Tenant Generator Information");
  autoTable(doc, {
    startY: y,
    margin: { left: m, right: m },
    head: [["Premises / Unit", "Tenant Name", "Trading Name", "Generator\nInstalled", "Photo of\nInstallation", "Diesel\non Site", "Diesel\nAmount", "COC\nCert."]],
    body: form.tenantRows.map((r) => [
      r.premises || "—",
      r.tenantName || "—",
      r.tradingName || "—",
      r.generatorInstalled || "—",
      r.pictureOfInstallation || "—",
      r.dieselOnSite || "—",
      r.dieselOnSite === "Yes" ? (r.amountOfDiesel || "—") : "—",
      r.cocCertificate || "—",
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 15, 15], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 22 },
      4: { cellWidth: 24 },
      5: { cellWidth: 14 },
      6: { cellWidth: 22 },
      7: { cellWidth: 14 },
    },
    alternateRowStyles: { fillColor: [250, 246, 238] },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Centre generators section
  sectionTitle("2. Generator for Centre");
  autoTable(doc, {
    startY: y,
    margin: { left: m, right: m },
    head: [["Type", "Size / kVA", "Serial Numbers", "Diesel Stored", "Area / Items Covered"]],
    body: form.centreGenerators.map((r) => [
      r.type || "—",
      r.size || "—",
      r.serialNumbers || "—",
      r.amountOfDiesel || "—",
      r.areaCovered || "—",
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 15, 15], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 24 },
      2: { cellWidth: 44 },
      3: { cellWidth: 30 },
    },
    alternateRowStyles: { fillColor: [250, 246, 238] },
  });
  y = doc.lastAutoTable.finalY + 6;

  // Incident ref footer
  if (form.incidentRef) {
    checkY(8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(138, 122, 92);
    doc.text(`Ref: ${form.incidentRef}`, m, y);
    doc.setTextColor(15, 15, 15);
  }

  // Installation photos — one per page (portrait)
  const photoRows = (form.tenantRows || []).filter((r) => r.pictureOfInstallation === "Yes" && r.installationPhoto);
  if (photoRows.length > 0) {
    photoRows.forEach((row) => {
      doc.addPage();
      let py = m;
      doc.setFillColor(15, 15, 15);
      doc.rect(m, py, cW, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text("Installation Photo", m + 3, py + 5);
      doc.setTextColor(15, 15, 15);
      py += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(138, 122, 92);
      const label = [row.premises, row.tenantName, row.tradingName].filter(Boolean).join(" · ");
      doc.text(label || "Tenant", m, py);
      doc.setTextColor(15, 15, 15);
      py += 6;
      const maxW = cW;
      const maxH = pageH - py - m;
      const img = new Image();
      img.src = row.installationPhoto;
      const iW = img.naturalWidth || 1200;
      const iH = img.naturalHeight || 900;
      const ratio = Math.min(maxW / iW, maxH / iH);
      doc.addImage(row.installationPhoto, "JPEG", m, py, iW * ratio, iH * ratio);
    });
  }

  return doc;
};

const BCA_SECTIONS = [
  { key: "siteExterior", title: "1. Site & Exterior", items: [
    "Paving, parking areas & driveways",
    "Boundary walls, fencing & gates",
    "Stormwater drainage & site grading",
    "Landscaping & retaining structures",
    "Site lighting",
    "Signage",
    "Refuse/waste enclosures",
  ]},
  { key: "structural", title: "2. Structural", items: [
    "Foundations",
    "Columns & load-bearing walls",
    "Floor slabs / structural floors",
    "Roof structure & trusses",
    "Beams & lintels",
    "Visible cracking, corrosion or deflection",
  ]},
  { key: "buildingEnvelope", title: "3. Building Envelope", items: [
    "Roof covering & waterproofing",
    "Gutters, downpipes & flashing",
    "External walls / cladding / render",
    "Windows & external doors",
    "Sealants & expansion joints",
    "Damp-proofing / rising damp evidence",
  ]},
  { key: "electrical", title: "4. Electrical", items: [
    "Main distribution board(s) & sub-boards",
    "Reticulation / wiring condition",
    "Lighting (internal & external)",
    "Standby generator / UPS",
    "Earthing & lightning protection",
    "Metering",
  ]},
  { key: "mechanical", title: "5. Mechanical / HVAC", items: [
    "Air-conditioning units (split/central)",
    "Ventilation & extraction systems",
    "Ducting & insulation",
    "Boilers / geysers / hot water systems",
  ]},
  { key: "plumbing", title: "6. Plumbing & Drainage", items: [
    "Water supply reticulation & pressure",
    "Sanitary drainage & sewer lines",
    "Sanitary fittings & fixtures",
    "Water storage tanks & pumps",
    "Stormwater / roof drainage connections",
  ]},
  { key: "fire", title: "7. Fire & Life Safety", items: [
    "Fire detection & alarm system",
    "Fire extinguishers & hose reels",
    "Sprinkler system",
    "Emergency lighting & signage",
    "Fire escape routes & doors",
    "Fire pump & fire water storage",
  ]},
  { key: "verticalTransport", title: "8. Vertical Transportation", items: [
    "Passenger lifts",
    "Goods lifts",
    "Escalators",
    "Stairs & handrails",
  ]},
  { key: "interiorFinishes", title: "9. Interior Finishes", items: [
    "Floor finishes",
    "Wall finishes / partitions",
    "Ceilings",
    "Internal doors & ironmongery",
    "Ablutions / kitchenettes",
  ]},
  { key: "accessibility", title: "10. Accessibility & Compliance", items: [
    "Ramps & accessible entrances",
    "Accessible parking & ablutions",
    "Occupational health & safety compliance",
    "Statutory certificates / COCs on file",
  ]},
];

const generateBCAPDF = (form) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = 15;
  const cW = pageW - m * 2;
  let y = m;

  const checkY = (needed = 20) => {
    if (y + needed > pageH - m) { doc.addPage(); y = m; }
  };

  const sectionTitle = (title) => {
    checkY(20);
    doc.setFillColor(15, 15, 15);
    doc.rect(m, y, cW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(title, m + 3, y + 5);
    doc.setTextColor(15, 15, 15);
    y += 10;
  };

  // Title block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 15, 15);
  doc.text("Building Condition Assessment", m, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(138, 122, 92);
  doc.text("Site Inspection Checklist", m, y);
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, m + cW, y);
  doc.setTextColor(15, 15, 15);
  y += 6;

  // Header details
  autoTable(doc, {
    startY: y,
    margin: { left: m, right: m },
    head: [["Inspection Details", ""]],
    body: [
      ["Property / Building", form.building || "—"],
      ["Date of Inspection", form.date || "—"],
      ["Inspector", form.inspector || "—"],
      ["Reference No.", form.incidentRef || "—"],
    ],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 15, 15], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
    alternateRowStyles: { fillColor: [250, 246, 238] },
  });
  y = doc.lastAutoTable.finalY + 6;

  // Condition / Priority legend
  checkY(8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 15, 15);
  doc.text("Condition:", m, y);
  doc.setFont("helvetica", "normal");
  doc.text("G=Good  F=Fair  P=Poor  C=Critical", m + 17, y);
  doc.setFont("helvetica", "bold");
  doc.text("Priority:", m + 75, y);
  doc.setFont("helvetica", "normal");
  doc.text("1=Immediate (0–12mo)  2=Short-term (1–3yr)  3=Medium-term (3–5yr)  4=Long-term (5–10yr+)", m + 91, y);
  y += 8;

  // Sections
  BCA_SECTIONS.forEach((section) => {
    sectionTitle(section.title);
    const sectionRows = form.rows?.[section.key] || [];
    autoTable(doc, {
      startY: y,
      margin: { left: m, right: m },
      head: [["✓", "Item", "Condition", "Priority", "Notes"]],
      body: section.items.map((item, i) => {
        const row = sectionRows[i] || {};
        return [
          row.inspected ? "✓" : "",
          item,
          row.condition || "—",
          row.priority ? `${row.priority}` : "—",
          row.notes || "",
        ];
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 15, 15], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 80 },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 50 },
      },
      alternateRowStyles: { fillColor: [250, 246, 238] },
    });
    y = doc.lastAutoTable.finalY + 5;
  });

  // Inspector sign-off
  sectionTitle("Inspector Sign-off");
  autoTable(doc, {
    startY: y,
    margin: { left: m, right: m },
    head: [["Name", "Signature"]],
    body: [[form.inspector || "", ""]],
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [15, 15, 15], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 90 } },
  });

  // Inspection photos — one page per photo, grouped by item
  BCA_SECTIONS.forEach((section) => {
    const sectionRows = form.rows?.[section.key] || [];
    section.items.forEach((item, i) => {
      const row = sectionRows[i] || {};
      const photos = row.photos?.length ? row.photos : (row.photo ? [row.photo] : []);
      photos.forEach((photo, photoIdx) => {
        doc.addPage();
        let py = m;
        doc.setFillColor(15, 15, 15);
        doc.rect(m, py, cW, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        const pageLabel = photos.length > 1 ? `Inspection Photo (${photoIdx + 1} of ${photos.length})` : "Inspection Photo";
        doc.text(pageLabel, m + 3, py + 5);
        doc.setTextColor(15, 15, 15);
        py += 10;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(138, 122, 92);
        doc.text(section.title, m, py);
        py += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(15, 15, 15);
        doc.text(item, m, py);
        py += 5;
        const meta = [];
        if (row.condition) meta.push(`Condition: ${row.condition}`);
        if (row.priority) meta.push(`Priority: ${row.priority}`);
        if (row.notes) meta.push(`Notes: ${row.notes}`);
        if (meta.length) {
          doc.setFontSize(8);
          doc.setTextColor(138, 122, 92);
          doc.text(meta.join("   ·   "), m, py);
          doc.setTextColor(15, 15, 15);
          py += 6;
        }
        const imgEl = new Image();
        imgEl.src = photo;
        const maxW = cW;
        const maxH = pageH - py - m;
        const iW = imgEl.naturalWidth || 1200;
        const iH = imgEl.naturalHeight || 900;
        const ratio = Math.min(maxW / iW, maxH / iH);
        doc.addImage(photo, "JPEG", m, py, iW * ratio, iH * ratio);
      });
    });
  });

  return doc;
};

const BUILDING_CODES = {
  "269 Independence": "IND",
  "44 On Post": "ONP",
  "Arandis Convenience Centre": "ARA",
  "Forum Building": "FOR",
  "Katutura Shopping Centre": "KAT",
  "Keetmanshoop Shopping Centre": "KEE",
  "Kenya House": "KEN",
  "Maerua Lifestyle Shopping Centre": "MAE",
  "Mediva House": "MED",
  "Mutual Tower": "MUT",
  "Ondangwa": "OND",
  "Oshakati Shopping Centre": "OSA",
  "Oshikango Shopping Centre": "OSK",
  "Otjivanda Shopping Centre": "OTJ",
  "Rehoboth Shopping Centre": "REH",
  "Schuster House": "SCH",
  "Windhoek Sanlam Centre": "WSC",
};

const CHECKLIST_TYPE_CODES = { "lift-rca": "LRCA", "generator-info": "GENI", "bca-site": "BCAS" };

const generateIncidentRef = async (building, checklistId) => {
  const code = BUILDING_CODES[building];
  if (!code) return "";
  const typeCode = CHECKLIST_TYPE_CODES[checklistId] || "CHK";
  const year = new Date().getFullYear();
  try {
    const { count } = await supabase
      .from("checklist_submissions")
      .select("*", { count: "exact", head: true })
      .eq("building", building)
      .eq("checklist_id", checklistId)
      .gte("submitted_at", `${year}-01-01T00:00:00.000Z`)
      .lt("submitted_at", `${year + 1}-01-01T00:00:00.000Z`);
    return `${code}-${typeCode}-${year}-${String((count || 0) + 1).padStart(3, "0")}`;
  } catch {
    return `${code}-${typeCode}-${year}-001`;
  }
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

const CHECKLIST_ID = new URLSearchParams(window.location.search).get("checklist");
const EDIT_ID = new URLSearchParams(window.location.search).get("edit");

// Registry — add future checklists here
const CHECKLIST_REGISTRY = [
  {
    id: "lift-rca",
    name: "Lift Breakdown / Maintenance",
    description: "Root Cause Analysis & Corrective Actions for lift failure incidents",
    category: "Mechanical",
    FormComponent: (props) => <LiftRCASheet {...props} />,
    generatePDF: generateChecklistPDF,
  },
  {
    id: "generator-info",
    name: "Generator Information",
    description: "Tenant and centre generator audit: installation, diesel storage, and COC certificates",
    category: "Electrical",
    FormComponent: (props) => <GeneratorSheet {...props} />,
    generatePDF: generateGeneratorPDF,
  },
  {
    id: "bca-site",
    name: "Building Condition Assessment",
    description: "Site inspection checklist covering structural, electrical, mechanical, fire safety and compliance",
    category: "General",
    FormComponent: (props) => <BCASheet {...props} />,
    generatePDF: generateBCAPDF,
  },
];

// ---------- Standalone edit page (loaded via ?edit=<uuid>) ----------
function StandaloneEditPage({ submissionId }) {
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from("checklist_submissions")
      .select("*")
      .eq("id", submissionId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else setSubmission(data);
        setLoading(false);
      });
  }, [submissionId]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={24} className="animate-spin" style={{ color: "#8A7A5C" }} />
    </div>
  );

  if (notFound) return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center">
      <p className="font-display text-2xl mb-2" style={{ color: "#0F0F0F" }}>Report not found</p>
      <p className="text-sm" style={{ color: "#8A7A5C" }}>This link may be invalid or the report has been removed.</p>
    </div>
  );

  const entry = CHECKLIST_REGISTRY.find((c) => c.id === submission.checklist_id);
  if (!entry) return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center">
      <p className="font-display text-2xl mb-2" style={{ color: "#0F0F0F" }}>Unknown checklist type</p>
    </div>
  );

  return (
    <entry.FormComponent
      webhookUrl={ENV_WEBHOOK_URL}
      standalone
      name={entry.name}
      initialData={submission.form_data}
      submissionId={submission.id}
      onSave={async (formData, fileName, existingId) => {
        await supabase.from("checklist_submissions").update({
          form_data: formData,
          pdf_file_name: fileName,
          incident_ref: formData.incidentRef,
          building: formData.building,
          lift_id: formData.liftId,
          date_of_failure: formData.dateOfFailure,
          submitted_at: new Date().toISOString(),
        }).eq("id", existingId);
        return existingId;
      }}
    />
  );
}

// ---------- Main ----------
export default function App() {
  // Standalone public checklist — no auth, no task board
  if (CHECKLIST_ID || EDIT_ID) {
    const entry = CHECKLIST_ID ? CHECKLIST_REGISTRY.find((c) => c.id === CHECKLIST_ID) : null;
    return (
      <div className="min-h-screen w-full" style={{ background: "#FAF6EE" }}>
        <style>{`
          .font-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { scrollbar-width: none; }
        `}</style>
        {EDIT_ID ? (
          <StandaloneEditPage submissionId={EDIT_ID} />
        ) : entry ? (
          <entry.FormComponent
            webhookUrl={ENV_WEBHOOK_URL}
            standalone
            name={entry.name}
            onSave={async (formData, fileName) => {
              const { data } = await supabase
                .from("checklist_submissions")
                .insert({
                  checklist_id: entry.id,
                  incident_ref: formData.incidentRef,
                  building: formData.building,
                  lift_id: formData.liftId,
                  date_of_failure: formData.dateOfFailure,
                  submitted_at: new Date().toISOString(),
                  pdf_file_name: fileName,
                  form_data: formData,
                })
                .select("id")
                .single();
              return data?.id || null;
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center">
            <p className="font-display text-2xl mb-2" style={{ color: "#0F0F0F" }}>Checklist not found</p>
            <p className="text-sm" style={{ color: "#8A7A5C" }}>This link may be invalid or the checklist has been removed.</p>
          </div>
        )}
      </div>
    );
  }

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
  const [passwordOverride, setPasswordOverride] = usePersistedState("ops.password", "");
  const [groupBy, setGroupBy] = usePersistedState("ops.groupBy", "none");
  const [sortBy, setSortBy] = usePersistedState("ops.sortBy", "overdue");

  const csvUrl = ENV_CSV_URL || csvOverride;
  const webhookUrl = ENV_WEBHOOK_URL || webhookOverride;
  const appPassword = ENV_APP_PASSWORD || passwordOverride;

  const [authed, setAuthed] = useState(() => {
    if (!appPassword) return true;
    return localStorage.getItem("ops.auth") === btoa(appPassword);
  });

  // Re-check auth whenever the configured password changes.
  useEffect(() => {
    if (!appPassword) { setAuthed(true); return; }
    setAuthed(localStorage.getItem("ops.auth") === btoa(appPassword));
  }, [appPassword]);

  const tryUnlock = (entered) => {
    if (entered === appPassword) {
      localStorage.setItem("ops.auth", btoa(appPassword));
      setAuthed(true);
      return true;
    }
    return false;
  };

  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [flushing, setFlushing] = useState(false);
  const flushingRef = useRef(false);

  const [activeStatus, setActiveStatus] = useState("all");
  const [activeProperty, setActiveProperty] = useState("All properties");
  const [search, setSearch] = useState("");
  const [openTask, setOpenTask] = useState(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
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

  if (!authed) return <LoginScreen onUnlock={tryUnlock} />;

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
              <button onClick={() => setChecklistOpen(true)} className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95" title="Lift RCA Checklist" style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)" }}>
                <ClipboardList size={15} />
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
                  disabled={pdfDownloading}
                  onClick={async () => {
                    setPdfDownloading(true);
                    try { await downloadPersonPDF(matchedName, csvUrl); }
                    catch (e) { alert("PDF failed: " + e.message); }
                    finally { setPdfDownloading(false); }
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95"
                  style={{ background: "#0F4C5C", color: "white", opacity: pdfDownloading ? 0.6 : 1 }}
                  title="Download outstanding tasks as PDF"
                >
                  {pdfDownloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
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
        {checklistOpen && (
          <ChecklistDashboard
            webhookUrl={webhookUrl}
            onClose={() => setChecklistOpen(false)}
          />
        )}
        {settingsOpen && (
          <SettingsSheet
            envCsvUrl={ENV_CSV_URL}
            envWebhookUrl={ENV_WEBHOOK_URL}
            envPassword={ENV_APP_PASSWORD}
            csvOverride={csvOverride}
            webhookOverride={webhookOverride}
            passwordOverride={passwordOverride}
            onSave={(c, w, p) => { setCsvOverride(c); setWebhookOverride(w); setPasswordOverride(p); setSettingsOpen(false); if (csvUrl) refresh(); }}
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

function LoginScreen({ onUnlock }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const attempt = () => {
    if (onUnlock(pw)) {
      setError(false);
    } else {
      setError(true);
      setPw("");
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-8" style={{ background: "#FAF6EE" }}>
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ background: "#0F0F0F" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "#8A7A5C" }}>Operations</p>
        <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "#0F0F0F" }}>Welcome back</h1>
        <p className="text-sm mb-8 text-center" style={{ color: "#8A7A5C" }}>Enter the password to access the task board</p>

        <div className="w-full rounded-2xl px-4 py-3 mb-3 flex items-center gap-3" style={{ background: "white", border: error ? "1.5px solid #B91C1C" : "1px solid rgba(0,0,0,0.08)" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={error ? "#B91C1C" : "#8A7A5C"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input
            ref={inputRef}
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setError(false); }}
            onKeyDown={(e) => e.key === "Enter" && attempt()}
            placeholder="Password"
            className="flex-1 bg-transparent outline-none text-sm font-medium"
            style={{ color: "#0F0F0F" }}
          />
        </div>
        {error && <p className="text-xs font-semibold mb-3" style={{ color: "#B91C1C" }}>Incorrect password — try again</p>}

        <button
          onClick={attempt}
          disabled={!pw}
          className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
          style={{ background: pw ? "#0F0F0F" : "#E5DFD5", color: pw ? "white" : "#8A7A5C" }}
        >
          Unlock
        </button>
      </div>
    </div>
  );
}

function SettingsSheet({ envCsvUrl, envWebhookUrl, envPassword, csvOverride, webhookOverride, passwordOverride, onSave, onClose }) {
  const [c, setC] = useState(csvOverride);
  const [w, setW] = useState(webhookOverride);
  const [p, setP] = useState(passwordOverride);
  const [showPw, setShowPw] = useState(false);
  const csvManaged = !!envCsvUrl;
  const webhookManaged = !!envWebhookUrl;
  const passwordManaged = !!envPassword;

  return (
    <div className="absolute inset-0 z-30 fade-anim" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col sheet-anim" style={{ background: "#FAF6EE", maxHeight: "85%" }} onClick={(e) => e.stopPropagation()}>
        <div className="pt-2 pb-1 flex justify-center"><div className="w-10 h-1 rounded-full" style={{ background: "rgba(0,0,0,0.15)" }} /></div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <button onClick={onClose} className="text-sm font-semibold" style={{ color: "#8A7A5C" }}>Cancel</button>
          <span className="font-display text-base font-semibold" style={{ color: "#0F0F0F" }}>Connections</span>
          <button onClick={() => onSave(c, w, p)} className="text-sm font-semibold" style={{ color: "#0F0F0F" }}>Save</button>
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
          {(csvManaged || webhookManaged) && <p className="text-xs mt-3 mb-4" style={{ color: "#8A7A5C" }}>To change managed URLs, update environment variables in your Vercel project settings.</p>}
          <div className="rounded-xl px-4 py-3 mb-3" style={{ background: passwordManaged ? "#F0EBE0" : "white", border: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="uppercase mb-1" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>App Password</div>
            {passwordManaged ? (
              <p className="text-sm" style={{ color: "#8A7A5C" }}>Configured via Vercel</p>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type={showPw ? "text" : "password"}
                  value={p}
                  onChange={(e) => setP(e.target.value)}
                  placeholder="Leave blank to disable login"
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: "#0F0F0F" }}
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="text-xs" style={{ color: "#8A7A5C" }}>
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            )}
          </div>
          {!passwordManaged && <p className="text-xs" style={{ color: "#8A7A5C" }}>Set a password to require login. Leave blank for no login screen.</p>}
        </div>
      </div>
    </div>
  );
}

const GENERATOR_INITIAL = {
  building: "",
  incidentRef: "",
  recipientEmail: "",
  tenantRows: [{ premises: "", tenantName: "", tradingName: "", generatorInstalled: "", pictureOfInstallation: "", installationPhoto: "", dieselOnSite: "", amountOfDiesel: "", cocCertificate: "" }],
  centreGenerators: [{ type: "", size: "", serialNumbers: "", amountOfDiesel: "", areaCovered: "" }],
};

function GeneratorSheet({ webhookUrl, onClose, standalone = false, name = "Generator Information", onSave, initialData = null, submissionId = null }) {
  const [form, setForm] = useState(initialData || GENERATOR_INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [savedId, setSavedId] = useState(submissionId);
  const [linkCopied, setLinkCopied] = useState(false);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  useEffect(() => {
    if (submissionId) return;
    if (form.building) {
      generateIncidentRef(form.building, "generator-info").then((ref) => set("incidentRef", ref));
    } else {
      set("incidentRef", "");
    }
  }, [form.building]);

  const addTenantRow = () => setForm((f) => ({ ...f, tenantRows: [...f.tenantRows, { premises: "", tenantName: "", tradingName: "", generatorInstalled: "", pictureOfInstallation: "", installationPhoto: "", dieselOnSite: "", amountOfDiesel: "", cocCertificate: "" }] }));
  const removeTenantRow = (i) => setForm((f) => ({ ...f, tenantRows: f.tenantRows.filter((_, idx) => idx !== i) }));
  const updateTenantRow = (i, field, val) => setForm((f) => ({ ...f, tenantRows: f.tenantRows.map((r, idx) => idx === i ? { ...r, [field]: val } : r) }));

  const addCentreRow = () => setForm((f) => ({ ...f, centreGenerators: [...f.centreGenerators, { type: "", size: "", serialNumbers: "", amountOfDiesel: "", areaCovered: "" }] }));
  const removeCentreRow = (i) => setForm((f) => ({ ...f, centreGenerators: f.centreGenerators.filter((_, idx) => idx !== i) }));
  const updateCentreRow = (i, field, val) => setForm((f) => ({ ...f, centreGenerators: f.centreGenerators.map((r, idx) => idx === i ? { ...r, [field]: val } : r) }));

  const downloadPDF = () => {
    const fileName = `generator-info-${form.incidentRef || form.building || "report"}-${new Date().toISOString().slice(0, 10)}.pdf`;
    generateGeneratorPDF(form).save(fileName);
  };

  const handleSubmit = async () => {
    if (!form.building) { setSubmitError("Please select a building."); return; }
    if (!form.recipientEmail.trim()) { setSubmitError("Please enter a recipient email address."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      let finalForm = form;
      if (!submissionId && form.building) {
        const freshRef = await generateIncidentRef(form.building, "generator-info");
        finalForm = { ...form, incidentRef: freshRef };
        setForm(finalForm);
      }
      const fileName = `generator-info-${finalForm.incidentRef || finalForm.building || "report"}-${new Date().toISOString().slice(0, 10)}.pdf`;
      const doc = generateGeneratorPDF(finalForm);
      const pdfBase64 = doc.output("datauristring");

      let resolvedId = submissionId;
      if (standalone && !submissionId && onSave) {
        resolvedId = await onSave(finalForm, fileName, null);
      }

      const editLink = resolvedId ? `${window.location.origin}${window.location.pathname}?edit=${resolvedId}` : null;

      if (webhookUrl) {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "checklist_submission",
            timestamp: new Date().toISOString(),
            recipientEmail: finalForm.recipientEmail,
            incidentRef: finalForm.incidentRef,
            building: finalForm.building,
            formData: finalForm,
            pdfBase64,
            pdfFileName: fileName,
            editLink,
          }),
        });
        if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
      } else {
        doc.save(fileName);
      }

      if (onSave && !(standalone && !submissionId)) {
        const retId = await onSave(finalForm, fileName, resolvedId);
        if (retId && !resolvedId) resolvedId = retId;
      }

      setSavedId(resolvedId);
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e.message || "Submission failed — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => { setForm(GENERATOR_INITIAL); setSubmitted(false); setSubmitError(""); setSavedId(null); };

  const wrapperCls = standalone ? "min-h-screen flex flex-col" : "absolute inset-0 flex flex-col sheet-anim";
  const content = (
    <div className={wrapperCls} style={{ background: "#FAF6EE" }}>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#FAF6EE" }}>
        {standalone ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#0F0F0F" }}>
              <ClipboardList size={13} style={{ color: "white" }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8A7A5C" }}>Generator Audit</span>
          </div>
        ) : (
          <button onClick={onClose} className="text-sm font-semibold flex items-center gap-1" style={{ color: "#8A7A5C" }}>← Back</button>
        )}
        <span className="font-display text-base font-semibold" style={{ color: "#0F0F0F" }}>{name}</span>
        <div className="flex items-center gap-2">
          {!submitted && (
            <button onClick={downloadPDF} title="Download PDF"
              className="flex items-center justify-center w-8 h-8 rounded-xl transition-all active:scale-95"
              style={{ background: "#F0EBE0", color: "#3F3A2E" }}>
              <Download size={14} />
            </button>
          )}
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: submitting ? "#E5DFD5" : "#0F0F0F", color: submitting ? "#8A7A5C" : "white" }}>
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={12} />}
            {submitting ? (submissionId ? "Updating…" : "Sending…") : (submissionId ? "Update" : "Submit")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-3 pb-8">
        {submitted ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: "#DCFCE7" }}>
              <CheckCircle2 size={28} style={{ color: "#15803D" }} />
            </div>
            <p className="font-display text-xl mb-2" style={{ color: "#0F0F0F" }}>{submissionId ? "Report updated" : "Report submitted"}</p>
            <p className="text-sm mb-5" style={{ color: "#8A7A5C" }}>
              {submissionId ? "The record has been updated and a new report sent." : `Generator audit submitted${form.recipientEmail ? ` to ${form.recipientEmail}` : ""}.`}
            </p>
            {standalone && savedId && (
              <div className="w-full max-w-sm mx-auto mb-5 p-4 rounded-2xl text-left"
                style={{ background: "rgba(15,76,92,0.06)", border: "1px solid rgba(15,76,92,0.18)" }}>
                <p className="text-xs font-semibold mb-0.5" style={{ color: "#0F4C5C" }}>Save your edit link</p>
                <p className="text-xs mb-3" style={{ color: "#8A7A5C" }}>Use this link to reopen and update this report at any time.</p>
                <div className="flex gap-2">
                  <input readOnly value={`${window.location.origin}${window.location.pathname}?edit=${savedId}`}
                    className="flex-1 text-xs px-3 py-2 rounded-xl outline-none truncate"
                    style={{ background: "white", color: "#0F0F0F", border: "1px solid rgba(0,0,0,0.08)" }} />
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?edit=${savedId}`); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 flex items-center gap-1 transition-all"
                    style={{ background: linkCopied ? "rgba(21,128,61,0.1)" : "#0F4C5C", color: linkCopied ? "#15803D" : "white" }}>
                    {linkCopied ? <><Check size={11} /> Copied!</> : "Copy"}
                  </button>
                </div>
              </div>
            )}
            <button onClick={downloadPDF}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold mb-3 transition-all active:scale-95"
              style={{ background: "#0F4C5C", color: "white" }}>
              <Download size={14} /> Download PDF copy
            </button>
            {standalone && !submissionId && (
              <button onClick={resetForm} className="text-sm font-semibold" style={{ color: "#8A7A5C" }}>Submit another report</button>
            )}
            {!standalone && (
              <button onClick={onClose} className="text-sm font-semibold" style={{ color: "#8A7A5C" }}>Close</button>
            )}
          </div>
        ) : (
          <>
            {submitError && (
              <div className="mb-3 px-4 py-3 rounded-xl text-sm" style={{ background: "#FEF2F2", border: "1px solid rgba(185,28,28,0.2)", color: "#B91C1C" }}>{submitError}</div>
            )}
            {!webhookUrl && (
              <div className="mb-3 px-4 py-3 rounded-xl text-xs" style={{ background: "#FEF3C7", border: "1px solid rgba(180,83,9,0.2)", color: "#92400E" }}>
                No webhook configured — submitting will download the PDF locally instead.
              </div>
            )}

            <SectionHeader title="Building Details" />
            <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="uppercase mb-1" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Building / Location</div>
              <select value={form.building} onChange={(e) => set("building", e.target.value)}
                className="w-full bg-transparent outline-none text-sm" style={{ color: form.building ? "#0F0F0F" : "#8A7A5C" }}>
                <option value="">Select building…</option>
                {MASTER_PROPERTIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="flex items-center justify-between mb-1">
                <div className="uppercase" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Reference No.</div>
                {form.building && BUILDING_CODES[form.building] && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#F0EBE0", color: "#8A7A5C" }}>auto-generated</span>
                )}
              </div>
              <input value={form.incidentRef} onChange={(e) => set("incidentRef", e.target.value)}
                placeholder="Select a building to generate"
                className="w-full bg-transparent outline-none text-sm font-medium" style={{ color: "#0F0F0F" }} />
            </div>

            <SectionHeader number="1" title="Tenant Generator Information" />
            {form.tenantRows.map((row, i) => (
              <div key={i} className="rounded-2xl p-4 mb-3" style={{ background: "white", border: "1px solid rgba(0,0,0,0.07)" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8A7A5C" }}>Tenant {i + 1}</p>
                  {form.tenantRows.length > 1 && (
                    <button onClick={() => removeTenantRow(i)} className="text-xs font-semibold" style={{ color: "#B91C1C" }}>Remove</button>
                  )}
                </div>
                <InputRow label="Premises / Unit" value={row.premises} onChange={(v) => updateTenantRow(i, "premises", v)} />
                <InputRow label="Tenant Name" value={row.tenantName} onChange={(v) => updateTenantRow(i, "tenantName", v)} />
                <InputRow label="Trading Name" value={row.tradingName} onChange={(v) => updateTenantRow(i, "tradingName", v)} />
                <YesNoRow label="Generator Installed?" value={row.generatorInstalled} onChange={(v) => updateTenantRow(i, "generatorInstalled", v)} includeNA />
                <YesNoRow label="Picture of Installation?" value={row.pictureOfInstallation} onChange={(v) => updateTenantRow(i, "pictureOfInstallation", v)} />
                {row.pictureOfInstallation === "Yes" && (
                  <PhotoUploadRow value={row.installationPhoto} onChange={(v) => updateTenantRow(i, "installationPhoto", v)} />
                )}
                <YesNoRow label="Is Diesel Stored on Site?" value={row.dieselOnSite} onChange={(v) => updateTenantRow(i, "dieselOnSite", v)} />
                {row.dieselOnSite === "Yes" && (
                  <InputRow label="Amount of Diesel Stored" value={row.amountOfDiesel} onChange={(v) => updateTenantRow(i, "amountOfDiesel", v)} placeholder="e.g. 200 L" />
                )}
                <YesNoRow label="COC Certificate?" value={row.cocCertificate} onChange={(v) => updateTenantRow(i, "cocCertificate", v)} includeNA />
              </div>
            ))}
            <button onClick={addTenantRow}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold mb-4 transition-all active:scale-[0.98]"
              style={{ background: "#F0EBE0", color: "#3F3A2E", border: "1px dashed rgba(0,0,0,0.15)" }}>
              <Plus size={14} /> Add Tenant
            </button>

            <SectionHeader number="2" title="Generator for Centre" />
            {form.centreGenerators.map((row, i) => (
              <div key={i} className="rounded-2xl p-4 mb-3" style={{ background: "white", border: "1px solid rgba(0,0,0,0.07)" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8A7A5C" }}>Generator {i + 1}</p>
                  {form.centreGenerators.length > 1 && (
                    <button onClick={() => removeCentreRow(i)} className="text-xs font-semibold" style={{ color: "#B91C1C" }}>Remove</button>
                  )}
                </div>
                <InputRow label="Type" value={row.type} onChange={(v) => updateCentreRow(i, "type", v)} placeholder="e.g. Diesel" />
                <InputRow label="Size / kVA" value={row.size} onChange={(v) => updateCentreRow(i, "size", v)} placeholder="e.g. 100 kVA" />
                <InputRow label="Serial Numbers" value={row.serialNumbers} onChange={(v) => updateCentreRow(i, "serialNumbers", v)} />
                <InputRow label="Amount of Diesel Stored" value={row.amountOfDiesel} onChange={(v) => updateCentreRow(i, "amountOfDiesel", v)} placeholder="e.g. 500 L" />
                <TextareaRow label="Area and Items Generator Covers" value={row.areaCovered} onChange={(v) => updateCentreRow(i, "areaCovered", v)} rows={2} placeholder="e.g. Common areas, fire systems, lifts…" />
              </div>
            ))}
            <button onClick={addCentreRow}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold mb-4 transition-all active:scale-[0.98]"
              style={{ background: "#F0EBE0", color: "#3F3A2E", border: "1px dashed rgba(0,0,0,0.15)" }}>
              <Plus size={14} /> Add Generator
            </button>

            <SectionHeader title="Send Report To" />
            <InputRow label="Recipient Email" value={form.recipientEmail} onChange={(v) => set("recipientEmail", v)} type="email" placeholder="facilities@company.com" />
          </>
        )}
      </div>
    </div>
  );

  if (standalone) return content;
  return (
    <div className="absolute inset-0 z-30 fade-anim" style={{ background: "rgba(0,0,0,0.4)" }}>
      {content}
    </div>
  );
}

const BCA_INITIAL = {
  building: "",
  incidentRef: "",
  date: "",
  inspector: "",
  rows: Object.fromEntries(BCA_SECTIONS.map((s) => [s.key, s.items.map(() => ({ inspected: false, condition: "", priority: "", notes: "", photos: [] }))])),
};

function BCAItemRow({ item, row, onChange }) {
  const COND = [
    { v: "G", active: "#15803D" },
    { v: "F", active: "#A16207" },
    { v: "P", active: "#C2410C" },
    { v: "C", active: "#B91C1C" },
  ];

  const addPhoto = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1200;
          let w = img.width, h = img.height;
          if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          onChange("photos", [...(row.photos || []), canvas.toDataURL("image/jpeg", 0.72)]);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removePhoto = (idx) => onChange("photos", (row.photos || []).filter((_, i) => i !== idx));

  return (
    <div className="rounded-xl p-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="flex items-start gap-2 mb-2">
        <button type="button" onClick={() => onChange("inspected", !row.inspected)}
          className="flex-shrink-0 mt-0.5 w-4 h-4 rounded flex items-center justify-center transition-all"
          style={{ background: row.inspected ? "#0F4C5C" : "transparent", border: row.inspected ? "none" : "1.5px solid #D1C9B8" }}>
          {row.inspected && <Check size={10} style={{ color: "white" }} />}
        </button>
        <span className="text-sm" style={{ color: "#0F0F0F" }}>{item}</span>
      </div>
      <div className="flex items-start gap-3 mb-2">
        <div className="flex-1">
          <div className="uppercase mb-1" style={{ color: "#8A7A5C", fontSize: "9px", letterSpacing: "0.12em" }}>Condition</div>
          <div className="flex gap-1">
            {COND.map(({ v, active }) => (
              <button key={v} type="button" onClick={() => onChange("condition", row.condition === v ? "" : v)}
                className="flex-1 py-1 rounded text-xs font-bold transition-all active:scale-95"
                style={{ background: row.condition === v ? active : "#F0EBE0", color: row.condition === v ? "white" : "#3F3A2E" }}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <div className="uppercase mb-1" style={{ color: "#8A7A5C", fontSize: "9px", letterSpacing: "0.12em" }}>Priority</div>
          <div className="flex gap-1">
            {["1", "2", "3", "4"].map((p) => (
              <button key={p} type="button" onClick={() => onChange("priority", row.priority === p ? "" : p)}
                className="flex-1 py-1 rounded text-xs font-bold transition-all active:scale-95"
                style={{ background: row.priority === p ? "#0F0F0F" : "#F0EBE0", color: row.priority === p ? "white" : "#3F3A2E" }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
      <input type="text" value={row.notes || ""} onChange={(e) => onChange("notes", e.target.value)}
        placeholder="Notes (optional)"
        className="w-full bg-transparent outline-none text-xs py-1.5 px-1"
        style={{ color: "#0F0F0F", borderTop: "1px solid rgba(0,0,0,0.06)" }} />
      <div className="pt-2 mt-1" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        {(row.photos || []).length > 0 && (
          <div className="flex gap-2 flex-wrap mb-2">
            {(row.photos || []).map((src, idx) => (
              <div key={idx} className="relative flex-shrink-0">
                <img src={src} alt={`photo ${idx + 1}`} className="rounded-lg"
                  style={{ width: 72, height: 54, objectFit: "cover" }} />
                <button type="button" onClick={() => removePhoto(idx)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: "#B91C1C", color: "white", fontSize: 9, lineHeight: 1 }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="flex items-center gap-1.5 cursor-pointer" style={{ color: "#8A7A5C" }}>
          <Camera size={12} />
          <span className="text-xs">{(row.photos || []).length > 0 ? "Add another photo" : "Add photo"}</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={addPhoto} />
        </label>
      </div>
    </div>
  );
}

function BCASheet({ webhookUrl, onClose, standalone = false, name = "Building Condition Assessment", onSave, initialData = null, submissionId = null }) {
  const [form, setForm] = useState(initialData || BCA_INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [savedId, setSavedId] = useState(submissionId);
  const [linkCopied, setLinkCopied] = useState(false);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  useEffect(() => {
    if (submissionId) return;
    if (form.building) {
      generateIncidentRef(form.building, "bca-site").then((ref) => set("incidentRef", ref));
    } else {
      set("incidentRef", "");
    }
  }, [form.building]);

  const setRow = (sectionKey, idx, field, value) => {
    setForm((f) => ({
      ...f,
      rows: {
        ...f.rows,
        [sectionKey]: f.rows[sectionKey].map((r, i) => i === idx ? { ...r, [field]: value } : r),
      },
    }));
  };

  const downloadPDF = () => {
    const fileName = `bca-${form.incidentRef || form.building || "report"}-${new Date().toISOString().slice(0, 10)}.pdf`;
    generateBCAPDF(form).save(fileName);
  };

  const handleSubmit = async () => {
    if (!form.building) { setSubmitError("Please select a building."); return; }
    if (!form.inspector.trim()) { setSubmitError("Please enter the inspector's name."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      let finalForm = form;
      if (!submissionId && form.building) {
        const freshRef = await generateIncidentRef(form.building, "bca-site");
        finalForm = { ...form, incidentRef: freshRef };
        setForm(finalForm);
      }
      const fileName = `bca-${finalForm.incidentRef || finalForm.building || "report"}-${new Date().toISOString().slice(0, 10)}.pdf`;
      const doc = generateBCAPDF(finalForm);
      const pdfBase64 = doc.output("datauristring");

      let resolvedId = submissionId;
      if (standalone && !submissionId && onSave) {
        resolvedId = await onSave(finalForm, fileName, null);
      }

      const editLink = resolvedId ? `${window.location.origin}${window.location.pathname}?edit=${resolvedId}` : null;

      if (webhookUrl) {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "checklist_submission",
            timestamp: new Date().toISOString(),
            incidentRef: finalForm.incidentRef,
            building: finalForm.building,
            inspector: finalForm.inspector,
            date: finalForm.date,
            formData: finalForm,
            pdfBase64,
            pdfFileName: fileName,
            editLink,
          }),
        });
        if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
      } else {
        doc.save(fileName);
      }

      if (onSave && !(standalone && !submissionId)) {
        const retId = await onSave(finalForm, fileName, resolvedId);
        if (retId && !resolvedId) resolvedId = retId;
      }

      setSavedId(resolvedId);
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e.message || "Submission failed — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => { setForm(BCA_INITIAL); setSubmitted(false); setSubmitError(""); setSavedId(null); };

  const wrapperCls = standalone ? "min-h-screen flex flex-col" : "absolute inset-0 flex flex-col sheet-anim";
  const content = (
    <div className={wrapperCls} style={{ background: "#FAF6EE" }}>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#FAF6EE" }}>
        {standalone ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#0F0F0F" }}>
              <ClipboardList size={13} style={{ color: "white" }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8A7A5C" }}>BCA Inspection</span>
          </div>
        ) : (
          <button onClick={onClose} className="text-sm font-semibold flex items-center gap-1" style={{ color: "#8A7A5C" }}>← Back</button>
        )}
        <span className="font-display text-base font-semibold" style={{ color: "#0F0F0F" }}>{name}</span>
        <div className="flex items-center gap-2">
          {!submitted && (
            <button onClick={downloadPDF} title="Download PDF"
              className="flex items-center justify-center w-8 h-8 rounded-xl transition-all active:scale-95"
              style={{ background: "#F0EBE0", color: "#3F3A2E" }}>
              <Download size={14} />
            </button>
          )}
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: submitting ? "#E5DFD5" : "#0F0F0F", color: submitting ? "#8A7A5C" : "white" }}>
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={12} />}
            {submitting ? (submissionId ? "Updating…" : "Sending…") : (submissionId ? "Update" : "Submit")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-3 pb-8">
        {submitted ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: "#DCFCE7" }}>
              <CheckCircle2 size={28} style={{ color: "#15803D" }} />
            </div>
            <p className="font-display text-xl mb-2" style={{ color: "#0F0F0F" }}>{submissionId ? "Assessment updated" : "Assessment submitted"}</p>
            <p className="text-sm mb-5" style={{ color: "#8A7A5C" }}>
              {submissionId ? "The record has been updated." : `BCA submitted for ${form.building || "site"}.`}
            </p>
            {standalone && savedId && (
              <div className="w-full max-w-sm mx-auto mb-5 p-4 rounded-2xl text-left"
                style={{ background: "rgba(15,76,92,0.06)", border: "1px solid rgba(15,76,92,0.18)" }}>
                <p className="text-xs font-semibold mb-0.5" style={{ color: "#0F4C5C" }}>Save your edit link</p>
                <p className="text-xs mb-3" style={{ color: "#8A7A5C" }}>Use this link to reopen and update this assessment at any time.</p>
                <div className="flex gap-2">
                  <input readOnly value={`${window.location.origin}${window.location.pathname}?edit=${savedId}`}
                    className="flex-1 text-xs px-3 py-2 rounded-xl outline-none truncate"
                    style={{ background: "white", color: "#0F0F0F", border: "1px solid rgba(0,0,0,0.08)" }} />
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?edit=${savedId}`); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 flex items-center gap-1 transition-all"
                    style={{ background: linkCopied ? "rgba(21,128,61,0.1)" : "#0F4C5C", color: linkCopied ? "#15803D" : "white" }}>
                    {linkCopied ? <><Check size={11} /> Copied!</> : "Copy"}
                  </button>
                </div>
              </div>
            )}
            <button onClick={downloadPDF}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold mb-3 transition-all active:scale-95"
              style={{ background: "#0F4C5C", color: "white" }}>
              <Download size={14} /> Download PDF copy
            </button>
            {standalone && !submissionId && (
              <button onClick={resetForm} className="text-sm font-semibold" style={{ color: "#8A7A5C" }}>Submit another assessment</button>
            )}
            {!standalone && (
              <button onClick={onClose} className="text-sm font-semibold" style={{ color: "#8A7A5C" }}>Close</button>
            )}
          </div>
        ) : (
          <>
            {submitError && (
              <div className="mb-3 px-4 py-3 rounded-xl text-sm" style={{ background: "#FEF2F2", border: "1px solid rgba(185,28,28,0.2)", color: "#B91C1C" }}>{submitError}</div>
            )}
            {!webhookUrl && (
              <div className="mb-3 px-4 py-3 rounded-xl text-xs" style={{ background: "#FEF3C7", border: "1px solid rgba(180,83,9,0.2)", color: "#92400E" }}>
                No webhook configured — submitting will download the PDF locally instead.
              </div>
            )}

            <SectionHeader title="Inspection Details" />
            <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="uppercase mb-1" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Building / Property</div>
              <select value={form.building} onChange={(e) => set("building", e.target.value)}
                className="w-full bg-transparent outline-none text-sm" style={{ color: form.building ? "#0F0F0F" : "#8A7A5C" }}>
                <option value="">Select building…</option>
                {MASTER_PROPERTIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <InputRow label="Date of Inspection" value={form.date} onChange={(v) => set("date", v)} type="date" />
            <InputRow label="Inspector Name" value={form.inspector} onChange={(v) => set("inspector", v)} placeholder="Full name" />
            <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="flex items-center justify-between mb-1">
                <div className="uppercase" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Reference No.</div>
                {form.building && BUILDING_CODES[form.building] && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#F0EBE0", color: "#8A7A5C" }}>auto-generated</span>
                )}
              </div>
              <input value={form.incidentRef} onChange={(e) => set("incidentRef", e.target.value)}
                placeholder="Select a building to generate"
                className="w-full bg-transparent outline-none text-sm font-medium" style={{ color: "#0F0F0F" }} />
            </div>

            <div className="mt-3 mb-3 px-4 py-3 rounded-xl text-xs" style={{ background: "#F0EBE0", color: "#3F3A2E" }}>
              <span className="font-semibold">Legend — </span>
              Condition: <span className="font-bold" style={{ color: "#15803D" }}>G</span>=Good  <span className="font-bold" style={{ color: "#A16207" }}>F</span>=Fair  <span className="font-bold" style={{ color: "#C2410C" }}>P</span>=Poor  <span className="font-bold" style={{ color: "#B91C1C" }}>C</span>=Critical  ·  Priority: <span className="font-bold">1</span>=Immediate  <span className="font-bold">2</span>=Short-term  <span className="font-bold">3</span>=Medium-term  <span className="font-bold">4</span>=Long-term
            </div>

            {BCA_SECTIONS.map((section) => (
              <div key={section.key}>
                <SectionHeader title={section.title} />
                {section.items.map((item, i) => (
                  <BCAItemRow
                    key={i}
                    item={item}
                    row={form.rows[section.key][i]}
                    onChange={(field, value) => setRow(section.key, i, field, value)}
                  />
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );

  if (standalone) return content;
  return (
    <div className="absolute inset-0 z-30 fade-anim" style={{ background: "rgba(0,0,0,0.4)" }}>
      {content}
    </div>
  );
}

function ChecklistDashboard({ webhookUrl, onClose }) {
  const [activeId, setActiveId] = useState(null);
  const [editingSubmission, setEditingSubmission] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [tab, setTab] = useState("checklists");
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data, error } = await supabase
        .from("checklist_submissions")
        .select("*")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      setSubmissions(data || []);
    } catch {
      setLoadError("Could not load submissions. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const copyLink = (id) => {
    const url = `${window.location.origin}${window.location.pathname}?checklist=${id}`;
    navigator.clipboard.writeText(url)
      .then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); })
      .catch(() => {});
  };

  const saveSubmission = async (entry, formData, pdfFileName, existingId = null) => {
    const record = {
      checklist_id: entry.id,
      incident_ref: formData.incidentRef,
      building: formData.building,
      lift_id: formData.liftId,
      date_of_failure: formData.dateOfFailure,
      submitted_at: new Date().toISOString(),
      pdf_file_name: pdfFileName,
      form_data: formData,
    };
    try {
      if (existingId) {
        await supabase.from("checklist_submissions").update(record).eq("id", existingId);
      } else {
        await supabase.from("checklist_submissions").insert(record);
      }
      await fetchSubmissions();
    } catch {
      // submission already saved via webhook; non-critical
    }
    setActiveId(null);
    setEditingSubmission(null);
  };

  const archiveSubmission = async (id, archive) => {
    setSubmissions((prev) => prev.map((s) => s.id === id ? { ...s, archived: archive } : s));
    await supabase.from("checklist_submissions").update({ archived: archive }).eq("id", id);
  };

  const redownload = (sub) => {
    const entry = CHECKLIST_REGISTRY.find((c) => c.id === sub.checklist_id);
    const fileName = sub.pdf_file_name || `${sub.checklist_id || "report"}-${sub.incident_ref || "report"}.pdf`;
    (entry?.generatePDF || generateChecklistPDF)(sub.form_data).save(fileName);
  };

  const fmtSubmittedAt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  };

  if (activeId || editingSubmission) {
    const entry = editingSubmission
      ? CHECKLIST_REGISTRY.find((c) => c.id === editingSubmission.checklist_id)
      : CHECKLIST_REGISTRY.find((c) => c.id === activeId);
    if (!entry) return null;
    return (
      <entry.FormComponent
        webhookUrl={webhookUrl}
        onClose={() => { setActiveId(null); setEditingSubmission(null); }}
        name={entry.name}
        initialData={editingSubmission?.form_data || null}
        submissionId={editingSubmission?.id || null}
        onSave={(formData, pdfFileName, subId) => saveSubmission(entry, formData, pdfFileName, subId)}
      />
    );
  }

  return (
    <div className="absolute inset-0 z-30 fade-anim" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="absolute inset-0 flex flex-col sheet-anim" style={{ background: "#FAF6EE" }}>
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <button onClick={onClose} className="text-sm font-semibold" style={{ color: "#8A7A5C" }}>Close</button>
          <div className="flex items-center gap-2">
            <ClipboardList size={15} style={{ color: "#0F0F0F" }} />
            <span className="font-display text-base font-semibold" style={{ color: "#0F0F0F" }}>Checklists</span>
          </div>
          <div className="w-10" />
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-3 pb-1 gap-2">
          {[["checklists", "Checklists"], ["submissions", `Submissions${submissions.filter(s => !s.archived).length ? ` (${submissions.filter(s => !s.archived).length})` : ""}`]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
              style={{ background: tab === key ? "#0F0F0F" : "white", color: tab === key ? "white" : "#0F0F0F", border: "1px solid rgba(0,0,0,0.08)" }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "checklists" ? (
          <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-3 pb-8">
            <p className="text-xs mb-4" style={{ color: "#8A7A5C" }}>
              Fill in a checklist internally, or share a link with an external party so they can complete it without accessing the task board.
            </p>
            {CHECKLIST_REGISTRY.map((entry) => (
              <div key={entry.id} className="rounded-2xl p-4 mb-3" style={{ background: "white", border: "1px solid rgba(0,0,0,0.07)" }}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: "#0F0F0F" }}>{entry.name}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#8A7A5C" }}>{entry.description}</p>
                  </div>
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#F0EBE0", color: "#8A7A5C" }}>
                    {entry.category}
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setActiveId(entry.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                    style={{ background: "#0F0F0F", color: "white" }}>
                    <ClipboardList size={13} /> Fill In
                  </button>
                  <button onClick={() => copyLink(entry.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                    style={{
                      background: copiedId === entry.id ? "rgba(21,128,61,0.08)" : "#F0EBE0",
                      color: copiedId === entry.id ? "#15803D" : "#3F3A2E",
                      border: copiedId === entry.id ? "1px solid rgba(21,128,61,0.2)" : "1px solid transparent",
                    }}>
                    {copiedId === entry.id ? <Check size={13} /> : <Download size={13} />}
                    {copiedId === entry.id ? "Link copied!" : "Share link"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-3 pb-8">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={20} className="animate-spin" style={{ color: "#8A7A5C" }} />
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm mb-3" style={{ color: "#B91C1C" }}>{loadError}</p>
                <button onClick={fetchSubmissions} className="text-xs font-semibold" style={{ color: "#8A7A5C" }}>Try again</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs" style={{ color: "#8A7A5C" }}>
                    {showArchived ? "Archived submissions" : `${submissions.filter(s => !s.archived).length} active`}
                  </p>
                  <button onClick={() => setShowArchived(!showArchived)}
                    className="text-xs font-semibold flex items-center gap-1"
                    style={{ color: showArchived ? "#0F4C5C" : "#8A7A5C" }}>
                    <Archive size={11} />
                    {showArchived ? "View active" : "View archived"}
                  </button>
                </div>
                {submissions.filter(s => showArchived ? s.archived : !s.archived).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                      {showArchived ? <Archive size={20} style={{ color: "#8A7A5C" }} /> : <ClipboardList size={20} style={{ color: "#8A7A5C" }} />}
                    </div>
                    <p className="font-display text-base mb-1" style={{ color: "#0F0F0F" }}>
                      {showArchived ? "No archived submissions" : "No submissions yet"}
                    </p>
                    <p className="text-xs" style={{ color: "#8A7A5C" }}>
                      {showArchived ? "Archived reports will appear here." : "Submitted forms will appear here."}
                    </p>
                  </div>
                ) : (
                  submissions.filter(s => showArchived ? s.archived : !s.archived).map((sub) => {
                    const entryName = CHECKLIST_REGISTRY.find((c) => c.id === sub.checklist_id)?.name || sub.checklist_id;
                    return (
                      <div key={sub.id} className="rounded-2xl p-4 mb-3" style={{ background: showArchived ? "#F7F4EE" : "white", border: "1px solid rgba(0,0,0,0.07)" }}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm" style={{ color: showArchived ? "#8A7A5C" : "#0F0F0F" }}>
                              {sub.building || "—"}{sub.lift_id ? ` · ${sub.lift_id}` : ""}
                            </p>
                            {sub.incident_ref && (
                              <p className="text-xs mt-0.5" style={{ color: "#8A7A5C" }}>Ref: {sub.incident_ref}</p>
                            )}
                          </div>
                          <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#F0EBE0", color: "#8A7A5C" }}>
                            {entryName.split(" ")[0]}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mb-3 text-xs" style={{ color: "#8A7A5C" }}>
                          {sub.date_of_failure && <span>Failure: {sub.date_of_failure}</span>}
                          <span>Submitted: {fmtSubmittedAt(sub.submitted_at)}</span>
                        </div>
                        {sub.form_data?.recipientEmail && (
                          <p className="text-xs mb-3" style={{ color: "#8A7A5C" }}>Sent to: {sub.form_data.recipientEmail}</p>
                        )}
                        {showArchived ? (
                          <div className="flex gap-2">
                            <button onClick={() => redownload(sub)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                              style={{ background: "#F0EBE0", color: "#3F3A2E" }}>
                              <Download size={13} /> Download PDF
                            </button>
                            <button onClick={() => archiveSubmission(sub.id, false)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                              style={{ background: "white", color: "#0F0F0F", border: "1px solid rgba(0,0,0,0.1)" }}>
                              Unarchive
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => redownload(sub)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                              style={{ background: "#F0EBE0", color: "#3F3A2E" }}>
                              <Download size={13} /> Download PDF
                            </button>
                            <button onClick={() => setEditingSubmission(sub)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                              style={{ background: "white", color: "#0F0F0F", border: "1px solid rgba(0,0,0,0.1)" }}>
                              Edit
                            </button>
                            <button onClick={() => archiveSubmission(sub.id, true)}
                              className="flex items-center justify-center px-3 py-2 rounded-xl transition-all active:scale-[0.98]"
                              style={{ background: "white", border: "1px solid rgba(0,0,0,0.1)" }}
                              title="Archive">
                              <Archive size={14} style={{ color: "#8A7A5C" }} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Checklist form helpers (module-level so they never remount on re-render) ----------
function SectionHeader({ number, title }) {
  return (
    <div className="mt-5 mb-2 px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: "#0F0F0F", color: "white" }}>
      {number ? `${number}. ` : ""}{title}
    </div>
  );
}

function CheckRow({ label, checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-xl mb-1.5 transition-all active:scale-[0.98]"
      style={{ background: checked ? "rgba(15,76,92,0.07)" : "white", border: `1px solid ${checked ? "rgba(15,76,92,0.25)" : "rgba(0,0,0,0.06)"}` }}>
      <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
        style={{ background: checked ? "#0F4C5C" : "transparent", border: checked ? "none" : "1.5px solid #D1C9B8" }}>
        {checked && <Check size={10} style={{ color: "white" }} />}
      </div>
      <span className="text-sm" style={{ color: "#0F0F0F" }}>{label}</span>
    </button>
  );
}

function RadioRow({ label, selected, onSelect }) {
  return (
    <button type="button" onClick={onSelect}
      className="flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-xl mb-1.5 transition-all active:scale-[0.98]"
      style={{ background: selected ? "rgba(15,76,92,0.07)" : "white", border: `1px solid ${selected ? "rgba(15,76,92,0.25)" : "rgba(0,0,0,0.06)"}` }}>
      <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
        style={{ border: selected ? "none" : "1.5px solid #D1C9B8", background: selected ? "#0F4C5C" : "transparent" }}>
        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>
      <span className="text-sm" style={{ color: "#0F0F0F" }}>{label}</span>
    </button>
  );
}

function InputRow({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="uppercase mb-1" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
    </div>
  );
}

function TextareaRow({ label, value, onChange, placeholder = "", rows = 3 }) {
  return (
    <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="uppercase mb-1" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>{label}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full bg-transparent outline-none text-sm resize-none" style={{ color: "#0F0F0F" }} />
    </div>
  );
}

function YesNoRow({ label, value, onChange, includeNA = false }) {
  const opts = includeNA ? ["Yes", "No", "N/A"] : ["Yes", "No"];
  return (
    <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="uppercase mb-2" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>{label}</div>
      <div className="flex gap-2">
        {opts.map((opt) => (
          <button key={opt} type="button" onClick={() => onChange(value === opt ? "" : opt)}
            className="flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
            style={{ background: value === opt ? "#0F4C5C" : "#F0EBE0", color: value === opt ? "white" : "#3F3A2E" }}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function PhotoUploadRow({ value, onChange }) {
  const compressImage = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let w = img.width, h = img.height;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const compressed = await compressImage(file);
    onChange(compressed);
    e.target.value = "";
  };

  return (
    <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="uppercase mb-2" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Installation Photo</div>
      {value ? (
        <div className="relative">
          <img src={value} alt="Installation" className="w-full rounded-xl object-cover" style={{ maxHeight: 220 }} />
          <button onClick={() => onChange("")} type="button"
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.55)" }}>
            <X size={13} style={{ color: "white" }} />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl cursor-pointer transition-all active:scale-[0.99]"
          style={{ background: "#F0EBE0", border: "1px dashed rgba(0,0,0,0.15)" }}>
          <Camera size={20} style={{ color: "#8A7A5C" }} />
          <span className="text-xs font-semibold" style={{ color: "#8A7A5C" }}>Tap to add photo</span>
          <input type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
        </label>
      )}
    </div>
  );
}

const CHECKLIST_INITIAL = {
  building: "", liftId: "", dateOfFailure: "", timeOfFailure: "",
  timeReported: "", timeTechArrived: "", timeLiftRestored: "",
  serviceProvider: "", technicianName: "", incidentRef: "",
  rcaCompleted: false, actualCause: "", failureCategory: "",
  failureCategoryOther: "", failureDescription: "",
  correctiveActionsCompleted: false,
  correctiveActions: [{ action: "", dateCompleted: "", technician: "" }],
  components: [{ component: "", actionTaken: "", partNumber: "", dateCompleted: "" }],
  componentsRecorded: false, testingCompleted: false, safetyChecksCompleted: false,
  tempMeasuresImplemented: false, tempMeasuresDetails: "",
  tempMeasuresFrom: "", tempMeasuresTo: "",
  tempMeasureRemoved: false, tempMeasureStillActive: false,
  outstandingActions: [{ action: "", responsiblePerson: "", dueDate: "", status: "" }],
  noOutstandingActions: false, outstandingCommunicated: false,
  noResidualRisks: false, operationalRisk: false, reliabilityRisk: false,
  safetyRisk: false, complianceRisk: false, riskDetails: "", mitigationMeasures: "",
  operationalStatus: "", finalTestingCompleted: null, monitoringPeriod: "",
  serviceProviderName: "", serviceProviderDate: "", fmName: "", fmDate: "",
  landlordNotified: null, incidentClosedDate: "",
  recipientEmail: "",
};

function LiftRCASheet({ webhookUrl, onClose, standalone = false, name = "Lift RCA Checklist", onSave, initialData = null, submissionId = null }) {
  const [form, setForm] = useState(initialData || CHECKLIST_INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [savedId, setSavedId] = useState(submissionId);
  const [linkCopied, setLinkCopied] = useState(false);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // Auto-generate incident reference when building is chosen (skip when editing an existing submission)
  useEffect(() => {
    if (submissionId) return;
    if (form.building) {
      generateIncidentRef(form.building, "lift-rca").then((ref) => set("incidentRef", ref));
    } else {
      set("incidentRef", "");
    }
  }, [form.building]);

  const addCorrRow = () => setForm((f) => ({ ...f, correctiveActions: [...f.correctiveActions, { action: "", dateCompleted: "", technician: "" }] }));
  const removeCorrRow = (i) => setForm((f) => ({ ...f, correctiveActions: f.correctiveActions.filter((_, idx) => idx !== i) }));
  const updateCorrRow = (i, field, val) => setForm((f) => ({ ...f, correctiveActions: f.correctiveActions.map((r, idx) => idx === i ? { ...r, [field]: val } : r) }));

  const addCompRow = () => setForm((f) => ({ ...f, components: [...f.components, { component: "", actionTaken: "", partNumber: "", dateCompleted: "" }] }));
  const removeCompRow = (i) => setForm((f) => ({ ...f, components: f.components.filter((_, idx) => idx !== i) }));
  const updateCompRow = (i, field, val) => setForm((f) => ({ ...f, components: f.components.map((r, idx) => idx === i ? { ...r, [field]: val } : r) }));

  const addOutRow = () => setForm((f) => ({ ...f, outstandingActions: [...f.outstandingActions, { action: "", responsiblePerson: "", dueDate: "", status: "" }] }));
  const removeOutRow = (i) => setForm((f) => ({ ...f, outstandingActions: f.outstandingActions.filter((_, idx) => idx !== i) }));
  const updateOutRow = (i, field, val) => setForm((f) => ({ ...f, outstandingActions: f.outstandingActions.map((r, idx) => idx === i ? { ...r, [field]: val } : r) }));

  const downloadPDF = () => {
    const fileName = `lift-rca-${form.incidentRef || "report"}-${new Date().toISOString().slice(0, 10)}.pdf`;
    generateChecklistPDF(form).save(fileName);
  };

  const handleSubmit = async () => {
    if (!form.recipientEmail.trim()) { setSubmitError("Please enter a recipient email address."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      let finalForm = form;
      if (!submissionId && form.building) {
        const freshRef = await generateIncidentRef(form.building, "lift-rca");
        finalForm = { ...form, incidentRef: freshRef };
        setForm(finalForm);
      }
      const fileName = `lift-rca-${finalForm.incidentRef || "report"}-${new Date().toISOString().slice(0, 10)}.pdf`;
      const doc = generateChecklistPDF(finalForm);
      const pdfBase64 = doc.output("datauristring");

      // Standalone new: save to Supabase first so the edit link can be included in the email
      let resolvedId = submissionId;
      if (standalone && !submissionId && onSave) {
        resolvedId = await onSave(finalForm, fileName, null);
      }

      const editLink = resolvedId
        ? `${window.location.origin}${window.location.pathname}?edit=${resolvedId}`
        : null;

      if (webhookUrl) {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "checklist_submission",
            timestamp: new Date().toISOString(),
            recipientEmail: finalForm.recipientEmail,
            incidentRef: finalForm.incidentRef,
            building: finalForm.building,
            liftId: finalForm.liftId,
            dateOfFailure: finalForm.dateOfFailure,
            formData: finalForm,
            pdfBase64,
            pdfFileName: fileName,
            editLink,
          }),
        });
        if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
      } else {
        doc.save(fileName);
      }

      // Internal or standalone edit: save after webhook
      if (onSave && !(standalone && !submissionId)) {
        const retId = await onSave(finalForm, fileName, resolvedId);
        if (retId && !resolvedId) resolvedId = retId;
      }

      setSavedId(resolvedId);
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e.message || "Submission failed — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => { setForm(CHECKLIST_INITIAL); setSubmitted(false); setSubmitError(""); setSavedId(null); };

  const wrapperCls = standalone ? "min-h-screen flex flex-col" : "absolute inset-0 flex flex-col sheet-anim";
  const content = (
    <div className={wrapperCls} style={{ background: "#FAF6EE" }}>
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#FAF6EE" }}>
          {standalone ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#0F0F0F" }}>
                <ClipboardList size={13} style={{ color: "white" }} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8A7A5C" }}>Incident Report</span>
            </div>
          ) : (
            <button onClick={onClose} className="text-sm font-semibold flex items-center gap-1" style={{ color: "#8A7A5C" }}>
              ← Back
            </button>
          )}
          <span className="font-display text-base font-semibold" style={{ color: "#0F0F0F" }}>{name}</span>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: submitting ? "#E5DFD5" : "#0F0F0F", color: submitting ? "#8A7A5C" : "white" }}>
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={12} />}
            {submitting ? (submissionId ? "Updating…" : "Sending…") : (submissionId ? "Update" : "Submit")}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-3 pb-8">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: "#DCFCE7" }}>
                <CheckCircle2 size={28} style={{ color: "#15803D" }} />
              </div>
              <p className="font-display text-xl mb-2" style={{ color: "#0F0F0F" }}>{submissionId ? "Report updated" : "Report submitted"}</p>
              <p className="text-sm mb-5" style={{ color: "#8A7A5C" }}>
                {submissionId
                  ? "The record has been updated and a new report sent."
                  : `The completed RCA report has been sent${form.recipientEmail ? ` to ${form.recipientEmail}` : ""} via your webhook.`}
              </p>
              {standalone && savedId && (
                <div className="w-full max-w-sm mx-auto mb-5 p-4 rounded-2xl text-left"
                  style={{ background: "rgba(15,76,92,0.06)", border: "1px solid rgba(15,76,92,0.18)" }}>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: "#0F4C5C" }}>Save your edit link</p>
                  <p className="text-xs mb-3" style={{ color: "#8A7A5C" }}>
                    Use this link to reopen and update this report at any time.
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={`${window.location.origin}${window.location.pathname}?edit=${savedId}`}
                      className="flex-1 text-xs px-3 py-2 rounded-xl outline-none truncate"
                      style={{ background: "white", color: "#0F0F0F", border: "1px solid rgba(0,0,0,0.08)" }}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?edit=${savedId}`);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 flex items-center gap-1 transition-all"
                      style={{ background: linkCopied ? "rgba(21,128,61,0.1)" : "#0F4C5C", color: linkCopied ? "#15803D" : "white" }}>
                      {linkCopied ? <><Check size={11} /> Copied!</> : "Copy"}
                    </button>
                  </div>
                </div>
              )}
              <button onClick={downloadPDF}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold mb-3 transition-all active:scale-95"
                style={{ background: "#0F4C5C", color: "white" }}>
                <Download size={14} /> Download PDF copy
              </button>
              {standalone && !submissionId && (
                <button onClick={resetForm} className="text-sm font-semibold" style={{ color: "#8A7A5C" }}>
                  Submit another report
                </button>
              )}
              {!standalone && (
                <button onClick={onClose} className="text-sm font-semibold" style={{ color: "#8A7A5C" }}>
                  Close
                </button>
              )}
            </div>
          ) : (
            <>
              {submitError && (
                <div className="mb-3 px-4 py-3 rounded-xl text-sm" style={{ background: "#FEF2F2", border: "1px solid rgba(185,28,28,0.2)", color: "#B91C1C" }}>
                  {submitError}
                </div>
              )}
              {!webhookUrl && (
                <div className="mb-3 px-4 py-3 rounded-xl text-xs" style={{ background: "#FEF3C7", border: "1px solid rgba(180,83,9,0.2)", color: "#92400E" }}>
                  No webhook configured — submitting will download the PDF locally instead.
                </div>
              )}

              {/* Lift Details */}
              <SectionHeader title="Lift Details" />
              <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="uppercase mb-1" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Building / Location</div>
                <select value={form.building} onChange={(e) => set("building", e.target.value)}
                  className="w-full bg-transparent outline-none text-sm" style={{ color: form.building ? "#0F0F0F" : "#8A7A5C" }}>
                  <option value="">Select building…</option>
                  {MASTER_PROPERTIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <InputRow label="Lift Identification (A/B/C/D…)" value={form.liftId} onChange={(v) => set("liftId", v)} />
              <div className="flex gap-2">
                <div className="flex-1">
                  <InputRow label="Date of Failure" value={form.dateOfFailure} onChange={(v) => set("dateOfFailure", v)} type="date" />
                </div>
                <div className="flex-1">
                  <InputRow label="Time of Failure" value={form.timeOfFailure} onChange={(v) => set("timeOfFailure", v)} type="time" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <InputRow label="Time Reported" value={form.timeReported} onChange={(v) => set("timeReported", v)} type="time" />
                </div>
                <div className="flex-1">
                  <InputRow label="Tech Arrived" value={form.timeTechArrived} onChange={(v) => set("timeTechArrived", v)} type="time" />
                </div>
              </div>
              <InputRow label="Time Lift Restored" value={form.timeLiftRestored} onChange={(v) => set("timeLiftRestored", v)} type="time" />
              <InputRow label="Service Provider" value={form.serviceProvider} onChange={(v) => set("serviceProvider", v)} />
              <InputRow label="Technician Name" value={form.technicianName} onChange={(v) => set("technicianName", v)} />
              <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="uppercase" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Incident Reference No.</div>
                  {form.building && BUILDING_CODES[form.building] && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#F0EBE0", color: "#8A7A5C" }}>auto-generated</span>
                  )}
                </div>
                <input
                  value={form.incidentRef}
                  onChange={(e) => set("incidentRef", e.target.value)}
                  placeholder={form.building ? "Select a building to generate" : "Or enter manually…"}
                  className="w-full bg-transparent outline-none text-sm font-medium"
                  style={{ color: "#0F0F0F" }}
                />
              </div>

              {/* Section 1: RCA */}
              <SectionHeader number="1" title="Root Cause Analysis (RCA)" />
              <CheckRow label="Detailed RCA completed and attached" checked={form.rcaCompleted} onChange={(v) => set("rcaCompleted", v)} />
              <TextareaRow label="Actual Cause of Failure" value={form.actualCause} onChange={(v) => set("actualCause", v)} rows={3} />
              <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="uppercase mb-3" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Failure Category</div>
                {[
                  ["electrical", "Electrical Fault"],
                  ["mechanical", "Mechanical Fault"],
                  ["control", "Control System Fault"],
                  ["door", "Door System Fault"],
                  ["safety", "Safety Circuit Fault"],
                  ["external", "External Cause (Power Surge / Electrical Disturbance / Other)"],
                  ["other", "Other"],
                ].map(([key, label]) => (
                  <RadioRow key={key} label={label} selected={form.failureCategory === key} onSelect={() => set("failureCategory", key)} />
                ))}
                {form.failureCategory === "other" && (
                  <input value={form.failureCategoryOther} onChange={(e) => set("failureCategoryOther", e.target.value)}
                    placeholder="Specify other cause…" className="w-full bg-transparent outline-none text-sm mt-1 px-1"
                    style={{ color: "#0F0F0F", borderBottom: "1px solid rgba(0,0,0,0.1)" }} />
                )}
              </div>
              <TextareaRow label="Description of Failure" value={form.failureDescription} onChange={(v) => set("failureDescription", v)} rows={4} />

              {/* Section 2: Corrective Actions */}
              <SectionHeader number="2" title="Corrective Actions Undertaken" />
              <CheckRow label="Corrective actions completed and documented" checked={form.correctiveActionsCompleted} onChange={(v) => set("correctiveActionsCompleted", v)} />
              {form.correctiveActions.map((row, i) => (
                <div key={i} className="rounded-xl p-4 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase" style={{ color: "#8A7A5C" }}>Action {i + 1}</span>
                    {form.correctiveActions.length > 1 && (
                      <button onClick={() => removeCorrRow(i)} className="text-xs font-semibold" style={{ color: "#B91C1C" }}>Remove</button>
                    )}
                  </div>
                  <textarea value={row.action} onChange={(e) => updateCorrRow(i, "action", e.target.value)}
                    placeholder="Description of action taken…" rows={2}
                    className="w-full bg-transparent outline-none text-sm resize-none mb-3" style={{ color: "#0F0F0F", borderBottom: "1px solid rgba(0,0,0,0.06)" }} />
                  <div className="flex gap-3 mt-2">
                    <div className="flex-1">
                      <div className="text-xs mb-1" style={{ color: "#8A7A5C" }}>Date completed</div>
                      <input type="date" value={row.dateCompleted} onChange={(e) => updateCorrRow(i, "dateCompleted", e.target.value)}
                        className="w-full bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs mb-1" style={{ color: "#8A7A5C" }}>Technician</div>
                      <input value={row.technician} onChange={(e) => updateCorrRow(i, "technician", e.target.value)}
                        placeholder="Name" className="w-full bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addCorrRow} className="w-full py-2.5 rounded-xl text-sm font-semibold mb-2 transition-all active:scale-[0.98]"
                style={{ background: "white", border: "1px dashed rgba(0,0,0,0.15)", color: "#8A7A5C" }}>
                + Add Action
              </button>

              {/* Section 3: Components */}
              <SectionHeader number="3" title="Components Repaired / Adjusted / Tested / Replaced" />
              {form.components.map((row, i) => (
                <div key={i} className="rounded-xl p-4 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase" style={{ color: "#8A7A5C" }}>Component {i + 1}</span>
                    {form.components.length > 1 && (
                      <button onClick={() => removeCompRow(i)} className="text-xs font-semibold" style={{ color: "#B91C1C" }}>Remove</button>
                    )}
                  </div>
                  <div className="flex gap-3 mb-3">
                    <div className="flex-1">
                      <div className="text-xs mb-1" style={{ color: "#8A7A5C" }}>Component</div>
                      <input value={row.component} onChange={(e) => updateCompRow(i, "component", e.target.value)}
                        placeholder="Component name" className="w-full bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs mb-1" style={{ color: "#8A7A5C" }}>Action taken</div>
                      <select value={row.actionTaken} onChange={(e) => updateCompRow(i, "actionTaken", e.target.value)}
                        className="w-full bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }}>
                        <option value="">Select…</option>
                        <option>Repair</option>
                        <option>Adjust</option>
                        <option>Test</option>
                        <option>Replace</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <div className="text-xs mb-1" style={{ color: "#8A7A5C" }}>Part number</div>
                      <input value={row.partNumber} onChange={(e) => updateCompRow(i, "partNumber", e.target.value)}
                        placeholder="Optional" className="w-full bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs mb-1" style={{ color: "#8A7A5C" }}>Date completed</div>
                      <input type="date" value={row.dateCompleted} onChange={(e) => updateCompRow(i, "dateCompleted", e.target.value)}
                        className="w-full bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addCompRow} className="w-full py-2.5 rounded-xl text-sm font-semibold mb-2 transition-all active:scale-[0.98]"
                style={{ background: "white", border: "1px dashed rgba(0,0,0,0.15)", color: "#8A7A5C" }}>
                + Add Component
              </button>
              <CheckRow label="All replaced components recorded" checked={form.componentsRecorded} onChange={(v) => set("componentsRecorded", v)} />
              <CheckRow label="Testing completed after repairs" checked={form.testingCompleted} onChange={(v) => set("testingCompleted", v)} />
              <CheckRow label="Lift safety checks completed" checked={form.safetyChecksCompleted} onChange={(v) => set("safetyChecksCompleted", v)} />

              {/* Section 4: Temporary Measures */}
              <SectionHeader number="4" title="Temporary Measures Implemented" />
              <CheckRow label="Temporary measures implemented to restore service" checked={form.tempMeasuresImplemented} onChange={(v) => set("tempMeasuresImplemented", v)} />
              <TextareaRow label="Details of Temporary Measures" value={form.tempMeasuresDetails} onChange={(v) => set("tempMeasuresDetails", v)} rows={3} />
              <div className="flex gap-2">
                <div className="flex-1">
                  <InputRow label="Duration From" value={form.tempMeasuresFrom} onChange={(v) => set("tempMeasuresFrom", v)} type="date" />
                </div>
                <div className="flex-1">
                  <InputRow label="To" value={form.tempMeasuresTo} onChange={(v) => set("tempMeasuresTo", v)} type="date" />
                </div>
              </div>
              <CheckRow label="Temporary measure removed after permanent repair" checked={form.tempMeasureRemoved} onChange={(v) => set("tempMeasureRemoved", v)} />
              <CheckRow label="Temporary measure still active" checked={form.tempMeasureStillActive} onChange={(v) => set("tempMeasureStillActive", v)} />

              {/* Section 5: Outstanding Actions */}
              <SectionHeader number="5" title="Outstanding Remedial Actions" />
              {form.outstandingActions.map((row, i) => (
                <div key={i} className="rounded-xl p-4 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase" style={{ color: "#8A7A5C" }}>Item {i + 1}</span>
                    {form.outstandingActions.length > 1 && (
                      <button onClick={() => removeOutRow(i)} className="text-xs font-semibold" style={{ color: "#B91C1C" }}>Remove</button>
                    )}
                  </div>
                  <textarea value={row.action} onChange={(e) => updateOutRow(i, "action", e.target.value)}
                    placeholder="Outstanding action…" rows={2}
                    className="w-full bg-transparent outline-none text-sm resize-none mb-3" style={{ color: "#0F0F0F", borderBottom: "1px solid rgba(0,0,0,0.06)" }} />
                  <div className="flex gap-3 mt-2">
                    <div className="flex-1">
                      <div className="text-xs mb-1" style={{ color: "#8A7A5C" }}>Responsible person</div>
                      <input value={row.responsiblePerson} onChange={(e) => updateOutRow(i, "responsiblePerson", e.target.value)}
                        placeholder="Name" className="w-full bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs mb-1" style={{ color: "#8A7A5C" }}>Due date</div>
                      <input type="date" value={row.dueDate} onChange={(e) => updateOutRow(i, "dueDate", e.target.value)}
                        className="w-full bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-xs mb-1" style={{ color: "#8A7A5C" }}>Status</div>
                    <input value={row.status} onChange={(e) => updateOutRow(i, "status", e.target.value)}
                      placeholder="e.g. Pending, In Progress, Done" className="w-full bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
                  </div>
                </div>
              ))}
              <button onClick={addOutRow} className="w-full py-2.5 rounded-xl text-sm font-semibold mb-2 transition-all active:scale-[0.98]"
                style={{ background: "white", border: "1px dashed rgba(0,0,0,0.15)", color: "#8A7A5C" }}>
                + Add Outstanding Action
              </button>
              <CheckRow label="No outstanding actions" checked={form.noOutstandingActions} onChange={(v) => set("noOutstandingActions", v)} />
              <CheckRow label="Outstanding actions communicated to Facilities Management" checked={form.outstandingCommunicated} onChange={(v) => set("outstandingCommunicated", v)} />

              {/* Section 6: Risks */}
              <SectionHeader number="6" title="Residual Operational / Reliability / Safety Risks" />
              <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="uppercase mb-3" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Remaining Risks Identified</div>
                <CheckRow label="No residual risks identified" checked={form.noResidualRisks} onChange={(v) => set("noResidualRisks", v)} />
                <CheckRow label="Operational Risk" checked={form.operationalRisk} onChange={(v) => set("operationalRisk", v)} />
                <CheckRow label="Reliability Risk" checked={form.reliabilityRisk} onChange={(v) => set("reliabilityRisk", v)} />
                <CheckRow label="Safety Risk" checked={form.safetyRisk} onChange={(v) => set("safetyRisk", v)} />
                <CheckRow label="Compliance Risk" checked={form.complianceRisk} onChange={(v) => set("complianceRisk", v)} />
              </div>
              <TextareaRow label="Risk Details" value={form.riskDetails} onChange={(v) => set("riskDetails", v)} rows={3} />
              <TextareaRow label="Recommended Mitigation Measures" value={form.mitigationMeasures} onChange={(v) => set("mitigationMeasures", v)} rows={3} />

              {/* Section 7: Final Verification */}
              <SectionHeader number="7" title="Final Verification & Sign-Off" />
              <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="uppercase mb-3" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Lift Operational Status</div>
                <RadioRow label="Fully Operational" selected={form.operationalStatus === "fully"} onSelect={() => set("operationalStatus", "fully")} />
                <RadioRow label="Operational with Monitoring Required" selected={form.operationalStatus === "monitoring"} onSelect={() => set("operationalStatus", "monitoring")} />
                <RadioRow label="Out of Service" selected={form.operationalStatus === "outofservice"} onSelect={() => set("operationalStatus", "outofservice")} />
              </div>
              <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="uppercase mb-3" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Final Testing Completed</div>
                <RadioRow label="Yes" selected={form.finalTestingCompleted === true} onSelect={() => set("finalTestingCompleted", true)} />
                <RadioRow label="No" selected={form.finalTestingCompleted === false} onSelect={() => set("finalTestingCompleted", false)} />
              </div>
              <InputRow label="Monitoring Period Required" value={form.monitoringPeriod} onChange={(v) => set("monitoringPeriod", v)} placeholder="e.g. 2 weeks" />
              <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="uppercase mb-3" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Service Provider Confirmation</div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className="text-xs mb-1" style={{ color: "#8A7A5C" }}>Name</div>
                    <input value={form.serviceProviderName} onChange={(e) => set("serviceProviderName", e.target.value)}
                      className="w-full bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs mb-1" style={{ color: "#8A7A5C" }}>Date</div>
                    <input type="date" value={form.serviceProviderDate} onChange={(e) => set("serviceProviderDate", e.target.value)}
                      className="w-full bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
                  </div>
                </div>
              </div>
              <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="uppercase mb-3" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Facilities Management Verification</div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className="text-xs mb-1" style={{ color: "#8A7A5C" }}>Name</div>
                    <input value={form.fmName} onChange={(e) => set("fmName", e.target.value)}
                      className="w-full bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs mb-1" style={{ color: "#8A7A5C" }}>Date</div>
                    <input type="date" value={form.fmDate} onChange={(e) => set("fmDate", e.target.value)}
                      className="w-full bg-transparent outline-none text-sm" style={{ color: "#0F0F0F" }} />
                  </div>
                </div>
              </div>
              <div className="rounded-xl px-4 py-3 mb-2" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="uppercase mb-3" style={{ color: "#8A7A5C", fontSize: "10px", letterSpacing: "0.15em" }}>Landlord Notification Completed</div>
                <RadioRow label="Yes" selected={form.landlordNotified === true} onSelect={() => set("landlordNotified", true)} />
                <RadioRow label="No" selected={form.landlordNotified === false} onSelect={() => set("landlordNotified", false)} />
              </div>
              <InputRow label="Incident Closed Date" value={form.incidentClosedDate} onChange={(v) => set("incidentClosedDate", v)} type="date" />

              {/* Email & Submit */}
              <SectionHeader title="Send Report" />
              <InputRow label="Recipient Email Address" value={form.recipientEmail} onChange={(v) => set("recipientEmail", v)} type="email" placeholder="e.g. facilities@company.com" />
              <div className="flex gap-2 mt-2">
                <button onClick={downloadPDF}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                  style={{ background: "white", border: "1px solid rgba(0,0,0,0.1)", color: "#0F0F0F" }}>
                  <Download size={14} /> Download PDF
                </button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                  style={{ background: submitting ? "#E5DFD5" : "#0F0F0F", color: submitting ? "#8A7A5C" : "white" }}>
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {submitting ? "Sending…" : webhookUrl ? "Send via Webhook" : "Download PDF"}
                </button>
              </div>
            </>
          )}
        </div>
    </div>
  );

  if (standalone) return content;
  return (
    <div className="absolute inset-0 z-30 fade-anim" style={{ background: "rgba(0,0,0,0.4)" }}>
      {content}
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
