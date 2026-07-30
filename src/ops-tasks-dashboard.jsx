import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, Plus, X, Loader2, Trash2, Building2,
  AlertTriangle, FileText, Users, Wrench, ClipboardList,
  Calendar, AlertCircle, CheckCircle2, ChevronRight, Tag,
  BarChart2, MapPin, Check, LayoutGrid, RefreshCw,
} from "lucide-react";

// ── Supabase ─────────────────────────────────────────────────
const supabase = createClient(
  "https://wbntrynyoymukhswcvgm.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndibnRyeW55b3ltdWtoc3djdmdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMjUzMDQsImV4cCI6MjEwMDgwMTMwNH0.jtxR8OqtgtYHRdn1PFeXOb91NHhNwJFcfmjc0f-RWZc"
);

// ── Constants ────────────────────────────────────────────────
const BUILDING_STATUSES = {
  operational: { label: "Operational", color: "#15803D", bg: "#DCFCE7" },
  at_risk:     { label: "At Risk",     color: "#B45309", bg: "#FEF3C7" },
  critical:    { label: "Critical",    color: "#B91C1C", bg: "#FEE2E2" },
  inactive:    { label: "Inactive",    color: "#6B7280", bg: "#F3F4F6" },
};

const INSPECTION_STATUSES = {
  scheduled:   { label: "Scheduled",   color: "#1D4ED8", bg: "#DBEAFE" },
  in_progress: { label: "In Progress", color: "#B45309", bg: "#FEF3C7" },
  completed:   { label: "Completed",   color: "#15803D", bg: "#DCFCE7" },
  overdue:     { label: "Overdue",     color: "#B91C1C", bg: "#FEE2E2" },
};

const TASK_STATUSES = {
  Pending:      { color: "#B45309", bg: "#FEF3C7" },
  "In Progress": { color: "#1D4ED8", bg: "#DBEAFE" },
  Done:         { color: "#15803D", bg: "#DCFCE7" },
  Archived:     { color: "#6B7280", bg: "#F3F4F6" },
};

const INSPECTION_TYPES = [
  "Routine", "Fire Safety", "Vacancy", "Handover",
  "Electrical COC", "HVAC", "Pest Control", "Structural",
];

const DOC_KINDS = [
  "building_plan", "compliance_cert", "warranty", "lease",
  "inspection_report", "quote", "other",
];

const DOC_KIND_LABELS = {
  building_plan: "Building Plan", compliance_cert: "Compliance Cert",
  warranty: "Warranty", lease: "Lease", inspection_report: "Inspection Report",
  quote: "Quote", other: "Other",
};

const ASSET_STATUSES = {
  operational:    { color: "#15803D", bg: "#DCFCE7", label: "Operational" },
  down:           { color: "#B91C1C", bg: "#FEE2E2", label: "Down" },
  decommissioned: { color: "#6B7280", bg: "#F3F4F6", label: "Decommissioned" },
};

// ── Health Score ─────────────────────────────────────────────
// All thresholds, weights, and missing/stale behavior in one place.
const HEALTH_SCORE_CONFIG = {
  weights: {
    taskOnTimeRate: 0.40,   // % open tasks that are not overdue
    checklistScore: 0.60,   // latest BCA condition rating
    // assetCondition: 0.00  // TODO: enable when assets have real condition data
  },
  bca: {
    // Condition rating → score (0–100). Keep in sync with App.jsx BCA_CONDITION_POINTS.
    conditionPoints: { G: 100, F: 75, P: 25, C: 0 },
    maxAgeMonths:  12,   // BCA older than this is treated as expired
    missingScore:   0,   // component score when BCA is missing OR expired
  },
  tasks: {
    noTasksScore: 100,   // building with zero open tasks scores full marks here
  },
  status: {
    // health_score → building status label thresholds
    goodAbove:    75,
    atRiskAbove:  50,
    // below atRiskAbove → "critical"
  },
};

// Compute a BCA score from raw form_data (used when stored .score is null).
function computeBCAScoreFromData(formData) {
  const pts = HEALTH_SCORE_CONFIG.bca.conditionPoints;
  let total = 0, count = 0;
  Object.values(formData?.rows || {}).forEach((section) =>
    section.forEach((item) => {
      if (item.inspected && pts[item.condition] !== undefined) {
        total += pts[item.condition];
        count++;
      }
    })
  );
  return count > 0 ? Math.round((total / count) * 10) / 10 : null;
}

