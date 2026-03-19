import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { playTimerTick, playTimerDone } from '../lib/sounds'

interface TimerProps {
  seconds: number
  onComplete: () => void
  onCancel: () => void
  taskTitle: string
}

export function Timer({ seconds, onComplete, onCancel, taskTitle }: TimerProps) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          playTimerDone()
          setRunning(false)
          return 0
        }
        if (prev <= 6) playTimerTick()
        return prev - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const progress = 1 - remaining / seconds
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  const handleDone = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    onComplete()
  }, [onComplete])

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="fixed inset-0 z-40 bg-bg/90 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-bg-card border border-bg-elevated rounded-3xl p-8 max-w-sm w-full text-center">
        <div className="text-text-dim text-sm mb-2">⏱️ CHALLENGE MODE</div>
        <div className="text-lg font-semibold mb-6">{taskTitle}</div>

        {/* Circular progress */}
        <div className="relative w-48 h-48 mx-auto mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#241d40" strokeWidth="6" />
            <motion.circle
              cx="50" cy="50" r="45" fill="none"
              stroke={remaining <= 10 ? '#f97316' : '#22d3ee'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={283}
              animate={{ strokeDashoffset: 283 * (1 - progress) }}
              transition={{ duration: 0.5 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span
              className="text-5xl font-mono font-bold"
              animate={remaining <= 10 ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
              style={{ color: remaining <= 10 ? '#f97316' : '#22d3ee' }}
            >
              {mins}:{secs.toString().padStart(2, '0')}
            </motion.span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDone}
            className="flex-1 bg-success text-bg font-bold py-3 px-6 rounded-xl text-lg
                       active:scale-95 transition-transform"
          >
            ✅ Done!
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-3 rounded-xl bg-bg-elevated text-text-dim
                       active:scale-95 transition-transform"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  )
}
