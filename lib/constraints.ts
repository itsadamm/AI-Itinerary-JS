import type { Day } from '@/types'

function toRad(d:number){ return d * Math.PI / 180 }
function haversine(lat1:number, lon1:number, lat2:number, lon2:number){
  const R = 6371 // km
  const dLat = toRad(lat2-lat1)
  const dLon = toRad(lon2-lon1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

export function evaluateDay(day: Day){
  let totalKm = 0
  const coords = day.activities.map(a => a.place).filter(Boolean) as {lat:number,lng:number}[]
  for (let i=1;i<coords.length;i++){
    totalKm += haversine(coords[i-1].lat, coords[i-1].lng, coords[i].lat, coords[i].lng)
  }
  const walkingSpeedKmH = 4 // conservative
  const hours = totalKm / walkingSpeedKmH
  const tooLong = hours > 5 // custom threshold
  return { totalKm, hours, tooLong }
}
