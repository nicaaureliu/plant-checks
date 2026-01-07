/* public/app.js */

const BUILD = "v6";

// ---------- DOM helpers ----------
const el = (id) => document.getElementById(id);

function setStatus(msg, ok = true) {
  const s = el("status");
  s.textContent = (ok ? "✅ " : "❌ ") + msg;
}

function getTokenFromUrl() {
  return new URLSearchParams(location.search).get("t") || "";
}

// ---------- Date helpers ----------
function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDDMMYYYY(iso) {
  if (!iso || !iso.includes("-")) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function getWeekCommencingISO(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // Sun=0 ... Mon=1
  const diffToMon = (day === 0 ? -6 : 1 - day);
  dt.setDate(dt.getDate() + diffToMon);
  return toISODate(dt);
}

function getDayIndexMon0(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // Sun=0
  return day === 0 ? 6 : day - 1; // Mon=0..Sun=6
}

// ---------- Checks lists ----------
const CHECKS = {
  excavator: [
    "BUCKET, Excessive wear or Damage, Cracks",
    "BUCKET CYLINDER & LINKAGE, Excessive wear or Damage, Leaks",
    "STICK, Excessive wear or Damage, Cracks",
    "BOOM CYLINDERS, Excessive wear or Damage, Leaks",
    "UNDERNEATH OF MACHINE FINAL DRIVE, Damage, Leaks",
    "CAB, Damage, Cracks",
    "UNDERCARRIAGE, Wear Damage, Tension",
    "STEPS & HANDHOLDS, Condition & Cleanliness",
    "BATTERIES & HOLDOWNS, Cleanliness, Loose Bolts and Nuts",
    "AIR FILTER, Restriction Indicator",
    "WINDSHIELD WIPERS AND WASHERS, Wear, Damage, Fluid Level",
    "ENGINE COOLANT, Fluid Level",
    "RADIATOR, Fin Blockage, Leaks",
    "HYDRAULIC OIL TANK, Fluid Level, Damage, Leaks",
    "FUEL TANK, Fluid Level, Damage, Leaks",
    "FIRE EXTINGUISHER, Charge, Damage",
    "LIGHTS, Damage / working",
    "MIRRORS, Damage Adjust for Best Visibility",
    "FUEL WATER SEPARATOR, Drain",
    "OVERALL MACHINE, Loose Or Missing Nuts & Bolts, Loose Guards, Cleanliness",
    "SWING GEAR OIL LEVEL, Fluid Level",
    "ENGINE OIL, Fluid Level",
    "ALL HOSES, Cracks, Wear Spots, Leaks",
    "ALL BELTS, Tension, Wear, Cracks",
    "OVERALL ENGINE COMPARTMENT, Rubbish, Dirt, Leaks",
    "SEAT, Adjustment",
    "SEAT BELT & MOUNTING, Damage, Wear, Adjustment",
    "INDICATORS & GAUGES, Check, Test",
    "HORN / BACKUP ALARM / LIGHTS, Proper Function",
    "OVERALL CAB INTERIOR, Cleanliness",
  ],
  crane: [
    "Outriggers / stabilisers – condition & function",
    "Slew ring / rotation – smooth operation",
    "Boom / jib sections – damage / pins secure",
    "Hoist ropes / chains – wear, kinks, damage",
    "Hook block / safety latch – condition",
    "Load charts / radius indicator – present & working",
    "Limit switches / A2B – functional",
    "Hydraulic oil level – correct",
    "Tyres / tracks – condition & pressure / tension",
    "Lights / horn / reversing alarm – working",
    "Fire extinguisher – present & charged",
    "Cab controls / seatbelt – working",
  ],
  dumper: [
    "Walkaround – leaks / damage",
    "Tyres / wheel nuts – condition",
    "Steering – operation",
    "Brakes / handbrake – operation",
    "Hydraulic rams – leaks",
    "Lights / horn / alarm – working",
    "Mirrors / camera – OK",
    "Seatbelt – OK",
    "Rollover protection / guards – OK",
    "Fire extinguisher – OK",
    "Fluid levels – check",
    "Cab / steps / handholds – clean & safe",
  ],
};

// ---------- State ----------
const state = {
  token: "",
  equipmentType: "",        // "excavator" | "crane" | "dumper"
  labels: [],
  statuses: [],             // [row][day] = "OK" | "DEFECT" | "NA" | null
  activeDay: 0,
  weekCommencingISO: "",
  weekKey: "",
};

// ---------- UI / table ----------
function markToSymbol(st) {
  if (st === "OK") return "✓";
  if (st === "DEFECT") return "X";
  if (st === "NA") return "N/A";
  return "";
}
function cycleStatus(st) {
  if (!st) return "OK";
  if (st === "OK") return "DEFECT";
  if (st === "DEFECT") return "NA";
  return null;
}

function setType(type) {
  state.equipmentType = type;
  state.labels = CHECKS[type] || [];
  state.statuses = state.labels.map(() => Array(7).fill(null));

  // buttons
  ["btnExc","btnCrane","btnDump"].forEach((id) => el(id).classList.remove("active"));
  if (type === "excavator") el("btnExc").classList.add("active");
  if (type === "crane") el("btnCrane").classList.add("active");
  if (type === "dumper") el("btnDump").classList.add("active");

  el("selectedType").textContent = `Selected: ${type ? type[0].toUpperCase() + type.slice(1) : "—"}`;

  // title
  const title =
    type === "excavator" ? "Excavator Pre-Use Inspection Checklist" :
    type === "crane" ? "Crane Pre-Use Inspection Checklist" :
    type === "dumper" ? "Dumper Pre-Use Inspection Checklist" :
    "Plant Pre-Use Inspection Checklist";
  el("sheetTitle").textContent = title;

  buildTable();
  maybeLoadWeek();
}

function buildTable() {
  const body = el("checksBody");
  body.innerHTML = "";

  const dateStr = el("date").value;
  state.activeDay = dateStr ? getDayIndexMon0(dateStr) : 0;

  for (let r = 0; r < state.labels.length; r++) {
    const tr = document.createElement("tr");

    const tdItem = document.createElement("td");
    tdItem.className = "item";
    tdItem.textContent = state.labels[r];
    tr.appendChild(tdItem);

    for (let d = 0; d < 7; d++) {
      const td = document.createElement("td");
      td.className = "day " + (d === state.activeDay ? "active todayCol" : "inactive");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "markBtn";
      btn.textContent = markToSymbol(state.statuses[r]?.[d] || null);

      btn.disabled = (d !== state.activeDay);

      btn.addEventListener("click", () => {
        const current = state.statuses[r][d];
        const next = cycleStatus(current);
        state.statuses[r][d] = next;
        btn.textContent = markToSymbol(next);
      });

      td.appendChild(btn);
      tr.appendChild(td);
    }

    body.appendChild(tr);
  }
}

function syncHeaderPreviews() {
  const plantId = el("plantId").value.trim();
  el("machineNoPreview").textContent = plantId || "—";

  const dateStr = el("date").value;
  if (!dateStr) {
    el("weekCommencingPreview").textContent = "—";
    state.weekCommencingISO = "";
    return;
  }
  state.weekCommencingISO = getWeekCommencingISO(dateStr);
  el("weekCommencingPreview").textContent = formatDDMMYYYY(state.weekCommencingISO);
}

// ---------- Load week record from KV ----------
function applyWeekRecord(record) {
  // Reset statuses to empty for current labels
  state.statuses = state.labels.map(() => Array(7).fill(null));

  if (!record || !record.labels || !record.statuses) return;

  // Map existing rows by label (so order changes won’t break)
  const map = new Map();
  for (let i = 0; i < record.labels.length; i++) {
    map.set(record.labels[i], record.statuses[i]);
  }

  for (let r = 0; r < state.labels.length; r++) {
    const row = map.get(state.labels[r]);
    if (Array.isArray(row) && row.length === 7) {
      state.statuses[r] = row.map(v => (v === "OK" || v === "DEFECT" || v === "NA") ? v : null);
    }
  }
}

async function maybeLoadWeek() {
  syncHeaderPreviews();

  const token = state.token;
  const type = state.equipmentType;
  const plantId = el("plantId").value.trim();
  const dateStr = el("date").value;

  if (!token || !type || !plantId || !dateStr) {
    buildTable();
    return;
  }

  try {
    setStatus("Loading week record…");
    const qs = new URLSearchParams({
      t: token,
      type,
      plantId,
      date: dateStr,
    });

    const res = await fetch(`/api/week?${qs.toString()}`);
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out?.error || "Failed to load week");

    state.weekKey = out.key || "";
    applyWeekRecord(out.record);
    buildTable();
    setStatus(`Week loaded (${formatDDMMYYYY(out.week || state.weekCommencingISO)}).`);
  } catch (e) {
    buildTable();
    setStatus(e.message || "Week load failed", false);
  }
}

