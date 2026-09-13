import { SIM_LEAK, SIM_BG, SIM_GAIN, SIM_THRESHOLD, SIM_NOISE_SIGMA, INJECTION_CURRENT_GAIN, FIXED_SIM_DT, MAX_SIM_STEPS_PER_FRAME, DOPAMINE_EMA_SECONDS } from './constants.js';

export class Simulation {
  constructor(data, config = {}) {
    this.data = data;
    this.config = {
      leak: config.leak ?? SIM_LEAK,
      bg: config.bg ?? SIM_BG,
      gain: config.gain ?? SIM_GAIN,
      threshold: config.threshold ?? SIM_THRESHOLD,
      noiseSigma: config.noiseSigma ?? SIM_NOISE_SIGMA,
      injectionCurrentGain: config.injectionCurrentGain ?? INJECTION_CURRENT_GAIN,
      fixedDt: config.fixedDt ?? FIXED_SIM_DT,
      maxStepsPerFrame: config.maxStepsPerFrame ?? MAX_SIM_STEPS_PER_FRAME,
      dopamineEmaSeconds: config.dopamineEmaSeconds ?? DOPAMINE_EMA_SECONDS,
    };

    const n = data.neuronCount;
    this.v = new Float32Array(n);
    this.spikes = new Uint8Array(n);
    this.nextSpikes = new Uint8Array(n);
    this.dopamineAggregate = 0;
    this._accumulator = 0;

    this._normWeight = this._buildNormalizedWeights();
    this._dopamineIndices = data.dopamineIndices;

    this._spareGaussian = null;
  }

  _buildNormalizedWeights() {
    const { source, target, weight } = this.data.edges;
    const n = this.data.neuronCount;
    const inWeightSum = new Float32Array(n);
    for (let e = 0; e < target.length; e++) {
      inWeightSum[target[e]] += weight[e];
    }
    const normWeight = new Float32Array(weight.length);
    for (let e = 0; e < weight.length; e++) {
      const denom = inWeightSum[target[e]];
      normWeight[e] = denom > 0 ? weight[e] / denom : 0;
    }
    return normWeight;
  }

  _gaussian() {
    if (this._spareGaussian !== null) {
      const v = this._spareGaussian;
      this._spareGaussian = null;
      return v;
    }
    let u1 = 0;
    let u2 = 0;
    while (u1 === 0) u1 = Math.random();
    u2 = Math.random();
    const mag = Math.sqrt(-2 * Math.log(u1));
    this._spareGaussian = mag * Math.sin(2 * Math.PI * u2);
    return mag * Math.cos(2 * Math.PI * u2);
  }

  _injectionCurrent(features, out) {
    out.fill(0);
    const { joInjectionSites } = this.data;
    const { injectionCurrentGain } = this.config;
    const bands = ['low', 'mid', 'high'];
    for (const band of bands) {
      const value = features[band] * injectionCurrentGain;
      if (value <= 0) continue;
      const indices = joInjectionSites[band];
      for (let k = 0; k < indices.length; k++) {
        out[indices[k]] = value;
      }
    }
  }

  tick(dtSeconds, features) {
    const { fixedDt, maxStepsPerFrame } = this.config;
    if (!this._injectionBuf) this._injectionBuf = new Float32Array(this.data.neuronCount);
    this._accumulator += dtSeconds;
    let steps = 0;
    while (this._accumulator >= fixedDt && steps < maxStepsPerFrame) {
      this._injectionCurrent(features, this._injectionBuf);
      this.step(this._injectionBuf);
      this._accumulator -= fixedDt;
      steps++;
    }
    if (steps === maxStepsPerFrame) {
      this._accumulator = 0;
    }
  }

  step(injectionCurrent) {
    const { v, spikes, nextSpikes, _normWeight, _dopamineIndices } = this;
    const { source, target } = this.data.edges;
    const { leak, bg, gain, threshold, noiseSigma, dopamineEmaSeconds, fixedDt } = this.config;
    const n = v.length;

    for (let i = 0; i < n; i++) {
      v[i] = v[i] * leak + bg + this._gaussian() * noiseSigma + injectionCurrent[i];
    }

    for (let e = 0; e < source.length; e++) {
      if (spikes[source[e]]) {
        v[target[e]] += gain * _normWeight[e];
      }
    }

    let dopamineSpikeCount = 0;
    for (let i = 0; i < n; i++) {
      if (v[i] > 4) v[i] = 4;
      const spiked = v[i] >= threshold;
      nextSpikes[i] = spiked ? 1 : 0;
      if (spiked) v[i] = 0;
    }
    for (let k = 0; k < _dopamineIndices.length; k++) {
      if (nextSpikes[_dopamineIndices[k]]) dopamineSpikeCount++;
    }

    this.spikes.set(nextSpikes);

    const dopamineSpikeFraction = _dopamineIndices.length > 0 ? dopamineSpikeCount / _dopamineIndices.length : 0;
    const emaAlpha = 1 - Math.exp(-fixedDt / dopamineEmaSeconds);
    this.dopamineAggregate += (dopamineSpikeFraction - this.dopamineAggregate) * emaAlpha;
  }
}
