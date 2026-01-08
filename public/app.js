/* public/app.js */

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
    "BATTERIES & HOLDDOWNS, Cleanliness, Loose Bolts and Nuts",
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
    "Tyres – condition & pressure",
    "Brakes – service & parking",
    "Steering – play / operation",
    "Lights / beacon / horn – working",
    "Mirrors / camera – working",
    "Body / tipping mechanism – secure & working",
    "Rollover protection / seatbelt – condition",
    "Leaks (fuel/oil/hydraulic) – none",
    "Wipers / washers – working",
    "Fire extinguisher – present & charged"
  ],
};

const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function isoToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function isoToUK(iso) {
  if (!iso || !String(iso).includes("-")) return iso || "";
  const [y,m,d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}
function getWeekCommencingISO(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // Sun=0 ... Mon=1
  const diffToMon = (day === 0 ? -6 : 1 - day);
  dt.setDate(dt.getDate() + diffToMon);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function getDayIndexMon0(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // Sun=0
  return day === 0 ? 6 : day - 1; // Mon=0..Sun=6
}

function cycleStatus(cur) {
  // null -> OK -> DEFECT -> NA -> null
  if (!cur) return "OK";
  if (cur === "OK") return "DEFECT";
  if (cur === "DEFECT") return "NA";
  return null;
}
function markText(st) {
  if (st === "OK") return "✓";
  if (st === "DEFECT") return "X";
  if (st === "NA") return "N/A";
  return "";
}

const qs = new URLSearchParams(location.search);
const token = qs.get("t") || "";

const el = (id) => document.getElementById(id);

const checksBody = el("checksBody");
const statusEl = el("status");

let equipmentType = "excavator";
let labels = [...CHECKLISTS[equipmentType]];
let weekStatuses = labels.map(() => Array(7).fill(null)); // [row][day]
let weekCommencingISO = "";
let activeDay = 0;

function setStatus(msg, ok=true) {
  statusEl.className = ok ? "small statusOk" : "small statusErr";
  statusEl.textContent = msg;
}

function setPillActive() {
  el("btnExc").classList.toggle("active", equipmentType === "excavator");
  el("btnCrane").classList.toggle("active", equipmentType === "crane");
  el("btnDump").classList.toggle("active", equipmentType === "dumper");
  el("selectedType").textContent =
    "Selected: " + (equipmentType.charAt(0).toUpperCase() + equipmentType.slice(1));
  el("sheetTitle").textContent =
    (equipmentType === "excavator") ? "Excavator Pre-Use Inspection Checklist"
    : (equipmentType === "crane") ? "Crane Pre-Use Inspection Checklist"
    : "Dumper Pre-Use Inspection Checklist";
}

function renderTable() {
  const dateISO = el("date").value || isoToday();
  activeDay = getDayIndexMon0(dateISO);

  checksBody.innerHTML = "";
  labels.forEach((label, r) => {
    const tr = document.createElement("tr");

    const tdItem = document.createElement("td");
    tdItem.className = "item";
    tdItem.textContent = label;
    tr.appendChild(tdItem);

    for (let d = 0; d < 7; d++) {
      const td = document.createElement("td");
      td.className = "day " + (d === activeDay ? "active" : "inactive");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "markBtn";
      btn.dataset.r = String(r);
      btn.dataset.d = String(d);
      btn.disabled = (d !== activeDay); // only selected day editable
      btn.textContent = markText(weekStatuses?.[r]?.[d]);

      td.appendChild(btn);
      tr.appendChild(td);
    }

    checksBody.appendChild(tr);
  });
}

async function fetchWeekRecordIfPossible() {
  const plantId = (el("plantId").value || "").trim();
  const dateISO = el("date").value || isoToday();
  weekCommencingISO = getWeekCommencingISO(dateISO);

  el("weekCommencingPreview").textContent = isoToUK(weekCommencingISO);
  el("machineNoPreview").textContent = plantId || "—";

  if (!token) {
    setStatus("❌ Missing link token (t=...)", false);
    // still render blank UI so you can work locally
    labels = [...CHECKLISTS[equipmentType]];
    weekStatuses = labels.map(() => Array(7).fill(null));
    renderTable();
    return;
  }

  if (!plantId) {
    // no plant id = start a clean week view
    labels = [...CHECKLISTS[equipmentType]];
    weekStatuses = labels.map(() => Array(7).fill(null));
    renderTable();
    setStatus("Ready. (Enter Plant ID to load/save week)");
    return;
  }

  try {
    const url =
      `/api/week?t=${encodeURIComponent(token)}` +
      `&type=${encodeURIComponent(equipmentType)}` +
      `&plantId=${encodeURIComponent(plantId)}` +
      `&date=${encodeURIComponent(dateISO)}`;

    const resp = await fetch(url, { cache: "no-store" });
    const data = await resp.json();

    if (!resp.ok) throw new Error(data?.error || "Failed to load week");

    if (data?.record?.labels?.length) labels = data.record.labels;
    else labels = [...CHECKLISTS[equipmentType]];

    if (data?.record?.statuses?.length) weekStatuses = data.record.statuses;
    else weekStatuses = labels.map(() => Array(7).fill(null));

    // keep header week commencing synced
    weekCommencingISO = data.week || weekCommencingISO;
    el("weekCommencingPreview").textContent = isoToUK(weekCommencingISO);

    renderTable();
    setStatus("Ready.");
  } catch (e) {
    labels = [...CHECKLISTS[equipmentType]];
    weekStatuses = labels.map(() => Array(7).fill(null));
    renderTable();
    setStatus("❌ " + (e?.message || "Error loading week"), false);
  }
}

function buildPayloadForSubmit() {
  const dateISO = el("date").value || isoToday();
  const plantId = (el("plantId").value || "").trim();

  const payload = {
    formRef: el("formRef").textContent || "QPFPL5.2",
    sheetTitle: el("sheetTitle").textContent || "",
    equipmentType,
    site: (el("site").value || "").trim(),
    date: dateISO,
    weekCommencing: getWeekCommencingISO(dateISO),
    dayIndex: getDayIndexMon0(dateISO),
    plantId,
    machineNo: plantId,
    operator: (el("operator").value || "").trim(),
    hours: (el("hours").value || "").trim(),
    defectsText: (el("defectsText").value || "").trim(),
    actionTaken: (el("actionTaken").value || "").trim(),
    labels: labels,
    weekStatuses: weekStatuses,
    checks: labels.map((label, i) => ({
      label,
      status: weekStatuses?.[i]?.[getDayIndexMon0(dateISO)] || null,
    })),
    signatureDataUrl: getSignatureDataUrl(),
  };

  return payload;
}

/* ---------- signature canvas ---------- */
const canvas = el("sig");
const ctx = canvas.getContext("2d");

function resizeCanvasToCSS() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#111";
}
resizeCanvasToCSS();
window.addEventListener("resize", resizeCanvasToCSS);

let drawing = false;
let last = null;

function posFromEvent(e) {
  const r = canvas.getBoundingClientRect();
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
  return { x, y };
}

function startDraw(e) {
  drawing = true;
  last = posFromEvent(e);
}
function moveDraw(e) {
  if (!drawing) return;
  e.preventDefault();
  const p = posFromEvent(e);
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  last = p;
}
function endDraw() { drawing = false; last = null; }

canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", moveDraw);
canvas.addEventListener("mouseup", endDraw);
canvas.addEventListener("mouseleave", endDraw);

canvas.addEventListener("touchstart", startDraw, { passive:false });
canvas.addEventListener("touchmove", moveDraw, { passive:false });
canvas.addEventListener("touchend", endDraw);

el("clearSig").addEventListener("click", () => {
  ctx.clearRect(0,0,canvas.width,canvas.height);
});
el("fillToday").addEventListener("click", () => {
  el("date").value = isoToday();
  fetchWeekRecordIfPossible();
});

function getSignatureDataUrl() {
  // if empty, return ""
  const img = ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let hasInk = false;
  for (let i=3; i<img.length; i+=4) {
    if (img[i] !== 0) { hasInk = true; break; } // alpha
  }
  return hasInk ? canvas.toDataURL("image/png") : "";
}

/* ---------- click table cycles (only active day) ---------- */
checksBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button.markBtn");
  if (!btn || btn.disabled) return;

  const r = Number(btn.dataset.r);
  const d = Number(btn.dataset.d);
  const cur = weekStatuses?.[r]?.[d] || null;
  const next = cycleStatus(cur);
  weekStatuses[r][d] = next;
  btn.textContent = markText(next);
});

