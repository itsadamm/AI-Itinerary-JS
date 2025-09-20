import type { Day } from '@/types'

function escapePDFText(s: string){
  return s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')
}

function pad(n:number, width=10){
  const s = String(n); return ' '.repeat(Math.max(0,width-s.length)) + s
}

function parseTime(s?: string){
  if(!s) return null; const m = s.match(/^(\d{1,2}):(\d{2})$/); if(!m) return null; const h=Number(m[1]), mi=Number(m[2]); if(h>23||mi>59) return null; return h*60+mi
}

function minutesBetween(a?: string, b?: string){
  const x=parseTime(a), y=parseTime(b); if(x==null||y==null) return 0; let d=y-x; if(d<0) d+=1440; return d>0?d:0
}

function formatMinutes(mins:number){ const h=Math.floor(mins/60), m=mins%60; return h?`${h}h ${m?m+'m':''}`:`${m}m` }

function formatDateLabel(startDate: string | undefined, index: number): string | null {
  if (!startDate) return null
  const d = new Date(startDate + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + index)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export type TripMeta = {
  countries?: string[]
  travelPace?: string
  startDate?: string
}

export function buildItineraryPDF(days: Day[], meta?: TripMeta): Uint8Array {
  // Page size: 612 x 792 (US Letter)
  const objects: {id:number, data:string}[] = []
  let objId = 1
  const add = (data:string) => { objects.push({id: objId++, data}) }

  const fontId = objId+1 // we will add pages then font

  const pageObjects: number[] = []

  function makePage(lines: {x:number,y:number,text:string,size?:number}[]): number {
    const contentLines: string[] = []
    contentLines.push('BT')
    contentLines.push('/F1 12 Tf')
    lines.forEach(l=>{
      const size = l.size || 12
      contentLines.push(`/F1 ${size} Tf`)
      contentLines.push(`${l.x} ${l.y} Td (${escapePDFText(l.text)}) Tj`)
    })
    contentLines.push('ET')
    const stream = contentLines.join('\n')
    const contentId = objId
    add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    const pageId = objId
    const pageObj = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    add(pageObj)
    pageObjects.push(pageId)
    return pageId
  }

  // Cover page
  const cover: {x:number,y:number,text:string,size?:number}[] = []
  cover.push({ x: 72, y: 720, text: 'Trip Itinerary', size: 26 })
  if (meta?.startDate) cover.push({ x: 72, y: 690, text: `Start: ${new Date(meta.startDate+'T00:00:00').toLocaleDateString()}`, size: 12 })
  if (meta?.countries?.length) cover.push({ x: 72, y: 672, text: `Countries: ${meta.countries.join(', ')}`, size: 12 })
  if (meta?.travelPace) cover.push({ x: 72, y: 654, text: `Pace: ${meta.travelPace}`, size: 12 })
  makePage(cover)

  // Days
  days.forEach((day, idx) => {
    const lines: {x:number,y:number,text:string,size?:number}[] = []
    let y = 740
    const dateLabel = formatDateLabel(meta?.startDate, idx)
    const title = `Day ${idx+1}${dateLabel?` · ${dateLabel}`:''} — ${day.title}`
    lines.push({ x: 72, y, text: title, size: 16 })
    y -= 24
    let totalMins = 0
    day.activities.forEach((a, i)=>{
      const dur = minutesBetween(a.start, a.end)
      totalMins += dur
      const bullet = `• ${a.text}${(a.start||a.end)?` — ${a.start||'—'}–${a.end||'—'}`:''}${dur?` (${formatMinutes(dur)})`:''}`
      lines.push({ x: 84, y, text: bullet, size: 12 })
      y -= 18
      if (y < 100) { // start a new page segment if overflow
        lines.push({ x: 72, y: 80, text: 'Continued…', size: 10 })
        makePage(lines); lines.length = 0; y = 740
      }
    })
    y -= 8
    lines.push({ x: 72, y, text: `Estimated total: ${formatMinutes(totalMins)}`, size: 12 })
    makePage(lines)
  })

  // Pages tree
  const kids = pageObjects.map(id=>`${id} 0 R`).join(' ')
  add(`<< /Type /Pages /Kids [ ${kids} ] /Count ${pageObjects.length} >>`)
  // Font
  add(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`)
  // Catalog
  add(`<< /Type /Catalog /Pages 2 0 R >>`)

  // Build xref
  let offset = 0
  const chunks: string[] = []
  chunks.push('%PDF-1.4\n')
  const xref: number[] = [0]
  function writeObj(id:number, body:string){
    const s = `${id} 0 obj\n${body}\nendobj\n`
    chunks.push(s)
    offset += s.length
    xref.push(offset)
  }
  let start = 0
  start = 0
  // Write objects in order
  objects.forEach(o=>writeObj(o.id, o.data))
  const xrefPos = chunks.join('').length
  const xrefCount = Math.max(...objects.map(o=>o.id)) + 1
  const xrefTable: string[] = []
  xrefTable.push('xref')
  xrefTable.push(`0 ${xrefCount}`)
  xrefTable.push('0000000000 65535 f ')
  // Recompute offsets properly
  let running = chunks[0].length
  const offsets: number[] = [0]
  objects.forEach((o)=>{ const s = `${o.id} 0 obj\n${o.data}\nendobj\n`; offsets.push(running); running += s.length })
  for(let i=0;i<xrefCount-1;i++){
    const off = offsets[i+1] ?? 0
    xrefTable.push(`${pad(off)} 00000 n `)
  }
  const trailer = `trailer\n<< /Size ${xrefCount} /Root ${objects[objects.length-1].id} 0 R >>\nstartxref\n${running}\n%%EOF`
  const pdf = chunks.join('') + xrefTable.join('\n') + '\n' + trailer
  return new TextEncoder().encode(pdf)
}

