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

function computeDamageFlag(payload, dayIndex) {
  const defectsText = String(payload?.defectsText || "").trim();
  const hasDefectsText = defectsText.length > 0;

  // Prefer weekStatuses if present (your v13 payload sends it)
  let hasChecklistDefect = false;

  if (Array.isArray(payload?.weekStatuses)) {
    for (const row of payload.weekStatuses) {
      const st = row?.[dayIndex] || null;
      if (st === "DEFECT") { hasChecklistDefect = true; break; }
    }
  } else if (Array.isArray(payload?.checks) && payload.checks.length) {
    // Fallback (older payload style): if any check is marked DEFECT for that day
    // Note: older structure may not be day-specific; keep it conservative.
    hasChecklistDefect = payload.checks.some(c => String(c?.status || "").toUpperCase() === "DEFECT");
  }

  return hasChecklistDefect || hasDefectsText;
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

    // daily fields (THIS is the “last input” fix)
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

    // Damage detection (server-side, so frontend changes are optional)
    const damageFlag = computeDamageFlag(payload, dayIndex);

    // Recipients:
    // - No damage => TO: selected person
    // - Damage => TO: Yard, CC: selected person (one email)
    const reportedToEmail = (payload.reportedToEmail || "").trim();
    const reportedToName  = (payload.reportedToName || "Recipient").trim();

    // Preferred yard setting: YARD_EMAIL. Fallback to DEST_EMAIL for backward compatibility.
    const yardEmail = (env.wshop@activetunnelling.com || env.DEST_EMAIL || "").trim();
    const yardName = (env. TP Yard || "Yard").trim();

    if (!reportedToEmail) {
      return Response.json({ error: "No recipient email (reportedToEmail missing)" }, { status: 400 });
    }

    const toEmail = (damageFlag && yardEmail) ? yardEmail : reportedToEmail;
    const toName  = (damageFlag && yardEmail) ? yardName : reportedToName;

    // CC only when damage, and only if it’s not the same address as TO
    const ccList = (damageFlag && yardEmail && reportedToEmail && reportedToEmail !== yardEmail)
      ? [{ Email: reportedToEmail, Name: reportedToName }]
      : [];

    const subject = damageFlag
      ? `${equipmentType} check - DAMAGE - ${plantId} - ${date}`.trim()
      : `${equipmentType} check - ${plantId} - ${date}`.trim();

    const mjBody = {
      Messages: [
        {
          From: { Email: env.MAIL_FROM, Name: "Plant Checks" },
          To: [{ Email: toEmail, Name: toName }],
          ...(ccList.length ? { Cc: ccList } : {}),
          Subject: subject,
          TextPart:
            `Site: ${payload.site || ""}\n` +
            `Date: ${payload.date || ""}\n` +
            `Plant: ${payload.plantId || ""}\n` +
            `Operator: ${payload.operator || ""}\n` +
            `Reported to: ${payload.reportedToName || ""}\n` +
            `Damage flagged: ${damageFlag ? "YES" : "NO"}\n\n` +
            `Defects identified:\n${String(payload.defectsText || "").trim() || "None"}\n\n` +
            `Action taken:\n${String(payload.actionTaken || "").trim() || "—"}\n\n` +
            `PDF attached.`,
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

    // If damageFlag is true but no yardEmail was configured, email still goes to reportedToEmail.
    // Returning a warning can help you spot misconfig without breaking submissions.
    const warning = (damageFlag && !yardEmail)
      ? "Damage detected, but YARD_EMAIL (or DEST_EMAIL) is not configured; email sent only to selected recipient."
      : undefined;

    return Response.json({ ok: true, ...(warning ? { warning } : {}) });
  } catch (e) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
