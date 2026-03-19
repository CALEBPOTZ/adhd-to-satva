// Period calculation utilities
// Determines the start of the current period for a given recurring type

export function getPeriodStart(recurring: string | null): Date {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (recurring) {
    case 'daily':
      return today

    case 'bidaily': {
      // Periods start on even days of the year
      const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000)
      const periodStart = dayOfYear % 2 === 0 ? today : new Date(today.getTime() - 86_400_000)
      return periodStart
    }

    case 'weekly': {
      // Week starts Monday
      const day = now.getDay()
      const mondayOffset = day === 0 ? 6 : day - 1
      return new Date(today.getTime() - mondayOffset * 86_400_000)
    }

    case 'biweekly': {
      // 2-week periods anchored to epoch week
      const epochWeek = Math.floor(now.getTime() / (7 * 86_400_000))
      const periodWeek = epochWeek - (epochWeek % 2)
      return new Date(periodWeek * 7 * 86_400_000)
    }

    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth(), 1)

    case 'bimonthly': {
      // 2-month periods: Jan-Feb, Mar-Apr, etc.
      const biMonth = now.getMonth() - (now.getMonth() % 2)
      return new Date(now.getFullYear(), biMonth, 1)
    }

    case 'anytime':
      // "Anytime" tasks can always be done — use today as period
      return today

    default:
      return today
  }
}

export function getPeriodEnd(recurring: string | null): Date {
  const start = getPeriodStart(recurring)

  switch (recurring) {
    case 'daily':
      return new Date(start.getTime() + 86_400_000 - 1)
    case 'bidaily':
      return new Date(start.getTime() + 2 * 86_400_000 - 1)
    case 'weekly':
      return new Date(start.getTime() + 7 * 86_400_000 - 1)
    case 'biweekly':
      return new Date(start.getTime() + 14 * 86_400_000 - 1)
    case 'monthly': {
      const next = new Date(start.getFullYear(), start.getMonth() + 1, 1)
      return new Date(next.getTime() - 1)
    }
    case 'bimonthly': {
      const next = new Date(start.getFullYear(), start.getMonth() + 2, 1)
      return new Date(next.getTime() - 1)
    }
    case 'anytime':
      return new Date(start.getTime() + 86_400_000 - 1)
    default:
      return new Date(start.getTime() + 86_400_000 - 1)
  }
}

export function getPeriodLabel(recurring: string | null): string {
  switch (recurring) {
    case 'daily': return 'today'
    case 'bidaily': return 'this 2-day period'
    case 'weekly': return 'this week'
    case 'biweekly': return 'these 2 weeks'
    case 'monthly': return 'this month'
    case 'bimonthly': return 'these 2 months'
    case 'anytime': return ''
    default: return 'today'
  }
}

// How many days until the next period starts
export function daysUntilNextPeriod(recurring: string | null): number {
  const end = getPeriodEnd(recurring)
  const now = new Date()
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000))
}
