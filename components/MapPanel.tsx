
'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl' 
import type { Day } from '@/types'
import { fetchOSRMRoute, kmToETA } from '@/lib/routing'

type Props = {
  days: Day[]
  activeDayIndex?: number
}

/**
 * Enhanced MapPanel:
 * - Pins activities with places for the active day
 * - Draws a ROUTE polyline between consecutive places
 * - Lets the user choose travel mode (walk / drive / bike)
 * - Shows total distance + ETA and per-leg stats
 */
export default function MapPanel({ days, activeDayIndex = 0 }: Props) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [profile, setProfile] = useState<'walking' | 'driving' | 'cycling'>('walking')
  const [routeKm, setRouteKm] = useState<number | null>(null)
  const [routeMins, setRouteMins] = useState<number | null>(null)
  const [legs, setLegs] = useState<{from:string; to:string; km:number; mins:number}[]>([])
  const day = days[activeDayIndex]

  const coords = useMemo(() => {
    const pts: [number, number, string][] = []
    day?.activities.forEach(a => {
      if (a.place) pts.push([a.place.lng, a.place.lat, a.place.name || a.text])
    })
    return pts
  }, [day])

  // Init map once
  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      },
      center: [12.4964, 41.9028],
      zoom: 4
    })
    mapRef.current = map

    // Add empty route source/layer
    map.on('load', () => {
      if (!map.getSource('route')) {
        map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any })
      }
      if (!map.getLayer('route-line')) {
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': '#D95525',
            'line-width': 4,
            'line-opacity': 0.9
          }
        })
      }
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update markers + route when coords or profile change
  useEffect(() => {
    const map = mapRef.current as any
    if (!map) return
    if (!map._markerLayer) map._markerLayer = []

    // Remove old markers
    map._markerLayer.forEach((m: any) => m.remove())
    map._markerLayer = []

    // Add new markers
    const bounds = new maplibregl.LngLatBounds()
    coords.forEach(([lng, lat, label], i) => {
      const el = document.createElement('div')
      el.className = 'route-marker'
      el.style.cssText = 'background:#D95525;color:#fff;padding:4px 8px;border-radius:12px;font-size:12px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.2)'
      el.textContent = String(i + 1)
      const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).setPopup(new maplibregl.Popup().setHTML(`<b>${i+1}. ${label}</b>`))
      marker.addTo(map); map._markerLayer.push(marker); bounds.extend([lng, lat])
    })
    if (coords.length) map.fitBounds(bounds, { padding: 60 })

    // Update route source
    ;(async () => {
      setRouteKm(null); setRouteMins(null); setLegs([])

      if (coords.length < 2) {
        // clear route
        const empty = { type: 'FeatureCollection', features: [] }
        const src = map.getSource('route')
        if (src) src.setData(empty)
        return
      }
      try {
        // Try OSRM first (live routing); falls back to straight lines if fails
        const osrm = await fetchOSRMRoute(coords.map(([lng, lat]) => [lng, lat]), profile)
        if (osrm && osrm.geometry) {
          const src = map.getSource('route')
          if (src) src.setData({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: osrm.geometry,
              properties: {}
            }]
          })
          setRouteKm(osrm.km)
          setRouteMins(osrm.mins)
          setLegs(osrm.legs.map((leg, i) => ({
            from: String(i + 1),
            to: String(i + 2),
            km: leg.km,
            mins: leg.mins
          })))
        } else {
          // Fallback: straight line polyline
          const line = {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: coords.map(([lng, lat]) => [lng, lat]) },
              properties: {}
            }]
          }
          const src = map.getSource('route')
          if (src) src.setData(line as any)
          // naive distance/eta
          let km = 0
          const legsLocal: {from:string; to:string; km:number; mins:number}[] = []
          for (let i = 1; i < coords.length; i++) {
            const d = haversine(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0])
            km += d
            const mins = kmToETA(d, profile)
            legsLocal.push({ from: String(i), to: String(i+1), km: d, mins })
          }
          setRouteKm(km)
          setRouteMins(kmToETA(km, profile))
          setLegs(legsLocal)
        }
      } catch (e) {
        console.error(e)
      }
    })()
  }, [coords, profile])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <label className="text-sm opacity-70">Mode:</label>
          <div className="flex gap-1">
            <button className={"btn-outline"} aria-pressed={profile==='walking'} onClick={()=>setProfile('walking')}>Walk</button>
            <button className={"btn-outline"} aria-pressed={profile==='cycling'} onClick={()=>setProfile('cycling')}>Bike</button>
            <button className={"btn-outline"} aria-pressed={profile==='driving'} onClick={()=>setProfile('driving')}>Drive</button>
          </div>
        </div>
        <div className="text-sm opacity-70">
          {routeKm!=null && routeMins!=null ? (<>
            <b>{routeKm.toFixed(1)} km</b> · ~{Math.round(routeMins)} min
          </>) : '—'}
        </div>
      </div>
      <div ref={containerRef} className="w-full h-[360px] rounded-2xl border" />
      {legs.length>0 && (
        <div className="text-sm">
          <div className="font-semibold mb-1">Legs</div>
          <ul className="space-y-1">
            {legs.map((l, idx)=>(
              <li key={idx} className="flex justify-between card p-2">
                <span>{l.from} → {l.to}</span>
                <span>{l.km.toFixed(1)} km · ~{Math.round(l.mins)} min</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Local fallback haversine
function toRad(d:number){ return d*Math.PI/180 }
function haversine(lat1:number, lon1:number, lat2:number, lon2:number){
  const R=6371; const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2; const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  return R*c;
}
