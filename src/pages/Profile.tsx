import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useUser } from '../hooks/useUser'
import { supabase } from '../lib/supabase'
import { getLevelName } from '../lib/xp'
import { LevelBar } from '../components/LevelBar'

interface ActivityItem {
  id: string
  type: 'task' | 'sadhana'
  title: string
  xp: number
  time: string
}

export function Profile() {
  const { currentUser } = useUser()
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [stats, setStats] = useState({ totalCompleted: 0, thisWeek: 0 })

  const fetchStats = useCallback(async () => {
    if (!currentUser) return

    try {
      // Task completions
      const { data: completions } = await supabase
        .from('completions')
        .select('id, completed_at, xp_earned, task_id')
        .eq('user_id', currentUser.id)
        .order('completed_at', { ascending: false })
        .limit(10)

      const items: ActivityItem[] = []

      if (completions && completions.length > 0) {
        const taskIds = [...new Set(completions.map(c => c.task_id))]
        const { data: tasks } = await supabase.from('tasks').select('id, title').in('id', taskIds)
        const taskMap = new Map(tasks?.map(t => [t.id, t.title]) || [])

        for (const c of completions) {
          items.push({
            id: c.id,
            type: 'task',
            title: taskMap.get(c.task_id) || 'Task',
            xp: c.xp_earned,
            time: c.completed_at,
          })
        }
      }

      // Sadhana logs
      const { data: sadhanaLogs } = await supabase
        .from('sadhana_log')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('date', { ascending: false })
        .limit(7)

      if (sadhanaLogs) {
        for (const s of sadhanaLogs) {
          if (s.xp_earned > 0) {
            const parts: string[] = []
            if (s.japa_rounds > 0) parts.push(`${s.japa_rounds} japa`)
            if (s.reading_minutes > 0) parts.push(`${s.reading_minutes}m reading`)
            if (s.class_minutes > 0) parts.push(`${s.class_minutes}m class`)
            if (s.arti_puja) parts.push('puja')
            if (s.flower_offering) parts.push('flowers')
            if (s.offering_plate) parts.push('offering')

            items.push({
              id: `sadhana-${s.id}`,
              type: 'sadhana',
              title: `Sadhana: ${parts.join(', ')}`,
              xp: s.xp_earned,
              time: s.japa_completed_at || `${s.date}T12:00:00`,
            })
          }
        }
      }

      // Sort by time
      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setActivity(items.slice(0, 15))

      // Counts
      const { count: totalCount } = await supabase
        .from('completions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)

      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const { count: weekCount } = await supabase
        .from('completions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .gte('completed_at', weekAgo)

      setStats({ totalCompleted: totalCount || 0, thisWeek: weekCount || 0 })
    } catch (err) {
      console.warn('Profile fetch error:', err)
    }
  }, [currentUser])

  useEffect(() => { fetchStats() }, [fetchStats])

  useEffect(() => {
    if (!currentUser) return
    const channel = supabase
      .channel('profile-activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sadhana_log' }, () => fetchStats())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [currentUser, fetchStats])

  if (!currentUser) return null

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Profile</h1>

      <div className="bg-bg-card rounded-2xl p-6 border border-bg-elevated text-center">
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center text-accent
                     text-3xl font-bold mx-auto mb-3"
        >
          {currentUser.name[0]}
        </motion.div>
        <div className="text-xl font-bold">{currentUser.name}</div>
        <div className="text-sadhana text-sm">{getLevelName(currentUser.level)}</div>
        <div className="text-xp font-mono text-2xl mt-2">{(currentUser.total_xp || 0).toLocaleString()} XP</div>
        <div className="text-accent font-mono text-sm mt-1">
          {(currentUser.spendable_xp || 0).toLocaleString()} spendable
        </div>
        <div className="text-text-dim text-xs mt-1">
          Level {currentUser.level} • {currentUser.current_streak || 0} day streak
        </div>
      </div>

      <LevelBar />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Completed', value: stats.totalCompleted, color: 'text-success' },
          { label: 'This Week', value: stats.thisWeek, color: 'text-xp' },
          { label: 'Best Streak', value: currentUser.longest_streak || 0, color: 'text-streak' },
        ].map(stat => (
          <div key={stat.label} className="bg-bg-card rounded-xl p-3 border border-bg-elevated text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-text-dim text-xs">{stat.label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-2">Recent Activity</h2>
        <div className="space-y-2">
          {activity.map(item => (
            <div key={item.id} className="bg-bg-card rounded-xl p-3 border border-bg-elevated flex items-center gap-3">
              <span className="text-lg">{item.type === 'sadhana' ? '🙏' : '✅'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{item.title}</div>
                <div className="text-text-dim text-xs">
                  {new Date(item.time).toLocaleDateString()} •{' '}
                  {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span className="text-xp font-mono text-sm">+{item.xp}</span>
            </div>
          ))}
          {activity.length === 0 && (
            <div className="text-center text-text-dim py-4">No activity yet — go crush some tasks!</div>
          )}
        </div>
      </div>
    </div>
  )
}
