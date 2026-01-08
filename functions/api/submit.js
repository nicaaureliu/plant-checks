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

  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

async function sendMailjet(env, authHeader, mjBody) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

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
      throw new Error(`Mailjet failed: ${mjResp.status} ${String(JSON.stringify(details)).slice(0, 600)}`);
    }
    return { ok: true };
  } finally {
    clearTimeout(timeout);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { token, payload, pdfBase64 } = await request.json();

    // token protection
    if (!env.SUBMIT_TOKEN || token !== env.SUBMIT_TOKEN) {
      return Response.json({ error: "Invalid link token" }, { status: 401 });
    }

    if (!payload || !pdfBase64) {
      return Response.json({ error: "Missing payload or PDF" }, { status: 400 });
    }

    if (!env.CHECKS_KV) {
      return Response.json({ error: "KV binding missing (CHECKS_KV)" }, { status: 500 });
    }

    // Save weekly record
    const week = getWeekCommencingISO(payload.date);
    const key = `${payload.equipmentType}:${payload.plantId}:${week}`;

    const record = {
      equipmentType: payload.equipmentType,
      plantId: payload.plantId,
      weekCommencing: week,
      labels: payload.labels || [],
      statuses: payload.weekStatuses || (payload.labels || []).map(() => Array(7).fill(null)),
      updatedAt: new Date().toISOString(),
    };

    await env.CHECKS_KV.put(key, JSON.stringify(record));

    // Mailjet config
    const apiKey = (env.MAILJET_API_KEY || "").trim();
    const secretKey = (env.MAILJET_SECRET_KEY || "").trim();

    if (!apiKey || !secretKey) {
      return Response.json({ error: "Mailjet API keys not configured" }, { status: 500 });
    }
    if (!env.MAIL_FROM) {
      return Response.json({ error: "MAIL_FROM not set" }, { status: 500 });
    }

    // ✅ Recipient from dropdown
    const reportedToEmail = (payload.reportedToEmail || "").trim().toLowerCase();
    if (!reportedToEmail) {
      return Response.json({ error: "No recipient selected (reportedToEmail)" }, { status: 400 });
    }

    // ✅ Allowlist recipients (set env.RECIPIENTS = comma separated emails)
    const allowed = String(env.RECIPIENTS || "")
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (allowed.length && !allowed.includes(reportedToEmail)) {
      return Response.json({ error: "Recipient not allowed by server allowlist" }, { status: 400 });
    }

    const authHeader = `Basic ${base64Utf8(`${apiKey}:${secretKey}`)}`;

    const equipmentType = String(payload.equipmentType || "").toUpperCase() || "PLANT";
    const plantId = String(payload.plantId || "");
    const date = String(payload.date || "");
    const subject = `${equipmentType} check - ${plantId} - ${date}`.trim();

    const mjBody = {
      Messages: [
        {
          From: { Email: env.MAIL_FROM, Name: "Plant Checks" },
          To: [{ Email: reportedToEmail, Name: payload.reportedToName || "Plant Checks" }],
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

    // mark queued
    const mailKey = `${key}:mail`;
    await env.CHECKS_KV.put(mailKey, JSON.stringify({
      status: "queued",
      at: new Date().toISOString(),
      subject,
      to: reportedToEmail
    }));

    // send in background (fast response)
    const job = (async () => {
      try {
        await sendMailjet(env, authHeader, mjBody);
        await env.CHECKS_KV.put(mailKey, JSON.stringify({
          status: "sent",
          at: new Date().toISOString(),
          subject,
          to: reportedToEmail
        }));
      } catch (e) {
        await env.CHECKS_KV.put(mailKey, JSON.stringify({
          status: "failed",
          at: new Date().toISOString(),
          subject,
          to: reportedToEmail,
          error: e?.message || "Unknown"
        }));
      }
    })();

    if (typeof context.waitUntil === "function") {
      context.waitUntil(job);
      return Response.json({ ok: true, queued: true });
    } else {
      await job;
      return Response.json({ ok: true, queued: false });
    }

  } catch (e) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
