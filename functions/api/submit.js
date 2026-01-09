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
  const day = dt.getDay(); // Sun=0 ... Mon=1
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
  const day = dt.getDay(); // Sun=0
  return day === 0 ? 6 : day - 1; // Mon=0..Sun=6
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { token, payload, pdfBase64 } = await request.json();

    // 1) Token
    if (!env.SUBMIT_TOKEN || token !== env.SUBMIT_TOKEN) {
      return Response.json({ error: "Invalid link token" }, { status: 401 });
    }

    // 2) Validation
    if (!payload || !pdfBase64) {
      return Response.json({ error: "Missing PDF or payload" }, { status: 400 });
    }

    if (!env.CHECKS_KV) {
      return Response.json({ error: "KV binding missing (CHECKS_KV)" }, { status: 500 });
    }

    // ---- Save WEEK record in KV (ticks + daily inputs) ----
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

    // keep labels aligned
    record.labels = labels;
    if (!Array.isArray(record.statuses) || record.statuses.length !== labels.length) {
      record.statuses = labels.map(() => Array(7).fill(null));
    }
    if (!Array.isArray(record.daily) || record.daily.length !== 7) {
      record.daily = Array(7).fill(null);
    }

    // save site at week level (handy default)
    if (payload.site) record.site = payload.site;

    // Update today's marks
    if (Array.isArray(payload.checks) && payload.checks.length) {
      for (let i = 0; i < payload.checks.length; i++) {
        const status = payload.checks[i].status || "OK";
        if (record.statuses[i]) record.statuses[i][dayIndex] = status;
      }
    } else if (Array.isArray(payload.weekStatuses)) {
      // If you send weekStatuses, we trust it
      record.statuses = payload.weekStatuses;
    }

    // Save today's "last input" fields
    record.daily[dayIndex] = {
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

    // ---- EMAIL ----
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

    const toEmail = (payload.reportedToEmail || env.DEST_EMAIL || "").trim();
    const toName  = (payload.reportedToName || "Recipient").trim();

    if (!toEmail) {
      return Response.json({ error: "No recipient email (reportedToEmail / DEST_EMAIL missing)" }, { status: 400 });
    }

    const mjBody = {
      Messages: [
        {
          From: { Email: env.MAIL_FROM, Name: "Plant Checks" },
          To: [{ Email: toEmail, Name: toName }],
          Subject: subject,
          TextPart:
            `Site: ${payload.site || ""}\n` +
            `Date: ${payload.date || ""}\n` +
            `Plant: ${payload.plantId || ""}\n` +
            `Operator: ${payload.operator || ""}\n` +
            `Reported to: ${payload.reportedToName || ""}\n\n` +
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

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
