/* public/app.js - FULL FILE (paste whole thing) */

const BUILD = "v7";

// ---------- DOM ----------
const el = (id) => document.getElementById(id);

function setStatus(msg, ok = true) {
  const s = el("status");
  if (!s) return;
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
function isoToUK(iso) {
  if (!iso || !String(iso).includes("-")) return iso || "";
  const [y, m, d] = String(iso).split("-");
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
  equipmentType: "",
  labels: [],
  statuses: [], // [row][day]
  activeDay: 0,
  weekCommencingISO: "",
};

// ---------- UI helpers ----------
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

function syncHeaderPreviews() {
  const plantId = (el("plantId")?.value || "").trim();
  if (el("machineNoPreview")) el("machineNoPreview").textContent = plantId || "—";

  const dateStr = el("date")?.value || "";
  if (!dateStr) {
    if (el("weekCommencingPreview")) el("weekCommencingPreview").textContent = "—";
    state.weekCommencingISO = "";
    return;
  }
  state.weekCommencingISO = getWeekCommencingISO(dateStr);
  if (el("weekCommencingPreview")) el("weekCommencingPreview").textContent = isoToUK(state.weekCommencingISO);
}

function buildTable() {
  const body = el("checksBody");
  if (!body) return;
  body.innerHTML = "";

  const dateStr = el("date")?.value || "";
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

function setType(type) {
  state.equipmentType = type;
  state.labels = CHECKS[type] || [];
  state.statuses = state.labels.map(() => Array(7).fill(null));

  // buttons styling (optional)
  ["btnExc","btnCrane","btnDump"].forEach((id) => el(id)?.classList.remove("active"));
  if (type === "excavator") el("btnExc")?.classList.add("active");
  if (type === "crane") el("btnCrane")?.classList.add("active");
  if (type === "dumper") el("btnDump")?.classList.add("active");

  if (el("selectedType")) {
    el("selectedType").textContent = `Selected: ${type ? type[0].toUpperCase() + type.slice(1) : "—"}`;
  }

  const title =
    type === "excavator" ? "Excavator Pre-Use Inspection Checklist" :
    type === "crane" ? "Crane Pre-Use Inspection Checklist" :
    type === "dumper" ? "Dumper Pre-Use Inspection Checklist" :
    "Plant Pre-Use Inspection Checklist";
  if (el("sheetTitle")) el("sheetTitle").textContent = title;

  buildTable();
  maybeLoadWeek();
}

// ---------- Load week record ----------
function applyWeekRecord(record) {
  state.statuses = state.labels.map(() => Array(7).fill(null));
  if (!record || !record.labels || !record.statuses) return;

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
  try {
    syncHeaderPreviews();

    const token = state.token;
    const type = state.equipmentType;
    const plantId = (el("plantId")?.value || "").trim();
    const dateStr = el("date")?.value || "";

    if (!token || !type || !plantId || !dateStr) {
      buildTable();
      return;
    }

    setStatus("Loading week record…");
    const qs = new URLSearchParams({ t: token, type, plantId, date: dateStr });
    const res = await fetch(`/api/week?${qs.toString()}`, { cache: "no-store" });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out?.error || "Failed to load week");

    applyWeekRecord(out.record);
    buildTable();
    setStatus(`Week loaded (${isoToUK(out.week || state.weekCommencingISO)}).`);
  } catch (e) {
    buildTable();
    setStatus(e.message || "Week load failed", false);
  }
}

// ---------- Signature canvas ----------
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

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * devicePixelRatio,
      y: (e.clientY - rect.top) * devicePixelRatio,
    };
  }

  canvas.addEventListener("pointerdown", (e) => { drawing = true; last = pos(e); });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
  });
  const stop = () => { drawing = false; last = null; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener("pointerleave", stop);

  el("clearSig")?.addEventListener("click", () => ctx.clearRect(0, 0, canvas.width, canvas.height));

  return {
    getDataUrl() { return canvas.toDataURL("image/png"); }
  };
}

