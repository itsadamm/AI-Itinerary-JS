import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      travelPace,
      interests,
      budget,
      travelStyle,
      tripLength,
      countries,
      prioritizedCities,
    } = body ?? {};

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const safeDays = typeof tripLength === 'number' && tripLength > 0 ? tripLength : 7;
    const system = `You are a travel planner. Produce a human-readable itinerary using EXACTLY this format:
**Day 1: <Concise title>**
- <activity 1>
- <activity 2>
...
**Day 2: <Concise title>**
- <activity>
...
Rules: 1) Use only "- " bullet lines under each day. 2) No extra commentary before or after. 3) Title case for day titles. 4) Generate exactly ${safeDays} days.`;

    const user = `Preferences (any may be blank):
- Pace: ${travelPace || "(unspecified)"}
- Interests: ${(Array.isArray(interests) ? interests : (interests ? [interests] : []))?.join(", ") || "(unspecified)"}
- Budget: ${budget || "(unspecified)"}
- Style: ${travelStyle || "(unspecified)"}
- Trip length: ${tripLength || "(unspecified)"} days
- Countries: ${Array.isArray(countries) && countries.length ? countries.join(", ") : "(unspecified)"}
- Prioritized cities: ${Array.isArray(prioritizedCities) && prioritizedCities.length ? prioritizedCities.join(", ") : "(unspecified)"}

Please produce the itinerary in the required format. If fields are unspecified, infer reasonable defaults for the destination mix and pacing.`;

    const resp = await client.chat.completions.create({
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const text = resp.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ text }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err?.message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
