import { supabase } from './supabase'
import { getPeriodStart, daysUntilNextPeriod } from './periods'
import type { Task, Completion } from '../types'

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

// Send a browser notification
export function sendNotification(title: string, body: string, tag?: string) {
  if (Notification.permission !== 'granted') return
  new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag: tag || undefined, // tag deduplicates — same tag won't show twice
  } as NotificationOptions)
}

// Store which notifications we've already sent so we don't spam
const SENT_KEY = 'adhd_satva_sent_notifications'

function getSentNotifications(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) || '{}')
  } catch {
    return {}
  }
}

function markSent(key: string) {
  const sent = getSentNotifications()
  sent[key] = Date.now()
  // Clean entries older than 7 days
  const weekAgo = Date.now() - 7 * 86_400_000
  for (const k in sent) {
    if (sent[k] < weekAgo) delete sent[k]
  }
  localStorage.setItem(SENT_KEY, JSON.stringify(sent))
}

function alreadySent(key: string): boolean {
  const sent = getSentNotifications()
  return !!sent[key]
}

// ============================================================
// Check for tasks that just became available (new period started)
// ============================================================
export function checkNewlyAvailable(tasks: Task[], completions: Completion[]) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  for (const task of tasks) {
    // Skip daily and anytime — they reset every day, no need to notify
    if (task.recurring === 'daily' || task.recurring === 'anytime') continue

    const periodStart = getPeriodStart(task.recurring)
    const periodStartDate = periodStart.toISOString().split('T')[0]

    // Only notify if the period started today (task just became available)
    if (periodStartDate !== today) continue

    // Check it was completed in the PREVIOUS period (meaning they'll want to do it again)
    const wasCompletedLastPeriod = completions.some(c => {
      const completedDate = new Date(c.completed_at)
      return c.task_id === task.id && completedDate < periodStart
    })

    if (!wasCompletedLastPeriod) continue

    const notifKey = `available_${task.id}_${periodStartDate}`
    if (alreadySent(notifKey)) continue

    const periodLabel = task.recurring === 'weekly' ? 'This week'
      : task.recurring === 'biweekly' ? 'New 2-week period'
      : task.recurring === 'monthly' ? 'New month'
      : task.recurring === 'bimonthly' ? 'New 2-month period'
      : task.recurring === 'bidaily' ? 'New 2-day period'
      : 'New period'

    sendNotification(
      `📋 ${task.title} is available again!`,
      `${periodLabel} — time to knock it out and earn ${task.xp_reward} XP`,
      notifKey,
    )
    markSent(notifKey)
  }
}

// ============================================================
// Check for neglected tasks
// ============================================================
export function checkNeglected(tasks: Task[], completions: Completion[]) {
  const now = new Date()

  for (const task of tasks) {
    // Skip daily — too noisy
    if (task.recurring === 'daily') continue

    const periodStart = getPeriodStart(task.recurring)
    const daysLeft = daysUntilNextPeriod(task.recurring)

    // Is it already completed this period?
    const completedThisPeriod = completions.some(c =>
      c.task_id === task.id && new Date(c.completed_at) >= periodStart
    )
    if (completedThisPeriod) continue

    // Determine urgency thresholds based on recurring type
    let shouldNudge = false
    let urgency = ''

    switch (task.recurring) {
      case 'bidaily':
        // Nudge if it's the second day of the period and still not done
        if (daysLeft === 0) { shouldNudge = true; urgency = 'Last chance today!' }
        break
      case 'weekly':
        // Nudge on Thursday (3 days left) and Saturday (1 day left)
        if (daysLeft <= 1) { shouldNudge = true; urgency = 'Last day this week!' }
        else if (daysLeft <= 3) { shouldNudge = true; urgency = `${daysLeft} days left this week` }
        break
      case 'biweekly':
        if (daysLeft <= 2) { shouldNudge = true; urgency = `${daysLeft} days left!` }
        else if (daysLeft <= 5) { shouldNudge = true; urgency = `${daysLeft} days left in this period` }
        break
      case 'monthly':
        if (daysLeft <= 3) { shouldNudge = true; urgency = `${daysLeft} days left this month!` }
        else if (daysLeft <= 7) { shouldNudge = true; urgency = `${daysLeft} days left this month` }
        break
      case 'bimonthly':
        if (daysLeft <= 7) { shouldNudge = true; urgency = `${daysLeft} days left!` }
        break
      case 'anytime': {
        // Nudge if not done in 5+ days
        const lastDone = completions
          .filter(c => c.task_id === task.id)
          .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0]
        const daysSinceLast = lastDone
          ? Math.floor((now.getTime() - new Date(lastDone.completed_at).getTime()) / 86_400_000)
          : 999
        if (daysSinceLast >= 5) {
          shouldNudge = true
          urgency = lastDone ? `${daysSinceLast} days since last done` : 'Never been done!'
        }
        break
      }
    }

    if (!shouldNudge) continue

    // Only send once per day per task
    const notifKey = `neglect_${task.id}_${now.toISOString().split('T')[0]}`
    if (alreadySent(notifKey)) continue

    sendNotification(
      `⚡ ${task.xp_reward} XP waiting: ${task.title}`,
      `${urgency} — grab it before the bonus drops!`,
      notifKey,
    )
    markSent(notifKey)
  }
}

// ============================================================
// Run all notification checks
// ============================================================
export async function runNotificationChecks(userId: string) {
  const hasPermission = await requestNotificationPermission()
  if (!hasPermission) return

  // Fetch data
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('active', true)
    .or(`assigned_to.is.null,assigned_to.eq.${userId}`)

  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString()
  const { data: completions } = await supabase
    .from('completions')
    .select('*')
    .eq('user_id', userId)
    .gte('completed_at', sixtyDaysAgo)

  if (!tasks || !completions) return

  checkNewlyAvailable(tasks, completions)
  checkNeglected(tasks, completions)
  checkMorningMotivation(userId)
}

// ============================================================
// Morning motivation notifications — positive framing only
// ============================================================
function checkMorningMotivation(_userId: string) {
  const now = new Date()
  const hour = now.getHours()
  const today = now.toISOString().split('T')[0]

  // 4:30am — Japa reminder (positive)
  if (hour >= 4 && hour < 5) {
    const key = `morning_japa_${today}`
    if (!alreadySent(key)) {
      sendNotification(
        '🙏 Your japa is worth 5x right now!',
        'Complete 16 rounds before 5am for maximum XP. You got this!',
        key,
      )
      markSent(key)
    }
  }

  // 7am — Morning kickstart
  if (hour >= 7 && hour < 8) {
    const key = `morning_start_${today}`
    if (!alreadySent(key)) {
      sendNotification(
        '⚡ Ready to crush today?',
        'Open the app, hit Just Start, and earn your first XP!',
        key,
      )
      markSent(key)
    }
  }

  // Reframe neglected task notifications — positive urgency, not guilt
}

// Reframe: change neglect notifications to positive

