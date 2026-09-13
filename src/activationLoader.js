import { ACTIVATION_DATA_URL } from './constants.js';

export async function loadActivationData() {
  const res = await fetch(ACTIVATION_DATA_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${ACTIVATION_DATA_URL}: ${res.status}`);
  }
  const raw = await res.json();

  const neuronCount = raw.meta.neuronCount;

  const neurons = {
    isDopamine: Uint8Array.from(raw.neurons.isDopamine),
    posX: Float32Array.from(raw.neurons.posX),
    posY: Float32Array.from(raw.neurons.posY),
    posZ: Float32Array.from(raw.neurons.posZ),
  };

  const edges = {
    source: Int32Array.from(raw.edges.source),
    target: Int32Array.from(raw.edges.target),
    weight: Float32Array.from(raw.edges.weight),
  };

  return {
    meta: raw.meta,
    neuronCount,
    neurons,
    edges,
    joInjectionSites: raw.joInjectionSites,
    dopamineIndices: Int32Array.from(raw.dopamineIndices),
  };
}
