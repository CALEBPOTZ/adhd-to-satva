import { useState, useCallback, useEffect, useMemo } from 'react'
import { useUser } from '../hooks/useUser'
import { useTasks } from '../hooks/useTasks'
import { useStreak } from '../hooks/useStreak'
import { useCombo } from '../hooks/useCombo'
import { useDate } from '../hooks/useDate'
import { supabase } from '../lib/supabase'
import { calculateXp, getLevelForXp, getTaskStreak, getTaskStreakMultiplier, getDecayMultiplier } from '../lib/xp'
import { playComplete, playLevelUp } from '../lib/sounds'
import { fireConfetti, fireBigConfetti } from './Confetti'
import { JustStartButton } from './JustStartButton'
import { TaskCard } from './TaskCard'
import { XpPopup } from './XpPopup'
import type { XpEvent } from '../types'

const DAILY_CHALLENGES = [
  'BONUS: Complete 3 tasks in 10 minutes for 2x XP!',
  'BONUS: Finish a task with the timer for 3x XP!',
  'BONUS: Complete 5 tasks today for a 500 XP jackpot!',
  'BONUS: Do your hardest task first for 2x XP!',
  'BONUS: Complete all morning tasks before noon for 2x XP!',
  'BONUS: Start a 4-task streak for bonus 300 XP!',
  'BONUS: Beat 3 timers in a row for 2x XP!',
  'BONUS: Zero tasks left by 6 PM for a 400 XP bonus!',
  'BONUS: Complete a sadhana task first for 2x XP on it!',
  'BONUS: Knock out 2 chores back-to-back for 2x XP!',
]

const LOGIN_BONUS_KEY = 'adhd_satva_login_bonus_date'

