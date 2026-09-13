const ONSET_PULSE_GAIN = 0.6;

const stimulus = { low: 0, mid: 0, high: 0 };

export function mapAudioToStimulus(features) {
  const onsetBoost = features.onset ? ONSET_PULSE_GAIN : 0;
  stimulus.low = clamp01(features.low + onsetBoost * 0.5);
  stimulus.mid = clamp01(features.mid + onsetBoost);
  stimulus.high = clamp01(features.high + onsetBoost * 0.5);
  return stimulus;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
