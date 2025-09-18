'use client'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import type { Day, Activity, Place } from '@/types'
import { evaluateDay } from '@/lib/constraints'

type Props = { value: Day[]; onChange: (days: Day[]) => void }

export default function ItineraryEditor({ value, onChange }: Props) {
  const [editing, setEditing] = useState<{ activityId?: string; dayId?: string } | null>(null)
  const [newActivityText, setNewActivityText] = useState<Record<string,string>>({})
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  // Alternatives per activityId
  const [altOpen, setAltOpen] = useState<Record<string, boolean>>({})
  const [alternatives, setAlternatives] = useState<Record<string, Activity[]>>({})

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
          <div ref={provided.innerRef} {...provided.droppableProps} className="grid lg:grid-cols-2 gap-4">
            {value.map((day, idx) => {
              const metrics = evaluateDay(day)
              const hasOptions = day.activities.some(a => altOpen[a.id])
              return (
                <Draggable draggableId={day.id} index={idx} key={day.id}>
                  {(p) => (
                    <div ref={p.innerRef} {...p.draggableProps} className={`card p-4 ${selectedDay?.id===day.id?'ring-2 ring-terracotta':''} ${hasOptions ? 'relative z-20' : ''}`}>
                      <div className="flex items-center justify-between" {...p.dragHandleProps}>
                        {editing?.dayId === day.id ? (
                          <form onSubmit={(e) => { e.preventDefault(); const input = (e.currentTarget.elements.namedItem('title') as HTMLInputElement); renameDay(day.id, input.value); }} className="flex-1 mr-2">
                            <input name="title" defaultValue={day.title} className="input w-full" />
                          </form>
                        ) : (
                          <button className="font-semibold text-lg cursor-text text-white/90" onClick={() => { setEditing({ dayId: day.id }); setSelectedDayId(day.id) }}>{day.title}</button>
                        )}
                        <div className="flex gap-2">
                          {editing?.dayId === day.id ? (
                            <button className="btn-outline" onClick={() => setEditing(null)}>Cancel</button>
                          ) : (
                            <>
                              <span className="text-xs text-white/60">Walk: {metrics.totalKm.toFixed(1)} km</span>
                              {metrics.tooLong && <span className="text-xs px-2 py-1 bg-sun/20 text-sun rounded-xl">Long day</span>}
                              <button className="btn-outline" onClick={() => deleteDay(day.id)}>Delete Day</button>
                            </>
                          )}
                        </div>
                      </div>

                      <Droppable droppableId={day.id} type="ACTIVITY">
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.droppableProps} className="mt-3 space-y-2">
                            {day.activities.map((a, i) => (
                              <Draggable draggableId={a.id} index={i} key={a.id}>
                                {(p2) => (
                                  <div ref={p2.innerRef} {...p2.draggableProps} {...p2.dragHandleProps} className={`flex items-start gap-3 card p-3 ${altOpen[a.id] ? 'relative z-20' : ''}`}>
                                    {editing?.activityId === a.id ? (
                                      <InlineActivityEditor
                                        initial={a}
                                        onCancel={() => setEditing(null)}
                                        onSave={(patch) => saveActivity(day.id, a.id, patch)}
                                      />
                                    ) : (
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          {(a.start || a.end) && <span className="text-xs text-white/60">{a.start || '—'}–{a.end || '—'}</span>}
                                          <p className="cursor-text font-medium" onClick={() => setEditing({ activityId: a.id })}>{a.text}</p>
                                        </div>
                                        {a.place && (
                                          <p className="text-xs text-white/60 mt-1">📍 {a.place.name}{a.place.address?` · ${a.place.address}`:''}</p>
                                        )}
                                        <div className="mt-2 flex gap-2">
                                          <button type="button" className="btn-outline" onClick={() => toggleAlternativesFor(a)}>Options</button>
                                        </div>
                                        {altOpen[a.id] && (
                                          <div className="mt-3 relative z-30">
                                            <p className="text-xs opacity-70 mb-2">Drag any option into a day</p>
                                            <Droppable droppableId={`ALT:${a.id}`} direction="horizontal" type="ACTIVITY">
                                              {(px) => (
                                                <div ref={px.innerRef} {...px.droppableProps} className="flex gap-2 overflow-x-auto relative z-30 w-full">
                                                  {(alternatives[a.id] || []).map((opt, oi) => (
                                                    <Draggable draggableId={opt.id} index={oi} key={opt.id}>
                                                      {(p3) => (
                                                        <div ref={p3.innerRef} {...p3.draggableProps} {...p3.dragHandleProps} className="card px-3 py-2 text-sm whitespace-nowrap">
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
