/* Plant Checks - app.js (v5.1 fixed init)
   - Works with your index.html IDs:
     btnExc, btnCrane, btnDump, selectedType, checksBody, sig, clearSig, fillToday,
     site, date, plantId, operator, hours, defectsText, actionTaken, submitBtn, status
*/
// BUILD marker (so we can see if the latest JS is loaded)
try {
  const s = document.getElementById("status");
  if (s) s.textContent = "✅ app.js BUILD v6 loaded";
} catch {}

const el = (id) => document.getElementById(id);

const BUILD = "v5.1-fixed";

// --- token from URL (?t=...) ---
function getToken() {
  const u = new URL(location.href);
  return u.searchParams.get("t") || "";
}

// --- dates helpers ---
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseDateInput(value) {
  if (!value) return null;
  const d = new Date(value + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}
// Monday as start of week
function weekCommencingMonday(dateObj) {
  const d = new Date(dateObj);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // Mon=0, Tue=1,... Sun=6
  d.setDate(d.getDate() - diff);
  return d;
}
function dayIndexMon0(dateObj) {
  // Mon=0 .. Sun=6
  const dow = dateObj.getDay(); // Sun=0
  return (dow + 6) % 7;
}

// --- checklist data ---
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
    "BATTERIES & HOLDOWNS, Cleanliness, Loose Bolts and Nots",
    "AIR FILTER, Restriction Indicator",
    "WINDSHIELD WIPERS AND WASHERS, Wear, Damage, Fluid Level",
    "ENGINE COOLANT, Fluid Level",
    "RADIATOR, Fin Blockage, Leaks",
    "HYDRAULIC OIL TANK, Fluid Level, Damage, Leaks",
    "FUEL TANK, Fluid Level, Damage, Leaks",
    "FIRE EXTINGUISHER, Charge, Damage",
    "LIGHTS, Damage",
    "MIRRORS, Damage Adjust For Best Visibility",
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
    "HORN, BACKUP ALARM, LIGHTS, Proper Function",
    "OVERALL CAB INTERIOR, Cleanliness",
  ],
  crane: [
    "Walkaround – leaks / damage",
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
    "Tyres – condition & pressure",
    "Brakes – service & park brake working",
    "Steering – no excessive play",
    "Tip body – secure, pins & hydraulics OK",
    "Hydraulic leaks – none",
    "Lights / beacon – working",
    "Horn / reverse alarm – working",
    "Mirrors / camera – clean & working",
    "Seatbelt – working",
    "Steps / handholds – clean & secure",
    "Fire extinguisher – present & charged",
  ],
};

// --- state ---
let selectedType = "excavator";
let labels = CHECKLISTS[selectedType].slice();
let statuses = labels.map(() => Array(7).fill(null)); // null | "OK" | "DEFECT" | "NA"
let activeDay = 0; // Mon=0..Sun=6

function setStatusText(txt) {
  const s = el("status");
  if (s) s.textContent = txt;
}

function markSymbol(v) {
  if (v === "OK") return "✓";
  if (v === "DEFECT") return "X";
  if (v === "NA") return "N/A";
  return "";
}

function cycle(v) {
  if (v === null) return "OK";
  if (v === "OK") return "DEFECT";
  if (v === "DEFECT") return "NA";
  return null;
}

// --- render ---
function renderSelected() {
  const p = el("selectedType");
  if (p) p.textContent = `Selected: ${selectedType.toUpperCase()}`;
  const title = el("sheetTitle");
  if (title) {
    title.textContent =
      selectedType === "excavator"
        ? "Excavator Pre use Inspection Checklist"
        : selectedType === "crane"
        ? "Crane Pre use Inspection Checklist"
        : "Dumper Pre use Inspection Checklist";
  }
}

function renderWeekCommencing() {
  const d = parseDateInput(el("date")?.value);
  const out = el("weekCommencingPreview");
  if (!out) return;

  if (!d) {
    out.textContent = "—";
    return;
  }
  const wc = weekCommencingMonday(d);
  out.textContent = wc.toLocaleDateString("en-GB");
}

function renderMachinePreview() {
  const p = el("machineNoPreview");
  if (p) p.textContent = el("plantId")?.value?.trim() || "—";
}

function renderTable() {
  const body = el("checksBody");
  if (!body) return;

  body.innerHTML = "";

  labels.forEach((label, row) => {
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
      btn.textContent = markSymbol(statuses[row][d]);
      btn.disabled = d !== activeDay;

      btn.addEventListener("click", () => {
        statuses[row][d] = cycle(statuses[row][d]);
        btn.textContent = markSymbol(statuses[row][d]);
      });

      td.appendChild(btn);
      tr.appendChild(td);
    }

    body.appendChild(tr);
  });
}

