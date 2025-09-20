"use client";
import { useEffect, useMemo, useState } from "react";
import TripForm, { type TripPrefs } from "@/components/TripForm";
import ItineraryEditor from "@/components/ItineraryEditor";
import Navbar from "@/components/Navbar";
import CommandPalette from "@/components/CommandPalette";
import type { Day } from "@/types";
import { parseItinerary, toRenderableText } from "@/lib/parseItinerary";
import { buildICS } from "@/lib/ics";
import { renderPrintableHTML } from "@/lib/print";
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
    const html = renderPrintableHTML(days, startDate)
    const w = window.open('about:blank', '_blank')
    if (!w) return
    w.document.open(); w.document.write(html); w.document.close();
    w.focus();
    setTimeout(()=>{ try { w.print(); } catch {} }, 300)
  }

  function exportDoc() {
    const html = renderPrintableHTML(days, startDate)
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
      <div className="container py-6 flex justify-center">
        <div className="w-full max-w-4xl space-y-6">
          <div className="card p-6">
              <h1 className="text-3xl font-bold">Design your trip</h1>
              <p className="text-ink/70 mt-1">Tell it what kind of trip you want. Get a draft. Edit everything.</p>
              <div className="mt-4">
                <TripForm onGenerate={generate} />
                {loading && (
                  <div className="mt-3 flex items-center gap-2"><span className="spinner" /><span>Generating itinerary…</span></div>
                )}
              </div>
          </div>

          {exportsBlock}

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
