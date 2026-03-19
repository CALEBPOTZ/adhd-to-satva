import type { Completion, Task } from '../types'
import { getPeriodStart } from './periods'

// Level thresholds — each level requires more XP
const LEVEL_THRESHOLDS = [
  0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5200,
  6600, 8200, 10000, 12000, 14500, 17500, 21000, 25000, 30000, 36000,
]

// Spiritual level names
export const LEVEL_NAMES = [
  'Newcomer',
  'Seeker',
  'Aspirant',
  'Sadhaka',
  'Kanishtha',
  'Steady Kanishtha',
  'Rising Madhyama',
  'Madhyama',
  'Steady Madhyama',
  'Advanced Madhyama',
  'Approaching Uttama',
  'Uttama',
  'Paramahamsa',
  'Nitya Siddha',
  'Prema Bhakta',
  'Shaktyavesha',
  'Transcendental',
  'Mahabhagavata',
  'Rasika',
  'Eternal Servant',
]

export function getLevelForXp(totalXp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) return i + 1
  }
  return 1
}

export function getXpForNextLevel(level: number): number {
  if (level >= LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 10000
  return LEVEL_THRESHOLDS[level]
}

export function getXpForCurrentLevel(level: number): number {
  if (level <= 1) return 0
  return LEVEL_THRESHOLDS[level - 1]
}

export function getLevelProgress(totalXp: number, level: number): number {
  const current = getXpForCurrentLevel(level)
  const next = getXpForNextLevel(level)
  if (next === current) return 1
  return (totalXp - current) / (next - current)
}

export function getLevelName(level: number): string {
  return LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)]
}

// Global streak multiplier: more consecutive days active = more XP
export function getStreakMultiplier(streak: number): number {
  if (streak <= 1) return 1
  if (streak <= 3) return 1.1
  if (streak <= 7) return 1.25
  if (streak <= 14) return 1.5
  if (streak <= 30) return 1.75
  return 2.0
}

// ============================================================
// PER-TASK STREAK: Consecutive periods a task has been completed
// ============================================================
export function getTaskStreak(task: Task, completions: Completion[]): number {
  const taskCompletions = completions
    .filter(c => c.task_id === task.id)
    .map(c => new Date(c.completed_at))
    .sort((a, b) => b.getTime() - a.getTime()) // newest first

  if (taskCompletions.length === 0) return 0

  // Check backwards from today: how many consecutive periods was this done?
  let streak = 0
  const periodMs = getPeriodMs(task.recurring)

  for (let i = 0; i < 60; i++) { // check up to 60 periods back
    const periodStart = getPeriodStart(task.recurring)
    // Adjust to check period `i` ago
    const targetPeriodStart = new Date(periodStart.getTime() - i * periodMs)
    const targetPeriodEnd = new Date(targetPeriodStart.getTime() + periodMs)

    const doneInPeriod = taskCompletions.some(
      d => d >= targetPeriodStart && d < targetPeriodEnd
    )

    if (i === 0 && !doneInPeriod) {
      // Current period not done yet — that's ok, don't break the streak
      continue
    }

    if (doneInPeriod) {
      streak++
    } else {
      break
    }
  }

  return streak
}

function getPeriodMs(recurring: string | null): number {
  switch (recurring) {
    case 'daily': return 86_400_000
    case 'bidaily': return 2 * 86_400_000
    case 'weekly': return 7 * 86_400_000
    case 'biweekly': return 14 * 86_400_000
    case 'monthly': return 30 * 86_400_000
    case 'bimonthly': return 60 * 86_400_000
    default: return 86_400_000
  }
}

// ============================================================
// PER-TASK STREAK MULTIPLIER
// Frequency-aware: a 3-week weekly streak is harder than a 3-day daily streak
// ============================================================
export function getTaskStreakMultiplier(taskStreak: number, recurring: string | null = 'daily'): number {
  if (taskStreak <= 1) return 1

  // Scale thresholds by frequency — fewer periods = faster multiplier growth
  switch (recurring) {
    case 'daily':
      // Daily: slow burn, takes many days to build
      if (taskStreak <= 3) return 1.1
      if (taskStreak <= 7) return 1.2
      if (taskStreak <= 14) return 1.35
      if (taskStreak <= 30) return 1.5
      return 1.75

    case 'bidaily':
      // Every 2 days: medium pace
      if (taskStreak <= 2) return 1.15
      if (taskStreak <= 5) return 1.3
      if (taskStreak <= 10) return 1.5
      return 1.75

    case 'weekly':
      // Weekly: each week of consistency is a real achievement
      if (taskStreak <= 2) return 1.2
      if (taskStreak <= 4) return 1.4   // 1 month of weekly consistency
      if (taskStreak <= 8) return 1.6   // 2 months
      return 2.0                        // 2+ months

    case 'biweekly':
      // Biweekly: even harder to maintain
      if (taskStreak <= 2) return 1.25
      if (taskStreak <= 4) return 1.5   // 2 months
      return 2.0

    case 'monthly':
      // Monthly: each month is a milestone
      if (taskStreak <= 2) return 1.3   // 2 months in a row
      if (taskStreak <= 4) return 1.6   // 4 months
      return 2.0                        // 5+ months

    case 'bimonthly':
      // Bimonthly: very hard to maintain
      if (taskStreak <= 1) return 1.3
      if (taskStreak <= 3) return 1.7
      return 2.0

    default:
      return 1
  }
}

