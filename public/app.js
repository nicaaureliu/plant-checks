/* public/app.js */

const BUILD = "v7";

// ---------- helpers ----------
const el = (id) => document.getElementById(id);

function getTokenFromUrl() {
  const u = new URL(location.href);
  return u.searchParams.get("t") || "";
}

function isoToUK(iso) {
  if (!iso || !String(iso).includes("-")) return iso || "";
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

function getWeekCommencingISO(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // Sun=0..Sat=6
  const diffToMon = (day === 0 ? -6 : 1 - day);
  dt.setDate(dt.getDate() + diffToMon);

  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function getDayIndexMon0(dateStr) {
  if (!dateStr) return 0;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // Sun=0
  return day === 0 ? 6 : day - 1; // Mon=0..Sun=6
}

function cycleStatus(current) {
  // null -> OK -> DEFECT -> NA -> null
  if (!current) return "OK";
  if (current === "OK") return "DEFECT";
  if (current === "DEFECT") return "NA";
  return null;
}

// ---------- default checklists ----------
const CHECKLISTS = {
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
    "FIRE EXTINGUISHER, Charged, Damage",
    "LIGHTS, Damage / working",
    "MIRRORS, Adjusted for best visibility",
    "FUEL WATER SEPARATOR, Drain",
    "OVERALL MACHINE, Loose or missing nuts & bolts, loose guards, cleanliness",
    "SWING GEAR OIL LEVEL, Fluid level",
    "ENGINE OIL, Fluid level",
    "ALL HOSES, Cracks, wear spots, leaks",
    "ALL BELTS, Tension, wear, cracks",
    "OVERALL ENGINE COMPARTMENT, Rubbish, dirt, leaks",
    "SEAT, Adjustment",
    "SEAT BELT & MOUNTING, Damage, wear, adjustment",
    "INDICATORS & GAUGES, Check, test",
    "HORN / BACKUP ALARM / LIGHTS, Proper function",
    "OVERALL CAB INTERIOR, Cleanliness"
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
    "Cab controls / seatbelt – working"
  ],
  dumper: [
    "Tyres – condition and pressure",
    "Brakes – test",
    "Steering – test",
    "Lights / beacons – working",
    "Horn – working",
    "Reverse alarm – working",
    "Mirrors / camera – working",
    "Seatbelt – working",
    "Hydraulic rams – leaks",
    "Body / skip – damage",
    "Engine oil – level",
    "Coolant – level",
    "Fuel – level",
    "Leaks – none visible"
  ],
};

const TYPE_META = {
  excavator: { title: "Excavator Pre-Use Inspection Checklist", ref: "QPFPL5.2" },
  crane:     { title: "Crane Pre-Use Inspection Checklist",     ref: "QPFPL5.2" },
  dumper:    { title: "Dumper Pre-Use Inspection Checklist",    ref: "QPFPL5.2" },
};

// ---------- app state ----------
const state = {
  token: getTokenFromUrl(),
  equipmentType: null,
  labels: [],
  weekStatuses: [], // [row][day] = OK/DEFECT/NA/null
  loadedWeekKey: null,
};

// ---------- UI: signature ----------
function setupSignature() {
  const canvas = el("sig");
  const ctx = canvas.getContext("2d");

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    // white background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  let drawing = false;
  let last = null;

  function posFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  }

  function start(e) {
    e.preventDefault();
    drawing = true;
    last = posFromEvent(e);
  }
  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = posFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
  }
  function end(e) {
    if (!drawing) return;
    e.preventDefault();
    drawing = false;
    last = null;
  }

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);

  canvas.addEventListener("touchstart", start, { passive:false });
  canvas.addEventListener("touchmove", move, { passive:false });
  window.addEventListener("touchend", end, { passive:false });

  el("clearSig").addEventListener("click", () => resizeCanvas());

  return {
    getDataUrl() {
      // ensure white background (already done), export PNG
      return canvas.toDataURL("image/png");
    }
  };
}

// ---------- UI: table ----------
function setStatus(msg, kind = "") {
  const s = el("status");
  s.className = `small ${kind}`;
  s.textContent = msg;
}

function renderTypeButtons() {
  const btnExc = el("btnExc");
  const btnCrane = el("btnCrane");
  const btnDump = el("btnDump");

  const setActive = (type) => {
    btnExc.classList.toggle("active", type === "excavator");
    btnCrane.classList.toggle("active", type === "crane");
    btnDump.classList.toggle("active", type === "dumper");
  };

  btnExc.addEventListener("click", () => selectType("excavator"));
  btnCrane.addEventListener("click", () => selectType("crane"));
  btnDump.addEventListener("click", () => selectType("dumper"));

  setActive(state.equipmentType);
}

