import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCombo, getComboMultiplier, getComboLabel, COMBO_WINDOW } from '../hooks/useCombo'

export function ComboMeter() {
  const { combo, lastCompletionTime } = useCombo()
  const [remaining, setRemaining] = useState(1)

  // Live countdown — ticks every 100ms so the bar drains smoothly
  useEffect(() => {
    if (combo < 2 || !lastCompletionTime) return
    const tick = () => {
      const elapsed = Date.now() - lastCompletionTime
      setRemaining(Math.max(0, 1 - elapsed / COMBO_WINDOW))
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [combo, lastCompletionTime])

  if (combo < 2) return null

  const multiplier = getComboMultiplier(combo)
  const label = getComboLabel(combo)
  const urgent = remaining < 0.3

  return (
    <AnimatePresence>
      <motion.div
        key="combo"
        initial={{ scale: 0, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0, opacity: 0, y: -20 }}
        className={`rounded-2xl p-3 border flex items-center gap-3
          ${urgent
            ? 'bg-streak/10 border-streak/40 shadow-[0_0_20px_rgba(249,115,22,0.2)]'
            : 'bg-bg-card border-accent/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]'}`}
      >
        <motion.div
          animate={combo >= 5
            ? { rotate: [0, -15, 15, -15, 15, 0], scale: [1, 1.3, 1] }
            : { rotate: [0, -10, 10, 0] }}
          transition={{ duration: combo >= 5 ? 0.5 : 0.3, repeat: Infinity, repeatDelay: 0.2 }}
          className="text-3xl"
        >
          ⚡
        </motion.div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <motion.span
              key={combo}
              initial={{ scale: 1.8, color: '#fbbf24' }}
              animate={{ scale: 1, color: urgent ? '#f97316' : '#f59e0b' }}
              className="font-black text-xl"
            >
              x{combo}
            </motion.span>
            <span className={`text-sm font-bold ${urgent ? 'text-streak' : 'text-accent-glow'}`}>
              {label}
            </span>
            <span className="ml-auto text-xs font-mono text-xp bg-xp/10 px-2 py-0.5 rounded-full">
              {multiplier}x XP
            </span>
          </div>
          {/* Draining bar */}
          <div className="h-2 bg-bg-elevated rounded-full overflow-hidden mt-1.5">
            <motion.div
              className={`h-full rounded-full ${urgent
                ? 'bg-gradient-to-r from-streak to-red-500'
                : 'bg-gradient-to-r from-accent to-accent-glow'}`}
              style={{ width: `${remaining * 100}%` }}
              animate={urgent ? { opacity: [1, 0.5, 1] } : {}}
              transition={urgent ? { duration: 0.4, repeat: Infinity } : {}}
            />
          </div>
          <div className={`text-xs mt-1 ${urgent ? 'text-streak font-bold' : 'text-text-dim'}`}>
            {urgent ? 'HURRY! Complete another task!' : 'Keep going to build your combo!'}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
