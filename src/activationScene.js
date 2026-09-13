import * as THREE from 'three';
import { BASE_POINT_SIZE, BASE_GRAY, ACCENT_COLOR } from './constants.js';

function makeHardDiscTexture() {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function makeSoftGlowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export class ActivationLayer {
  constructor(threeScene, data) {
    this.data = data;
    this._discTexture = makeHardDiscTexture();
    this._glowTexture = makeSoftGlowTexture();

    this._buildGlowHalo(threeScene);
    this._buildPoints(threeScene);
  }

  _buildPoints(threeScene) {
    const { neuronCount, neurons } = this.data;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(neuronCount * 3);
    const colors = new Float32Array(neuronCount * 3);

    for (let i = 0; i < neuronCount; i++) {
      positions[i * 3] = neurons.posX[i];
      positions[i * 3 + 1] = neurons.posY[i];
      positions[i * 3 + 2] = neurons.posZ[i];
      colors[i * 3] = BASE_GRAY[0];
      colors[i * 3 + 1] = BASE_GRAY[1];
      colors[i * 3 + 2] = BASE_GRAY[2];
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: BASE_POINT_SIZE * 1.8,
      map: this._discTexture,
      alphaTest: 0.5,
      vertexColors: true,
      sizeAttenuation: false,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, material);
    threeScene.add(this.points);
    this._colorAttr = geometry.getAttribute('color');
  }

  _buildGlowHalo(threeScene) {
    const { neuronCount, neurons } = this.data;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(neuronCount * 3);
    const colors = new Float32Array(neuronCount * 3);

    for (let i = 0; i < neuronCount; i++) {
      positions[i * 3] = neurons.posX[i];
      positions[i * 3 + 1] = neurons.posY[i];
      positions[i * 3 + 2] = neurons.posZ[i];
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: BASE_POINT_SIZE * 6,
      map: this._glowTexture,
      vertexColors: true,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.glowHalo = new THREE.Points(geometry, material);
    threeScene.add(this.glowHalo);
    this._glowColorAttr = geometry.getAttribute('color');
  }

  updateColorsFromActivation(v, spikes) {
    const { neuronCount } = this.data;
    const colorArr = this._colorAttr.array;
    const glowArr = this._glowColorAttr.array;

    let vmax = 0;
    for (let i = 0; i < neuronCount; i++) {
      const mag = Math.abs(v[i]);
      if (mag > vmax) vmax = mag;
    }

    for (let i = 0; i < neuronCount; i++) {
      let a = vmax > 0 ? Math.min(1, Math.abs(v[i]) / vmax) : 0;
      if (spikes[i]) a = 1;

      colorArr[i * 3] = BASE_GRAY[0] + (ACCENT_COLOR[0] - BASE_GRAY[0]) * a;
      colorArr[i * 3 + 1] = BASE_GRAY[1] + (ACCENT_COLOR[1] - BASE_GRAY[1]) * a;
      colorArr[i * 3 + 2] = BASE_GRAY[2] + (ACCENT_COLOR[2] - BASE_GRAY[2]) * a;

      const glow = a * a;
      glowArr[i * 3] = ACCENT_COLOR[0] * glow;
      glowArr[i * 3 + 1] = ACCENT_COLOR[1] * glow;
      glowArr[i * 3 + 2] = ACCENT_COLOR[2] * glow;
    }
    this._colorAttr.needsUpdate = true;
    this._glowColorAttr.needsUpdate = true;
  }
}