// ---------- Signature ----------
function setupSignature() {
  const canvas = el("sig");
  const ctx = canvas.getContext("2d");

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(600, Math.floor(rect.width * devicePixelRatio));
    canvas.height = Math.max(250, Math.floor(rect.height * devicePixelRatio));
    ctx.lineWidth = 3 * devicePixelRatio;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
  }
  resize();
  window.addEventListener("resize", resize);

  let drawing = false;
  let last = null;

  function posFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * devicePixelRatio;
    const y = (e.clientY - rect.top) * devicePixelRatio;
    return { x, y };
  }

  function start(e) {
    drawing = true;
    last = posFromEvent(e);
  }
  function move(e) {
    if (!drawing) return;
    const p = posFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
  }
  function end() {
    drawing = false;
    last = null;
  }

  canvas.addEventListener("pointerdown", (e) => start(e));
  canvas.addEventListener("pointermove", (e) => move(e));
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", end);

  el("clearSig").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  return {
    getDataUrl() {
      return canvas.toDataURL("image/png");
    },
    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
}

// ---------- PDF ----------
async function fetchAsDataUrl(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load image: ${url}`);
  const blob = await res.blob();
  return await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

async function makePdfBase64(payload) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error("jsPDF not loaded");
  }
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  // logos
  let atlLogo = null;
  let tpLogo = null;
  try {
    atlLogo = await fetchAsDataUrl("/assets/atl-logo.png");
    tpLogo = await fetchAsDataUrl("/assets/tp.png");
  } catch { /* ignore */ }

  // header
  if (atlLogo) doc.addImage(atlLogo, "PNG", margin, 30, 160, 45);
  if (tpLogo) doc.addImage(tpLogo, "PNG", pageW - margin - 55, 25, 55, 55);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text("QPFPL5.2", pageW / 2, 40, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(payload.title, pageW / 2, 60, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Machine No:", margin, 85);
  doc.setFont("helvetica", "normal");
  doc.text(payload.plantId || "—", margin + 70, 85);

  doc.setFont("helvetica", "bold");
  doc.text("Week commencing:", pageW - margin - 160, 85);
  doc.setFont("helvetica", "normal");
  doc.text(formatDDMMYYYY(payload.weekCommencingISO), pageW - margin, 85, { align: "right" });

  // yellow bar
  doc.setFillColor(255, 214, 0);
  doc.rect(margin, 95, pageW - margin * 2, 20, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("All checks must be carried out in line with Specific Manufacturer’s instructions", pageW / 2, 108, { align: "center" });

  // meta (site/date/operator/hours)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Site: ${payload.site || ""}`, margin, 135);
  doc.text(`Date: ${formatDDMMYYYY(payload.date)}`, margin + 220, 135);
  doc.text(`Operator: ${payload.operator || ""}`, margin + 420, 135);
  doc.text(`Hours/Shift: ${payload.hours || ""}`, margin + 620, 135);

  // table geometry
  const y0 = 155;
  const rowH = 16;
  const itemW = 380;
  const dayW = (pageW - margin * 2 - itemW) / 7;

  // header row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setFillColor(255, 214, 0);
  doc.rect(margin, y0, itemW, rowH, "F");
  doc.setTextColor(0, 0, 0);
  doc.rect(margin, y0, pageW - margin * 2, rowH);

  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  for (let d = 0; d < 7; d++) {
    const x = margin + itemW + d * dayW;
    doc.rect(x, y0, dayW, rowH);
    doc.text(days[d], x + dayW / 2, y0 + 11, { align: "center" });
  }

  // rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  let y = y0 + rowH;
  for (let r = 0; r < payload.labels.length; r++) {
    doc.rect(margin, y, itemW, rowH);
    doc.text(payload.labels[r], margin + 6, y + 11);

    for (let d = 0; d < 7; d++) {
      const x = margin + itemW + d * dayW;
      doc.rect(x, y, dayW, rowH);

      const st = payload.statuses[r]?.[d] || null;
      const sym = markToSymbol(st);
      if (sym) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(sym, x + dayW / 2, y + 12, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }
    }

    y += rowH;
    if (y > pageH - 160) break; // keep it safe on one page
  }

  // footer boxes
  const footerY = Math.max(y + 10, pageH - 150);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Defects identified:", margin, footerY);
  doc.rect(margin, footerY + 8, pageW - margin * 2, 35);

  doc.text("Reported to / action taken:", margin, footerY + 60);
  doc.rect(margin, footerY + 68, pageW - margin * 2, 35);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (payload.defectsText) doc.text(payload.defectsText, margin + 6, footerY + 28);
  if (payload.actionTaken) doc.text(payload.actionTaken, margin + 6, footerY + 88);

  doc.setFont("helvetica", "bold");
  doc.text(`Checks carried out by: ${payload.operator || ""}`, margin, footerY - 6);

  // signature
  if (payload.signatureDataUrl && payload.signatureDataUrl.startsWith("data:image")) {
    try {
      doc.addImage(payload.signatureDataUrl, "PNG", pageW - margin - 170, footerY - 35, 170, 55);
    } catch {}
  }

  // submitted stamp
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Submitted: ${new Date().toISOString()}`, margin, pageH - 20);
  doc.text(`BUILD: ${BUILD}`, margin + 260, pageH - 20);

  const dataUri = doc.output("datauristring");
  if (!dataUri || typeof dataUri !== "string" || !dataUri.includes(",")) {
    throw new Error("PDF export failed (bad data URI)");
  }
  return dataUri.split(",")[1];
}

// ---------- Submit ----------
async function submitForm(sigApi) {
  try {
    const token = state.token;
    if (!token) throw new Error("Missing token in URL (t=...)");

    const type = state.equipmentType;
    if (!type) throw new Error("Select Excavator / Crane / Dumper");

    const dateStr = el("date").value;
    if (!dateStr) throw new Error("Select a date");

    const plantId = el("plantId").value.trim();
    if (!plantId) throw new Error("Enter Machine / Plant ID");

    syncHeaderPreviews();
    state.activeDay = getDayIndexMon0(dateStr);

    // Build payload
    const payload = {
      equipmentType: type,
      title: el("sheetTitle").textContent,
      site: el("site").value.trim(),
      date: dateStr,
      weekCommencingISO: state.weekCommencingISO,
      plantId,
      operator: el("operator").value.trim(),
      hours: el("hours").value.trim(),
      defectsText: el("defectsText").value.trim(),
      actionTaken: el("actionTaken").value.trim(),
      signatureDataUrl: sigApi.getDataUrl(),
      // send today statuses (server merges into KV)
      checks: state.labels.map((label, i) => ({
        label,
        status: state.statuses[i]?.[state.activeDay] ?? null,
      })),
    };

    // For PDF we want full Mon–Sun from current UI state
    payload.labels = state.labels;
    payload.statuses = state.statuses;

    el("submitBtn").disabled = true;
    setStatus("Building PDF…");

    const pdfBase64 = await makePdfBase64(payload);

    setStatus("Sending email…");
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, payload, pdfBase64 }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out?.error || "Submit failed");

    setStatus("Sent successfully.");
  } catch (e) {
    setStatus(e.message || "Submit failed", false);
  } finally {
    el("submitBtn").disabled = false;
  }
}

// ---------- Init ----------
(function init() {
  state.token = getTokenFromUrl();

  el("linkTokenInfo").textContent = state.token
    ? `Link token OK`
    : `⚠️ Missing token in link (you must open ?t=YOURTOKEN)`;

  // default date = today
  const today = new Date();
  el("date").value = toISODate(today);

  syncHeaderPreviews();
  buildTable();

  // events
  el("btnExc").addEventListener("click", () => setType("excavator"));
  el("btnCrane").addEventListener("click", () => setType("crane"));
  el("btnDump").addEventListener("click", () => setType("dumper"));

  el("date").addEventListener("change", () => { syncHeaderPreviews(); buildTable(); maybeLoadWeek(); });
  el("plantId").addEventListener("input", () => { syncHeaderPreviews(); maybeLoadWeek(); });
  el("site").addEventListener("input", () => { /* no-op */ });

  const sigApi = setupSignature();
  el("fillToday").addEventListener("click", () => {
    el("date").value = toISODate(new Date());
    syncHeaderPreviews();
    buildTable();
    maybeLoadWeek();
  });

  el("submitBtn").addEventListener("click", () => submitForm(sigApi));

  setStatus("Ready.");
})();