// --- type selection ---
async function selectType(type) {
  selectedType = type;
  labels = CHECKLISTS[selectedType].slice();
  statuses = labels.map(() => Array(7).fill(null)); // reset then load week from KV (if any)

  renderSelected();
  renderMachinePreview();
  renderWeekCommencing();
  syncActiveDayFromDate();
  renderTable();

  // try load saved week (if plantId + date exist)
  await loadWeekIfPossible();
}

// --- date/plant watchers ---
function syncActiveDayFromDate() {
  const d = parseDateInput(el("date")?.value);
  if (!d) {
    activeDay = 0;
    return;
  }
  activeDay = dayIndexMon0(d);
}

async function loadWeekIfPossible() {
  const token = getToken();
  const plantId = el("plantId")?.value?.trim();
  const d = parseDateInput(el("date")?.value);

  if (!token || !plantId || !d) return;

  try {
    const url = `/api/week?t=${encodeURIComponent(token)}&type=${encodeURIComponent(
      selectedType
    )}&plantId=${encodeURIComponent(plantId)}&date=${encodeURIComponent(isoDate(d))}`;

    const res = await fetch(url);
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Failed to load week");

    if (out.record && out.record.labels && out.record.statuses) {
      // apply saved state
      labels = out.record.labels;
      statuses = out.record.statuses;

      // If labels mismatch (checklist updated), rebuild safely
      if (!Array.isArray(labels) || !Array.isArray(statuses)) {
        labels = CHECKLISTS[selectedType].slice();
        statuses = labels.map(() => Array(7).fill(null));
      }
    }

    syncActiveDayFromDate();
    renderSelected();
    renderWeekCommencing();
    renderTable();
  } catch (e) {
    // don’t block the UI if KV fails
    setStatusText(`⚠️ Week load: ${e.message}`);
  }
}

// --- signature pad ---
function setupSignature() {
  const canvas = el("sig");
  if (!canvas) return;

  // make canvas high-res
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }
  resize();
  window.addEventListener("resize", resize);

  const ctx = canvas.getContext("2d");
  let drawing = false;
  let last = null;

  function getPos(ev) {
    const r = canvas.getBoundingClientRect();
    const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    const y = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
    return { x, y };
  }

  function start(ev) {
    drawing = true;
    last = getPos(ev);
    ev.preventDefault();
  }
  function move(ev) {
    if (!drawing) return;
    const p = getPos(ev);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
    ev.preventDefault();
  }
  function end() {
    drawing = false;
    last = null;
  }

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);

  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  window.addEventListener("touchend", end);

  el("clearSig")?.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  el("fillToday")?.addEventListener("click", () => {
    const d = new Date();
    el("date").value = isoDate(d);
    syncActiveDayFromDate();
    renderWeekCommencing();
    renderTable();
    loadWeekIfPossible();
  });
}

function signatureDataUrl() {
  const canvas = el("sig");
  if (!canvas) return "";
  // detect blank
  const ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let hasInk = false;
  for (let i = 3; i < img.length; i += 4) {
    if (img[i] !== 0) { hasInk = true; break; }
  }
  return hasInk ? canvas.toDataURL("image/png") : "";
}

