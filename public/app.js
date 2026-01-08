/* public/app.js */
(() => {
  const BUILD = "v7";

  const $ = (id) => document.getElementById(id);

  const els = {
    buildTag: $("buildTag"),
    formRef: $("formRef"),
    sheetTitle: $("sheetTitle"),
    machineNoPreview: $("machineNoPreview"),
    weekCommencingPreview: $("weekCommencingPreview"),
    selectedType: $("selectedType"),

    btnExc: $("btnExc"),
    btnCrane: $("btnCrane"),
    btnDump: $("btnDump"),

    site: $("site"),
    date: $("date"),
    plantId: $("plantId"),
    operator: $("operator"),
    hours: $("hours"),

    checksBody: $("checksBody"),

    defectsText: $("defectsText"),
    actionTaken: $("actionTaken"),

    sig: $("sig"),
    clearSig: $("clearSig"),
    fillToday: $("fillToday"),

    submitBtn: $("submitBtn"),
    status: $("status"),
  };

  els.buildTag.textContent = `BUILD: ${BUILD}`;

  // --- token from URL ---
  const params = new URLSearchParams(location.search);
  const token = params.get("t") || "";
  if (!token) {
    els.status.textContent = "❌ Missing token (?t=...)";
  }

  // --- checklists (edit these labels anytime) ---
  const LISTS = {
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
      "Tyres – condition & pressure",
      "Brakes – service / park – working",
      "Steering – free movement / no defects",
      "Body / skips – damage / pins secure",
      "Hydraulic hoses – leaks / wear",
      "Lights / horn / beacon – working",
      "Reverse alarm – working",
      "Seatbelt – condition & works",
      "Mirrors / camera – clean & working",
      "Fluid levels – oil / coolant / hydraulic",
      "Walkaround – leaks / damage",
      "Fire extinguisher – present & charged",
    ],
  };

  // --- state ---
  const state = {
    equipmentType: null,   // "excavator" | "crane" | "dumper"
    labels: [],
    statuses: [],          // [row][day] => null|"OK"|"DEFECT"|"NA"
    dayIndex: 0,           // Mon=0..Sun=6
    weekCommencingISO: "",
  };

  // --- date helpers ---
  const pad2 = (n) => String(n).padStart(2, "0");

  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  function getWeekCommencingISO(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const day = dt.getDay(); // Sun=0 ... Mon=1
    const diffToMon = (day === 0 ? -6 : 1 - day);
    dt.setDate(dt.getDate() + diffToMon);
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  }

  function getDayIndexMon0(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const day = dt.getDay(); // Sun=0
    return day === 0 ? 6 : day - 1; // Mon=0..Sun=6
  }

  function isoToUK(iso) {
    if (!iso || !String(iso).includes("-")) return iso || "";
    const [y, m, d] = String(iso).split("-");
    return `${d}/${m}/${y}`;
  }

  // --- UI render ---
  function setActiveButton(type) {
    [els.btnExc, els.btnCrane, els.btnDump].forEach(b => b.classList.remove("active"));
    if (type === "excavator") els.btnExc.classList.add("active");
    if (type === "crane") els.btnCrane.classList.add("active");
    if (type === "dumper") els.btnDump.classList.add("active");
  }

  function symbolFor(status) {
    if (status === "OK") return "✓";
    if (status === "DEFECT") return "X";
    if (status === "NA") return "N/A";
    return "";
  }

  function cycleStatus(current) {
    if (!current) return "OK";
    if (current === "OK") return "DEFECT";
    if (current === "DEFECT") return "NA";
    return null;
  }

  function ensureBlankWeek(labels) {
    state.labels = labels.slice();
    state.statuses = labels.map(() => Array(7).fill(null));
  }

  function renderWeekPreview() {
    els.weekCommencingPreview.textContent = state.weekCommencingISO ? isoToUK(state.weekCommencingISO) : "—";
  }

  function renderChecksTable() {
    const tbody = els.checksBody;
    tbody.innerHTML = "";

    const activeDay = state.dayIndex;

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
        btn.className = "cellBtn";

        const st = state.statuses?.[r]?.[d] ?? null;
        btn.textContent = symbolFor(st);

        // only today's/selected date column editable
        btn.disabled = (d !== activeDay);

        btn.addEventListener("click", () => {
          const next = cycleStatus(state.statuses[r][d]);
          state.statuses[r][d] = next;
          btn.textContent = symbolFor(next);
        });

        td.appendChild(btn);
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }
  }

  // --- Equipment selection ---
  function chooseEquipment(type) {
    state.equipmentType = type;
    setActiveButton(type);

    const titleMap = {
      excavator: "Excavator Pre-Use Inspection Checklist",
      crane: "Crane Pre-Use Inspection Checklist",
      dumper: "Dumper Pre-Use Inspection Checklist",
    };

    els.sheetTitle.textContent = titleMap[type] || "Plant Pre-Use Inspection Checklist";
    els.selectedType.textContent = `Selected: ${type}`;
    els.machineNoPreview.textContent = els.plantId.value || "—";

    ensureBlankWeek(LISTS[type] || []);
    renderChecksTable();

    loadWeekIfReady().catch(() => {});
  }

  els.btnExc.addEventListener("click", () => chooseEquipment("excavator"));
  els.btnCrane.addEventListener("click", () => chooseEquipment("crane"));
  els.btnDump.addEventListener("click", () => chooseEquipment("dumper"));

  // --- load week record from KV ---
  async function loadWeekIfReady() {
    if (!token) return;
    if (!state.equipmentType) return;

    const dateISO = els.date.value;
    const plantId = (els.plantId.value || "").trim();
    if (!dateISO || !plantId) return;

    state.dayIndex = getDayIndexMon0(dateISO);
    state.weekCommencingISO = getWeekCommencingISO(dateISO);
    renderWeekPreview();
    els.machineNoPreview.textContent = plantId || "—";

    // fetch existing week record
    const url = `/api/week?t=${encodeURIComponent(token)}&type=${encodeURIComponent(state.equipmentType)}&plantId=${encodeURIComponent(plantId)}&date=${encodeURIComponent(dateISO)}`;
    const resp = await fetch(url, { cache: "no-store" });
    const data = await resp.json();

    if (!resp.ok) {
      els.status.textContent = `❌ Week load failed: ${data?.error || resp.status}`;
      return;
    }

    if (data?.record?.labels?.length && data?.record?.statuses?.length) {
      // use record (keeps Mon/Tue when you open Wed, etc.)
      state.labels = data.record.labels;
      state.statuses = data.record.statuses;
    } else {
      // ensure our current checklist still shown
      ensureBlankWeek(LISTS[state.equipmentType] || []);
    }

    renderChecksTable();
    els.status.textContent = "Ready.";
  }

  // update week when date / plant changes
  els.date.addEventListener("change", () => loadWeekIfReady().catch(() => {}));
  els.plantId.addEventListener("input", () => {
    els.machineNoPreview.textContent = els.plantId.value || "—";
  });
  els.plantId.addEventListener("change", () => loadWeekIfReady().catch(() => {}));

  // --- signature pad ---
  const canvas = els.sig;
  const ctx = canvas.getContext("2d");

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * devicePixelRatio);
    canvas.height = Math.floor(rect.height * devicePixelRatio);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  let drawing = false;
  let last = null;

  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x, y };
  }

  function down(e) {
    drawing = true;
    last = getPos(e);
    e.preventDefault();
  }
  function move(e) {
    if (!drawing) return;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
    e.preventDefault();
  }
  function up() {
    drawing = false;
    last = null;
  }

  canvas.addEventListener("mousedown", down);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);

  canvas.addEventListener("touchstart", down, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  window.addEventListener("touchend", up);

  els.clearSig.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  els.fillToday.addEventListener("click", () => {
    els.date.value = todayISO();
    loadWeekIfReady().catch(() => {});
  });

  // --- PDF: draw checkbox like your UI (rounded box + tick drawn with lines) ---
  async function makePdfBase64(payload) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

    const margin = 26;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

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

    // draw checkbox like the UI
    function drawUiBox(doc, x, y, w, h, status) {
      const r = Math.min(6, h / 3);
      doc.setLineWidth(0.7);
      doc.setDrawColor(180);
      doc.roundedRect(x, y, w, h, r, r);

      if (!status) return;

      // make marks black
      doc.setDrawColor(0);
      doc.setTextColor(0);

      if (status === "OK") {
        doc.setLineWidth(1.6);
        const x1 = x + w * 0.24, y1 = y + h * 0.55;
        const x2 = x + w * 0.42, y2 = y + h * 0.72;
        const x3 = x + w * 0.78, y3 = y + h * 0.30;
        doc.line(x1, y1, x2, y2);
        doc.line(x2, y2, x3, y3);
      } else if (status === "DEFECT") {
        doc.setLineWidth(1.4);
        const p = w * 0.22;
        doc.line(x + p, y + p, x + w - p, y + h - p);
        doc.line(x + w - p, y + p, x + p, y + h - p);
      } else if (status === "NA") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.text("N/A", x + w / 2, y + h * 0.68, { align: "center" });
      }
    }

    // ----- data -----
    const dateISO = payload.date || "";
    const weekISO = payload.weekCommencing || "";
    const weekUK = isoToUK(weekISO);
    const dateUK = isoToUK(dateISO);

    const labels = payload.labels || [];
    const weekStatuses = payload.weekStatuses || labels.map(() => Array(7).fill(null));

    // ----- layout -----
    let y = margin;

    // logos + title
    const [atl, tp] = await Promise.all([
      fetchAsDataUrl("/assets/atl-logo.png"),
      fetchAsDataUrl("/assets/tp.png"),
    ]);

    if (atl) doc.addImage(atl, "PNG", margin, y - 6, 140, 36);
    if (tp)  doc.addImage(tp, "PNG", pageW - margin - 52, y - 10, 52, 52);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(String(payload.formRef || "QPFPL5.2"), pageW / 2, y + 12, { align: "center" });

    doc.setFontSize(10);
    doc.text(String(payload.sheetTitle || "Plant Pre-Use Inspection Checklist"), pageW / 2, y + 28, { align: "center" });

    y += 48;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
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

    // meta line
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.text(`Site: ${payload.site || ""}`, margin, y);
    doc.text(`Date: ${dateUK}`, margin + 180, y);
    doc.text(`Operator: ${payload.operator || ""}`, margin + 320, y);
    doc.text(`Hours/Shift: ${payload.hours || ""}`, pageW - margin, y, { align: "right" });
    y += 14;

    // table sizing
    const tableX = margin;
    const tableW = pageW - margin * 2;
    const itemColW = 360;
    const dayColW = (tableW - itemColW) / 7;
    const headH = 16;

    // footer blocks
    const defectsH = 40;
    const actionH = 40;
    const sigH = 55;

    const footerTotal =
      12 + 12 + 8 + defectsH + 12 + 12 + 8 + actionH + 12 + 12 + 8 + sigH + 18;

    const availForRows = (pageH - margin) - y - headH - footerTotal;
    const totalRows = labels.length || 1;

    let rowH = Math.floor(availForRows / totalRows);
    rowH = Math.max(9, Math.min(16, rowH)); // keep readable, but force 1 page

    const fontItem = rowH <= 10 ? 6.7 : 7.5;

    // header
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
      const label = ellipsize(labels[r] || "", itemColW - 10);
      doc.text(label, tableX + 6, y + rowH * 0.72);

      // draw UI-style boxes inside each day cell
      for (let i = 0; i < 7; i++) {
        const cellX = tableX + itemColW + dayColW * i;
        const pad = 4;
        const boxW = dayColW - pad * 2;
        const boxH = Math.min(24, rowH - 4);
        const boxX = cellX + pad;
        const boxY = y + (rowH - boxH) / 2;

        const st = weekStatuses?.[r]?.[i] ?? null;
        drawUiBox(doc, boxX, boxY, boxW, boxH, st);
      }

      y += rowH;
    }

    y += 10;

    // footer
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Checks carried out by: ${payload.operator || ""}`, margin, y);
    y += 12;

    doc.text("Defects identified:", margin, y);
    y += 8;
    doc.rect(margin, y, pageW - margin * 2, defectsH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    if (payload.defectsText) doc.text(payload.defectsText, margin + 6, y + 14, { maxWidth: pageW - margin * 2 - 12 });
    y += defectsH + 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Reported to / action taken:", margin, y);
    y += 8;
    doc.rect(margin, y, pageW - margin * 2, actionH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    if (payload.actionTaken) doc.text(payload.actionTaken, margin + 6, y + 14, { maxWidth: pageW - margin * 2 - 12 });
    y += actionH + 12;

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

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Submitted: ${new Date().toISOString()}`, margin, pageH - 16);
    doc.text(`BUILD: ${BUILD}`, pageW / 2, pageH - 16, { align: "center" });

    const dataUri = doc.output("datauristring");
    const parts = String(dataUri).split(",");
    if (parts.length < 2) throw new Error("PDF export failed (bad data URI)");
    return parts[1];
  }

  // --- submit ---
  els.submitBtn.addEventListener("click", async () => {
    try {
      if (!token) throw new Error("Missing token (?t=...)");
      if (!state.equipmentType) throw new Error("Select Excavator / Crane / Dumper first");
      if (!els.date.value) throw new Error("Select a date");
      if (!els.plantId.value.trim()) throw new Error("Enter Plant ID");

      els.status.textContent = "⏳ Building PDF…";

      const dateISO = els.date.value;
      const plantId = els.plantId.value.trim();

      state.dayIndex = getDayIndexMon0(dateISO);
      state.weekCommencingISO = getWeekCommencingISO(dateISO);

      const checksForToday = state.labels.map((label, i) => ({
        label,
        status: state.statuses?.[i]?.[state.dayIndex] ?? null,
      }));

      const signatureDataUrl = (() => {
        // export signature canvas to PNG dataURL
        // (convert to normal scale)
        const c = els.sig;
        const out = document.createElement("canvas");
        const r = c.getBoundingClientRect();
        out.width = Math.floor(r.width);
        out.height = Math.floor(r.height);
        const octx = out.getContext("2d");
        octx.drawImage(c, 0, 0, out.width, out.height);
        return out.toDataURL("image/png");
      })();

      const payload = {
        formRef: els.formRef.textContent || "QPFPL5.2",
        sheetTitle: els.sheetTitle.textContent || "Plant Pre-Use Inspection Checklist",

        equipmentType: state.equipmentType,
        site: els.site.value || "",
        date: dateISO,
        plantId: plantId,
        operator: els.operator.value || "",
        hours: els.hours.value || "",

        weekCommencing: state.weekCommencingISO,
        dayIndex: state.dayIndex,

        labels: state.labels,
        weekStatuses: state.statuses,

        checks: checksForToday,

        defectsText: els.defectsText.value || "",
        actionTaken: els.actionTaken.value || "",
        signatureDataUrl,
      };

      const pdfBase64 = await makePdfBase64(payload);

      els.status.textContent = "📧 Sending email…";

      const resp = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, payload, pdfBase64 }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        throw new Error(data?.error ? `${data.error}` : `Submit failed (${resp.status})`);
      }

      els.status.textContent = "✅ Sent + saved for the week.";
      // refresh week from KV (so UI reflects persisted state)
      await loadWeekIfReady();
    } catch (e) {
      els.status.textContent = `❌ ${e?.message || "Error"}`;
    }
  });

  // init
  els.date.value = todayISO();
  state.dayIndex = getDayIndexMon0(els.date.value);
  state.weekCommencingISO = getWeekCommencingISO(els.date.value);
  renderWeekPreview();

  // default selection
  chooseEquipment("excavator");
  loadWeekIfReady().catch(() => {});
})();
