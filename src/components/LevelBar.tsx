import { motion } from 'framer-motion'
import { getLevelProgress, getLevelName, getXpForNextLevel, getXpForCurrentLevel } from '../lib/xp'
import { useUser } from '../hooks/useUser'

export function LevelBar() {
  const { currentUser } = useUser()
  if (!currentUser) return null

  const progress = getLevelProgress(currentUser.total_xp, currentUser.level)
  const levelName = getLevelName(currentUser.level)
  const currentLevelXp = getXpForCurrentLevel(currentUser.level)
  const nextLevelXp = getXpForNextLevel(currentUser.level)

  return (
    <div className="bg-bg-card rounded-2xl p-4 border border-bg-elevated">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className="text-accent font-bold text-lg">Lv.{currentUser.level}</span>
          <span className="text-text-dim text-sm">{levelName}</span>
        </div>
        <span className="text-xp font-mono text-sm">
          {currentUser.total_xp - currentLevelXp} / {nextLevelXp - currentLevelXp} XP
        </span>
      </div>
      <div className="h-3 bg-bg-elevated rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-glow"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            boxShadow: '0 0 12px rgba(245, 158, 11, 0.5)',
          }}
        />
      </div>
    </div>
  )
}
