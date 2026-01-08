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
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const day = dt.getDay(); // Sun=0 ... Mon=1
  const diffToMon = (day === 0 ? -6 : 1 - day);
  dt.setDate(dt.getDate() + diffToMon);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function getDayIndexMon0(dateStr) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const day = dt.getDay();
  return day === 0 ? 6 : day - 1;
}

async function mailjetSend(env, payload, pdfBase64) {
  const apiKey = (env.MAILJET_API_KEY || "").trim();
  const secretKey = (env.MAILJET_SECRET_KEY || "").trim();
  const mailFrom = (env.MAIL_FROM || "").trim();

  if (!apiKey || !secretKey) throw new Error("Mailjet API keys not configured");
  if (!mailFrom) throw new Error("MAIL_FROM is missing (must be a verified sender in Mailjet)");

  // ✅ selected person from dropdown
  const toEmail = (payload?.reportedToEmail || env.DEST_EMAIL || "").trim();
  if (!toEmail) throw new Error("No recipient email (payload.reportedToEmail or DEST_EMAIL required)");

  const equipmentType = String(payload.equipmentType || "PLANT").toUpperCase();
  const plantId = String(payload.plantId || "");
  const date = String(payload.date || "");
  const subject = `${equipmentType} check - ${plantId} - ${date}`.trim();

  const authHeader = `Basic ${base64Utf8(`${apiKey}:${secretKey}`)}`;

  const mjBody = {
    Messages: [
      {
        From: { Email: mailFrom, Name: "Plant Checks" },
        To: [{ Email: toEmail, Name: payload?.reportedToName || "Recipient" }],
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

  // Hard timeout so it doesn't hang forever
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);

  try {
    const mjResp = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: authHeader,
      },
      body: JSON.stringify(mjBody),
      signal: controller.signal,
    });

    const text = await mjResp.text();
    let details;
    try { details = JSON.parse(text); } catch { details = text; }

    if (!mjResp.ok) {
      // Bubble up Mailjet’s real error
      const err = new Error(`Mailjet send failed (${mjResp.status})`);
      err.details = details;
      throw err;
    }
    return { ok: true, details };
  } finally {
    clearTimeout(t);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const token = body?.token;
    const payload = body?.payload;
    const pdfBase64 = body?.pdfBase64;

    // Token protection
    if (!env.SUBMIT_TOKEN || token !== env.SUBMIT_TOKEN) {
      return Response.json({ error: "Invalid link token" }, { status: 401 });
    }

    if (!payload || !pdfBase64) {
      return Response.json({ error: "Missing PDF or payload" }, { status: 400 });
    }

    // Save weekly state in KV (optional but you had it)
    if (!env.CHECKS_KV) {
      return Response.json({ error: "KV binding missing (CHECKS_KV)" }, { status: 500 });
    }

    const week = getWeekCommencingISO(payload.date);
    const dayIndex = getDayIndexMon0(payload.date);
    const key = `${payload.equipmentType}:${payload.plantId}:${week}`;

    let record = await env.CHECKS_KV.get(key, "json");
    if (!record) {
      const labels = (payload.labels && payload.labels.length)
        ? payload.labels
        : (payload.checks || []).map((c) => c.label);

      record = {
        equipmentType: payload.equipmentType,
        site: payload.site,
        plantId: payload.plantId,
        weekCommencing: week,
        labels,
        statuses: labels.map(() => Array(7).fill(null)),
      };
    }

    // Update today's marks
    const labelsLen = record.labels?.length || 0;
    for (let i = 0; i < labelsLen; i++) {
      const status = payload.weekStatuses?.[i]?.[dayIndex] ?? null;
      if (record.statuses?.[i]) record.statuses[i][dayIndex] = status;
    }

    await env.CHECKS_KV.put(key, JSON.stringify(record));

    // Send email (with timeout + proper recipient)
    const result = await mailjetSend(env, payload, pdfBase64);

    return Response.json({ ok: true, mailjet: result.ok ? "sent" : "unknown" });
  } catch (e) {
    return Response.json(
      {
        error: e?.message || "Server error",
        details: e?.details || null
      },
      { status: 500 }
    );
  }
}
