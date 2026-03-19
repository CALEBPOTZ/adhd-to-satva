// Random daily challenges — inject novelty into the routine

export interface DailyChallenge {
  id: string
  title: string
  description: string
  icon: string
  condition: 'tasks_in_time' | 'streak_tasks' | 'early_bird' | 'all_daily' | 'sadhana_first'
  target: number
  bonusMultiplier: number
}

const CHALLENGE_POOL: DailyChallenge[] = [
  {
    id: 'speed_3',
    title: 'Speed Demon',
    description: 'Complete 3 tasks in 10 minutes',
    icon: '⚡',
    condition: 'tasks_in_time',
    target: 3,
    bonusMultiplier: 2,
  },
  {
    id: 'speed_5',
    title: 'Unstoppable',
    description: 'Complete 5 tasks in 15 minutes',
    icon: '🔥',
    condition: 'tasks_in_time',
    target: 5,
    bonusMultiplier: 2.5,
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Complete 3 tasks before 9am',
    icon: '🌅',
    condition: 'early_bird',
    target: 3,
    bonusMultiplier: 2,
  },
  {
    id: 'sadhana_first',
    title: 'Spiritual Warrior',
    description: 'Complete all sadhana before any chores',
    icon: '🙏',
    condition: 'sadhana_first',
    target: 1,
    bonusMultiplier: 1.5,
  },
  {
    id: 'all_daily',
    title: 'Perfect Day',
    description: 'Complete every daily task',
    icon: '⭐',
    condition: 'all_daily',
    target: 1,
    bonusMultiplier: 2,
  },
  {
    id: 'combo_5',
    title: 'Combo King',
    description: 'Reach a 5x combo',
    icon: '👑',
    condition: 'streak_tasks',
    target: 5,
    bonusMultiplier: 2,
  },
  {
    id: 'timer_3',
    title: 'Beat the Clock',
    description: 'Beat 3 timer challenges today',
    icon: '⏱️',
    condition: 'tasks_in_time',
    target: 3,
    bonusMultiplier: 1.5,
  },
]

// Pick today's challenge deterministically from the date
export function getTodayChallenge(): DailyChallenge {
  const today = new Date()
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  const index = seed % CHALLENGE_POOL.length
  return CHALLENGE_POOL[index]
}
