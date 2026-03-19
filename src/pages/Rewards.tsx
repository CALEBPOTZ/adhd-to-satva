import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useUser } from '../hooks/useUser'
import { playLevelUp } from '../lib/sounds'
import { fireBigConfetti } from '../components/Confetti'
import type { Reward, Redemption } from '../types'

export function Rewards() {
  const { currentUser, refreshUser } = useUser()
  const [rewards, setRewards] = useState<Reward[]>([])
  const [recentRedemptions, setRecentRedemptions] = useState<(Redemption & { rewards: { name: string; icon: string } })[]>([])
  const [justRedeemed, setJustRedeemed] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('rewards').select('*').eq('active', true).order('cost').then(({ data, error }) => {
      if (data) setRewards(data)
      if (error) console.warn('Rewards table may not exist yet:', error.message)
    })
  }, [])

  useEffect(() => {
    if (!currentUser) return
    supabase
      .from('redemptions')
      .select('*, rewards(name, icon)')
      .eq('user_id', currentUser.id)
      .order('redeemed_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setRecentRedemptions(data as never)
      })
  }, [currentUser])

  const redeem = useCallback(async (reward: Reward) => {
    if (!currentUser || currentUser.spendable_xp < reward.cost) return

    await supabase.from('redemptions').insert({
      reward_id: reward.id,
      user_id: currentUser.id,
      cost: reward.cost,
    })

    await supabase
      .from('users')
      .update({ spendable_xp: currentUser.spendable_xp - reward.cost })
      .eq('id', currentUser.id)

    setJustRedeemed(reward.id)
    playLevelUp()
    fireBigConfetti()

    setTimeout(() => setJustRedeemed(null), 2000)

    await refreshUser()

    // Refresh redemptions
    const { data } = await supabase
      .from('redemptions')
      .select('*, rewards(name, icon)')
      .eq('user_id', currentUser.id)
      .order('redeemed_at', { ascending: false })
      .limit(10)
    if (data) setRecentRedemptions(data as never)
  }, [currentUser, refreshUser])

  if (!currentUser) return null

  if (rewards.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">🎁 Reward Shop</h1>
        <div className="bg-bg-card rounded-2xl p-6 border border-bg-elevated text-center">
          <div className="text-4xl mb-3">🏗️</div>
          <div className="font-bold mb-2">Shop not set up yet</div>
          <div className="text-text-dim text-sm">
            Run the rewards SQL script in Supabase to unlock the shop!
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">🎁 Reward Shop</h1>

      {/* Wallet */}
      <div className="bg-bg-card rounded-2xl p-5 border border-accent/30 text-center">
        <div className="text-text-dim text-sm">Your Balance</div>
        <div className="text-4xl font-bold text-accent mt-1">
          {currentUser.spendable_xp.toLocaleString()}
          <span className="text-lg text-accent-glow ml-1">XP</span>
        </div>
      </div>

      {/* Rewards grid */}
      <div className="grid grid-cols-2 gap-3">
        {rewards.map(reward => {
          const canAfford = currentUser.spendable_xp >= reward.cost
          return (
            <motion.button
              key={reward.id}
              whileTap={canAfford ? { scale: 0.95 } : {}}
              onClick={() => canAfford && redeem(reward)}
              disabled={!canAfford}
              className={`relative rounded-2xl p-4 border text-center transition-all
                ${canAfford
                  ? 'bg-bg-card border-accent/30 active:bg-bg-elevated'
                  : 'bg-bg-card/50 border-bg-elevated opacity-50'}`}
            >
              <AnimatePresence>
                {justRedeemed === reward.id && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center z-10"
                  >
                    <span className="text-4xl">✨</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="text-3xl mb-2">{reward.icon}</div>
              <div className="font-medium text-sm">{reward.name}</div>
              {reward.description && (
                <div className="text-text-dim text-xs mt-1">{reward.description}</div>
              )}
              <div className={`mt-2 font-bold text-sm ${canAfford ? 'text-accent' : 'text-text-dim'}`}>
                {reward.cost} XP
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Recent redemptions */}
      {recentRedemptions.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-2">Recent Rewards</h2>
          <div className="space-y-2">
            {recentRedemptions.map(r => (
              <div key={r.id} className="bg-bg-card rounded-xl p-3 border border-bg-elevated flex items-center gap-3">
                <span className="text-xl">{(r as unknown as { rewards: { icon: string } }).rewards?.icon}</span>
                <div className="flex-1">
                  <div className="text-sm">{(r as unknown as { rewards: { name: string } }).rewards?.name}</div>
                  <div className="text-text-dim text-xs">
                    {new Date(r.redeemed_at).toLocaleDateString()}
                  </div>
                </div>
                <span className="text-accent text-sm font-mono">-{r.cost} XP</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
