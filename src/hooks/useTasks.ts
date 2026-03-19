import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getPeriodStart } from '../lib/periods'
import type { Task, Completion } from '../types'
import { useUser } from './useUser'
export function useTasks() {
  const { currentUser } = useUser()
  const [tasks, setTasks] = useState<Task[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    if (!currentUser) return
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('active', true)
      .or(`assigned_to.is.null,assigned_to.eq.${currentUser.id}`)
      .order('category')
    if (data) setTasks(data)
  }, [currentUser])

  // Fetch completions from the last 60 days
  const fetchCompletions = useCallback(async () => {
    if (!currentUser) return
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString()
    const { data } = await supabase
      .from('completions')
      .select('*')
      .eq('user_id', currentUser.id)
      .gte('completed_at', sixtyDaysAgo)
    if (data) setCompletions(data)
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) return
    setLoading(true)
    Promise.all([fetchTasks(), fetchCompletions()]).then(() => setLoading(false))
  }, [currentUser, fetchTasks, fetchCompletions])

  useEffect(() => {
    if (!currentUser) return
    const channel = supabase
      .channel('completions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, () => {
        fetchCompletions()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [currentUser, fetchCompletions])

  // Check if a task has been completed within its current period
  // Uses the selected date context to determine the period
  const isCompletedThisPeriod = useCallback((task: Task) => {
    const periodStart = getPeriodStart(task.recurring)
    return completions.some(c =>
      c.task_id === task.id &&
      new Date(c.completed_at) >= periodStart
    )
  }, [completions])

  const isCompleted = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return false
    return isCompletedThisPeriod(task)
  }, [tasks, isCompletedThisPeriod])

  const getLastCompletion = useCallback((taskId: string): Date | null => {
    const taskCompletions = completions
      .filter(c => c.task_id === taskId)
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    return taskCompletions.length > 0 ? new Date(taskCompletions[0].completed_at) : null
  }, [completions])

  const getTasksByCategory = (category: string) => {
    return tasks.filter(t => t.category === category)
  }

  const getUncompletedTasks = useCallback(() => {
    return tasks.filter(t => !isCompletedThisPeriod(t))
  }, [tasks, isCompletedThisPeriod])

  return {
    tasks,
    completions,
    loading,
    isCompleted,
    isCompletedThisPeriod,
    getLastCompletion,
    getTasksByCategory,
    getUncompletedTasks,
    refetch: () => Promise.all([fetchTasks(), fetchCompletions()]),
  }
}
