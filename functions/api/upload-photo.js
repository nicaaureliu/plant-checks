// functions/api/upload-photo.js
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    const token = String(body.token || "");
    const plantId = String(body.plantId || "").toUpperCase();
    const date = String(body.date || "");
    const type = String(body.type || "");
    const rowIndex = Number(body.rowIndex);
    const dayIndex = Number(body.dayIndex);
    const dataUrl = String(body.dataUrl || "");

    if (!token || !plantId || !date || !type || !Number.isFinite(rowIndex) || !Number.isFinite(dayIndex) || !dataUrl.startsWith("data:image/")) {
      return json({ error: "Bad request" }, 400);
    }

    const parts = dataUrl.split(",");
    if (parts.length < 2) return json({ error: "Bad image data" }, 400);

    const mime = dataUrl.slice(5, dataUrl.indexOf(";")) || "image/jpeg";
    const b64 = parts[1];

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    const ext = mime.includes("png") ? "png" : "jpg";
    const safeDate = date.replaceAll("/", "-");
    const key = `photos/${type}/${plantId}/${safeDate}/day-${dayIndex}/row-${rowIndex}/${crypto.randomUUID()}.${ext}`;

    // R2 bucket binding: PLANT_PHOTOS
    await env.PLANT_PHOTOS.put(key, bytes, {
      httpMetadata: { contentType: mime },
    });

    // Public base URL to your R2 public domain (recommended)
    const publicBase = env.PHOTO_PUBLIC_BASE || ""; // e.g. https://plant-checks-photos.yourdomain.com
    const url = publicBase ? `${publicBase}/${key}` : key;

    return json({ ok: true, key, url }, 200);
  } catch (e) {
    return json({ error: e?.message || "Upload failed" }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