// Full health score computation. Returns { score, breakdown }.
function computeHealthScore(buildingName, submissions, localTasks) {
  const cfg = HEALTH_SCORE_CONFIG;
  const today = new Date();

  // ── Task on-time rate ─────────────────────────────────────
  const openTasks = localTasks.filter(
    (t) => t.property === buildingName && t.status !== "Done" && t.status !== "Archived"
  );
  const overdueCount = openTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate + "T00:00:00") < today
  ).length;
  const taskScore =
    openTasks.length === 0
      ? cfg.tasks.noTasksScore
      : (1 - overdueCount / openTasks.length) * 100;
  const taskBreakdown = {
    score:      Math.round(taskScore),
    openCount:  openTasks.length,
    overdueCount,
    status:     openTasks.length === 0 ? "no_tasks" : overdueCount === 0 ? "ok" : "overdue",
  };

  // ── BCA checklist score ───────────────────────────────────
  const bcaSubs = (submissions || [])
    .filter((s) => s.checklist_id === "bca-site")
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

  let checklistScore = cfg.bca.missingScore;
  let bcaBreakdown   = { status: "missing", lastDate: null, lastScore: null };

  if (bcaSubs.length > 0) {
    const latest    = bcaSubs[0];
    const ageMonths = (today - new Date(latest.submitted_at)) / (1000 * 60 * 60 * 24 * 30.5);
    const rawScore  = latest.score ?? computeBCAScoreFromData(latest.form_data);

    if (ageMonths > cfg.bca.maxAgeMonths) {
      // Stale — use missingScore for the weighted blend but preserve the last reading for display
      bcaBreakdown = { status: "stale", lastDate: latest.submitted_at, lastScore: rawScore };
    } else {
      checklistScore = rawScore ?? cfg.bca.missingScore;
      bcaBreakdown   = { status: "current", lastDate: latest.submitted_at, lastScore: checklistScore };
    }
  }

  // ── Weighted blend ────────────────────────────────────────
  const w = cfg.weights;
  const totalWeight = Object.values(w).reduce((s, v) => s + v, 0);
  const score = Math.round(
    ((w.taskOnTimeRate * taskScore + w.checklistScore * checklistScore) / totalWeight) * 10
  ) / 10;

  return { score, breakdown: { task: taskBreakdown, bca: bcaBreakdown } };
}

