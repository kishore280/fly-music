import { CONNECTION_DENSITY_OPTIONS, DOPAMINE_PANEL_MAX, PRESET_TRACKS } from './constants.js';

export class UI {
  constructor(container, data, { onSearch, onToggleEdges, onDensityChange, onToggleRotate, onPlay, onPlayFile, onPlayPreset }) {
    this.data = data;
    this.callbacks = { onSearch, onToggleEdges, onDensityChange, onToggleRotate, onPlay, onPlayFile, onPlayPreset };

    this.root = document.createElement('div');
    this.root.className = 'fly-ui';
    container.appendChild(this.root);

    this._injectStyles();
    this._buildTopBar();
    this._buildStatsFooter();
    this._buildInspector();
    this._buildDopaminePanel();
  }

  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .fly-ui { position: fixed; inset: 0; pointer-events: none; font-family: system-ui, sans-serif; color: #2a2a28; }
      .fly-ui * { pointer-events: auto; }
      .fly-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
      .fly-panel-glass {
        background: rgba(255,255,255,0.65);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 7px;
      }
      .fly-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        opacity: 0.55;
      }
      .fly-topbar { position: absolute; top: 16px; left: 16px; right: 220px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      @media (max-width: 480px) {
        .fly-topbar { right: 16px; }
        .fly-footer, .fly-dopamine, .fly-inspector { font-size: 11px; padding: 8px 10px; }
        .fly-dopamine, .fly-inspector { min-width: 150px; }
      }
      .fly-btn { background: rgba(255,255,255,0.65); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(0,0,0,0.08); color: #2a2a28; padding: 8px 12px; border-radius: 7px; font-size: 13px; cursor: pointer; }
      .fly-btn.active { background: #ff5a36; color: white; border-color: #ff5a36; }
      .fly-select { background: rgba(255,255,255,0.65); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(0,0,0,0.08); color: #2a2a28; padding: 8px 10px; border-radius: 7px; font-size: 13px; }
      .fly-search { background: rgba(255,255,255,0.65); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(0,0,0,0.08); color: #2a2a28; padding: 8px 12px; border-radius: 7px; font-size: 13px; min-width: 200px; }
      .fly-footer { position: absolute; bottom: 16px; left: 16px; padding: 10px 16px; font-size: 12px; }
      .fly-footer .fly-mono { opacity: 0.85; }
      .fly-dopamine { position: absolute; bottom: 16px; right: 16px; padding: 12px 16px; min-width: 200px; }
      .fly-dopamine .value { font-size: 18px; font-weight: 700; margin-top: 2px; }
      .fly-dopamine-bar-track { width: 100%; height: 6px; background: rgba(0,0,0,0.08); border-radius: 3px; overflow: hidden; margin-top: 6px; }
      .fly-dopamine-bar-fill { height: 100%; background: #ff5a36; width: 0%; }
      .fly-file-input { font-size: 12px; }
      .fly-inspector { position: absolute; top: 16px; right: 16px; padding: 14px 18px; min-width: 200px; display: none; }
      .fly-inspector.visible { display: block; }
      .fly-inspector .type { font-size: 18px; font-weight: 700; margin: 4px 0; }
      .fly-inspector .row { font-size: 12px; opacity: 0.75; margin-top: 2px; }
    `;
    document.head.appendChild(style);
  }

  _buildTopBar() {
    const bar = document.createElement('div');
    bar.className = 'fly-topbar';

    const playBtn = document.createElement('button');
    playBtn.className = 'fly-btn';
    playBtn.textContent = '▶ Play Music';
    playBtn.addEventListener('click', () => this.callbacks.onPlay());
    bar.appendChild(playBtn);
    this.playBtn = playBtn;

    const presetSelect = document.createElement('select');
    presetSelect.className = 'fly-select';
    const presetPlaceholder = document.createElement('option');
    presetPlaceholder.value = '';
    presetPlaceholder.textContent = 'Preset track…';
    presetSelect.appendChild(presetPlaceholder);
    PRESET_TRACKS.forEach((track) => {
      const o = document.createElement('option');
      o.value = track.url;
      o.textContent = track.label;
      presetSelect.appendChild(o);
    });
    presetSelect.addEventListener('change', (e) => {
      if (e.target.value) this.callbacks.onPlayPreset(e.target.value);
    });
    bar.appendChild(presetSelect);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.className = 'fly-file-input';
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.callbacks.onPlayFile(file);
    });
    bar.appendChild(fileInput);

    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Highlight neuron type…';
    search.className = 'fly-search';
    search.addEventListener('input', (e) => this.callbacks.onSearch(e.target.value));
    bar.appendChild(search);

    const rotateBtn = document.createElement('button');
    rotateBtn.className = 'fly-btn active';
    rotateBtn.textContent = '⟳ Orbit';
    let rotating = true;
    rotateBtn.addEventListener('click', () => {
      rotating = !rotating;
      rotateBtn.classList.toggle('active', rotating);
      this.callbacks.onToggleRotate(rotating);
    });
    bar.appendChild(rotateBtn);

    const edgesBtn = document.createElement('button');
    edgesBtn.className = 'fly-btn active';
    edgesBtn.textContent = 'Connections';
    let edgesVisible = true;
    edgesBtn.addEventListener('click', () => {
      edgesVisible = !edgesVisible;
      edgesBtn.classList.toggle('active', edgesVisible);
      this.callbacks.onToggleEdges(edgesVisible);
    });
    bar.appendChild(edgesBtn);

    const densitySelect = document.createElement('select');
    densitySelect.className = 'fly-select';
    CONNECTION_DENSITY_OPTIONS.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt === 'all' ? 'All connections' : `${opt.toLocaleString()} strongest`;
      densitySelect.appendChild(o);
    });
    densitySelect.addEventListener('change', (e) => {
      const v = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
      this.callbacks.onDensityChange(v);
    });
    bar.appendChild(densitySelect);

    this.root.appendChild(bar);
  }

  _buildStatsFooter() {
    const footer = document.createElement('div');
    footer.className = 'fly-footer fly-panel-glass';
    footer.innerHTML = `<span class="fly-mono">${this.data.neuronCount.toLocaleString()}</span> neurons &middot; <span class="fly-mono">${this.data.edgeCount.toLocaleString()}</span> connections available &middot; MaleCNS v1.0`;
    this.root.appendChild(footer);
  }

  _buildInspector() {
    const panel = document.createElement('div');
    panel.className = 'fly-inspector fly-panel-glass';
    panel.innerHTML = `
      <div class="fly-label">SELECTED NEURON</div>
      <div class="type"></div>
      <div class="row region"></div>
      <div class="row bodyid fly-mono"></div>
      <div class="row links"></div>
    `;
    this.root.appendChild(panel);
    this._inspector = panel;
  }

  _buildDopaminePanel() {
    const panel = document.createElement('div');
    panel.className = 'fly-dopamine fly-panel-glass';
    panel.innerHTML = `
      <div class="fly-label">DOPAMINE (PAM / PPL1) ACTIVITY</div>
      <div class="value fly-mono">0.00</div>
      <div class="fly-dopamine-bar-track"><div class="fly-dopamine-bar-fill"></div></div>
    `;
    this.root.appendChild(panel);
    this._dopamineValueEl = panel.querySelector('.value');
    this._dopamineBarEl = panel.querySelector('.fly-dopamine-bar-fill');
  }

  updateDopaminePanel(aggregate, maxExpected = DOPAMINE_PANEL_MAX) {
    this._dopamineValueEl.textContent = (aggregate * 100).toFixed(1) + '%';
    const pct = Math.min(100, (aggregate / maxExpected) * 100);
    this._dopamineBarEl.style.width = pct + '%';
  }

  setPlaying(isPlaying) {
    this.playBtn.textContent = isPlaying ? '⏸ Pause' : '▶ Play Music';
  }

  showNeuron(info) {
    if (!info) {
      this._inspector.classList.remove('visible');
      return;
    }
    this._inspector.classList.add('visible');
    this._inspector.querySelector('.type').textContent = info.type;
    this._inspector.querySelector('.region').textContent = 'Region: ' + info.region;
    this._inspector.querySelector('.bodyid').textContent = 'Body ID: ' + info.bodyId;
    this._inspector.querySelector('.links').textContent =
      'Highlighted links: ' + (info.linkCount ?? 0) + ' (top strongest)';
  }
}