/* ---------- equipment type buttons ---------- */
el("btnExc").addEventListener("click", async () => {
  equipmentType = "excavator";
  setPillActive();
  await fetchWeekRecordIfPossible();
});
el("btnCrane").addEventListener("click", async () => {
  equipmentType = "crane";
  setPillActive();
  await fetchWeekRecordIfPossible();
});
el("btnDump").addEventListener("click", async () => {
  equipmentType = "dumper";
  setPillActive();
  await fetchWeekRecordIfPossible();
});

/* ---------- load / change triggers ---------- */
el("date").addEventListener("change", fetchWeekRecordIfPossible);
el("plantId").addEventListener("change", fetchWeekRecordIfPossible);
el("plantId").addEventListener("blur", fetchWeekRecordIfPossible);

/* ---------- PDF generator (fixed logos + smaller footer + centred signature + checkbox style) ---------- */
async function makePdfBase64(payload) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

  const BUILD = "v8";
  const margin = 26;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const isoToUK2 = isoToUK;

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

  function getImageSize(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function fitIntoBox(imgW, imgH, boxW, boxH) {
    const s = Math.min(boxW / imgW, boxH / imgH);
    return { w: imgW * s, h: imgH * s };
  }

  const dateISO = payload.date || "";
  const weekISO = payload.weekCommencing || "";
  const weekUK = isoToUK2(weekISO);
  const dateUK = isoToUK2(dateISO);

  const labels = (payload.labels && payload.labels.length)
    ? payload.labels
    : (payload.checks || []).map(c => c.label);

  const weekStatuses = (payload.weekStatuses && payload.weekStatuses.length)
    ? payload.weekStatuses
    : labels.map(() => Array(7).fill(null));

  let y = 18;

  // ----- header: logos NOT stretched + no collision -----
  const leftLogoBox = { x: margin, y: y, w: 120, h: 30 };
  const rightLogoBox = { x: pageW - margin - 48, y: y - 2, w: 48, h: 48 };

  const atl = await fetchAsDataUrl("/assets/atl-logo.png");
  if (atl) {
    try {
      const s = await getImageSize(atl);
      const f = fitIntoBox(s.w, s.h, leftLogoBox.w, leftLogoBox.h);
      doc.addImage(atl, "PNG",
        leftLogoBox.x,
        leftLogoBox.y + (leftLogoBox.h - f.h) / 2,
        f.w, f.h
      );
    } catch {}
  }

  const tp = await fetchAsDataUrl("/assets/tp.png");
  if (tp) {
    try {
      const s = await getImageSize(tp);
      const f = fitIntoBox(s.w, s.h, rightLogoBox.w, rightLogoBox.h);
      doc.addImage(tp, "PNG",
        rightLogoBox.x + (rightLogoBox.w - f.w) / 2,
        rightLogoBox.y + (rightLogoBox.h - f.h) / 2,
        f.w, f.h
      );
    } catch {}
  }

  // centred titles safely between logos
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(String(payload.formRef || "QPFPL5.2"), pageW / 2, y + 18, { align: "center" });

  doc.setFontSize(10);
  doc.text(String(payload.sheetTitle || "Pre-Use Inspection Checklist"), pageW / 2, y + 34, { align: "center" });

  y += 54;

  // machine + week
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

  // meta row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.text(`Site: ${payload.site || ""}`, margin, y);
  doc.text(`Date: ${dateUK}`, margin + 190, y);
  doc.text(`Operator: ${payload.operator || ""}`, margin + 310, y);
  doc.text(`Hours/Shift: ${payload.hours || ""}`, pageW - margin, y, { align: "right" });
  y += 14;

  // ----- table -----
  const tableX = margin;
  const tableW = pageW - margin * 2;

  const itemColW = 340;                 // keeps labels readable
  const dayColW = (tableW - itemColW) / 7;
  const headH = 16;

  // SMALLER footer (your request)
  const defectsH = 28;
  const actionH  = 28;
  const sigH     = 40;

  const footerTotal =
    12 +                         // "Checks carried out by"
    12 + 8 + defectsH + 10 +     // defects
    12 + 8 + actionH  + 10 +     // action
    12 + 8 + sigH + 18;          // signature + bottom

  const availForTable = (pageH - margin) - y - headH - footerTotal;
  const totalRows = labels.length;

  let rowH = Math.floor(availForTable / Math.max(1, totalRows));
  rowH = Math.max(9, Math.min(16, rowH));

  const fontItem = rowH <= 10 ? 6.7 : 7.5;

  const hasRounded = typeof doc.roundedRect === "function";
  const roundRect = (x, y, w, h, r) => {
    if (hasRounded) doc.roundedRect(x, y, w, h, r, r);
    else doc.rect(x, y, w, h);
  };

  // header row
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

  // helpers to draw marks like the UI
  function drawCheck(x, y, w, h) {
    doc.setDrawColor(0);
    doc.setLineWidth(1.1);
    doc.line(x + w*0.25, y + h*0.55, x + w*0.43, y + h*0.72);
    doc.line(x + w*0.43, y + h*0.72, x + w*0.78, y + h*0.30);
    doc.setLineWidth(0.7);
  }
  function drawX(x, y, w, h) {
    doc.setDrawColor(0);
    doc.setLineWidth(1.0);
    doc.line(x + w*0.25, y + h*0.25, x + w*0.75, y + h*0.75);
    doc.line(x + w*0.75, y + h*0.25, x + w*0.25, y + h*0.75);
    doc.setLineWidth(0.7);
  }

  for (let r = 0; r < totalRows; r++) {
    // row outline & vertical grid
    doc.rect(tableX, y, tableW, rowH);
    doc.line(tableX + itemColW, y, tableX + itemColW, y + rowH);
    for (let i = 1; i < 7; i++) {
      const xx = tableX + itemColW + dayColW * i;
      doc.line(xx, y, xx, y + rowH);
    }

    // item text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontItem);
    const label = ellipsize(labels[r], itemColW - 10);
    doc.text(label, tableX + 6, y + rowH * 0.72);

    // checkbox-looking boxes in each day cell
    for (let d = 0; d < 7; d++) {
      const cellX = tableX + itemColW + dayColW * d;
      const cellY = y;

      const boxW = Math.min(dayColW - 8, 24);
      const boxH = Math.min(rowH - 4, 12);
      const bx = cellX + (dayColW - boxW) / 2;
      const by = cellY + (rowH - boxH) / 2;

      // grey rounded box like the UI
      doc.setDrawColor(190);
      doc.setLineWidth(0.6);
      roundRect(bx, by, boxW, boxH, 3);

      const st = weekStatuses?.[r]?.[d] || null;

      // draw marks INSIDE box (never missing)
      if (st === "OK") drawCheck(bx, by, boxW, boxH);
      if (st === "DEFECT") drawX(bx, by, boxW, boxH);
      if (st === "NA") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.2);
        doc.setTextColor(0);
        doc.text("N/A", bx + boxW/2, by + boxH*0.72, { align: "center" });
      }

      // reset grid style
      doc.setDrawColor(0);
      doc.setLineWidth(0.7);
    }

    y += rowH;
  }

  y += 10;

  // footer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Checks carried out by: ${payload.operator || ""}`, margin, y);
  y += 12;

  // defects (smaller)
  doc.text("Defects identified:", margin, y);
  y += 8;
  doc.rect(margin, y, pageW - margin * 2, defectsH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  if (payload.defectsText) doc.text(payload.defectsText, margin + 6, y + 13, { maxWidth: pageW - margin * 2 - 12 });
  y += defectsH + 10;

  // action (smaller)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Reported to / action taken:", margin, y);
  y += 8;
  doc.rect(margin, y, pageW - margin * 2, actionH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  if (payload.actionTaken) doc.text(payload.actionTaken, margin + 6, y + 13, { maxWidth: pageW - margin * 2 - 12 });
  y += actionH + 10;

  // signature (smaller + centred)
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
      const s = await getImageSize(payload.signatureDataUrl);
      const f = fitIntoBox(s.w, s.h, innerW, innerH);
      const imgX = margin + pad + (innerW - f.w) / 2;
      const imgY = y + pad + (innerH - f.h) / 2;
      doc.addImage(payload.signatureDataUrl, "PNG", imgX, imgY, f.w, f.h);
    } catch {}
  }

  // bottom footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Submitted: ${new Date().toISOString()}`, margin, pageH - 16);
  doc.text(`BUILD: ${BUILD}`, pageW / 2, pageH - 16, { align: "center" });

  // RETURN BASE64 WITHOUT split() (fixes your old crash)
  const ab = doc.output("arraybuffer");
  const bytes = new Uint8Array(ab);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/* ---------- submit ---------- */
el("submitBtn").addEventListener("click", async () => {
  try {
    if (!token) throw new Error("Missing link token (t=...)");
    const payload = buildPayloadForSubmit();
    if (!payload.plantId) throw new Error("Please enter Machine / Plant ID");
    if (!payload.date) throw new Error("Please choose a date");

    setStatus("Generating PDF…");
    const pdfBase64 = await makePdfBase64(payload);

    setStatus("Sending email…");
    const resp = await fetch("/api/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, payload, pdfBase64 }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || "Send failed");

    setStatus("✅ Sent successfully.");
    // refresh from KV so the week shows saved state
    await fetchWeekRecordIfPossible();
  } catch (e) {
    setStatus("❌ " + (e?.message || "Error"), false);
  }
});

/* init */
(function init() {
  setPillActive();
  if (!el("date").value) el("date").value = isoToday();
  fetchWeekRecordIfPossible();
})();