function ensureWeekStatuses() {
  // Make sure weekStatuses matches labels length
  state.weekStatuses = state.labels.map((_, i) => state.weekStatuses[i] || Array(7).fill(null));
  for (let i = 0; i < state.weekStatuses.length; i++) {
    if (!Array.isArray(state.weekStatuses[i]) || state.weekStatuses[i].length !== 7) {
      state.weekStatuses[i] = Array(7).fill(null);
    }
  }
}

function renderTable() {
  const body = el("checksBody");
  body.innerHTML = "";

  const dateStr = el("date").value;
  const activeDay = getDayIndexMon0(dateStr);

  ensureWeekStatuses();

  for (let r = 0; r < state.labels.length; r++) {
    const tr = document.createElement("tr");

    const tdItem = document.createElement("td");
    tdItem.className = "item";
    tdItem.textContent = state.labels[r];
    tr.appendChild(tdItem);

    for (let d = 0; d < 7; d++) {
      const td = document.createElement("td");
      td.className = "day " + (d === activeDay ? "active" : "inactive");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "markBtn";
      btn.disabled = (d !== activeDay);

      const val = state.weekStatuses[r]?.[d];
      btn.textContent = val === "OK" ? "✓" : (val === "DEFECT" ? "X" : (val === "NA" ? "N/A" : ""));

      btn.addEventListener("click", () => {
        const cur = state.weekStatuses[r][d];
        const next = cycleStatus(cur);
        state.weekStatuses[r][d] = next;
        renderTable();
      });

      td.appendChild(btn);
      tr.appendChild(td);
    }

    body.appendChild(tr);
  }
}

