// functions/api/week.js

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

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("t") || "";
    const type = (url.searchParams.get("type") || "").trim();
    const plantId = (url.searchParams.get("plantId") || "").trim();
    const date = (url.searchParams.get("date") || "").trim();

    if (!env.SUBMIT_TOKEN || token !== env.SUBMIT_TOKEN) {
      return Response.json({ error: "Invalid link token" }, { status: 401 });
    }

    if (!env.CHECKS_KV) {
      return Response.json({ error: "KV binding missing (CHECKS_KV)" }, { status: 500 });
    }

    if (!type || !plantId || !date) {
      return Response.json({ error: "Missing type / plantId / date" }, { status: 400 });
    }

    const week = getWeekCommencingISO(date);
    const dayIndex = getDayIndexMon0(date);
    const key = `${type}:${plantId}:${week}`;

    const record = await env.CHECKS_KV.get(key, "json");

    return Response.json({ key, weekCommencing: week, dayIndex, record });
  } catch (e) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