// ============================================================
// XP DECAY: Within-period time decay
// Tasks lose XP the longer you wait WITHIN the current period
// - 'early': decays from decay_start_hour to end of period (do it early!)
// - 'delayed': decays from decay_start_hour to midnight (e.g. dishes after 7pm)
// - 'evening': no decay — meant for nighttime
// - 'flexible': no decay — any time is fine
// ============================================================
export function getDecayMultiplier(task: Task, hasBeenCompletedBefore: boolean = true): number {
  const decayType = task.decay_type || 'early'

  // Evening and flexible tasks: always full XP
  if (decayType === 'evening' || decayType === 'flexible') return 1
  if (!task.recurring || task.recurring === 'anytime') return 1

  // No decay until the task has been completed at least once
  // First time doing a chore = full XP, decay starts from the second period onward
  if (!hasBeenCompletedBefore) return 1

  const now = new Date()
  const startHour = task.decay_start_hour ?? 6

  if (decayType === 'delayed') {
    // Delayed: decay only starts after a specific hour TODAY
    // e.g. dishes: full XP until 7pm, then decays to 0.5x by midnight
    const currentHour = now.getHours() + now.getMinutes() / 60
    if (currentHour < startHour) return 1 // Before start hour: full XP
    const hoursRemaining = 24 - currentHour
    const decayWindow = 24 - startHour // hours from start to midnight
    const progress = 1 - (hoursRemaining / decayWindow)
    return Math.max(0.5, 1 - progress * 0.5) // Decays to 50%
  }

  // 'early' type: decays from start of period to end of period
  // Daily: 6am → midnight, weekly: Monday → Sunday, etc.
  const periodStart = getPeriodStart(task.recurring)
  const periodMs = getPeriodMs(task.recurring)
  const periodEnd = new Date(periodStart.getTime() + periodMs)

  if (task.recurring === 'daily' || task.recurring === 'bidaily') {
    // For daily/bidaily: decay within the day based on hours
    const currentHour = now.getHours() + now.getMinutes() / 60
    if (currentHour < startHour) return 1 // Before start: full XP

    const decayWindow = 24 - startHour // hours from start to midnight
    const elapsed = currentHour - startHour
    const progress = elapsed / decayWindow

    // 100% at start hour → 50% at midnight
    return Math.max(0.5, 1 - progress * 0.5)
  }

  // Weekly/biweekly/monthly/bimonthly: decay across the period
  // Full XP at start of period → minimum at end of period
  const elapsed = now.getTime() - periodStart.getTime()
  const totalMs = periodEnd.getTime() - periodStart.getTime()
  const progress = Math.min(1, elapsed / totalMs)

  // Minimum decay floors by frequency
  const minMultiplier: Record<string, number> = {
    weekly: 0.4,     // 40% at end of week
    biweekly: 0.35,  // 35% at end of 2 weeks
    monthly: 0.3,    // 30% at end of month
    bimonthly: 0.25, // 25% at end of 2 months
  }
  const floor = minMultiplier[task.recurring] || 0.3
  const decayRange = 1 - floor

  return Math.max(floor, 1 - progress * decayRange)
}

// Japa time bonus — exponential reward for early completion
// 16 rounds is the baseline (non-negotiable), so the XP is all about WHEN
export function getJapaMultiplier(completedAt: Date): number {
  const hour = completedAt.getHours() + completedAt.getMinutes() / 60
  if (hour < 5) return 5.0   // Before 5am: legendary — 5x
  if (hour < 6) return 3.5   // Before 6am: excellent — 3.5x
  if (hour < 7) return 2.5   // Before 7am: great — 2.5x
  if (hour < 8) return 1.5   // Before 8am: good — 1.5x
  return 1.0                  // After 8am: base
}

export function getJapaTimeLabel(hour: number): { label: string; color: string } {
  if (hour < 5) return { label: '5x LEGENDARY', color: 'text-accent-glow' }
  if (hour < 6) return { label: '3.5x EXCELLENT', color: 'text-accent' }
  if (hour < 7) return { label: '2.5x GREAT', color: 'text-sadhana' }
  if (hour < 8) return { label: '1.5x GOOD', color: 'text-success' }
  return { label: '1x BASE', color: 'text-text-dim' }
}

// ============================================================
// FULL XP CALCULATION
// ============================================================
export function calculateXp(
  baseXp: number,
  difficulty: number,
  globalStreak: number,
  comboMultiplier: number = 1,
  bonusMultiplier: number = 1,
  taskStreakMultiplier: number = 1,
  decayMultiplier: number = 1,
): number {
  return Math.round(
    baseXp
    * difficulty
    * getStreakMultiplier(globalStreak)
    * comboMultiplier
    * bonusMultiplier
    * taskStreakMultiplier
    * decayMultiplier
  )
}
