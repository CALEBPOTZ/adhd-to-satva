import { useEffect } from 'react'
import confetti from 'canvas-confetti'

export function fireConfetti() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.7 },
    colors: ['#f59e0b', '#22d3ee', '#c084fc', '#34d399', '#f97316'],
  })
}

export function fireBigConfetti() {
  const duration = 800
  const end = Date.now() + duration
  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#f59e0b', '#22d3ee', '#c084fc'],
    })
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#34d399', '#f97316', '#f472b6'],
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

// Component version for auto-fire
export function ConfettiExplosion({ trigger }: { trigger: number }) {
  useEffect(() => {
    if (trigger > 0) fireConfetti()
  }, [trigger])
  return null
}
