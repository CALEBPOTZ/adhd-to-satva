import { supabase } from './supabase'
import type { TaskAnalytics } from '../types'

// Calculate how many times a recurring task SHOULD have been done
// since it was created
function expectedCompletions(recurring: string | null, createdAt: string): number {
  if (!recurring) return 1
  const daysSinceCreated = Math.max(1, Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 86_400_000
  ))
  switch (recurring) {
    case 'daily': return daysSinceCreated
    case 'bidaily': return Math.floor(daysSinceCreated / 2)
    case 'weekly': return Math.floor(daysSinceCreated / 7)
    case 'biweekly': return Math.floor(daysSinceCreated / 14)
    case 'monthly': return Math.floor(daysSinceCreated / 30)
    case 'bimonthly': return Math.floor(daysSinceCreated / 60)
    case 'anytime': return Math.max(1, Math.floor(daysSinceCreated / 3)) // expect ~every 3 days
    default: return 1
  }
}

// Fetch analytics for all tasks for a given user
export async function getTaskAnalytics(userId: string): Promise<TaskAnalytics[]> {
  // Get all tasks visible to this user
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('active', true)
    .or(`assigned_to.is.null,assigned_to.eq.${userId}`)

  if (!tasks) return []

  // Get all completions for this user
  const { data: completions } = await supabase
    .from('completions')
    .select('task_id, completed_at')
    .eq('user_id', userId)

  const completionsByTask = new Map<string, string[]>()
  for (const c of completions || []) {
    const list = completionsByTask.get(c.task_id) || []
    list.push(c.completed_at)
    completionsByTask.set(c.task_id, list)
  }

  return tasks.map(task => {
    const taskCompletions = completionsByTask.get(task.id) || []
    const expected = expectedCompletions(task.recurring, task.created_at)
    const completionRate = expected > 0 ? Math.min(1, taskCompletions.length / expected) : 1

    // Average delay: how late in the day tasks get done (hours from midnight)
    const avgDelay = taskCompletions.length > 0
      ? taskCompletions.reduce((sum, ts) => sum + new Date(ts).getHours(), 0) / taskCompletions.length
      : 24 // never done = max delay

    // Resistance score: combination of low completion rate + late completion
    // 0 = no resistance (always done, done early)
    // 1 = max resistance (never done or always done very late)
    const resistance = Math.min(1, (1 - completionRate) * 0.7 + (avgDelay / 24) * 0.3)

    return {
      task_id: task.id,
      title: task.title,
      times_completed: taskCompletions.length,
      times_available: expected,
      completion_rate: completionRate,
      avg_delay_hours: avgDelay,
      resistance_score: resistance,
    }
  })
}

// Get resistance multiplier for a task (higher resistance = more XP)
export function getResistanceMultiplier(resistanceScore: number): number {
  // 0 resistance = 1x, max resistance = 2x
  return 1 + resistanceScore
}

// Generate a report for Claude Code analysis
export async function generateAnalyticsReport(userId: string): Promise<string> {
  const analytics = await getTaskAnalytics(userId)
  const sorted = [...analytics].sort((a, b) => b.resistance_score - a.resistance_score)

  let report = '# Task Analytics Report\n\n'
  report += '| Task | Done | Expected | Rate | Avg Hour | Resistance | XP Multiplier |\n'
  report += '|------|------|----------|------|----------|------------|---------------|\n'

  for (const a of sorted) {
    report += `| ${a.title} | ${a.times_completed} | ${a.times_available} | ${(a.completion_rate * 100).toFixed(0)}% | ${a.avg_delay_hours.toFixed(1)}h | ${(a.resistance_score * 100).toFixed(0)}% | ${(1 + a.resistance_score).toFixed(2)}x |\n`
  }

  return report
}
