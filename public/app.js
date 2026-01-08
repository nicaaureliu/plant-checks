/* public/app.js */
(() => {
  const BUILD = "v12-debug";
  const $ = (id) => document.getElementById(id);

  function must(id) {
    const el = $(id);
    if (!el) throw new Error(`Missing element #${id} in index.html`);
    return el;
  }

  const statusEl = () => $("status");

  const RECIPIENTS = [
    { name: "Alin Pop", email: "apop@activetunnelling.com" },
    { name: "Andrew Hubbard", email: "ahubbard@activetunnelling.com" },
    { name: "Aureliu Nica", email: "anica@activetunnelling.com" },
    { name: "Cameron Davies", email: "cdavies@activetunnelling.com" },
    { name: "Ebenezer Bentum", email: "ebentum@activetunnelling.com" },
    { name: "Iosif Beghean", email: "ibeghean@activetunnelling.com" },
    { name: "James Wallace", email: "jwallace@activetunnelling.com" },
    { name: "John Thorpe", email: "jthorpe@activetunnelling.com" },
    { name: "Josh Furner", email: "jfurner@activetunnelling.com" },
    { name: "Kamran Muzaffar", email: "kmuzaffar@activetunnelling.com" },
    { name: "Niall Lynam", email: "nlynam@activetunnelling.com" },
    { name: "Richard Wilson", email: "rwilson@activetunnelling.com" },
    { name: "Rob Graham", email: "rgraham@activetunnelling.com" },
    { name: "Scott Carter", email: "scarter@activetunnelling.com" }
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
      "Engine Oil Levels",
      "Fuel Level",
      "Coolant Levels",
      "Hydraulic fluid levels",
      "Visually check for fluid leaks",
      "Lights, beacons and horn",
      "Correct operation of RCI (LMI)"
    ],
    dumper: [
      "Skip/Body Security",
      "Steps/Handrails",
      "Steering/Braking/Handbrake",
      "Tracks/Running Gear/Wheels/Tyres",
      "Lights/Beacons",
      "Audible Warnings/Alarms"
    ]
  };

  const qs = new URLSearchParams(location.search);
  const TOKEN = qs.get("t") || "";

  let equipmentType = (qs.get("type") || "excavator").toLowerCase();
  if (!CHECKLISTS[equipmentType]) equipmentType = "excavator";

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
    } finally { clearTimeout(t); }
  }

  function fillRecipients() {
    const sel = must("reportedTo");
    sel.innerHTML = "";
    RECIPIENTS.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.email;
      opt.textContent = `${r.name} (${r.email})`;
      sel.appendChild(opt);
    });
  }

  function setButtonsActive() {
    must("btnExc").classList.toggle("active", equipmentType === "excavator");
    must("btnCrane").classList.toggle("active", equipmentType === "crane");
    must("btnDump").classList.toggle("active", equipmentType === "dumper");
  }

  function setHeaderTexts() {
    must("buildTag").textContent = `BUILD: ${BUILD}`;
    must("selectedType").textContent = `Selected: ${equipmentType.charAt(0).toUpperCase()}${equipmentType.slice(1)}`;

    const title =
      equipmentType === "excavator" ? "Excavator Pre-Use Inspection Checklist" :
      equipmentType === "crane" ? "Crane Pre-Use Inspection Checklist" :
      "Dumper Pre-Use Inspection Checklist";
    must("sheetTitle").textContent = title;

    const dateISO = must("date").value || isoToday();
    must("weekCommencingPreview").textContent = isoToUK(getWeekCommencingISO(dateISO));

    const pid = (must("plantId").value || "").trim();
    must("machineNoPreview").textContent = pid || "—";
  }

  function renderTable() {
    const dateISO = must("date").value || isoToday();
    activeDay = getDayIndexMon0(dateISO);

    const tbody = must("checksBody");
    tbody.innerHTML = "";

    // ✅ GUARANTEE rows exist
    if (!labels.length) labels = [...CHECKLISTS[equipmentType]];
    if (!weekStatuses.length) weekStatuses = labels.map(() => Array(7).fill(null));

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
    const dateISO = must("date").value || isoToday();
    activeDay = getDayIndexMon0(dateISO);

    const wrap = must("mobileChecks");
    wrap.innerHTML = "";

    if (!labels.length) labels = [...CHECKLISTS[equipmentType]];
    if (!weekStatuses.length) weekStatuses = labels.map(() => Array(7).fill(null));

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
    setHeaderTexts();
    if (isMobile()) renderMobileList();
    else renderTable();
  }

  // Minimal signature so page stays interactive even if you haven't signed yet
  function initSignature() {
    const canvas = must("sig");
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

    must("clearSig").addEventListener("click", () => ctx.clearRect(0,0,canvas.width,canvas.height));
    must("fillToday").addEventListener("click", () => {
      must("date").value = isoToday();
      renderChecks();
      loadWeekFromKV();
    });
  }

  async function loadWeekFromKV() {
    const s = statusEl();
    const plantId = (must("plantId").value || "").trim();
    const dateISO = must("date").value || "";

    renderChecks();

    // If missing info, still render table (don’t block UI)
    if (!TOKEN || !plantId || !dateISO) {
      if (s) s.textContent = TOKEN ? "Ready (enter Plant ID + Date to load saved week)." : "Ready (missing token in URL).";
      return;
    }

    const url = `/api/week?t=${encodeURIComponent(TOKEN)}&type=${encodeURIComponent(equipmentType)}&plantId=${encodeURIComponent(plantId)}&date=${encodeURIComponent(dateISO)}`;
    if (s) s.textContent = "Loading week…";

    try {
      const { resp, data } = await fetchJson(url, { cache:"no-store" }, 12000);
      if (!resp.ok) {
        if (s) s.textContent = `❌ Week load failed (${resp.status}): ${data.error || resp.statusText || "Unknown"}`;
        return;
      }

      const rec = data.record || null;
      if (rec && Array.isArray(rec.labels) && Array.isArray(rec.statuses)) {
        labels = rec.labels;
        weekStatuses = rec.statuses;
        if (s) s.textContent = "✅ Week loaded.";
      } else {
        labels = [...CHECKLISTS[equipmentType]];
        weekStatuses = labels.map(() => Array(7).fill(null));
        if (s) s.textContent = "✅ New week (empty).";
      }

      renderChecks();
    } catch (e) {
      if (s) s.textContent = `❌ Load error: ${e?.name === "AbortError" ? "timeout" : (e?.message || "unknown")}`;
    }
  }

  function wireEvents() {
    must("btnExc").addEventListener("click", () => {
      equipmentType = "excavator";
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      setButtonsActive();
      renderChecks();
      loadWeekFromKV();
    });
    must("btnCrane").addEventListener("click", () => {
      equipmentType = "crane";
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      setButtonsActive();
      renderChecks();
      loadWeekFromKV();
    });
    must("btnDump").addEventListener("click", () => {
      equipmentType = "dumper";
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      setButtonsActive();
      renderChecks();
      loadWeekFromKV();
    });

    must("date").addEventListener("change", loadWeekFromKV);
    must("plantId").addEventListener("blur", loadWeekFromKV);
    window.addEventListener("resize", renderChecks);
  }

  // init
  try {
    fillRecipients();
    initSignature();
    wireEvents();

    if (!must("date").value) must("date").value = isoToday();

    setButtonsActive();
    renderChecks();
    loadWeekFromKV();

    if (statusEl()) statusEl().textContent = "✅ UI ready (table should be visible).";
  } catch (e) {
    if (statusEl()) statusEl().textContent = `❌ Init error: ${e.message}`;
    throw e;
  }
})();
