import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useUser } from '../hooks/useUser'
import { supabase } from '../lib/supabase'
import { getLevelName } from '../lib/xp'
import { LevelBar } from '../components/LevelBar'
import type { Completion } from '../types'

export function Profile() {
  const { currentUser } = useUser()
  const [recentCompletions, setRecentCompletions] = useState<(Completion & { tasks: { title: string } })[]>([])
  const [stats, setStats] = useState({ totalCompleted: 0, thisWeek: 0 })

  useEffect(() => {
    if (!currentUser) return
    // Fetch recent completions
    supabase
      .from('completions')
      .select('*, tasks(title)')
      .eq('user_id', currentUser.id)
      .order('completed_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setRecentCompletions(data as never)
      })

    // Fetch stats
    supabase
      .from('completions')
      .select('id', { count: 'exact' })
      .eq('user_id', currentUser.id)
      .then(({ count }) => {
        setStats(s => ({ ...s, totalCompleted: count || 0 }))
      })

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    supabase
      .from('completions')
      .select('id', { count: 'exact' })
      .eq('user_id', currentUser.id)
      .gte('completed_at', weekAgo)
      .then(({ count }) => {
        setStats(s => ({ ...s, thisWeek: count || 0 }))
      })
  }, [currentUser])

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
        <div className="text-xp font-mono mt-1">{currentUser.total_xp.toLocaleString()} Total XP</div>
      </div>

      <LevelBar />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Completed', value: stats.totalCompleted, color: 'text-success' },
          { label: 'This Week', value: stats.thisWeek, color: 'text-xp' },
          { label: 'Best Streak', value: currentUser.longest_streak, color: 'text-streak' },
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
                <div className="text-sm truncate">{(c as unknown as { tasks: { title: string } }).tasks?.title || 'Task'}</div>
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
