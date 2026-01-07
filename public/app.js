(() => {
  "use strict";

  // ---------- helpers ----------
  const el = (id) => document.getElementById(id);

  const qs = (name) => {
    const u = new URL(window.location.href);
    return u.searchParams.get(name) || "";
  };

  const pad2 = (n) => String(n).padStart(2, "0");

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function isoToUK(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  // Monday as 0 ... Sunday as 6
  function dayIndexFromISO(iso) {
    const d = new Date(iso + "T00:00:00");
    const js = d.getDay(); // Sun=0, Mon=1 ...
    return (js + 6) % 7;   // Mon=0 ... Sun=6
  }

  function weekCommencingMondayISO(iso) {
    const d = new Date(iso + "T00:00:00");
    const idx = (d.getDay() + 6) % 7; // Mon=0
    d.setDate(d.getDate() - idx);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function slugKey(s) {
    return String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function markSymbol(v) {
    if (v === "OK") return "✓";
    if (v === "DEFECT") return "X";
    if (v === "NA") return "N/A";
    return "";
  }

  function cycleMark(v) {
    // "" -> OK -> DEFECT -> NA -> ""
    if (!v) return "OK";
    if (v === "OK") return "DEFECT";
    if (v === "DEFECT") return "NA";
    return "";
  }

  function setStatus(msg, ok = true) {
    const s = el("status");
    if (!s) return;
    s.textContent = (ok ? "✅ " : "❌ ") + msg;
  }

  // ---------- checklists (edit these whenever you want) ----------
  const CHECKLISTS = {
    excavator: [
      "BUCKET – Excessive wear or damage, cracks",
      "BUCKET CYLINDER & LINKAGE – Excessive wear or damage, leaks",
      "STICK – Excessive wear or damage, cracks",
      "BOOM CYLINDERS – Excessive wear or damage, leaks",
      "UNDERNEATH OF MACHINE FINAL DRIVE – Damage, leaks",
      "CAB – Damage, cracks",
      "UNDERCARRIAGE – Wear, damage, tension",
      "STEPS & HANDHOLDS – Condition & cleanliness",
      "BATTERIES & HOLD DOWNS – Cleanliness, loose bolts/nuts",
      "AIR FILTER – Restriction indicator",
      "WINDSHIELD WIPERS & WASHERS – Wear, damage, fluid level",
      "ENGINE COOLANT – Fluid level",
      "RADIATOR – Fin blockage, leaks",
      "HYDRAULIC OIL TANK – Fluid level, damage, leaks",
      "FUEL TANK – Fluid level, damage, leaks",
      "FIRE EXTINGUISHER – Present/charged, damage",
      "LIGHTS – Damage / working",
      "MIRRORS – Adjusted for best visibility",
      "FUEL WATER SEPARATOR – Drain",
      "OVERALL MACHINE – Missing nuts/bolts/guards, cleanliness",
      "SWING GEAR OIL LEVEL – Fluid level",
      "ENGINE OIL – Fluid level",
      "ALL HOSES – Cracks, wear spots, leaks",
      "ALL BELTS – Tension, wear, cracks",
      "OVERALL ENGINE COMPARTMENT – Rubbish, dirt, leaks",
      "SEAT – Adjustment",
      "SEAT BELT & MOUNTING – Damage, wear, adjustment",
      "INDICATORS & GAUGES – Check, test",
      "HORN / BACKUP ALARM / LIGHTS – Proper function",
      "OVERALL CAB INTERIOR – Cleanliness"
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
      "Walkaround – leaks / damage",
      "Brakes – service & park brake",
      "Steering – play / function",
      "Tyres – condition / pressure",
      "Horn / beacon / lights – working",
      "Mirrors / camera – clean & working",
      "Seatbelt – condition & working",
      "Hydraulic rams – leaks / damage",
      "Body tip – smooth operation",
      "Reversing alarm – working",
      "Fire extinguisher – present & charged"
    ]
  };

  // ---------- state ----------
  const state = {
    token: "",
    type: "excavator",
    dateISO: "",
    weekStartISO: "",
    activeDay: 0, // Mon=0..Sun=6
    checks: {},   // itemKey -> [7]
    sigDirty: false,
  };

  function storageKey() {
    const token = state.token || "no_token";
    const plantId = (el("plantId")?.value || "").trim() || "no_plant";
    return `plantchecks:${token}:${state.type}:${plantId}:${state.weekStartISO}`;
  }

  function blankChecksForType(type) {
    const out = {};
    for (const item of CHECKLISTS[type]) {
      out[slugKey(item)] = ["", "", "", "", "", "", ""];
    }
    return out;
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj && obj.checks) state.checks = obj.checks;

      // restore form fields if present
      if (obj.site) el("site").value = obj.site;
      if (obj.operator) el("operator").value = obj.operator;
      if (obj.hours) el("hours").value = obj.hours;
      if (obj.defectsText) el("defectsText").value = obj.defectsText;
      if (obj.actionTaken) el("actionTaken").value = obj.actionTaken;

      // signature restore (optional)
      if (obj.signatureDataUrl) drawSignatureFromDataUrl(obj.signatureDataUrl);

    } catch (e) {
      // ignore broken draft
    }
  }

  let saveTimer = null;
  function saveDraftSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const obj = {
          type: state.type,
          dateISO: state.dateISO,
          weekStartISO: state.weekStartISO,
          checks: state.checks,
          site: el("site").value,
          operator: el("operator").value,
          hours: el("hours").value,
          defectsText: el("defectsText").value,
          actionTaken: el("actionTaken").value,
          signatureDataUrl: getSignatureDataUrl() || ""
        };
        localStorage.setItem(storageKey(), JSON.stringify(obj));
      } catch (e) { /* ignore */ }
    }, 250);
  }

  // ---------- UI: type ----------
  function setType(type) {
    state.type = type;

    el("btnExc").classList.toggle("active", type === "excavator");
    el("btnCrane").classList.toggle("active", type === "crane");
    el("btnDump").classList.toggle("active", type === "dumper");

    el("selectedType").textContent = `Selected: ${type[0].toUpperCase() + type.slice(1)}`;

    const titleMap = {
      excavator: "Excavator Pre use Inspection Checklist",
      crane: "Crane Pre use Inspection Checklist",
      dumper: "Dumper Pre use Inspection Checklist"
    };
    el("sheetTitle").textContent = titleMap[type];

    // reset checks to blank for this type then load draft (if exists)
    state.checks = blankChecksForType(type);
    loadDraft();
    renderTable();
    saveDraftSoon();
  }

  // ---------- UI: table ----------
  function renderTable() {
    const body = el("checksBody");
    body.innerHTML = "";

    const list = CHECKLISTS[state.type];
    for (const item of list) {
      const key = slugKey(item);

      // ensure exists
      if (!state.checks[key]) state.checks[key] = ["", "", "", "", "", "", ""];

      const tr = document.createElement("tr");

      const tdItem = document.createElement("td");
      tdItem.className = "item";
      tdItem.textContent = item;
      tr.appendChild(tdItem);

      for (let d = 0; d < 7; d++) {
        const td = document.createElement("td");
        td.className = "day " + (d === state.activeDay ? "active" : "inactive");

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "markBtn";
        btn.dataset.itemKey = key;
        btn.dataset.day = String(d);
        btn.textContent = markSymbol(state.checks[key][d]);
        btn.disabled = (d !== state.activeDay);

        btn.addEventListener("click", () => {
          const cur = state.checks[key][d];
          const next = cycleMark(cur);
          state.checks[key][d] = next;
          btn.textContent = markSymbol(next);
          saveDraftSoon();
        });

        td.appendChild(btn);
        tr.appendChild(td);
      }

      body.appendChild(tr);
    }
  }

  // ---------- Signature canvas ----------
  const sig = {
    canvas: null,
    ctx: null,
    drawing: false,
    lastX: 0,
    lastY: 0
  };

  function resizeCanvas() {
    const c = sig.canvas;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * ratio);
    c.height = Math.round(rect.height * ratio);
    sig.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    sig.ctx.lineWidth = 2;
    sig.ctx.lineCap = "round";
    sig.ctx.strokeStyle = "#000";
  }

  function canvasPos(e) {
    const rect = sig.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    return { x, y };
  }

  function sigStart(e) {
    sig.drawing = true;
    const p = canvasPos(e);
    sig.lastX = p.x; sig.lastY = p.y;
  }

  function sigMove(e) {
    if (!sig.drawing) return;
    const p = canvasPos(e);
    sig.ctx.beginPath();
    sig.ctx.moveTo(sig.lastX, sig.lastY);
    sig.ctx.lineTo(p.x, p.y);
    sig.ctx.stroke();
    sig.lastX = p.x; sig.lastY = p.y;
    state.sigDirty = true;
  }

  function sigEnd() {
    if (!sig.drawing) return;
    sig.drawing = false;
    saveDraftSoon();
  }

  function clearSignature() {
    sig.ctx.clearRect(0, 0, sig.canvas.width, sig.canvas.height);
    state.sigDirty = false;
    saveDraftSoon();
  }

  function getSignatureDataUrl() {
    // If the user never drew, return empty (keeps emails clean)
    if (!state.sigDirty) return "";
    return sig.canvas.toDataURL("image/png");
  }

  function drawSignatureFromDataUrl(dataUrl) {
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      // clear + draw scaled
      sig.ctx.clearRect(0, 0, sig.canvas.width, sig.canvas.height);
      const rect = sig.canvas.getBoundingClientRect();
      sig.ctx.drawImage(img, 0, 0, rect.width, rect.height);
      state.sigDirty = true;
    };
    img.src = dataUrl;
  }

  // ---------- PDF generation ----------
  const imgCache = new Map();

  async function getImageDataUrl(url) {
    if (imgCache.has(url)) return imgCache.get(url);
    try {
      const res = await fetch(url, { cache: "no-store" });
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.readAsDataURL(blob);
      });
      imgCache.set(url, dataUrl);
      return dataUrl;
    } catch {
      return "";
    }
  }

  function pdfToBase64(doc) {
    const ab = doc.output("arraybuffer");
    const bytes = new Uint8Array(ab);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function makePdf(payload) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10;

    const atl = await getImageDataUrl("assets/atl-logo.png");
    const tp = await getImageDataUrl("assets/tp.png");

    function header(yTop, small = false) {
      const logoH = small ? 10 : 14;
      const tpW = small ? 14 : 18;

      if (atl) doc.addImage(atl, "PNG", margin, yTop, 45, logoH);
      if (tp) doc.addImage(tp, "PNG", pageW - margin - tpW, yTop, tpW, tpW);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(small ? 10 : 12);
      doc.text("QPFPL5.2", pageW / 2, yTop + 6, { align: "center" });

      doc.setFontSize(small ? 9 : 11);
      doc.text(payload.title, pageW / 2, yTop + 14, { align: "center" });

      // meta line
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      doc.text(`Machine No: ${payload.plantId || "-"}`, margin, yTop + 22);
      doc.text(`Week commencing: ${payload.weekCommencing || "-"}`, pageW - margin, yTop + 22, { align: "right" });

      // yellow bar
      doc.setFillColor(255, 214, 0);
      doc.rect(margin, yTop + 25, pageW - margin * 2, 8, "F");
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("All checks must be carried out in line with Specific Manufacturer’s instructions", pageW / 2, yTop + 31, { align: "center" });

      // reset
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
    }

    // Build title
    const titleMap = {
      excavator: "Excavator Pre use Inspection Checklist",
      crane: "Crane Pre use Inspection Checklist",
      dumper: "Dumper Pre use Inspection Checklist"
    };

    payload.title = titleMap[payload.type] || "Plant Pre use Inspection Checklist";

    // draw first header
    header(6, false);

    // fields
    const infoY = 45;
    doc.setFontSize(9);
    doc.text(`Site: ${payload.site || "-"}`, margin, infoY);
    doc.text(`Date: ${isoToUK(payload.dateISO) || "-"}`, pageW / 2, infoY);
    doc.text(`Operator: ${payload.operator || "-"}`, pageW - margin, infoY, { align: "right" });

    doc.text(`Hours/Shift: ${payload.hours || "-"}`, margin, infoY + 6);
    doc.text(`Token: ${payload.token || "-"}`, pageW - margin, infoY + 6, { align: "right" });

    // table sizes
    const tableX = margin;
    const tableYStart = infoY + 12;
    const itemW = 120;
    const dayW = (pageW - margin * 2 - itemW) / 7;
    const rowH = 7;

    function drawTableHeader(y) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);

      doc.setFillColor(255, 214, 0);
      doc.rect(tableX, y, itemW, rowH, "F");
      doc.setDrawColor(0);
      doc.rect(tableX, y, itemW, rowH);

      // days header
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      for (let i = 0; i < 7; i++) {
        const x = tableX + itemW + i * dayW;
        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, dayW, rowH, "F");
        doc.rect(x, y, dayW, rowH);
        doc.text(days[i], x + dayW / 2, y + 4.8, { align: "center" });
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
    }

    function drawRow(y, itemText, marksArr) {
      // item cell
      doc.rect(tableX, y, itemW, rowH);
      doc.text(itemText, tableX + 2, y + 4.8, { maxWidth: itemW - 4 });

      // days cells
      for (let i = 0; i < 7; i++) {
        const x = tableX + itemW + i * dayW;
        doc.rect(x, y, dayW, rowH);

        const st = marksArr?.[i] || "";
        const sym = st === "OK" ? "✓" : (st === "DEFECT" ? "X" : (st === "NA" ? "N/A" : ""));
        if (sym) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text(sym, x + dayW / 2, y + 4.9, { align: "center" });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
        }
      }
    }

    // get list + marks
    const list = CHECKLISTS[payload.type] || [];
    let y = tableYStart;

    drawTableHeader(y);
    y += rowH;

    for (const item of list) {
      if (y > pageH - 60) {
        doc.addPage();
        header(6, true);
        y = 40;
        drawTableHeader(y);
        y += rowH;
      }
      const key = slugKey(item);
      drawRow(y, item, payload.checks[key] || ["", "", "", "", "", "", ""]);
      y += rowH;
    }

    // footer boxes
    const footerY = Math.max(y + 6, pageH - 55);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Defects identified:", margin, footerY);
    doc.rect(margin, footerY + 3, pageW - margin * 2, 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(payload.defectsText ? payload.defectsText : "None", margin + 2, footerY + 10, { maxWidth: pageW - margin * 2 - 4 });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Reported to / action taken:", margin, footerY + 22);
    doc.rect(margin, footerY + 25, pageW - margin * 2, 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(payload.actionTaken ? payload.actionTaken : "", margin + 2, footerY + 32, { maxWidth: pageW - margin * 2 - 4 });

    // signature block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Signature:", margin, footerY + 44);
    doc.rect(margin, footerY + 47, pageW - margin * 2, 18);

    if (payload.signatureDataUrl && payload.signatureDataUrl.startsWith("data:image")) {
      try {
        doc.addImage(payload.signatureDataUrl, "PNG", margin + 2, footerY + 48, 80, 16);
      } catch {}
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Submitted: ${new Date().toISOString()}`, margin, pageH - 6);

    return doc;
  }

  // ---------- submit ----------
  async function submit() {
    try {
      const token = state.token;
      if (!token) throw new Error("Missing token (URL needs ?t=YOURTOKEN)");
      const plantId = (el("plantId").value || "").trim();
      if (!plantId) throw new Error("Please enter Machine / Plant ID");
      if (!state.type) throw new Error("Select Excavator / Crane / Dumper");
      if (!state.dateISO) throw new Error("Please pick a date");

      const payload = {
        token,
        type: state.type,
        site: el("site").value || "",
        dateISO: state.dateISO,
        weekCommencing: state.weekStartISO,
        plantId,
        operator: el("operator").value || "",
        hours: el("hours").value || "",
        defectsText: el("defectsText").value || "",
        actionTaken: el("actionTaken").value || "",
        signatureDataUrl: getSignatureDataUrl(),
        checks: state.checks
      };

      el("submitBtn").disabled = true;
      setStatus("Creating PDF…");

      const doc = await makePdf(payload);
      const pdfBase64 = pdfToBase64(doc);

      setStatus("Sending email…");

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, payload, pdfBase64 })
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.error || "Submit failed");

      setStatus("Sent successfully.");
      // keep draft (so next day shows previous) — or clear if you prefer:
      // localStorage.removeItem(storageKey());

    } catch (e) {
      setStatus(e.message || String(e), false);
    } finally {
      el("submitBtn").disabled = false;
    }
  }

  // ---------- init ----------
  function updateDateStuff() {
    state.dateISO = el("date").value || "";
    if (!state.dateISO) return;

    state.weekStartISO = weekCommencingMondayISO(state.dateISO);
    state.activeDay = dayIndexFromISO(state.dateISO);

    el("weekCommencingPreview").textContent = isoToUK(state.weekStartISO);
    renderTable();
    loadDraft();     // load the correct week draft
    renderTable();
    saveDraftSoon();
  }

  function updateMachinePreview() {
    el("machineNoPreview").textContent = (el("plantId").value || "").trim() || "—";
    saveDraftSoon();
  }

  function wireInputsAutosave() {
    ["site", "operator", "hours", "defectsText", "actionTaken"].forEach(id => {
      el(id).addEventListener("input", saveDraftSoon);
    });
    el("plantId").addEventListener("input", updateMachinePreview);
  }

  function init() {
    // show JS errors in status
    window.addEventListener("error", (e) => {
      setStatus("JS error: " + (e.message || "unknown"), false);
    });

    state.token = qs("t");
    el("tokenPreview").textContent = "Token: " + (state.token || "—");

    // default date
    el("date").value = todayISO();

    // signature setup
    sig.canvas = el("sig");
    sig.ctx = sig.canvas.getContext("2d");
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    sig.canvas.addEventListener("pointerdown", (e) => { sig.canvas.setPointerCapture(e.pointerId); sigStart(e); });
    sig.canvas.addEventListener("pointermove", sigMove);
    sig.canvas.addEventListener("pointerup", sigEnd);
    sig.canvas.addEventListener("pointercancel", sigEnd);

    el("clearSig").addEventListener("click", clearSignature);
    el("fillToday").addEventListener("click", () => {
      el("date").value = todayISO();
      updateDateStuff();
    });

    // type buttons
    el("btnExc").addEventListener("click", () => setType("excavator"));
    el("btnCrane").addEventListener("click", () => setType("crane"));
    el("btnDump").addEventListener("click", () => setType("dumper"));

    // date change
    el("date").addEventListener("change", updateDateStuff);

    // submit
    el("submitBtn").addEventListener("click", submit);

    // autosave
    wireInputsAutosave();

    // initialise type + date/table
    setType("excavator");
    updateDateStuff();
    updateMachinePreview();

    setStatus("Ready.");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
