import { useState, useCallback } from 'react'
import { useUser } from '../hooks/useUser'
import { useTasks } from '../hooks/useTasks'
import { useStreak } from '../hooks/useStreak'
import { useCombo } from '../hooks/useCombo'
import { supabase } from '../lib/supabase'
import { calculateXp, getLevelForXp, getTaskStreak, getTaskStreakMultiplier, getDecayMultiplier } from '../lib/xp'
import { playComplete, playLevelUp } from '../lib/sounds'
import { fireConfetti, fireBigConfetti } from './Confetti'
import { LevelBar } from './LevelBar'
import { StreakFire } from './StreakFire'
import { JustStartButton } from './JustStartButton'
import { TaskCard } from './TaskCard'
import { XpPopup } from './XpPopup'
import type { XpEvent } from '../types'

export function Dashboard() {
  const { currentUser, refreshUser } = useUser()
  const { tasks, completions, isCompleted, getLastCompletion, getUncompletedTasks, refetch } = useTasks()
  const { updateStreak } = useStreak()
  const { registerCompletion } = useCombo()
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([])

  const spawnXp = useCallback((amount: number) => {
    const event: XpEvent = {
      amount,
      x: Math.random() * (window.innerWidth - 100) + 50,
      y: Math.random() * 200 + 300,
      id: crypto.randomUUID(),
    }
    setXpEvents(prev => [...prev, event])
    setTimeout(() => setXpEvents(prev => prev.filter(e => e.id !== event.id)), 1500)
  }, [])

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
    const newLevel = getLevelForXp(newXp)
    const leveledUp = newLevel > currentUser.level

    await supabase.from('users').update({
      total_xp: newXp, spendable_xp: newSpendable, level: newLevel,
    }).eq('id', currentUser.id)

    playComplete()
    fireConfetti()
    spawnXp(xpEarned)
    if (leveledUp) setTimeout(() => { playLevelUp(); fireBigConfetti() }, 500)

    await updateStreak()
    await refreshUser()
    await refetch()
  }, [currentUser, tasks, completions, registerCompletion, updateStreak, refreshUser, refetch, spawnXp])

  const handleEditTime = useCallback(async (taskId: string, newTime: Date) => {
    if (!currentUser) return
    // Find the most recent completion for this task today
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

  if (!currentUser) return null

  const uncompleted = getUncompletedTasks()
  const todayTasks = tasks.filter(t => t.recurring === 'daily' || t.recurring === 'anytime' || t.recurring === 'bidaily')
  const completedCount = todayTasks.filter(t => isCompleted(t.id)).length

  return (
    <div className="space-y-4">
      <XpPopup events={xpEvents} />

      <div className="bg-bg-card rounded-2xl p-4 border border-bg-elevated text-center">
        <div className="text-text-dim text-sm mb-1">Today's Progress</div>
        <div className="text-3xl font-bold">
          <span className="text-success">{completedCount}</span>
          <span className="text-text-dim"> / {todayTasks.length}</span>
        </div>
        <div className="h-2 bg-bg-elevated rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-gradient-to-r from-success to-xp rounded-full transition-all duration-500"
            style={{ width: `${todayTasks.length > 0 ? (completedCount / todayTasks.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <LevelBar />
      <StreakFire />
      <JustStartButton tasks={uncompleted} allTasks={tasks} completions={completions} onComplete={handleComplete} />

      <div className="space-y-2">
        <h2 className="text-lg font-bold">📋 Today's Quests</h2>
        {todayTasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            completed={isCompleted(task.id)}
            completedAt={getLastCompletion(task.id)}
            onComplete={handleComplete}
            onEditTime={handleEditTime}
            onUndo={handleUndo}
            taskStreak={getTaskStreak(task, completions)}
            decayMultiplier={getDecayMultiplier(task)}
          />
        ))}
      </div>
    </div>
  )
}
