/* public/app.js */
(() => {
  const BUILD = "v10";

  // -------- checklist labels ----------
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
      "FIRE EXTINGUISHER, Present/charged, Damage",
      "LIGHTS, Damage / working",
      "MIRRORS, Adjusted for Best Visibility",
      "FUEL WATER SEPARATOR, Drain",
      "OVERALL MACHINE, Loose or Missing Nuts & Bolts, Loose Guards, Cleanliness",
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
      "Steering – smooth operation",
      "Brakes – effective",
      "Lights / indicators – working",
      "Horn / alarm – working",
      "Mirrors – condition & adjusted",
      "ROPS / cab – condition",
      "Seat belt – condition",
      "Body / skip – damage / pins secure",
      "Hydraulics – leaks / operation"
    ]
  };

  // -------- DOM ----------
  const el = (id) => document.getElementById(id);

  // -------- URL params ----------
  const qs = new URLSearchParams(location.search);
  const TOKEN = qs.get("t") || "";
  const initialType = (qs.get("type") || "excavator").toLowerCase();
  const initialPlantId = qs.get("plantId") || "";
  const initialDate = qs.get("date") || "";

  // -------- state ----------
  let equipmentType = ["excavator", "crane", "dumper"].includes(initialType) ? initialType : "excavator";
  let labels = [...CHECKLISTS[equipmentType]];
  let weekStatuses = labels.map(() => Array(7).fill(null));
  let activeDay = 0;

  // -------- date helpers ----------
  function isoToday() {
    const d = new Date();
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }
  function isoToUK(iso) {
    if (!iso || !String(iso).includes("-")) return iso || "";
    const [y, m, d] = String(iso).split("-");
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
    return day === 0 ? 6 : day - 1;
  }

  // -------- status cycle ----------
  function cycleStatus(cur) {
    if (!cur) return "OK";
    if (cur === "OK") return "DEFECT";
    if (cur === "DEFECT") return "NA";
    return null;
  }
  function markText(status) {
    if (status === "OK") return "✓";
    if (status === "DEFECT") return "X";
    if (status === "NA") return "N/A";
    return "";
  }

  // -------- network (with timeout) ----------
  async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 25000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      const text = await resp.text();
      let data = {};
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return { resp, data };
    } finally {
      clearTimeout(t);
    }
  }

  // -------- header UI ----------
  function setButtonsActive() {
    el("btnExc").classList.toggle("active", equipmentType === "excavator");
    el("btnCrane").classList.toggle("active", equipmentType === "crane");
    el("btnDump").classList.toggle("active", equipmentType === "dumper");
  }

  function setHeaderTexts() {
    el("buildTag").textContent = `BUILD: ${BUILD}`;
    el("selectedType").textContent = `Selected: ${equipmentType.charAt(0).toUpperCase()}${equipmentType.slice(1)}`;

    const title =
      equipmentType === "excavator" ? "Excavator Pre-Use Inspection Checklist" :
      equipmentType === "crane" ? "Crane Pre-Use Inspection Checklist" :
      "Dumper Pre-Use Inspection Checklist";

    el("sheetTitle").textContent = title;

    const dateISO = el("date").value || isoToday();
    const weekISO = getWeekCommencingISO(dateISO);
    el("weekCommencingPreview").textContent = isoToUK(weekISO);

    const pid = (el("plantId").value || "").trim();
    el("machineNoPreview").textContent = pid || "—";
  }

  function isMobileView() {
    return window.matchMedia("(max-width: 760px)").matches;
  }

  // -------- render desktop table ----------
  function renderTable() {
    const dateISO = el("date").value || isoToday();
    activeDay = getDayIndexMon0(dateISO);

    const tbody = el("checksBody");
    tbody.innerHTML = "";

    labels.forEach((label, r) => {
      const tr = document.createElement("tr");

      const tdItem = document.createElement("td");
      tdItem.className = "item";
      tdItem.textContent = label;
      tr.appendChild(tdItem);

      for (let d = 0; d < 7; d++) {
        const td = document.createElement("td");

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "markBtn";
        btn.dataset.r = String(r);
        btn.dataset.d = String(d);

        const status = weekStatuses?.[r]?.[d] || null;
        btn.textContent = markText(status);

        if (d !== activeDay) {
          btn.classList.add("disabled");
        } else {
          btn.classList.add("activeDay");
        }

        td.appendChild(btn);
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    });
  }

  // -------- render mobile list ----------
  function renderMobileList() {
    const dateISO = el("date").value || isoToday();
    activeDay = getDayIndexMon0(dateISO);

    const wrap = el("mobileChecks");
    wrap.innerHTML = "";

    labels.forEach((label, r) => {
      const row = document.createElement("div");
      row.className = "mobileRow";

      const lab = document.createElement("div");
      lab.className = "mobileLabel";
      lab.textContent = label;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mobileBtn";
      btn.textContent = markText(weekStatuses?.[r]?.[activeDay]);

      btn.addEventListener("click", () => {
        const cur = weekStatuses?.[r]?.[activeDay] || null;
        const next = cycleStatus(cur);
        weekStatuses[r][activeDay] = next;
        btn.textContent = markText(next);
        if (!isMobileView()) renderTable();
      });

      row.appendChild(lab);
      row.appendChild(btn);
      wrap.appendChild(row);
    });
  }

  function renderChecks() {
    if (isMobileView()) renderMobileList();
    else renderTable();
  }

  // -------- signature pad ----------
  function initSignature() {
    const canvas = el("sig");
    const ctx = canvas.getContext("2d");
    let drawing = false;
    let last = null;

    function resize() {
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.floor(w * ratio);
      canvas.height = Math.floor(h * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#111";
    }
    resize();
    window.addEventListener("resize", resize);

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      return { x, y };
    }

    function start(e) { drawing = true; last = pos(e); e.preventDefault(); }
    function move(e) {
      if (!drawing) return;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      e.preventDefault();
    }
    function end() { drawing = false; last = null; }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);

    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);

    el("clearSig").addEventListener("click", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    el("fillToday").addEventListener("click", () => {
      el("date").value = isoToday();
      setHeaderTexts();
      loadWeekFromKV();
    });
  }

  function signatureDataUrl() {
    const canvas = el("sig");

    // detect blank
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tctx = tmp.getContext("2d");
    tctx.drawImage(canvas, 0, 0);
    const pixels = tctx.getImageData(0, 0, tmp.width, tmp.height).data;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] !== 0) return canvas.toDataURL("image/png");
    }
    return "";
  }

  // -------- API: load week ----------
  async function loadWeekFromKV() {
    const status = el("status");
    const plantId = (el("plantId").value || "").trim();
    const dateISO = el("date").value || "";

    setHeaderTexts();

    if (!TOKEN) {
      status.textContent = "⚠️ Missing token (t=...) in link.";
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      renderChecks();
      return;
    }

    if (!plantId || !dateISO) {
      status.textContent = "Enter Plant ID + Date.";
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      renderChecks();
      return;
    }

    const url =
      `/api/week?t=${encodeURIComponent(TOKEN)}` +
      `&type=${encodeURIComponent(equipmentType)}` +
      `&plantId=${encodeURIComponent(plantId)}` +
      `&date=${encodeURIComponent(dateISO)}`;

    status.textContent = "Loading week…";

    try {
      const { resp, data } = await fetchJsonWithTimeout(url, { cache: "no-store" }, 15000);

      if (!resp.ok) {
        status.textContent = `❌ Load failed (${resp.status}): ${data.error || resp.statusText || "Unknown"}`;
        labels = [...CHECKLISTS[equipmentType]];
        weekStatuses = labels.map(() => Array(7).fill(null));
        renderChecks();
        return;
      }

      const record = data.record || null;

      if (record && Array.isArray(record.labels) && Array.isArray(record.statuses)) {
        labels = record.labels;
        weekStatuses = record.statuses;
        status.textContent = "✅ Week loaded.";
      } else {
        labels = [...CHECKLISTS[equipmentType]];
        weekStatuses = labels.map(() => Array(7).fill(null));
        status.textContent = "✅ New week record (empty).";
      }

      renderChecks();
    } catch (e) {
      status.textContent = `❌ Load error: ${e?.name === "AbortError" ? "Timeout" : (e?.message || "Unknown")}`;
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      renderChecks();
    }
  }

  // -------- PDF generation (ONE page, tick drawn as lines) ----------
  async function makePdfBase64(payload) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

    const margin = 26;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

    const isoToUKLocal = (iso) => isoToUK(iso);

    function ellipsize(text, maxW, fontSize) {
      if (!text) return "";
      doc.setFontSize(fontSize);
      let t = String(text);
      while (t.length > 0 && doc.getTextWidth(t) > maxW) t = t.slice(0, -1);
      return (t.length < String(text).length) ? (t.slice(0, -1) + "…") : t;
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

    function roundRect(x, y, w, h, r) {
      doc.roundedRect(x, y, w, h, r, r);
    }

    function drawTick(x, y, w, h) {
      // vector tick inside box (so it ALWAYS shows, no font issues)
      doc.setLineWidth(1.2);
      doc.line(x + w*0.25, y + h*0.55, x + w*0.45, y + h*0.75);
      doc.line(x + w*0.45, y + h*0.75, x + w*0.78, y + h*0.30);
    }

    function drawX(x, y, w, h) {
      doc.setLineWidth(1.2);
      doc.line(x + w*0.25, y + h*0.25, x + w*0.75, y + h*0.75);
      doc.line(x + w*0.75, y + h*0.25, x + w*0.25, y + h*0.75);
    }

    function drawMarkPill(cx, cy, status) {
      // “pill” like your on-screen boxes
      const pillW = 18;
      const pillH = 11;
      const x = cx - pillW/2;
      const y = cy - pillH/2;

      doc.setDrawColor(190);
      doc.setLineWidth(0.9);
      roundRect(x, y, pillW, pillH, 4);

      doc.setDrawColor(0);
      if (status === "OK") {
        drawTick(x, y, pillW, pillH);
      } else if (status === "DEFECT") {
        drawX(x, y, pillW, pillH);
      } else if (status === "NA") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.text("N/A", cx, cy + 2.2, { align: "center" });
      }
    }

    // ---------- data ----------
    const dateISO = payload.date || "";
    const weekISO = payload.weekCommencing || "";
    const dateUK = isoToUKLocal(dateISO);
    const weekUK = isoToUKLocal(weekISO);

    const labels = payload.labels || [];
    const statuses = payload.weekStatuses || [];

    // ---------- layout ----------
    let y = margin;

    // Logos + header (fixed sizes so no stretching)
    const atl = await fetchAsDataUrl("/assets/atl-logo.png");
    const tp  = await fetchAsDataUrl("/assets/tp.png");

    if (atl) {
      try {
        const { w: iw, h: ih } = await getImageSize(atl);
        const fitted = fitIntoBox(iw, ih, 150, 38);
        doc.addImage(atl, "PNG", margin, y - 2, fitted.w, fitted.h);
      } catch {}
    }

    if (tp) {
      try {
        const { w: iw, h: ih } = await getImageSize(tp);
        const fitted = fitIntoBox(iw, ih, 55, 55);
        doc.addImage(tp, "PNG", pageW - margin - fitted.w, y - 6, fitted.w, fitted.h);
      } catch {}
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(String(payload.formRef || "QPFPL5.2"), pageW/2, y + 12, { align: "center" });

    doc.setFontSize(10);
    doc.text(String(payload.sheetTitle || ""), pageW/2, y + 28, { align: "center" });

    y += 46;

    // Machine + Week
    doc.setFontSize(9);
    doc.text(`Machine No: ${payload.machineNo || ""}`, margin, y);
    doc.text(`Week commencing: ${weekUK}`, pageW - margin, y, { align: "right" });
    y += 12;

    // Yellow bar
    doc.setFillColor(255, 214, 0);
    doc.rect(margin, y, pageW - margin*2, 18, "F");
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.7);
    doc.text(
      "All checks must be carried out in line with Specific Manufacturer’s instructions",
      pageW/2, y + 12.5, { align: "center" }
    );
    y += 28;

    // Meta line
    doc.setFontSize(9);
    doc.text(`Site: ${payload.site || ""}`, margin, y);
    doc.text(`Date: ${dateUK}`, margin + 190, y);
    doc.text(`Operator: ${payload.operator || ""}`, margin + 320, y);
    doc.text(`Hours/Shift: ${payload.hours || ""}`, pageW - margin, y, { align: "right" });
    y += 16;

    // Table geometry
    const tableX = margin;
    const tableW = pageW - margin*2;
    const itemColW = 360;
    const dayColW = (tableW - itemColW) / 7;
    const headH = 16;

    // Footer sizes (smaller as you asked)
    const defectsH = 30;
    const actionH  = 30;
    const sigH     = 38;

    const footerTotal =
      12 +                       // checks carried out by
      10 + defectsH + 14 +       // defects label + box + gap
      10 + actionH  + 14 +       // action label + box + gap
      10 + sigH + 22;            // signature label + box + bottom

    // Choose row height to force ONE PAGE
    const availForRows = (pageH - margin) - y - headH - footerTotal;
    const rowH = Math.max(9, Math.min(14, Math.floor(availForRows / Math.max(1, labels.length))));

    // Table header
    doc.setDrawColor(0);
    doc.setLineWidth(0.8);

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
      const cx = tableX + itemColW + dayColW*i + dayColW/2;
      doc.text(days[i], cx, y + 11, { align:"center" });
    }

    y += headH;

    // Table rows
    for (let r = 0; r < labels.length; r++) {
      doc.rect(tableX, y, tableW, rowH);
      doc.line(tableX + itemColW, y, tableX + itemColW, y + rowH);
      for (let i = 1; i < 7; i++) {
        const xx = tableX + itemColW + dayColW*i;
        doc.line(xx, y, xx, y + rowH);
      }

      // label
      doc.setFont("helvetica", "normal");
      const fontItem = rowH <= 10 ? 6.6 : 7.2;
      const label = ellipsize(labels[r], itemColW - 10, fontItem);
      doc.text(label, tableX + 6, y + rowH*0.72);

      // marks -> pill boxes like UI
      for (let d = 0; d < 7; d++) {
        const status = statuses?.[r]?.[d] || null;
        if (!status) continue;
        const cx = tableX + itemColW + dayColW*d + dayColW/2;
        const cy = y + rowH/2 + 0.5;
        drawMarkPill(cx, cy, status);
      }

      y += rowH;
    }

    y += 10;

    // Footer blocks
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Checks carried out by: ${payload.operator || ""}`, margin, y);
    y += 12;

    // Defects
    doc.text("Defects identified:", margin, y);
    y += 6;
    doc.rect(margin, y, pageW - margin*2, defectsH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    if (payload.defectsText) doc.text(payload.defectsText, margin + 6, y + 14, { maxWidth: pageW - margin*2 - 12 });
    y += defectsH + 14;

    // Action
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Reported to / action taken:", margin, y);
    y += 6;
    doc.rect(margin, y, pageW - margin*2, actionH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    if (payload.actionTaken) doc.text(payload.actionTaken, margin + 6, y + 14, { maxWidth: pageW - margin*2 - 12 });
    y += actionH + 14;

    // Signature (smaller + centered)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Signature:", margin, y);
    y += 6;

    const sigBoxW = pageW - margin*2;
    doc.rect(margin, y, sigBoxW, sigH);

    if (payload.signatureDataUrl && payload.signatureDataUrl.startsWith("data:image")) {
      try {
        const pad = 5;
        const innerW = sigBoxW - pad*2;
        const innerH = sigH - pad*2;
        const { w: iw, h: ih } = await getImageSize(payload.signatureDataUrl);
        const fitted = fitIntoBox(iw, ih, innerW, innerH);
        const imgX = margin + pad + (innerW - fitted.w)/2;
        const imgY = y + pad + (innerH - fitted.h)/2;
        doc.addImage(payload.signatureDataUrl, "PNG", imgX, imgY, fitted.w, fitted.h);
      } catch {}
    }

    // Footer text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Submitted: ${new Date().toISOString()}`, margin, pageH - 16);
    doc.text(`BUILD: ${BUILD}`, pageW/2, pageH - 16, { align:"center" });

    const dataUri = doc.output("datauristring");
    const parts = String(dataUri).split(",");
    if (parts.length < 2) throw new Error("PDF export failed");
    return parts[1];
  }

  // -------- submit ----------
  async function submit() {
    const status = el("status");
    status.textContent = "Generating PDF…";

    const dateISO = el("date").value || "";
    const weekISO = dateISO ? getWeekCommencingISO(dateISO) : "";

    const payload = {
      build: BUILD,
      equipmentType,
      formRef: el("formRef").textContent || "QPFPL5.2",
      sheetTitle: el("sheetTitle").textContent || "",
      machineNo: (el("plantId").value || "").trim(),
      weekCommencing: weekISO,

      site: (el("site").value || "").trim(),
      date: dateISO,
      plantId: (el("plantId").value || "").trim(),
      operator: (el("operator").value || "").trim(),
      hours: (el("hours").value || "").trim(),

      labels,
      weekStatuses,

      defectsText: (el("defectsText").value || "").trim(),
      actionTaken: (el("actionTaken").value || "").trim(),
      signatureDataUrl: signatureDataUrl()
    };

    if (!TOKEN) { status.textContent = "❌ Missing token (t=...) in link."; return; }
    if (!payload.plantId || !payload.date) { status.textContent = "❌ Please enter Plant ID and Date."; return; }

    let pdfBase64 = "";
    try {
      pdfBase64 = await makePdfBase64(payload);
    } catch (e) {
      status.textContent = "❌ PDF failed: " + (e?.message || "unknown");
      return;
    }

    status.textContent = "Sending email…";

    try {
      const { resp, data } = await fetchJsonWithTimeout(
        "/api/submit",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: TOKEN, payload, pdfBase64 })
        },
        30000
      );

      if (!resp.ok) {
        status.textContent =
          `❌ Send failed (${resp.status}): ${data.error || resp.statusText || "Unknown"}`
          + (data.details ? ` | ${typeof data.details === "string" ? data.details : JSON.stringify(data.details)}` : "");
        return;
      }

      status.textContent = "✅ Sent successfully.";
    } catch (e) {
      status.textContent =
        "❌ Send error: " +
        (e?.name === "AbortError" ? "Timeout (server took too long)" : (e?.message || "Unknown"));
    }
  }

  // -------- events ----------
  function bindEvents() {
    el("btnExc").addEventListener("click", () => {
      equipmentType = "excavator";
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      setButtonsActive(); setHeaderTexts(); loadWeekFromKV();
    });
    el("btnCrane").addEventListener("click", () => {
      equipmentType = "crane";
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      setButtonsActive(); setHeaderTexts(); loadWeekFromKV();
    });
    el("btnDump").addEventListener("click", () => {
      equipmentType = "dumper";
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      setButtonsActive(); setHeaderTexts(); loadWeekFromKV();
    });

    el("date").addEventListener("change", () => { setHeaderTexts(); loadWeekFromKV(); });
    el("plantId").addEventListener("change", () => { setHeaderTexts(); loadWeekFromKV(); });
    el("plantId").addEventListener("input", () => { setHeaderTexts(); });

    // Desktop click (only active day)
    el("checksBody").addEventListener("click", (e) => {
      const btn = e.target.closest("button.markBtn");
      if (!btn) return;

      const dateISO = el("date").value || isoToday();
      activeDay = getDayIndexMon0(dateISO);

      const r = Number(btn.dataset.r);
      const d = Number(btn.dataset.d);
      if (d !== activeDay) return; // only today's column

      const cur = weekStatuses?.[r]?.[d] || null;
      const next = cycleStatus(cur);
      weekStatuses[r][d] = next;
      btn.textContent = markText(next);

      if (isMobileView()) renderMobileList();
    });

    window.addEventListener("resize", () => renderChecks());
    el("submitBtn").addEventListener("click", submit);
  }

  // -------- init ----------
  function init() {
    el("buildTag").textContent = `BUILD: ${BUILD}`;
    el("date").value = initialDate || isoToday();
    el("plantId").value = initialPlantId;

    setButtonsActive();
    setHeaderTexts();
    initSignature();
    bindEvents();
    loadWeekFromKV();
  }

  init();
})();
