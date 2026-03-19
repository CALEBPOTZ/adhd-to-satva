/**
 * Task Management Script — run via Claude Code
 *
 * Usage (from project root):
 *   npx tsx scripts/manage-tasks.ts add "Task Title" chore daily 15 2
 *   npx tsx scripts/manage-tasks.ts remove "Task Title"
 *   npx tsx scripts/manage-tasks.ts list [category]
 *   npx tsx scripts/manage-tasks.ts analytics [userName]
 *   npx tsx scripts/manage-tasks.ts trends [userName]
 *   npx tsx scripts/manage-tasks.ts adjust-rewards
 *   npx tsx scripts/manage-tasks.ts rebalance [userName]
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.join(process.cwd(), '.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const env: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const [key, ...val] = line.split('=')
  if (key && val.length) env[key.trim()] = val.join('=').trim()
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const [,, command, ...args] = process.argv

async function getUserId(name: string): Promise<string | null> {
  const { data } = await supabase.from('users').select('id').ilike('name', name).single()
  return data?.id || null
}

async function addTask() {
  const [title, category = 'chore', recurring = 'daily', xpReward = '10', difficulty = '1', assignedTo, icnuType, ...microSteps] = args
  if (!title) { console.log('Usage: add "Title" [category] [recurring] [xp] [difficulty] [assignedTo] [icnuType] [step1] ...'); return }

  let assignedId = null
  if (assignedTo && assignedTo !== 'null') assignedId = await getUserId(assignedTo)

  const timerMap: Record<number, number> = { 1: 180, 2: 300, 3: 600, 4: 900, 5: 1200 }
  const { data, error } = await supabase.from('tasks').insert({
    title, category,
    recurring: recurring === 'null' ? null : recurring,
    xp_reward: parseInt(xpReward),
    difficulty: parseInt(difficulty),
    assigned_to: assignedId,
    icnu_type: icnuType === 'null' ? null : (icnuType || 'urgency'),
    icnu_config: icnuType !== 'null' ? { timer_seconds: timerMap[parseInt(difficulty)] || 300 } : null,
    micro_steps: microSteps.length > 0 ? microSteps : null,
  }).select().single()

  if (error) console.error('Error:', error.message)
  else console.log(`Added: "${data.title}" (${data.category}, ${data.recurring}, ${data.xp_reward}XP)`)
}

async function removeTask() {
  const [title] = args
  if (!title) { console.log('Usage: remove "Task Title"'); return }
  const { data, error } = await supabase.from('tasks').update({ active: false }).ilike('title', `%${title}%`).select()
  if (error) console.error('Error:', error.message)
  else if (data?.length) console.log(`Deactivated ${data.length} task(s): ${data.map(t => t.title).join(', ')}`)
  else console.log(`No tasks found matching "${title}"`)
}

async function listTasks() {
  const [categoryFilter] = args
  let query = supabase.from('tasks').select('title, category, recurring, xp_reward, difficulty, active').eq('active', true).order('category').order('recurring')
  if (categoryFilter) query = query.eq('category', categoryFilter)
  const { data } = await query
  if (!data?.length) { console.log('No tasks found'); return }
  console.log(`\n${'Title'.padEnd(40)} ${'Cat'.padEnd(10)} ${'Freq'.padEnd(10)} ${'XP'.padEnd(5)} Diff`)
  console.log('-'.repeat(80))
  for (const t of data) {
    console.log(`${t.title.padEnd(40)} ${t.category.padEnd(10)} ${(t.recurring || '-').padEnd(10)} ${String(t.xp_reward).padEnd(5)} ${'*'.repeat(t.difficulty)}`)
  }
  console.log(`\nTotal: ${data.length} tasks`)
}

async function analytics() {
  const [userName = 'caleb'] = args
  const userId = await getUserId(userName)
  if (!userId) { console.log(`User "${userName}" not found`); return }

  const { data: tasks } = await supabase.from('tasks').select('*').eq('active', true)
  const { data: completions } = await supabase.from('completions').select('task_id, completed_at, xp_earned').eq('user_id', userId)
  if (!tasks) return

  const compByTask = new Map<string, Array<{ completed_at: string; xp_earned: number }>>()
  for (const c of completions || []) {
    const list = compByTask.get(c.task_id) || []
    list.push(c)
    compByTask.set(c.task_id, list)
  }

  console.log(`\n📊 Task Analytics for ${userName}`)
  console.log(`${'Task'.padEnd(40)} ${'Done'.padEnd(6)} ${'Avg Hr'.padEnd(8)} ${'Resist'.padEnd(8)} ${'Avg XP'.padEnd(8)} Status`)
  console.log('-'.repeat(90))

  const rows: Array<{ title: string; done: number; avgHr: number; resistance: number; avgXp: number; recurring: string }> = []

  for (const task of tasks) {
    const comps = compByTask.get(task.id) || []
    const daysSince = Math.max(1, Math.floor((Date.now() - new Date(task.created_at).getTime()) / 86400000))
    let expected = 1
    switch (task.recurring) {
      case 'daily': expected = daysSince; break
      case 'bidaily': expected = Math.floor(daysSince / 2); break
      case 'weekly': expected = Math.floor(daysSince / 7); break
      case 'biweekly': expected = Math.floor(daysSince / 14); break
      case 'monthly': expected = Math.floor(daysSince / 30); break
      case 'bimonthly': expected = Math.floor(daysSince / 60); break
      default: expected = Math.max(1, Math.floor(daysSince / 3))
    }
    const rate = expected > 0 ? Math.min(1, comps.length / Math.max(1, expected)) : 1
    const avgHr = comps.length > 0 ? comps.reduce((s, c) => s + new Date(c.completed_at).getHours(), 0) / comps.length : 24
    const resistance = Math.min(1, (1 - rate) * 0.7 + (avgHr / 24) * 0.3)
    const avgXp = comps.length > 0 ? Math.round(comps.reduce((s, c) => s + c.xp_earned, 0) / comps.length) : 0

    rows.push({ title: task.title, done: comps.length, avgHr, resistance, avgXp, recurring: task.recurring || '-' })
  }

  rows.sort((a, b) => b.resistance - a.resistance)
  for (const r of rows) {
    const status = r.resistance > 0.7 ? '🚨 HIGH RESIST' : r.resistance > 0.4 ? '⚠️  MODERATE' : '✅ GOOD'
    console.log(`${r.title.padEnd(40)} ${String(r.done).padEnd(6)} ${r.avgHr.toFixed(1).padEnd(8)} ${(r.resistance * 100).toFixed(0).padEnd(7)}% ${String(r.avgXp).padEnd(8)} ${status}`)
  }
}

// Long-term trends — weekly XP over time
async function trends() {
  const [userName = 'caleb'] = args
  const userId = await getUserId(userName)
  if (!userId) { console.log(`User "${userName}" not found`); return }

  const { data: completions } = await supabase
    .from('completions')
    .select('completed_at, xp_earned')
    .eq('user_id', userId)
    .order('completed_at')

  const { data: sadhanaLogs } = await supabase
    .from('sadhana_log')
    .select('date, xp_earned')
    .eq('user_id', userId)
    .order('date')

  if (!completions?.length && !sadhanaLogs?.length) {
    console.log('No data yet — start completing tasks!')
    return
  }

  // Group by week
  const weekMap = new Map<string, { taskXp: number; sadhanaXp: number; taskCount: number; days: Set<string> }>()

  for (const c of completions || []) {
    const d = new Date(c.completed_at)
    const weekStart = getWeekStart(d)
    const week = weekMap.get(weekStart) || { taskXp: 0, sadhanaXp: 0, taskCount: 0, days: new Set() }
    week.taskXp += c.xp_earned
    week.taskCount++
    week.days.add(d.toISOString().split('T')[0])
    weekMap.set(weekStart, week)
  }

  for (const s of sadhanaLogs || []) {
    const d = new Date(s.date + 'T12:00:00')
    const weekStart = getWeekStart(d)
    const week = weekMap.get(weekStart) || { taskXp: 0, sadhanaXp: 0, taskCount: 0, days: new Set() }
    week.sadhanaXp += s.xp_earned
    week.days.add(s.date)
    weekMap.set(weekStart, week)
  }

  console.log(`\n📈 Weekly Trends for ${userName}`)
  console.log(`${'Week'.padEnd(15)} ${'Task XP'.padEnd(10)} ${'Sadhana'.padEnd(10)} ${'Total'.padEnd(10)} ${'Tasks'.padEnd(8)} ${'Active Days'.padEnd(12)} Trend`)
  console.log('-'.repeat(80))

  const weeks = [...weekMap.entries()].sort()
  let prevTotal = 0
  for (const [weekStart, data] of weeks) {
    const total = data.taskXp + data.sadhanaXp
    const trend = prevTotal === 0 ? '—' : total > prevTotal ? '📈 UP' : total < prevTotal ? '📉 DOWN' : '➡️  FLAT'
    console.log(`${weekStart.padEnd(15)} ${String(data.taskXp).padEnd(10)} ${String(data.sadhanaXp).padEnd(10)} ${String(total).padEnd(10)} ${String(data.taskCount).padEnd(8)} ${String(data.days.size).padEnd(12)} ${trend}`)
    prevTotal = total
  }

  // Recommendations
  console.log('\n💡 Recommendations:')
  if (weeks.length >= 2) {
    const last = weeks[weeks.length - 1][1]
    const prev = weeks[weeks.length - 2][1]
    const lastTotal = last.taskXp + last.sadhanaXp
    const prevTotal = prev.taskXp + prev.sadhanaXp
    if (lastTotal < prevTotal * 0.7) console.log('  ⚠️  XP dropped >30% — consider lowering task XP to reduce pressure, or review which tasks are being skipped')
    if (last.days.size < 4) console.log('  ⚠️  Active less than 4 days — engagement dropping, consider adding easier quick-win tasks')
    if (last.sadhanaXp === 0) console.log('  ⚠️  No sadhana logged — sadhana XP might need a boost to incentivize')
  }
}

function getWeekStart(d: Date): string {
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return monday.toISOString().split('T')[0]
}

// Auto-rebalance suggestions based on completion data
async function rebalance() {
  const [userName = 'caleb'] = args
  const userId = await getUserId(userName)
  if (!userId) { console.log(`User "${userName}" not found`); return }

  const { data: tasks } = await supabase.from('tasks').select('*').eq('active', true)
  const { data: completions } = await supabase.from('completions').select('task_id, xp_earned').eq('user_id', userId)
  if (!tasks) return

  const compByTask = new Map<string, number[]>()
  for (const c of completions || []) {
    const list = compByTask.get(c.task_id) || []
    list.push(c.xp_earned)
    compByTask.set(c.task_id, list)
  }

  console.log(`\n🔧 Rebalance Suggestions for ${userName}`)
  console.log(`${'Task'.padEnd(40)} ${'Current'.padEnd(10)} ${'Avg Earned'.padEnd(12)} ${'Times'.padEnd(8)} Suggestion`)
  console.log('-'.repeat(90))

  for (const task of tasks) {
    const xpList = compByTask.get(task.id) || []
    if (xpList.length < 3) continue // Need at least 3 completions for a recommendation

    const avgEarned = Math.round(xpList.reduce((s, x) => s + x, 0) / xpList.length)
    const baseXp = task.xp_reward

    let suggestion = '✅ OK'
    let newXp = baseXp

    // If avg earned is consistently way higher than base (lots of bonuses), base might be too low
    if (avgEarned > baseXp * 3) {
      suggestion = '📈 Consider raising base (players earning lots of bonuses)'
      newXp = Math.round(baseXp * 1.3)
    }
    // If avg earned is close to base (no bonuses being earned), might be too easy/boring
    if (avgEarned <= baseXp * 1.1 && xpList.length > 10) {
      suggestion = '📉 Stale — consider adding ICNU or raising difficulty'
    }
    // If rarely done, might need XP boost
    if (xpList.length < 5 && task.recurring === 'daily') {
      suggestion = '⚠️ Rarely done daily — boost XP or lower difficulty?'
      newXp = Math.round(baseXp * 1.5)
    }

    if (suggestion !== '✅ OK') {
      console.log(`${task.title.padEnd(40)} ${String(baseXp).padEnd(10)} ${String(avgEarned).padEnd(12)} ${String(xpList.length).padEnd(8)} ${suggestion}`)
      if (newXp !== baseXp) {
        console.log(`  → Suggested: UPDATE tasks SET xp_reward = ${newXp} WHERE title = '${task.title}';`)
      }
    }
  }
}

async function adjustRewards() {
  const { data: redemptions } = await supabase.from('redemptions').select('reward_id, cost')
  const { data: rewards } = await supabase.from('rewards').select('*').eq('active', true)
  if (!rewards) return

  const redeemCounts = new Map<string, number>()
  for (const r of redemptions || []) redeemCounts.set(r.reward_id, (redeemCounts.get(r.reward_id) || 0) + 1)

  console.log('\n🎁 Reward Analytics:')
  console.log(`${'Reward'.padEnd(25)} ${'Cost'.padEnd(8)} ${'Redeemed'.padEnd(10)} Suggestion`)
  console.log('-'.repeat(60))
  for (const reward of rewards) {
    const count = redeemCounts.get(reward.id) || 0
    let suggestion = '✅ OK'
    if (count > 5 && reward.cost < 200) suggestion = '📈 Raise cost (too popular + cheap)'
    if (count === 0 && (redemptions?.length || 0) > 5) suggestion = '📉 Lower cost (never redeemed)'
    console.log(`${reward.name.padEnd(25)} ${String(reward.cost).padEnd(8)} ${String(count).padEnd(10)} ${suggestion}`)
  }
}

switch (command) {
  case 'add': addTask(); break
  case 'remove': removeTask(); break
  case 'list': listTasks(); break
  case 'analytics': analytics(); break
  case 'trends': trends(); break
  case 'rebalance': rebalance(); break
  case 'adjust-rewards': adjustRewards(); break
  default:
    console.log(`
ADHD to Satva — Task Manager

Commands:
  add "Title" [category] [recurring] [xp] [difficulty] [assignedTo] [icnuType] [steps...]
  remove "Title"
  list [category]
  analytics [userName]     — resistance scores, completion rates
  trends [userName]        — weekly XP trends over time
  rebalance [userName]     — auto-suggest XP adjustments based on data
  adjust-rewards           — analyze reward redemption patterns
    `)
}
