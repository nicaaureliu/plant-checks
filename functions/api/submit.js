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
  const day = dt.getDay(); // Sun=0 ... Mon=1
  const diffToMon = (day === 0 ? -6 : 1 - day);
  dt.setDate(dt.getDate() + diffToMon);

  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function getDayIndexMon0(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // Sun=0
  return day === 0 ? 6 : day - 1;
}

export async function onRequestPost({ request, env }) {
  try {
    const { token, payload, pdfBase64 } = await request.json();

    // Token protection
    if (!env.SUBMIT_TOKEN || token !== env.SUBMIT_TOKEN) {
      return Response.json({ error: "Invalid link token" }, { status: 401 });
    }

    if (!payload || !pdfBase64) {
      return Response.json({ error: "Missing payload or PDF" }, { status: 400 });
    }

    // KV save (weekly)
    if (!env.CHECKS_KV) {
      return Response.json({ error: "KV binding missing (CHECKS_KV)" }, { status: 500 });
    }

    const week = getWeekCommencingISO(payload.date);
    const dayIndex = getDayIndexMon0(payload.date);
    const key = `${payload.equipmentType}:${payload.plantId}:${week}`;

    let record = await env.CHECKS_KV.get(key, "json");

    // Create if none
    if (!record) {
      const labels = (payload.labels && payload.labels.length) ? payload.labels : [];
      record = {
        equipmentType: payload.equipmentType,
        plantId: payload.plantId,
        weekCommencing: week,
        labels,
        statuses: labels.map(() => Array(7).fill(null)),
      };
    }

    // Update from payload.weekStatuses if provided (best)
    if (Array.isArray(payload.weekStatuses) && payload.weekStatuses.length) {
      record.labels = payload.labels || record.labels;
      record.statuses = payload.weekStatuses;
    } else {
      // fallback (update today's marks only)
      for (let i = 0; i < (payload.checks || []).length; i++) {
        const status = payload.checks[i].status || "OK";
        if (record.statuses[i]) record.statuses[i][dayIndex] = status;
      }
    }

    await env.CHECKS_KV.put(key, JSON.stringify(record));

    // Mailjet config
    const apiKey = (env.MAILJET_API_KEY || "").trim();
    const secretKey = (env.MAILJET_SECRET_KEY || "").trim();
    if (!apiKey || !secretKey) {
      return Response.json({ error: "Mailjet API keys not configured" }, { status: 500 });
    }
    if (!env.MAIL_FROM || !env.DEST_EMAIL) {
      return Response.json({ error: "MAIL_FROM or DEST_EMAIL not set" }, { status: 500 });
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
          To: [{ Email: env.DEST_EMAIL, Name: "Plant Checks" }],
          Subject: subject,
          TextPart:
            `Site: ${payload.site || ""}\n` +
            `Date: ${payload.date || ""}\n` +
            `Plant: ${payload.plantId || ""}\n` +
            `Operator: ${payload.operator || ""}\n\n` +
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
