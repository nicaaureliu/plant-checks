/* public/app.js */
(() => {
  const BUILD = "v13";
  const $ = (id) => document.getElementById(id);

  // Recipients (selected person receives email)
  const RECIPIENTS = [
    { name: "Alin Pop", email: "APop@activetunnelling.com" },
    { name: "Andrew Hubbard", email: "AHubbard@activetunnelling.com" },
    { name: "Aureliu Nica", email: "anica@activetunnelling.com" },
    { name: "Cameron Davies", email: "CDavies@activetunnelling.com" },
    { name: "Ebenezer Bentum", email: "EBentum@activetunnelling.com" },
    { name: "Iosif Beghean", email: "IBeghean@activetunnelling.com" },
    { name: "James Wallace", email: "jwallace@activetunnelling.com" },
    { name: "John Thorpe", email: "jthorpe@activetunnelling.com" },
    { name: "Josh Furner", email: "jfurner@activetunnelling.com" },
    { name: "Kamran Muzaffar", email: "KMuzaffar@activetunnelling.com" },
    { name: "Niall Lynam", email: "NLynam@activetunnelling.com" },
    { name: "Richard Wilson", email: "rwilson@activetunnelling.com" },
    { name: "Rob Graham", email: "RGraham@activetunnelling.com" },
    { name: "Scott Carter", email: "SCarter@activetunnelling.com" }
  ];

  const FORM_REFS = {
    excavator: "QPFPL5.2",
    crane: "QPFPL5.0",
    dumper: "QPFPL5.1"
  };

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
      "Level of exhaust gas after-treatment (e.g. 'Ad Blue')",
      "Operation and fill of auto-lubricating grease systems",
      "Coolant Levels",
      "Visually check for fluid leaks",
      "Air filter vacuum indicator (if fitted)",
      "Hydraulic fluid levels",
      "Drain air tanks",
      "Condition of cab glass, cab windscreen wipers, cab seating, heating and security systems",
      "Windscreen washer reservoirs",
      "Lights, beacons and horn",
      "Correct adjustment and functioning of all mirrors and cameras",
      "Manually grease track rollers if not auto-lubricated",
      "Condition of undercarriage (incl. lubrication, tension, shoes/pins)",
      "Condition and security of all hydraulic hoses",
      "Bolt condition including signs of movement/loosening",
      "Fly jib integrity and security",
      "Correct functioning of hook over-hoist system",
      "Correct operation of RCI (LMI)",
      "Adequate data signal coverage for data upload",
      "Correct functioning and labelling of all controls",
      "Correct functioning of all lifting and slewing systems",
      "Correct functioning of all audible/visible warnings and indicators",
      "Correct functioning of all winch brakes",
      "Correct functioning of all winch clutches",
      "Check hoist and boom pawls for correct function and condition",
      "Condition/security/cleanliness of panelling, ladders, walkways, handrails",
      "Presence and condition of fire extinguishing system",
      "Presence of load charts, operator's manual, required documentation in cab",
      "Grease/lubricate to manufacturer's instructions",
      "Lubricate/maintain ropes and rope system components",
      "Operation of boom and pinning/extension systems (if appropriate)",
      "Battery condition and security (including LV cables)"
    ],
    dumper: [
      "Skip/Body Security",
      "Drop Box",
      "Steps/Handrails",
      "General Cleanliness",
      "Steering/Braking/Handbrake",
      "Hydraulics/Pipework/Controls/Decals",
      "Radiator/Belts",
      "Tracks/Running Gear/Wheels/Tyres",
      "Gauges/Instrumentation",
      "ROPS/FOPS/Bodywork",
      "Operating Position/Seat/Belt",
      "Lights/Beacons",
      "Audible Warnings/Alarms",
      "Battery levels/Condition",
      "Fluid levels All/Greasing",
      "Turntable function",
      "Operators Manual",
      "Transmission",
      "Rated Capacity Plate/Readable"
    ]
  };

  const qs = new URLSearchParams(location.search);
  const TOKEN = qs.get("t") || "";

  let equipmentType = (qs.get("type") || "excavator").toLowerCase();
  if (!["excavator","crane","dumper"].includes(equipmentType)) equipmentType = "excavator";

  let labels = [...CHECKLISTS[equipmentType]];
  let weekStatuses = labels.map(() => Array(7).fill(null));
  let activeDay = 0;
  let lastSubmitStamp = 0;

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
    const day = dt.getDay(); // Sun=0 ... Mon=1
    const diffToMon = (day === 0 ? -6 : 1 - day);
    dt.setDate(dt.getDate() + diffToMon);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
  };

  const getDayIndexMon0 = (dateStr) => {
    const [y,m,d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m-1, d);
    const day = dt.getDay(); // Sun=0
    return day === 0 ? 6 : day - 1; // Mon=0..Sun=6
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

    // form ref per type
    $("formRef").textContent = FORM_REFS[equipmentType] || "QPFPL5.2";

    $("selectedType").textContent = `Selected: ${equipmentType.charAt(0).toUpperCase()}${equipmentType.slice(1)}`;

    const title =
      equipmentType === "excavator" ? "Excavator Pre-Use Inspection Checklist" :
      equipmentType === "crane" ? "Crane Pre-Use Inspection Checklist" :
      "Dumper Pre-Use Inspection Checklist";
    $("sheetTitle").textContent = title;

    const dateISO = $("date").value || isoToday();
    $("weekCommencingPreview").textContent = isoToUK(getWeekCommencingISO(dateISO));

    const pid = ($("plantId").value || "").trim().toUpperCase();
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

    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "— Select person —";
    sel.appendChild(blank);

    RECIPIENTS.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.email;
      opt.textContent = r.name; // show NAME only (cleaner)
      sel.appendChild(opt);
    });
  }

  function toggleRecipients(forceOpen = null) {
    const wrap = $("reportedToWrap");
    const open = (forceOpen === null) ? (wrap.style.display !== "block") : forceOpen;
    wrap.style.display = open ? "block" : "none";
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
  }

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

  async function loadWeekFromKV({ silent = false } = {}) {
    const status = $("status");
    const plantId = ($("plantId").value || "").trim().toUpperCase();
    const dateISO = $("date").value || "";

    setHeaderTexts();

    if (!TOKEN) {
      if (!silent) status.textContent = "⚠️ Missing token (t=...) in link.";
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      renderChecks();
      return;
    }

    if (!plantId || !dateISO) {
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      renderChecks();
      if (!silent) status.textContent = "Ready.";
      return;
    }

    const url =
      `/api/week?t=${encodeURIComponent(TOKEN)}` +
      `&type=${encodeURIComponent(equipmentType)}` +
      `&plantId=${encodeURIComponent(plantId)}` +
      `&date=${encodeURIComponent(dateISO)}`;

    if (!silent) status.textContent = "Loading week…";

    try {
      const { resp, data } = await fetchJson(url, { cache:"no-store" }, 12000);

      if (!resp.ok) {
        labels = [...CHECKLISTS[equipmentType]];
        weekStatuses = labels.map(() => Array(7).fill(null));
        renderChecks();
        if (!silent) status.textContent = `❌ Week load failed (${resp.status}).`;
        return;
      }

      const rec = data.record || null;

      if (rec && Array.isArray(rec.labels) && Array.isArray(rec.statuses)) {
        labels = rec.labels;
        weekStatuses = rec.statuses;
        renderChecks();

        // Don’t overwrite "Submitted" message right after submit
        if (!silent) {
          if (Date.now() - lastSubmitStamp < 4000) {
            status.textContent = "✅ Submitted.";
          } else {
            status.textContent = "✅ Week loaded.";
          }
        }
        return;
      }

      // No record -> keep it simple
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      renderChecks();
      if (!silent) status.textContent = "Ready.";
    } catch (e) {
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      renderChecks();
      if (!silent) status.textContent = "❌ Load error.";
    }
  }

  // submit (keeps your existing backend)
  async function submit() {
    const status = $("status");
    const btn = $("submitBtn");

    const plantId = ($("plantId").value || "").trim().toUpperCase();
    const dateISO = $("date").value || "";
    const site = ($("site").value || "").trim();
    const operator = ($("operator").value || "").trim();
    const hours = ($("hours").value || "").trim();

    const reportedToEmail = $("reportedTo").value || "";
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
      hours, // machine hours
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
    status.textContent = "Submitting…";

    try {
      // Your backend creates/sends PDF - keep as-is
      const { resp, data } = await fetchJson("/api/submit", {
        method: "POST",
        headers: { "content-type":"application/json" },
        body: JSON.stringify({ token: TOKEN, payload })
      }, 30000);

      if (!resp.ok) {
        status.textContent = `❌ Submit failed (${resp.status}): ${data.error || "Unknown"}`;
        btn.disabled = false;
        return;
      }

      lastSubmitStamp = Date.now();
      status.textContent = "✅ Submitted.";
      btn.disabled = false;

      // refresh silently (don’t change status)
      await loadWeekFromKV({ silent: true });

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

    // Plant ID: UPPERCASE while typing
    $("plantId").addEventListener("input", (e) => {
      const el = e.target;
      const s = el.selectionStart;
      const t = el.selectionEnd;
      el.value = (el.value || "").toUpperCase();
      try { el.setSelectionRange(s, t); } catch {}
      setHeaderTexts();
    });
    $("plantId").addEventListener("blur", loadWeekFromKV);

    // Reported to button -> show/hide list
    $("openRecipients").addEventListener("click", () => toggleRecipients());

    // When pick a person, collapse dropdown and show preview
    $("reportedTo").addEventListener("change", () => {
      const email = $("reportedTo").value;
      const name = (RECIPIENTS.find(r => r.email === email)?.name) || "";
      $("reportedToPreview").value = name || "";
      toggleRecipients(false);
    });

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
