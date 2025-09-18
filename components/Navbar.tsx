'use client'
import { Compass } from 'lucide-react'

export default function Navbar() {
  return (
    <header className="border-b border-[rgba(0,0,0,.1)] bg-sand/60 backdrop-blur">
      <div className="container flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-terracotta text-white">
            <Compass size={18} />
          </div>
          <div className="leading-tight">
            <div className="font-bold tracking-wide" style={{letterSpacing:'.02em'}}>AI Itinerary</div>
            <div className="text-xs text-ink/60">Plan. Edit. Explore.</div>
          </div>
        </div>
        <div className="hidden md:flex gap-2">
          <a href="#" className="btn-outline">Docs</a>
          <a href="https://openstreetmap.org" className="btn-outline" target="_blank">Map Data</a>
        </div>
      </div>
    </header>
  )
}
