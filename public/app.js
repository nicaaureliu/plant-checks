/* public/app.js */
(() => {
  const BUILD = "v13.5";
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

  const STYLE_ID = "plantChecksStatusButtonsStyle";

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

  function cleanedPlantId() {
    const v = ($("plantId")?.value || "");
    return v.replace(/\s+/g, "").trim().toUpperCase();
  }

  function showAppRoot() {
    $("appRoot")?.classList.remove("hidden");
    $("typeGate")?.classList.add("hidden");
    $("successScreen")?.classList.add("hidden");
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* Make selected option stand out; other two go grey but remain clickable */
      .statusGroup, .mobileStatusGroup{
        display:flex;
        justify-content:center;
        gap:10px;
      }
      .mobileStatusGroup{ justify-content:flex-end; }

      .statusBtn{
        min-width:44px;
        height:38px;
        padding:0 12px;
        border-radius:14px;
        border:1px solid var(--line);
        background:#fff;
        font-weight:900;
        cursor:pointer;
        line-height:1;
        transition: transform .05s ease, opacity .1s ease, box-shadow .12s ease, border-color .12s ease, background .12s ease;
      }
      .statusBtn.na{ min-width:60px; }

      .statusBtn.active{
        border-color: rgba(0,0,0,.75);
        box-shadow: 0 0 0 4px rgba(255,214,0,.22);
        background: rgba(255,214,0,.18);
        transform: translateY(-1px);
      }

      /* Grey out the other options when one is selected */
      .statusBtn.inactive{
        opacity:.35;
        background: #f3f4f6;
      }

      /* Disabled state (used for non-active days) */
      .statusBtn.disabled{
        opacity:.30;
        cursor:not-allowed;
      }

      /* Old single button (display-only for other days) */
      .markBtn{
        width:44px !important;
        height:38px !important;
        border-radius:14px !important;
      }
    `;
    document.head.appendChild(style);
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

    // Clean/simple help text (no “freezed” bar)
    const help = document.querySelector(".checksHelp");
    if (help) {
      help.textContent = "Only the column for your selected date is editable. Select ✓ OK, X Defect, or N/A.";
    }
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

  function setStatus(r, d, next) {
    const cur = weekStatuses?.[r]?.[d] || null;

    // Tap same option again => clear
    const newStatus = (cur === next) ? null : next;
    weekStatuses[r][d] = newStatus;

    // If not DEFECT, wipe photos for that row/day
    if (newStatus !== "DEFECT") photos[r][d] = [];
  }

  function makeStatusGroup(current, onPick, disabled, isMobileGroup = false) {
    const wrap = document.createElement("div");
    wrap.className = isMobileGroup ? "mobileStatusGroup" : "statusGroup";

    const mk = (label, status, extraClass = "") => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `statusBtn ${extraClass}`.trim();
      b.textContent = label;

      if (disabled) {
        b.classList.add("disabled");
        b.disabled = true;
      } else {
        b.addEventListener("click", () => onPick(status));
      }

      return b;
    };

    const bOk = mk("✓", "OK");
    const bDef = mk("X", "DEFECT");
    const bNa = mk("N/A", "NA", "na");

    wrap.appendChild(bOk);
    wrap.appendChild(bDef);
    wrap.appendChild(bNa);

    // Visual rules:
    // - If one is selected: selected = active, others = inactive (grey)
    // - If none selected: all normal
    if (current) {
      const all = [bOk, bDef, bNa];
      all.forEach((b) => b.classList.remove("active", "inactive"));

      const activeBtn =
        current === "OK" ? bOk :
        current === "DEFECT" ? bDef :
        bNa;

      activeBtn.classList.add("active");
      all.filter((x) => x !== activeBtn).forEach((x) => x.classList.add("inactive"));
    }

    return wrap;
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

    labels.forEach((label, r) => {
      const tr = document.createElement("tr");

      const tdItem = document.createElement("td");
      tdItem.className = "item";

      const labelDiv = document.createElement("div");
      labelDiv.textContent = label;
      tdItem.appendChild(labelDiv);

      const todayStatus = weekStatuses?.[r]?.[activeDay] || null;
      if (todayStatus === "DEFECT") {
        tdItem.appendChild(makePhotoControls(r, activeDay, () => {
          renderTable();
          if (isMobile()) renderMobileList();
        }));
      }

      tr.appendChild(tdItem);

      for (let d = 0; d < 7; d++) {
        const td = document.createElement("td");
        td.className = "day";

        const isToday = d === activeDay;
        if (isToday) {
          const current = weekStatuses?.[r]?.[d] || null;
          const group = makeStatusGroup(
            current,
            (picked) => {
              setStatus(r, d, picked);
              renderTable();
              if (isMobile()) renderMobileList();
            },
            false
          );
          td.appendChild(group);
        } else {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "markBtn disabled";
          btn.disabled = true;
          btn.textContent = markText(weekStatuses?.[r]?.[d] || null);
          td.appendChild(btn);
        }

        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    });
  }

  function renderMobileList() {
    const dateISO = ($("date")?.value) || isoToday();
    activeDay = getDayIndexMon0(dateISO);

    const wrap = $("mobileChecks");
    if (!wrap) return;
    wrap.innerHTML = "";

    labels.forEach((label, r) => {
      const row = document.createElement("div");
      row.className = "mobileRow";

      const lab = document.createElement("div");
      lab.className = "mobileLabel";
      lab.textContent = label;

      const current = weekStatuses?.[r]?.[activeDay] || null;

      const group = makeStatusGroup(
        current,
        (picked) => {
          setStatus(r, activeDay, picked);
          renderMobileList();
          if (!isMobile()) renderTable();
        },
        false,
        true
      );

      row.appendChild(lab);
      row.appendChild(group);

      const st = weekStatuses?.[r]?.[activeDay] || null;
      if (st === "DEFECT") {
        row.appendChild(makePhotoControls(r, activeDay, () => {
          renderMobileList();
          if (!isMobile()) renderTable();
        }));
      }

      wrap.appendChild(row);
    });
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
        return;
      }

      const rec = data.record || null;
      if (rec && Array.isArray(rec.labels) && Array.isArray(rec.statuses)) {
        labels = rec.labels;
        weekStatuses = rec.statuses;
        weekDaily = Array.isArray(rec.daily) ? rec.daily : Array(7).fill(null);

        // Photos are PDF-only; always start blank on load
        photos = labels.map(() => Array(7).fill(null).map(() => []));

        if (rec.site) {
          for (let i = 0; i < 7; i++) {
            if (!weekDaily[i]) weekDaily[i] = {};
            if (!weekDaily[i].site) weekDaily[i].site = rec.site;
          }
        }

        renderChecks();
        applyDailyToInputs();
        if (status) status.textContent = "Ready.";
      } else {
        labels = [...CHECKLISTS[equipmentType]];
        weekStatuses = labels.map(() => Array(7).fill(null));
        weekDaily = Array(7).fill(null);
        photos = labels.map(() => Array(7).fill(null).map(() => []));
        renderChecks();
        if (status) status.textContent = "Ready.";
      }
    } catch {
      labels = [...CHECKLISTS[equipmentType]];
      weekStatuses = labels.map(() => Array(7).fill(null));
      weekDaily = Array(7).fill(null);
      photos = labels.map(() => Array(7).fill(null).map(() => []));
      renderChecks();
      if (status) status.innerHTML = `<span class="bad">✖ Load error</span>`;
    }
  }

  // -------- PDF: checklist page + unlimited photo pages --------
  async function makePdfBase64(payload, defectPhotos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

    const margin = 28;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const tableW = pageW - margin * 2;

    const isoToUK2 = (iso) => {
      if (!iso || !String(iso).includes("-")) return iso || "";
      const [y, m, d] = String(iso).split("-");
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

    async function cropToBoxDataUrl(dataUrl, targetWpx, targetHpx, quality = 0.84) {
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = String(dataUrl);
      });

      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;

      const scale = Math.max(targetWpx / srcW, targetHpx / srcH);
      const drawW = Math.round(srcW * scale);
      const drawH = Math.round(srcH * scale);
      const dx = Math.round((targetWpx - drawW) / 2);
      const dy = Math.round((targetHpx - drawH) / 2);

      const canvas = document.createElement("canvas");
      canvas.width = targetWpx;
      canvas.height = targetHpx;

      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, dx, dy, drawW, drawH);

      return canvas.toDataURL("image/jpeg", quality);
    }

    async function addImageFillBox(dataUrl, x, y, wPt, hPt) {
      const pxW = Math.max(600, Math.round(wPt * 2.4));
      const pxH = Math.max(420, Math.round(hPt * 2.4));
      const cropped = await cropToBoxDataUrl(dataUrl, pxW, pxH, 0.84);
      doc.addImage(cropped, "JPEG", x, y, wPt, hPt);
    }

    function drawOkTick(cx, cy) {
      doc.setFont("zapfdingbats", "normal");
      doc.setFontSize(13);
      doc.text(String.fromCharCode(52), cx, cy, { align: "center", baseline: "middle" });
    }

    function drawMark(status, cx, cy) {
      if (status === "OK") return drawOkTick(cx, cy);
      doc.setFont("helvetica", "bold");
      if (status === "DEFECT") {
        doc.setFontSize(10);
        doc.text("X", cx, cy, { align: "center", baseline: "middle" });
        return;
      }
      if (status === "NA") {
        doc.setFontSize(7.2);
        doc.text("N/A", cx, cy, { align: "center", baseline: "middle" });
      }
    }

    const dateUK = isoToUK2(payload.date || "");
    const weekUK = isoToUK2(payload.weekCommencing || "");

    const labels2 = payload.labels || [];
    const weekStatuses2 = payload.weekStatuses || labels2.map(() => Array(7).fill(null));

    // ---------------- PAGE 1 ----------------
    let y = margin;

    const atl = await fetchAsDataUrl("/assets/atl-logo.png");
    const tp = await fetchAsDataUrl("/assets/tp.png");

    const leftBoxW = 150, leftBoxH = 40;
    const rightBoxW = 56, rightBoxH = 56;

    if (atl) {
      try {
        const s = await getImageSize(atl);
        const fitted = fitIntoBox(s.w, s.h, leftBoxW, leftBoxH);
        doc.addImage(atl, "PNG", margin, y + 6, fitted.w, fitted.h);
      } catch {}
    }

    if (tp) {
      try {
        const s = await getImageSize(tp);
        const fitted = fitIntoBox(s.w, s.h, rightBoxW, rightBoxH);
        doc.addImage(tp, "PNG", pageW - margin - fitted.w, y + 2, fitted.w, fitted.h);
      } catch {}
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(payload.formRef || "QPFPL5.2", pageW / 2, y + 24, { align: "center" });

    doc.setFontSize(10);
    doc.text(payload.sheetTitle || "", pageW / 2, y + 40, { align: "center" });

    y += 68;

    doc.setFontSize(9);
    doc.text(`Machine No: ${payload.plantId || ""}`, margin, y);
    doc.text(`Week commencing: ${weekUK}`, pageW - margin, y, { align: "right" });

    y += 10;

    doc.setFillColor(255, 214, 0);
    doc.rect(margin, y, tableW, 18, "F");
    doc.setTextColor(0);
    doc.setFontSize(8.8);
    doc.text("All checks must be carried out in line with Specific Manufacturer’s instructions", pageW / 2, y + 12.5, { align: "center" });
    y += 26;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const colW = tableW / 4;
    doc.text(`Site: ${payload.site || ""}`, margin + colW * 0.5, y, { align: "center" });
    doc.text(`Date: ${dateUK}`, margin + colW * 1.5, y, { align: "center" });
    doc.text(`Operator: ${payload.operator || ""}`, margin + colW * 2.5, y, { align: "center" });
    doc.text(`Machine hours: ${payload.hours || ""}`, margin + colW * 3.5, y, { align: "center" });
    y += 14;

    const itemColW = 420;
    const dayColW = (tableW - itemColW) / 7;
    const headH = 16;

    const defectsH = 26;
    const actionH = 28;
    const sigH = 34;

    const footerTotal =
      10 +
      10 + 6 + defectsH + 10 +
      10 +
      10 + 6 + actionH + 10 +
      10 + 6 + sigH + 22;

    const availForTable = (pageH - margin) - y - headH - footerTotal;
    const totalRows = Math.max(1, labels2.length);

    let rowH = Math.floor(availForTable / totalRows);
    rowH = Math.max(10, Math.min(16, rowH));
    const fontItem = rowH <= 11 ? 6.7 : 7.6;

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
      doc.text(days[i], cx, y + 11, { align: "center" });
    }
    y += headH;

    for (let r = 0; r < totalRows; r++) {
      doc.rect(margin, y, tableW, rowH);

      doc.line(margin + itemColW, y, margin + itemColW, y + rowH);
      for (let i = 1; i < 7; i++) {
        const xx = margin + itemColW + dayColW * i;
        doc.line(xx, y, xx, y + rowH);
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontItem);
      const label = ellipsize(labels2[r] || "", itemColW - 10, fontItem);
      doc.text(label, margin + 6, y + rowH * 0.72);

      for (let d = 0; d < 7; d++) {
        const status = weekStatuses2?.[r]?.[d] || null;
        if (!status) continue;
        const cx = margin + itemColW + dayColW * d + dayColW / 2;
        const cy = y + rowH / 2 + 1;
        drawMark(status, cx, cy);
      }

      y += rowH;
    }

    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Checks carried out by: ${payload.operator || ""}`, margin, y);
    y += 10;

    doc.text("Defects identified:", margin, y);
    y += 6;
    doc.rect(margin, y, tableW, defectsH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    if (payload.defectsText) doc.text(String(payload.defectsText), margin + 6, y + 14, { maxWidth: tableW - 12 });
    y += defectsH + 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Reported to: ${payload.reportedToName || ""}`, margin, y);
    y += 12;

    doc.text("Action taken:", margin, y);
    y += 6;
    doc.rect(margin, y, tableW, actionH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    if (payload.actionTaken) doc.text(String(payload.actionTaken), margin + 6, y + 14, { maxWidth: tableW - 12 });
    y += actionH + 10;

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
        doc.addImage(payload.signatureDataUrl, "PNG", imgX, imgY, fitted.w, fitted.h);
      } catch {}
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Submitted: ${new Date().toISOString()}`, margin, pageH - 16);
    doc.text(`BUILD: ${BUILD}`, pageW / 2, pageH - 16, { align: "center" });

    // ---------------- PHOTO PAGES ----------------
    const pics = Array.isArray(defectPhotos) ? defectPhotos : [];
    if (pics.length) {
      const cols = 2;
      const rows = 3;

      const gapX = 10;
      const gapY = 18;

      const boxW = (pageW - margin * 2 - gapX) / 2;
      const boxH = 190;
      const imgH = 150;

      let idx = 0;
      while (idx < pics.length) {
        doc.addPage();
        let yy = margin;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Defect Photos", margin, yy);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(
          `Machine: ${payload.plantId || ""}   Date: ${dateUK}   Type: ${payload.equipmentType || ""}`,
          margin,
          yy + 16
        );

        yy += 34;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (idx >= pics.length) break;

            const p = pics[idx];
            const x = margin + c * (boxW + gapX);
            const yTop = yy + r * (boxH + gapY);

            doc.setDrawColor(0);
            doc.setLineWidth(0.7);
            doc.rect(x, yTop, boxW, boxH);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            const cap = `Row ${p.rowIndex + 1}: ${p.label || ""}`;
            doc.text(ellipsize(cap, boxW - 8, 8), x + 4, yTop + 12);

            const boxX2 = x + 2;
            const boxY2 = yTop + 18;
            const boxW2 = boxW - 4;
            const boxH2 = imgH;

            doc.rect(boxX2, boxY2, boxW2, boxH2);

            try {
              await addImageFillBox(String(p.dataUrl), boxX2, boxY2, boxW2, boxH2);
            } catch {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8);
              doc.text("Photo could not be embedded.", x + 4, boxY2 + 22);
            }

            idx++;
          }
        }
      }
    }

    const dataUri = doc.output("datauristring");
    const parts = String(dataUri).split(",");
    if (parts.length < 2) throw new Error("PDF export failed (bad data URI)");
    return parts[1];
  }

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

    // Collect DEFECT photos for TODAY only
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
        await loadWeekFromKV();
      });
    }

    $("date")?.addEventListener("change", () => {
      setHeaderTexts();
      renderChecks();
      loadWeekFromKV();
    });

    $("plantId")?.addEventListener("input", () => {
      const cleaned = ($("plantId").value || "").replace(/\s+/g, "").toUpperCase();
      if ($("plantId").value !== cleaned) $("plantId").value = cleaned;
      setHeaderTexts();
    });

    $("plantId")?.addEventListener("blur", loadWeekFromKV);

    window.addEventListener("resize", () => renderChecks());

    $("submitBtn")?.addEventListener("click", submit);
  }

  // -------- Init --------
  (function init() {
    showAppRoot(); // prevents any blank screen
    injectStyles();

    if ($("buildTag")) $("buildTag").textContent = `BUILD: ${BUILD}`;

    fillRecipients();
    initSignature();
    wireEvents();

    if ($("date") && !$("date").value) $("date").value = isoToday();

    setButtonsActive();
    if (LOCK_TYPE) lockTypeUI();

    setHeaderTexts();
    renderChecks();
    loadWeekFromKV();
  })();
})();
