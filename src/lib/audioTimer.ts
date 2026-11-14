// Lightweight synthesized beep using Web Audio API for workout rest timers
let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioContextClass) {
        audioCtx = new AudioContextClass()
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      void audioCtx.resume()
    }
    return audioCtx
  } catch {
    return null
  }
}

export function playTimerCompletionSound(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime

    // Triple pleasant chime (high tones: 587Hz D5, 880Hz A5, 1174Hz D6)
    const tones = [
      { freq: 587.33, start: 0, duration: 0.12 },
      { freq: 880, start: 0.14, duration: 0.12 },
      { freq: 1174.66, start: 0.28, duration: 0.25 },
    ]

    for (const tone of tones) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(tone.freq, now + tone.start)

      gain.gain.setValueAtTime(0.001, now + tone.start)
      gain.gain.exponentialRampToValueAtTime(0.3, now + tone.start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + tone.start + tone.duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + tone.start)
      osc.stop(now + tone.start + tone.duration + 0.05)
    }

    // Trigger mobile vibration if available
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([150, 80, 150, 80, 250])
    }
  } catch {
    // Audio playback error or blocked by browser policy
  }
}
