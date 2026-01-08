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
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

  const BUILD = "v6";
  const margin = 28;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  // ---------- helpers ----------
  const isoToUK = (iso) => {
    if (!iso || !String(iso).includes("-")) return iso || "";
    const [y,m,d] = String(iso).split("-");
    return `${d}/${m}/${y}`;
  };

  const ellipsize = (text, maxW) => {
    if (!text) return "";
    let t = String(text);
    while (t.length > 0 && doc.getTextWidth(t) > maxW) t = t.slice(0, -1);
    return (t.length < String(text).length) ? (t.slice(0, -1) + "…") : t;
  };

  async function fetchAsDataUrl(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function fitIntoBox(imgW, imgH, boxW, boxH) {
    const s = Math.min(boxW / imgW, boxH / imgH);
    return { w: imgW * s, h: imgH * s };
  }

  function getImageSize(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  const markFor = (status) => {
    if (status === "OK") return "✓";
    if (status === "DEFECT") return "X";
    if (status === "NA") return "N/A";
    return "";
  };

  // ---------- data ----------
  const dateISO = payload.date || "";
  const weekISO = payload.weekCommencing || payload.weekCommencingISO || "";
  const weekUK = isoToUK(weekISO);
  const dateUK = isoToUK(dateISO);

  const labels = (payload.labels && payload.labels.length)
    ? payload.labels
    : (payload.checks || []).map(c => c.label);

  const weekStatuses = (payload.weekStatuses && payload.weekStatuses.length)
    ? payload.weekStatuses
    : labels.map((_, i) => {
        const row = Array(7).fill(null);
        const di = payload.dayIndex ?? 0;
        row[di] = payload.checks?.[i]?.status ?? null;
        return row;
      });

  // ---------- layout ----------
  let y = margin;

  // logos + title (compact header to save space)
  const atl = await fetchAsDataUrl("/assets/atl-logo.png");
  if (atl) doc.addImage(atl, "PNG", margin, y - 4, 140, 36);

  const tp = await fetchAsDataUrl("/assets/tp.png");
  if (tp) doc.addImage(tp, "PNG", pageW - margin - 52, y - 6, 52, 52);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(String(payload.formRef || "QPFPL5.2"), pageW / 2, y + 12, { align: "center" });

  doc.setFontSize(10);
  doc.text(String(payload.sheetTitle || "Excavator Pre-Use Inspection Checklist"), pageW / 2, y + 28, { align: "center" });

  y += 48;

  doc.setFontSize(9);
  doc.text(`Machine No: ${payload.machineNo || ""}`, margin, y);
  doc.text(`Week commencing: ${weekUK}`, pageW - margin, y, { align: "right" });

  y += 10;

  // yellow bar
  doc.setFillColor(255, 214, 0);
  doc.rect(margin, y, pageW - margin * 2, 16, "F");
  doc.setTextColor(0);
  doc.setFontSize(8.5);
  doc.text(
    "All checks must be carried out in line with Specific Manufacturer’s instructions",
    pageW / 2, y + 11, { align: "center" }
  );
  y += 24;

  // meta (single line to save height)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.text(`Site: ${payload.site || ""}`, margin, y);
  doc.text(`Date: ${dateUK}`, margin + 180, y);
  doc.text(`Operator: ${payload.operator || ""}`, margin + 320, y);
  doc.text(`Hours/Shift: ${payload.hours || ""}`, pageW - margin, y, { align: "right" });
  y += 14;

  // table sizes
  const tableX = margin;
  const tableW = pageW - margin * 2;
  const itemColW = 360;                      // keep item column wide
  const dayColW = (tableW - itemColW) / 7;
  const headH = 16;

  // footer block sizes (compact)
  const defectsH = 40;
  const actionH  = 40;
  const sigH     = 55;

  const footerTotal =
    12 +                         // "Checks carried out by"
    12 + 8 + defectsH + 12 +     // Defects label + box
    12 + 8 + actionH  + 12 +     // Action label + box
    12 + 8 + sigH + 18;          // Signature label + box + bottom padding

  // auto row height so ALL rows fit on ONE page
  const availForTable = (pageH - margin) - y - headH - footerTotal;
  const totalRows = labels.length;

  // keep readable minimum
  let rowH = Math.floor(availForTable / Math.max(1, totalRows));
  rowH = Math.max(9, Math.min(16, rowH));

  // fonts follow row height
  const fontItem = rowH <= 10 ? 6.7 : 7.5;
  const fontMark = rowH <= 10 ? 8.5 : 9.5;

  // if still would overflow, we still force one page by tightening footer slightly
  // (last safety net)
  const neededTableH = headH + totalRows * rowH;
  if (neededTableH > availForTable + headH) {
    rowH = 9;
  }

  // ---- draw table header ----
  doc.setDrawColor(0);
  doc.setLineWidth(0.7);

  doc.setFillColor(255, 214, 0);
  doc.rect(tableX, y, itemColW, headH, "F");
  doc.setFillColor(255, 255, 255);
  doc.rect(tableX + itemColW, y, tableW - itemColW, headH, "F");
  doc.rect(tableX, y, tableW, headH);

  doc.line(tableX + itemColW, y, tableX + itemColW, y + headH);
  for (let i = 1; i < 7; i++) {
    const xx = tableX + itemColW + dayColW * i;
    doc.line(xx, y, xx, y + headH);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  for (let i = 0; i < 7; i++) {
    const cx = tableX + itemColW + dayColW * i + dayColW / 2;
    doc.text(days[i], cx, y + 11, { align: "center" });
  }

  y += headH;

  // ---- draw table rows ----
  for (let r = 0; r < totalRows; r++) {
    // row outline
    doc.rect(tableX, y, tableW, rowH);

    doc.line(tableX + itemColW, y, tableX + itemColW, y + rowH);
    for (let i = 1; i < 7; i++) {
      const xx = tableX + itemColW + dayColW * i;
      doc.line(xx, y, xx, y + rowH);
    }

    // label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontItem);
    const label = ellipsize(labels[r], itemColW - 10);
    doc.text(label, tableX + 6, y + rowH * 0.72);

    // marks
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontMark);
    for (let i = 0; i < 7; i++) {
      const m = markFor(weekStatuses?.[r]?.[i]);
      if (!m) continue;
      const cx = tableX + itemColW + dayColW * i + dayColW / 2;
      doc.text(m, cx, y + rowH * 0.72, { align: "center" });
    }

    y += rowH;
  }

  y += 10;

  // ---- footer blocks (always on same page) ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Checks carried out by: ${payload.operator || ""}`, margin, y);
  y += 12;

  // Defects
  doc.text("Defects identified:", margin, y);
  y += 8;
  doc.rect(margin, y, pageW - margin * 2, defectsH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  if (payload.defectsText) doc.text(payload.defectsText, margin + 6, y + 14, { maxWidth: pageW - margin * 2 - 12 });
  y += defectsH + 12;

  // Action
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Reported to / action taken:", margin, y);
  y += 8;
  doc.rect(margin, y, pageW - margin * 2, actionH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  if (payload.actionTaken) doc.text(payload.actionTaken, margin + 6, y + 14, { maxWidth: pageW - margin * 2 - 12 });
  y += actionH + 12;

  // Signature (boxed + centred)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Signature:", margin, y);
  y += 8;

  const sigBoxW = pageW - margin * 2;
  doc.rect(margin, y, sigBoxW, sigH);

  if (payload.signatureDataUrl && payload.signatureDataUrl.startsWith("data:image")) {
    try {
      const pad = 6;
      const innerW = sigBoxW - pad * 2;
      const innerH = sigH - pad * 2;

      const { w: iw, h: ih } = await getImageSize(payload.signatureDataUrl);
      const fitted = fitIntoBox(iw, ih, innerW, innerH);

      const imgX = margin + pad + (innerW - fitted.w) / 2;
      const imgY = y + pad + (innerH - fitted.h) / 2;

      doc.addImage(payload.signatureDataUrl, "PNG", imgX, imgY, fitted.w, fitted.h);
    } catch {}
  }

  // bottom footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Submitted: ${new Date().toISOString()}`, margin, pageH - 16);
  doc.text(`BUILD: ${BUILD}`, pageW / 2, pageH - 16, { align: "center" });

  // output
  const dataUri = doc.output("datauristring");
  const parts = String(dataUri).split(",");
  if (parts.length < 2) throw new Error("PDF export failed (bad data URI)");
  return parts[1];
}

  }

  // Submitted footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Submitted: ${new Date().toISOString()}`, margin, pageH - 18);
  doc.text(`BUILD: ${BUILD}`, pageW / 2, pageH - 18, { align: "center" });

  // Return Base64
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
