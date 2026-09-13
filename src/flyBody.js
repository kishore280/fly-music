import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const MODEL_URL = '/data/flybody/model.json';

export class FlyBodyView {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf4f3ef);
    this.modelRoot = new THREE.Group();
    this.scene.add(this.modelRoot);

    this.camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.001, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.8;

    this.scene.add(new THREE.HemisphereLight(0xffedda, 0x18202a, 3));
    const light = new THREE.DirectionalLight(0xffdfb2, 4);
    light.position.set(2, 3, 4);
    this.scene.add(light);

    this._materials = {
      body: new THREE.MeshStandardMaterial({ color: 0x9e6834, roughness: 0.65 }),
      black: new THREE.MeshStandardMaterial({ color: 0x15110e, roughness: 0.65 }),
      red: new THREE.MeshStandardMaterial({ color: 0xad331f, roughness: 0.65 }),
      ocelli: new THREE.MeshStandardMaterial({ color: 0xe6b351, roughness: 0.65 }),
      'bristle-brown': new THREE.MeshStandardMaterial({ color: 0x281c10, roughness: 0.65 }),
      lower: new THREE.MeshStandardMaterial({ color: 0xbb8949, roughness: 0.65 }),
      brown: new THREE.MeshStandardMaterial({ color: 0x52351f, roughness: 0.65 }),
      membrane: new THREE.MeshStandardMaterial({
        color: 0xaabbcc,
        transparent: true,
        opacity: 0.36,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    };

    this._radius = 0.3;
    this._pulsePhase = 0;
    this._frontLegGroups = [];

    this._load();
    window.addEventListener('resize', () => this._onResize());
  }

  async _load() {
    const meta = await (await fetch(MODEL_URL)).json();
    const buffer = await (await fetch(`/data/flybody/${meta.binary}`)).arrayBuffer();

    const groupObjects = {};
    for (const part of meta.parts) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(buffer.slice(part.positionByteOffset, part.positionByteOffset + part.positionCount * 12)), 3)
      );
      geometry.setIndex(
        new THREE.BufferAttribute(new Uint32Array(buffer.slice(part.indexByteOffset, part.indexByteOffset + part.indexCount * 4)), 1)
      );
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, this._materials[part.material] ?? this._materials.body);

      if (!groupObjects[part.group]) {
        const group = new THREE.Group();
        group.position.fromArray(meta.pivots[part.group]);
        this.modelRoot.add(group);
        groupObjects[part.group] = group;
        if (part.group === 'front_left' || part.group === 'front_right') {
          this._frontLegGroups.push(group);
        }
      }
      mesh.position.fromArray(meta.pivots[part.group]).multiplyScalar(-1);
      groupObjects[part.group].add(mesh);
    }

    const bounds = new THREE.Box3().setFromObject(this.modelRoot);
    const center = bounds.getCenter(new THREE.Vector3());
    this.modelRoot.position.sub(center);
    this._radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;

    this._fitCamera();
  }

  _fitCamera() {
    this.camera.position.set(1, 0.65, 1.5).normalize().multiplyScalar(this._radius / Math.sin((this.camera.fov * Math.PI) / 360) * 1.6);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  _onResize() {
    const { clientWidth, clientHeight } = this.container;
    this.camera.aspect = clientWidth / Math.max(1, clientHeight);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }

  update(dt, { dopamineAggregate = 0, rawFeatures = null } = {}) {
    this._pulsePhase += dt;
    const pulse = 1 + Math.min(0.15, dopamineAggregate * 0.6);
    this.modelRoot.scale.setScalar(pulse);

    const twitch = rawFeatures?.onset ? 0.35 : 0;
    for (const leg of this._frontLegGroups) {
      const sign = leg === this._frontLegGroups[0] ? 1 : -1;
      leg.rotation.z = sign * twitch * Math.sin(this._pulsePhase * 20);
    }

    this.controls.update();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
