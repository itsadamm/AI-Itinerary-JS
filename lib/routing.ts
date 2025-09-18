
/**
 * Lightweight routing helper using the public OSRM demo server, with a safe fallback.
 * For production, consider hosting your own OSRM or using a commercial directions API.
 */

export type Profile = 'walking' | 'driving' | 'cycling'

export async function fetchOSRMRoute(
  coords: [number, number][],
  profile: Profile = 'walking'
): Promise<{ geometry: any; km: number; mins: number; legs: { km: number; mins: number }[] } | null> {
  if (coords.length < 2) return null

  // OSRM demo server expects profiles: 'walking' | 'cycling' | 'driving'
  const mode = profile // already matches OSRM demo profiles
  const base = `https://router.project-osrm.org/route/v1/${mode}/`
  const coordStr = coords.map(([lng, lat]) => `${lng},${lat}`).join(';')
  const url = `${base}${coordStr}?overview=full&geometries=geojson&steps=false&annotations=distance,duration`

  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    if (!data || !data.routes || !data.routes[0]) return null
    const route = data.routes[0]
    const km = route.distance / 1000
    const mins = route.duration / 60
    const legs = (route.legs || []).map((leg: any) => ({
      km: (leg.distance || 0) / 1000,
      mins: (leg.duration || 0) / 60,
    }))
    return { geometry: route.geometry, km, mins, legs }
  } catch (e) {
    // Likely network/CORS/ratelimit; fallback handled by caller
    return null
  }
}

// Basic ETA heuristic if OSRM request fails
export function kmToETA(km: number, profile: Profile): number {
  const speeds = {
    walking: 4.5,   // km/h
    cycling: 15,    // km/h
    driving: 35,    // km/h (city average)
  } as const
  const h = km / speeds[profile]
  return h * 60
}
