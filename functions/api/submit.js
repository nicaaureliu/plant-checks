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
  return day === 0 ? 6 : day - 1;
}

function isValidStatus(v) {
  return v === "OK" || v === "DEFECT" || v === "NA";
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const token = body?.token || "";
    const payload = body?.payload || {};
    const pdfBase64Raw = body?.pdfBase64;

    // 1) Token check FIRST
    if (!env.SUBMIT_TOKEN || token !== env.SUBMIT_TOKEN) {
      return Response.json({ error: "Invalid link token" }, { status: 401 });
    }

    // 2) Normalise required fields
    const dateStr = (payload.date || payload.dateISO || payload.dateIso || "").trim();
    const equipmentType = (payload.equipmentType || payload.type || "").trim();
    const plantId = (payload.plantId || "").trim();

    if (!dateStr) return Response.json({ error: "Missing payload.date (YYYY-MM-DD)" }, { status: 400 });
    if (!equipmentType) return Response.json({ error: "Missing payload.equipmentType" }, { status: 400 });
    if (!plantId) return Response.json({ error: "Missing payload.plantId" }, { status: 400 });
    if (!pdfBase64Raw) return Response.json({ error: "Missing PDF" }, { status: 400 });

    const pdfBase64 = String(pdfBase64Raw).includes(",")
      ? String(pdfBase64Raw).split(",")[1]
      : String(pdfBase64Raw);

    // 3) Save weekly state in KV
    if (!env.CHECKS_KV) {
      return Response.json({ error: "KV binding missing (CHECKS_KV)" }, { status: 500 });
    }

    const week = getWeekCommencingISO(dateStr);
    const dayIndex = getDayIndexMon0(dateStr);
    const key = `${equipmentType}:${plantId}:${week}`;

    const incomingLabels = (payload.checks || []).map(c => String(c.label || ""));
    let record = await env.CHECKS_KV.get(key, "json");

    if (!record) {
      record = {
        equipmentType,
        site: payload.site || "",
        plantId,
        weekCommencing: week,
        labels: incomingLabels,
        statuses: incomingLabels.map(() => Array(7).fill(null)),
      };
    } else {
      // If list changed, remap by label to keep old data
      const oldLabels = Array.isArray(record.labels) ? record.labels : [];
      const oldStatuses = Array.isArray(record.statuses) ? record.statuses : [];

      if (incomingLabels.length) {
        const map = new Map();
        for (let i = 0; i < oldLabels.length; i++) {
          map.set(oldLabels[i], Array.isArray(oldStatuses[i]) ? oldStatuses[i] : Array(7).fill(null));
        }

        record.labels = incomingLabels;
        record.statuses = incomingLabels.map(l => {
          const row = map.get(l);
          return Array.isArray(row) && row.length === 7 ? row : Array(7).fill(null);
        });
      }
    }

    // Update today's marks only (do NOT force OK if blank)
    for (let i = 0; i < (payload.checks || []).length; i++) {
      const st = payload.checks[i]?.status ?? null;
      if (isValidStatus(st)) {
        record.statuses[i][dayIndex] = st;
      }
    }

    // Update metadata
    record.site = payload.site || record.site || "";
    record.plantId = plantId;
    record.equipmentType = equipmentType;
    record.weekCommencing = week;

    await env.CHECKS_KV.put(key, JSON.stringify(record));

    // 4) Mailjet keys
    const apiKey = (env.MAILJET_API_KEY || "").trim();
    const secretKey = (env.MAILJET_SECRET_KEY || "").trim();
    if (!apiKey || !secretKey) {
      return Response.json({ error: "Mailjet API keys not configured" }, { status: 500 });
    }

    const authHeader = `Basic ${base64Utf8(`${apiKey}:${secretKey}`)}`;

    const equipmentTypeUp = equipmentType.toUpperCase();
    const subject = `${equipmentTypeUp} check - ${plantId} - ${dateStr}`.trim();

    const mjBody = {
      Messages: [
        {
          From: { Email: env.MAIL_FROM, Name: "Plant Checks" },
          To: [{ Email: env.DEST_EMAIL, Name: "Site Agent" }],
          Subject: subject,
          TextPart:
            `Site: ${payload.site || ""}\n` +
            `Date: ${dateStr}\n` +
            `Plant: ${plantId}\n` +
            `Operator: ${payload.operator || ""}\n` +
            `Week commencing: ${week}\n\n` +
            `PDF attached.`,
          Attachments: [
            {
              Filename: `${equipmentTypeUp}-${plantId}-${dateStr}.pdf`.replace(/\s+/g, "_"),
              ContentType: "application/pdf",
              Base64Content: pdfBase64,
            },
          ],
        },
      ],
    };

    const mjResp = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: authHeader },
      body: JSON.stringify(mjBody),
    });

    const text = await mjResp.text();
    let details;
    try { details = JSON.parse(text); } catch { details = text; }

    if (!mjResp.ok) {
      return Response.json({ error: "Email send failed", details }, { status: 502 });
    }

    return Response.json({ ok: true, savedKey: key });
  } catch (e) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
