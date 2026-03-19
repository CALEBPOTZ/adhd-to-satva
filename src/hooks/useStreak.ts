import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from './useUser'

export function useStreak() {
  const { currentUser, refreshUser } = useUser()

  const updateStreak = useCallback(async () => {
    if (!currentUser) return

    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    let newStreak = currentUser.current_streak
    if (currentUser.last_active_date === today) {
      // Already updated today
      return
    } else if (currentUser.last_active_date === yesterday) {
      newStreak = currentUser.current_streak + 1
    } else {
      newStreak = 1
    }

    const longestStreak = Math.max(newStreak, currentUser.longest_streak)

    await supabase
      .from('users')
      .update({
        current_streak: newStreak,
        longest_streak: longestStreak,
        last_active_date: today,
      })
      .eq('id', currentUser.id)

    await refreshUser()
  }, [currentUser, refreshUser])

  return { updateStreak }
}
