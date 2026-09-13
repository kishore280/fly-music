import { loadConnectomeData } from './dataLoader.js';
import { loadActivationData } from './activationLoader.js';
import { Scene } from './scene.js';
import { ActivationLayer } from './activationScene.js';
import { AudioEngine } from './audio.js';
import { Simulation } from './simulation.js';
import { mapAudioToStimulus } from './mapping.js';
import { UI } from './ui.js';
import { FlyBodyView } from './flyBody.js';

const DEBUG = new URLSearchParams(window.location.search).has('debug');
const ZERO_STIMULUS = { low: 0, mid: 0, high: 0 };

async function main() {
  const app = document.getElementById('app');
  app.innerHTML = '<div id="loading" style="color:#2a2a28;font-family:system-ui;padding:24px;">Loading connectome…</div>';

  const [data, activationData] = await Promise.all([loadConnectomeData(), loadActivationData()]);
  console.log(`Loaded ${data.neuronCount} neurons, ${data.edgeCount} edges`, data.meta);
  console.log(`Loaded activation subgraph: ${activationData.neuronCount} neurons, ${activationData.edges.source.length} edges`);

  app.innerHTML = '';
  app.style.display = 'flex';
  app.style.position = 'fixed';
  app.style.inset = '0';

  const brainViewport = document.createElement('div');
  brainViewport.style.position = 'relative';
  brainViewport.style.flex = '1 1 60%';
  brainViewport.style.minWidth = '0';
  app.appendChild(brainViewport);

  const flyViewport = document.createElement('div');
  flyViewport.style.position = 'relative';
  flyViewport.style.flex = '1 1 40%';
  flyViewport.style.minWidth = '0';
  flyViewport.style.borderLeft = '1px solid rgba(0,0,0,0.08)';
  app.appendChild(flyViewport);

  const audio = new AudioEngine();
  const simulation = new Simulation(activationData);
  let isPlaying = false;

  async function togglePlay() {
    if (!audio.audioEl) return;
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
    } else {
      await audio.play();
      isPlaying = true;
    }
    ui.setPlaying(isPlaying);
  }

  const ui = new UI(brainViewport, data, {
    onSearch: (query) => scene.setSearchHighlight(query),
    onToggleEdges: (visible) => scene.setEdgesVisible(visible),
    onDensityChange: (count) => scene.setConnectionDensity(count),
    onToggleRotate: (enabled) => scene.setAutoRotate(enabled),
    onPlay: togglePlay,
    onPlayFile: async (file) => {
      audio.loadFromFile(file);
      await audio.play();
      isPlaying = true;
      ui.setPlaying(true);
    },
    onPlayPreset: async (url) => {
      audio.loadFromUrl(url);
      await audio.play();
      isPlaying = true;
      ui.setPlaying(true);
    },
  });

  const scene = new Scene(brainViewport, data, {
    onPickNeuron: (info) => ui.showNeuron(info),
  });
  const activationLayer = new ActivationLayer(scene.scene, activationData);
  const flyBody = new FlyBodyView(flyViewport);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      scene.clearSelection();
    } else if (e.key === ' ' && document.activeElement?.tagName !== 'INPUT') {
      e.preventDefault();
      togglePlay();
    }
  });

  if (DEBUG) {
    window.__scene = scene;
    window.__debug = { audio, simulation, getIsPlaying: () => isPlaying };
  }

  let lastTime = performance.now();
  let frameCount = 0;
  let fpsAccum = 0;

  function frame(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    const rawFeatures = isPlaying ? audio.getFeatures() : null;
    const stimulus = rawFeatures ? mapAudioToStimulus(rawFeatures) : ZERO_STIMULUS;
    simulation.tick(dt, stimulus);

    activationLayer.updateColorsFromActivation(simulation.v, simulation.spikes);
    ui.updateDopaminePanel(simulation.dopamineAggregate);
    flyBody.update(dt, { dopamineAggregate: simulation.dopamineAggregate, rawFeatures });

    scene.render();
    flyBody.render();

    if (DEBUG) {
      frameCount++;
      fpsAccum += dt;
      if (fpsAccum >= 1) {
        console.log(`FPS: ${frameCount}`);
        frameCount = 0;
        fpsAccum = 0;
      }
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error(err);
  document.getElementById('app').innerHTML =
    `<div style="color:#f66;font-family:system-ui;padding:24px;">Failed to load: ${err.message}</div>`;
});
