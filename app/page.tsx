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
    const start = prompt("Trip start date (YYYY-MM-DD)? e.g., 2025-09-01");
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
              <p className="text-white/70 mt-1">Tell it what kind of trip you want. Get a draft. Edit everything.</p>
              <div className="mt-4">
                <TripForm onGenerate={generate} />
                {loading && <p className="mt-3">Generating…</p>}
              </div>
          </div>

          {exportsBlock}

          {days.length > 0 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button className="btn" onClick={refine}>Refine with AI</button>
                <button className="btn-outline" onClick={() => setOpenCmd(true)}>Open Command Palette <span className="ml-2"><kbd>⌘K</kbd></span></button>
              </div>
              <ItineraryEditor value={days} onChange={(d)=>pushHistory(d)} />
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
