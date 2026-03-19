import { motion } from 'framer-motion'
import { acceptUpdate } from '../lib/updater'

export function UpdateBanner() {
  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 bg-accent p-3 text-center shadow-lg"
    >
      <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
        <span className="text-bg font-bold text-sm">
          ✨ New version available!
        </span>
        <button
          onClick={acceptUpdate}
          className="bg-bg text-accent font-bold px-4 py-1.5 rounded-lg text-sm
                     active:scale-95 transition-transform"
        >
          Update Now
        </button>
      </div>
    </motion.div>
  )
}
