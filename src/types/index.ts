export type Category = 'chore' | 'life_goal' | 'sadhana' | 'habit'
export type Recurring = 'daily' | 'bidaily' | 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'anytime'
export type IcnuType = 'urgency' | 'challenge' | 'novelty' | 'interest'

export interface User {
  id: string
  name: string
  total_xp: number
  spendable_xp: number
  level: number
  current_streak: number
  longest_streak: number
  last_active_date: string | null
}

export type DecayType = 'early' | 'evening' | 'flexible' | 'delayed'

export interface Task {
  id: string
  title: string
  category: Category
  description: string | null
  micro_steps: string[] | null
  xp_reward: number
  difficulty: number
  recurring: Recurring | null
  assigned_to: string | null
  icnu_type: IcnuType | null
  icnu_config: Record<string, unknown> | null
  decay_type: DecayType
  decay_start_hour: number
  active: boolean
  created_at: string
}

export interface Completion {
  id: string
  task_id: string
  user_id: string
  completed_at: string
  xp_earned: number
  used_timer: boolean
  timer_seconds: number | null
  combo_multiplier: number
}

export interface SadhanaLog {
  id: string
  user_id: string
  date: string
  japa_completed_at: string | null
  japa_rounds: number
  reading_minutes: number
  arti_puja: boolean
  flower_offering: boolean
  offering_plate: boolean
  class_minutes: number
  xp_earned: number
}

export interface Reward {
  id: string
  name: string
  description: string | null
  cost: number
  icon: string
  active: boolean
}

export interface Redemption {
  id: string
  reward_id: string
  user_id: string
  cost: number
  redeemed_at: string
}

export interface TaskAnalytics {
  task_id: string
  title: string
  times_completed: number
  times_available: number
  completion_rate: number
  avg_delay_hours: number
  resistance_score: number // 0-1, higher = more resistance = more bonus XP
}

export interface XpEvent {
  amount: number
  x: number
  y: number
  id: string
}
