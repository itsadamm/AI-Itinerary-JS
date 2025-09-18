import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { countries, startDate, days } = body || {};

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ events: [] }), { headers: { 'Content-Type': 'application/json' } });

    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const user = `You are a trip events assistant. For the trip through countries: ${(countries||[]).join(', ') || '(unspecified)'}, and date range starting ${startDate || '(unspecified)'} for ${days || '(unknown)'} days, list up to 10 notable events for travelers (national/local holidays, festivals, major fairs, citywide cultural happenings). Use current general knowledge; if date/countries unspecified, infer sensible seasonal examples. Reply STRICT JSON only:
{"events":[{"name":"...","date":"YYYY-MM-DD or unknown","city":"...","country":"...","url":"optional"}]}`;

    const resp = await client.chat.completions.create({
      model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: 'Return STRICT JSON only without any commentary.' },
        { role: 'user', content: user },
      ]
    });
    const text = resp.choices?.[0]?.message?.content?.trim() || '';
    let parsed: any = { events: [] };
    try { parsed = JSON.parse(text); } catch {}
    if (!parsed || !Array.isArray(parsed.events)) parsed = { events: [] };
    return new Response(JSON.stringify(parsed), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ events: [] }), { headers: { 'Content-Type': 'application/json' }, status: 200 });
  }
}

