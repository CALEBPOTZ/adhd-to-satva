import { motion, AnimatePresence } from 'framer-motion'
import type { XpEvent } from '../types'

export function XpPopup({ events }: { events: XpEvent[] }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <AnimatePresence>
        {events.map(event => (
          <motion.div
            key={event.id}
            initial={{ opacity: 1, y: 0, x: event.x, scale: 0.5 }}
            animate={{ opacity: 0, y: -120, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute text-xp font-bold text-2xl drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]"
            style={{ left: event.x, top: event.y }}
          >
            +{event.amount} XP
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
