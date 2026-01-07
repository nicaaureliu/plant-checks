const CHECKLISTS = {
  excavator: [
    "Walkaround – leaks / damage",
    "Tracks / undercarriage",
    "Hydraulic hoses / rams",
    "Lights / beacon / horn",
    "Mirrors / camera",
    "Seatbelt",
    "Fire extinguisher",
    "Bucket / hitch / pins",
    "Cab controls / isolator",
    "Defects reported"
  ],
  crane: [
    "LOLER certification available",
    "Outriggers / mats condition",
    "Hook / latch / block",
    "Wire rope / sheaves",
    "Limit switches",
    "Slew / boom functions",
    "Lights / beacon / horn",
    "Emergency stop works",
    "Cab controls / access",
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

let selectedType = null;

const el = (id) => document.getElementById(id);
const statusEl = el("status");

function setToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  el("date").value = `${yyyy}-${mm}-${dd}`;
}

function renderChecks(type) {
  const wrap = el("checks");
  wrap.innerHTML = "";
  CHECKLISTS[type].forEach((label, idx) => {
    const div = document.createElement("div");
    div.className = "check";
    div.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px;">${label}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label>Status</label>
          <select class="checkStatus" data-idx="${idx}">
            <option value="OK">OK</option>
            <option value="DEFECT">Defect</option>
            <option value="NA">N/A</option>
          </select>
        </div>
        <div>
          <label>Comment</label>
          <input class="checkComment" data-idx="${idx}" placeholder="If defect, write details" />
        </div>
      </div>
    `;
    wrap.appendChild(div);
  });
}

function selectType(type) {
  selectedType = type;
  el("selectedType").textContent = `Selected: ${type.toUpperCase()}`;
  renderChecks(type);
}

el("btnExc").addEventListener("click", () => selectType("excavator"));
el("btnCrane").addEventListener("click", () => selectType("crane"));
el("btnDump").addEventListener("click", () => selectType("dumper"));
el("fillToday").addEventListener("click", setToday);

// --- Signature pad ---
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
resizeCanvas();

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

el("clearSig").addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// --- Build a PDF in the browser using jsPDF ---
function makePdf(payload) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  let y = 40;
  const left = 40;

  doc.setFontSize(16);
  doc.text(`${payload.equipmentType.toUpperCase()} CHECK SHEET`, left, y); y += 24;

  doc.setFontSize(11);
  doc.text(`Site: ${payload.site}`, left, y); y += 16;
  doc.text(`Date: ${payload.date}`, left, y); y += 16;
  doc.text(`Plant ID: ${payload.plantId}`, left, y); y += 16;
  doc.text(`Operator: ${payload.operator}`, left, y); y += 16;
  if (payload.hours) { doc.text(`Hours/Shift: ${payload.hours}`, left, y); y += 16; }

  y += 8;
  doc.setFontSize(13);
  doc.text("Checks:", left, y); y += 18;

  doc.setFontSize(10);
  for (const c of payload.checks) {
    const line = `• ${c.label} — ${c.status}${c.comment ? ` — ${c.comment}` : ""}`;
    const lines = doc.splitTextToSize(line, 515);
    if (y > 760) { doc.addPage(); y = 40; }
    doc.text(lines, left, y);
    y += (lines.length * 12) + 4;
  }

  y += 10;
  doc.setFontSize(13);
  doc.text("Signature:", left, y); y += 10;

  // Add signature image
  if (payload.signatureDataUrl && payload.signatureDataUrl.startsWith("data:image")) {
    doc.addImage(payload.signatureDataUrl, "PNG", left, y, 260, 90);
    y += 100;
  } else {
    doc.setFontSize(10);
    doc.text("(no signature)", left, y); y += 16;
  }

  doc.setFontSize(9);
  doc.text(`Submitted: ${new Date().toISOString()}`, left, 820);

  // Return base64 (without the data: prefix)
  const dataUri = doc.output("datauristring"); // data:application/pdf;base64,....
  return dataUri.split(",")[1];
}

el("submitBtn").addEventListener("click", async () => {
  statusEl.textContent = "";

  if (!selectedType) return (statusEl.textContent = "Select Excavator / Crane / Dumper first.");

  const payload = {
    equipmentType: selectedType,
    site: el("site").value.trim(),
    date: el("date").value,
    plantId: el("plantId").value.trim(),
    operator: el("operator").value.trim(),
    hours: el("hours").value.trim(),
    signatureDataUrl: canvas.toDataURL("image/png"),
    checks: [],
  };

  if (!payload.site || !payload.date || !payload.plantId || !payload.operator) {
    return (statusEl.textContent = "Fill Site, Date, Plant ID, and Operator.");
  }

  const statuses = [...document.querySelectorAll(".checkStatus")];
  payload.checks = statuses.map((sel) => {
    const idx = Number(sel.getAttribute("data-idx"));
    const comment = document.querySelector(`.checkComment[data-idx="${idx}"]`)?.value?.trim() || "";
    return { label: CHECKLISTS[selectedType][idx], status: sel.value, comment };
  });

  // Token from QR link: ?t=xxxx
  const url = new URL(window.location.href);
  const token = url.searchParams.get("t") || "";

  try {
    el("submitBtn").disabled = true;
    statusEl.textContent = "Creating PDF and sending…";
if ((window.__logosLoaded || 0) < 2) {
  statusEl.textContent = "Loading logos… wait 1 second and press Submit again.";
  el("submitBtn").disabled = false;
  return;
}
    const pdfBase64 = makePdf(payload);

    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, payload, pdfBase64 }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out?.error || "Submit failed");

    statusEl.textContent = "✅ Sent successfully.";
  } catch (e) {
    statusEl.textContent = `❌ ${e.message}`;
  } finally {
    el("submitBtn").disabled = false;
  }
});

setToday();

