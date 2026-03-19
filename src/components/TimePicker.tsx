import { useState } from 'react'
import { motion } from 'framer-motion'

interface TimePickerProps {
  title: string
  initialTime?: Date
  onConfirm: (time: Date) => void
  onCancel: () => void
}

export function TimePicker({ title, initialTime, onConfirm, onCancel }: TimePickerProps) {
  const now = initialTime || new Date()
  const [hour, setHour] = useState(now.getHours())
  const [minute, setMinute] = useState(now.getMinutes())

  const handleConfirm = () => {
    const date = new Date()
    date.setHours(hour, minute, 0, 0)
    // Don't allow future times
    if (date > new Date()) {
      date.setDate(date.getDate() - 1)
    }
    onConfirm(date)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-bg/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-bg-card border border-bg-elevated rounded-2xl p-6 max-w-xs w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <div className="text-sm text-text-dim mb-1">When did you do it?</div>
          <div className="font-bold">{title}</div>
        </div>

        {/* Time selector */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex flex-col items-center">
            <button
              onClick={() => setHour(h => (h + 1) % 24)}
              className="text-text-dim text-2xl px-3 py-1 active:text-accent"
            >
              ▲
            </button>
            <div className="text-4xl font-mono font-bold text-accent w-16 text-center">
              {hour.toString().padStart(2, '0')}
            </div>
            <button
              onClick={() => setHour(h => (h - 1 + 24) % 24)}
              className="text-text-dim text-2xl px-3 py-1 active:text-accent"
            >
              ▼
            </button>
          </div>

          <span className="text-4xl font-mono text-text-dim font-bold">:</span>

          <div className="flex flex-col items-center">
            <button
              onClick={() => setMinute(m => (m + 5) % 60)}
              className="text-text-dim text-2xl px-3 py-1 active:text-accent"
            >
              ▲
            </button>
            <div className="text-4xl font-mono font-bold text-accent w-16 text-center">
              {minute.toString().padStart(2, '0')}
            </div>
            <button
              onClick={() => setMinute(m => (m - 5 + 60) % 60)}
              className="text-text-dim text-2xl px-3 py-1 active:text-accent"
            >
              ▼
            </button>
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex gap-2 mb-4 justify-center flex-wrap">
          {[
            { label: '5am', h: 5, m: 0 },
            { label: '6am', h: 6, m: 0 },
            { label: '7am', h: 7, m: 0 },
            { label: '8am', h: 8, m: 0 },
            { label: 'Now', h: new Date().getHours(), m: new Date().getMinutes() },
          ].map(preset => (
            <button
              key={preset.label}
              onClick={() => { setHour(preset.h); setMinute(preset.m) }}
              className="px-3 py-1 rounded-lg text-xs bg-bg-elevated text-text-dim
                         active:bg-accent/20 active:text-accent transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            className="flex-1 bg-success text-bg font-bold py-3 rounded-xl
                       active:scale-95 transition-transform"
          >
            Confirm
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-3 rounded-xl bg-bg-elevated text-text-dim
                       active:scale-95 transition-transform"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
