import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Task } from '../types'
import { Timer } from './Timer'
import { playJustStart } from '../lib/sounds'

interface JustStartButtonProps {
  tasks: Task[]
  onComplete: (taskId: string, usedTimer: boolean, timerSeconds?: number) => void
}

export function JustStartButton({ tasks, onComplete }: JustStartButtonProps) {
  const [active, setActive] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [showTimer, setShowTimer] = useState(false)

  const pickTask = useCallback(() => {
    if (tasks.length === 0) return
    // Pick easiest task (lowest difficulty), random among ties
    const sorted = [...tasks].sort((a, b) => a.difficulty - b.difficulty)
    const easiest = sorted.filter(t => t.difficulty === sorted[0].difficulty)
    const picked = easiest[Math.floor(Math.random() * easiest.length)]
    setSelectedTask(picked)
    setCurrentStep(0)
    setActive(true)
    playJustStart()
  }, [tasks])

  const handleTimerComplete = useCallback(() => {
    if (!selectedTask) return
    setShowTimer(false)
    setActive(false)
    onComplete(selectedTask.id, true, 300)
  }, [selectedTask, onComplete])

  const handleSkipToTimer = useCallback(() => {
    setShowTimer(true)
  }, [])

  const handleDone = useCallback(() => {
    if (!selectedTask) return
    setActive(false)
    onComplete(selectedTask.id, false)
  }, [selectedTask, onComplete])

  if (tasks.length === 0) {
    return (
      <div className="bg-success/10 border border-success/30 rounded-2xl p-6 text-center">
        <span className="text-4xl">🎉</span>
        <div className="text-success font-bold mt-2">All done for today!</div>
      </div>
    )
  }

  return (
    <>
      {showTimer && selectedTask && (
        <Timer
          seconds={300}
          onComplete={handleTimerComplete}
          onCancel={() => setShowTimer(false)}
          taskTitle={selectedTask.title}
        />
      )}

      <AnimatePresence mode="wait">
        {!active ? (
          <motion.button
            key="button"
            onClick={pickTask}
            whileTap={{ scale: 0.95 }}
            className="w-full relative overflow-hidden rounded-2xl p-6 text-center
                       bg-gradient-to-br from-accent via-accent-glow to-streak
                       shadow-[0_0_30px_rgba(245,158,11,0.3)]
                       active:shadow-[0_0_50px_rgba(245,158,11,0.5)]
                       transition-shadow"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="text-bg font-black text-2xl tracking-wide">⚡ JUST START ⚡</div>
              <div className="text-bg/70 text-sm mt-1">
                {tasks.length} task{tasks.length !== 1 ? 's' : ''} waiting
              </div>
            </motion.div>
          </motion.button>
        ) : selectedTask ? (
          <motion.div
            key="task"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-bg-card border border-accent/30 rounded-2xl p-6"
          >
            <div className="text-accent text-sm font-bold mb-1">YOUR MISSION:</div>
            <div className="text-xl font-bold mb-4">{selectedTask.title}</div>

            {selectedTask.micro_steps && selectedTask.micro_steps.length > 0 ? (
              <div className="mb-4">
                <div className="text-text-dim text-sm mb-2">Just do this one thing:</div>
                <motion.div
                  key={currentStep}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="bg-accent/10 border border-accent/30 rounded-xl p-4 text-accent font-semibold"
                >
                  Step {currentStep + 1}: {selectedTask.micro_steps[currentStep]}
                </motion.div>
                {currentStep < selectedTask.micro_steps.length - 1 && (
                  <button
                    onClick={() => setCurrentStep(s => s + 1)}
                    className="mt-2 text-sm text-text-dim hover:text-text transition-colors"
                  >
                    Next step →
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 mb-4 text-accent font-semibold">
                Just walk to where you need to be. That's it.
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSkipToTimer}
                className="flex-1 bg-streak/20 text-streak font-bold py-3 rounded-xl
                           active:scale-95 transition-transform"
              >
                ⏱️ Start Timer
              </button>
              <button
                onClick={handleDone}
                className="flex-1 bg-success text-bg font-bold py-3 rounded-xl
                           active:scale-95 transition-transform"
              >
                ✅ Done!
              </button>
            </div>
            <button
              onClick={() => { setActive(false); setSelectedTask(null) }}
              className="mt-2 text-text-dim text-sm w-full"
            >
              Pick a different task
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
