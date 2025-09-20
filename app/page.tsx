"use client";
import { useEffect, useMemo, useState } from "react";
import TripForm, { type TripPrefs } from "@/components/TripForm";
import ItineraryEditor from "@/components/ItineraryEditor";
import Navbar from "@/components/Navbar";
import CommandPalette from "@/components/CommandPalette";
import type { Day } from "@/types";
import { parseItinerary, toRenderableText } from "@/lib/parseItinerary";
import { buildICS } from "@/lib/ics";
import { renderPrintableHTML, type PrintMeta } from "@/lib/print";
import { buildItineraryPDF, type TripMeta } from "@/lib/pdf";

export default function Page() {
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(false);
  const [raw, setRaw] = useState("");
  const [openCmd, setOpenCmd] = useState(false);
  const [history, setHistory] = useState<Day[][]>([]);
  const [future, setFuture] = useState<Day[][]>([]);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [lastPrefs, setLastPrefs] = useState<TripPrefs | undefined>(undefined);
  const [scrollFade, setScrollFade] = useState(1);
  const heroRef = useState<HTMLElement | null>(null)[0] as any;

  function pushHistory(newDays: Day[]) {
    setHistory(h => [...h, days]);
    setDays(newDays);
    setFuture([]);
  }
  function undo(){ if (!history.length) return; const prev = history[history.length-1]; setHistory(h=>h.slice(0,-1)); setFuture(f=>[days, ...f]); setDays(prev); }
  function redo(){ if (!future.length) return; const next = future[0]; setFuture(f=>f.slice(1)); setHistory(h=>[...h, days]); setDays(next); }

  async function generate(prefs: TripPrefs) {
    setLoading(true);
    try {
      const res = await fetch("/api/itinerary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prefs) });
      const data = await res.json();
      const text: string = data.text || "";
      setRaw(text);
      const parsed = parseItinerary(text);
      setHistory([]); setFuture([]);
      setDays(parsed);
      setStartDate(prefs.startDate);
      setLastPrefs(prefs);
    } finally { setLoading(false); }
  }

  async function refine() {
    const userRequest = prompt("Tell AI what to change (e.g., swap Day 2/3, add a beach day, cut museums):") || "";
    if (!userRequest) return;
    setLoading(true);
    try {
      const currentItineraryText = toRenderableText(days);
      const res = await fetch("/api/refine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentItineraryText, userRequest }) });
      const data = await res.json();
      const text: string = data.text || "";
      setRaw(text);
      const parsed = parseItinerary(text);
      pushHistory(parsed);
    } finally { setLoading(false); }
  }

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(days, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "itinerary.json"; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadICS(){
    const start = startDate || prompt("Trip start date (YYYY-MM-DD)? e.g., 2025-09-01");
    if (!start) return;
    try {
      const ics = buildICS(days, start);
      const blob = new Blob([ics], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "itinerary.ics"; a.click();
      URL.revokeObjectURL(url);
    } catch(err:any){
      alert(err?.message || "Invalid date");
    }
  }

  function encodeShareData(obj: any): string {
    try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))) } catch { return '' }
  }
  function decodeShareData(s: string): any | null {
    try { return JSON.parse(decodeURIComponent(escape(atob(s)))) } catch { return null }
  }

  async function shareItinerary() {
    const payload = { days, startDate }
    const data = encodeShareData(payload)
    const url = `${location.origin}${location.pathname}?data=${data}`
    try {
      // Prefer native share when available
      if ((navigator as any).share) {
        await (navigator as any).share({ title: 'Trip Itinerary', url })
        return
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(url)
      alert('Link copied to clipboard!')
    } catch {
      prompt('Copy this link:', url)
    }
  }

  function exportPDF() {
    const meta: PrintMeta = { startDate, countries: lastPrefs?.countries, travelPace: lastPrefs?.travelPace }
    const html = renderPrintableHTML(days, startDate, meta)
    const w = window.open('about:blank', '_blank')
    if (!w) return
    w.document.open(); w.document.write(html); w.document.close();
    w.focus();
    setTimeout(()=>{ try { w.print(); } catch {} }, 300)
  }

  function exportDoc() {
    const meta: PrintMeta = { startDate, countries: lastPrefs?.countries, travelPace: lastPrefs?.travelPace }
    const html = renderPrintableHTML(days, startDate, meta)
    const blob = new Blob([html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'itinerary.doc'; a.click()
    URL.revokeObjectURL(url)
  }

  async function shareItinerary() {
    // Build a simple PDF on the client and share it (where supported)
    const meta: TripMeta = { countries: lastPrefs?.countries, travelPace: lastPrefs?.travelPace, startDate }
    const bytes = buildItineraryPDF(days, meta)
    const file = new File([bytes], 'itinerary.pdf', { type: 'application/pdf' })
    try {
      if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] }) && (navigator as any).share) {
        await (navigator as any).share({ files: [file], title: 'Trip Itinerary', text: 'Trip Itinerary' })
        return
      }
    } catch {}
    // Fallback: download the PDF
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'itinerary.pdf'; a.click()
    URL.revokeObjectURL(url)
  }

  // Load from shared link if present
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const data = params.get('data')
    if (data) {
      const parsed = decodeShareData(data)
      if (parsed && parsed.days) {
        setDays(parsed.days)
        setStartDate(parsed.startDate)
      }
    }
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0
      const f = Math.max(0, 1 - y / 160)
      setScrollFade(f)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    // Mouse parallax for hero
    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth || 1
      const h = window.innerHeight || 1
      const x = (e.clientX / w) - 0.5
      const y = (e.clientY / h) - 0.5
      document.documentElement.style.setProperty('--mx', (x * 10).toFixed(3))
      document.documentElement.style.setProperty('--my', (y * 10).toFixed(3))
    }
    // Smooth pointer tracking via rAF
    let tx = 0, ty = 0, cx = 0, cy = 0, rafId: number | null = null
    const onMoveSmooth = (e: MouseEvent) => {
      const w = window.innerWidth || 1
      const h = window.innerHeight || 1
      tx = ((e.clientX / w) - 0.5) * 10
      ty = ((e.clientY / h) - 0.5) * 10
    }
    const loop = () => {
      // simple lerp
      cx += (tx - cx) * 0.08
      cy += (ty - cy) * 0.08
      document.documentElement.style.setProperty('--mx', cx.toFixed(3))
      document.documentElement.style.setProperty('--my', cy.toFixed(3))
      rafId = requestAnimationFrame(loop)
    }
    window.addEventListener('mousemove', onMoveSmooth, { passive: true })
    rafId = requestAnimationFrame(loop)

    // Feature chip hover parallax
    const attachChipParallax = () => {
      document.querySelectorAll('.feature-chip').forEach((el) => {
        const chip = el as HTMLElement
        let px = 0, py = 0, tx2 = 0, ty2 = 0, rid: number | null = null, over = false
        const update = () => {
          px += (tx2 - px) * 0.15; py += (ty2 - py) * 0.15
          chip.style.setProperty('--cpx', (px).toFixed(3))
          chip.style.setProperty('--cpy', (py).toFixed(3))
          if (over) rid = requestAnimationFrame(update)
        }
        chip.addEventListener('mousemove', (ev) => {
          const rect = chip.getBoundingClientRect()
          const nx = ((ev.clientX - rect.left) / rect.width) - 0.5
          const ny = ((ev.clientY - rect.top) / rect.height) - 0.5
          tx2 = nx; ty2 = ny
          if (!over) { over = true; rid = requestAnimationFrame(update) }
        }, { passive: true })
        chip.addEventListener('mouseleave', () => {
          over = false; tx2 = 0; ty2 = 0
          if (rid) cancelAnimationFrame(rid)
          chip.style.setProperty('--cpx', '0'); chip.style.setProperty('--cpy', '0')
        })
      })
    }
    // Defer to next frame so DOM is painted
    requestAnimationFrame(attachChipParallax)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('mousemove', onMoveSmooth)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  const exportsBlock = (
    <div className="card p-4">
      <h2 className="font-bold mb-2">Share & Export</h2>
      <div className="flex gap-2">
        <button className="btn" onClick={shareItinerary}>Share</button>
        <button className="btn-outline" onClick={exportPDF}>Export PDF</button>
        <button className="btn-outline" onClick={exportDoc}>Export Doc</button>
      </div>
    </div>
  );

  return (
    <main>
      <Navbar />
      <section className="hero">
        <div className="hero-bg"></div>
        <div className="pattern"></div>
        <div className="container hero-shell">
          <div className="hero-card">
            <div style={{position:'absolute',top:12,left:14,display:'flex',alignItems:'center',gap:8}} className="fade-up d1">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#16A34A"/>
                    <stop offset="1" stopColor="#F97316"/>
                  </linearGradient>
                </defs>
                <circle cx="16" cy="16" r="14" stroke="url(#lg)" strokeWidth={2} fill="white"/>
                <path d="M10 17l3 3 9-9" stroke="url(#lg)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{fontSize:12,color:'#64748B'}}>AI Itinerary</span>
            </div>
            <h1 className="fade-up d2">Design Your Next Great Trip</h1>
            <p className="subtitle fade-up d3">Fast, flexible, beautiful itineraries — tailored to your pace and interests.</p>
            <div className="features">
              <span className="feature-chip fade-up d3">⚡ Instant draft</span>
              <span className="feature-chip fade-up d4">🧩 Drag & refine</span>
              <span className="feature-chip fade-up d5">📄 Share & export</span>
            </div>
            <div className="cta">
              <a href="#planner" className="btn fade-up d6">Start Planning</a>
            </div>
          </div>
          <a href="#planner" className="scroll-indicator" style={{opacity: scrollFade}}>
            <span>Scroll</span>
            <span className="dot"></span><span className="dot"></span><span className="dot"></span>
          </a>
        </div>
      </section>
      <div className="container py-6 flex justify-center">
        <div className="w-full max-w-4xl space-y-6">
          <div id="planner" className="card p-6">
              <h1 className="text-3xl font-bold">Design your trip</h1>
              <p className="text-ink/70 mt-1">Tell it what kind of trip you want. Get a draft. Edit everything.</p>
              <div className="mt-4">
                <TripForm onGenerate={generate} />
                {loading && (
                  <div className="mt-3 flex items-center gap-2"><span className="spinner" /><span>Generating itinerary…</span></div>
                )}
              </div>
          </div>
          <div id="exports">{exportsBlock}</div>

          {days.length > 0 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button className="btn" onClick={refine}>Refine with AI</button>
                <button className="btn-outline" onClick={() => setOpenCmd(true)}>Open Command Palette <span className="ml-2"><kbd>⌘K</kbd></span></button>
              </div>
              <ItineraryEditor value={days} onChange={(d)=>pushHistory(d)} startDate={startDate} />
              <details className="card p-4">
                <summary className="cursor-pointer">Show raw AI text</summary>
                <pre className="mt-2 whitespace-pre-wrap text-sm">{raw}</pre>
              </details>
            </div>
          )}
        </div>
      </div>

      <CommandPalette
        open={openCmd}
        setOpen={setOpenCmd}
        onNewDay={()=>pushHistory([...days, { id: crypto.randomUUID(), title: `Day ${days.length+1}`, activities: [] }])}
        onNewActivity={()=>{
          if (!days.length) return;
          const d = [...days];
          d[0].activities.push({ id: crypto.randomUUID(), text: 'New activity' });
          pushHistory(d);
        }}
        onAIRefine={refine}
        onDownloadJSON={downloadJSON}
        onDownloadICS={downloadICS}
        onUndo={undo}
        onRedo={redo}
      />
    </main>
  );
}