// ---------- load / refresh week record ----------
async function loadWeekFromKVIfPossible() {
  const type = state.equipmentType;
  const plantId = (el("plantId").value || "").trim();
  const dateStr = el("date").value;

  if (!state.token) {
    setStatus("Missing token in URL (?t=...)", "error");
    return;
  }
  if (!type || !plantId || !dateStr) {
    // not enough info yet
    return;
  }

  const q = new URLSearchParams({
    t: state.token,
    type,
    plantId,
    date: dateStr,
    v: String(Date.now())
  });

  setStatus("Loading saved week...", "");
  const res = await fetch(`/api/week?${q.toString()}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    setStatus(`Load week failed: ${data.error || "unknown"}`, "error");
    return;
  }

  const record = data.record || null;

  // If record exists, use its labels/statuses so order is consistent
  if (record && Array.isArray(record.labels) && Array.isArray(record.statuses)) {
    state.labels = record.labels;
    state.weekStatuses = record.statuses;
    state.loadedWeekKey = data.key || null;
  } else {
    // New record: use defaults for that type
    state.labels = CHECKLISTS[type].slice();
    state.weekStatuses = state.labels.map(() => Array(7).fill(null));
    state.loadedWeekKey = data.key || null;
  }

  updateHeader();
  renderTable();
  setStatus("Ready.", "ok");
}

// ---------- header updates ----------
function updateHeader() {
  const type = state.equipmentType;
  const dateStr = el("date").value;

  const meta = TYPE_META[type] || { title: "Plant Pre-Use Inspection Checklist", ref: "QPFPL5.2" };
  el("sheetTitle").textContent = meta.title;
  el("formRef").textContent = meta.ref;

  el("selectedType").textContent = `Selected: ${type ? type.toUpperCase() : "—"}`;

  const weekISO = getWeekCommencingISO(dateStr);
  el("weekCommencingPreview").textContent = weekISO ? isoToUK(weekISO) : "—";

  const plantId = (el("plantId").value || "").trim();
  el("machineNoPreview").textContent = plantId || "—";
}

// ---------- select type ----------
function selectType(type) {
  state.equipmentType = type;

  // Reset labels to defaults initially; if KV has record, loadWeekFromKVIfPossible will replace them.
  state.labels = CHECKLISTS[type].slice();
  state.weekStatuses = state.labels.map(() => Array(7).fill(null));

  renderTypeButtons();
  updateHeader();
  renderTable();

  // try load existing week data (if plantId/date already set)
  loadWeekFromKVIfPossible().catch(() => {});
}

// ---------- PDF generation (ONE PAGE + tick drawn as lines) ----------
async function makePdfBase64(payload) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

  const margin = 28;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  // helpers
  const ellipsize = (text, maxW) => {
    if (!text) return "";
    let t = String(text);
    while (t.length > 0 && doc.getTextWidth(t) > maxW) t = t.slice(0, -1);
    return (t.length < String(text).length) ? (t.slice(0, -1) + "…") : t;
  };

  async function fetchAsDataUrl(url) {
    const res = await fetch(url + `?v=${encodeURIComponent(BUILD)}`, { cache: "no-store" });
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

  function drawStatusMark(doc, status, x, y, w, h, fontSize) {
    if (!status) return;

    if (status === "NA") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.max(7, fontSize - 1));
      doc.text("N/A", x + w / 2, y + h * 0.72, { align: "center" });
      return;
    }

    const padX = w * 0.22;
    const padY = h * 0.22;

    const left   = x + padX;
    const right  = x + w - padX;
    const top    = y + padY;
    const bottom = y + h - padY;

    doc.setDrawColor(0);
    doc.setLineWidth(1.2);

    if (status === "OK") {
      // Tick
      const x1 = left;
      const y1 = y + h * 0.60;
      const x2 = x + w * 0.46;
      const y2 = bottom;
      const x3 = right;
      const y3 = top;
      doc.line(x1, y1, x2, y2);
      doc.line(x2, y2, x3, y3);
    } else if (status === "DEFECT") {
      // X
      doc.line(left, top, right, bottom);
      doc.line(right, top, left, bottom);
    }
  }

  // data
  const dateISO = payload.date || "";
  const weekISO = payload.weekCommencing || "";
  const weekUK = isoToUK(weekISO);
  const dateUK = isoToUK(dateISO);

  const labels = payload.labels || [];
  const weekStatuses = payload.weekStatuses || [];

  // layout
  let y = margin;

  // logos + title
  const atl = await fetchAsDataUrl("/assets/atl-logo.png");
  if (atl) doc.addImage(atl, "PNG", margin, y - 4, 140, 36);

  const tp = await fetchAsDataUrl("/assets/tp.png");
  if (tp) doc.addImage(tp, "PNG", pageW - margin - 52, y - 6, 52, 52);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(String(payload.formRef || "QPFPL5.2"), pageW / 2, y + 12, { align: "center" });

  doc.setFontSize(10);
  doc.text(String(payload.sheetTitle || "Plant Pre-Use Inspection Checklist"), pageW / 2, y + 28, { align: "center" });

  y += 48;

  doc.setFontSize(9);
  doc.text(`Machine No: ${payload.plantId || ""}`, margin, y);
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

  // meta row
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
  const itemColW = 360;
  const dayColW = (tableW - itemColW) / 7;
  const headH = 16;

  // footer sizes (compact)
  const defectsH = 40;
  const actionH  = 40;
  const sigH     = 55;

  const footerTotal =
    12 + 12 + 8 + defectsH + 12 + 12 + 8 + actionH + 12 + 12 + 8 + sigH + 18;

  // force ONE PAGE by auto row height
  const availForTable = (pageH - margin) - y - headH - footerTotal;
  const totalRows = Math.max(1, labels.length);
  let rowH = Math.floor(availForTable / totalRows);

  // allow smaller minimum to force one page
  rowH = Math.max(7, Math.min(16, rowH));

  const fontItem = rowH <= 9 ? 6.3 : 7.4;
  const fontMark = rowH <= 9 ? 9 : 10;

  // table header
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

  // rows
  for (let r = 0; r < labels.length; r++) {
    const rowTopY = y;

    doc.rect(tableX, rowTopY, tableW, rowH);
    doc.line(tableX + itemColW, rowTopY, tableX + itemColW, rowTopY + rowH);
    for (let i = 1; i < 7; i++) {
      const xx = tableX + itemColW + dayColW * i;
      doc.line(xx, rowTopY, xx, rowTopY + rowH);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontItem);
    const label = ellipsize(labels[r], itemColW - 10);
    doc.text(label, tableX + 6, rowTopY + rowH * 0.72);

    // marks (DRAWN, so ✓ always shows)
    for (let i = 0; i < 7; i++) {
      const st = weekStatuses?.[r]?.[i];
      if (!st) continue;
      const cellX = tableX + itemColW + dayColW * i;
      drawStatusMark(doc, st, cellX, rowTopY, dayColW, rowH, fontMark);
    }

    y += rowH;
  }

  y += 10;

  // footer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Checks carried out by: ${payload.operator || ""}`, margin, y);
  y += 12;

  // defects
  doc.text("Defects identified:", margin, y);
  y += 8;
  doc.rect(margin, y, pageW - margin * 2, defectsH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  if (payload.defectsText) doc.text(payload.defectsText, margin + 6, y + 14, { maxWidth: pageW - margin * 2 - 12 });
  y += defectsH + 12;

  // action
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Reported to / action taken:", margin, y);
  y += 8;
  doc.rect(margin, y, pageW - margin * 2, actionH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  if (payload.actionTaken) doc.text(payload.actionTaken, margin + 6, y + 14, { maxWidth: pageW - margin * 2 - 12 });
  y += actionH + 12;

  // signature boxed + centered
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

  // bottom
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Submitted: ${new Date().toISOString()}`, margin, pageH - 16);
  doc.text(`BUILD: ${BUILD}`, pageW / 2, pageH - 16, { align: "center" });

  const dataUri = doc.output("datauristring");
  if (!dataUri) throw new Error("PDF export failed (jsPDF output returned empty)");
  const parts = String(dataUri).split(",");
  if (parts.length < 2) throw new Error("PDF export failed (bad data URI)");
  return parts[1];
}

// ---------- submit ----------
async function submitForm(sig) {
  try {
    const token = state.token;
    if (!token) {
      setStatus("Missing token in URL (?t=...)", "error");
      return;
    }

    const type = state.equipmentType;
    if (!type) {
      setStatus("Select Excavator / Crane / Dumper first.", "error");
      return;
    }

    const site = el("site").value || "";
    const date = el("date").value || "";
    const plantId = (el("plantId").value || "").trim();
    const operator = el("operator").value || "";
    const hours = el("hours").value || "";
    const defectsText = el("defectsText").value || "";
    const actionTaken = el("actionTaken").value || "";

    if (!date) { setStatus("Please select a Date.", "error"); return; }
    if (!plantId) { setStatus("Please enter Machine / Plant ID.", "error"); return; }

    const weekCommencing = getWeekCommencingISO(date);
    const dayIndex = getDayIndexMon0(date);

    // build "checks" for today only
    const checks = state.labels.map((label, i) => ({
      label,
      status: state.weekStatuses?.[i]?.[dayIndex] || null
    }));

    const payload = {
      build: BUILD,
      formRef: el("formRef").textContent || "QPFPL5.2",
      sheetTitle: el("sheetTitle").textContent || "",
      equipmentType: type,
      site,
      date,
      plantId,
      operator,
      hours,
      defectsText,
      actionTaken,
      weekCommencing,
      dayIndex,
      labels: state.labels,
      weekStatuses: state.weekStatuses,
      checks,
      signatureDataUrl: sig.getDataUrl()
    };

    el("submitBtn").disabled = true;
    setStatus("Generating PDF…", "");

    const pdfBase64 = await makePdfBase64(payload);

    setStatus("Sending email…", "");

    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, payload, pdfBase64 }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Submit failed");

    setStatus("✅ Sent successfully.", "ok");

    // Reload week record so it’s definitely saved
    await loadWeekFromKVIfPossible();

  } catch (e) {
    setStatus(`❌ ${e.message || "Error"}`, "error");
  } finally {
    el("submitBtn").disabled = false;
  }
}

// ---------- init ----------
(function init() {
  el("buildTag").textContent = `BUILD: ${BUILD}`;

  // default date = today
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  el("date").value = `${yyyy}-${mm}-${dd}`;

  const sig = setupSignature();

  renderTypeButtons();
  updateHeader();

  // choose default type
  selectType("excavator");

  // events
  el("fillToday").addEventListener("click", () => {
    el("date").value = `${yyyy}-${mm}-${dd}`;
    updateHeader();
    renderTable();
    loadWeekFromKVIfPossible().catch(() => {});
  });

  el("date").addEventListener("change", () => {
    updateHeader();
    renderTable();
    loadWeekFromKVIfPossible().catch(() => {});
  });

  el("plantId").addEventListener("change", () => {
    updateHeader();
    loadWeekFromKVIfPossible().catch(() => {});
  });

  el("plantId").addEventListener("keyup", () => {
    updateHeader();
  });

  el("submitBtn").addEventListener("click", () => submitForm(sig));

  setStatus("Ready.", "ok");
})();
