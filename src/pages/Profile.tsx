import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useUser } from '../hooks/useUser'
import { supabase } from '../lib/supabase'
import { getLevelName } from '../lib/xp'
import { LevelBar } from '../components/LevelBar'

export function Profile() {
  const { currentUser } = useUser()
  const [recentCompletions, setRecentCompletions] = useState<Array<{
    id: string; completed_at: string; xp_earned: number; task_title?: string
  }>>([])
  const [stats, setStats] = useState({ totalCompleted: 0, thisWeek: 0, totalXpEarned: 0 })

  const fetchStats = useCallback(async () => {
    if (!currentUser) return

    try {
      // Recent completions — simple query without join first
      const { data: completions } = await supabase
        .from('completions')
        .select('id, completed_at, xp_earned, task_id')
        .eq('user_id', currentUser.id)
        .order('completed_at', { ascending: false })
        .limit(10)

      if (completions && completions.length > 0) {
        // Fetch task titles separately
        const taskIds = [...new Set(completions.map(c => c.task_id))]
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, title')
          .in('id', taskIds)

        const taskMap = new Map(tasks?.map(t => [t.id, t.title]) || [])
        setRecentCompletions(completions.map(c => ({
          ...c,
          task_title: taskMap.get(c.task_id) || 'Task',
        })))
      }

      // Total count
      const { count: totalCount } = await supabase
        .from('completions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)

      // This week count
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const { count: weekCount } = await supabase
        .from('completions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .gte('completed_at', weekAgo)

      setStats({
        totalCompleted: totalCount || 0,
        thisWeek: weekCount || 0,
        totalXpEarned: currentUser.total_xp || 0,
      })
    } catch (err) {
      console.warn('Profile fetch error:', err)
    }
  }, [currentUser])

  useEffect(() => { fetchStats() }, [fetchStats])

  // Refresh stats when completions change
  useEffect(() => {
    if (!currentUser) return
    const channel = supabase
      .channel('profile-completions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'completions' }, () => {
        fetchStats()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [currentUser, fetchStats])

  if (!currentUser) return null

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* User info */}
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
        <div className="text-xp font-mono mt-1">{(currentUser.total_xp || 0).toLocaleString()} Total XP</div>
        <div className="text-accent font-mono text-sm">{(currentUser.spendable_xp || 0).toLocaleString()} Spendable</div>
      </div>

      <LevelBar />

      {/* Stats */}
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

      {/* Recent activity */}
      <div>
        <h2 className="text-lg font-bold mb-2">Recent Activity</h2>
        <div className="space-y-2">
          {recentCompletions.map(c => (
            <div key={c.id} className="bg-bg-card rounded-xl p-3 border border-bg-elevated flex items-center gap-3">
              <span className="text-success">✅</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{c.task_title}</div>
                <div className="text-text-dim text-xs">
                  {new Date(c.completed_at).toLocaleDateString()} •{' '}
                  {new Date(c.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span className="text-xp font-mono text-sm">+{c.xp_earned}</span>
            </div>
          ))}
          {recentCompletions.length === 0 && (
            <div className="text-center text-text-dim py-4">No completions yet — go crush some tasks!</div>
          )}
        </div>
      </div>
    </div>
  )
}
