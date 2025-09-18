"use client";
import { useEffect, useMemo, useState } from "react";
import TripForm, { type TripPrefs } from "@/components/TripForm";
import ItineraryEditor from "@/components/ItineraryEditor";
import Navbar from "@/components/Navbar";
import CommandPalette from "@/components/CommandPalette";
import type { Day } from "@/types";
import { parseItinerary, toRenderableText } from "@/lib/parseItinerary";
import { buildICS } from "@/lib/ics";

export default function Page() {
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(false);
  const [raw, setRaw] = useState("");
  const [openCmd, setOpenCmd] = useState(false);
  const [history, setHistory] = useState<Day[][]>([]);
  const [future, setFuture] = useState<Day[][]>([]);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [searchHint, setSearchHint] = useState<string | undefined>(undefined);
  const [tripCountries, setTripCountries] = useState<string[]>([]);
  const [tripEvents, setTripEvents] = useState<any[]>([]);
  const [tripEventsLoading, setTripEventsLoading] = useState(false);

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
      const hint = (prefs.prioritizedCities && prefs.prioritizedCities[0]) || (prefs.countries && prefs.countries[0]) || undefined;
      setSearchHint(hint);
      setTripCountries(prefs.countries || []);
      try {
        setTripEventsLoading(true);
        const resp = await fetch('/api/events/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ countries: prefs.countries || [], startDate: prefs.startDate, days: parsed.length }) })
        const sum = await resp.json();
        setTripEvents(sum?.events || []);
      } catch {}
      finally { setTripEventsLoading(false); }
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

  const exportsBlock = (
    <div className="card p-4">
      <h2 className="font-bold mb-2">Exports</h2>
      <div className="flex gap-2">
        <button className="btn" onClick={downloadJSON}>Download JSON</button>
        <button className="btn-outline" onClick={downloadICS}>Export ICS</button>
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

          {days.length>0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Trip Events (holidays, festivals)</h2>
                {tripEventsLoading && <span className="spinner" />}
              </div>
              {!tripEventsLoading && tripEvents.length === 0 && (
                <p className="text-sm opacity-70 mt-2">No notable events found for your countries/dates.</p>
              )}
              {!tripEventsLoading && tripEvents.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {tripEvents.map((ev, idx) => {
                    const date = ev.date as string | undefined;
                    let dayIdx: number | null = null;
                    if (date && startDate) {
                      const d0 = new Date(startDate+'T00:00:00');
                      const d1 = new Date(date+'T00:00:00');
                      if (!Number.isNaN(d0.getTime()) && !Number.isNaN(d1.getTime())) {
                        const diff = Math.round((d1.getTime()-d0.getTime())/86400000);
                        if (diff>=0 && diff<days.length) dayIdx = diff;
                      }
                    }
                    return (
                      <li key={idx} className="flex items-center justify-between card p-2">
                        <div className="text-sm">
                          <div className="font-medium">{ev.name}</div>
                          <div className="opacity-70">{ev.date || 'Unknown date'}{ev.city?` · ${ev.city}`:''}{ev.country?` · ${ev.country}`:''}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {dayIdx!=null ? (
                            <button className="btn-outline" onClick={() => {
                              const d = [...days];
                              d[dayIdx].activities.push({ id: crypto.randomUUID(), text: ev.name + (ev.city?` · ${ev.city}`:'') + (ev.date?` · ${ev.date}`:'') });
                              setDays(d);
                            }}>Add to Day {dayIdx+1}</button>
                          ) : (
                            <button className="btn-outline" onClick={() => {
                              const d = [...days];
                              d[0].activities.push({ id: crypto.randomUUID(), text: ev.name + (ev.city?` · ${ev.city}`:'') + (ev.date?` · ${ev.date}`:'') });
                              setDays(d);
                            }}>Add to Day 1</button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {days.length > 0 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button className="btn" onClick={refine}>Refine with AI</button>
                <button className="btn-outline" onClick={() => setOpenCmd(true)}>Open Command Palette <span className="ml-2"><kbd>⌘K</kbd></span></button>
              </div>
              <ItineraryEditor value={days} onChange={(d)=>pushHistory(d)} startDate={startDate} searchHint={searchHint} />
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
