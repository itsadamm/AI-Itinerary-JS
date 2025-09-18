# AI Itinerary — Advanced (Next.js + Node)

Mediterranean-themed, editor-first trip planner with AI generation/refinement, constraint checks, map canvas, command palette, and exports (JSON & ICS).

## Quick Start
1) `npm i`
2) Copy `.env.local.example` → `.env.local` and set your OpenAI key.
3) `npm run dev`

## Env
- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (optional, default: gpt-4o-mini)
- `GEOCODE_USER_AGENT` (optional but recommended for Nominatim usage policy)

## Features
- AI draft + refine
- Editor-first DnD for days/activities (stable IDs)
- Inline edit titles, times, places
- Command palette (⌘K / Ctrl+K) for quick actions
- Map canvas with markers per activity (MapLibre + OSM raster)
- Constraint checks (approx walking distance per day)
- Exports: JSON & ICS calendar
- Mediterranean theme (beige/terracotta/maroon/sunrise)

## Notes
- Node 18.17+ or Node 20 LTS recommended.
- Geocoding uses Nominatim public endpoint from your own machine; add a real `GEOCODE_USER_AGENT` like `your-email@example.com`.
# AI-Itinerary-JS
