import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTasks } from '../hooks/useTasks'
import { useUser } from '../hooks/useUser'
import { useStreak } from '../hooks/useStreak'
import { useCombo } from '../hooks/useCombo'
import { useDate } from '../hooks/useDate'
import { supabase } from '../lib/supabase'
import { calculateXp, getLevelForXp, getTaskStreak, getTaskStreakMultiplier, getDecayMultiplier } from '../lib/xp'
import { groupTasksByFrequency, isBlockedByDependency, getChainInfo } from '../lib/priority'
import { playComplete } from '../lib/sounds'
import { fireConfetti } from '../components/Confetti'
import { TaskCard } from '../components/TaskCard'
import { XpPopup } from '../components/XpPopup'
import type { XpEvent } from '../types'

const CATEGORIES = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'chore', label: 'Chores', icon: '🧹' },
  { key: 'habit', label: 'Habits', icon: '✨' },
  { key: 'life_goal', label: 'Goals', icon: '🎯' },
]

const FREQ_EMOJI: Record<string, string> = {
  daily: '📅', bidaily: '📆', weekly: '🗓️', biweekly: '📋',
  monthly: '📌', bimonthly: '🔖', anytime: '✅',
}

export function Tasks() {
  const { currentUser, refreshUser } = useUser()
  const { tasks, completions, isCompleted, getLastCompletion, refetch } = useTasks()
  const { updateStreak } = useStreak()
  const { registerCompletion } = useCombo()
  const { date, isToday } = useDate()
  const [filter, setFilter] = useState('all')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([])

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.category === filter)
  const groups = groupTasksByFrequency(filtered)

  const toggleGroup = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleComplete = useCallback(async (taskId: string, usedTimer: boolean, timerSeconds?: number, completedAt?: Date) => {
    if (!currentUser) return
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const comboMult = registerCompletion()
    const taskStreak = getTaskStreak(task, completions)
    const taskStreakMult = getTaskStreakMultiplier(taskStreak, task.recurring)
    const decayMult = getDecayMultiplier(task, completions.some(c => c.task_id === task.id))

    const xpEarned = calculateXp(
      task.xp_reward, task.difficulty, currentUser.current_streak,
      comboMult, usedTimer ? 1.5 : 1, taskStreakMult, decayMult,
    )

    await supabase.from('completions').insert({
      task_id: taskId,
      user_id: currentUser.id,
      completed_at: completedAt ? completedAt.toISOString() : (isToday ? new Date().toISOString() : `${date}T12:00:00`),
      xp_earned: xpEarned,
      used_timer: usedTimer,
      timer_seconds: timerSeconds || null,
      combo_multiplier: comboMult,
    })

    const newXp = currentUser.total_xp + xpEarned
    const newSpendable = (currentUser.spendable_xp || 0) + xpEarned
    await supabase.from('users').update({
      total_xp: newXp, spendable_xp: newSpendable, level: getLevelForXp(newXp),
    }).eq('id', currentUser.id)

    playComplete()
    fireConfetti()

    setXpEvents(prev => [...prev, {
      amount: xpEarned,
      x: Math.random() * (window.innerWidth - 100) + 50,
      y: 300, id: crypto.randomUUID(),
    }])
    setTimeout(() => setXpEvents(prev => prev.slice(1)), 1500)

    await updateStreak()
    await refreshUser()
    await refetch()
  }, [currentUser, tasks, completions, registerCompletion, updateStreak, refreshUser, refetch])

  const handleEditTime = useCallback(async (taskId: string, newTime: Date) => {
    if (!currentUser) return
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const completion = completions
      .filter(c => c.task_id === taskId && new Date(c.completed_at) >= todayStart)
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0]
    if (!completion) return
    await supabase.from('completions').update({ completed_at: newTime.toISOString() }).eq('id', completion.id)
    await refetch()
  }, [currentUser, completions, refetch])

  const handleUndo = useCallback(async (taskId: string) => {
    if (!currentUser) return
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const completion = completions
      .filter(c => c.task_id === taskId && new Date(c.completed_at) >= todayStart)
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0]
    if (!completion) return

    await supabase.from('completions').delete().eq('id', completion.id)
    await supabase.from('users').update({
      total_xp: Math.max(0, (currentUser.total_xp || 0) - completion.xp_earned),
      spendable_xp: Math.max(0, (currentUser.spendable_xp || 0) - completion.xp_earned),
    }).eq('id', currentUser.id)

    await refreshUser()
    await refetch()
  }, [currentUser, completions, refreshUser, refetch])

  return (
    <div className="space-y-4">
      <XpPopup events={xpEvents} />
      <h1 className="text-2xl font-bold">All Tasks</h1>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setFilter(cat.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
              ${filter === cat.key
                ? 'bg-accent text-bg'
                : 'bg-bg-card text-text-dim border border-bg-elevated'}`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Grouped by frequency */}
      {groups.map(group => {
        const isCollapsed = collapsed[group.key] || false
        const doneCount = group.tasks.filter(t => isCompleted(t.id)).length
        const allDone = doneCount === group.tasks.length

        return (
          <div key={group.key}>
            <button
              onClick={() => toggleGroup(group.key)}
              className="w-full flex items-center gap-2 py-2 text-left"
            >
              <span className="text-sm">{FREQ_EMOJI[group.key] || '📋'}</span>
              <span className="font-bold text-sm">{group.label}</span>
              <span className={`text-xs font-mono ml-1 ${allDone ? 'text-success' : 'text-text-dim'}`}>
                {doneCount}/{group.tasks.length}
              </span>
              {allDone && <span className="text-xs">✅</span>}
              <span className="ml-auto text-text-dim text-xs">{isCollapsed ? '▸' : '▾'}</span>
            </button>

            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2 overflow-hidden"
                >
                  {group.tasks.map(task => {
                    const blocked = isBlockedByDependency(task, tasks, completions)
                    const chain = getChainInfo(task)

                    return (
                      <div key={task.id} className={blocked ? 'opacity-40 pointer-events-none' : ''}>
                        {chain && (
                          <div className="text-xs text-text-dim ml-2 mb-0.5">
                            🔗 {chain.chainName} — step {chain.step}/{chain.total}
                            {blocked && ' (waiting for previous step)'}
                          </div>
                        )}
                        <TaskCard
                          task={task}
                          completed={isCompleted(task.id)}
                          completedAt={getLastCompletion(task.id)}
                          onComplete={handleComplete}
                          onEditTime={handleEditTime}
                        onUndo={handleUndo}
                          taskStreak={getTaskStreak(task, completions)}
                          decayMultiplier={getDecayMultiplier(task, completions.some(c => c.task_id === task.id))}
                        />
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div className="text-center text-text-dim py-8">No tasks in this category</div>
      )}
    </div>
  )
}
