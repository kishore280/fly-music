import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BASE_POINT_SIZE, BASE_GRAY, MUTED_GRAY, ACCENT_COLOR } from './constants.js';

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

export class Scene {
  constructor(container, data, { onPickNeuron } = {}) {
    this.data = data;
    this.container = container;
    this.onPickNeuron = onPickNeuron;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf4f3ef);

    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.01, 100);
    this.camera.position.set(0, 0, 2.5);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.6;

    this._discTexture = makeHardDiscTexture();

    this._buildPoints();
    this._buildEdgeLines();
    this._buildPickHighlight();
    this._applyColors();

    this._pickVec = new THREE.Vector3();

    this.renderer.domElement.addEventListener('click', (e) => this._onClick(e));
    window.addEventListener('resize', () => this._onResize());
  }

  _buildPoints() {
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
      size: BASE_POINT_SIZE,
      map: this._discTexture,
      alphaTest: 0.5,
      vertexColors: true,
      sizeAttenuation: false,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.scene.add(this.points);
    this._colorAttr = geometry.getAttribute('color');
  }

  _buildEdgeLines() {
    const { edges, neurons } = this.data;
    const n = edges.source.length;
    const positions = new Float32Array(n * 2 * 3);

    for (let e = 0; e < n; e++) {
      const s = edges.source[e];
      const t = edges.target[e];
      positions[e * 6] = neurons.posX[s];
      positions[e * 6 + 1] = neurons.posY[s];
      positions[e * 6 + 2] = neurons.posZ[s];
      positions[e * 6 + 3] = neurons.posX[t];
      positions[e * 6 + 4] = neurons.posY[t];
      positions[e * 6 + 5] = neurons.posZ[t];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this._edgeCountTotal = n;
    this.setConnectionDensity(3000, geometry);

    const material = new THREE.LineBasicMaterial({
      color: 0x999999,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
    });

    this.edgeLines = new THREE.LineSegments(geometry, material);
    this.scene.add(this.edgeLines);
  }

  setConnectionDensity(count, geometry = this.edgeLines?.geometry) {
    const n = count === 'all' ? this._edgeCountTotal : Math.min(count, this._edgeCountTotal);
    geometry.setDrawRange(0, n * 2);
  }

  _buildPickHighlight() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    const material = new THREE.PointsMaterial({
      size: BASE_POINT_SIZE * 2.5,
      map: this._discTexture,
      alphaTest: 0.5,
      sizeAttenuation: false,
      color: 0xff5a36,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.pickHighlight = new THREE.Points(geometry, material);
    this.scene.add(this.pickHighlight);

    this._buildLinkHighlight();
  }

  _buildLinkHighlight() {
    const MAX_LINKS = 24;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_LINKS * 2 * 3), 3));
    geometry.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({
      color: 0xff5a36,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.linkHighlight = new THREE.LineSegments(geometry, material);
    this.scene.add(this.linkHighlight);
    this._maxLinks = MAX_LINKS;
  }

  _highlightLinksFor(idx) {
    const { pickLinks, neurons } = this.data;
    const n = pickLinks.source.length;
    const matches = [];
    for (let e = 0; e < n; e++) {
      if (pickLinks.source[e] === idx || pickLinks.target[e] === idx) {
        matches.push(e);
      }
    }
    matches.sort((a, b) => pickLinks.weight[b] - pickLinks.weight[a]);
    const top = matches.slice(0, this._maxLinks);

    const posAttr = this.linkHighlight.geometry.getAttribute('position');
    for (let k = 0; k < top.length; k++) {
      const e = top[k];
      const s = pickLinks.source[e];
      const t = pickLinks.target[e];
      posAttr.array[k * 6] = neurons.posX[s];
      posAttr.array[k * 6 + 1] = neurons.posY[s];
      posAttr.array[k * 6 + 2] = neurons.posZ[s];
      posAttr.array[k * 6 + 3] = neurons.posX[t];
      posAttr.array[k * 6 + 4] = neurons.posY[t];
      posAttr.array[k * 6 + 5] = neurons.posZ[t];
    }
    posAttr.needsUpdate = true;
    this.linkHighlight.geometry.setDrawRange(0, top.length * 2);
    return top.length;
  }

  clearSelection() {
    this.pickHighlight.material.opacity = 0;
    this.linkHighlight.geometry.setDrawRange(0, 0);
    this.onPickNeuron?.(null);
  }

  _onClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const { neuronCount, neurons } = this.data;
    const camera = this.camera;
    camera.updateMatrixWorld();

    const v = this._pickVec;
    let bestIdx = -1;
    let bestDistSq = Infinity;

    for (let i = 0; i < neuronCount; i++) {
      v.set(neurons.posX[i], neurons.posY[i], neurons.posZ[i]);
      v.project(camera);
      if (v.z < -1 || v.z > 1) continue;
      const px = ((v.x + 1) / 2) * rect.width;
      const py = ((1 - v.y) / 2) * rect.height;
      const dx = px - clickX;
      const dy = py - clickY;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIdx = i;
      }
    }

    const MAX_PICK_PIXEL_DIST = 40;
    if (bestIdx === -1 || bestDistSq > MAX_PICK_PIXEL_DIST * MAX_PICK_PIXEL_DIST) {
      this.clearSelection();
      return;
    }

    const idx = bestIdx;
    const { types, regions } = this.data;
    const posAttr = this.pickHighlight.geometry.getAttribute('position');
    posAttr.array[0] = neurons.posX[idx];
    posAttr.array[1] = neurons.posY[idx];
    posAttr.array[2] = neurons.posZ[idx];
    posAttr.needsUpdate = true;
    this.pickHighlight.material.opacity = 1;

    const linkCount = this._highlightLinksFor(idx);

    this.onPickNeuron?.({
      index: idx,
      bodyId: neurons.bodyId[idx],
      type: types[neurons.typeIndex[idx]] || '(untyped)',
      region: regions[neurons.regionIndex[idx]] || '(unknown)',
      linkCount,
    });
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    const { clientWidth, clientHeight } = this.container;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }

  setEdgesVisible(visible) {
    this.edgeLines.visible = visible;
  }

  setAutoRotate(enabled) {
    this.controls.autoRotate = enabled;
  }

  setSearchHighlight(query) {
    this._activeQuery = query?.trim().toLowerCase() || '';
    this._applyColors(this._activeQuery);
  }

  _applyColors(query = '') {
    const { neuronCount, neurons, types } = this.data;
    const colorArr = this._colorAttr.array;
    const hasQuery = query.length > 0;

    for (let i = 0; i < neuronCount; i++) {
      let color = BASE_GRAY;
      if (hasQuery) {
        const type = types[neurons.typeIndex[i]] || '';
        color = type.toLowerCase().includes(query) ? ACCENT_COLOR : MUTED_GRAY;
      }
      colorArr[i * 3] = color[0];
      colorArr[i * 3 + 1] = color[1];
      colorArr[i * 3 + 2] = color[2];
    }
    this._colorAttr.needsUpdate = true;
  }
}
