import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { Task } from '../types'
import { Timer } from './Timer'
import { daysUntilNextPeriod, getPeriodLabel } from '../lib/periods'

interface TaskCardProps {
  task: Task
  completed: boolean
  onComplete: (taskId: string, usedTimer: boolean, timerSeconds?: number) => void
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

export function TaskCard({ task, completed, onComplete, taskStreak = 0, decayMultiplier = 1 }: TaskCardProps) {
  const [showTimer, setShowTimer] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const timerSeconds = (task.icnu_config as Record<string, number>)?.timer_seconds || 300

  const handleComplete = useCallback(() => {
    onComplete(task.id, false)
  }, [task.id, onComplete])

  const handleTimerComplete = useCallback(() => {
    setShowTimer(false)
    onComplete(task.id, true, timerSeconds)
  }, [task.id, timerSeconds, onComplete])

  // Completed state — locked until next period
  if (completed) {
    const daysLeft = daysUntilNextPeriod(task.recurring)
    const periodLabel = getPeriodLabel(task.recurring)
    const isNonDaily = task.recurring && task.recurring !== 'daily' && task.recurring !== 'anytime'

    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0.5 }}
        className="bg-bg-card/50 rounded-xl p-3 border border-success/20 flex items-center gap-3"
      >
        <span className="text-success text-xl">✅</span>
        <div className="flex-1 min-w-0">
          <span className="text-text-dim line-through text-sm">{task.title}</span>
          {isNonDaily && daysLeft > 0 && (
            <div className="text-xs text-text-dim/60 mt-0.5">
              🔒 Done {periodLabel} — unlocks in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <span className="ml-auto text-success/60 text-xs font-mono">+{task.xp_reward} XP</span>
      </motion.div>
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
      <motion.div
        layout
        whileTap={{ scale: 0.98 }}
        className={`rounded-xl border p-4 ${CATEGORY_COLORS[task.category] || 'border-bg-elevated bg-bg-card'}`}
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
              {/* Per-task streak badge */}
              {taskStreak >= 2 && (
                <span className="text-xs bg-streak/20 text-streak px-2 py-0.5 rounded-full font-bold">
                  🔥 {taskStreak}x streak
                </span>
              )}
              {/* Decay indicator */}
              {decayMultiplier < 1 && decayMultiplier >= 0.8 && (
                <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-bold">
                  ⏰ {Math.round(decayMultiplier * 100)}% — do it now!
                </span>
              )}
              {decayMultiplier < 0.8 && decayMultiplier >= 0.6 && (
                <span className="text-xs bg-streak/20 text-streak px-2 py-0.5 rounded-full font-bold">
                  📉 {Math.round(decayMultiplier * 100)}% — losing XP!
                </span>
              )}
              {decayMultiplier < 0.6 && (
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold animate-pulse">
                  🚨 {Math.round(decayMultiplier * 100)}% — hurry!
                </span>
              )}
              {task.difficulty > 1 && (
                <span className="text-xs text-accent">{'⭐'.repeat(task.difficulty)}</span>
              )}
            </div>
          </div>
          {task.icnu_type === 'urgency' && (
            <button
              onClick={() => setShowTimer(true)}
              className="bg-streak/20 text-streak px-3 py-1.5 rounded-lg text-sm font-bold
                         active:scale-95 transition-transform flex items-center gap-1"
            >
              ⏱️ Go!
            </button>
          )}
        </div>

        {/* Expanded: micro steps */}
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
    </>
  )
}