// Small score bar + label card used in OverviewTab.
function ScoreCard({ icon: Icon, label, weight, score, statusText, statusColor = "#8A7A5C", disabled = false }) {
  const pct      = Math.round(weight * 100);
  const barColor = disabled || score == null
    ? "#E5E7EB"
    : score >= 75 ? "#15803D" : score >= 50 ? "#B45309" : "#B91C1C";

  return (
    <div style={{ background: "white", borderRadius: 14, padding: "12px 14px", opacity: disabled ? 0.65 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: disabled ? 4 : 8 }}>
        <Icon size={13} style={{ color: "#8A7A5C", flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#0F0F0F", flex: 1 }}>{label}</span>
        {!disabled && score != null && (
          <span style={{ fontSize: 14, fontWeight: 700, color: barColor, fontVariantNumeric: "tabular-nums" }}>
            {Math.round(score)}
          </span>
        )}
        <span style={{ fontSize: 10, color: "#9CA3AF" }}>
          {pct > 0 ? `${pct}% weight` : "—"}
        </span>
      </div>
      {!disabled && (
        <div style={{ background: "rgba(0,0,0,0.06)", borderRadius: 4, height: 5, marginBottom: 6 }}>
          <div style={{
            background: barColor, borderRadius: 4, height: 5,
            width: `${Math.max(0, Math.min(100, score ?? 0))}%`,
            transition: "width 0.5s ease",
          }} />
        </div>
      )}
      <p style={{ fontSize: 11, color: disabled ? "#9CA3AF" : statusColor, margin: 0 }}>{statusText}</p>
    </div>
  );
}

// ── Hooks ────────────────────────────────────────────────────
function useBuildings() {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [bRes, aRes, tRes, sRes] = await Promise.all([
      supabase.from("buildings").select("*").order("name"),
      supabase.from("assets").select("id, property_name"),
      supabase.from("tenants").select("id, building_id"),
      supabase.from("checklist_submissions")
        .select("id, checklist_id, building, submitted_at, score, form_data")
        .eq("checklist_id", "bca-site")
        .or("archived.eq.false,archived.is.null")
        .order("submitted_at", { ascending: false }),
    ]);

    let localTasks = [];
    try { localTasks = JSON.parse(localStorage.getItem("ops.tasks") || "[]"); } catch {}

    const today = new Date();
    const openCounts = {}, overdueCounts = {}, assetCounts = {}, tenantCounts = {}, bcaByBuilding = {};

    localTasks.forEach((t) => {
      if (t.status !== "Done" && t.status !== "Archived") {
        openCounts[t.property] = (openCounts[t.property] || 0) + 1;
        if (t.dueDate && new Date(t.dueDate + "T00:00:00") < today)
          overdueCounts[t.property] = (overdueCounts[t.property] || 0) + 1;
      }
    });
    // Count by property_name string match — building_id may be null for older assets
    (aRes.data || []).forEach((a) => {
      if (a.property_name) assetCounts[a.property_name] = (assetCounts[a.property_name] || 0) + 1;
    });
    (tRes.data || []).forEach((t) => {
      if (t.building_id) tenantCounts[t.building_id] = (tenantCounts[t.building_id] || 0) + 1;
    });
    (sRes.data || []).forEach((s) => {
      if (!bcaByBuilding[s.building]) bcaByBuilding[s.building] = [];
      bcaByBuilding[s.building].push(s);
    });

    const enriched = (bRes.data || []).map((b) => ({
      ...b,
      openTaskCount:    openCounts[b.name]    || 0,
      overdueTaskCount: overdueCounts[b.name] || 0,
      assetCount:       assetCounts[b.name]   || 0,
      tenantCount:      tenantCounts[b.id]    || 0,
    }));

    // Back-fill health_score for buildings that have never had one computed
    const nullBuildings = enriched.filter((b) => b.health_score == null);
    if (nullBuildings.length > 0) {
      await Promise.all(
        nullBuildings.map((b) => {
          const { score } = computeHealthScore(b.name, bcaByBuilding[b.name] || [], localTasks);
          b.health_score = score; // update local copy for immediate display
          return supabase.from("buildings").update({ health_score: score }).eq("id", b.id);
        })
      );
    }

    setBuildings(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { buildings, loading, reload: load };
}

function useBuildingData(id) {
  const [building, setBuilding] = useState(null);
  const [assets, setAssets] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    // Fetch building first so we can query submissions by name (building_id may be null on older rows)
    const { data: bData } = await supabase.from("buildings").select("*").eq("id", id).single();
    setBuilding(bData);
    if (!bData) { setLoading(false); return; }

    const [aRes, iRes, dRes, tRes, sRes] = await Promise.all([
      supabase.from("assets").select("*").eq("building_id", id).order("name"),
      supabase.from("inspections").select("*").eq("building_id", id).order("scheduled_date", { ascending: false }),
      supabase.from("documents").select("*").eq("building_id", id).order("uploaded_at", { ascending: false }),
      supabase.from("tenants").select("*").eq("building_id", id).order("unit"),
      supabase.from("checklist_submissions")
        .select("*")
        .eq("building", bData.name)
        .or("archived.eq.false,archived.is.null")
        .order("submitted_at", { ascending: false }),
    ]);
    setAssets(aRes.data || []);
    setInspections(iRes.data || []);
    setDocuments(dRes.data || []);
    setTenants(tRes.data || []);
    setSubmissions(sRes.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const updateBuilding = useCallback(async (fields) => {
    if (!id) return;
    await supabase.from("buildings").update(fields).eq("id", id);
    setBuilding((prev) => ({ ...prev, ...fields }));
  }, [id]);

  const saveInspection = useCallback(async (insp) => {
    if (insp.id) {
      const { id: _, created_at, ...fields } = insp;
      await supabase.from("inspections").update(fields).eq("id", insp.id);
    } else {
      await supabase.from("inspections").insert({ ...insp, building_id: id });
    }
    await load();
  }, [id, load]);

  const removeInspection = useCallback(async (inspId) => {
    await supabase.from("inspections").delete().eq("id", inspId);
    setInspections((prev) => prev.filter((i) => i.id !== inspId));
  }, []);

  const saveDocument = useCallback(async (doc) => {
    if (doc.id) {
      const { id: _, uploaded_at, ...fields } = doc;
      await supabase.from("documents").update(fields).eq("id", doc.id);
    } else {
      await supabase.from("documents").insert({ ...doc, building_id: id });
    }
    await load();
  }, [id, load]);

  const removeDocument = useCallback(async (docId) => {
    await supabase.from("documents").delete().eq("id", docId);
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  const saveTenant = useCallback(async (tenant) => {
    if (tenant.id) {
      const { id: _, created_at, ...fields } = tenant;
      await supabase.from("tenants").update(fields).eq("id", tenant.id);
    } else {
      await supabase.from("tenants").insert({ ...tenant, building_id: id });
    }
    await load();
  }, [id, load]);

  const removeTenant = useCallback(async (tenantId) => {
    await supabase.from("tenants").delete().eq("id", tenantId);
    setTenants((prev) => prev.filter((t) => t.id !== tenantId));
  }, []);

  return {
    building, assets, inspections, documents, tenants, submissions, loading,
    reload: load, updateBuilding,
    saveInspection, removeInspection,
    saveDocument, removeDocument,
    saveTenant, removeTenant,
  };
}

// ── Shared UI ────────────────────────────────────────────────
function HealthBadge({ score, size = "md" }) {
  if (score == null) return <span style={{ color: "#9CA3AF", fontWeight: 600 }}>—</span>;
  const n = Math.round(score);
  const color = n >= 80 ? "#15803D" : n >= 60 ? "#B45309" : "#B91C1C";
  const bg    = n >= 80 ? "#DCFCE7" : n >= 60 ? "#FEF3C7" : "#FEE2E2";
  const fs    = size === "lg" ? 22 : 13;
  const px    = size === "lg" ? "12px 18px" : "2px 8px";
  return (
    <span style={{ background: bg, color, fontWeight: 700, fontSize: fs, padding: px, borderRadius: 10 }}>
      {n}
    </span>
  );
}

function StatusChip({ status, map = BUILDING_STATUSES, style: extraStyle }) {
  const s = map[status] || map[Object.keys(map)[0]];
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600,
      padding: "2px 8px", borderRadius: 8, whiteSpace: "nowrap", ...extraStyle }}>
      {s.label}
    </span>
  );
}

function Monogram({ name, size = 40 }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: 12, background: "#0F4C5C", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "white", fontSize: size * 0.35, fontWeight: 700 }}>{initials}</span>
    </div>
  );
}

function Pill({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "none",
        cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
        background: active ? "#0F0F0F" : "rgba(0,0,0,0.04)",
        color: active ? "white" : "#8A7A5C" }}>
      {label}
    </button>
  );
}