// ---------- PDF helpers ----------
function imgTypeFromDataUrl(dataUrl) {
  const s = String(dataUrl || "");
  if (s.startsWith("data:image/jpeg")) return "JPEG";
  return "PNG";
}
async function fetchAsDataUrl(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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

// Crop signature whitespace so it centres properly
async function cropSignatureDataUrl(dataUrl) {
  if (!dataUrl || !String(dataUrl).startsWith("data:image")) return null;

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const c = document.createElement("canvas");
  const ctx = c.getContext("2d", { willReadFrequently: true });

  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  ctx.drawImage(img, 0, 0);

  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);

  let minX = width, minY = height, maxX = -1, maxY = -1;

  const isInk = (r, g, b, a) => a > 0 && (r < 245 || g < 245 || b < 245);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (isInk(r, g, b, a)) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) return null;

  const pad = 20;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;

  const octx = out.getContext("2d");
  octx.drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);

  return out.toDataURL("image/png");
}

function drawWrappedText(doc, text, x, y, maxW, maxH, fontSize) {
  if (!text) return;
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(String(text), maxW);
  const lineH = fontSize * 1.15;
  const maxLines = Math.max(1, Math.floor(maxH / lineH));
  const out = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    const last = out[out.length - 1] || "";
    out[out.length - 1] = last.replace(/\s+$/, "") + "…";
  }
  doc.text(out, x, y);
}

function drawStatusMark(doc, status, x, y, w, h, fontSize) {
  // x,y = top-left of the cell
  if (!status) return;

  // N/A stays as text (it renders fine)
  if (status === "NA") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(7, fontSize - 1));
    doc.text("N/A", x + w / 2, y + h * 0.72, { align: "center" });
    return;
  }

  // Draw marks as vector lines (always visible)
  const padX = w * 0.22;
  const padY = h * 0.22;

  const left   = x + padX;
  const right  = x + w - padX;
  const top    = y + padY;
  const bottom = y + h - padY;

  doc.setDrawColor(0);
  doc.setLineWidth(1.2);

  if (status === "OK") {
    // Tick ✓
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

}

