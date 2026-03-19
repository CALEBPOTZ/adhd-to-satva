// Sound effects using Web Audio API (no external files needed)
const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.type = type
  osc.frequency.value = frequency
  gain.gain.value = volume
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration)
  osc.start()
  osc.stop(audioCtx.currentTime + duration)
}

export function playComplete() {
  playTone(523, 0.1, 'sine', 0.4) // C5
  setTimeout(() => playTone(659, 0.1, 'sine', 0.4), 80) // E5
  setTimeout(() => playTone(784, 0.15, 'sine', 0.4), 160) // G5
}

export function playXp() {
  playTone(880, 0.08, 'sine', 0.2) // A5
  setTimeout(() => playTone(1047, 0.08, 'sine', 0.2), 60) // C6
}

export function playLevelUp() {
  const notes = [523, 659, 784, 1047, 1319, 1568]
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.2, 'sine', 0.3), i * 100)
  })
}

export function playCombo() {
  playTone(440, 0.05, 'square', 0.15)
  setTimeout(() => playTone(660, 0.05, 'square', 0.15), 40)
}

export function playTimerTick() {
  playTone(1000, 0.03, 'sine', 0.1)
}

export function playTimerDone() {
  playTone(784, 0.15, 'triangle', 0.4)
  setTimeout(() => playTone(784, 0.15, 'triangle', 0.4), 200)
  setTimeout(() => playTone(1047, 0.3, 'triangle', 0.4), 400)
}

export function playJustStart() {
  playTone(330, 0.1, 'sawtooth', 0.2)
  setTimeout(() => playTone(440, 0.1, 'sawtooth', 0.2), 100)
  setTimeout(() => playTone(660, 0.15, 'sawtooth', 0.3), 200)
}
