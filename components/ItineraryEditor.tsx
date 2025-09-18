'use client'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import type { Day, Activity, Place } from '@/types'
import { evaluateDay } from '@/lib/constraints'

type Props = { value: Day[]; onChange: (days: Day[]) => void; startDate?: string; searchHint?: string }

export default function ItineraryEditor({ value, onChange, startDate, searchHint }: Props) {
  const [editing, setEditing] = useState<{ activityId?: string; dayId?: string } | null>(null)
  const [newActivityText, setNewActivityText] = useState<Record<string,string>>({})
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  // Alternatives per activityId
  const [altOpen, setAltOpen] = useState<Record<string, boolean>>({})
  const [alternatives, setAlternatives] = useState<Record<string, Activity[]>>({})
  // Events per day
  const [eventsOpen, setEventsOpen] = useState<Record<string, boolean>>({})
  const [eventsByDay, setEventsByDay] = useState<Record<string, { id: string; text: string }[]>>({})
  const [eventsLoading, setEventsLoading] = useState<Record<string, boolean>>({})

  const selectedDay = useMemo(() => value.find(d => d.id === selectedDayId) || value[0], [value, selectedDayId])

  function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
    const result = Array.from(list)
    const [removed] = result.splice(startIndex, 1)
    result.splice(endIndex, 0, removed)
    return result
  }

  function onDragEnd(result: DropResult) {
    const { source, destination, type } = result
    if (!destination) return

    if (type === 'DAY') {
      const days = reorder(value, source.index, destination.index)
      onChange(days); return
    }

    if (type === 'ACTIVITY') {
      // Drop from Events pool into a day
      if (source.droppableId.startsWith('EVT:')) {
        const srcDayId = source.droppableId.slice(4)
        const evts = eventsByDay[srcDayId] || []
        const item = evts[source.index]
        if (!item) return
        const destDayIdx = value.findIndex(d => d.id === destination.droppableId)
        if (destDayIdx === -1) return
        const destDay = value[destDayIdx]
        const newAct: Activity = { id: nanoid(), text: item.text }
        const dstActs = Array.from(destDay.activities)
        dstActs.splice(destination.index, 0, newAct)
        const days = [...value]
        days[destDayIdx] = { ...destDay, activities: dstActs }
        onChange(days)
        return
      }
      // Drop from Alternatives pool into a day
      if (source.droppableId.startsWith('ALT:')) {
        const srcActId = source.droppableId.slice(4)
        const alts = alternatives[srcActId] || []
        const altItem = alts[source.index]
        if (!altItem) return
        const destDayIdx = value.findIndex(d => d.id === destination.droppableId)
        if (destDayIdx === -1) return
        const destDay = value[destDayIdx]
        const newAct: Activity = { ...altItem, id: nanoid() }
        const dstActs = Array.from(destDay.activities)
        dstActs.splice(destination.index, 0, newAct)
        const days = [...value]
        days[destDayIdx] = { ...destDay, activities: dstActs }
        onChange(days)
        return
      }

      // Move activity between/within days
      const sourceDayIdx = value.findIndex(d => d.id === source.droppableId)
      const destDayIdx = value.findIndex(d => d.id === destination.droppableId)
      if (sourceDayIdx === -1 || destDayIdx === -1) return

      const sourceDay = value[sourceDayIdx]
      const destDay = value[destDayIdx]
      const moving = sourceDay.activities[source.index]

      if (source.droppableId === destination.droppableId) {
        const updatedActs = reorder(sourceDay.activities, source.index, destination.index)
        const days = [...value]
        days[sourceDayIdx] = { ...sourceDay, activities: updatedActs }
        onChange(days)
      } else {
        const srcActs = Array.from(sourceDay.activities)
        srcActs.splice(source.index, 1)
        const dstActs = Array.from(destDay.activities)
        dstActs.splice(destination.index, 0, moving)
        const days = [...value]
        days[sourceDayIdx] = { ...sourceDay, activities: srcActs }
        days[destDayIdx] = { ...destDay, activities: dstActs }
        onChange(days)
      }
    }
  }

  function formatDateForIndex(idx: number): string | null {
    if (!startDate) return null
    const d = new Date(startDate + 'T00:00:00')
    if (Number.isNaN(d.getTime())) return null
    d.setDate(d.getDate() + idx)
    const fmt = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    return fmt
  }

  async function fetchEventsForDay(day: Day, dayIndex: number) {
    // Prefer day title as a location hint (e.g., "Bangkok").
    const titleHint = (day.title || '').trim()
    // Try to use centroid of places; else use title; else use overall searchHint
    const pts = day.activities.map(a => a.place).filter(Boolean) as { lat:number; lng:number }[]
    const dateISO = (() => {
      if (!startDate) return ''
      const d0 = new Date(startDate + 'T00:00:00')
      if (Number.isNaN(d0.getTime())) return ''
      d0.setDate(d0.getDate() + dayIndex)
      return d0.toISOString().slice(0,10)
    })()
    let query = ''
    if (titleHint) {
      query = `/api/events?q=${encodeURIComponent(titleHint)}${dateISO?`&date=${dateISO}`:''}`
    } else if (pts.length) {
      const avg = pts.reduce((acc,p)=>({lat:acc.lat+p.lat,lng:acc.lng+p.lng}),{lat:0,lng:0})
      avg.lat/=pts.length; avg.lng/=pts.length
      query = `/api/events?lat=${encodeURIComponent(avg.lat)}&lon=${encodeURIComponent(avg.lng)}${dateISO?`&date=${dateISO}`:''}`
    } else if (searchHint) {
      query = `/api/events?q=${encodeURIComponent(searchHint)}${dateISO?`&date=${dateISO}`:''}`
    } else {
      return
    }
    setEventsLoading(s => ({ ...s, [day.id]: true }))
    try {
      const res = await fetch(query)
      const data = await res.json()
      const list: { id: string; text: string }[] = (data?.events || []).map((e:any)=>({ id: nanoid(), text: `${e.name}${e.when?` · ${e.when}`:''}${e.venue?` · ${e.venue}`:''}` }))
      setEventsByDay(s => ({ ...s, [day.id]: list }))
    } finally {
      setEventsLoading(s => ({ ...s, [day.id]: false }))
    }
  }

  function saveActivity(dayId: string, activityId: string, patch: Partial<Activity>) {
    const days = value.map(d => d.id !== dayId ? d : ({
      ...d,
      activities: d.activities.map(a => a.id === activityId ? { ...a, ...patch } : a)
    }))
    onChange(days)
    setEditing(null)
  }

  function addActivity(dayId: string) {
    const text = (newActivityText[dayId] || '').trim()
    if (!text) return
    const act: Activity = { id: nanoid(), text }
    const days = value.map(d => d.id !== dayId ? d : ({ ...d, activities: [...d.activities, act] }))
    onChange(days)
    setNewActivityText(s => ({ ...s, [dayId]: '' }))
  }

  function deleteActivity(dayId: string, activityId: string) {
    const days = value.map(d => d.id !== dayId ? d : ({ ...d, activities: d.activities.filter(a => a.id !== activityId) }))
    onChange(days)
  }

  function toggleAlternativesFor(activity: Activity) {
    setAltOpen(s => ({ ...s, [activity.id]: !s[activity.id] }))
    setAlternatives(prev => {
      if (prev[activity.id]) return prev
      const start = activity.start
      const end = activity.end
      const mk = (text: string): Activity => ({ id: nanoid(), text, start, end })
      const base = activity.text
      const ideas = [
        mk('Visit a local market'),
        mk('Guided neighborhood walking tour'),
        mk('Coffee at a top-rated cafe'),
        mk('Scenic viewpoint at sunset'),
        mk('Modern art gallery visit'),
      ]
      return { ...prev, [activity.id]: ideas }
    })
  }

  function renameDay(dayId: string, title: string) {
    const days = value.map(d => d.id === dayId ? { ...d, title } : d)
    onChange(days)
    setEditing(null)
  }

  function addDay() {
    const dayNumber = value.length + 1
    onChange([...value, { id: nanoid(), title: `Day ${dayNumber}`, activities: [] }])
  }

  function deleteDay(dayId: string) {
    onChange(value.filter(d => d.id !== dayId))
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="days" type="DAY" direction="vertical">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 gap-4">
            {value.map((day, idx) => {
              const metrics = evaluateDay(day)
              return (
                <Draggable draggableId={day.id} index={idx} key={day.id}>
                  {(p) => (
                    <div ref={p.innerRef} {...p.draggableProps} className={`card p-4 ${selectedDay?.id===day.id?'ring-2 ring-terracotta':''}`}>
                      <div className="flex items-center justify-between" {...p.dragHandleProps}>
                        <div className="flex items-center gap-3 flex-1">
                          <span className="inline-flex items-center rounded-xl px-2.5 py-1 text-sm font-semibold border" style={{borderColor:'var(--border)'}}>Day {idx+1}{formatDateForIndex(idx)?` · ${formatDateForIndex(idx)}`:''}</span>
                          {editing?.dayId === day.id ? (
                            <form onSubmit={(e) => { e.preventDefault(); const input = (e.currentTarget.elements.namedItem('title') as HTMLInputElement); renameDay(day.id, input.value); }} className="flex-1 mr-2">
                              <input name="title" defaultValue={day.title} className="input w-full" />
                            </form>
                          ) : (
                            <button className="font-semibold text-lg cursor-text text-ink/90" onClick={() => { setEditing({ dayId: day.id }); setSelectedDayId(day.id) }}>{day.title}</button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {editing?.dayId === day.id ? (
                            <button className="btn-outline" onClick={() => setEditing(null)}>Cancel</button>
                          ) : (
                            <>
                              <span className="text-xs text-ink/60">Walk: {metrics.totalKm.toFixed(1)} km</span>
                              {metrics.tooLong && <span className="text-xs px-2 py-1 bg-sun/20 text-sun rounded-xl">Long day</span>}
                              <button className="btn-outline" type="button" onClick={async()=>{ setEventsOpen(s=>({...s,[day.id]:!s[day.id]})); if (!eventsByDay[day.id]) await fetchEventsForDay(day, idx); }}>Find events</button>
                              <button className="btn-outline" onClick={() => deleteDay(day.id)}>Delete Day</button>
                            </>
                          )}
                        </div>
                      </div>

                      <Droppable droppableId={day.id} type="ACTIVITY">
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.droppableProps} className="mt-3 space-y-2">
                            {eventsOpen[day.id] && (
                              <div className="card p-3">
                                <div className="text-sm opacity-70 mb-2 flex items-center gap-2">{eventsLoading[day.id] ? (<><span className="spinner" /><span>Finding events…</span></>) : 'Drag any event into this day'}</div>
                                {!eventsLoading[day.id] && (eventsByDay[day.id]?.length ?? 0) === 0 && (
                                  <div className="text-sm opacity-60">No specific events found for this date.</div>
                                )}
                                <Droppable droppableId={`EVT:${day.id}`} direction="horizontal" type="ACTIVITY">
                                  {(px) => (
                                    <div ref={px.innerRef} {...px.droppableProps} className="flex gap-2 flex-wrap w-full">
                                      {(eventsByDay[day.id] || []).map((ev, ei) => (
                                        <Draggable draggableId={ev.id} index={ei} key={ev.id}>
                                          {(p3) => (
                                            <div ref={p3.innerRef} {...p3.draggableProps} {...p3.dragHandleProps} className="card px-3 py-2 text-sm">
                                              {ev.text}
                                            </div>
                                          )}
                                        </Draggable>
                                      ))}
                                      {px.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              </div>
                            )}
                            {day.activities.map((a, i) => (
                              <Draggable draggableId={a.id} index={i} key={a.id}>
                                {(p2) => (
                                  <div ref={p2.innerRef} {...p2.draggableProps} {...p2.dragHandleProps} className="flex items-start gap-3 card p-3">
                                    {editing?.activityId === a.id ? (
                                      <InlineActivityEditor
                                        initial={a}
                                        onCancel={() => setEditing(null)}
                                        onSave={(patch) => saveActivity(day.id, a.id, patch)}
                                      />
                                    ) : (
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          {(a.start || a.end) && <span className="text-xs text-ink/60">{a.start || '—'}–{a.end || '—'}</span>}
                                          <p className="cursor-text font-medium" onClick={() => setEditing({ activityId: a.id })}>{a.text}</p>
                                        </div>
                                        {a.place && (
                                          <p className="text-xs text-ink/60 mt-1">📍 {a.place.name}{a.place.address?` · ${a.place.address}`:''}</p>
                                        )}
                                        <div className="mt-2 flex gap-2">
                                          <button type="button" className="btn-outline" onClick={() => toggleAlternativesFor(a)}>Options</button>
                                        </div>
                                        {altOpen[a.id] && (
                                          <div className="mt-3">
                                            <p className="text-xs opacity-70 mb-2">Drag any option into a day</p>
                                            <Droppable droppableId={`ALT:${a.id}`} direction="horizontal" type="ACTIVITY">
                                              {(px) => (
                                                <div ref={px.innerRef} {...px.droppableProps} className="flex gap-2 flex-wrap w-full">
                                                  {(alternatives[a.id] || []).map((opt, oi) => (
                                                    <Draggable draggableId={opt.id} index={oi} key={opt.id}>
                                                      {(p3) => (
                                                        <div ref={p3.innerRef} {...p3.draggableProps} {...p3.dragHandleProps} className="card px-3 py-2 text-sm">
                                                          {opt.text}
                                                        </div>
                                                      )}
                                                    </Draggable>
                                                  ))}
                                                  {px.placeholder}
                                                </div>
                                              )}
                                            </Droppable>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {editing?.activityId !== a.id && (
                                      <button className="btn-outline" onClick={() => deleteActivity(day.id, a.id)}>Delete</button>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>

                      <div className="mt-3 flex gap-2">
                        <input
                          className="input flex-1"
                          placeholder="Add activity"
                          value={newActivityText[day.id] || ''}
                          onChange={e => setNewActivityText(s => ({ ...s, [day.id]: e.target.value }))}
                        />
                        <button className="btn-outline" onClick={() => addActivity(day.id)}>Add</button>
                      </div>
                    </div>
                  )}
                </Draggable>
              )
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="mt-4">
        <button className="btn" onClick={addDay}>Add Day</button>
      </div>
    </DragDropContext>
  )
}

function InlineActivityEditor({ initial, onSave, onCancel }:{ initial: Activity; onSave:(patch:Partial<Activity>)=>void; onCancel:()=>void }){
  const [text, setText] = useState(initial.text)
  const [start, setStart] = useState(initial.start || '')
  const [end, setEnd] = useState(initial.end || '')
  const [placeQuery, setPlaceQuery] = useState('')
  const [results, setResults] = useState<any[]>([])

  async function search() {
    if (!placeQuery.trim()) return
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(placeQuery)}`)
    const data = await res.json()
    setResults(data)
  }

  function setPlace(r:any){
    const p: Place = { name: r.display_name || r.name, lat: Number(r.lat), lng: Number(r.lon), address: r.display_name }
    onSave({ text, start, end, place: p })
  }

  return (
    <form className="flex-1 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); onSave({ text, start, end }) }}>
      <textarea className="input" rows={2} value={text} onChange={e=>setText(e.target.value)} />
      <div className="grid grid-cols-3 gap-2">
        <input className="input" placeholder="Start (09:00)" value={start} onChange={e=>setStart(e.target.value)} />
        <input className="input" placeholder="End (11:30)" value={end} onChange={e=>setEnd(e.target.value)} />
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Search place (Rome Colosseum)" value={placeQuery} onChange={e=>setPlaceQuery(e.target.value)} />
          <button className="btn-outline" type="button" onClick={search}>Find</button>
        </div>
      </div>
      {results.length > 0 && (
        <div className="max-h-40 overflow-auto border rounded-xl">
          {results.slice(0,5).map((r:any, idx:number)=>(
            <button key={idx} type="button" className="w-full text-left px-3 py-2 hover:bg-sandDeep" onClick={()=>setPlace(r)}>
              {r.display_name}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn">Save</button>
        <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
