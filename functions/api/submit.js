// functions/api/submit.js

function base64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function getWeekCommencingISO(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  const diffToMon = (day === 0 ? -6 : 1 - day);
  dt.setDate(dt.getDate() + diffToMon);

  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function getDayIndexMon0(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  return day === 0 ? 6 : day - 1;
}

function safeEmailKey(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeNone(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.toLowerCase() === "none" || t.toLowerCase() === "n/a") return "None";
  return t;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function deriveLabels(payload) {
  const labels = (payload.labels && payload.labels.length)
    ? payload.labels
    : (payload.checks || []).map(c => c.label);

  return Array.isArray(labels) ? labels.map(x => String(x || "").trim()) : [];
}

function getDefectSummaryForDay(payload, dayIndex) {
  // IMPORTANT: only "DEFECT" counts as damage.
  // N/A must NOT count.
  const labels = deriveLabels(payload);
  const statuses = payload?.weekStatuses;

  const defectLabels = [];
  let defectsCount = 0;

  if (Array.isArray(statuses)) {
    for (let r = 0; r < statuses.length; r++) {
      const row = statuses[r];
      if (!Array.isArray(row)) continue;
      if (row[dayIndex] === "DEFECT") {
        defectsCount++;
        defectLabels.push(labels[r] || `Item ${r + 1}`);
      }
    }
  }

  return { defectsCount, defectLabels, hasDefect: defectsCount > 0 };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { token, payload, pdfBase64 } = await request.json();

    // Token protection
    if (!env.SUBMIT_TOKEN || token !== env.SUBMIT_TOKEN) {
      return Response.json({ error: "Invalid link token" }, { status: 401 });
    }

    if (!payload || !pdfBase64) {
      return Response.json({ error: "Missing PDF or payload" }, { status: 400 });
    }

    if (!env.CHECKS_KV) {
      return Response.json({ error: "KV binding missing (CHECKS_KV)" }, { status: 500 });
    }

    if (!payload.date || !payload.plantId || !payload.equipmentType) {
      return Response.json({ error: "Missing required fields (date, plantId, equipmentType)" }, { status: 400 });
    }

    // ---- Save to KV (ticks + daily fields) ----
    const week = getWeekCommencingISO(payload.date);
    const dayIndex = getDayIndexMon0(payload.date);
    const key = `${payload.equipmentType}:${payload.plantId}:${week}`;

    let record = await env.CHECKS_KV.get(key, "json");

    const labels = deriveLabels(payload);

    if (!record) {
      record = {
        equipmentType: payload.equipmentType,
        plantId: payload.plantId,
        weekCommencing: week,
        labels,
        statuses: labels.map(() => Array(7).fill(null)),
        daily: Array(7).fill(null),
        site: payload.site || "",
        updatedAt: new Date().toISOString(),
      };
    }

    record.labels = labels;

    if (!Array.isArray(record.statuses) || record.statuses.length !== labels.length) {
      record.statuses = labels.map(() => Array(7).fill(null));
    }
    if (!Array.isArray(record.daily) || record.daily.length !== 7) {
      record.daily = Array(7).fill(null);
    }

    if (payload.site) record.site = payload.site;

    // ticks
    if (Array.isArray(payload.weekStatuses)) {
      record.statuses = payload.weekStatuses;
    } else if (Array.isArray(payload.checks) && payload.checks.length) {
      for (let i = 0; i < payload.checks.length; i++) {
        const status = payload.checks[i].status || "OK";
        if (record.statuses[i]) record.statuses[i][dayIndex] = status;
      }
    }

    // Defect summary for today (counts only DEFECT)
    const { defectsCount, defectLabels, hasDefect } = getDefectSummaryForDay(payload, dayIndex);

    // daily fields (last input fix)
    record.daily[dayIndex] = {
      site: payload.site || record.site || "",
      operator: payload.operator || "",
      hours: payload.hours || "",
      defectsText: payload.defectsText || "",
      actionTaken: payload.actionTaken || "",
      reportedToName: payload.reportedToName || "",
      reportedToEmail: payload.reportedToEmail || "",
      defectsCount,
      defectItems: defectLabels, // helpful for later reporting / dashboards
      submittedAt: new Date().toISOString(),
    };

    record.updatedAt = new Date().toISOString();
    await env.CHECKS_KV.put(key, JSON.stringify(record));

    // ---- Mailjet ----
    const apiKey = (env.MAILJET_API_KEY || "").trim();
    const secretKey = (env.MAILJET_SECRET_KEY || "").trim();
    if (!apiKey || !secretKey) {
      return Response.json({ error: "Mailjet API keys not configured" }, { status: 500 });
    }

    const authHeader = `Basic ${base64Utf8(`${apiKey}:${secretKey}`)}`;

    const equipmentType = String(payload.equipmentType || "").toUpperCase() || "PLANT";
    const plantId = String(payload.plantId || "").trim();
    const date = String(payload.date || "").trim();

    // Subject: add DEFECT marker if applicable
    const subject = `${equipmentType} check - ${plantId} - ${date}${hasDefect ? " - DEFECT" : ""}`.trim();

    const toEmail = (payload.reportedToEmail || "").trim();
    const toName = (payload.reportedToName || "Recipient").trim();

    if (!toEmail) {
      return Response.json({ error: "No recipient email (reportedToEmail missing)" }, { status: 400 });
    }

    // Yard (only if there is a DEFECT today)
    const YARD_EMAIL = "wshop@activetunnelling.com";
    const YARD_NAME = "TP Yard";
    const includeYard = hasDefect;

    // Build recipient list (dedupe)
    const recipientsMap = new Map();
    recipientsMap.set(safeEmailKey(toEmail), { Email: toEmail, Name: toName });

    if (includeYard) {
      recipientsMap.set(safeEmailKey(YARD_EMAIL), { Email: YARD_EMAIL, Name: YARD_NAME });
    }

    const toList = Array.from(recipientsMap.values());

    const defectsTextClean = normalizeNone(payload.defectsText);
    const actionTakenClean = normalizeNone(payload.actionTaken);

    // Text email
    const defectLines =
      defectLabels.length
        ? defectLabels.slice(0, 25).map((x, i) => `  - ${x}`).join("\n") + (defectLabels.length > 25 ? `\n  (+${defectLabels.length - 25} more)` : "")
        : "  - None";

    const textLines = [
      `Site: ${payload.site || ""}`,
      `Date: ${payload.date || ""}`,
      `Plant: ${payload.plantId || ""}`,
      `Operator: ${payload.operator || ""}`,
      `Machine hours: ${payload.hours || ""}`,
      `Reported to: ${payload.reportedToName || ""}`,
      hasDefect ? `Damage/defects today: YES (${defectsCount})` : `Damage/defects today: NO`,
      "",
      "Defect items (today):",
      defectLines,
      "",
      "Defects identified:",
      defectsTextClean || "",
      "",
      "Action taken:",
      actionTakenClean || "",
      "",
      "PDF attached."
    ];

    // HTML email (reads much better on mobile)
    const htmlDefectItems =
      defectLabels.length
        ? `<ul style="margin:8px 0 0 18px;padding:0;">${defectLabels.slice(0, 25).map(x => `<li>${escapeHtml(x)}</li>`).join("")}${defectLabels.length > 25 ? `<li>(+${defectLabels.length - 25} more)</li>` : ""}</ul>`
        : `<div style="margin-top:8px;">None</div>`;

    const htmlBody = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; font-size:14px; color:#111;">
        <div style="font-weight:800; font-size:16px; margin-bottom:10px;">Plant Check Submission</div>

        <table style="border-collapse:collapse; width:100%; max-width:720px;">
          <tr><td style="padding:6px 0; color:#6b7280; font-weight:800; width:160px;">Site</td><td style="padding:6px 0;">${escapeHtml(payload.site || "")}</td></tr>
          <tr><td style="padding:6px 0; color:#6b7280; font-weight:800;">Date</td><td style="padding:6px 0;">${escapeHtml(payload.date || "")}</td></tr>
          <tr><td style="padding:6px 0; color:#6b7280; font-weight:800;">Plant</td><td style="padding:6px 0;">${escapeHtml(payload.plantId || "")}</td></tr>
          <tr><td style="padding:6px 0; color:#6b7280; font-weight:800;">Operator</td><td style="padding:6px 0;">${escapeHtml(payload.operator || "")}</td></tr>
          <tr><td style="padding:6px 0; color:#6b7280; font-weight:800;">Machine hours</td><td style="padding:6px 0;">${escapeHtml(payload.hours || "")}</td></tr>
          <tr><td style="padding:6px 0; color:#6b7280; font-weight:800;">Reported to</td><td style="padding:6px 0;">${escapeHtml(payload.reportedToName || "")}</td></tr>
        </table>

        <div style="margin:14px 0 6px; font-weight:900;">
          Damage/defects today: <span style="color:${hasDefect ? "#dc2626" : "#16a34a"}">${hasDefect ? `YES (${defectsCount})` : "NO"}</span>
        </div>

        <div style="margin-top:10px; font-weight:900;">Defect items (today):</div>
        ${htmlDefectItems}

        <div style="margin-top:14px; font-weight:900;">Defects identified:</div>
        <div style="white-space:pre-wrap; border:1px solid #e5e7eb; border-radius:10px; padding:10px; margin-top:6px;">
          ${escapeHtml(defectsTextClean || "")}
        </div>

        <div style="margin-top:14px; font-weight:900;">Action taken:</div>
        <div style="white-space:pre-wrap; border:1px solid #e5e7eb; border-radius:10px; padding:10px; margin-top:6px;">
          ${escapeHtml(actionTakenClean || "")}
        </div>

        <div style="margin-top:14px; color:#6b7280; font-weight:800;">PDF attached.</div>
      </div>
    `.trim();

    const mjBody = {
      Messages: [
        {
          From: { Email: env.MAIL_FROM, Name: "Plant Checks" },
          To: toList,
          Subject: subject,
          TextPart: textLines.join("\n"),
          HTMLPart: htmlBody,
          Attachments: [
            {
              Filename: `${equipmentType}-${plantId}-${date}.pdf`.replace(/\s+/g, "_"),
              ContentType: "application/pdf",
              Base64Content: pdfBase64,
            },
          ],
        },
      ],
    };

    const mjResp = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: authHeader,
      },
      body: JSON.stringify(mjBody),
    });

    const text = await mjResp.text();
    let details;
    try { details = JSON.parse(text); } catch { details = text; }

    if (!mjResp.ok) {
      return Response.json({ error: "Email send failed", details }, { status: 502 });
    }

    return Response.json({ ok: true, includeYard, defectsCount, defectItems: defectLabels });
  } catch (e) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
