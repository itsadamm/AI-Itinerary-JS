import OpenAI from "openai";

export const runtime = "nodejs";

type TMEvent = {
  name?: string;
  dates?: { start?: { localDate?: string; localTime?: string } };
  url?: string;
  _embedded?: { venues?: { name?: string }[] };
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q"); // city/country hint
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const date = searchParams.get("date"); // YYYY-MM-DD

  // Resolve location
  let latNum: number | null = null;
  let lonNum: number | null = null;
  let placeName: string | null = q;
  try {
    if (lat && lon) {
      latNum = Number(lat);
      lonNum = Number(lon);
    } else if (q) {
      const ua = process.env.GEOCODE_USER_AGENT || "ai-itinerary-local/1.0";
      const geoURL = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const gres = await fetch(geoURL, { headers: { "User-Agent": ua } });
      const g = (await gres.json())?.[0];
      if (g) { latNum = Number(g.lat); lonNum = Number(g.lon); placeName = g.display_name || q; }
    }
    // If only lat/lon were provided, try reverse geocoding to a city name for GPT prompt
    if (!placeName && latNum != null && lonNum != null) {
      const ua = process.env.GEOCODE_USER_AGENT || "ai-itinerary-local/1.0";
      const revURL = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latNum}&lon=${lonNum}`;
      const rres = await fetch(revURL, { headers: { "User-Agent": ua } });
      const rj = await rres.json();
      placeName = rj?.display_name || null;
    }
  } catch {}

  const out: { events: { name: string; when?: string; venue?: string; url?: string }[] } = { events: [] };

  // If we have Ticketmaster key, query their Discovery API
  const TM_KEY = process.env.TICKETMASTER_API_KEY;
  if (TM_KEY && latNum != null && lonNum != null) {
    try {
      const radius = 50; // km
      const classifications = "music,sports,arts%20&%20theatre,film";
      const base = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_KEY}`;
      const dateParam = date ? `&startDateTime=${encodeURIComponent(date + "T00:00:00Z")}&endDateTime=${encodeURIComponent(date + "T23:59:59Z")}` : "";
      const url = `${base}&latlong=${latNum},${lonNum}&radius=${radius}${dateParam}&classificationName=${classifications}`;
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.json();
        const items: TMEvent[] = data?._embedded?.events || [];
        out.events = items.map((e) => ({
          name: e.name || "Event",
          when: [e?.dates?.start?.localDate, e?.dates?.start?.localTime].filter(Boolean).join(" "),
          venue: e?._embedded?.venues?.[0]?.name,
          url: e.url,
        }));
      }
    } catch {}
  }

  // GPT fallback or enrichment: ask for diverse events (holidays/markets/fairs/festivals/etc.)
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && placeName) {
      const client = new OpenAI({ apiKey });
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const user = `Give up to 5 notable happenings for travelers in or near ${placeName} on ${date || "(a specific day)"}. Include local holidays/observances, farmers' markets, fairs, festivals, museum/night events, sports or concerts as applicable. Return compact JSON only, with this shape:
{"events":[{"name":"...","when":"YYYY-MM-DD or time window","venue":"...","url":"optional"}]}
If there are no specific events, return {"events":[]} strictly.`;
      const resp = await client.chat.completions.create({
        model,
        temperature: 0.3,
        messages: [
          { role: "system", content: "You return STRICT JSON only. No commentary." },
          { role: "user", content: user },
        ],
      });
      const text = resp.choices?.[0]?.message?.content?.trim() || "";
      try {
        const parsed = JSON.parse(text);
        if (parsed?.events?.length) {
          for (const e of parsed.events) {
            out.events.push({
              name: String(e.name || "Event"),
              when: e.when ? String(e.when) : undefined,
              venue: e.venue ? String(e.venue) : undefined,
              url: e.url ? String(e.url) : undefined,
            });
          }
        }
      } catch {}
    }
  } catch {}

  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
}
