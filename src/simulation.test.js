import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Simulation } from './simulation.js';
import { SIM_BG, SIM_GAIN } from './constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadActivationData() {
  const raw = JSON.parse(
    readFileSync(join(__dirname, '..', 'public', 'data', 'activation-subgraph.json'), 'utf-8')
  );
  return {
    neuronCount: raw.meta.neuronCount,
    neurons: { isDopamine: Uint8Array.from(raw.neurons.isDopamine) },
    edges: {
      source: Int32Array.from(raw.edges.source),
      target: Int32Array.from(raw.edges.target),
      weight: Float32Array.from(raw.edges.weight),
    },
    joInjectionSites: raw.joInjectionSites,
    dopamineIndices: Int32Array.from(raw.dopamineIndices),
  };
}

let data;
beforeAll(() => {
  data = loadActivationData();
});

const REALISTIC_STIMULUS = { low: 0.08, mid: 0.5, high: 0.14 };
const ZERO_STIMULUS = { low: 0, mid: 0, high: 0 };
const FIXED_DT = 0.02;

function runTicks(sim, n, stimulus) {
  for (let i = 0; i < n; i++) sim.tick(FIXED_DT, stimulus);
}

function spikeFraction(sim) {
  let count = 0;
  for (let i = 0; i < sim.spikes.length; i++) count += sim.spikes[i];
  return count / sim.spikes.length;
}

describe('Simulation (LIF spiking model, real activation-subgraph.json data)', () => {
  it('loads real data with a non-trivial graph', () => {
    expect(data.neuronCount).toBeGreaterThan(1000);
    expect(data.edges.source.length).toBeGreaterThan(10000);
    expect(data.dopamineIndices.length).toBeGreaterThan(0);
  });

  it('stays completely dark with no stimulus - no spontaneous runaway activity', () => {
    const sim = new Simulation(data);
    runTicks(sim, 250, ZERO_STIMULUS);
    expect(spikeFraction(sim)).toBe(0);
    expect(sim.dopamineAggregate).toBe(0);
  });

  it('produces visible, non-saturating spiking under REALISTIC sustained stimulus', () => {
    const sim = new Simulation(data);
    runTicks(sim, 250, REALISTIC_STIMULUS);
    const frac = spikeFraction(sim);
    expect(frac).toBeGreaterThan(0.005);
    expect(frac).toBeLessThan(0.5);
    expect(sim.dopamineAggregate).toBeGreaterThanOrEqual(0);
  });

  it('decays to silence after sustained activity stops', () => {
    const sim = new Simulation(data);
    runTicks(sim, 250, REALISTIC_STIMULUS);
    expect(spikeFraction(sim)).toBeGreaterThan(0);

    runTicks(sim, 50, ZERO_STIMULUS);
    expect(spikeFraction(sim)).toBeLessThan(0.01);
    runTicks(sim, 200, ZERO_STIMULUS);
    expect(sim.dopamineAggregate).toBeLessThan(0.001);
  });

  it('does not runaway into permanent whole-network firing over a long sustained run', () => {
    const sim = new Simulation(data);
    runTicks(sim, 750, REALISTIC_STIMULUS);
    expect(spikeFraction(sim)).toBeLessThan(0.5);
  }, 15000);
});

describe('stability config', () => {
  it('the constants.js default bg/gain stay in the tested-safe range', () => {
    expect(SIM_GAIN).toBeLessThan(1.8);
    expect(SIM_BG).toBeGreaterThan(0);
  });
});

describe.skip('bg/gain parameter sweep (manual tuning aid)', () => {
  it('prints idle vs realistic-stimulus spike fraction across a bg x gain grid', () => {
    for (const bg of [0.02, 0.04, 0.06, 0.08, 0.1]) {
      for (const gain of [0.3, 0.5, 0.8, 1.0, 1.3]) {
        const idleSim = new Simulation(data, { bg, gain });
        runTicks(idleSim, 250, ZERO_STIMULUS);
        const idleFrac = spikeFraction(idleSim);

        const realSim = new Simulation(data, { bg, gain });
        runTicks(realSim, 250, REALISTIC_STIMULUS);
        const realFrac = spikeFraction(realSim);

        console.log(
          `bg=${bg} gain=${gain}  idleFrac=${idleFrac.toFixed(4)}  realFrac=${realFrac.toFixed(4)}  dopAggregate=${realSim.dopamineAggregate.toFixed(4)}`
        );
      }
    }
  });
});
