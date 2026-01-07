export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { token, payload, pdfBase64 } = body;

    // Basic protection: your QR link has a token, and we reject anything without it
    if (!env.SUBMIT_TOKEN || token !== env.SUBMIT_TOKEN) {
      return Response.json({ error: "Invalid link token" }, { status: 401 });
    }

    if (!pdfBase64 || !payload) {
      return Response.json({ error: "Missing PDF or payload" }, { status: 400 });
    }

    const subject = `${payload.equipmentType.toUpperCase()} check – ${payload.plantId} – ${payload.date}`;

    const creds = `${env.MAILJET_API_KEY}:${env.MAILJET_SECRET_KEY}`;
// btoa() is picky; this makes it safe for any characters:
const auth = btoa(unescape(encodeURIComponent(creds)));

    const mjBody = {
      Messages: [
        {
          From: { Email: env.MAIL_FROM, Name: "Plant Checks" },
          To: [{ Email: env.DEST_EMAIL, Name: "Site Agent" }],
          Subject: subject,
          TextPart:
            `Site: ${payload.site}\nDate: ${payload.date}\nPlant: ${payload.plantId}\nOperator: ${payload.operator}\n\nPDF attached.`,
          Attachments: [
            {
              Filename: `${payload.equipmentType}-${payload.plantId}-${payload.date}.pdf`,
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
        "authorization": `Basic ${auth}`,
      },
      body: JSON.stringify(mjBody),
    });

    const mjOut = await mjResp.json().catch(() => ({}));
    if (!mjResp.ok) {
      return Response.json({ error: "Email send failed", details: mjOut }, { status: 502 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message || "Server error" }, { status: 500 });
  }
}

