export class AudioEngine {
  constructor() {
    this.context = null;
    this.analyser = null;
    this.sourceNode = null;
    this.audioEl = null;
    this.freqData = null;
    this.prevFreqData = null;

    this.features = { low: 0, mid: 0, high: 0, onset: 0 };

    this._onsetEnergyHistory = [];
    this._onsetHistoryMax = 43;
  }

  ensureContext() {
    if (this.context) return;
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.6;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.prevFreqData = new Uint8Array(this.analyser.frequencyBinCount);
  }

  loadFromFile(file) {
    this.ensureContext();
    const url = URL.createObjectURL(file);
    return this._loadUrl(url);
  }

  loadFromUrl(url) {
    this.ensureContext();
    return this._loadUrl(url);
  }

  _loadUrl(url) {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.crossOrigin = 'anonymous';
    }
    this.audioEl.src = url;
    this.sourceNode = this.context.createMediaElementSource(this.audioEl);
    this.sourceNode.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    return this.audioEl;
  }

  async play() {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    try {
      await this.audioEl.play();
    } catch (err) {
      console.error('Playback failed - user gesture may be required:', err);
      throw err;
    }
  }

  pause() {
    this.audioEl?.pause();
  }

  getFeatures() {
    const f = this.features;
    if (!this.analyser) {
      f.low = f.mid = f.high = f.onset = 0;
      return f;
    }

    this.analyser.getByteFrequencyData(this.freqData);
    const binCount = this.freqData.length;
    const nyquist = this.context.sampleRate / 2;
    const hzPerBin = nyquist / binCount;

    const lowMaxBin = Math.min(binCount, Math.round(250 / hzPerBin));
    const midMaxBin = Math.min(binCount, Math.round(2000 / hzPerBin));

    f.low = averageRange(this.freqData, 0, lowMaxBin) / 255;
    f.mid = averageRange(this.freqData, lowMaxBin, midMaxBin) / 255;
    f.high = averageRange(this.freqData, midMaxBin, binCount) / 255;

    let flux = 0;
    for (let i = 0; i < binCount; i++) {
      const delta = this.freqData[i] - this.prevFreqData[i];
      if (delta > 0) flux += delta;
    }
    this.prevFreqData.set(this.freqData);

    const history = this._onsetEnergyHistory;
    history.push(flux);
    if (history.length > this._onsetHistoryMax) history.shift();
    const avgFlux = history.reduce((a, b) => a + b, 0) / history.length;
    f.onset = flux > avgFlux * 1.5 && flux > 5 ? 1 : 0;

    return f;
  }
}

function averageRange(arr, start, end) {
  if (end <= start) return 0;
  let sum = 0;
  for (let i = start; i < end; i++) sum += arr[i];
  return sum / (end - start);
}
