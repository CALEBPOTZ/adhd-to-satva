import { useState, useCallback } from 'react'
import { SadhanaTracker } from '../components/SadhanaTracker'
import { XpPopup } from '../components/XpPopup'
import type { XpEvent } from '../types'

export function Sadhana() {
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([])

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
      <h1 className="text-2xl font-bold">🙏 Sadhana</h1>
      <SadhanaTracker onXpEarned={handleXpEarned} />
    </div>
  )
}
