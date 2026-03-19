import { createContext, useContext } from 'react'

export const COMBO_WINDOW = 120_000 // 2 minutes to keep combo alive

export interface ComboState {
  combo: number
  lastCompletionTime: number | null
  registerCompletion: () => number // returns the combo multiplier for this completion
}

export const ComboContext = createContext<ComboState>({
  combo: 0,
  lastCompletionTime: null,
  registerCompletion: () => 1,
})

export function useCombo() {
  return useContext(ComboContext)
}

export function getComboMultiplier(combo: number): number {
  if (combo < 2) return 1
  if (combo < 3) return 1.25
  if (combo < 5) return 1.5
  if (combo < 8) return 2
  return 2.5
}

export function getComboLabel(combo: number): string {
  if (combo >= 10) return 'GODLIKE'
  if (combo >= 8) return 'RAMPAGE'
  if (combo >= 5) return 'UNSTOPPABLE'
  if (combo >= 3) return 'ON FIRE'
  if (combo >= 2) return 'NICE'
  return ''
}

export function shouldResetCombo(lastTime: number | null): boolean {
  if (!lastTime) return true
  return Date.now() - lastTime > COMBO_WINDOW
}
