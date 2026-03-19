import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useUser } from '../hooks/useUser'
import { getJapaMultiplier, getJapaTimeLabel } from '../lib/xp'
import { playComplete } from '../lib/sounds'
import { fireBigConfetti } from './Confetti'
import type { SadhanaLog } from '../types'

const JAPA_BASE_XP = 20
const JAPA_EXTRA_ROUND_XP = 15
const BASE_XP = {
  reading: 3,
  arti_puja: 30,
  flower_offering: 20,
  offering_plate: 20,
  class: 3,
}

interface Props {
  onXpEarned: (amount: number) => void
  date?: string // ISO date string, defaults to today
}

export function SadhanaTracker({ onXpEarned, date: dateProp }: Props) {
  const { currentUser, refreshUser } = useUser()
  const [log, setLog] = useState<SadhanaLog | null>(null)
  const [readingInput, setReadingInput] = useState('')
  const [classInput, setClassInput] = useState('')
  const [extraRoundsInput, setExtraRoundsInput] = useState('')

  const date = dateProp || new Date().toISOString().split('T')[0]
  const isToday = date === new Date().toISOString().split('T')[0]

  const fetchLog = useCallback(async () => {
    if (!currentUser) return
    const { data } = await supabase
      .from('sadhana_log')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('date', date)
      .maybeSingle()
    setLog(data || null)
  }, [currentUser, date])

  useEffect(() => { fetchLog() }, [fetchLog])

  const updateXp = useCallback(async (xpDelta: number) => {
    if (!currentUser || xpDelta === 0) return
    await supabase
      .from('users')
      .update({
        total_xp: Math.max(0, (currentUser.total_xp || 0) + xpDelta),
        spendable_xp: Math.max(0, (currentUser.spendable_xp || 0) + xpDelta),
      })
      .eq('id', currentUser.id)
    if (xpDelta > 0) {
      playComplete()
      onXpEarned(xpDelta)
    }
    await refreshUser()
  }, [currentUser, onXpEarned, refreshUser])

  const upsertLog = useCallback(async (updates: Partial<SadhanaLog>, xpDelta: number) => {
    if (!currentUser) return

    const payload: Record<string, unknown> = {
      user_id: currentUser.id,
      date,
      japa_completed_at: log?.japa_completed_at || null,
      japa_rounds: log?.japa_rounds || 0,
      reading_minutes: log?.reading_minutes || 0,
      arti_puja: log?.arti_puja || false,
      flower_offering: log?.flower_offering || false,
      offering_plate: log?.offering_plate || false,
      class_minutes: log?.class_minutes || 0,
      xp_earned: Math.max(0, (log?.xp_earned || 0) + xpDelta),
      ...updates,
    }

    const { data, error } = await supabase
      .from('sadhana_log')
      .upsert(payload, { onConflict: 'user_id,date' })
      .select()
      .single()

    if (error) { console.error('Sadhana upsert error:', error); return }
    if (data) setLog(data)
    await updateXp(xpDelta)
  }, [currentUser, log, date, updateXp])

  // === JAPA ===
  const completeJapa = useCallback(async () => {
    const now = new Date()
    const multiplier = getJapaMultiplier(now)
    const xp = Math.round(JAPA_BASE_XP * multiplier * Math.max(1, currentUser?.current_streak || 1))
    await upsertLog({ japa_rounds: 16, japa_completed_at: now.toISOString() }, xp)
    fireBigConfetti()
  }, [currentUser, upsertLog])

  const undoJapa = useCallback(async () => {
    if (!log || log.japa_rounds === 0) return
    // Reverse all japa XP earned today
    const japaXpToRemove = log.japa_completed_at
      ? Math.round(JAPA_BASE_XP * getJapaMultiplier(new Date(log.japa_completed_at)) * Math.max(1, currentUser?.current_streak || 1))
      : JAPA_BASE_XP
    const extraXp = Math.max(0, log.japa_rounds - 16) * JAPA_EXTRA_ROUND_XP
    await upsertLog({ japa_rounds: 0, japa_completed_at: null }, -(japaXpToRemove + extraXp))
  }, [log, currentUser, upsertLog])

  const logExtraRounds = useCallback(async () => {
    const extra = parseInt(extraRoundsInput) || 0
    if (extra <= 0) return
    const now = new Date()
    const multiplier = getJapaMultiplier(now)
    const xp = Math.round(extra * JAPA_EXTRA_ROUND_XP * multiplier)
    await upsertLog({ japa_rounds: (log?.japa_rounds || 16) + extra, japa_completed_at: now.toISOString() }, xp)
    setExtraRoundsInput('')
  }, [extraRoundsInput, log, upsertLog])

  // === TOGGLES ===
  const toggleBoolean = useCallback(async (field: 'arti_puja' | 'flower_offering' | 'offering_plate') => {
    const current = log?.[field] || false
    const xpMap = { arti_puja: BASE_XP.arti_puja, flower_offering: BASE_XP.flower_offering, offering_plate: BASE_XP.offering_plate }
    const xp = current ? -xpMap[field] : xpMap[field]
    await upsertLog({ [field]: !current }, xp)
  }, [log, upsertLog])

  // === READING & CLASS ===
  const logReading = useCallback(async () => {
    const mins = parseInt(readingInput) || 0
    if (mins <= 0) return
    await upsertLog({ reading_minutes: (log?.reading_minutes || 0) + mins }, mins * BASE_XP.reading)
    setReadingInput('')
  }, [readingInput, log, upsertLog])

  const undoReading = useCallback(async () => {
    if (!log || !log.reading_minutes) return
    const xpToRemove = log.reading_minutes * BASE_XP.reading
    await upsertLog({ reading_minutes: 0 }, -xpToRemove)
  }, [log, upsertLog])

  const logClass = useCallback(async () => {
    const mins = parseInt(classInput) || 0
    if (mins <= 0) return
    await upsertLog({ class_minutes: (log?.class_minutes || 0) + mins }, mins * BASE_XP.class)
    setClassInput('')
  }, [classInput, log, upsertLog])

  const undoClass = useCallback(async () => {
    if (!log || !log.class_minutes) return
    const xpToRemove = log.class_minutes * BASE_XP.class
    await upsertLog({ class_minutes: 0 }, -xpToRemove)
  }, [log, upsertLog])

  const now = new Date()
  const currentHour = now.getHours() + now.getMinutes() / 60
  const japaTime = getJapaTimeLabel(currentHour)
  const japaDone = (log?.japa_rounds || 0) >= 16
  const japaRounds = log?.japa_rounds || 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sadhana font-bold text-lg">
          🙏 Sadhana {!isToday && <span className="text-xs text-text-dim font-normal">({date})</span>}
        </h2>
        {log && <span className="text-xs text-text-dim">+{log.xp_earned} XP</span>}
      </div>

      {/* Japa */}
      <div className={`bg-bg-card border rounded-xl p-4 ${japaDone ? 'border-success/30 bg-success/5' : 'border-sadhana/20'}`}>
        <div className="text-center">
          <div className="font-medium mb-1">Japa — 16 Rounds</div>

          {!japaDone ? (
            <>
              {isToday && (
                <div className="mb-3">
                  <span className={`text-sm font-bold ${japaTime.color}`}>{japaTime.label}</span>
                  <div className="text-text-dim text-xs mt-1">Earlier = exponentially more XP</div>
                </div>
              )}

              {isToday && (
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
              )}

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
                <div className="text-text-dim text-sm mb-2">
                  at {new Date(log.japa_completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' '}— {getJapaTimeLabel(new Date(log.japa_completed_at).getHours()).label}
                </div>
              )}
              {japaRounds > 16 && (
                <div className="text-accent font-bold mb-2">+{japaRounds - 16} extra rounds!</div>
              )}

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

              <button
                onClick={undoJapa}
                className="mt-2 text-red-400/60 text-xs w-full active:text-red-400"
              >
                ↩ Undo japa
              </button>
            </>
          )}
        </div>
      </div>

      {/* Toggle items — tap to toggle (acts as undo too) */}
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
          <span className="ml-auto text-xs text-xp font-mono">
            {log?.[item.field] ? `✓ ${item.xp}` : `+${item.xp}`} XP
          </span>
        </motion.button>
      ))}

      {/* Reading */}
      <div className="bg-bg-card border border-sadhana/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">📖 Reading</div>
          {(log?.reading_minutes || 0) > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-success font-mono bg-success/10 px-2 py-0.5 rounded-full">
                {log?.reading_minutes} min (+{(log?.reading_minutes || 0) * BASE_XP.reading} XP)
              </span>
              <button onClick={undoReading} className="text-red-400/50 text-xs active:text-red-400">↩</button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <input type="number" inputMode="numeric" value={readingInput}
            onChange={e => setReadingInput(e.target.value)} placeholder="Minutes"
            className="flex-1 bg-bg-elevated border border-bg-elevated rounded-lg px-3 py-2 text-text
                       focus:border-sadhana/50 outline-none text-center text-lg" />
          <button onClick={logReading}
            className="bg-sadhana/20 text-sadhana px-5 py-2 rounded-lg font-bold active:scale-95 transition-transform">
            + Log
          </button>
        </div>
      </div>

      {/* Class */}
      <div className="bg-bg-card border border-sadhana/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">🎧 Listen to Class</div>
          {(log?.class_minutes || 0) > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-success font-mono bg-success/10 px-2 py-0.5 rounded-full">
                {log?.class_minutes} min (+{(log?.class_minutes || 0) * BASE_XP.class} XP)
              </span>
              <button onClick={undoClass} className="text-red-400/50 text-xs active:text-red-400">↩</button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <input type="number" inputMode="numeric" value={classInput}
            onChange={e => setClassInput(e.target.value)} placeholder="Minutes"
            className="flex-1 bg-bg-elevated border border-bg-elevated rounded-lg px-3 py-2 text-text
                       focus:border-sadhana/50 outline-none text-center text-lg" />
          <button onClick={logClass}
            className="bg-sadhana/20 text-sadhana px-5 py-2 rounded-lg font-bold active:scale-95 transition-transform">
            + Log
          </button>
        </div>
      </div>
    </div>
  )
}
