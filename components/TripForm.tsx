'use client'
import { useMemo, useState } from 'react'
import Select from 'react-select'
import wc from 'world-countries'

export type TripPrefs = {
  travelPace: 'slow' | 'balanced' | 'fast';
  interests: string;
  budget: 'shoestring' | 'mid-range' | 'luxury';
  travelStyle: 'backpacker' | 'comfort' | 'mixed';
  tripLength: number;
  countries: string[];
  prioritizedCities: string[];
}

const paceOpts = [
  { value: 'slow', label: 'Slow' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'fast', label: 'Fast' },
]
const budgetOpts = [
  { value: 'shoestring', label: 'Shoestring' },
  { value: 'mid-range', label: 'Mid-range' },
  { value: 'luxury', label: 'Luxury' },
]
const styleOpts = [
  { value: 'backpacker', label: 'Backpacker' },
  { value: 'comfort', label: 'Comfort' },
  { value: 'mixed', label: 'Mixed' },
]

export default function TripForm({ onGenerate }:{ onGenerate: (prefs: TripPrefs) => void }) {
  const countryOptions = useMemo(() => wc.map(c => ({ value: c.name.common, label: `${c.name.common} ${c.flag}` })), [])
  const [countries, setCountries] = useState<any[]>([])
  const [cities, setCities] = useState<string>('')

  const [form, setForm] = useState<TripPrefs>({
    travelPace: 'balanced',
    interests: 'hiking, food, culture',
    budget: 'mid-range',
    travelStyle: 'mixed',
    tripLength: 7,
    countries: [],
    prioritizedCities: [],
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const prefs: TripPrefs = {
      ...form,
      countries: countries.map(c => c.value),
      prioritizedCities: cities.split(',').map(s => s.trim()).filter(Boolean),
    }
    onGenerate(prefs)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <label className="label">Travel pace</label>
          <select
            className="input mt-1"
            value={form.travelPace}
            onChange={e => setForm(f => ({ ...f, travelPace: e.target.value as any }))}
          >
            {paceOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="card p-4">
          <label className="label">Budget</label>
          <select
            className="input mt-1"
            value={form.budget}
            onChange={e => setForm(f => ({ ...f, budget: e.target.value as any }))}
          >
            {budgetOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="card p-4">
          <label className="label">Travel style</label>
          <select
            className="input mt-1"
            value={form.travelStyle}
            onChange={e => setForm(f => ({ ...f, travelStyle: e.target.value as any }))}
          >
            {styleOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="card p-4">
          <label className="label">Trip length (days)</label>
          <input
            type="number"
            min={1}
            className="input mt-1"
            value={form.tripLength}
            onChange={e => setForm(f => ({ ...f, tripLength: Number(e.target.value) }))}
          />
        </div>
      </div>

      <div className="card p-4">
        <label className="label">Interests</label>
        <textarea
          className="input mt-1"
          rows={2}
          value={form.interests}
          onChange={e => setForm(f => ({ ...f, interests: e.target.value }))}
        />
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
          />
        </div>
      </div>

      <div className="card p-4">
        <label className="label">Prioritized cities (comma-separated)</label>
        <input
          type="text"
          className="input mt-1"
          placeholder="Bangkok, Hanoi, Siem Reap"
          value={cities}
          onChange={e => setCities(e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn">Generate Itinerary</button>
      </div>
    </form>
  )
}
