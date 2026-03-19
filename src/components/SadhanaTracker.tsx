import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useUser } from '../hooks/useUser'
import { getJapaMultiplier, getJapaTimeLabel } from '../lib/xp'
import { playComplete } from '../lib/sounds'
import { fireBigConfetti } from './Confetti'
import type { SadhanaLog } from '../types'

const JAPA_BASE_XP = 20 // Base for 16 rounds — low because it's already a habit
const JAPA_EXTRA_ROUND_XP = 15 // Each round beyond 16
const BASE_XP = {
  reading: 3,
  arti_puja: 30,
  flower_offering: 20,
  offering_plate: 20,
  class: 3,
}

export function SadhanaTracker({ onXpEarned }: { onXpEarned: (amount: number) => void }) {
  const { currentUser, refreshUser } = useUser()
  const [log, setLog] = useState<SadhanaLog | null>(null)
  const [readingInput, setReadingInput] = useState('')
  const [classInput, setClassInput] = useState('')
  const [extraRoundsInput, setExtraRoundsInput] = useState('')

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

  // Complete 16 rounds
  const completeJapa = useCallback(async () => {
    const now = new Date()
    const multiplier = getJapaMultiplier(now)
    const xp = Math.round(JAPA_BASE_XP * multiplier * (currentUser?.current_streak || 1))
    await upsertLog({
      japa_rounds: 16,
      japa_completed_at: now.toISOString(),
    }, xp)
    fireBigConfetti()
  }, [currentUser, upsertLog])

  // Log extra rounds beyond 16
  const logExtraRounds = useCallback(async () => {
    const extra = parseInt(extraRoundsInput) || 0
    if (extra <= 0) return
    const now = new Date()
    const multiplier = getJapaMultiplier(now)
    const currentRounds = log?.japa_rounds || 16
    const xp = Math.round(extra * JAPA_EXTRA_ROUND_XP * multiplier)
    await upsertLog({
      japa_rounds: currentRounds + extra,
      japa_completed_at: now.toISOString(),
    }, xp)
    setExtraRoundsInput('')
  }, [extraRoundsInput, log, upsertLog])

  const toggleBoolean = useCallback(async (field: 'arti_puja' | 'flower_offering' | 'offering_plate') => {
    const current = log?.[field] || false
    const xpMap = { arti_puja: BASE_XP.arti_puja, flower_offering: BASE_XP.flower_offering, offering_plate: BASE_XP.offering_plate }
    await upsertLog({ [field]: !current }, current ? 0 : xpMap[field])
  }, [log, upsertLog])

  const logReading = useCallback(async () => {
    const mins = parseInt(readingInput) || 0
    if (mins <= 0) return
    const totalMins = (log?.reading_minutes || 0) + mins
    await upsertLog({ reading_minutes: totalMins }, mins * BASE_XP.reading)
    setReadingInput('')
  }, [readingInput, log, upsertLog])

  const logClass = useCallback(async () => {
    const mins = parseInt(classInput) || 0
    if (mins <= 0) return
    const totalMins = (log?.class_minutes || 0) + mins
    await upsertLog({ class_minutes: totalMins }, mins * BASE_XP.class)
    setClassInput('')
  }, [classInput, log, upsertLog])

  const now = new Date()
  const currentHour = now.getHours() + now.getMinutes() / 60
  const japaTime = getJapaTimeLabel(currentHour)
  const japaDone = (log?.japa_rounds || 0) >= 16
  const japaRounds = log?.japa_rounds || 0

  return (
    <div className="space-y-3">
      <h2 className="text-sadhana font-bold text-lg flex items-center gap-2">
        🙏 Sadhana
        {log && <span className="text-xs text-text-dim font-normal">Today: +{log.xp_earned} XP</span>}
      </h2>

      {/* Japa — 16 rounds, one button */}
      <div className={`bg-bg-card border rounded-xl p-4 ${japaDone ? 'border-success/30 bg-success/5' : 'border-sadhana/20'}`}>
        <div className="text-center">
          <div className="font-medium mb-1">Japa — 16 Rounds</div>

          {!japaDone ? (
            <>
              {/* Time bonus indicator */}
              <div className="mb-3">
                <span className={`text-sm font-bold ${japaTime.color}`}>{japaTime.label}</span>
                <div className="text-text-dim text-xs mt-1">Earlier = exponentially more XP</div>
              </div>

              {/* Time bonus tiers */}
              <div className="flex justify-center gap-1 mb-4 text-xs">
                {[
                  { label: '<5am', mult: '5x', active: currentHour < 5 },
                  { label: '<6am', mult: '3.5x', active: currentHour < 6 },
                  { label: '<7am', mult: '2.5x', active: currentHour < 7 },
                  { label: '<8am', mult: '1.5x', active: currentHour < 8 },
                  { label: '8am+', mult: '1x', active: true },
                ].map((tier, i) => (
                  <div
                    key={i}
                    className={`px-2 py-1 rounded-lg ${
                      tier.active && (i === 0 || currentHour >= [0, 5, 6, 7, 8][i])
                        ? i === 0 && currentHour < 5 ? 'bg-accent-glow/20 text-accent-glow font-bold'
                        : i === 1 && currentHour < 6 ? 'bg-accent/20 text-accent font-bold'
                        : i === 2 && currentHour < 7 ? 'bg-sadhana/20 text-sadhana font-bold'
                        : i === 3 && currentHour < 8 ? 'bg-success/20 text-success font-bold'
                        : 'bg-bg-elevated text-text-dim/50'
                        : 'bg-bg-elevated text-text-dim/30 line-through'
                    }`}
                  >
                    {tier.label} {tier.mult}
                  </div>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={completeJapa}
                className="w-full bg-gradient-to-r from-sadhana to-sadhana/70 text-white font-bold
                           py-4 rounded-xl text-lg shadow-[0_0_20px_rgba(192,132,252,0.3)]
                           active:shadow-[0_0_30px_rgba(192,132,252,0.5)] transition-shadow"
              >
                🙏 Complete 16 Rounds
              </motion.button>
            </>
          ) : (
            <>
              <div className="text-success font-bold text-lg mb-1">✅ 16 Rounds Done!</div>
              {log?.japa_completed_at && (
                <div className="text-text-dim text-sm mb-3">
                  Completed at {new Date(log.japa_completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' '}— {getJapaTimeLabel(new Date(log.japa_completed_at).getHours()).label}
                </div>
              )}
              {japaRounds > 16 && (
                <div className="text-accent font-bold mb-2">+{japaRounds - 16} extra rounds!</div>
              )}

              {/* Extra rounds */}
              <div className="flex gap-2 mt-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={extraRoundsInput}
                  onChange={e => setExtraRoundsInput(e.target.value)}
                  placeholder="Extra rounds"
                  className="flex-1 bg-bg-elevated border border-bg-elevated rounded-lg px-3 py-2 text-text
                             focus:border-sadhana/50 outline-none text-center"
                />
                <button
                  onClick={logExtraRounds}
                  className="bg-sadhana/20 text-sadhana px-4 py-2 rounded-lg font-bold
                             active:scale-95 transition-transform"
                >
                  + Extra
                </button>
              </div>
            </>
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
              {log?.reading_minutes} min (+{(log?.reading_minutes || 0) * BASE_XP.reading} XP)
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
              {log?.class_minutes} min (+{(log?.class_minutes || 0) * BASE_XP.class} XP)
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
