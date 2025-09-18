export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  if (!q) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })

  const ua = process.env.GEOCODE_USER_AGENT || 'ai-itinerary-local/1.0'
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { 'User-Agent': ua } })
  const data = await res.json()
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
}
