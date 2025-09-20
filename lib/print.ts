import type { Day } from '@/types'

export type PrintMeta = {
  startDate?: string
  countries?: string[]
  travelPace?: string
}

function formatDate(startDate: string | undefined, index: number): string | null {
  if (!startDate) return null
  const d = new Date(startDate + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + index)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function computeEndDate(startDate: string | undefined, numDays: number): string | null {
  if (!startDate) return null
  const d = new Date(startDate + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + Math.max(0, numDays - 1))
  return d.toLocaleDateString()
}

export function renderPrintableHTML(days: Day[], startDate?: string, meta?: PrintMeta): string {
  const styles = `
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, 'Apple Color Emoji','Segoe UI Emoji'; margin:0; color:#0F172A; }
    .wrap { max-width: 900px; margin: 24px auto; padding: 0 24px; }
    h1 { font-size: 28px; margin: 0 0 6px; }
    .sub { color:#64748B; margin-bottom: 20px; }
    .day { border:1px solid rgba(2,6,23,0.08); border-radius:16px; padding:16px; margin:12px 0; box-shadow:0 10px 30px rgba(2,6,23,0.06); }
    .day h2 { margin:0 0 10px; font-size:18px; display:flex; align-items:center; gap:8px; }
    .badge { display:inline-block; padding:4px 10px; border-radius:9999px; border:1px solid rgba(2,6,23,0.1); color:#0F172A; font-size:12px; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 6px 0; }
    .footer { margin-top: 28px; font-size: 12px; color:#94A3B8; }
    .accent { background: linear-gradient(135deg, #16A34A 0%, #F97316 100%); -webkit-background-clip:text; background-clip:text; color:transparent; }
    .cover { position: relative; height: 100vh; min-height: 760px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff; }
    .cover .bg { position:absolute; inset: -20%; pointer-events:none; background:
      radial-gradient(600px 400px at 15% 20%, rgba(22,163,74,0.18), transparent 60%),
      radial-gradient(700px 480px at 85% 30%, rgba(249,115,22,0.16), transparent 60%),
      radial-gradient(600px 520px at 50% 120%, rgba(16,185,129,0.12), transparent 60%); filter: blur(30px); }
    .cover .card { position: relative; z-index: 1; border: 1px solid rgba(2,6,23,0.08); border-radius: 24px; padding: 36px; width: min(760px, 92vw); background: rgba(255,255,255,0.9); box-shadow: 0 20px 60px rgba(2,6,23,0.10); backdrop-filter: blur(6px); }
    .cover h1 { margin:0 0 10px; font-size: 40px; letter-spacing: -0.02em; }
    .cover .subtitle { color:#475569; font-size: 16px; margin-bottom: 18px; }
    .meta { display:flex; flex-wrap: wrap; gap:10px; margin-top:12px; }
    .chip { display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border-radius: 9999px; border: 1px solid rgba(2,6,23,0.10); background:#F8FAFC; font-size: 13px; }
    .pill { display:inline-flex; padding:6px 10px; border-radius:9999px; background: linear-gradient(135deg, #16A34A 0%, #F97316 100%); color:#fff; font-size:12px; }
    .page-break { page-break-after: always; }
    @media print { .actions { display:none; } .wrap { box-shadow:none; } .cover .card { box-shadow:none; } }
  `

  const endDate = computeEndDate(startDate, days.length)
  const body = `
    <div class="cover">
      <div class="bg"></div>
      <div class="card">
        <h1 class="accent">Your Trip Itinerary</h1>
        <div class="subtitle">${startDate ? `From ${new Date(startDate+'T00:00:00').toLocaleDateString()}${endDate?` to ${endDate}`:''}` : ''}</div>
        <div class="meta">
          ${meta?.countries?.length ? `<span class="chip">🌍 <b style="font-weight:600">Countries</b>: ${meta.countries.join(', ')}</span>` : ''}
          ${meta?.travelPace ? `<span class="chip">🚶 <b style="font-weight:600">Pace</b>: ${meta.travelPace}</span>` : ''}
          <span class="chip">📅 <b style="font-weight:600">Days</b>: ${days.length}</span>
          <span class="pill">White · Green · Orange</span>
        </div>
      </div>
    </div>
    <div class="page-break"></div>
    <div class="wrap">
      <div class="actions">
        <button onclick="window.print()" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(2,6,23,0.1);background:#F8FAFC;cursor:pointer">Print / Save as PDF</button>
      </div>
      <h1 class="accent">Itinerary</h1>
      <div class="sub">${startDate ? `Starting ${new Date(startDate+'T00:00:00').toLocaleDateString()}` : ''}</div>
      ${days.map((d, i) => `
        <section class="day">
          <h2><span class="badge">Day ${i+1}${formatDate(startDate, i)?` · ${formatDate(startDate, i)}`:''}</span> ${d.title}</h2>
          <ul>
            ${d.activities.map(a => `<li>${a.text}${a.start||a.end?` — <em>${a.start||'—'}–${a.end||'—'}</em>`:''}</li>`).join('')}
          </ul>
        </section>
      `).join('')}
      <div class="footer">Generated by AI Itinerary</div>
    </div>
  `

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`+
         `<title>Itinerary</title><style>${styles}</style></head><body>${body}</body></html>`
}