function Sheet({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end",
      background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", background: "#FAF6EE",
        borderRadius: "24px 24px 0 0", padding: "20px 16px 40px",
        animation: "slideUp 0.25s cubic-bezier(.32,1,.56,1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: "rgba(0,0,0,0.05)",
            border: "none", cursor: "pointer", display: "flex" }}>
            <X size={16} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#0F0F0F" }}>{title}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8A7A5C",
        marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 13,
  border: "1.5px solid rgba(0,0,0,0.12)", background: "white",
  color: "#0F0F0F", boxSizing: "border-box",
};

const selectStyle = { ...inputStyle, appearance: "none" };

function SaveBtn({ saving, onClick, label = "Save" }) {
  return (
    <button onClick={onClick} disabled={saving}
      style={{ width: "100%", padding: "11px", borderRadius: 12, border: "none",
        background: "#0F0F0F", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}>
      {saving ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : label}
    </button>
  );
}

function EmptyState({ icon: Icon = AlertCircle, text }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 16px", color: "#8A7A5C" }}>
      <Icon size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
      <p style={{ fontSize: 13, margin: 0 }}>{text}</p>
    </div>
  );
}

function ConfirmDelete({ onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center",
      justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 20, padding: 24, maxWidth: 320, width: "100%" }}>
        <p style={{ fontWeight: 700, color: "#0F0F0F", marginBottom: 6 }}>Delete this item?</p>
        <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>This cannot be undone.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: 10, borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.12)",
            background: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none",
            background: "#B91C1C", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Portfolio ────────────────────────────────────────────────
function BuildingCard({ building }) {
  const { id, name, status, health_score, openTaskCount, overdueTaskCount, assetCount, tenantCount } = building;
  return (
    <Link to={`/buildings/${id}`} style={{ textDecoration: "none" }}>
      <div style={{ background: "white", borderRadius: 16, padding: "14px 16px",
        border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center",
        gap: 12, cursor: "pointer", transition: "box-shadow 0.15s" }}>
        <Monogram name={name} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#0F0F0F",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name}
            </span>
            <StatusChip status={status || "operational"} />
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#8A7A5C", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <ClipboardList size={10} />
              {openTaskCount} open
              {overdueTaskCount > 0 && (
                <span style={{ color: "#B91C1C", fontWeight: 700 }}> · {overdueTaskCount} overdue</span>
              )}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Wrench size={10} /> {assetCount} assets
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Users size={10} /> {tenantCount} tenants
            </span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <HealthBadge score={health_score} />
          <span style={{ fontSize: 10, color: "#8A7A5C" }}>health</span>
        </div>
        <ChevronRight size={14} style={{ color: "#8A7A5C", flexShrink: 0 }} />
      </div>
    </Link>
  );
}

