/* public/app.js */
(() => {
  const BUILD = "v12";
  const $ = (id) => document.getElementById(id);

  // ✅ EDIT THIS LIST (names + emails). The selected one will receive the email.
  const RECIPIENTS = [
    { name: "Site Agent", email: "site.agent@example.com" },
    { name: "Gary", email: "gary@example.com" },
    { name: "John", email: "john@example.com" }
  ];

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

  const qs = new URLSearchParams(location.search);
  const TOKEN = qs.get("t") || "";

  let equipmentType = (qs.get("type") || "excavator").toLowerCase();
  if (!["excavator","crane","dumper"].includes(equipmentType)) equipmentType = "excavator";

  let labels = [...CHECKLISTS[equipmentType]];
  let weekStatuses = labels.map(() => Array(7).fill(null));
  let activeDay = 0;

  const isoToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };

  const isoToUK = (iso) => {
    if (!iso || !String(iso).includes("-")) return iso || "";
    const [y,m,d] = String(iso).split("-");
    return `${d}/${m}/${y}`;
  };

  const getWeekCommencingISO = (dateStr) => {
    const [y,m,d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m-1, d);
    const day = dt.getDay();
    const diffToMon = (day === 0 ? -6 : 1 - day);
    dt.setDate(dt.getDate() + diffToMon);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
  };

  const getDayIndexMon0 = (dateStr) => {
    const [y,m,d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m-1, d);
    const day = dt.getDay();
    return day === 0 ? 6 : day - 1;
  };

  const cycleStatus = (cur) => {
    if (!cur) return "OK";
    if (cur === "OK") return "DEFECT";
    if (cur === "DEFECT") return "NA";
    return null;
  };

  const markText = (status) => {
    if (status === "OK") return "✓";
    if (status === "DEFECT") return "X";
    if (status === "NA") return "N/A";
    return "";
  };

  const isMobile = () => window.matchMedia("(max-width: 760px)").matches;

  async function fetchJson(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      const txt = await resp.text();
      let data = {};
      try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
      return { resp, data };
    } finally {
      clearTimeout(t);
    }
  }

  function setButtonsActive() {
    $("btnExc").classList.toggle("active", equipmentType === "excavator");
    $("btnCrane").classList.toggle("active", equipmentType === "crane");
    $("btnDump").classList.toggle("active", equipmentType === "dumper");
  }

  function setHeaderTexts() {
    $("buildTag").textContent = `BUILD: ${BUILD}`;
    $("selectedType").textContent = `Selected: ${equipmentType.charAt(0).toUpperCase()}${equipmentType.slice(1)}`;

    const title =
      equipmentType === "excavator" ? "Excavator Pre-Use Inspection Checklist" :
      equipmentType === "crane" ? "Crane Pre-Use Inspection Checklist" :
      "Dumper Pre-Use Inspection Checklist";
    $("sheetTitle").textContent = title;

    const dateISO = $("date").value || isoToday();
    $("weekCommencingPreview").textContent = isoToUK(getWeekCommencingISO(dateISO));

    const pid = ($("plantId").value || "").trim();
    $("machineNoPreview").textContent = pid || "—";
  }

  function renderTable() {
    const dateISO = $("date").value || isoToday();
    activeDay = getDayIndexMon0(dateISO);

    const tbody = $("checksBody");
    tbody.innerHTML = "";

    labels.forEach((label, r) => {
      const tr = document.createElement("tr");

      const tdItem = document.createElement("td");
      tdItem.className = "item";
      tdItem.textContent = label;
      tr.appendChild(tdItem);

      for (let d = 0; d < 7; d++) {
        const td = document.createElement("td");
        td.className = "day";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "markBtn";
        btn.textContent = markText(weekStatuses?.[r]?.[d] || null);

        if (d !== activeDay) {
          btn.classList.add("disabled");
          btn.disabled = true;
        } else {
          btn.addEventListener("click", () => {
            const cur = weekStatuses?.[r]?.[d] || null;
            const next = cycleStatus(cur);
            weekStatuses[r][d] = next;
            btn.textContent = markText(next);
            if (isMobile()) renderMobileList();
          });
        }

        td.appendChild(btn);
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    });
  }

  function renderMobileList() {
    const dateISO = $("date").value || isoToday();
    activeDay = getDayIndexMon0(dateISO);

    const wrap = $("mobileChecks");
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
      btn.textContent = markText(weekStatuses?.[r]?.[activeDay] || null);

      btn.addEventListener("click", () => {
        const cur = weekStatuses?.[r]?.[activeDay] || null;
        const next = cycleStatus(cur);
        weekStatuses[r][activeDay] = next;
        btn.textContent = markText(next);
        if (!isMobile()) renderTable();
      });

      row.appendChild(lab);
      row.appendChild(btn);
      wrap.appendChild(row);
    });
  }

  function renderChecks() {
    if (isMobile()) renderMobileList();
    else renderTable();
  }

  function fillRecipients() {
    const sel = $("reportedTo");
    sel.innerHTML = "";
    RECIPIENTS.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.email;
      opt.textContent = `${r.name} (${r.email})`;
      sel.appendChild(opt);
    });
  }

  // Signature pad
  function initSignature() {
    const canvas = $("sig");
    const ctx = canvas.getContext("2d");
    let drawing = false;
    let last = null;

    function resize() {
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(canvas.clientWidth * ratio);
      canvas.height = Math.floor(canvas.clientHeight * ratio);
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

    function start(e){ drawing = true; last = pos(e); e.preventDefault(); }
    function move(e){
      if (!drawing) return;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      e.preventDefault();
    }
    function end(){ drawing = false; last = null; }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);

    canvas.addEventListener("touchstart", start, { passive:false });
    canvas.addEventListener("touchmove", move, { passive:false });
    window.addEventListener("touchend", end);

    $("clearSig").addEventListener("click", () => ctx.clearRect(0,0,canvas.width,canvas.height));

    $("fillToday").addEventListener("click", () => {
      $("date").value = isoToday();
      setHeaderTexts();
      loadWeekFromKV();
    });
  }

  // compress signature to small JPEG (fast upload)
  function signatureDataUrl() {
    const canvas = $("sig");
    const ctx = canvas.getContext("2d");

    // detect blank
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasInk = false;
    for (let i = 0; i < img.length; i += 4) {
      if (img[i + 3] !== 0) { hasInk = true; break; }
    }
    if (!hasInk) return "";

    const tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const tctx = tmp.getContext("2d");

    tctx.fillStyle = "#fff";
    tctx.fillRect(0, 0, tmp.width, tmp.height);
    tctx.drawImage(canvas, 0, 0);

    return tmp.toDataURL("image/jpeg", 0.72);
  }

  async function loadWeekFromKV() {
    const status = $("status");
    const plantId = ($("plantId").value || "").trim();
    const dateISO = $("date").value || "";

    setHeaderTexts();

    // If missing, just render defaults
    if (!TOKEN || !plantId || !dateISO) {
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      renderChecks();
      status.textContent = TOKEN ? "Ready." : "⚠️ Missing token (t=...) in link.";
      return;
    }

    const url = `/api/week?t=${encodeURIComponent(TOKEN)}&type=${encodeURIComponent(equipmentType)}&plantId=${encodeURIComponent(plantId)}&date=${encodeURIComponent(dateISO)}`;
    status.textContent = "Loading week…";

    try {
      const { resp, data } = await fetchJson(url, { cache:"no-store" }, 12000);
      if (!resp.ok) {
        labels = [...CHECKLISTS[equipmentType]];
        weekStatuses = labels.map(() => Array(7).fill(null));
        renderChecks();
        status.textContent = `❌ Week load failed (${resp.status}): ${data.error || resp.statusText || "Unknown"}`;
        return;
      }

      const rec = data.record || null;
      if (rec && Array.isArray(rec.labels) && Array.isArray(rec.statuses)) {
        labels = rec.labels;
        weekStatuses = rec.statuses;
        status.textContent = "✅ Week loaded.";
      } else {
        labels = [...CHECKLISTS[equipmentType]];
        weekStatuses = labels.map(() => Array(7).fill(null));
        status.textContent = "✅ New week (empty).";
      }
      renderChecks();
    } catch (e) {
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      renderChecks();
      status.textContent = `❌ Load error: ${e?.name === "AbortError" ? "timeout" : (e?.message || "unknown")}`;
    }
  }

  // ---------- PDF (one page, better header, centred meta between 2 yellow lines, smaller boxes) ----------
  async function makePdfBase64(payload) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:"pt", format:"a4", orientation:"portrait" });

    const margin = 28;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const tableW = pageW - margin * 2;
    const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

    const isoToUK = (iso) => {
      if (!iso || !String(iso).includes("-")) return iso || "";
      const [y,m,d] = String(iso).split("-");
      return `${d}/${m}/${y}`;
    };

    const ellipsize = (text, maxW, fontSize) => {
      if (!text) return "";
      doc.setFontSize(fontSize);
      let t = String(text);
      while (t.length > 0 && doc.getTextWidth(t) > maxW) t = t.slice(0, -1);
      return (t.length < String(text).length) ? (t.slice(0, -1) + "…") : t;
    };

    async function fetchAsDataUrl(url) {
      const res = await fetch(url, { cache:"no-store" });
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

    function drawOkTick(cx, cy) {
      // ZapfDingbats checkmark ALWAYS renders in PDF
      doc.setFont("zapfdingbats", "normal");
      doc.setFontSize(13);
      doc.text(String.fromCharCode(52), cx, cy, { align:"center", baseline:"middle" });
    }

    function drawMark(status, cx, cy) {
      if (status === "OK") {
        drawOkTick(cx, cy);
        return;
      }
      doc.setFont("helvetica", "bold");
      if (status === "DEFECT") {
        doc.setFontSize(10);
        doc.text("X", cx, cy, { align:"center", baseline:"middle" });
        return;
      }
      if (status === "NA") {
        doc.setFontSize(7.2);
        doc.text("N/A", cx, cy, { align:"center", baseline:"middle" });
      }
    }

    const dateISO = payload.date || "";
    const weekISO = payload.weekCommencing || "";
    const weekUK = isoToUK(weekISO);
    const dateUK = isoToUK(dateISO);

    const labels = payload.labels || [];
    const weekStatuses = payload.weekStatuses || labels.map(() => Array(7).fill(null));

    // ----- HEADER (logos + titles without clashing) -----
    let y = margin;

    const atl = await fetchAsDataUrl("/assets/atl-logo.png");
    const tp  = await fetchAsDataUrl("/assets/tp.png");

    // logo boxes
    const leftBoxW = 140, leftBoxH = 34;
    const rightBoxW = 52, rightBoxH = 52;

    if (atl) {
      try {
        const s = await getImageSize(atl);
        const fitted = fitIntoBox(s.w, s.h, leftBoxW, leftBoxH);
        doc.addImage(atl, "PNG", margin, y, fitted.w, fitted.h);
      } catch {}
    }

    if (tp) {
      try {
        const s = await getImageSize(tp);
        const fitted = fitIntoBox(s.w, s.h, rightBoxW, rightBoxH);
        doc.addImage(tp, "PNG", pageW - margin - fitted.w, y - 2, fitted.w, fitted.h);
      } catch {}
    }

    // Title block sits LOWER so it doesn't collide with logos
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(payload.formRef || "QPFPL5.2", pageW / 2, y + 16, { align:"center" });

    doc.setFontSize(10);
    doc.text(payload.sheetTitle || "Excavator Pre-Use Inspection Checklist", pageW / 2, y + 32, { align:"center" });

    y += 58;

    // Machine / Week line (safe spacing)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Machine No: ${payload.machineNo || payload.plantId || ""}`, margin, y);
    doc.text(`Week commencing: ${weekUK}`, pageW - margin, y, { align:"right" });

    y += 10;

    // Yellow instruction bar
    doc.setFillColor(255, 214, 0);
    doc.rect(margin, y, tableW, 18, "F");
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.text("All checks must be carried out in line with Specific Manufacturer’s instructions", pageW/2, y+12.5, { align:"center" });
    y += 24;

    // ---- meta centred between 2 yellow lines ----
    // top yellow line
    doc.setFillColor(255, 214, 0);
    doc.rect(margin, y, tableW, 4, "F");
    y += 12;

    const colW = tableW / 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    doc.text(`Site: ${payload.site || ""}`, margin + colW * 0.5, y, { align:"center" });
    doc.text(`Date: ${dateUK}`,        margin + colW * 1.5, y, { align:"center" });
    doc.text(`Operator: ${payload.operator || ""}`, margin + colW * 2.5, y, { align:"center" });
    doc.text(`Hours/Shift: ${payload.hours || ""}`, margin + colW * 3.5, y, { align:"center" });

    y += 10;
    // bottom yellow line
    doc.setFillColor(255, 214, 0);
    doc.rect(margin, y, tableW, 4, "F");
    y += 10;

    // ----- TABLE (one page, with inner pill boxes like UI) -----
    const itemColW = 420;
    const dayColW = (tableW - itemColW) / 7;
    const headH = 16;

    // Footer heights (smaller, per your feedback)
    const defectsH = 26;
    const actionH  = 28;
    const sigH     = 34;

    const footerTotal =
      10 +               // Checks carried out by line
      10 + 6 + defectsH + 10 +   // defects
      10 + 6 + 10 +              // Reported to (text only)
      10 + 6 + actionH + 10 +    // action
      10 + 6 + sigH + 20;        // signature

    const availForTable = (pageH - margin) - y - headH - footerTotal;
    const totalRows = labels.length || 1;

    let rowH = Math.floor(availForTable / totalRows);
    rowH = Math.max(10, Math.min(16, rowH));

    const fontItem = rowH <= 11 ? 6.7 : 7.6;

    // header row
    doc.setDrawColor(0);
    doc.setLineWidth(0.7);

    doc.setFillColor(255, 214, 0);
    doc.rect(margin, y, itemColW, headH, "F");
    doc.setFillColor(255, 255, 255);
    doc.rect(margin + itemColW, y, tableW - itemColW, headH, "F");
    doc.rect(margin, y, tableW, headH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    for (let i = 0; i < 7; i++) {
      const cx = margin + itemColW + dayColW * i + dayColW / 2;
      doc.text(days[i], cx, y + 11, { align:"center" });
    }

    y += headH;

    for (let r = 0; r < totalRows; r++) {
      // row outer box
      doc.rect(margin, y, tableW, rowH);

      // item text
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontItem);
      const label = ellipsize(labels[r] || "", itemColW - 10, fontItem);
      doc.text(label, margin + 6, y + rowH * 0.72);

      // day cell pills + marks
      for (let d = 0; d < 7; d++) {
        const cellX = margin + itemColW + dayColW * d;
        doc.line(cellX, y, cellX, y + rowH); // vertical cell line

        const pillPadX = 4;
        const pillPadY = 2;
        const pillW = dayColW - pillPadX * 2;
        const pillH = rowH - pillPadY * 2;
        const px = cellX + pillPadX;
        const py = y + pillPadY;

        doc.setDrawColor(200);
        doc.setFillColor(255,255,255);
        doc.roundedRect(px, py, pillW, pillH, 5, 5, "DF");

        const status = weekStatuses?.[r]?.[d] || null;
        if (status) {
          const cx = px + pillW / 2;
          const cy = py + pillH / 2 + 0.5;
          doc.setTextColor(0);
          drawMark(status, cx, cy);
        }
      }

      // right border line of table
      doc.line(margin + tableW, y, margin + tableW, y + rowH);

      y += rowH;
    }

    // bottom border under table
    doc.line(margin, y, margin + tableW, y);

    y += 8;

    // ----- FOOTER (smaller boxes, split fields) -----
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Checks carried out by: ${payload.operator || ""}`, margin, y);
    y += 10;

    // Defects
    doc.text("Defects identified:", margin, y);
    y += 6;
    doc.rect(margin, y, tableW, defectsH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    if (payload.defectsText) {
      doc.text(String(payload.defectsText), margin + 6, y + 14, { maxWidth: tableW - 12 });
    }
    y += defectsH + 10;

    // Reported to (text only, no huge box)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Reported to: ${payload.reportedToName || ""}`, margin, y);
    y += 10;

    // Action taken
    doc.text("Action taken:", margin, y);
    y += 6;
    doc.rect(margin, y, tableW, actionH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    if (payload.actionTaken) {
      doc.text(String(payload.actionTaken), margin + 6, y + 14, { maxWidth: tableW - 12 });
    }
    y += actionH + 10;

    // Signature (smaller box)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Signature:", margin, y);
    y += 6;

    doc.rect(margin, y, tableW, sigH);

    if (payload.signatureDataUrl && payload.signatureDataUrl.startsWith("data:image")) {
      try {
        const pad = 4;
        const innerW = tableW - pad * 2;
        const innerH = sigH - pad * 2;
        const s = await getImageSize(payload.signatureDataUrl);
        const fitted = fitIntoBox(s.w, s.h, innerW, innerH);

        const imgX = margin + pad + (innerW - fitted.w) / 2;
        const imgY = y + pad + (innerH - fitted.h) / 2;

        doc.addImage(payload.signatureDataUrl, "JPEG", imgX, imgY, fitted.w, fitted.h);
      } catch {}
    }

    // Bottom footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Submitted: ${new Date().toISOString()}`, margin, pageH - 16);
    doc.text(`BUILD: ${BUILD}`, pageW / 2, pageH - 16, { align:"center" });

    const dataUri = doc.output("datauristring");
    if (!dataUri) throw new Error("PDF export failed (empty output)");
    const parts = String(dataUri).split(",");
    if (parts.length < 2) throw new Error("PDF export failed (bad data URI)");
    return parts[1];
  }

  async function submit() {
    const status = $("status");
    const btn = $("submitBtn");

    const plantId = ($("plantId").value || "").trim();
    const dateISO = $("date").value || "";
    const site = ($("site").value || "").trim();
    const operator = ($("operator").value || "").trim();
    const hours = ($("hours").value || "").trim();

    const reportedToEmail = $("reportedTo").value;
    const reportedToName = (RECIPIENTS.find(r => r.email === reportedToEmail)?.name) || "";

    if (!TOKEN) { status.textContent = "❌ Missing token (t=...) in link."; return; }
    if (!plantId || !dateISO) { status.textContent = "❌ Plant ID and Date are required."; return; }
    if (!reportedToEmail) { status.textContent = "❌ Please select ‘Reported to’."; return; }

    const weekCommencing = getWeekCommencingISO(dateISO);
    const dayIndex = getDayIndexMon0(dateISO);

    const payload = {
      formRef: $("formRef").textContent || "QPFPL5.2",
      sheetTitle: $("sheetTitle").textContent || "",
      equipmentType,
      site,
      date: dateISO,
      plantId,
      machineNo: plantId,
      operator,
      hours,
      weekCommencing,
      dayIndex,
      labels,
      weekStatuses,
      defectsText: ($("defectsText").value || "").trim(),
      reportedToName,
      reportedToEmail,
      actionTaken: ($("actionTaken").value || "").trim(),
      signatureDataUrl: signatureDataUrl()
    };

    btn.disabled = true;
    status.textContent = "Building PDF…";

    try {
      const pdfBase64 = await makePdfBase64(payload);

      status.textContent = "Submitting…";

      const { resp, data } = await fetchJson("/api/submit", {
        method: "POST",
        headers: { "content-type":"application/json" },
        body: JSON.stringify({ token: TOKEN, payload, pdfBase64 })
      }, 25000);

      if (!resp.ok) {
        status.textContent = `❌ Submit failed (${resp.status}): ${data.error || "Unknown"}`;
        btn.disabled = false;
        return;
      }

      status.textContent = data.queued ? "✅ Submitted. Email queued (should arrive shortly)." : "✅ Submitted.";
      btn.disabled = false;

      // refresh from KV so week view stays consistent
      await loadWeekFromKV();

    } catch (e) {
      status.textContent = `❌ Error: ${e?.message || "unknown"}`;
      btn.disabled = false;
    }
  }

  function wireEvents() {
    $("btnExc").addEventListener("click", async () => {
      equipmentType = "excavator";
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      setButtonsActive();
      setHeaderTexts();
      await loadWeekFromKV();
    });

    $("btnCrane").addEventListener("click", async () => {
      equipmentType = "crane";
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      setButtonsActive();
      setHeaderTexts();
      await loadWeekFromKV();
    });

    $("btnDump").addEventListener("click", async () => {
      equipmentType = "dumper";
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      setButtonsActive();
      setHeaderTexts();
      await loadWeekFromKV();
    });

    $("date").addEventListener("change", loadWeekFromKV);
    $("plantId").addEventListener("blur", loadWeekFromKV);

    window.addEventListener("resize", () => renderChecks());

    $("submitBtn").addEventListener("click", submit);
  }

  // init
  (function init(){
    $("buildTag").textContent = `BUILD: ${BUILD}`;
    fillRecipients();
    initSignature();
    wireEvents();

    if (!$("date").value) $("date").value = isoToday();
    setButtonsActive();
    setHeaderTexts();
    renderChecks();
    loadWeekFromKV();
  })();
})();
