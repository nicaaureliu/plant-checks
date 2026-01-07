// ====== CHECKLISTS ======
const CHECKLISTS = {
  excavator: [
    "Bucket – excessive wear/damage, cracks",
    "Bucket cylinder & linkage – excessive wear/damage, leaks",
    "Stick – excessive wear/damage, cracks",
    "Boom cylinders – excessive wear/damage, leaks",
    "Underneath of machine / final drive – damage, leaks",
    "Cab – damage, cracks",
    "Undercarriage – wear, damage, tension",
    "Steps & handholds – condition & cleanliness",
    "Batteries & hold downs – cleanliness, loose bolts/nuts",
    "Air filter – restriction indicator",
    "Windshield wipers & washers – wear/damage, fluid level",
    "Engine coolant – fluid level",
    "Radiator – fin blockage, leaks",
    "Hydraulic oil tank – fluid level, damage, leaks",
    "Fuel tank – fluid level, damage, leaks",
    "Fire extinguisher – charge, damage",
    "Lights – damage",
    "Mirrors – damage, adjust for best visibility",
    "Fuel water separator – drain",
    "Overall machine – loose/missing nuts & bolts, guards, cleanliness",
    "Swing gear – oil/fluid level",
    "Engine oil – fluid level",
    "All hoses – cracks, wear spots, leaks",
    "All belts – tension, wear, cracks",
    "Overall engine compartment – rubbish, dirt, leaks",
    "Seat – adjustment",
    "Seat belt & mounting – damage/wear/adjustment",
    "Indicators & gauges – check/test",
    "Horn / backup alarm / lights – proper function",
    "Overall cab interior – cleanliness"
  ],
  crane: [
    "LOLER certificate available",
    "Outriggers / mats condition",
    "Hook / latch / block OK",
    "Wire rope / sheaves OK",
    "Limit switches OK",
    "Slew / boom functions OK",
    "Emergency stop works",
    "Lights / beacon / horn OK",
    "Cab access / housekeeping",
    "Defects reported"
  ],
  dumper: [
    "Walkaround – leaks / damage",
    "Tyres / wheels / nuts",
    "Brakes / steering",
    "Reverse alarm",
    "Beacon / horn / lights",
    "Seatbelt",
    "ROPS / guards",
    "Hydraulics (tip function)",
    "Mirrors / camera",
    "Defects reported"
  ],
};

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const STATUSES = ["OK", "DEFECT", "NA"];

const el = (id) => document.getElementById(id);
const statusEl = el("status");

// ====== STATE ======
let selectedType = null;
let labels = [];
let statuses = []; // statuses[row][day] = "OK"|"DEFECT"|"NA"|null
let activeDayIndex = 0;
let lastWeekKey = null;

// ====== DATE HELPERS ======
function setToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  el("date").value = `${yyyy}-${mm}-${dd}`;
}

function formatDateUK(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return "";
  const [y,m,d] = yyyy_mm_dd.split("-");
  return `${d}/${m}/${y}`;
}

// Week commencing Monday (UK)
function getWeekCommencing(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return "";
  const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // Sun=0 ... Mon=1
  const diffToMon = (day === 0 ? -6 : 1 - day);
  dt.setDate(dt.getDate() + diffToMon);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return formatDateUK(`${yy}-${mm}-${dd}`);
}

// Mon=0 ... Sun=6
function getDayIndexMon0(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return 0;
  const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // Sun=0
  return day === 0 ? 6 : day - 1;
}

function markForStatus(s) {
  if (s === "OK") return "✓";
  if (s === "DEFECT") return "X";
  if (s === "NA") return "N/A";
  return "";
}

function cycleStatus(current) {
  const idx = STATUSES.indexOf(current);
  if (idx === -1) return "OK";
  return STATUSES[(idx + 1) % STATUSES.length];
}

// ====== LOGOS for PDF ======
let __logoCache = null;

async function fetchAsDataUrl(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error("Logo missing: " + path);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function getLogos() {
  if (__logoCache) return __logoCache;
  const [left, right] = await Promise.all([
    fetchAsDataUrl("/assets/atl-logo.png"),
    fetchAsDataUrl("/assets/tp.png"),
  ]);
  __logoCache = { left, right };
  return __logoCache;
}

// ====== HEADER / PREVIEWS ======
function updateHeaderText() {
  const type = selectedType || "";
  el("selectedType").textContent = type ? `Selected: ${type.toUpperCase()}` : "Selected: —";

  const title =
    type === "excavator" ? "Excavator Pre use Inspection Checklist" :
    type === "crane" ? "Crane Pre use Inspection Checklist" :
    type === "dumper" ? "Dumper Pre use Inspection Checklist" :
    "Pre use Inspection Checklist";

  el("sheetTitle").textContent = title;
  el("formRef").textContent = "QPFPL5.2";
}

function updatePreviews() {
  el("machineNoPreview").textContent = el("plantId").value.trim() || "—";
  el("weekCommencingPreview").textContent = getWeekCommencing(el("date").value) || "—";
}

// ====== WEEK LOAD FROM KV ======
function getTokenFromUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get("t") || "";
}

