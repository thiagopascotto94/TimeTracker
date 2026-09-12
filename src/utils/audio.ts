/**
 * Pleasant Web Audio synthesizer chime for goal alert
 * Does not require external audio files
 */
export function playGoalChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Two-tone chime (523.25 Hz C5 -> 659.25 Hz E5 -> 783.99 Hz G5)
    playTone(523.25, now, 0.4);
    playTone(659.25, now + 0.15, 0.4);
    playTone(783.99, now + 0.3, 0.6);
  } catch (e) {
    console.warn('Audio chime playback was blocked or unsupported:', e);
  }
}
