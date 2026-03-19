import { motion } from 'framer-motion'
import type { User } from '../types'

interface UserPickerProps {
  users: User[]
  onPick: (index: number) => void
}

export function UserPicker({ users, onPick }: UserPickerProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-5xl mb-4">🙏</div>
        <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-accent to-accent-glow bg-clip-text text-transparent">
          ADHD to Satva
        </h1>
        <p className="text-text-dim mb-8">Who's using this device?</p>
        <div className="flex gap-4 justify-center">
          {users.map((user, i) => (
            <motion.button
              key={user.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onPick(i)}
              className="bg-bg-card border border-bg-elevated rounded-2xl p-6 w-36
                         hover:border-accent/50 active:bg-bg-elevated transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center
                              text-accent text-3xl font-bold mx-auto mb-3">
                {user.name[0]}
              </div>
              <div className="font-bold text-lg">{user.name}</div>
              <div className="text-text-dim text-xs mt-1">Lv.{user.level}</div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}