function ensureMatrix() {
  if (!labels.length) return;
  if (!statuses.length || statuses.length !== labels.length) {
    statuses = labels.map(() => Array(7).fill(null));
  }
  for (let r = 0; r < labels.length; r++) {
    if (!Array.isArray(statuses[r]) || statuses[r].length !== 7) {
      statuses[r] = Array(7).fill(null);
    }
  }
}

function defaultActiveDayToOK() {
  // makes the active day ready to submit (like your old app)
  ensureMatrix();
  for (let r = 0; r < labels.length; r++) {
    if (!statuses[r][activeDayIndex]) statuses[r][activeDayIndex] = "OK";
  }
}

async function loadWeek() {
  const plantId = el("plantId").value.trim();
  const date = el("date").value;
  if (!selectedType || !plantId || !date) return;

  activeDayIndex = getDayIndexMon0(date);

  const token = getTokenFromUrl();
  const qs = new URLSearchParams({
    t: token,
    type: selectedType,
    plantId,
    date
  });

  const res = await fetch(`/api/week?${qs.toString()}`, { cache: "no-store" });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out?.error || "Failed to load week");

  lastWeekKey = out.key || null;

  if (out.record) {
    labels = out.record.labels || (CHECKLISTS[selectedType] || []);
    statuses = out.record.statuses || labels.map(() => Array(7).fill(null));
  } else {
    labels = (CHECKLISTS[selectedType] || []);
    statuses = labels.map(() => Array(7).fill(null));
  }

  ensureMatrix();
  defaultActiveDayToOK();
  renderChecksTable();
}

// ====== TABLE RENDER ======
function renderChecksTable() {
  const tbody = el("checksBody");
  tbody.innerHTML = "";

  activeDayIndex = getDayIndexMon0(el("date").value);
  ensureMatrix();

  labels.forEach((label, rIndex) => {
    const tr = document.createElement("tr");

    const tdItem = document.createElement("td");
    tdItem.className = "item";
    tdItem.textContent = label;
    tr.appendChild(tdItem);

    for (let d = 0; d < 7; d++) {
      const td = document.createElement("td");
      td.className = "day " + (d === activeDayIndex ? "active" : "inactive");

      const st = statuses[rIndex]?.[d] || null;
      const mark = markForStatus(st);

      if (d === activeDayIndex) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "markBtn";
        btn.textContent = mark || "✓"; // default look

        btn.addEventListener("click", () => {
          const cur = statuses[rIndex][d];
          statuses[rIndex][d] = cycleStatus(cur);
          renderChecksTable();
        });

        td.appendChild(btn);
      } else {
        td.textContent = mark;
      }

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  });
}

// ====== TYPE SELECT ======
function selectType(type) {
  selectedType = type;
  updateHeaderText();
  updatePreviews();
  loadWeek().catch(e => (statusEl.textContent = `❌ ${e.message}`));
}

el("btnExc").addEventListener("click", () => selectType("excavator"));
el("btnCrane").addEventListener("click", () => selectType("crane"));
el("btnDump").addEventListener("click", () => selectType("dumper"));

// ====== SIGNATURE ======
const canvas = el("sig");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
}
window.addEventListener("resize", resizeCanvas);

let drawing = false;
let last = null;

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const t = e.touches?.[0];
  const x = (t ? t.clientX : e.clientX) - rect.left;
  const y = (t ? t.clientY : e.clientY) - rect.top;
  return { x, y };
}

function start(e) { drawing = true; last = getPos(e); }
function move(e) {
  if (!drawing) return;
  e.preventDefault();
  const p = getPos(e);
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  last = p;
}
function end() { drawing = false; last = null; }

canvas.addEventListener("mousedown", start);
canvas.addEventListener("mousemove", move);
window.addEventListener("mouseup", end);

canvas.addEventListener("touchstart", start, { passive: false });
canvas.addEventListener("touchmove", move, { passive: false });
canvas.addEventListener("touchend", end);

el("clearSig").addEventListener("click", () => ctx.clearRect(0, 0, canvas.width, canvas.height));

