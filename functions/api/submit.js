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

function hasDefectForDay(payload, dayIndex) {
  // IMPORTANT: only "DEFECT" counts as damage.
  // N/A must NOT count.
  const statuses = payload?.weekStatuses;
  if (!Array.isArray(statuses)) return false;

  for (let r = 0; r < statuses.length; r++) {
    const row = statuses[r];
    if (!Array.isArray(row)) continue;
    if (row[dayIndex] === "DEFECT") return true;
  }
  return false;
}

function safeEmailKey(email) {
  return String(email || "").trim().toLowerCase();
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

    // ---- Save to KV (ticks + daily fields) ----
    const week = getWeekCommencingISO(payload.date);
    const dayIndex = getDayIndexMon0(payload.date);
    const key = `${payload.equipmentType}:${payload.plantId}:${week}`;

    let record = await env.CHECKS_KV.get(key, "json");

    const labels = (payload.labels && payload.labels.length)
      ? payload.labels
      : (payload.checks || []).map(c => c.label);

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

    // daily fields (last input fix)
    record.daily[dayIndex] = {
      site: payload.site || record.site || "",
      operator: payload.operator || "",
      hours: payload.hours || "",
      defectsText: payload.defectsText || "",
      actionTaken: payload.actionTaken || "",
      reportedToName: payload.reportedToName || "",
      reportedToEmail: payload.reportedToEmail || "",
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
    const plantId = String(payload.plantId || "");
    const date = String(payload.date || "");
    const subject = `${equipmentType} check - ${plantId} - ${date}`.trim();

    const toEmail = (payload.reportedToEmail || "").trim();
    const toName = (payload.reportedToName || "Recipient").trim();

    if (!toEmail) {
      return Response.json({ error: "No recipient email (reportedToEmail missing)" }, { status: 400 });
    }

    // Alfie / Yard (only if there is a DEFECT today)
    const YARD_EMAIL = "wshop@activetunnelling.com";
    const YARD_NAME = "TP Yard";

    const includeYard = hasDefectForDay(payload, dayIndex);

    // Build recipient list (dedupe)
    const recipientsMap = new Map();
    recipientsMap.set(safeEmailKey(toEmail), { Email: toEmail, Name: toName });

    if (includeYard) {
      recipientsMap.set(safeEmailKey(YARD_EMAIL), { Email: YARD_EMAIL, Name: YARD_NAME });
    }

    const toList = Array.from(recipientsMap.values());

    // Optional: defect summary for today (counts only DEFECT)
    let defectsCount = 0;
    if (Array.isArray(payload?.weekStatuses)) {
      for (let r = 0; r < payload.weekStatuses.length; r++) {
        if (payload.weekStatuses?.[r]?.[dayIndex] === "DEFECT") defectsCount++;
      }
    }

    const textLines = [
      `Site: ${payload.site || ""}`,
      `Date: ${payload.date || ""}`,
      `Plant: ${payload.plantId || ""}`,
      `Operator: ${payload.operator || ""}`,
      `Machine hours: ${payload.hours || ""}`,
      `Reported to: ${payload.reportedToName || ""}`,
      includeYard ? `Damage/defects today: YES (${defectsCount})` : `Damage/defects today: NO`,
      "",
      `Defects identified:`,
      `${payload.defectsText || ""}`,
      "",
      `Action taken:`,
      `${payload.actionTaken || ""}`,
      "",
      "PDF attached."
    ];

    const mjBody = {
      Messages: [
        {
          From: { Email: env.MAIL_FROM, Name: "Plant Checks" },
          To: toList,
          Subject: subject,
          TextPart: textLines.join("\n"),
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

    return Response.json({ ok: true, includeYard, defectsCount });
  } catch (e) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
