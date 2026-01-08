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
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  const diffToMon = (day === 0 ? -6 : 1 - day);
  dt.setDate(dt.getDate() + diffToMon);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function getDayIndexMon0(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  return day === 0 ? 6 : day - 1;
}

async function sendMailjet(env, payload, pdfBase64) {
  const apiKey = (env.MAILJET_API_KEY || "").trim();
  const secretKey = (env.MAILJET_SECRET_KEY || "").trim();
  if (!apiKey || !secretKey) throw new Error("Mailjet API keys not configured");

  const authHeader = `Basic ${base64Utf8(`${apiKey}:${secretKey}`)}`;

  const equipmentType = String(payload.equipmentType || "").toUpperCase() || "PLANT";
  const plantId = String(payload.plantId || "");
  const date = String(payload.date || "");
  const subject = `${equipmentType} check - ${plantId} - ${date}`.trim();

  const toEmail = String(payload.reportedToEmail || "").trim();
  if (!toEmail) throw new Error("Missing reportedToEmail");

  const mjBody = {
    Messages: [
      {
        From: { Email: env.MAIL_FROM, Name: "Plant Checks" },
        To: [{ Email: toEmail, Name: payload.reportedToName || "Recipient" }],
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
            Base64Content: pdfBase64
          }
        ]
      }
    ]
  };

  const mjResp = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: authHeader },
    body: JSON.stringify(mjBody)
  });

  const text = await mjResp.text();
  if (!mjResp.ok) throw new Error(`Mailjet failed: ${text}`);
  return true;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { token, payload, pdfBase64 } = await request.json();

    if (!env.SUBMIT_TOKEN || token !== env.SUBMIT_TOKEN) {
      return Response.json({ error: "Invalid link token" }, { status: 401 });
    }

    if (!payload || !pdfBase64) {
      return Response.json({ error: "Missing PDF or payload" }, { status: 400 });
    }

    if (!env.CHECKS_KV) {
      return Response.json({ error: "KV binding missing (CHECKS_KV)" }, { status: 500 });
    }

    // ---- Save weekly state ----
    const week = getWeekCommencingISO(payload.date);
    const dayIndex = getDayIndexMon0(payload.date);
    const key = `${payload.equipmentType}:${payload.plantId}:${week}`;

    let record = await env.CHECKS_KV.get(key, "json");
    if (!record) {
      const labels = (payload.labels || []).length ? payload.labels : (payload.checks || []).map(c => c.label);
      record = {
        equipmentType: payload.equipmentType,
        site: payload.site,
        plantId: payload.plantId,
        weekCommencing: week,
        labels,
        statuses: labels.map(() => Array(7).fill(null))
      };
    }

    for (let i = 0; i < (payload.weekStatuses || []).length; i++) {
      record.statuses[i] = payload.weekStatuses[i];
    }

    // ensure today updated if needed
    if (payload.checks && Array.isArray(payload.checks)) {
      for (let i = 0; i < payload.checks.length; i++) {
        const status = payload.checks[i].status || "OK";
        if (record.statuses[i]) record.statuses[i][dayIndex] = status;
      }
    }

    await env.CHECKS_KV.put(key, JSON.stringify(record));

    // ---- Send email (queued = fast) ----
    if (typeof context.waitUntil === "function") {
      context.waitUntil(sendMailjet(env, payload, pdfBase64));
      return Response.json({ ok: true, queued: true });
    }

    await sendMailjet(env, payload, pdfBase64);
    return Response.json({ ok: true, queued: false });

  } catch (e) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
