/**
 * Task Management Script — run via Claude Code
 *
 * Usage examples (run from project root):
 *   npx tsx scripts/manage-tasks.ts add "Mop kitchen floor" chore daily 15 2
 *   npx tsx scripts/manage-tasks.ts remove "Mop kitchen floor"
 *   npx tsx scripts/manage-tasks.ts list
 *   npx tsx scripts/manage-tasks.ts list chore
 *   npx tsx scripts/manage-tasks.ts analytics caleb
 *   npx tsx scripts/manage-tasks.ts adjust-rewards
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load env
const envPath = path.join(process.cwd(), '.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const env: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const [key, ...val] = line.split('=')
  if (key && val.length) env[key.trim()] = val.join('=').trim()
}

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
)

const [,, command, ...args] = process.argv

async function getUserId(name: string): Promise<string | null> {
  const { data } = await supabase.from('users').select('id').ilike('name', name).single()
  return data?.id || null
}

async function addTask() {
  const [title, category = 'chore', recurring = 'daily', xpReward = '10', difficulty = '1', assignedTo, icnuType, ...microSteps] = args
  if (!title) { console.log('Usage: add "Title" [category] [recurring] [xp] [difficulty] [assignedTo] [icnuType] [step1] [step2] ...'); return }

  let assignedId = null
  if (assignedTo) {
    assignedId = await getUserId(assignedTo)
  }

  const timerMap: Record<number, number> = { 1: 180, 2: 300, 3: 600, 4: 900, 5: 1200 }

  const { data, error } = await supabase.from('tasks').insert({
    title,
    category,
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

  const { data, error } = await supabase
    .from('tasks')
    .update({ active: false })
    .ilike('title', `%${title}%`)
    .select()

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

  console.log(`\nAnalytics for ${userName}:`)
  console.log(`${'Task'.padEnd(40)} ${'Done'.padEnd(6)} ${'Avg Hr'.padEnd(8)} ${'Resist'.padEnd(8)} XP Mult`)
  console.log('-'.repeat(80))

  const rows: Array<{ title: string; done: number; avgHr: number; resistance: number }> = []

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
    const rate = Math.min(1, comps.length / Math.max(1, expected))
    const avgHr = comps.length > 0 ? comps.reduce((s, c) => s + new Date(c.completed_at).getHours(), 0) / comps.length : 24
    const resistance = Math.min(1, (1 - rate) * 0.7 + (avgHr / 24) * 0.3)

    rows.push({ title: task.title, done: comps.length, avgHr, resistance })
  }

  rows.sort((a, b) => b.resistance - a.resistance)
  for (const r of rows) {
    console.log(`${r.title.padEnd(40)} ${String(r.done).padEnd(6)} ${r.avgHr.toFixed(1).padEnd(8)} ${(r.resistance * 100).toFixed(0).padEnd(7)}% ${(1 + r.resistance).toFixed(2)}x`)
  }
}

async function adjustRewards() {
  // Analyze redemption patterns and suggest adjustments
  const { data: redemptions } = await supabase
    .from('redemptions')
    .select('reward_id, cost')

  const { data: rewards } = await supabase
    .from('rewards')
    .select('*')
    .eq('active', true)

  if (!rewards) return

  const redeemCounts = new Map<string, number>()
  for (const r of redemptions || []) {
    redeemCounts.set(r.reward_id, (redeemCounts.get(r.reward_id) || 0) + 1)
  }

  console.log('\nReward Analytics:')
  console.log(`${'Reward'.padEnd(25)} ${'Cost'.padEnd(8)} ${'Redeemed'.padEnd(10)} Suggestion`)
  console.log('-'.repeat(60))

  for (const reward of rewards) {
    const count = redeemCounts.get(reward.id) || 0
    let suggestion = 'OK'
    if (count > 5 && reward.cost < 300) suggestion = 'Consider increasing cost (popular + cheap)'
    if (count === 0) suggestion = 'Consider lowering cost (never redeemed)'

    console.log(`${reward.name.padEnd(25)} ${String(reward.cost).padEnd(8)} ${String(count).padEnd(10)} ${suggestion}`)
  }
}

switch (command) {
  case 'add': addTask(); break
  case 'remove': removeTask(); break
  case 'list': listTasks(); break
  case 'analytics': analytics(); break
  case 'adjust-rewards': adjustRewards(); break
  default:
    console.log(`
ADHD to Satva — Task Manager

Commands:
  add "Title" [category] [recurring] [xp] [difficulty] [assignedTo] [icnuType] [steps...]
  remove "Title"
  list [category]
  analytics [userName]
  adjust-rewards
    `)
}
