/* public/app.js */
(() => {
  const BUILD = "v10";

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

  // ---------- DOM helpers ----------
  const el = (id) => document.getElementById(id);

  // ---------- URL params ----------
  const qs = new URLSearchParams(location.search);
  const TOKEN = qs.get("t") || "";
  const initialType = (qs.get("type") || "excavator").toLowerCase();
  const initialPlantId = qs.get("plantId") || "";
  const initialDate = qs.get("date") || ""; // yyyy-mm-dd (optional)

  // ---------- state ----------
  let equipmentType = ["excavator", "crane", "dumper"].includes(initialType) ? initialType : "excavator";
  let labels = [...CHECKLISTS[equipmentType]];
  let weekStatuses = labels.map(() => Array(7).fill(null)); // statuses[row][day] = OK|DEFECT|NA|null
  let activeDay = 0;

  // ---------- date helpers ----------
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
    return day === 0 ? 6 : day - 1; // Mon=0..Sun=6
  }

  // ---------- networking helpers ----------
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

  // ---------- marks ----------
 x  function cycleStatus(cur) {
    // blank -> OK -> DEFECT -> NA -> blank
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

  // ---------- rendering ----------
  function isMobileView() {
    return window.matchMedia("(max-width: 760px)").matches;
  }

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
        td.className = "day";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "markBtn" + (d === activeDay ? " activeDay" : "");
        btn.dataset.r = String(r);
        btn.dataset.d = String(d);

        const status = weekStatuses?.[r]?.[d] || null;
        btn.textContent = markText(status);

        if (d !== activeDay) btn.disabled = true;

        td.appendChild(btn);
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    });
  }

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

  function setButtonsActive() {
    el("btnExc").classList.toggle("active", equipmentType === "excavator");
    el("btnCrane").classList.toggle("active", equipmentType === "crane");
    el("btnDump").classList.toggle("active", equipmentType === "dumper");
  }

  // ---------- API ----------
  async function loadWeekFromKV() {
    const status = el("status");
    const plantId = (el("plantId").value || "").trim();
    const dateISO = el("date").value || "";

    setHeaderTexts();

    if (!TOKEN) {
      status.textContent = "⚠️ Missing token (t=...) in link.";
      return;
    }
    if (!plantId || !dateISO) {
      status.textContent = "Enter Plant ID + Date to load the weekly record.";
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

  // ---------- signature pad ----------
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

  // ---------- PDF generation ----------
  // IMPORTANT: keep your existing working makePdfBase64() here.
  // If you already have the v9 PDF function that draws vector ticks & rounded boxes,
  // keep it as-is. (No change needed for "stuck at sending".)
  async function makePdfBase64(payload) {
    // <-- KEEP YOUR CURRENT WORKING PDF FUNCTION -->
    // To avoid breaking your working PDF, I'm not rewriting it here.
    // If you want, paste your current makePdfBase64 and I’ll merge it into this file.
    throw new Error("makePdfBase64 is missing. Paste your working PDF function here.");
  }

  // ---------- submit ----------
  async function submit() {
    const status = el("status");
    status.textContent = "Generating PDF…";

    const dateISO = el("date").value || "";
    const weekISO = dateISO ? getWeekCommencingISO(dateISO) : "";

    const payload = {
      build: BUILD,
      token: TOKEN,

      equipmentType,
      formRef: el("formRef").textContent || "QPFPL5.2",
      sheetTitle: el("sheetTitle").textContent || "",
      machineNo: (el("plantId").value || "").trim(),
      weekCommencing: weekISO,
      dayIndex: getDayIndexMon0(dateISO),

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

    status.textContent = "Sending email… (waiting for server)";

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
          + (data.details ? ` | details: ${typeof data.details === "string" ? data.details : JSON.stringify(data.details)}` : "");
        return;
      }

      status.textContent = "✅ Sent successfully.";
    } catch (e) {
      status.textContent =
        "❌ Send error: " +
        (e?.name === "AbortError" ? "Timeout (server took too long)" : (e?.message || "Unknown"));
    }
  }

  // ---------- events ----------
  function bindEvents() {
    el("btnExc").addEventListener("click", () => { equipmentType = "excavator"; setButtonsActive(); setHeaderTexts(); loadWeekFromKV(); });
    el("btnCrane").addEventListener("click", () => { equipmentType = "crane"; setButtonsActive(); setHeaderTexts(); loadWeekFromKV(); });
    el("btnDump").addEventListener("click", () => { equipmentType = "dumper"; setButtonsActive(); setHeaderTexts(); loadWeekFromKV(); });

    el("date").addEventListener("change", () => { setHeaderTexts(); loadWeekFromKV(); });
    el("plantId").addEventListener("change", () => { setHeaderTexts(); loadWeekFromKV(); });
    el("plantId").addEventListener("input", () => { setHeaderTexts(); });

    el("checksBody").addEventListener("click", (e) => {
      const btn = e.target.closest("button.markBtn");
      if (!btn || btn.disabled) return;

      const r = Number(btn.dataset.r);
      const d = Number(btn.dataset.d);
      const cur = weekStatuses?.[r]?.[d] || null;
      const next = cycleStatus(cur);
      weekStatuses[r][d] = next;
      btn.textContent = markText(next);

      if (isMobileView()) renderMobileList();
    });

    window.addEventListener("resize", () => renderChecks());
    el("submitBtn").addEventListener("click", submit);
  }

  // ---------- init ----------
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
