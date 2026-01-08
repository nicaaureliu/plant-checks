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

export async function onRequestPost({ request, env }) {
  try {
    const { token, payload, pdfBase64 } = await request.json();

    // 1) token protection
    if (!env.SUBMIT_TOKEN || token !== env.SUBMIT_TOKEN) {
      return Response.json({ error: "Invalid link token" }, { status: 401 });
    }

    // 2) validate
    if (!payload || !pdfBase64) {
      return Response.json({ error: "Missing PDF or payload" }, { status: 400 });
    }

    if (!env.CHECKS_KV) {
      return Response.json({ error: "KV binding missing (CHECKS_KV)" }, { status: 500 });
    }

    // 3) save week state in KV (full overwrite so it syncs previous days)
    const week = getWeekCommencingISO(payload.date);
    const key = `${payload.equipmentType}:${payload.plantId}:${week}`;

    const record = {
      equipmentType: payload.equipmentType,
      site: payload.site,
      plantId: payload.plantId,
      weekCommencing: week,
      labels: payload.labels || [],
      statuses: payload.weekStatuses || []
    };

    await env.CHECKS_KV.put(key, JSON.stringify(record));

    // 4) Mailjet keys
    const apiKey = (env.MAILJET_API_KEY || "").trim();
    const secretKey = (env.MAILJET_SECRET_KEY || "").trim();
    const mailFrom = (env.MAIL_FROM || "").trim();

    if (!apiKey || !secretKey) {
      return Response.json({ error: "Mailjet API keys not configured" }, { status: 500 });
    }
    if (!mailFrom) {
      return Response.json({ error: "MAIL_FROM not configured" }, { status: 500 });
    }

    const authHeader = `Basic ${base64Utf8(`${apiKey}:${secretKey}`)}`;

    const equipmentType = String(payload.equipmentType || "").toUpperCase() || "PLANT";
    const plantId = String(payload.plantId || "");
    const date = String(payload.date || "");
    const subject = `${equipmentType} check - ${plantId} - ${date}`.trim();

    const toEmail = (payload.reportedToEmail || env.DEST_EMAIL || "").trim();
    const toName = (payload.reportedToName || "Reported To").trim();

    if (!toEmail) {
      return Response.json({ error: "Missing reportedToEmail (or DEST_EMAIL fallback)" }, { status: 400 });
    }

    const mjBody = {
      Messages: [
        {
          From: { Email: mailFrom, Name: "Plant Checks" },
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
              Base64Content: pdfBase64
            }
          ]
        }
      ]
    };

    const mjResp = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: authHeader
      },
      body: JSON.stringify(mjBody)
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
