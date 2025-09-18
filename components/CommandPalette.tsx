'use client'
import * as React from 'react'
import { Command } from 'cmdk'
import { PlusCircle, Download, Wand2, Calendar, RotateCcw, Redo } from 'lucide-react'

type Props = {
  open: boolean
  setOpen: (v: boolean) => void
  onNewDay: () => void
  onNewActivity: (dayId?: string) => void
  onAIRefine: () => void
  onDownloadJSON: () => void
  onDownloadICS: () => void
  onUndo: () => void
  onRedo: () => void
}

export default function CommandPalette(p: Props) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); p.setOpen(!p.open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [p.open])

  return (
    <Command.Dialog open={p.open} onOpenChange={p.setOpen} label="Command Menu">
      <div className="fixed inset-0 bg-black/30" />
      <div className="fixed left-1/2 top-24 z-50 w-[90vw] max-w-xl -translate-x-1/2">
        <div className="card p-2">
          <Command.Input placeholder="Type a command…" className="input" />
          <Command.List className="max-h-80 overflow-auto mt-2">
            <Command.Empty className="p-3 text-sm text-ink/60">No results.</Command.Empty>
            <Command.Group heading="Itinerary">
              <Command.Item onSelect={p.onNewDay}><PlusCircle className="mr-2" size={16}/>Add day</Command.Item>
              <Command.Item onSelect={() => p.onNewActivity()}><PlusCircle className="mr-2" size={16}/>Add activity to current day</Command.Item>
              <Command.Item onSelect={p.onAIRefine}><Wand2 className="mr-2" size={16}/>Refine with AI</Command.Item>
            </Command.Group>
            <Command.Group heading="Export">
              <Command.Item onSelect={p.onDownloadJSON}><Download className="mr-2" size={16}/>Download JSON</Command.Item>
              <Command.Item onSelect={p.onDownloadICS}><Calendar className="mr-2" size={16}/>Export ICS</Command.Item>
            </Command.Group>
            <Command.Group heading="Edit">
              <Command.Item onSelect={p.onUndo}><RotateCcw className="mr-2" size={16}/>Undo</Command.Item>
              <Command.Item onSelect={p.onRedo}><Redo className="mr-2" size={16}/>Redo</Command.Item>
            </Command.Group>
          </Command.List>
        </div>
      </div>
    </Command.Dialog>
  )
}
