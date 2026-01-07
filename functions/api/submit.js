// functions/api/submit.js

function base64Utf8(str) {
  // Converts ANY string safely to Base64 for Authorization headers
  const bytes = new TextEncoder().encode(str); // UTF-8 bytes
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk)); // 0..255 only
  }
  return btoa(bin); // now btoa is safe
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
  return day === 0 ? 6 : day - 1; // Mon=0..Sun=6
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { token, payload, pdfBase64 } = await request.json();
    // ---- Save weekly state in KV ----
if (!env.CHECKS_KV) {
  return Response.json({ error: "KV binding missing (CHECKS_KV)" }, { status: 500 });
}

const week = getWeekCommencingISO(payload.date);
const dayIndex = getDayIndexMon0(payload.date);
const key = `${payload.equipmentType}:${payload.plantId}:${week}`;

let record = await env.CHECKS_KV.get(key, "json");

// Create new record if none
if (!record) {
  const labels = (payload.checks || []).map(c => c.label);
  record = {
    equipmentType: payload.equipmentType,
    site: payload.site,
    plantId: payload.plantId,
    weekCommencing: week,
    labels,
    // statuses[rowIndex][dayIndex] = "OK" | "DEFECT" | "NA" | null
    statuses: labels.map(() => Array(7).fill(null)),
  };
}

// Update today's marks
for (let i = 0; i < (payload.checks || []).length; i++) {
  const status = payload.checks[i].status || "OK";
  if (record.statuses[i]) record.statuses[i][dayIndex] = status;
}

await env.CHECKS_KV.put(key, JSON.stringify(record));


    // 1) QR token protection
    if (!env.SUBMIT_TOKEN || token !== env.SUBMIT_TOKEN) {
      return Response.json({ error: "Invalid link token" }, { status: 401 });
    }

    // 2) Basic validation
    if (!payload || !pdfBase64) {
      return Response.json({ error: "Missing PDF or payload" }, { status: 400 });
    }

    // 3) Read + clean Mailjet keys (trim removes accidental spaces/new lines)
    const apiKey = (env.MAILJET_API_KEY || "").trim();
    const secretKey = (env.MAILJET_SECRET_KEY || "").trim();

    if (!apiKey || !secretKey) {
      return Response.json({ error: "Mailjet API keys not configured" }, { status: 500 });
    }

    // 4) Create safe Basic Auth header
    const authHeader = `Basic ${base64Utf8(`${apiKey}:${secretKey}`)}`;

    // 5) Email content
    const equipmentType = String(payload.equipmentType || "").toUpperCase() || "PLANT";
    const plantId = String(payload.plantId || "");
    const date = String(payload.date || "");

    const subject = `${equipmentType} check - ${plantId} - ${date}`.trim();

    const mjBody = {
      Messages: [
        {
          From: { Email: env.MAIL_FROM, Name: "Plant Checks" },
          To: [{ Email: env.DEST_EMAIL, Name: "Site Agent" }],
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

    // 6) Send via Mailjet
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
    try {
      details = JSON.parse(text);
    } catch {
      details = text;
    }

    if (!mjResp.ok) {
      return Response.json({ error: "Email send failed", details }, { status: 502 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
