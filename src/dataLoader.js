import { DATA_URL } from './constants.js';

export async function loadConnectomeData() {
  const res = await fetch(DATA_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${DATA_URL}: ${res.status}`);
  }
  const raw = await res.json();

  const neuronCount = raw.meta.neuronCount;

  const neurons = {
    bodyId: Int32Array.from(raw.neurons.bodyId),
    typeIndex: Int32Array.from(raw.neurons.typeIndex),
    regionIndex: Int8Array.from(raw.neurons.regionIndex),
    posX: Float32Array.from(raw.neurons.posX),
    posY: Float32Array.from(raw.neurons.posY),
    posZ: Float32Array.from(raw.neurons.posZ),
  };

  const edges = {
    source: Int32Array.from(raw.edges.source),
    target: Int32Array.from(raw.edges.target),
    weight: Float32Array.from(raw.edges.weight),
  };

  const pickLinks = {
    source: Int32Array.from(raw.pickLinks.source),
    target: Int32Array.from(raw.pickLinks.target),
    weight: Float32Array.from(raw.pickLinks.weight),
  };

  return {
    meta: raw.meta,
    neuronCount,
    edgeCount: edges.source.length,
    neurons,
    edges,
    pickLinks,
    types: raw.types,
    regions: raw.regions,
  };
}