// ---------- PDF generator (ONE PAGE ALWAYS) ----------
async function makePdfBase64(payload) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait", compress: true });

  const margin = 22;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  const dateISO = payload.date || "";
  const weekISO = payload.weekCommencingISO || payload.weekCommencing || "";
  const weekUK = isoToUK(weekISO);
  const dateUK = isoToUK(dateISO);

  const labels = payload.labels || [];
  const weekStatuses = payload.weekStatuses || [];

  const totalRows = labels.length;

  let y = margin;

  // Logos + title
  const atl = await fetchAsDataUrl("/assets/atl-logo.png");
  if (atl) doc.addImage(atl, imgTypeFromDataUrl(atl), margin, y - 2, 135, 34);

  const tp = await fetchAsDataUrl("/assets/tp.png");
  if (tp) doc.addImage(tp, imgTypeFromDataUrl(tp), pageW - margin - 48, y - 6, 48, 48);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.text(String(payload.formRef || "QPFPL5.2"), pageW / 2, y + 12, { align: "center" });

  doc.setFontSize(9.8);
  doc.text(String(payload.sheetTitle || ""), pageW / 2, y + 28, { align: "center" });

  y += 46;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Machine No: ${payload.machineNo || ""}`, margin, y);
  doc.text(`Week commencing: ${weekUK}`, pageW - margin, y, { align: "right" });
  y += 10;

  doc.setFillColor(255, 214, 0);
  doc.rect(margin, y, pageW - margin * 2, 16, "F");
  doc.setTextColor(0);
  doc.setFontSize(8.3);
  doc.text(
    "All checks must be carried out in line with Specific Manufacturer’s instructions",
    pageW / 2, y + 11, { align: "center" }
  );
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.text(`Site: ${payload.site || ""}`, margin, y);
  doc.text(`Date: ${dateUK}`, margin + 175, y);
  doc.text(`Operator: ${payload.operator || ""}`, margin + 310, y);
  doc.text(`Hours/Shift: ${payload.hours || ""}`, pageW - margin, y, { align: "right" });
  y += 14;

  // Footer block sizes shrink with many rows
  let defectsBoxH = 42, actionBoxH = 42, sigBoxH = 58;
  if (totalRows > 45) { defectsBoxH = 34; actionBoxH = 34; sigBoxH = 50; }
  if (totalRows > 60) { defectsBoxH = 28; actionBoxH = 28; sigBoxH = 44; }

  const headH = 16;

  const footerTotal =
    12 +
    10 + 7 + defectsBoxH + 10 +
    12 + 7 + actionBoxH + 10 +
    10 + 6 + sigBoxH +
    18;

  const tableX = margin;
  const tableW = pageW - margin * 2;
  const itemColW = Math.min(360, tableW * 0.66);
  const dayColW = (tableW - itemColW) / 7;

  const availForRows = (pageH - margin) - y - headH - 8 - footerTotal;
  let rowH = Math.floor(availForRows / Math.max(1, totalRows));
  rowH = Math.max(6, Math.min(14, rowH));

  const fontItem = rowH <= 8 ? 6.3 : rowH <= 10 ? 6.9 : 7.6;
  const fontMark = rowH <= 8 ? 8.0 : rowH <= 10 ? 8.8 : 9.6;

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
  for (let r = 0; r < totalRows; r++) {
    doc.rect(tableX, y, tableW, rowH);

    doc.line(tableX + itemColW, y, tableX + itemColW, y + rowH);
    for (let i = 1; i < 7; i++) {
      const xx = tableX + itemColW + dayColW * i;
      doc.line(xx, y, xx, y + rowH);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontItem);
    const maxW = itemColW - 10;
    let label = String(labels[r] || "");
    while (label.length && doc.getTextWidth(label) > maxW) label = label.slice(0, -1);
    if (label.length < String(labels[r] || "").length) label = label.slice(0, -1) + "…";
    doc.text(label, tableX + 6, y + rowH * 0.72);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontMark);
    for (let i = 0; i < 7; i++) {
      for (let i = 0; i < 7; i++) {
  const st = weekStatuses?.[r]?.[i];
  if (!st) continue;

  const cellX = tableX + itemColW + dayColW * i;
  const cellY = y; // NOTE: this must be the row’s top Y before you increment y
  drawStatusMark(doc, st, cellX, cellY, dayColW, rowH, fontMark);
}
    y += rowH;
  }

  y += 8;

  // footer blocks
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Checks carried out by: ${payload.operator || ""}`, margin, y);
  y += 12;

  doc.text("Defects identified:", margin, y);
  y += 7;
  doc.rect(margin, y, pageW - margin * 2, defectsBoxH);
  doc.setFont("helvetica", "normal");
  drawWrappedText(doc, payload.defectsText || "", margin + 6, y + 14, pageW - margin * 2 - 12, defectsBoxH - 10, 8.2);
  y += defectsBoxH + 10;

  doc.setFont("helvetica", "bold");
  doc.text("Reported to / action taken:", margin, y);
  y += 7;
  doc.rect(margin, y, pageW - margin * 2, actionBoxH);
  doc.setFont("helvetica", "normal");
  drawWrappedText(doc, payload.actionTaken || "", margin + 6, y + 14, pageW - margin * 2 - 12, actionBoxH - 10, 8.2);
  y += actionBoxH + 10;

  doc.setFont("helvetica", "bold");
  doc.text("Signature:", margin, y);
  y += 6;

  const sigBoxW = pageW - margin * 2;
  doc.rect(margin, y, sigBoxW, sigBoxH);

  if (payload.signatureDataUrl && String(payload.signatureDataUrl).startsWith("data:image")) {
    try {
      const cropped = await cropSignatureDataUrl(payload.signatureDataUrl);
      const sigData = cropped || payload.signatureDataUrl;

      const pad = 6;
      const innerW = sigBoxW - pad * 2;
      const innerH = sigBoxH - pad * 2;

      const { w: iw, h: ih } = await getImageSize(sigData);
      const fitted = fitIntoBox(iw, ih, innerW, innerH);

      const imgX = margin + pad + (innerW - fitted.w) / 2;
      const imgY = y + pad + (innerH - fitted.h) / 2;

      doc.addImage(sigData, imgTypeFromDataUrl(sigData), imgX, imgY, fitted.w, fitted.h);
    } catch {}
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Submitted: ${new Date().toISOString()}`, margin, pageH - 16);
  doc.text(`BUILD: ${BUILD}`, pageW / 2, pageH - 16, { align: "center" });

  const dataUri = doc.output("datauristring");
  const parts = String(dataUri).split(",");
  if (parts.length < 2) throw new Error("PDF export failed (bad data URI)");
  return parts[1];
}

// ---------- Submit ----------
async function submitForm(sigApi) {
  try {
    const token = state.token;
    if (!token) throw new Error("Missing token in URL (?t=...)");

    const type = state.equipmentType;
    if (!type) throw new Error("Select Excavator / Crane / Dumper");

    const dateStr = el("date")?.value || "";
    if (!dateStr) throw new Error("Select a date");

    const plantId = (el("plantId")?.value || "").trim();
    if (!plantId) throw new Error("Enter Machine / Plant ID");

    syncHeaderPreviews();

    // Build payload (send full week matrix for PDF; send today's marks for server merge)
    const payload = {
      equipmentType: type,
      formRef: "QPFPL5.2",
      sheetTitle: el("sheetTitle")?.textContent || "",
      site: (el("site")?.value || "").trim(),
      date: dateStr,
      weekCommencingISO: state.weekCommencingISO,
      machineNo: plantId,
      plantId,
      operator: (el("operator")?.value || "").trim(),
      hours: (el("hours")?.value || "").trim(),
      defectsText: (el("defectsText")?.value || "").trim(),
      actionTaken: (el("actionTaken")?.value || "").trim(),
      signatureDataUrl: sigApi.getDataUrl(),

      labels: state.labels,
      weekStatuses: state.statuses, // full Mon-Sun
      dayIndex: getDayIndexMon0(dateStr),

      // Send today's only so backend merges into KV safely
      checks: state.labels.map((label, i) => ({
        label,
        status: state.statuses[i]?.[getDayIndexMon0(dateStr)] ?? null,
      })),
    };

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
    // Reload week from KV so UI reflects stored state
    await maybeLoadWeek();
  } catch (e) {
    setStatus(e.message || "Submit failed", false);
  } finally {
    el("submitBtn").disabled = false;
  }
}

// ---------- Init ----------
(function init() {
  state.token = getTokenFromUrl();

  if (el("linkTokenInfo")) {
    el("linkTokenInfo").textContent = state.token ? "Link token OK" : "⚠️ Missing token in link (?t=...)";
  }

  // default date = today
  if (el("date")) el("date").value = toISODate(new Date());

  // bind buttons
  el("btnExc")?.addEventListener("click", () => setType("excavator"));
  el("btnCrane")?.addEventListener("click", () => setType("crane"));
  el("btnDump")?.addEventListener("click", () => setType("dumper"));

  el("date")?.addEventListener("change", () => { syncHeaderPreviews(); buildTable(); maybeLoadWeek(); });
  el("plantId")?.addEventListener("input", () => { syncHeaderPreviews(); maybeLoadWeek(); });

  const sigApi = setupSignature();
  el("fillToday")?.addEventListener("click", () => {
    if (el("date")) el("date").value = toISODate(new Date());
    syncHeaderPreviews();
    buildTable();
    maybeLoadWeek();
  });

  el("submitBtn")?.addEventListener("click", async () => submitForm(sigApi));

  // start with excavator by default (so user sees something immediately)
  setType("excavator");

  syncHeaderPreviews();
  buildTable();
  setStatus("Ready.");
})();
