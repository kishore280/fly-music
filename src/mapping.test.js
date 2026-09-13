import { describe, it, expect } from 'vitest';
import { mapAudioToStimulus } from './mapping.js';

describe('mapAudioToStimulus', () => {
  it('passes through band levels unchanged with no onset', () => {
    const s = mapAudioToStimulus({ low: 0.2, mid: 0.5, high: 0.1, onset: 0 });
    expect(s.low).toBeCloseTo(0.2);
    expect(s.mid).toBeCloseTo(0.5);
    expect(s.high).toBeCloseTo(0.1);
  });

  it('boosts mid fully and low/high by half on an onset', () => {
    const s = mapAudioToStimulus({ low: 0, mid: 0, high: 0, onset: 1 });
    expect(s.mid).toBeCloseTo(0.6);
    expect(s.low).toBeCloseTo(0.3);
    expect(s.high).toBeCloseTo(0.3);
  });

  it('clamps to 1 when band + onset boost exceeds it', () => {
    const s = mapAudioToStimulus({ low: 0.9, mid: 0.9, high: 0.9, onset: 1 });
    expect(s.low).toBeLessThanOrEqual(1);
    expect(s.mid).toBeLessThanOrEqual(1);
    expect(s.high).toBeLessThanOrEqual(1);
  });

  it('clamps negative input defensively', () => {
    const s = mapAudioToStimulus({ low: -0.5, mid: 0, high: 0, onset: 0 });
    expect(s.low).toBe(0);
  });

  it('reuses the same object across calls (no per-call allocation)', () => {
    const a = mapAudioToStimulus({ low: 0, mid: 0, high: 0, onset: 0 });
    const b = mapAudioToStimulus({ low: 0.1, mid: 0.1, high: 0.1, onset: 0 });
    expect(a).toBe(b);
  });
});