// --- PDF (basic, reliable) ---
async function makePdfBase64(payload) {
  const mod = window.jspdf;
  if (!mod || !mod.jsPDF) throw new Error("jsPDF not loaded");
  const { jsPDF } = mod;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("QPFPL5.2", pageW / 2, 40, { align: "center" });

  doc.setFontSize(12);
  doc.text(payload.title, pageW / 2, 60, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Machine / Plant ID: ${payload.plantId || "-"}`, margin, 90);
  doc.text(`Site: ${payload.site || "-"}`, margin, 105);
  doc.text(`Operator: ${payload.operator || "-"}`, margin, 120);
  doc.text(`Hours/Shift: ${payload.hours || "-"}`, margin, 135);

  doc.text(`Date: ${payload.dateGB || "-"}`, pageW - margin, 90, { align: "right" });
  doc.text(`Week commencing: ${payload.weekCommencingGB || "-"}`, pageW - margin, 105, { align: "right" });

  // yellow bar
  doc.setDrawColor(0);
  doc.setFillColor(255, 214, 0);
  doc.rect(margin, 150, pageW - margin * 2, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    "All checks must be carried out in line with Specific Manufacturer’s instructions",
    pageW / 2,
    162,
    { align: "center" }
  );

  // table
  let y = 180;
  const rowH = 14;
  const itemW = 290;
  const dayW = (pageW - margin * 2 - itemW) / 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.rect(margin, y, pageW - margin * 2, rowH);
  doc.text("Checks", margin + 6, y + 10);
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  for (let i = 0; i < 7; i++) {
    doc.text(days[i], margin + itemW + i * dayW + dayW / 2, y + 10, { align: "center" });
  }
  y += rowH;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  for (let r = 0; r < payload.labels.length; r++) {
    if (y > pageH - 160) {
      doc.addPage();
      y = margin;
    }
    doc.rect(margin, y, pageW - margin * 2, rowH);
    doc.text(payload.labels[r], margin + 6, y + 10);

    for (let d = 0; d < 7; d++) {
      const mark = markSymbol(payload.statuses[r]?.[d] ?? null);
      doc.text(mark, margin + itemW + d * dayW + dayW / 2, y + 10, { align: "center" });
    }
    y += rowH;
  }

  // defects / action
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Defects identified:", margin, y);
  y += 8;
  doc.rect(margin, y, pageW - margin * 2, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(payload.defectsText || "None", margin + 6, y + 14);
  y += 55;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Reported to / action taken:", margin, y);
  y += 8;
  doc.rect(margin, y, pageW - margin * 2, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(payload.actionTaken || "", margin + 6, y + 14);
  y += 55;

  // signature
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Signature:", margin, y);
  const sigUrl = payload.signatureDataUrl;
  if (sigUrl) {
    doc.addImage(sigUrl, "PNG", margin + 70, y - 12, 180, 60);
  }

  // footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Submitted: ${new Date().toISOString()}`, margin, pageH - 30);
  doc.text(`BUILD: ${BUILD}`, margin, pageH - 18);
  doc.text(`Token: ${payload.token}`, pageW - margin, pageH - 18, { align: "right" });

    const dataUri =
    doc.output("datauristring") ||
    doc.output("datauri") ||
    doc.output("dataurlstring");

  if (typeof dataUri !== "string") {
    throw new Error("PDF export failed (jsPDF output returned empty)");
  }

// Convert PDF to base64 safely (NO dataUri split)
const ab = doc.output("arraybuffer");
if (!ab) throw new Error("PDF export failed (arraybuffer empty)");

const bytes = new Uint8Array(ab);
let binary = "";
const chunk = 0x8000; // 32KB chunks

for (let i = 0; i < bytes.length; i += chunk) {
  binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
}

return btoa(binary);

}

// --- submit ---
async function submit() {
  const token = getToken();
  if (!token) {
    setStatusText("❌ Missing token (t=...)");
    return;
  }
  const d = parseDateInput(el("date")?.value);
  if (!d) {
    setStatusText("❌ Please pick a date");
    return;
  }
  const wc = weekCommencingMonday(d);

  const payload = {
    token,
    type: selectedType,
    title:
      selectedType === "excavator"
        ? "Excavator Check Sheet"
        : selectedType === "crane"
        ? "Crane Check Sheet"
        : "Dumper Check Sheet",

    site: el("site")?.value?.trim() || "",
    plantId: el("plantId")?.value?.trim() || "",
    operator: el("operator")?.value?.trim() || "",
    hours: el("hours")?.value?.trim() || "",
    dateISO: isoDate(d),
    dateGB: d.toLocaleDateString("en-GB"),
    weekCommencingISO: isoDate(wc),
    weekCommencingGB: wc.toLocaleDateString("en-GB"),
    defectsText: el("defectsText")?.value?.trim() || "",
    actionTaken: el("actionTaken")?.value?.trim() || "",
    signatureDataUrl: signatureDataUrl(),

    labels,
    statuses,
  };

  try {
    el("submitBtn").disabled = true;
    setStatusText("⏳ Creating PDF…");

    const pdfBase64 = await makePdfBase64(payload);

    setStatusText("⏳ Sending email…");
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, payload, pdfBase64 }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Submit failed");

    setStatusText("✅ Sent successfully.");

    // after submit, re-load week so Mon/Tue etc stays visible
    await loadWeekIfPossible();
  } catch (e) {
    setStatusText(`❌ ${e.message}`);
  } finally {
    el("submitBtn").disabled = false;
  }
}

// --- init ---
function bindUi() {
  el("btnExc").addEventListener("click", () => selectType("excavator"));
  el("btnCrane").addEventListener("click", () => selectType("crane"));
  el("btnDump").addEventListener("click", () => selectType("dumper"));

  el("date").addEventListener("change", () => {
    syncActiveDayFromDate();
    renderWeekCommencing();
    renderTable();
    loadWeekIfPossible();
  });

  el("plantId").addEventListener("input", () => {
    renderMachinePreview();
    loadWeekIfPossible();
  });

  el("submitBtn").addEventListener("click", submit);

  // basic previews
  el("site").addEventListener("input", () => {});
  el("operator").addEventListener("input", () => {});
  el("hours").addEventListener("input", () => {});
}

window.addEventListener("load", async () => {
  try {
    bindUi();
    setupSignature();

    // default date today if blank
    if (!el("date").value) el("date").value = isoDate(new Date());

    renderMachinePreview();
    renderWeekCommencing();

    // default type and show rows immediately
    await selectType("excavator");

    setStatusText("✅ Ready.");
  } catch (e) {
    setStatusText("❌ Init error: " + (e?.message || e));
  }
});
