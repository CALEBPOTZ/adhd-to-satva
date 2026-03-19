import { useState, useCallback, useRef } from 'react'
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion'
import type { Task } from '../types'
import { Timer } from './Timer'
import { TimePicker } from './TimePicker'
import { daysUntilNextPeriod } from '../lib/periods'

interface TaskCardProps {
  task: Task
  completed: boolean
  completedAt?: Date | null
  onComplete: (taskId: string, usedTimer: boolean, timerSeconds?: number, completedAt?: Date, secondsRemaining?: number) => void
  onEditTime?: (taskId: string, newTime: Date) => void
  onUndo?: (taskId: string) => void
  taskStreak?: number
  decayMultiplier?: number
}

const CATEGORY_COLORS: Record<string, string> = {
  chore: 'border-chore/30 bg-chore/5',
  life_goal: 'border-life/30 bg-life/5',
  sadhana: 'border-sadhana/30 bg-sadhana/5',
  habit: 'border-habit/30 bg-habit/5',
}

const CATEGORY_LABELS: Record<string, string> = {
  chore: '🧹',
  life_goal: '🎯',
  sadhana: '🙏',
  habit: '✨',
}

const RECURRING_LABELS: Record<string, string> = {
  daily: 'Daily',
  bidaily: 'Every 2 days',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  bimonthly: 'Every 2 months',
  anytime: 'As needed',
}

