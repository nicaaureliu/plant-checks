/* public/app.js */
(() => {
  const BUILD = "v13.2";
  const $ = (id) => document.getElementById(id);

  const RECIPIENTS = [
    { name: "Choose from", email: "" },
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
      "Condition of undercarriage (including lubrication of sprockets, tumblers and rollers, tension of tracks and condition of shoes, tracks, pins)",
      "Condition and security of all hydraulic hoses",
      "Bolt condition including signs of movement/loosening",
      "Fly jib integrity and security",
      "Correct functioning of hook over-hoist system",
      "Correct operation of RCI (LMI)",
      "Adequate data signal coverage for data upload",
      "Correct functioning and labelling of all controls",
      "Correct functioning of all lifting and slewing systems",
      "Correct functioning of all audible /visible warnings and indicators",
      "Correct functioning of all winch brakes",
      "Correct functioning of all winch clutches",
      "Check hoist and boom pawls for correct function and condition",
      "Condition, security and cleanliness of all crane panelling, ladders, walkways, handrails",
      "Presence and condition of fire extinguishing system",
      "Presence of crane specific load charts, operator's manual and other required documentation in cab",
      "Grease and lubricate to manufacturer's instructions",
      "Lubricate and maintain ropes and all rope system components",
      "Operation of boom and pinning/extension systems if appropriate",
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

  // Force through selector if type missing (prevents miscompletes)
  if (!qs.get("type") && TOKEN) {
    location.replace(`/selector.html?t=${encodeURIComponent(TOKEN)}`);
    return;
  }

  const LOCK_TYPE = !!qs.get("type");

  let equipmentType = (qs.get("type") || "excavator").toLowerCase();
  if (!["excavator", "crane", "dumper"].includes(equipmentType)) equipmentType = "excavator";

  let labels = [...CHECKLISTS[equipmentType]];
  let weekStatuses = labels.map(() => Array(7).fill(null));
  let weekDaily = Array(7).fill(null);

  // Photos are local-only: photos[row][day] = [dataUrl, ...]
  let photos = labels.map(() => Array(7).fill(null).map(() => []));

  let activeDay = 0;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const ENH_STYLE_ID = "plantChecksEnhancementsStyle";
  const TIP_CYCLE_KEY = "plantchecks_tip_cycle_v1";
  let toastTimer = null;

  const isoToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const isoToUK = (iso) => {
    if (!iso || !String(iso).includes("-")) return iso || "";
    const [y, m, d] = String(iso).split("-");
    return `${d}/${m}/${y}`;
  };

  const getWeekCommencingISO = (dateStr) => {
    const [y, m, d] = String(dateStr).split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const day = dt.getDay();
    const diffToMon = (day === 0 ? -6 : 1 - day);
    dt.setDate(dt.getDate() + diffToMon);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  };

  const getDayIndexMon0 = (dateStr) => {
    const [y, m, d] = String(dateStr).split("-").map(Number);
    const dt = new Date(y, m - 1, d);
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

  const cleanedPlantId = () => {
    const v = ($("plantId")?.value || "");
    return v.replace(/\s+/g, "").trim().toUpperCase();
  };

  const canEditChecks = () => {
    return !!cleanedPlantId();
  };

  function showAppRoot() {
    $("appRoot")?.classList.remove("hidden");
    $("typeGate")?.classList.add("hidden");
    $("successScreen")?.classList.add("hidden");
  }

  function injectEnhancementStyles() {
    if (document.getElementById(ENH_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = ENH_STYLE_ID;
    style.textContent = `
      /* Active day highlight */
      .tableWrap thead th.activeDay {
        background: rgba(255,214,0,.55) !important;
      }
      .tableWrap tbody td.activeDay {
        background: rgba(255,214,0,.12) !important;
      }
      .tableWrap tbody td.activeDay .markBtn {
        border-color: rgba(0,0,0,.55) !important;
      }

      /* Sticky header (page scroll) */
      .tableWrap { overflow: visible !important; }
      .tableWrap thead th {
        position: sticky;
        top: 0;
        z-index: 5;
      }

      /* Bigger tap targets */
      .markBtn{
        width:44px !important;
        height:38px !important;
        border-radius:12px !important;
      }
      .mobileBtn{
        min-width:64px !important;
        height:44px !important;
        border-radius:14px !important;
      }

      /* Progress line */
      #progressLine{
        margin:0 6px 12px;
        font-weight:900;
        color:var(--muted);
      }
      #progressLine .strong{ color:var(--text); }

      /* Date "Today" pill */
      #todayPill{
        display:inline-block;
        margin-left:8px;
        font-size:12px;
        font-weight:900;
        padding:3px 8px;
        border-radius:999px;
        background: rgba(255,214,0,.55);
        border: 1px solid rgba(0,0,0,.18);
        vertical-align: middle;
      }

      /* Required plant id hint */
      #plantId.req{
        border-color:#dc2626 !important;
        box-shadow: 0 0 0 3px rgba(220,38,38,.10);
      }

      /* Header hierarchy tweak */
      .formRef{ font-size:22px !important; }
      .sheetTitle{ font-size:20px !important; }

      /* Toast */
      .pcToast{
        position:fixed;
        left:50%;
        transform:translateX(-50%);
        bottom:16px;
        z-index:99999;
        background:#111;
        color:#fff;
        padding:10px 12px;
        border-radius:14px;
        font-weight:900;
        font-size:13px;
        box-shadow:0 12px 30px rgba(0,0,0,.24);
        max-width:calc(100% - 24px);
        text-align:center;
      }
    `;
    document.head.appendChild(style);
  }

  function showToast(msg, ms = 2600) {
    let el = document.getElementById("pcToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "pcToast";
      el.className = "pcToast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = "block";

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      const t = document.getElementById("pcToast");
      if (t) t.style.display = "none";
    }, ms);
  }

  function ensureProgressLine() {
    if (document.getElementById("progressLine")) return;
    const help = document.querySelector(".checksHelp");
    if (!help || !help.parentElement) return;

    const line = document.createElement("div");
    line.id = "progressLine";
    line.textContent = "";
    help.insertAdjacentElement("afterend", line);
  }

  function updateHelpText() {
    const help = document.querySelector(".checksHelp");
    if (!help) return;

    help.textContent =
      "Only the column for your selected date is editable. Tap the same box to cycle ✓ → X → N/A → blank.";
  }

  function ensureTodayPill() {
    const label = document.querySelector('label[for="date"]');
    if (!label) return;

    let pill = document.getElementById("todayPill");
    if (!pill) {
      pill = document.createElement("span");
      pill.id = "todayPill";
      pill.textContent = "";
      label.appendChild(pill);
    }
  }

  function updateTodayPill() {
    ensureTodayPill();
    const pill = document.getElementById("todayPill");
    if (!pill) return;

    const dateISO = ($("date")?.value) || isoToday();
    activeDay = getDayIndexMon0(dateISO);
    pill.textContent = `Today: ${days[activeDay]}`;
  }

  function updateActiveDayHighlight() {
    const table = document.querySelector(".tableWrap table");
    if (!table) return;

    const ths = table.querySelectorAll("thead th");
    ths.forEach((th, i) => {
      th.classList.toggle("activeDay", i === activeDay + 1);
    });

    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((tr) => {
      const tds = tr.querySelectorAll("td");
      tds.forEach((td, i) => {
        td.classList.toggle("activeDay", i === activeDay + 1);
      });
    });
  }

  function progressForDay(dayIndex) {
    const total = labels.length;
    let done = 0;
    let defects = 0;

    for (let r = 0; r < labels.length; r++) {
      const st = weekStatuses?.[r]?.[dayIndex] || null;
      if (st) done++;
      if (st === "DEFECT") defects++;
    }

    return { total, done, defects, remaining: Math.max(0, total - done) };
  }

  function updateProgressLine() {
    ensureProgressLine();
    const el = document.getElementById("progressLine");
    if (!el) return;

    const dateISO = ($("date")?.value) || isoToday();
    activeDay = getDayIndexMon0(dateISO);

    const p = progressForDay(activeDay);
    const dayName = days[activeDay];

    el.innerHTML =
      `<span class="strong">${dayName}</span>: ` +
      `<span class="strong">${p.done}</span>/${p.total} complete` +
      ` • Defects: <span class="strong">${p.defects}</span>` +
      ` • Remaining: <span class="strong">${p.remaining}</span>`;
  }

  function updatePlantIdRequiredState() {
    const pidEl = $("plantId");
    if (!pidEl) return;

    const ok = canEditChecks();
    pidEl.classList.toggle("req", !ok);
  }

  function maybeWarnPlantId() {
    const statusEl = $("status");
    if (!statusEl) return;

    if (!canEditChecks()) {
      statusEl.innerHTML = `<span class="bad">✖ Enter Machine / Plant ID to enable checks</span>`;
    } else if (statusEl.textContent.includes("Enter Machine / Plant ID")) {
      statusEl.textContent = "Ready.";
    }
  }

  function updateEnhancements() {
    injectEnhancementStyles();
    updateHelpText();
    updateTodayPill();
    updateProgressLine();
    updateActiveDayHighlight();
    updatePlantIdRequiredState();
    maybeWarnPlantId();
  }

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

  async function compressImageToDataUrl(file, maxW = 1600, quality = 0.82) {
    const original = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = original;
    });

    const scale = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);

    return canvas.toDataURL("image/jpeg", quality);
  }

  function setButtonsActive() {
    const a = $("btnExc"), b = $("btnCrane"), c = $("btnDump");
    if (!a || !b || !c) return;
    a.classList.toggle("active", equipmentType === "excavator");
    b.classList.toggle("active", equipmentType === "crane");
    c.classList.toggle("active", equipmentType === "dumper");
  }

  function setHeaderTexts() {
    if ($("buildTag")) $("buildTag").textContent = `BUILD: ${BUILD}`;
    if ($("selectedType")) $("selectedType").textContent = `Selected: ${equipmentType.charAt(0).toUpperCase()}${equipmentType.slice(1)}`;

    const title =
      equipmentType === "excavator" ? "Excavator Pre-Use Inspection Checklist" :
      equipmentType === "crane" ? "Crane Pre-Use Inspection Checklist" :
      "Dumper Pre-Use Inspection Checklist";
    if ($("sheetTitle")) $("sheetTitle").textContent = title;

    const formRef =
      equipmentType === "excavator" ? "QPFPL5.2" :
      equipmentType === "crane" ? "QPFPL5.0" :
      "QPFPL5.1";
    if ($("formRef")) $("formRef").textContent = formRef;

    const dateISO = ($("date")?.value) || isoToday();
    if ($("weekCommencingPreview")) $("weekCommencingPreview").textContent = isoToUK(getWeekCommencingISO(dateISO));

    const pid = cleanedPlantId();
    if ($("machineNoPreview")) $("machineNoPreview").textContent = pid || "—";
  }

  function fillRecipients() {
    const sel = $("reportedTo");
    if (!sel) return;
    sel.innerHTML = "";
    RECIPIENTS.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.email;
      opt.textContent = r.name;
      sel.appendChild(opt);
    });
    sel.value = "";
  }

  function lockTypeUI() {
    const a = $("btnExc"), b = $("btnCrane"), c = $("btnDump");
    if (a) a.style.display = "none";
    if (b) b.style.display = "none";
    if (c) c.style.display = "none";
    const wrap = (a && a.parentElement) || (b && b.parentElement) || (c && c.parentElement);
    if (wrap) wrap.style.display = "none";
  }

  function makePhotoControls(rowIndex, dayIndex, rerender) {
    const wrap = document.createElement("div");
    wrap.style.marginTop = "6px";
    wrap.style.display = "flex";
    wrap.style.gap = "8px";
    wrap.style.flexWrap = "wrap";
    wrap.style.alignItems = "center";

    const count = (photos?.[rowIndex]?.[dayIndex] || []).length;

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = count ? `Photos (${count})` : "Add photo";
    addBtn.style.fontSize = "12px";
    addBtn.style.fontWeight = "800";
    addBtn.style.padding = "6px 10px";
    addBtn.style.borderRadius = "10px";
    addBtn.style.border = "1px solid #e5e7eb";
    addBtn.style.background = "#fff";

    addBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.capture = "environment";
      input.onchange = async () => {
        const f = input.files?.[0];
        if (!f) return;
        try {
          const small = await compressImageToDataUrl(f);
          photos[rowIndex][dayIndex].push(small);
          rerender();
        } catch {
          rerender();
        }
      };
      input.click();
    });

    wrap.appendChild(addBtn);

    if (count) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.textContent = "Clear photos";
      clearBtn.style.fontSize = "12px";
      clearBtn.style.fontWeight = "800";
      clearBtn.style.padding = "6px 10px";
      clearBtn.style.borderRadius = "10px";
      clearBtn.style.border = "1px solid #e5e7eb";
      clearBtn.style.background = "#f3f4f6";
      clearBtn.addEventListener("click", () => {
        photos[rowIndex][dayIndex] = [];
        rerender();
      });
      wrap.appendChild(clearBtn);
    }

    return wrap;
  }

  function renderTable() {
    const dateISO = ($("date")?.value) || isoToday();
    activeDay = getDayIndexMon0(dateISO);

    const tbody = $("checksBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const allow = canEditChecks();

    labels.forEach((label, r) => {
      const tr = document.createElement("tr");

      const tdItem = document.createElement("td");
      tdItem.className = "item";

      const labelDiv = document.createElement("div");
      labelDiv.textContent = label;
      tdItem.appendChild(labelDiv);

      const todayStatus = weekStatuses?.[r]?.[activeDay] || null;
      if (todayStatus === "DEFECT") {
        tdItem.appendChild(makePhotoControls(r, activeDay, () => renderTable()));
      }

      tr.appendChild(tdItem);

      for (let d = 0; d < 7; d++) {
        const td = document.createElement("td");
        td.className = "day";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "markBtn";
        btn.textContent = markText(weekStatuses?.[r]?.[d] || null);

        const isToday = d === activeDay;

        if (!isToday || !allow) {
          btn.classList.add("disabled");
          btn.disabled = true;
          if (isToday && !allow) btn.title = "Enter Machine / Plant ID to enable checks";
        } else {
          btn.addEventListener("click", () => {
            const cur = weekStatuses?.[r]?.[d] || null;
            const next = cycleStatus(cur);
            weekStatuses[r][d] = next;

            if (next !== "DEFECT") photos[r][d] = [];

            btn.textContent = markText(next);
            renderTable();
            if (isMobile()) renderMobileList();

            updateProgressLine();
            updateActiveDayHighlight();

            if (!localStorage.getItem(TIP_CYCLE_KEY)) {
              showToast("Tip: tap the same box to cycle ✓ → X → N/A → blank");
              localStorage.setItem(TIP_CYCLE_KEY, "1");
            }
          });
        }

        td.appendChild(btn);
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    });

    updateActiveDayHighlight();
    updateProgressLine();
  }

  function renderMobileList() {
    const dateISO = ($("date")?.value) || isoToday();
    activeDay = getDayIndexMon0(dateISO);

    const wrap = $("mobileChecks");
    if (!wrap) return;
    wrap.innerHTML = "";

    const allow = canEditChecks();

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

      if (!allow) {
        btn.classList.add("disabled");
        btn.disabled = true;
        btn.title = "Enter Machine / Plant ID to enable checks";
      } else {
        btn.addEventListener("click", () => {
          const cur = weekStatuses?.[r]?.[activeDay] || null;
          const next = cycleStatus(cur);
          weekStatuses[r][activeDay] = next;

          if (next !== "DEFECT") photos[r][activeDay] = [];

          btn.textContent = markText(next);
          renderMobileList();
          if (!isMobile()) renderTable();

          updateProgressLine();

          if (!localStorage.getItem(TIP_CYCLE_KEY)) {
            showToast("Tip: tap the same box to cycle ✓ → X → N/A → blank");
            localStorage.setItem(TIP_CYCLE_KEY, "1");
          }
        });
      }

      row.appendChild(lab);
      row.appendChild(btn);

      const st = weekStatuses?.[r]?.[activeDay] || null;
      if (st === "DEFECT") {
        row.appendChild(makePhotoControls(r, activeDay, () => renderMobileList()));
      }

      wrap.appendChild(row);
    });

    updateProgressLine();
  }

  function renderChecks() {
    if (isMobile()) renderMobileList();
    else renderTable();
  }

  function applyDailyToInputs() {
    const d = weekDaily?.[activeDay] || null;
    if (!d) return;

    if ($("site")) $("site").value = d.site || $("site").value || "";
    if ($("operator")) $("operator").value = d.operator || "";
    if ($("hours")) $("hours").value = d.hours || "";
    if ($("defectsText")) $("defectsText").value = d.defectsText || "";
    if ($("actionTaken")) $("actionTaken").value = d.actionTaken || "";
    if ($("reportedTo") && d.reportedToEmail) $("reportedTo").value = d.reportedToEmail;
  }

  // -------- Signature pad --------
  function initSignature() {
    const canvas = $("sig");
    if (!canvas) return;
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

    const clearBtn = $("clearSig");
    if (clearBtn) clearBtn.addEventListener("click", () => ctx.clearRect(0, 0, canvas.width, canvas.height));
  }

  function signatureDataUrl() {
    const canvas = $("sig");
    if (!canvas) return "";
    const ctx = canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasInk = false;
    for (let i = 0; i < img.length; i += 4) {
      if (img[i + 3] !== 0) { hasInk = true; break; }
    }
    if (!hasInk) return "";
    return canvas.toDataURL("image/png");
  }

  // -------- Load week from KV --------
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

  async function loadWeekFromKV() {
    const status = $("status");

    const plantId = cleanedPlantId();
    const dateISO = ($("date")?.value) || "";

    setHeaderTexts();
    activeDay = getDayIndexMon0(dateISO);

    if (!TOKEN || !plantId || !dateISO) {
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      weekDaily = Array(7).fill(null);
      photos = labels.map(() => Array(7).fill(null).map(() => []));
      renderChecks();
      if (status) status.innerHTML = TOKEN ? "Ready." : `<span class="bad">✖ Missing token (t=...)</span>`;
      updateEnhancements();
      return;
    }

    const url = `/api/week?t=${encodeURIComponent(TOKEN)}&type=${encodeURIComponent(equipmentType)}&plantId=${encodeURIComponent(plantId)}&date=${encodeURIComponent(dateISO)}`;
    if (status) status.textContent = "Loading week…";

    try {
      const { resp, data } = await fetchJson(url, { cache: "no-store" }, 12000);

      if (!resp.ok) {
        labels = [...CHECKLISTS[equipmentType]];
        weekStatuses = labels.map(() => Array(7).fill(null));
        weekDaily = Array(7).fill(null);
        photos = labels.map(() => Array(7).fill(null).map(() => []));
        renderChecks();
        if (status) status.innerHTML = `<span class="bad">✖ Week load failed (${resp.status})</span>`;
        updateEnhancements();
        return;
      }

      const rec = data.record || null;
      if (rec && Array.isArray(rec.labels) && Array.isArray(rec.statuses)) {
        labels = rec.labels;
        weekStatuses = rec.statuses;
        weekDaily = Array.isArray(rec.daily) ? rec.daily : Array(7).fill(null);

        // Photos are PDF-only; always start blank on load
        photos = labels.map(() => Array(7).fill(null).map(() => []));

        // Carry week-level site into daily defaults if present
        if (rec.site) {
          for (let i = 0; i < 7; i++) {
            if (!weekDaily[i]) weekDaily[i] = {};
            if (!weekDaily[i].site) weekDaily[i].site = rec.site;
          }
        }

        renderChecks();
        applyDailyToInputs();
        if (status) status.textContent = "Ready.";
        updateEnhancements();
      } else {
        labels = [...CHECKLISTS[equipmentType]];
        weekStatuses = labels.map(() => Array(7).fill(null));
        weekDaily = Array(7).fill(null);
        photos = labels.map(() => Array(7).fill(null).map(() => []));
        renderChecks();
        if (status) status.textContent = "Ready.";
        updateEnhancements();
      }
    } catch {
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      weekDaily = Array(7).fill(null);
      photos = labels.map(() => Array(7).fill(null).map(() => []));
      renderChecks();
      if (status) status.innerHTML = `<span class="bad">✖ Load error</span>`;
      updateEnhancements();
    }
  }

  // -------- PDF + Submit --------
  // NOTE: PDF code is unchanged from your existing version in v13.0
  // If you already have it in your file, keep it as-is.
  // This v13.2 code focuses on UI behaviour only.

  // -------- Submit --------
  async function submit() {
    const statusEl = $("status");
    const btn = $("submitBtn");

    let plantId = ($("plantId")?.value || "");
    plantId = plantId.replace(/\s+/g, "").toUpperCase();
    if ($("plantId")) $("plantId").value = plantId;

    const dateISO = ($("date")?.value) || "";
    const site = ($("site")?.value || "").trim();
    const operator = ($("operator")?.value || "").trim();
    const hours = ($("hours")?.value || "").trim();

    const reportedToEmail = $("reportedTo")?.value || "";
    const reportedToName = (RECIPIENTS.find(r => r.email === reportedToEmail)?.name) || "";

    if (!TOKEN) { if (statusEl) statusEl.innerHTML = `<span class="bad">✖ Missing token (t=...)</span>`; return; }
    if (!plantId || !dateISO) { if (statusEl) statusEl.innerHTML = `<span class="bad">✖ Plant ID and Date are required</span>`; return; }
    if (!reportedToEmail) { if (statusEl) statusEl.innerHTML = `<span class="bad">✖ Please select ‘Reported to’</span>`; return; }

    const weekCommencing = getWeekCommencingISO(dateISO);
    const dayIndex = getDayIndexMon0(dateISO);

    // Collect DEFECT photos for TODAY only (unlimited)
    const defectPhotosForPdf = [];
    for (let r = 0; r < labels.length; r++) {
      const st = weekStatuses?.[r]?.[dayIndex] || null;
      if (st !== "DEFECT") continue;

      const arr = photos?.[r]?.[dayIndex] || [];
      for (const p of arr) {
        if (typeof p === "string" && p.startsWith("data:image/")) {
          defectPhotosForPdf.push({ rowIndex: r, label: labels[r], dataUrl: p });
        }
      }
    }

    const payload = {
      formRef: $("formRef")?.textContent || "",
      sheetTitle: $("sheetTitle")?.textContent || "",
      equipmentType,
      site,
      date: dateISO,
      plantId,
      operator,
      hours,
      weekCommencing,
      dayIndex,
      labels,
      weekStatuses,
      defectsText: ($("defectsText")?.value || "").trim(),
      reportedToName,
      reportedToEmail,
      actionTaken: ($("actionTaken")?.value || "").trim(),
      signatureDataUrl: signatureDataUrl()
    };

    if (btn) btn.disabled = true;
    if (statusEl) statusEl.textContent = "Building PDF…";

    try {
      // your existing makePdfBase64 must exist (kept from v13.0)
      const pdfBase64 = await makePdfBase64(payload, defectPhotosForPdf);

      if (statusEl) statusEl.textContent = "Submitting…";

      const { resp, data } = await fetchJson("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: TOKEN, payload, pdfBase64 })
      }, 30000);

      if (!resp.ok) {
        if (statusEl) statusEl.innerHTML = `<span class="bad">✖ Submit failed (${resp.status}): ${data.error || "Unknown"}</span>`;
        if (btn) btn.disabled = false;
        return;
      }

      if (btn) btn.disabled = false;

      const url =
        `/submitted.html?t=${encodeURIComponent(TOKEN)}` +
        `&type=${encodeURIComponent(equipmentType)}` +
        `&plantId=${encodeURIComponent(plantId)}` +
        `&date=${encodeURIComponent(dateISO)}`;

      location.href = url;
      return;

    } catch (e) {
      if (statusEl) statusEl.innerHTML = `<span class="bad">✖ ${e?.message || "Error"}</span>`;
      if (btn) btn.disabled = false;
    }
  }

  // -------- Wire events --------
  function wireEvents() {
    if (!LOCK_TYPE) {
      $("btnExc")?.addEventListener("click", async () => {
        showAppRoot();
        equipmentType = "excavator";
        labels = [...CHECKLISTS[equipmentType]];
        weekStatuses = labels.map(() => Array(7).fill(null));
        weekDaily = Array(7).fill(null);
        photos = labels.map(() => Array(7).fill(null).map(() => []));
        setButtonsActive();
        setHeaderTexts();
        renderChecks();
        updateEnhancements();
        await loadWeekFromKV();
      });

      $("btnCrane")?.addEventListener("click", async () => {
        showAppRoot();
        equipmentType = "crane";
        labels = [...CHECKLISTS[equipmentType]];
        weekStatuses = labels.map(() => Array(7).fill(null));
        weekDaily = Array(7).fill(null);
        photos = labels.map(() => Array(7).fill(null).map(() => []));
        setButtonsActive();
        setHeaderTexts();
        renderChecks();
        updateEnhancements();
        await loadWeekFromKV();
      });

      $("btnDump")?.addEventListener("click", async () => {
        showAppRoot();
        equipmentType = "dumper";
        labels = [...CHECKLISTS[equipmentType]];
        weekStatuses = labels.map(() => Array(7).fill(null));
        weekDaily = Array(7).fill(null);
        photos = labels.map(() => Array(7).fill(null).map(() => []));
        setButtonsActive();
        setHeaderTexts();
        renderChecks();
        updateEnhancements();
        await loadWeekFromKV();
      });
    }

    $("date")?.addEventListener("change", () => {
      setHeaderTexts();
      renderChecks();
      updateEnhancements();
      loadWeekFromKV();
    });

    $("plantId")?.addEventListener("input", () => {
      const cleaned = ($("plantId").value || "").replace(/\s+/g, "").toUpperCase();
      if ($("plantId").value !== cleaned) $("plantId").value = cleaned;

      setHeaderTexts();
      updatePlantIdRequiredState();
      maybeWarnPlantId();

      renderChecks();
      updateEnhancements();
    });

    $("plantId")?.addEventListener("blur", () => {
      updatePlantIdRequiredState();
      maybeWarnPlantId();
      loadWeekFromKV();
    });

    window.addEventListener("resize", () => {
      renderChecks();
      updateEnhancements();
    });

    $("submitBtn")?.addEventListener("click", submit);
  }

  // -------- Init --------
  (function init() {
    showAppRoot();               // <<< ensures app is visible, no blank page
    injectEnhancementStyles();

    if ($("buildTag")) $("buildTag").textContent = `BUILD: ${BUILD}`;

    fillRecipients();
    initSignature();
    wireEvents();

    if ($("date") && !$("date").value) $("date").value = isoToday();

    setButtonsActive();
    if (LOCK_TYPE) lockTypeUI();

    setHeaderTexts();
    renderChecks();
    updateEnhancements();
    loadWeekFromKV();
  })();
})();