function BuildingsPortfolio() {
  const { buildings, loading, reload } = useBuildings();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    let list = buildings;
    if (statusFilter !== "all") list = list.filter((b) => (b.status || "operational") === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b) => b.name.toLowerCase().includes(q));
    }
    return list;
  }, [buildings, search, statusFilter]);

  const totals = useMemo(() => ({
    openTasks: buildings.reduce((s, b) => s + b.openTaskCount, 0),
    overdue:   buildings.reduce((s, b) => s + b.overdueTaskCount, 0),
    assets:    buildings.reduce((s, b) => s + b.assetCount, 0),
  }), [buildings]);

  return (
    <div style={{ minHeight: "100vh", background: "#D4C7B0" }}>
      <style>{`
        .bd-card { max-height: none !important; }
        .bd-scrollbar::-webkit-scrollbar { display: none; }
        .bd-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        .font-display { font-family: 'Fraunces', Georgia, serif; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#0F0F0F", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 20 }}>
        <Link to="/" style={{ display: "flex", padding: 6, borderRadius: 8, background: "rgba(255,255,255,0.1)", color: "white" }}>
          <ArrowLeft size={16} />
        </Link>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0 }}>Portfolio</p>
          <p className="font-display" style={{ fontSize: 17, fontWeight: 600, color: "white", margin: 0 }}>Buildings</p>
        </div>
        <button onClick={reload} style={{ padding: 6, borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", color: "white", display: "flex" }}>
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Summary strip */}
      <div style={{ background: "#FAF6EE", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: 0 }}>
        {[
          { label: "Buildings",    value: buildings.length,   icon: Building2 },
          { label: "Open Tasks",   value: totals.openTasks,   icon: ClipboardList },
          { label: "Overdue",      value: totals.overdue,     icon: AlertTriangle, warn: totals.overdue > 0 },
          { label: "Assets",       value: totals.assets,      icon: Wrench },
        ].map(({ label, value, icon: Icon, warn }) => (
          <div key={label} style={{ flex: 1, padding: "10px 4px", textAlign: "center", borderRight: "1px solid rgba(0,0,0,0.06)" }}>
            <Icon size={12} style={{ color: warn ? "#B91C1C" : "#8A7A5C", display: "block", margin: "0 auto 2px" }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: warn ? "#B91C1C" : "#0F0F0F", display: "block" }}>{value}</span>
            <span style={{ fontSize: 10, color: "#8A7A5C" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{ padding: "12px 16px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "white", borderRadius: 12, padding: "8px 12px", border: "1.5px solid rgba(0,0,0,0.08)" }}>
          <Search size={14} style={{ color: "#8A7A5C" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search buildings…" style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent", color: "#0F0F0F" }} />
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }} className="bd-scrollbar">
          {["all", ...Object.keys(BUILDING_STATUSES)].map((s) => (
            <Pill key={s} label={s === "all" ? "All" : BUILDING_STATUSES[s].label}
              active={statusFilter === s} onClick={() => setStatusFilter(s)} />
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Loader2 size={24} style={{ color: "#8A7A5C", animation: "spin 1s linear infinite" }} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Building2} text={search ? "No buildings match your search" : "No buildings found — run the Phase 3 SQL migration first"} />
        ) : (
          filtered.map((b) => <BuildingCard key={b.id} building={b} />)
        )}
      </div>
    </div>
  );
}

// ── Building Detail Tabs ─────────────────────────────────────
function OverviewTab({ building, computedHealth, updateBuilding }) {
  const [editingStatus, setEditingStatus] = useState(false);
  const [form, setForm] = useState({ status: building?.status || "operational" });
  const [saving, setSaving] = useState(false);

  const saveStatus = async () => {
    setSaving(true);
    await updateBuilding({ status: form.status });
    setSaving(false);
    setEditingStatus(false);
  };

  const W    = HEALTH_SCORE_CONFIG.weights;
  const score = computedHealth?.score ?? building?.health_score;
  const { task, bca } = computedHealth?.breakdown || {};

  const taskStatusText = !task
    ? "Computing…"
    : task.status === "no_tasks"  ? "No open tasks"
    : task.status === "ok"        ? `${task.openCount} open · all on time`
    : `${task.openCount} open · ${task.overdueCount} overdue`;

  const taskStatusColor = !task ? "#9CA3AF"
    : task.status === "ok" ? "#15803D"
    : task.overdueCount > 0 ? "#B91C1C" : "#8A7A5C";

  const bcaStatusText = !bca
    ? "Computing…"
    : bca.status === "missing"  ? "No BCA on file"
    : bca.status === "stale"    ? `BCA overdue · last: ${bca.lastDate?.slice(0, 10)}${bca.lastScore != null ? `, scored ${Math.round(bca.lastScore)}` : ""}`
    : `Current · last BCA: ${bca.lastDate?.slice(0, 10)}`;

  const bcaStatusColor = !bca ? "#9CA3AF"
    : bca.status === "current" ? "#15803D"
    : bca.status === "stale"   ? "#B45309" : "#B91C1C";

  const bcaDisplayScore = bca?.status === "current" ? bca.lastScore : null;

  return (
    <div style={{ padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Health score summary */}
      <div style={{ background: "white", borderRadius: 16, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: editingStatus ? 14 : 0 }}>
          <HealthBadge score={score} size="lg" />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, color: "#8A7A5C", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Health Score</p>
            <StatusChip status={building?.status || "operational"} />
          </div>
          <button
            onClick={() => setEditingStatus(!editingStatus)}
            style={{ fontSize: 11, color: "#0F4C5C", fontWeight: 600, background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
          >
            {editingStatus ? "Cancel" : "Edit status"}
          </button>
        </div>
        {editingStatus && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="Building Status">
              <select style={selectStyle} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                {Object.entries(BUILDING_STATUSES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </Field>
            <SaveBtn saving={saving} onClick={saveStatus} />
          </div>
        )}
      </div>

      <p style={{ fontSize: 11, fontWeight: 600, color: "#8A7A5C", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
        Score breakdown
      </p>

      {/* Task performance */}
      <ScoreCard
        icon={ClipboardList}
        label="Task Performance"
        weight={W.taskOnTimeRate}
        score={task?.score ?? null}
        statusText={taskStatusText}
        statusColor={taskStatusColor}
      />

      {/* BCA checklist */}
      <ScoreCard
        icon={CheckCircle2}
        label="Building Inspections (BCA)"
        weight={W.checklistScore}
        score={bcaDisplayScore}
        statusText={bcaStatusText}
        statusColor={bcaStatusColor}
      />

      {/* Asset condition — coming soon */}
      <ScoreCard
        icon={Wrench}
        label="Asset Condition"
        weight={0}
        score={null}
        statusText="Coming soon — add condition data to assets to enable this"
        disabled
      />
    </div>
  );
}

function TasksTab({ buildingName }) {
  const tasks = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("ops.tasks") || "[]"); } catch { return []; }
  }, []);

  const buildingTasks = useMemo(
    () => tasks.filter((t) => t.property === buildingName),
    [tasks, buildingName]
  );

  const [statusFilter, setStatusFilter] = useState("all");
  const filtered = statusFilter === "all" ? buildingTasks : buildingTasks.filter((t) => t.status === statusFilter);

  return (
    <div style={{ padding: "12px 16px 40px" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }} className="bd-scrollbar">
        {["all", "Pending", "In Progress", "Done"].map((s) => (
          <Pill key={s} label={s === "all" ? `All (${buildingTasks.length})` : s}
            active={statusFilter === s} onClick={() => setStatusFilter(s)} />
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} text="No tasks for this building" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((t) => {
            const s = TASK_STATUSES[t.status] || TASK_STATUSES.Pending;
            const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Done" && t.status !== "Archived";
            return (
              <div key={t.id} style={{ background: "white", borderRadius: 12, padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0F0F0F", margin: "0 0 4px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.title}
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 6 }}>
                        {t.status}
                      </span>
                      {t.assignee && <span style={{ fontSize: 11, color: "#8A7A5C" }}>{t.assignee}</span>}
                      {t.dueDate && (
                        <span style={{ fontSize: 11, color: overdue ? "#B91C1C" : "#8A7A5C", fontWeight: overdue ? 600 : 400, display: "flex", alignItems: "center", gap: 3 }}>
                          <Calendar size={9} />
                          {t.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: "#9CA3AF", flexShrink: 0 }}>{t.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssetsTab({ assets }) {
  return (
    <div style={{ padding: "12px 16px 40px" }}>
      {assets.length === 0 ? (
        <EmptyState icon={Wrench} text="No assets registered for this building. Add them from the Asset Register in the main app." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {assets.map((a) => {
            const s = ASSET_STATUSES[a.status] || ASSET_STATUSES.operational;
            return (
              <div key={a.id} style={{ background: "white", borderRadius: 12, padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Wrench size={14} style={{ color: "#8A7A5C", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0F0F0F", margin: "0 0 3px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.name}
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 6 }}>
                        {s.label}
                      </span>
                      <span style={{ fontSize: 11, color: "#8A7A5C" }}>{a.asset_type}</span>
                      {a.warranty_expiry && <span style={{ fontSize: 11, color: "#8A7A5C", display: "flex", alignItems: "center", gap: 3 }}><Calendar size={9} />Warranty {a.warranty_expiry}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InspectionForm({ initial, onSave, onClose }) {
  const blank = { type: "", scheduled_date: "", completed_date: "", status: "scheduled", overall_result: "", inspector: "", notes: "" };
  const [form, setForm] = useState(initial ? { ...blank, ...initial } : blank);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.type) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };

  return (
    <Sheet title={initial?.id ? "Edit Inspection" : "Add Inspection"} onClose={onClose}>
      <Field label="Type">
        <select style={selectStyle} value={form.type} onChange={set("type")}>
          <option value="">Select type…</option>
          {INSPECTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Status">
        <select style={selectStyle} value={form.status} onChange={set("status")}>
          {Object.entries(INSPECTION_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Scheduled Date">
          <input style={inputStyle} type="date" value={form.scheduled_date} onChange={set("scheduled_date")} />
        </Field>
        <Field label="Completed Date">
          <input style={inputStyle} type="date" value={form.completed_date} onChange={set("completed_date")} />
        </Field>
      </div>
      <Field label="Result">
        <select style={selectStyle} value={form.overall_result} onChange={set("overall_result")}>
          <option value="">—</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
          <option value="conditional">Conditional</option>
        </select>
      </Field>
      <Field label="Inspector">
        <input style={inputStyle} value={form.inspector} onChange={set("inspector")} placeholder="Name" />
      </Field>
      <Field label="Notes">
        <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 64 }} value={form.notes} onChange={set("notes")} placeholder="Optional notes" />
      </Field>
      <SaveBtn saving={saving} onClick={save} />
    </Sheet>
  );
}

function InspectionsTab({ inspections, saveInspection, removeInspection }) {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  return (
    <div style={{ padding: "12px 16px 40px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button onClick={() => setShowForm(true)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 10, border: "none",
            background: "#0F0F0F", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <Plus size={12} /> Add Inspection
        </button>
      </div>
      {inspections.length === 0 ? (
        <EmptyState icon={ClipboardList} text="No inspections recorded" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {inspections.map((insp) => {
            const s = INSPECTION_STATUSES[insp.status] || INSPECTION_STATUSES.scheduled;
            return (
              <div key={insp.id} style={{ background: "white", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <ClipboardList size={14} style={{ color: "#8A7A5C", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#0F0F0F", margin: "0 0 4px" }}>{insp.type}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <StatusChip status={insp.status} map={INSPECTION_STATUSES} />
                    {insp.scheduled_date && (
                      <span style={{ fontSize: 11, color: "#8A7A5C", display: "flex", alignItems: "center", gap: 3 }}>
                        <Calendar size={9} /> {insp.scheduled_date}
                      </span>
                    )}
                    {insp.inspector && <span style={{ fontSize: 11, color: "#8A7A5C" }}>{insp.inspector}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setEditItem(insp)}
                    style={{ fontSize: 11, color: "#0F4C5C", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                    Edit
                  </button>
                  <button onClick={() => setDeleteId(insp.id)}
                    style={{ display: "flex", padding: 4, borderRadius: 6, background: "#FEE2E2", border: "none", cursor: "pointer" }}>
                    <Trash2 size={12} style={{ color: "#B91C1C" }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {(showForm || editItem) && (
        <InspectionForm
          initial={editItem}
          onSave={saveInspection}
          onClose={() => { setShowForm(false); setEditItem(null); }}
        />
      )}
      {deleteId && (
        <ConfirmDelete
          onConfirm={() => { removeInspection(deleteId); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

function DocumentForm({ onSave, onClose, initial }) {
  const blank = { name: "", kind: "other", file_url: "", notes: "" };
  const [form, setForm] = useState(initial ? { ...blank, ...initial } : blank);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };

  return (
    <Sheet title={initial?.id ? "Edit Document" : "Add Document"} onClose={onClose}>
      <Field label="Document Name">
        <input style={inputStyle} value={form.name} onChange={set("name")} placeholder="e.g. COC 2025" />
      </Field>
      <Field label="Kind">
        <select style={selectStyle} value={form.kind} onChange={set("kind")}>
          {DOC_KINDS.map((k) => <option key={k} value={k}>{DOC_KIND_LABELS[k]}</option>)}
        </select>
      </Field>
      <Field label="File URL">
        <input style={inputStyle} value={form.file_url} onChange={set("file_url")} placeholder="https://…" type="url" />
      </Field>
      <SaveBtn saving={saving} onClick={save} />
    </Sheet>
  );
}

function DocumentsTab({ documents, saveDocument, removeDocument }) {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [kindFilter, setKindFilter] = useState("all");

  const filtered = kindFilter === "all" ? documents : documents.filter((d) => d.kind === kindFilter);

  return (
    <div style={{ padding: "12px 16px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <select style={{ ...selectStyle, width: "auto", padding: "6px 10px", fontSize: 12 }}
          value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
          <option value="all">All types</option>
          {DOC_KINDS.map((k) => <option key={k} value={k}>{DOC_KIND_LABELS[k]}</option>)}
        </select>
        <button onClick={() => setShowForm(true)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 10, border: "none",
            background: "#0F0F0F", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <Plus size={12} /> Add
        </button>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={FileText} text="No documents" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((doc) => (
            <div key={doc.id} style={{ background: "white", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <FileText size={14} style={{ color: "#8A7A5C", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#0F0F0F", margin: "0 0 3px" }}>{doc.name}</p>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#8A7A5C", background: "rgba(0,0,0,0.05)", padding: "1px 7px", borderRadius: 6 }}>
                    {DOC_KIND_LABELS[doc.kind] || doc.kind}
                  </span>
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#0F4C5C", fontWeight: 600 }}>
                      Open ↗
                    </a>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => setEditItem(doc)}
                  style={{ fontSize: 11, color: "#0F4C5C", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                  Edit
                </button>
                <button onClick={() => setDeleteId(doc.id)}
                  style={{ display: "flex", padding: 4, borderRadius: 6, background: "#FEE2E2", border: "none", cursor: "pointer" }}>
                  <Trash2 size={12} style={{ color: "#B91C1C" }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {(showForm || editItem) && (
        <DocumentForm initial={editItem} onSave={saveDocument} onClose={() => { setShowForm(false); setEditItem(null); }} />
      )}
      {deleteId && (
        <ConfirmDelete
          onConfirm={() => { removeDocument(deleteId); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

function TenantForm({ onSave, onClose, initial }) {
  const blank = { unit: "", name: "", contact: "", lease_start: "", lease_end: "" };
  const [form, setForm] = useState(initial ? { ...blank, ...initial } : blank);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };

  return (
    <Sheet title={initial?.id ? "Edit Tenant" : "Add Tenant"} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Unit">
          <input style={inputStyle} value={form.unit} onChange={set("unit")} placeholder="e.g. G01" />
        </Field>
        <Field label="Tenant Name">
          <input style={inputStyle} value={form.name} onChange={set("name")} placeholder="Name or Vacant" />
        </Field>
      </div>
      <Field label="Contact">
        <input style={inputStyle} value={form.contact} onChange={set("contact")} placeholder="Email or phone" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Lease Start">
          <input style={inputStyle} type="date" value={form.lease_start} onChange={set("lease_start")} />
        </Field>
        <Field label="Lease End">
          <input style={inputStyle} type="date" value={form.lease_end} onChange={set("lease_end")} />
        </Field>
      </div>
      <SaveBtn saving={saving} onClick={save} />
    </Sheet>
  );
}

function TenantsTab({ tenants, saveTenant, removeTenant }) {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const expiringSoon = tenants.filter((t) => t.lease_end && t.lease_end > today &&
    new Date(t.lease_end) < new Date(Date.now() + 60 * 24 * 3600 * 1000));

  return (
    <div style={{ padding: "12px 16px 40px" }}>
      {expiringSoon.length > 0 && (
        <div style={{ background: "#FEF3C7", borderRadius: 10, padding: "8px 12px", marginBottom: 10,
          display: "flex", gap: 6, alignItems: "flex-start" }}>
          <AlertTriangle size={13} style={{ color: "#B45309", marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: "#B45309", margin: 0 }}>
            {expiringSoon.length} lease{expiringSoon.length > 1 ? "s" : ""} expiring within 60 days
          </p>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button onClick={() => setShowForm(true)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 10, border: "none",
            background: "#0F0F0F", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <Plus size={12} /> Add Tenant
        </button>
      </div>
      {tenants.length === 0 ? (
        <EmptyState icon={Users} text="No tenants recorded" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tenants.map((t) => {
            const expired = t.lease_end && t.lease_end < today;
            const expiring = expiringSoon.some((e) => e.id === t.id);
            return (
              <div key={t.id} style={{ background: "white", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#F3F4F6", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Users size={14} style={{ color: "#6B7280" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
                    {t.unit && <span style={{ fontSize: 11, fontWeight: 700, color: "#0F4C5C", background: "#EFF6FF", padding: "1px 6px", borderRadius: 5 }}>{t.unit}</span>}
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0F0F0F" }}>{t.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#8A7A5C" }}>
                    {t.contact && <span>{t.contact}</span>}
                    {t.lease_end && (
                      <span style={{ color: expired ? "#B91C1C" : expiring ? "#B45309" : "#8A7A5C", fontWeight: expired || expiring ? 600 : 400 }}>
                        {expired ? "Expired" : "Ends"} {t.lease_end}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setEditItem(t)}
                    style={{ fontSize: 11, color: "#0F4C5C", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                    Edit
                  </button>
                  <button onClick={() => setDeleteId(t.id)}
                    style={{ display: "flex", padding: 4, borderRadius: 6, background: "#FEE2E2", border: "none", cursor: "pointer" }}>
                    <Trash2 size={12} style={{ color: "#B91C1C" }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {(showForm || editItem) && (
        <TenantForm initial={editItem} onSave={saveTenant} onClose={() => { setShowForm(false); setEditItem(null); }} />
      )}
      {deleteId && (
        <ConfirmDelete
          onConfirm={() => { removeTenant(deleteId); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

// ── Building Detail ──────────────────────────────────────────
const TABS = [
  { id: "overview",     label: "Overview",    icon: BarChart2 },
  { id: "tasks",        label: "Tasks",       icon: ClipboardList },
  { id: "assets",       label: "Assets",      icon: Wrench },
  { id: "inspections",  label: "Inspections", icon: CheckCircle2 },
  { id: "documents",    label: "Documents",   icon: FileText },
  { id: "tenants",      label: "Tenants",     icon: Users },
];

function BuildingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const {
    building, assets, inspections, documents, tenants, submissions, loading,
    updateBuilding, saveInspection, removeInspection,
    saveDocument, removeDocument, saveTenant, removeTenant,
  } = useBuildingData(id);

  const localTasks = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("ops.tasks") || "[]"); } catch { return []; }
  }, []);

  const computedHealth = useMemo(() => {
    if (!building) return null;
    return computeHealthScore(building.name, submissions, localTasks);
  }, [building, submissions, localTasks]);

  // Auto-save fresh score back to the building when it differs by more than 1 point
  useEffect(() => {
    if (!building || computedHealth == null) return;
    const stored = building.health_score;
    if (stored == null || Math.abs(stored - computedHealth.score) > 1) {
      updateBuilding({ health_score: computedHealth.score });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedHealth?.score]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#D4C7B0", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={28} style={{ color: "#8A7A5C", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!building) {
    return (
      <div style={{ minHeight: "100vh", background: "#D4C7B0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <AlertCircle size={28} style={{ color: "#8A7A5C" }} />
        <p style={{ fontSize: 14, color: "#8A7A5C" }}>Building not found</p>
        <Link to="/buildings" style={{ fontSize: 13, fontWeight: 600, color: "#0F4C5C" }}>← Back to portfolio</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#D4C7B0", display: "flex", flexDirection: "column" }}>
      <style>{`
        .bd-scrollbar::-webkit-scrollbar { display: none; }
        .bd-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        .font-display { font-family: 'Fraunces', Georgia, serif; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#0F0F0F", padding: "14px 16px", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <button onClick={() => navigate("/buildings")}
            style={{ display: "flex", padding: 6, borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", color: "white" }}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", margin: "0 0 2px" }}>Buildings</p>
            <p className="font-display" style={{ fontSize: 16, fontWeight: 600, color: "white", margin: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {building.name}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <HealthBadge score={building.health_score} />
            <StatusChip status={building.status || "operational"} />
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 2, overflowX: "auto", paddingBottom: 2 }} className="bd-scrollbar">
          {TABS.map(({ id: tid, label, icon: Icon }) => (
            <button key={tid} onClick={() => setActiveTab(tid)}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8,
                border: "none", cursor: "pointer", whiteSpace: "nowrap", fontSize: 11, fontWeight: 600, transition: "all 0.15s",
                background: activeTab === tid ? "rgba(255,255,255,0.18)" : "transparent",
                color: activeTab === tid ? "white" : "rgba(255,255,255,0.45)" }}>
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto" }} className="bd-scrollbar">
        {activeTab === "overview" && <OverviewTab building={building} computedHealth={computedHealth} updateBuilding={updateBuilding} />}
        {activeTab === "tasks" && <TasksTab buildingName={building.name} />}
        {activeTab === "assets" && <AssetsTab assets={assets} />}
        {activeTab === "inspections" && (
          <InspectionsTab inspections={inspections} saveInspection={saveInspection} removeInspection={removeInspection} />
        )}
        {activeTab === "documents" && (
          <DocumentsTab documents={documents} saveDocument={saveDocument} removeDocument={removeDocument} />
        )}
        {activeTab === "tenants" && (
          <TenantsTab tenants={tenants} saveTenant={saveTenant} removeTenant={removeTenant} />
        )}
      </div>
    </div>
  );
}

// ── Router ───────────────────────────────────────────────────
export default function BuildingsDashboard() {
  const { id } = useParams();
  return id ? <BuildingDetail /> : <BuildingsPortfolio />;
}
