import { useState, useCallback } from 'react'
import { SadhanaTracker } from '../components/SadhanaTracker'
import { XpPopup } from '../components/XpPopup'
import type { XpEvent } from '../types'

function getDateStr(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

export function Sadhana() {
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([])
  const [dayOffset, setDayOffset] = useState(0) // 0 = today, -1 = yesterday

  const date = getDateStr(dayOffset)
  const isToday = dayOffset === 0

  const handleXpEarned = useCallback((amount: number) => {
    const event: XpEvent = {
      amount,
      x: Math.random() * (window.innerWidth - 100) + 50,
      y: 300,
      id: crypto.randomUUID(),
    }
    setXpEvents(prev => [...prev, event])
    setTimeout(() => setXpEvents(prev => prev.filter(e => e.id !== event.id)), 1500)
  }, [])

  return (
    <div className="space-y-4">
      <XpPopup events={xpEvents} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🙏 Sadhana</h1>
      </div>

      {/* Day selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setDayOffset(0)}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors
            ${isToday ? 'bg-sadhana text-bg' : 'bg-bg-card text-text-dim border border-bg-elevated'}`}
        >
          Today
        </button>
        <button
          onClick={() => setDayOffset(-1)}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors
            ${dayOffset === -1 ? 'bg-sadhana text-bg' : 'bg-bg-card text-text-dim border border-bg-elevated'}`}
        >
          Yesterday
        </button>
      </div>

      <SadhanaTracker key={date} onXpEarned={handleXpEarned} date={date} />
    </div>
  )
}