export function TaskCard({ task, completed, completedAt, onComplete, onEditTime, onUndo, taskStreak = 0, decayMultiplier = 1 }: TaskCardProps) {
  const [showTimer, setShowTimer] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showEditTime, setShowEditTime] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showUndoToast, setShowUndoToast] = useState(false)
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dragX = useMotionValue(0)
  const dragBgOpacity = useTransform(dragX, [0, 100], [0, 1])
  const dragCheckScale = useTransform(dragX, [0, 100], [0.3, 1])

  const timerSeconds = (task.icnu_config as Record<string, number>)?.timer_seconds || 300

  const handleComplete = useCallback(() => {
    onComplete(task.id, false)
  }, [task.id, onComplete])

  const handleCompleteAtTime = useCallback((time: Date) => {
    setShowTimePicker(false)
    onComplete(task.id, false, undefined, time)
  }, [task.id, onComplete])

  const handleTimerComplete = useCallback((secondsRemaining: number) => {
    setShowTimer(false)
    onComplete(task.id, true, timerSeconds, undefined, secondsRemaining)
  }, [task.id, timerSeconds, onComplete])

  const handleEditTime = useCallback((time: Date) => {
    setShowEditTime(false)
    onEditTime?.(task.id, time)
  }, [task.id, onEditTime])

  const handleSwipeComplete = useCallback(() => {
    onComplete(task.id, false)

    // Show undo toast
    setShowUndoToast(true)
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
    undoTimeoutRef.current = setTimeout(() => {
      setShowUndoToast(false)
    }, 5000)
  }, [task.id, onComplete])

  const handleUndoFromToast = useCallback(() => {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
    setShowUndoToast(false)
    onUndo?.(task.id)
  }, [task.id, onUndo])

  // Positive urgency framing for decay
  const getDecayLabel = () => {
    if (decayMultiplier >= 0.8) return null
    if (decayMultiplier >= 0.6) {
      const bonus = Math.round((1 - decayMultiplier) * 100)
      return (
        <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-bold">
          ⚡ +{bonus}% bonus now!
        </span>
      )
    }
    return (
      <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-bold animate-pulse">
        🎯 Act fast for max bonus!
      </span>
    )
  }

  // Completed state
  if (completed) {
    const daysLeft = daysUntilNextPeriod(task.recurring)
    const isNonDaily = task.recurring && task.recurring !== 'daily' && task.recurring !== 'anytime'
    const timeStr = completedAt
      ? new Date(completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null

    return (
      <>
        {showEditTime && (
          <TimePicker
            title={task.title}
            initialTime={completedAt || undefined}
            onConfirm={handleEditTime}
            onCancel={() => setShowEditTime(false)}
          />
        )}
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0.5 }}
          className="bg-bg-card/50 rounded-xl p-3 border border-success/20 flex items-center gap-3"
        >
          <span className="text-success text-xl">✅</span>
          <div className="flex-1 min-w-0">
            <span className="text-text-dim line-through text-sm">{task.title}</span>
            <div className="flex items-center gap-2 mt-0.5">
              {timeStr && (
                <span className="text-xs text-text-dim/60">at {timeStr}</span>
              )}
              {isNonDaily && daysLeft > 0 && (
                <span className="text-xs text-text-dim/60">
                  🔒 unlocks in {daysLeft}d
                </span>
              )}
            </div>
          </div>
          {onUndo && (
            <button
              onClick={() => onUndo(task.id)}
              className="text-text-dim/40 text-xs px-2 py-1 rounded-lg
                         active:bg-bg-elevated active:text-text-dim transition-colors"
            >
              ↩
            </button>
          )}
          {onEditTime && (
            <button
              onClick={() => setShowEditTime(true)}
              className="text-text-dim/40 text-xs px-2 py-1 rounded-lg
                         active:bg-bg-elevated active:text-text-dim transition-colors"
            >
              ✏️
            </button>
          )}
          <span className="text-success/60 text-xs font-mono">+{task.xp_reward}</span>
        </motion.div>

        {/* Undo toast after swipe-complete */}
        <AnimatePresence>
          {showUndoToast && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50"
            >
              <button
                onClick={handleUndoFromToast}
                className="bg-bg-card border border-accent/30 shadow-lg rounded-2xl px-6 py-3 flex items-center gap-3"
              >
                <span className="text-text-dim text-sm">Task completed!</span>
                <span className="text-accent font-bold text-sm">Undo</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <>
      {showTimer && (
        <Timer
          seconds={timerSeconds}
          onComplete={handleTimerComplete}
          onCancel={() => setShowTimer(false)}
          taskTitle={task.title}
        />
      )}
      {showTimePicker && (
        <TimePicker
          title={task.title}
          onConfirm={handleCompleteAtTime}
          onCancel={() => setShowTimePicker(false)}
        />
      )}

      {/* Swipe-to-complete wrapper */}
      <div className="relative overflow-hidden rounded-xl">
        {/* Background revealed on swipe */}
        <motion.div
          className="absolute inset-0 bg-success/20 rounded-xl flex items-center pl-6"
          style={{ opacity: dragBgOpacity }}
        >
          <motion.span
            className="text-success text-2xl"
            style={{ scale: dragCheckScale }}
          >
            ✅
          </motion.span>
        </motion.div>

        <motion.div
          layout
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 150 }}
          dragElastic={0.1}
          dragSnapToOrigin
          style={{ x: dragX }}
          onDragEnd={(_, info) => {
            if (info.offset.x > 100) {
              handleSwipeComplete()
            }
          }}
          whileTap={{ scale: 0.98 }}
          className={`relative rounded-xl border p-4 ${CATEGORY_COLORS[task.category] || 'border-bg-elevated bg-bg-card'}`}
        >
          <div className="flex items-start gap-3">
            <button
              onClick={handleComplete}
              className="mt-0.5 w-6 h-6 rounded-full border-2 border-text-dim/40 flex-shrink-0
                         hover:border-success hover:bg-success/20 transition-colors
                         active:scale-90 active:bg-success/40"
            />
            <div className="flex-1 min-w-0" onClick={() => setExpanded(!expanded)}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{CATEGORY_LABELS[task.category]}</span>
                <span className="font-medium">{task.title}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {task.recurring && (
                  <span className="text-xs text-text-dim bg-bg-elevated px-2 py-0.5 rounded-full">
                    {RECURRING_LABELS[task.recurring] || task.recurring}
                  </span>
                )}
                <span className="text-xs text-xp font-mono">+{task.xp_reward} XP</span>
                {taskStreak >= 2 && (
                  <span className="text-xs bg-streak/20 text-streak px-2 py-0.5 rounded-full font-bold">
                    🔥 {taskStreak}x streak
                  </span>
                )}
                {getDecayLabel()}
                {task.difficulty > 1 && (
                  <span className="text-xs text-accent">{'⭐'.repeat(task.difficulty)}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {task.icnu_type === 'urgency' && (
                <button
                  onClick={() => setShowTimer(true)}
                  className="bg-streak/20 text-streak px-3 py-1.5 rounded-lg text-sm font-bold
                             active:scale-95 transition-transform"
                >
                  ⏱️
                </button>
              )}
              <button
                onClick={() => setShowTimePicker(true)}
                className="bg-bg-elevated text-text-dim px-3 py-1.5 rounded-lg text-sm
                           active:scale-95 transition-transform"
                title="Complete at a different time"
              >
                🕐
              </button>
            </div>
          </div>

          {expanded && task.micro_steps && task.micro_steps.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-3 pl-9 space-y-1"
            >
              {task.micro_steps.map((step, i) => (
                <div key={i} className="text-sm text-text-dim">
                  <span className="text-accent mr-2">→</span> {step}
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Undo toast (shown even in uncompleted state briefly after swipe) */}
      <AnimatePresence>
        {showUndoToast && !completed && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50"
          >
            <button
              onClick={handleUndoFromToast}
              className="bg-bg-card border border-accent/30 shadow-lg rounded-2xl px-6 py-3 flex items-center gap-3"
            >
              <span className="text-text-dim text-sm">Task completed!</span>
              <span className="text-accent font-bold text-sm">Undo</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
