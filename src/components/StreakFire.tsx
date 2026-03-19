import { motion } from 'framer-motion'
import { useUser } from '../hooks/useUser'

export function StreakFire() {
  const { currentUser } = useUser()
  if (!currentUser) return null

  const streak = currentUser.current_streak
  const flameSize = Math.min(streak * 4 + 20, 60) // grows with streak

  return (
    <div className="bg-bg-card rounded-2xl p-4 border border-bg-elevated flex items-center gap-4">
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          rotate: [0, -5, 5, 0],
        }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          repeatType: 'reverse',
        }}
        className="text-center"
        style={{ fontSize: `${flameSize}px`, lineHeight: 1 }}
      >
        🔥
      </motion.div>
      <div>
        <div className="text-streak font-bold text-2xl">{streak} day{streak !== 1 ? 's' : ''}</div>
        <div className="text-text-dim text-sm">
          {streak === 0 ? 'Start your streak today!' :
           streak < 3 ? 'Keep it going!' :
           streak < 7 ? 'On fire!' :
           streak < 14 ? 'Unstoppable!' :
           streak < 30 ? 'Legendary streak!' :
           'TRANSCENDENTAL! 🙏'}
        </div>
        {currentUser.longest_streak > streak && (
          <div className="text-text-dim text-xs mt-1">Best: {currentUser.longest_streak} days</div>
        )}
      </div>
    </div>
  )
}
