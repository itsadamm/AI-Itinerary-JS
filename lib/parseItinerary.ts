import { nanoid } from 'nanoid'
import type { Day, Activity } from '@/types'

/**
 * Parse markdown-like AI text → structured days & activities.
 * Accepts headings like **Day 3: Hanoi Old Quarter** and "- " bullets.
 */
export function parseItinerary(text: string): Day[] {
  const lines = text.split(/\r?\n/)
  const days: Day[] = []

  let current: Day | null = null
  const dayHeader = /^\s*(?:\*\*)?Day\s+(\d+):\s*(.+?)(?:\*\*)?\s*$/i
  const bullet = /^\s*[-\*\u2022]|^\s*\d+\./ // -, *, •, or numbered

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const h = line.match(dayHeader)
    if (h) {
      if (current) days.push(current)
      current = { id: nanoid(), title: h[2].trim(), activities: [] }
      continue
    }

    if (current && bullet.test(line)) {
      const text = line.replace(/^[-\*\u2022]\s*/, '').replace(/^\d+\.\s*/, '')
      const act: Activity = { id: nanoid(), text: text.trim() }
      current.activities.push(act)
      continue;
    }
  }
  if (current) days.push(current)
  return days
}

export function toRenderableText(days: Day[]): string {
  return days.map((d, i) => `**Day ${i + 1}: ${d.title}**\n` + d.activities.map(a => `- ${a.text}`).join("\n")).join("\n")
}
