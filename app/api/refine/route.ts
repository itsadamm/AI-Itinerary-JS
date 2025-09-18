import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { currentItineraryText, userRequest } = body ?? {};

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const system = `You are revising an existing itinerary. Keep the same format and day count. Only change what the user requests. Output format MUST remain:
**Day X: Title** then "- " bullets.`;

    const user = `Existing itinerary (do not add any text before or after):
${currentItineraryText}

User request for changes: ${userRequest}

Re-output the full itinerary with the requested changes, preserving the required format exactly.`;

    const resp = await client.chat.completions.create({
      model,
      temperature: 0.5,
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
