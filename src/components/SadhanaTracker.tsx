import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useUser } from '../hooks/useUser'
import { getJapaMultiplier, calculateXp } from '../lib/xp'
import { playComplete } from '../lib/sounds'
import { fireConfetti } from './Confetti'
import type { SadhanaLog } from '../types'

const JAPA_GOAL = 16
const BASE_XP = {
  japa: 50,       // per round
  reading: 3,     // per minute
  arti_puja: 30,
  flower_offering: 20,
  offering_plate: 20,
  class: 3,       // per minute
}

export function SadhanaTracker({ onXpEarned }: { onXpEarned: (amount: number) => void }) {
  const { currentUser, refreshUser } = useUser()
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
      .maybeSingle()
    setLog(data || null)
  }, [currentUser, today])

  useEffect(() => { fetchLog() }, [fetchLog])

  const upsertLog = useCallback(async (updates: Partial<SadhanaLog>, xpAmount: number) => {
    if (!currentUser) return

    // Build the upsert payload — exclude `id` so Supabase can handle it
    const payload: Record<string, unknown> = {
      user_id: currentUser.id,
      date: today,
      japa_completed_at: log?.japa_completed_at || null,
      japa_rounds: log?.japa_rounds || 0,
      reading_minutes: log?.reading_minutes || 0,
      arti_puja: log?.arti_puja || false,
      flower_offering: log?.flower_offering || false,
      offering_plate: log?.offering_plate || false,
      class_minutes: log?.class_minutes || 0,
      xp_earned: (log?.xp_earned || 0) + xpAmount,
      ...updates,
    }

    const { data, error } = await supabase
      .from('sadhana_log')
      .upsert(payload, { onConflict: 'user_id,date' })
      .select()
      .single()

    if (error) {
      console.error('Sadhana upsert error:', error)
      return
    }
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
      await refreshUser()
    }
  }, [currentUser, log, today, onXpEarned, refreshUser])

  const logJapa = useCallback(async () => {
    const now = new Date()
    const multiplier = getJapaMultiplier(now)
    const rounds = (log?.japa_rounds || 0) + 1
    // Bonus XP for completing beyond 16
    const bonusMult = rounds > JAPA_GOAL ? 1.5 : 1
    const xp = calculateXp(BASE_XP.japa, 1, currentUser?.current_streak || 0, 1, multiplier * bonusMult)

    await upsertLog({
      japa_rounds: rounds,
      japa_completed_at: now.toISOString(),
    }, xp)

    // Celebrate hitting 16!
    if (rounds === JAPA_GOAL) {
      fireConfetti()
    }
  }, [log, currentUser, upsertLog])

  const toggleBoolean = useCallback(async (field: 'arti_puja' | 'flower_offering' | 'offering_plate') => {
    const current = log?.[field] || false
    const xpMap = { arti_puja: BASE_XP.arti_puja, flower_offering: BASE_XP.flower_offering, offering_plate: BASE_XP.offering_plate }
    const xp = current ? 0 : xpMap[field]
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
  const japaRounds = log?.japa_rounds || 0
  const japaProgress = Math.min(1, japaRounds / JAPA_GOAL)
  const japaComplete = japaRounds >= JAPA_GOAL

  return (
    <div className="space-y-3">
      <h2 className="text-sadhana font-bold text-lg flex items-center gap-2">
        🙏 Sadhana
        {log && <span className="text-xs text-text-dim font-normal">Today: +{log.xp_earned} XP</span>}
      </h2>

      {/* Japa — 16 round goal */}
      <div className={`bg-bg-card border rounded-xl p-4 ${japaComplete ? 'border-success/30 bg-success/5' : 'border-sadhana/20'}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-medium">Japa Rounds</div>
            <div className="text-text-dim text-sm">
              <span className={japaComplete ? 'text-success font-bold' : 'text-sadhana font-bold'}>
                {japaRounds}
              </span>
              <span> / {JAPA_GOAL} rounds</span>
              {japaRounds > JAPA_GOAL && (
                <span className="text-accent ml-1 font-bold">+{japaRounds - JAPA_GOAL} bonus!</span>
              )}
            </div>
            <div className="text-xs text-sadhana mt-0.5">
              {japaBonus} time bonus active now
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={logJapa}
            className={`font-bold w-14 h-14 rounded-full text-xl transition-colors
              ${japaComplete
                ? 'bg-success/20 text-success active:bg-success/40'
                : 'bg-sadhana/20 text-sadhana active:bg-sadhana/40'}`}
          >
            +1
          </motion.button>
        </div>
        {/* Progress bar to 16 */}
        <div className="h-3 bg-bg-elevated rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${japaComplete
              ? 'bg-gradient-to-r from-success to-xp'
              : 'bg-gradient-to-r from-sadhana/60 to-sadhana'}`}
            animate={{ width: `${japaProgress * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        {/* Round indicators */}
        <div className="flex gap-1 mt-2 flex-wrap">
          {Array.from({ length: JAPA_GOAL }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full text-[8px] flex items-center justify-center font-bold
                ${i < japaRounds
                  ? 'bg-sadhana text-bg'
                  : 'bg-bg-elevated text-text-dim/40'}`}
            >
              {i + 1}
            </div>
          ))}
          {japaRounds > JAPA_GOAL && (
            <div className="w-4 h-4 rounded-full bg-accent text-bg text-[8px] flex items-center justify-center font-bold">
              +{japaRounds - JAPA_GOAL}
            </div>
          )}
        </div>
      </div>

      {/* Toggle items */}
      {[
        { field: 'arti_puja' as const, label: 'Arti / Puja', icon: '🪔', xp: BASE_XP.arti_puja },
        { field: 'flower_offering' as const, label: 'Pick & Offer Flowers', icon: '🌸', xp: BASE_XP.flower_offering },
        { field: 'offering_plate' as const, label: 'Make Offering Plate', icon: '🍽️', xp: BASE_XP.offering_plate },
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
          <span className="ml-auto text-xs text-xp font-mono">+{item.xp} XP</span>
        </motion.button>
      ))}

      {/* Reading */}
      <div className="bg-bg-card border border-sadhana/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">📖 Reading</div>
          {(log?.reading_minutes || 0) > 0 && (
            <span className="text-xs text-success font-mono bg-success/10 px-2 py-0.5 rounded-full">
              {log?.reading_minutes} min today (+{(log?.reading_minutes || 0) * BASE_XP.reading} XP)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={readingInput}
            onChange={e => setReadingInput(e.target.value)}
            placeholder="Minutes read"
            className="flex-1 bg-bg-elevated border border-bg-elevated rounded-lg px-3 py-2 text-text
                       focus:border-sadhana/50 outline-none text-center text-lg"
          />
          <button
            onClick={logReading}
            className="bg-sadhana/20 text-sadhana px-5 py-2 rounded-lg font-bold
                       active:scale-95 transition-transform"
          >
            + Log
          </button>
        </div>
      </div>

      {/* Class */}
      <div className="bg-bg-card border border-sadhana/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">🎧 Listen to Class</div>
          {(log?.class_minutes || 0) > 0 && (
            <span className="text-xs text-success font-mono bg-success/10 px-2 py-0.5 rounded-full">
              {log?.class_minutes} min today (+{(log?.class_minutes || 0) * BASE_XP.class} XP)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={classInput}
            onChange={e => setClassInput(e.target.value)}
            placeholder="Minutes listened"
            className="flex-1 bg-bg-elevated border border-bg-elevated rounded-lg px-3 py-2 text-text
                       focus:border-sadhana/50 outline-none text-center text-lg"
          />
          <button
            onClick={logClass}
            className="bg-sadhana/20 text-sadhana px-5 py-2 rounded-lg font-bold
                       active:scale-95 transition-transform"
          >
            + Log
          </button>
        </div>
      </div>
    </div>
  )
}
