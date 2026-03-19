import { useState, useCallback } from 'react'
import { useTasks } from '../hooks/useTasks'
import { useUser } from '../hooks/useUser'
import { useStreak } from '../hooks/useStreak'
import { useCombo } from '../hooks/useCombo'
import { supabase } from '../lib/supabase'
import { calculateXp, getLevelForXp, getTaskStreak, getTaskStreakMultiplier, getDecayMultiplier } from '../lib/xp'
import { playComplete } from '../lib/sounds'
import { fireConfetti } from '../components/Confetti'
import { TaskCard } from '../components/TaskCard'
import { XpPopup } from '../components/XpPopup'
import type { XpEvent } from '../types'

const CATEGORIES = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'chore', label: 'Chores', icon: '🧹' },
  { key: 'sadhana', label: 'Sadhana', icon: '🙏' },
  { key: 'habit', label: 'Habits', icon: '✨' },
  { key: 'life_goal', label: 'Goals', icon: '🎯' },
]

export function Tasks() {
  const { currentUser, refreshUser } = useUser()
  const { tasks, completions, isCompleted, getLastCompletion, refetch } = useTasks()
  const { updateStreak } = useStreak()
  const { registerCompletion } = useCombo()
  const [filter, setFilter] = useState('all')
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([])

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.category === filter)

  const handleComplete = useCallback(async (taskId: string, usedTimer: boolean, timerSeconds?: number, completedAt?: Date) => {
    if (!currentUser) return
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const comboMult = registerCompletion()
    const taskStreak = getTaskStreak(task, completions)
    const taskStreakMult = getTaskStreakMultiplier(taskStreak, task.recurring)
    const decayMult = getDecayMultiplier(task)

    const xpEarned = calculateXp(
      task.xp_reward, task.difficulty, currentUser.current_streak,
      comboMult, usedTimer ? 1.5 : 1, taskStreakMult, decayMult,
    )

    await supabase.from('completions').insert({
      task_id: taskId,
      user_id: currentUser.id,
      completed_at: completedAt ? completedAt.toISOString() : new Date().toISOString(),
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

    const event: XpEvent = {
      amount: xpEarned,
      x: Math.random() * (window.innerWidth - 100) + 50,
      y: 300, id: crypto.randomUUID(),
    }
    setXpEvents(prev => [...prev, event])
    setTimeout(() => setXpEvents(prev => prev.filter(e => e.id !== event.id)), 1500)

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

    await supabase.from('completions')
      .update({ completed_at: newTime.toISOString() })
      .eq('id', completion.id)
    await refetch()
  }, [currentUser, completions, refetch])

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

      <div className="space-y-2">
        {filtered.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            completed={isCompleted(task.id)}
            completedAt={getLastCompletion(task.id)}
            onComplete={handleComplete}
            onEditTime={handleEditTime}
            taskStreak={getTaskStreak(task, completions)}
            decayMultiplier={getDecayMultiplier(task)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-text-dim py-8">No tasks in this category</div>
        )}
      </div>
    </div>
  )
}