// ====== PDF (prints the WHOLE WEEK from `statuses`) ======
async function makePdf(payload) {
  const logos = await getLogos();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageW = 595, pageH = 842, margin = 30;

  doc.setLineWidth(0.8);
  doc.line(margin, 115, pageW - margin, 115);

  doc.addImage(logos.left, "PNG", margin, 18, 150, 55);
  doc.addImage(logos.right, "PNG", pageW - margin - 55, 18, 55, 55);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.text("QPFPL5.2", pageW / 2, 35, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);

  const title =
    payload.equipmentType === "excavator" ? "Excavator Pre use Inspection Checklist" :
    payload.equipmentType === "crane" ? "Crane Pre use Inspection Checklist" :
    "Dumper Pre use Inspection Checklist";

  doc.text(title, pageW / 2, 75, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text(`Machine No: ${payload.plantId || ""}`, margin, 105);
  doc.text(`Week commencing: ${getWeekCommencing(payload.date)}`, pageW - margin, 105, { align: "right" });

  doc.setFillColor(255, 214, 0);
  doc.rect(margin, 125, pageW - margin * 2, 20, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    "All checks must be carried out in line with Specific Manufacturer’s instructions",
    pageW / 2,
    139,
    { align: "center" }
  );

  const itemColW = 330;
  const dayColW = (pageW - margin * 2 - itemColW) / 7;
  const rowH = 16;

  let y = 153;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);

  doc.setFillColor(255, 214, 0);
  doc.rect(margin, y, itemColW, rowH, "F");
  doc.rect(margin, y, itemColW, rowH);

  for (let i = 0; i < 7; i++) {
    const x = margin + itemColW + i * dayColW;
    doc.rect(x, y, dayColW, rowH);
    doc.text(DAYS[i], x + dayColW / 2, y + 11, { align: "center" });
  }
  y += rowH;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  for (let r = 0; r < labels.length; r++) {
    if (y + rowH > pageH - 160) { doc.addPage(); y = margin; }

    doc.rect(margin, y, itemColW, rowH);
    const t = (labels[r] || "").toUpperCase();
    doc.text(doc.splitTextToSize(t, itemColW - 8)[0] || "", margin + 4, y + 11);

    for (let d = 0; d < 7; d++) {
      const x = margin + itemColW + d * dayColW;
      doc.rect(x, y, dayColW, rowH);

      const st = statuses[r]?.[d] || null;
      if (st) {
        const mark = st === "OK" ? "✓" : (st === "DEFECT" ? "X" : "N/A");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(mark, x + dayColW / 2, y + 12, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }
    }

    y += rowH;
  }

  const footerY = Math.max(y + 10, pageH - 150);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Defects identified:", margin, footerY);
  doc.rect(margin, footerY + 8, pageW - margin * 2, 40);

  doc.text("Reported to/action taken:", margin, footerY + 60);
  doc.rect(margin, footerY + 68, pageW - margin * 2, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(payload.defectsText ? payload.defectsText : "None", margin + 5, footerY + 28);
  if (payload.actionTaken) doc.text(payload.actionTaken, margin + 5, footerY + 88);

  doc.setFont("helvetica", "bold");
  doc.text(`Checks carried out by: ${payload.operator || ""}`, margin, footerY - 8);

  if (payload.signatureDataUrl?.startsWith("data:image")) {
    doc.addImage(payload.signatureDataUrl, "PNG", pageW - margin - 160, footerY - 35, 160, 50);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("BUILD: v5", 40, 835);

  const dataUri = doc.output("datauristring");
  return dataUri.split(",")[1];
}

// ====== INPUT EVENTS ======
let loadTimer = null;

function scheduleLoadWeek() {
  clearTimeout(loadTimer);
  loadTimer = setTimeout(() => {
    statusEl.textContent = "";
    loadWeek().catch(e => (statusEl.textContent = `❌ ${e.message}`));
  }, 400);
}

el("date").addEventListener("change", () => {
  updatePreviews();
  scheduleLoadWeek();
});

el("plantId").addEventListener("input", () => {
  updatePreviews();
  scheduleLoadWeek();
});

el("fillToday").addEventListener("click", () => {
  setToday();
  updatePreviews();
  scheduleLoadWeek();
});

// ====== SUBMIT ======
el("submitBtn").addEventListener("click", async () => {
  statusEl.textContent = "";

  if (!selectedType) return (statusEl.textContent = "Select Excavator / Crane / Dumper first.");

  const site = el("site").value.trim();
  const date = el("date").value;
  const plantId = el("plantId").value.trim();
  const operator = el("operator").value.trim();

  if (!site || !date || !plantId || !operator) {
    return (statusEl.textContent = "Fill Site, Date, Machine/Plant ID, and Operator.");
  }

  activeDayIndex = getDayIndexMon0(date);
  defaultActiveDayToOK();

  const token = getTokenFromUrl();

  // send only TODAY’s checks to the backend (backend saves it into the weekly record)
  const todaysChecks = labels.map((label, i) => ({
    label,
    status: statuses[i][activeDayIndex] || "OK",
  }));

  const payload = {
    equipmentType: selectedType,
    site,
    date,
    plantId,
    operator,
    hours: el("hours").value.trim(),
    checks: todaysChecks,
    defectsText: el("defectsText").value.trim(),
    actionTaken: el("actionTaken").value.trim(),
    signatureDataUrl: canvas.toDataURL("image/png"),
  };

  try {
    el("submitBtn").disabled = true;
    statusEl.textContent = "Saving week + creating PDF + sending…";

    const pdfBase64 = await makePdf(payload);

    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, payload, pdfBase64 }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out?.
