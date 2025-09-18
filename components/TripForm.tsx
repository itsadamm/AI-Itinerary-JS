"use client";
import { useMemo, useState } from "react";
import Select from "react-select";
import wc from "world-countries";

export type TripPrefs = {
  travelPace?: "slow" | "balanced" | "fast";
  interests?: string[];
  budget?: "low" | "medium" | "high";
  travelStyle?: "solo" | "backpacker" | "couple" | "group" | "family" | "luxury";
  tripLength?: number;
  startDate?: string; // YYYY-MM-DD
  countries?: string[];
  prioritizedCities?: string[];
};

const paceOpts = [
  { value: "slow", label: "Slow" },
  { value: "balanced", label: "Balanced" },
  { value: "fast", label: "Fast" },
];
const budgetOpts = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];
const styleOpts = [
  { value: "solo", label: "Solo" },
  { value: "backpacker", label: "Backpacker" },
  { value: "couple", label: "Couple" },
  { value: "group", label: "Group" },
  { value: "family", label: "Family" },
  { value: "luxury", label: "Luxury" },
];
const interestOpts = [
  "Nature",
  "Food",
  "Culture",
  "Nightlife",
  "Animals",
  "Adventure",
  "Hiking",
  "Shopping",
  "Relaxing",
];

export default function TripForm({ onGenerate }: { onGenerate: (prefs: TripPrefs) => void }) {
  const countryOptions = useMemo(() => wc.map((c) => ({ value: c.name.common, label: `${c.name.common} ${c.flag}` })), []);
  const [countries, setCountries] = useState<any[]>([]);
  const [cityInput, setCityInput] = useState("");
  const [cities, setCities] = useState<string[]>([]);

  const [form, setForm] = useState<TripPrefs>({
    travelPace: undefined,
    interests: [],
    budget: undefined,
    travelStyle: undefined,
    tripLength: 7,
    startDate: undefined,
    countries: [],
    prioritizedCities: [],
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const prefs: TripPrefs = {
      ...form,
      interests: form.interests || [],
      countries: countries.map((c) => c.value),
      prioritizedCities: cities,
    };
    onGenerate(prefs);
  }

  function toggleInterest(val: string) {
    setForm((f) => {
      const arr = new Set(f.interests || []);
      if (arr.has(val)) arr.delete(val); else arr.add(val);
      return { ...f, interests: Array.from(arr) };
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <label className="label">Travel pace</label>
          <select
            className="input mt-1"
            value={form.travelPace || ""}
            onChange={(e) => setForm((f) => ({ ...f, travelPace: (e.target.value || undefined) as any }))}
          >
            <option value="">-- Select --</option>
            {paceOpts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="card p-4">
          <label className="label">Budget</label>
          <select
            className="input mt-1"
            value={form.budget || ""}
            onChange={(e) => setForm((f) => ({ ...f, budget: (e.target.value || undefined) as any }))}
          >
            <option value="">-- Select --</option>
            {budgetOpts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="card p-4">
          <label className="label">Travel style</label>
          <select
            className="input mt-1"
            value={form.travelStyle || ""}
            onChange={(e) => setForm((f) => ({ ...f, travelStyle: (e.target.value || undefined) as any }))}
          >
            <option value="">-- Select --</option>
            {styleOpts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="card p-4">
          <label className="label">Trip length (days)</label>
          <input
            type="number"
            min={1}
            className="input mt-1"
            value={form.tripLength ?? 7}
            onChange={(e) => setForm((f) => ({ ...f, tripLength: Number(e.target.value) }))}
          />
        </div>

        <div className="card p-4">
          <label className="label">Start date (optional)</label>
          <input
            type="date"
            className="input mt-1"
            value={form.startDate || ""}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value || undefined }))}
          />
        </div>
      </div>

      <div className="card p-4">
        <label className="label">Interests</label>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
          {interestOpts.map((i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={(form.interests || []).includes(i)}
                onChange={() => toggleInterest(i)}
              />
              {i}
            </label>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <label className="label">Countries</label>
        <div className="mt-2">
          <Select
            instanceId="countries-select"
            isMulti
            options={countryOptions}
            value={countries}
            onChange={(vals) => setCountries(vals as any)}
            placeholder="Select countries..."
          />
        </div>
      </div>

      <div className="card p-4">
        <label className="label">Prioritized cities</label>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="Type a city and press Enter"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const v = cityInput.trim();
                if (v) { setCities((c) => [...c, v]); setCityInput(""); }
              }
            }}
          />
          <button type="button" className="btn-outline" onClick={() => { const v = cityInput.trim(); if (v) { setCities((c)=>[...c,v]); setCityInput(""); } }}>Add</button>
        </div>
        {cities.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {cities.map((city, idx) => (
              <span key={idx} className="inline-flex items-center gap-2 rounded-xl px-3 py-1 text-sm bg-[#F8FAFC] border" style={{ borderColor: 'var(--border)' }}>
                {city}
                <button type="button" onClick={() => setCities((c) => c.filter((_, i) => i !== idx))} className="opacity-60 hover:opacity-100">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn">Generate Itinerary</button>
      </div>
    </form>
  );
}
