import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useUser } from '../hooks/useUser'

interface DayStats {
  date: string
  taskXp: number
  sadhanaXp: number
  taskCount: number
}

export function ProgressDashboard() {
  const { currentUser } = useUser()
  const [weekStats, setWeekStats] = useState<DayStats[]>([])
  const [totals, setTotals] = useState({ weekXp: 0, weekTasks: 0, weekSadhana: 0 })

  useEffect(() => {
    if (!currentUser) return

    const fetchWeek = async () => {
      const days: DayStats[] = []

      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const dayStart = `${dateStr}T00:00:00`
        const dayEnd = `${dateStr}T23:59:59`

        // Task completions for this day
        const { data: completions } = await supabase
          .from('completions')
          .select('xp_earned')
          .eq('user_id', currentUser.id)
          .gte('completed_at', dayStart)
          .lte('completed_at', dayEnd)

        const taskXp = completions?.reduce((sum, c) => sum + c.xp_earned, 0) || 0
        const taskCount = completions?.length || 0

        // Sadhana for this day
        const { data: sadhana } = await supabase
          .from('sadhana_log')
          .select('xp_earned')
          .eq('user_id', currentUser.id)
          .eq('date', dateStr)
          .maybeSingle()

        const sadhanaXp = sadhana?.xp_earned || 0

        days.push({ date: dateStr, taskXp, sadhanaXp, taskCount })
      }

      setWeekStats(days)
      setTotals({
        weekXp: days.reduce((s, d) => s + d.taskXp + d.sadhanaXp, 0),
        weekTasks: days.reduce((s, d) => s + d.taskCount, 0),
        weekSadhana: days.filter(d => d.sadhanaXp > 0).length,
      })
    }

    fetchWeek()
  }, [currentUser])

  if (!currentUser || weekStats.length === 0) return null

  const maxXp = Math.max(1, ...weekStats.map(d => d.taskXp + d.sadhanaXp))
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">📊 This Week</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-bg-card rounded-xl p-3 border border-bg-elevated text-center">
          <div className="text-xl font-bold text-xp">{totals.weekXp}</div>
          <div className="text-text-dim text-xs">XP earned</div>
        </div>
        <div className="bg-bg-card rounded-xl p-3 border border-bg-elevated text-center">
          <div className="text-xl font-bold text-success">{totals.weekTasks}</div>
          <div className="text-text-dim text-xs">Tasks done</div>
        </div>
        <div className="bg-bg-card rounded-xl p-3 border border-bg-elevated text-center">
          <div className="text-xl font-bold text-sadhana">{totals.weekSadhana}/7</div>
          <div className="text-text-dim text-xs">Sadhana days</div>
        </div>
      </div>

      {/* XP bar chart */}
      <div className="bg-bg-card rounded-xl p-4 border border-bg-elevated">
        <div className="flex items-end gap-1 h-28">
          {weekStats.map((day, i) => {
            const total = day.taskXp + day.sadhanaXp
            const height = total > 0 ? Math.max(8, (total / maxXp) * 100) : 4
            const taskPct = total > 0 ? (day.taskXp / total) * 100 : 0
            const isToday = day.date === new Date().toISOString().split('T')[0]
            const dayOfWeek = new Date(day.date + 'T12:00:00').getDay()

            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] text-text-dim font-mono">{total > 0 ? total : ''}</div>
                <div className="w-full relative" style={{ height: `${height}%` }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: '100%' }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    className={`w-full rounded-t-sm overflow-hidden ${isToday ? 'ring-1 ring-accent' : ''}`}
                  >
                    {/* Task XP portion */}
                    <div className="bg-xp/60" style={{ height: `${taskPct}%` }} />
                    {/* Sadhana XP portion */}
                    <div className="bg-sadhana/60" style={{ height: `${100 - taskPct}%` }} />
                  </motion.div>
                </div>
                <div className={`text-[10px] ${isToday ? 'text-accent font-bold' : 'text-text-dim'}`}>
                  {dayLabels[dayOfWeek]}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 justify-center mt-2 text-[10px] text-text-dim">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-xp/60 mr-1" />Tasks</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-sadhana/60 mr-1" />Sadhana</span>
        </div>
      </div>
    </div>
  )
}
