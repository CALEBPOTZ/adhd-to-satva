import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useUser } from '../hooks/useUser'
import { getJapaMultiplier, calculateXp } from '../lib/xp'
import { playComplete } from '../lib/sounds'
import type { SadhanaLog } from '../types'

const BASE_XP = {
  japa: 50,
  reading: 2, // per minute
  arti_puja: 30,
  flower_offering: 20,
  offering_plate: 20,
  class: 2, // per minute
}

export function SadhanaTracker({ onXpEarned }: { onXpEarned: (amount: number) => void }) {
  const { currentUser } = useUser()
  const [log, setLog] = useState<SadhanaLog | null>(null)
  const [readingInput, setReadingInput] = useState('')
  const [classInput, setClassInput] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const fetchLog = useCallback(async () => {
    if (!currentUser) return
    const { data } = await supabase
      .from('sadhana_log')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('date', today)
      .single()
    if (data) setLog(data)
  }, [currentUser, today])

  useEffect(() => { fetchLog() }, [fetchLog])

  const upsertLog = useCallback(async (updates: Partial<SadhanaLog>, xpAmount: number) => {
    if (!currentUser) return
    const { data } = await supabase
      .from('sadhana_log')
      .upsert({
        user_id: currentUser.id,
        date: today,
        ...log,
        ...updates,
        xp_earned: (log?.xp_earned || 0) + xpAmount,
      }, { onConflict: 'user_id,date' })
      .select()
      .single()

    if (data) setLog(data)

    // Award XP to user
    if (xpAmount > 0) {
      await supabase
        .from('users')
        .update({
          total_xp: (currentUser.total_xp || 0) + xpAmount,
          spendable_xp: (currentUser.spendable_xp || 0) + xpAmount,
        })
        .eq('id', currentUser.id)
      playComplete()
      onXpEarned(xpAmount)
    }
  }, [currentUser, log, today, onXpEarned])

  const logJapa = useCallback(async () => {
    const now = new Date()
    const multiplier = getJapaMultiplier(now)
    const rounds = (log?.japa_rounds || 0) + 1
    const xp = calculateXp(BASE_XP.japa, 1, currentUser?.current_streak || 0, 1, multiplier)
    await upsertLog({
      japa_rounds: rounds,
      japa_completed_at: now.toISOString(),
    }, xp)
  }, [log, currentUser, upsertLog])

  const toggleBoolean = useCallback(async (field: 'arti_puja' | 'flower_offering' | 'offering_plate') => {
    const current = log?.[field] || false
    const xp = current ? 0 : BASE_XP[field === 'arti_puja' ? 'arti_puja' : field === 'flower_offering' ? 'flower_offering' : 'offering_plate']
    await upsertLog({ [field]: !current }, current ? 0 : xp)
  }, [log, upsertLog])

  const logReading = useCallback(async () => {
    const mins = parseInt(readingInput) || 0
    if (mins <= 0) return
    const totalMins = (log?.reading_minutes || 0) + mins
    const xp = mins * BASE_XP.reading
    await upsertLog({ reading_minutes: totalMins }, xp)
    setReadingInput('')
  }, [readingInput, log, upsertLog])

  const logClass = useCallback(async () => {
    const mins = parseInt(classInput) || 0
    if (mins <= 0) return
    const totalMins = (log?.class_minutes || 0) + mins
    const xp = mins * BASE_XP.class
    await upsertLog({ class_minutes: totalMins }, xp)
    setClassInput('')
  }, [classInput, log, upsertLog])

  const japaHour = new Date().getHours()
  const japaBonus = japaHour < 5 ? '3x' : japaHour < 6 ? '2x' : japaHour < 7 ? '1.5x' : '1x'

  return (
    <div className="space-y-3">
      <h2 className="text-sadhana font-bold text-lg flex items-center gap-2">
        🙏 Sadhana
        {log && <span className="text-xs text-text-dim font-normal">Today: +{log.xp_earned} XP</span>}
      </h2>

      {/* Japa */}
      <div className="bg-bg-card border border-sadhana/20 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Japa Rounds</div>
            <div className="text-text-dim text-sm">
              {log?.japa_rounds || 0} rounds today
              <span className="text-sadhana ml-2">({japaBonus} bonus now!)</span>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={logJapa}
            className="bg-sadhana/20 text-sadhana font-bold w-14 h-14 rounded-full text-xl
                       active:bg-sadhana/40 transition-colors"
          >
            +1
          </motion.button>
        </div>
      </div>

      {/* Toggle items */}
      {[
        { field: 'arti_puja' as const, label: 'Arti / Puja', icon: '🪔' },
        { field: 'flower_offering' as const, label: 'Pick & Offer Flowers', icon: '🌸' },
        { field: 'offering_plate' as const, label: 'Make Offering Plate', icon: '🍽️' },
      ].map(item => (
        <motion.button
          key={item.field}
          whileTap={{ scale: 0.98 }}
          onClick={() => toggleBoolean(item.field)}
          className={`w-full bg-bg-card border rounded-xl p-4 flex items-center gap-3 text-left
            ${log?.[item.field] ? 'border-success/30 bg-success/5' : 'border-sadhana/20'}`}
        >
          <span className="text-xl">{log?.[item.field] ? '✅' : item.icon}</span>
          <span className={log?.[item.field] ? 'text-success' : ''}>{item.label}</span>
          <span className="ml-auto text-xs text-xp font-mono">
            +{BASE_XP[item.field === 'arti_puja' ? 'arti_puja' : item.field]} XP
          </span>
        </motion.button>
      ))}

      {/* Reading */}
      <div className="bg-bg-card border border-sadhana/20 rounded-xl p-4">
        <div className="font-medium mb-2">📖 Reading</div>
        <div className="text-text-dim text-sm mb-2">{log?.reading_minutes || 0} min today</div>
        <div className="flex gap-2">
          <input
            type="number"
            value={readingInput}
            onChange={e => setReadingInput(e.target.value)}
            placeholder="Minutes"
            className="flex-1 bg-bg-elevated border border-bg-elevated rounded-lg px-3 py-2 text-text
                       focus:border-sadhana/50 outline-none"
          />
          <button
            onClick={logReading}
            className="bg-sadhana/20 text-sadhana px-4 py-2 rounded-lg font-medium
                       active:scale-95 transition-transform"
          >
            Log
          </button>
        </div>
      </div>

      {/* Class */}
      <div className="bg-bg-card border border-sadhana/20 rounded-xl p-4">
        <div className="font-medium mb-2">🎧 Listen to Class</div>
        <div className="text-text-dim text-sm mb-2">{log?.class_minutes || 0} min today</div>
        <div className="flex gap-2">
          <input
            type="number"
            value={classInput}
            onChange={e => setClassInput(e.target.value)}
            placeholder="Minutes"
            className="flex-1 bg-bg-elevated border border-bg-elevated rounded-lg px-3 py-2 text-text
                       focus:border-sadhana/50 outline-none"
          />
          <button
            onClick={logClass}
            className="bg-sadhana/20 text-sadhana px-4 py-2 rounded-lg font-medium
                       active:scale-95 transition-transform"
          >
            Log
          </button>
        </div>
      </div>
    </div>
  )
}
