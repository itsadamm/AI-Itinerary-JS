import type { Day, Activity } from '@/types'

function pad(n:number){ return String(n).padStart(2,'0') }
function toUTC(dt: Date){
  return dt.getUTCFullYear().toString() +
    pad(dt.getUTCMonth()+1) +
    pad(dt.getUTCDate()) + 'T' +
    pad(dt.getUTCHours()) +
    pad(dt.getUTCMinutes()) +
    pad(dt.getUTCSeconds()) + 'Z'
}

function parseHM(hm?: string){
  if (!hm) return null
  const m = hm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return { h: Number(m[1]), m: Number(m[2]) }
}

export function buildICS(days: Day[], startDateISO: string){
  const startDate = new Date(startDateISO)
  if (Number.isNaN(startDate.getTime())) throw new Error('Invalid start date')

  const lines: string[] = []
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//AI Itinerary//EN')

  days.forEach((day, di) => {
    const dayDate = new Date(startDate)
    dayDate.setDate(startDate.getDate() + di)

    day.activities.forEach((a, ai) => {
      const sh = parseHM(a.start)?.h ?? 10
      const sm = parseHM(a.start)?.m ?? 0
      const eh = parseHM(a.end)?.h ?? (sh + 1)
      const em = parseHM(a.end)?.m ?? sm
      const dtStart = new Date(Date.UTC(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), sh, sm, 0))
      const dtEnd = new Date(Date.UTC(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), eh, em, 0))
      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${day.id}-${a.id}@ai-itinerary`)
      lines.push(`DTSTAMP:${toUTC(new Date())}`)
      lines.push(`DTSTART:${toUTC(dtStart)}`)
      lines.push(`DTEND:${toUTC(dtEnd)}`)
      const title = a.text.replace(/\n/g, ' ')
      lines.push(`SUMMARY:${title}`)
      if (a.place){
        lines.push(`LOCATION:${a.place.name}`)
      }
      lines.push('END:VEVENT')
    })
  })

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
