import type { Task, Completion } from '../types'
import { getPeriodStart } from './periods'
import { getDecayMultiplier } from './xp'

// Laundry chain — each step depends on the previous
// Tasks with title matching these patterns form a dependency chain
const DEPENDENCY_CHAINS: string[][] = [
  [
    'Put washing machine on',
    'Take washing out & hang',
    'Take washing in',
    'Fold and iron laundry',
    'Put folded clothes away',
  ],
]

// Find the next task in a dependency chain that hasn't been completed this period
function getNextInChain(tasks: Task[], completions: Completion[]): Task | null {
  for (const chain of DEPENDENCY_CHAINS) {
    for (const stepTitle of chain) {
      const task = tasks.find(t => t.title === stepTitle)
      if (!task) continue

      const periodStart = getPeriodStart(task.recurring)
      const completedThisPeriod = completions.some(
        c => c.task_id === task.id && new Date(c.completed_at) >= periodStart
      )

      if (!completedThisPeriod) {
        return task // This is the next step that needs doing
      }
    }
  }
  return null
}

// Check if a task is blocked by a dependency (earlier step not done)
export function isBlockedByDependency(task: Task, tasks: Task[], completions: Completion[]): boolean {
  for (const chain of DEPENDENCY_CHAINS) {
    const taskIndex = chain.indexOf(task.title)
    if (taskIndex <= 0) continue // Not in a chain or is the first step

    // Check all previous steps
    for (let i = 0; i < taskIndex; i++) {
      const prevTask = tasks.find(t => t.title === chain[i])
      if (!prevTask) continue

      const periodStart = getPeriodStart(prevTask.recurring)
      const prevDone = completions.some(
        c => c.task_id === prevTask.id && new Date(c.completed_at) >= periodStart
      )

      if (!prevDone) return true // Previous step not done — this task is blocked
    }
  }
  return false
}

// Get the chain step label (e.g. "Step 2/5")
export function getChainInfo(task: Task): { step: number; total: number; chainName: string } | null {
  for (const chain of DEPENDENCY_CHAINS) {
    const idx = chain.indexOf(task.title)
    if (idx >= 0) {
      return { step: idx + 1, total: chain.length, chainName: 'Laundry' }
    }
  }
  return null
}

// Priority score for "Just Start" — higher = should do first
export function getTaskPriority(task: Task, tasks: Task[], completions: Completion[]): number {
  let score = 0

  // 1. Decay urgency — tasks losing XP get higher priority
  const decay = getDecayMultiplier(task, completions.some(c => c.task_id === task.id))
  score += (1 - decay) * 50 // 0-50 points for decay urgency

  // 2. Dependency chains — next step in a chain gets boosted
  const chainTask = getNextInChain(tasks, completions)
  if (chainTask?.id === task.id) {
    score += 30 // Boost the next laundry step
  }

  // 3. Blocked tasks get deprioritized
  if (isBlockedByDependency(task, tasks, completions)) {
    score -= 100 // Heavily penalize — can't do this yet
  }

  // 4. Daily tasks get slight priority over less frequent
  if (task.recurring === 'daily') score += 10
  if (task.recurring === 'bidaily') score += 5

  // 5. Lower difficulty = easier to start (ADHD-friendly)
  score += (5 - task.difficulty) * 3

  return score
}

// Sort tasks by frequency group for display
export type FrequencyGroup = {
  key: string
  label: string
  tasks: Task[]
}

export function groupTasksByFrequency(tasks: Task[]): FrequencyGroup[] {
  const groups: Record<string, { label: string; order: number; tasks: Task[] }> = {
    daily: { label: 'Daily', order: 0, tasks: [] },
    bidaily: { label: 'Every 2 Days', order: 1, tasks: [] },
    weekly: { label: 'Weekly', order: 2, tasks: [] },
    biweekly: { label: 'Every 2 Weeks', order: 3, tasks: [] },
    monthly: { label: 'Monthly', order: 4, tasks: [] },
    bimonthly: { label: 'Every 2 Months', order: 5, tasks: [] },
    anytime: { label: 'Anytime', order: 6, tasks: [] },
  }

  for (const task of tasks) {
    const key = task.recurring || 'anytime'
    if (groups[key]) {
      groups[key].tasks.push(task)
    }
  }

  return Object.entries(groups)
    .filter(([, g]) => g.tasks.length > 0)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, g]) => ({ key, label: g.label, tasks: g.tasks }))
}
