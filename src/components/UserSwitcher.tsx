import { motion } from 'framer-motion'
import { useUser } from '../hooks/useUser'

export function UserSwitcher() {
  const { currentUser, otherUser, switchUser } = useUser()
  if (!currentUser) return null

  return (
    <button
      onClick={switchUser}
      className="flex items-center gap-2 bg-bg-card border border-bg-elevated rounded-full px-4 py-2
                 active:scale-95 transition-transform"
    >
      <motion.div
        key={currentUser.name}
        initial={{ rotate: -180, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold"
      >
        {currentUser.name[0]}
      </motion.div>
      <span className="font-medium">{currentUser.name}</span>
      {otherUser && (
        <span className="text-text-dim text-xs">→ {otherUser.name}</span>
      )}
    </button>
  )
}
