// functions/api/week.js
function getWeekCommencingISO(dateStr) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const day = dt.getDay();
  const diffToMon = (day === 0 ? -6 : 1 - day);
  dt.setDate(dt.getDate() + diffToMon);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const t = url.searchParams.get("t") || "";
  const type = (url.searchParams.get("type") || "excavator").toLowerCase();
  const plantId = (url.searchParams.get("plantId") || "").trim();
  const date = (url.searchParams.get("date") || "").trim();

  if (!env.SUBMIT_TOKEN || t !== env.SUBMIT_TOKEN) {
    return Response.json({ error: "Invalid link token" }, { status: 401 });
  }
  if (!env.CHECKS_KV) {
    return Response.json({ error: "KV binding missing (CHECKS_KV)" }, { status: 500 });
  }
  if (!plantId || !date) {
    return Response.json({ record: null });
  }

  const week = getWeekCommencingISO(date);
  const key = `${type}:${plantId}:${week}`;
  const record = await env.CHECKS_KV.get(key, "json");

  return Response.json({ record: record || null });
}