export function Dashboard() {
  const { currentUser, otherUser, refreshUser } = useUser()
  const { tasks, completions, isCompleted, getLastCompletion, getUncompletedTasks, refetch } = useTasks()
  const { updateStreak } = useStreak()
  const { date, isToday } = useDate()
  const { registerCompletion } = useCombo()
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([])
  const [loginBonusToast, setLoginBonusToast] = useState(false)
  const [otherUserTodayXp, setOtherUserTodayXp] = useState(0)

  // Daily login bonus
  useEffect(() => {
    if (!currentUser) return
    const today = new Date().toISOString().slice(0, 10)
    const lastBonus = localStorage.getItem(LOGIN_BONUS_KEY)
    if (lastBonus === today) return

    localStorage.setItem(LOGIN_BONUS_KEY, today)

    const awardLoginBonus = async () => {
      const newXp = currentUser.total_xp + 5
      const newSpendable = (currentUser.spendable_xp || 0) + 5
      const newLevel = getLevelForXp(newXp)
      await supabase.from('users').update({
        total_xp: newXp,
        spendable_xp: newSpendable,
        level: newLevel,
      }).eq('id', currentUser.id)
      await refreshUser()
      setLoginBonusToast(true)
      setTimeout(() => setLoginBonusToast(false), 3000)
    }

    awardLoginBonus()
  }, [currentUser, refreshUser])

  // Fetch other user's today XP
  useEffect(() => {
    if (!otherUser) return
    const fetchOtherXp = async () => {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from('completions')
        .select('xp_earned')
        .eq('user_id', otherUser.id)
        .gte('completed_at', todayStart.toISOString())
      const total = (data || []).reduce((sum, c) => sum + (c.xp_earned || 0), 0)
      setOtherUserTodayXp(total)
    }
    fetchOtherXp()
  }, [otherUser, completions])

  // Daily challenge (seeded by date)
  const dailyChallenge = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    let hash = 0
    for (let i = 0; i < today.length; i++) {
      hash = ((hash << 5) - hash) + today.charCodeAt(i)
      hash |= 0
    }
    return DAILY_CHALLENGES[Math.abs(hash) % DAILY_CHALLENGES.length]
  }, [])

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

  const handleComplete = useCallback(async (taskId: string, usedTimer: boolean, timerSeconds?: number, completedAt?: Date, secondsRemaining?: number) => {
    if (!currentUser) return
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const comboMult = registerCompletion()
    const taskStreak = getTaskStreak(task, completions)
    const taskStreakMult = getTaskStreakMultiplier(taskStreak, task.recurring)
    const decayMult = getDecayMultiplier(task, completions.some(c => c.task_id === task.id))

    let timerMult = 1
    if (usedTimer && secondsRemaining !== undefined) {
      const totalTime = timerSeconds || 300
      if (secondsRemaining > 0) {
        const speedBonus = (secondsRemaining / totalTime) * 0.5
        timerMult = 1.5 + speedBonus
      } else {
        timerMult = 1.2
      }
    }

    const xpEarned = calculateXp(
      task.xp_reward, task.difficulty, currentUser.current_streak,
      comboMult, timerMult, taskStreakMult, decayMult,
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
  }, [currentUser, tasks, completions, registerCompletion, updateStreak, refreshUser, refetch, spawnXp, isToday, date])

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

  // Calculate today's XP for current user
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const myTodayXp = completions
    .filter(c => c.user_id === currentUser.id && new Date(c.completed_at) >= todayStart)
    .reduce((sum, c) => sum + (c.xp_earned || 0), 0)

  return (
    <div className="space-y-3 pb-4">
      <XpPopup events={xpEvents} />

      {/* Login Bonus Toast */}
      {loginBonusToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-accent to-streak text-bg font-bold px-6 py-3 rounded-2xl shadow-lg text-center">
            <span className="text-lg">+5 XP</span>
            <div className="text-xs opacity-80">Daily login bonus!</div>
          </div>
        </div>
      )}

      {/* HERO: Just Start Button - 80% of viewport */}
      <div className="flex items-center justify-center" style={{ minHeight: '78vh' }}>
        <div className="w-full max-w-md px-4">
          <div className="relative">
            {/* Outer glow ring */}
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-accent/30 via-streak/20 to-accent/30 blur-xl animate-pulse" />
            <div className="absolute -inset-2 rounded-[1.5rem] bg-gradient-to-br from-accent/20 via-streak/10 to-accent/20 blur-md" />
            <div className="relative">
              <JustStartButton
                tasks={uncompleted}
                allTasks={tasks}
                completions={completions}
                onComplete={handleComplete}
              />
            </div>
          </div>

          {/* Progress fraction under the button */}
          <div className="text-center mt-6 opacity-70">
            <span className="text-text-dim text-sm">
              {completedCount}/{todayTasks.length} done today
            </span>
          </div>
        </div>
      </div>

      {/* Compact stats row: Level | Streak | Daily XP */}
      <div className="flex items-center justify-around bg-bg-card rounded-2xl px-4 py-3 border border-bg-elevated">
        <div className="text-center">
          <div className="text-xs text-text-dim">Level</div>
          <div className="text-xl font-black text-accent">{currentUser.level}</div>
        </div>
        <div className="w-px h-8 bg-bg-elevated" />
        <div className="text-center">
          <div className="text-xs text-text-dim">Streak</div>
          <div className="text-xl font-black">
            {currentUser.current_streak > 0 ? (
              <span className="text-streak">{currentUser.current_streak} 🔥</span>
            ) : (
              <span className="text-text-dim">0</span>
            )}
          </div>
        </div>
        <div className="w-px h-8 bg-bg-elevated" />
        <div className="text-center">
          <div className="text-xs text-text-dim">Today</div>
          <div className="text-xl font-black text-xp">+{myTodayXp} XP</div>
        </div>
      </div>

      {/* Versus Display: Caleb vs Shakti */}
      {otherUser && (
        <div className="bg-bg-card rounded-2xl border border-bg-elevated overflow-hidden">
          <div className="text-center text-xs text-text-dim font-bold uppercase tracking-wider py-2 bg-bg-elevated/50">
            Today's Battle
          </div>
          <div className="flex items-center p-4">
            {/* Current User */}
            <div className="flex-1 text-center">
              <div className="text-sm font-bold text-text">{currentUser.name}</div>
              <div className="text-2xl font-black text-xp mt-1">+{myTodayXp}</div>
              <div className="text-xs text-text-dim">XP today</div>
            </div>

            {/* VS divider */}
            <div className="px-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-streak flex items-center justify-center">
                <span className="text-bg font-black text-xs">VS</span>
              </div>
            </div>

            {/* Other User */}
            <div className="flex-1 text-center">
              <div className="text-sm font-bold text-text">{otherUser.name}</div>
              <div className="text-2xl font-black text-xp mt-1">+{otherUserTodayXp}</div>
              <div className="text-xs text-text-dim">XP today</div>
            </div>
          </div>

          {/* XP bar comparison */}
          <div className="px-4 pb-3">
            <div className="h-2 bg-bg-elevated rounded-full overflow-hidden flex">
              {(myTodayXp + otherUserTodayXp) > 0 ? (
                <>
                  <div
                    className="h-full bg-gradient-to-r from-accent to-streak rounded-l-full transition-all duration-500"
                    style={{ width: `${(myTodayXp / (myTodayXp + otherUserTodayXp)) * 100}%` }}
                  />
                  <div
                    className="h-full bg-gradient-to-r from-life to-sadhana rounded-r-full transition-all duration-500"
                    style={{ width: `${(otherUserTodayXp / (myTodayXp + otherUserTodayXp)) * 100}%` }}
                  />
                </>
              ) : (
                <div className="h-full w-full bg-bg-elevated" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Daily Challenge */}
      <div className="bg-gradient-to-r from-accent/10 to-streak/10 border border-accent/20 rounded-2xl p-3 text-center">
        <div className="text-accent font-bold text-sm">{dailyChallenge}</div>
      </div>

      {/* Today's Task List (compact) */}
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
            decayMultiplier={getDecayMultiplier(task, completions.some(c => c.task_id === task.id))}
          />
        ))}
      </div>
    </div>
  )
}
