import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { SUN, PLANETS, DWARF_PLANETS, allBodies } from './data.js';
import {
  buildSurfaceTexture,
  buildEarthCloudsTexture,
  buildRingTexture,
  buildSunTexture,
  buildStarfieldTexture
} from './textures.js';

// Scale strategy:
// - "Compressed" view shrinks the absurd distance ratios so all bodies fit on screen.
// - "Real-relative" toggle keeps the same compressed radii but switches distances to a
//   linearly mapped log distribution while still being physically *ordered* and proportional.
//
// Units: 1 scene unit ≈ 1 metre when in AR (we then re-scale the whole root group).

const SCENE_RADIUS = 80;        // overall extent of the system in scene units (compressed)
const SUN_RENDER_RADIUS = 3.2;
const PLANET_RADIUS_RANGE = [0.18, 1.6];
const MOON_RADIUS_RANGE = [0.04, 0.45];

export class SolarSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.bodies = new Map();      // id -> { object3D, mesh, data, orbit, ... }
    this.orbitLines = [];
    this.simTime = 0;             // simulated time in days
    this.timeScale = 20;          // multiplier
    this.realSize = false;
    this.showOrbits = true;
    this.showLabels = true;
    this.labelEls = new Map();
    this.placed = false;          // for AR
    this.clock = new THREE.Clock();

    this._initRenderer();
    this._initScene();
    this._initLights();
    this._initLabels();
    this._buildSystem();
    this._initControls();
    this._initRaycaster();

    window.addEventListener('resize', () => this._onResize());
    this._onResize();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.xr.enabled = true;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.starfield = buildStarfieldTexture();
    this.scene.background = this.starfield;

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.01, 5000);
    this.camera.position.set(0, 35, 90);

    // Root group lets us reposition / scale the whole system for AR placement.
    this.root = new THREE.Group();
    this.scene.add(this.root);
  }

  _initLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.06));

    // Sun acts as a point light. Decay=0 keeps brightness uniform across the
    // huge distance ratios we display, and is invariant to the AR scale change.
    this.sunLight = new THREE.PointLight(0xfff1c2, 2.6, 0, 0);
    this.sunLight.position.set(0, 0, 0);
    this.root.add(this.sunLight);

    // gentle key fill so the dark side isn't pure black on mobile
    const fill = new THREE.HemisphereLight(0x445577, 0x0a0a14, 0.18);
    this.scene.add(fill);
  }

  _initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.02;     // very close-in zoom for tiny dwarfs
    this.controls.maxDistance = 500;
    this.controls.target.set(0, 0, 0);
    this.followTarget = null;             // body the camera is locked onto
  }

  _initRaycaster() {
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.canvas.addEventListener('pointerdown', (e) => { this._pointerDownAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!this._pointerDownAt) return;
      const dx = e.clientX - this._pointerDownAt.x;
      const dy = e.clientY - this._pointerDownAt.y;
      const dt = performance.now() - this._pointerDownAt.t;
      if (dx * dx + dy * dy < 25 && dt < 400) this._handleClick(e);
    });
  }

  _initLabels() {
    this.labelLayer = document.createElement('div');
    Object.assign(this.labelLayer.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '5'
    });
    document.body.appendChild(this.labelLayer);
  }

  // ---- Build celestial bodies ---------------------------------------------

  _buildSystem() {
    // Sun
    const sunTex = buildSunTexture();
    const sunMat = new THREE.MeshBasicMaterial({ map: sunTex, color: 0xffffff });
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(SUN_RENDER_RADIUS, 64, 64), sunMat);
    this.root.add(sunMesh);

    // Sun glow halo (sprite)
    const glowMat = new THREE.SpriteMaterial({
      map: this._buildGlowTexture(),
      color: 0xffd070,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(SUN_RENDER_RADIUS * 3.2, SUN_RENDER_RADIUS * 3.2, 1);
    sunMesh.add(glow);

    this.bodies.set('sun', { data: SUN, object3D: sunMesh, mesh: sunMesh, orbitGroup: null, parentOrbit: null });
    this._addLabel('sun', SUN.name, 'star');

    // Build planets and dwarfs
    const allOrbiting = [...PLANETS, ...DWARF_PLANETS];
    const minAU = Math.min(...allOrbiting.map(b => b.distanceAU));
    const maxAU = Math.max(...allOrbiting.map(b => b.distanceAU));
    this._distanceMap = (au) => {
      // log-ish compression that always preserves ordering
      const t = (Math.log(au) - Math.log(minAU)) / (Math.log(maxAU) - Math.log(minAU));
      return SUN_RENDER_RADIUS * 2.5 + t * (SCENE_RADIUS - SUN_RENDER_RADIUS * 2.5);
    };

    // Radius mapping
    const minR = Math.min(...allOrbiting.map(b => b.radiusKm));
    const maxR = Math.max(...allOrbiting.map(b => b.radiusKm));
    this._radiusMap = (km) => {
      const t = (Math.log(km) - Math.log(minR)) / (Math.log(maxR) - Math.log(minR));
      return PLANET_RADIUS_RANGE[0] + t * (PLANET_RADIUS_RANGE[1] - PLANET_RADIUS_RANGE[0]);
    };
    // Real-relative (still compressed but linear by km)
    this._realRadiusMap = (km) => {
      const t = km / maxR;
      return PLANET_RADIUS_RANGE[0] + t * (PLANET_RADIUS_RANGE[1] - PLANET_RADIUS_RANGE[0]);
    };
    this._realDistanceMap = (au) => {
      const t = au / maxAU;
      return SUN_RENDER_RADIUS * 2.5 + t * (SCENE_RADIUS - SUN_RENDER_RADIUS * 2.5);
    };

    for (const body of allOrbiting) this._addOrbitingBody(body);
  }

  _buildGlowTexture() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    const grd = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255, 220, 140, 0.95)');
    grd.addColorStop(0.4, 'rgba(255, 170, 60, 0.35)');
    grd.addColorStop(1, 'rgba(255, 120, 30, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _addOrbitingBody(data) {
    const orbitGroup = new THREE.Group(); // rotated around sun
    this.root.add(orbitGroup);

    const distance = this._distanceMap(data.distanceAU);
    const radius = this._radiusMap(data.radiusKm);

    // Tilt group keeps the axial tilt isolated from the spin so we can
    // freely advance rotation.y on the body without polluting the tilt.
    const tiltGroup = new THREE.Group();
    tiltGroup.position.set(distance, 0, 0);
    tiltGroup.rotation.z = THREE.MathUtils.degToRad(data.tiltDeg || 0);
    orbitGroup.add(tiltGroup);

    const body = this._makeBodyMesh(data, radius);
    tiltGroup.add(body);

    // Rings (sized as a proportion of the parent radius)
    if (data.rings) {
      const ringInner = radius * (data.rings.innerKm / data.radiusKm);
      const ringOuter = radius * (data.rings.outerKm / data.radiusKm);
      const ringMesh = this._makeRing(ringInner, ringOuter, data.rings);
      tiltGroup.add(ringMesh);
    }

    // Orbit line
    const orbitLine = this._makeOrbitLine(distance, data.eccentricity || 0);
    this.root.add(orbitLine);
    this.orbitLines.push(orbitLine);

    const entry = {
      data,
      object3D: body,            // spinning body mesh
      tiltGroup,                 // holds axial tilt + offset from sun
      orbitGroup,                // rotated to position the body around sun
      orbitLine,
      distance,
      radius,
      angle: Math.random() * Math.PI * 2,
      moons: []
    };

    // Set initial angle
    orbitGroup.rotation.y = entry.angle;

    // Moons
    if (data.moons) {
      for (const m of data.moons) {
        const moonRadius = THREE.MathUtils.clamp(
          MOON_RADIUS_RANGE[0] + (m.radiusKm / 1737) * (MOON_RADIUS_RANGE[1] - MOON_RADIUS_RANGE[0]),
          MOON_RADIUS_RANGE[0], MOON_RADIUS_RANGE[1]
        );
        // Spread moons out so they don't overlap parent visually
        const moonDistance = radius * 2.0 + (m.distanceKm / Math.max(1, data.radiusKm)) * radius * 0.18 + moonRadius * 1.5;

        // Moons orbit in the parent's equatorial plane → attach to tiltGroup, not body.
        const moonGroup = new THREE.Group();
        tiltGroup.add(moonGroup);
        const moonTilt = new THREE.Group();
        moonTilt.position.set(moonDistance, 0, 0);
        moonTilt.rotation.z = THREE.MathUtils.degToRad(m.tiltDeg || 0);
        moonGroup.add(moonTilt);
        const moonMesh = this._makeBodyMesh(m, moonRadius);
        moonTilt.add(moonMesh);

        // Subtle orbit ring around parent
        const moonOrbit = this._makeOrbitLine(moonDistance, 0, 0x6688aa, 0.25);
        tiltGroup.add(moonOrbit);
        this.orbitLines.push(moonOrbit);

        const moonEntry = {
          data: { ...m, type: 'Moon', parent: data.id },
          object3D: moonMesh,
          tiltGroup: moonTilt,
          orbitGroup: moonGroup,
          orbitLine: moonOrbit,
          distance: moonDistance,
          radius: moonRadius,
          angle: Math.random() * Math.PI * 2,
          isMoon: true,
          parentId: data.id
        };
        moonGroup.rotation.y = moonEntry.angle;
        this.bodies.set(m.id, moonEntry);
        entry.moons.push(moonEntry);
        this._addLabel(m.id, m.name, 'moon');
      }
    }

    // Earth gets a translucent cloud shell
    if (data.id === 'earth') {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.015, 64, 64),
        new THREE.MeshLambertMaterial({
          map: buildEarthCloudsTexture(),
          transparent: true,
          opacity: 0.85,
          depthWrite: false
        })
      );
      body.add(clouds);
      entry.clouds = clouds;
    }

    // Sun-side atmosphere glow for Earth, Venus, Neptune, Uranus
    if (['earth', 'venus', 'neptune', 'uranus'].includes(data.id)) {
      const atmos = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.04, 64, 64),
        new THREE.MeshBasicMaterial({
          color: data.id === 'earth' ? 0x6aa9ff
            : data.id === 'venus' ? 0xf5d59c
            : data.id === 'uranus' ? 0xb6ecef
            : 0x6c8eff,
          transparent: true,
          opacity: 0.12,
          side: THREE.BackSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      body.add(atmos);
    }

    this.bodies.set(data.id, entry);
    this._addLabel(data.id, data.name, data.type === 'Dwarf planet' ? 'dwarf' : 'planet');
  }

  _makeBodyMesh(data, radius) {
    const geo = new THREE.SphereGeometry(radius, 64, 64);
    let mat;
    if (data.surface) {
      mat = new THREE.MeshStandardMaterial({
        map: buildSurfaceTexture(data),
        roughness: data.surface === 'icy' || data.surface === 'moon' ? 0.92 : 0.85,
        metalness: 0.0
      });
    } else {
      mat = new THREE.MeshStandardMaterial({ color: data.color || 0x888888, roughness: 0.9 });
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.bodyId = data.id;
    return mesh;
  }

  _makeRing(inner, outer, ringData) {
    const geo = new THREE.RingGeometry(inner, outer, 128, 8);
    // Re-map UV so the ring texture runs radially (inner-to-outer) along U.
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const r = Math.sqrt(x * x + y * y);
      uv.setXY(i, (r - inner) / (outer - inner), 0.5);
    }
    uv.needsUpdate = true;

    const tex = buildRingTexture(ringData.color, ringData.color);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: ringData.opacity || 0.85,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  _makeOrbitLine(radius, eccentricity = 0, color = 0x4d6c8c, opacity = 0.4) {
    const segments = 256;
    const points = [];
    const a = radius;
    const b = radius * Math.sqrt(1 - eccentricity * eccentricity);
    const c = radius * eccentricity; // focal offset
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(t) * a - c, 0, Math.sin(t) * b));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.Line(geo, mat);
  }

  // ---- Labels --------------------------------------------------------------

  _addLabel(id, name, kind) {
    const el = document.createElement('div');
    el.className = 'label-tag' + (kind === 'moon' ? ' moon' : '');
    el.textContent = name;
    this.labelLayer.appendChild(el);
    this.labelEls.set(id, el);
  }

  _updateLabels() {
    if (!this.showLabels) {
      for (const el of this.labelEls.values()) el.style.display = 'none';
      return;
    }
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    const v = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    this.camera.getWorldPosition(camPos);

    for (const [id, entry] of this.bodies) {
      const el = this.labelEls.get(id);
      if (!el) continue;
      entry.object3D.getWorldPosition(v);
      const distToCam = v.distanceTo(camPos);
      // Hide moon labels when the system is zoomed out
      if (entry.isMoon && distToCam > 30) { el.style.display = 'none'; continue; }
      v.project(this.camera);
      if (v.z < -1 || v.z > 1) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
      el.classList.toggle('dim', distToCam > 200);
    }
  }

  // ---- Click / pick --------------------------------------------------------

  _handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const targets = [];
    for (const entry of this.bodies.values()) targets.push(entry.object3D);
    targets.push(...[...this.bodies.values()].filter(b => b.data.id === 'sun').map(b => b.mesh));
    const hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length) {
      // walk up to find a mesh with bodyId
      let obj = hits[0].object;
      while (obj && !obj.userData.bodyId) obj = obj.parent;
      if (obj && obj.userData.bodyId) {
        this._dispatchSelect(obj.userData.bodyId);
      }
    }
  }

  onSelect(cb) { this._onSelectCb = cb; }
  _dispatchSelect(id) {
    const entry = id === 'sun'
      ? { data: SUN, object3D: this.bodies.get('sun').mesh }
      : this.bodies.get(id);
    if (!entry) return;
    if (this._onSelectCb) this._onSelectCb(entry);
  }

  jumpTo(id) {
    const entry = this.bodies.get(id);
    if (!entry) return;
    const target = new THREE.Vector3();
    entry.object3D.getWorldPosition(target);
    const radius = (entry.radius || SUN_RENDER_RADIUS) * (entry.object3D.scale.x || 1);
    // Closer offset so dwarfs / moons fill the view
    const offset = new THREE.Vector3(0, radius * 1.2, radius * 3.5);
    const camTarget = target.clone().add(offset);
    this._tweenCamera(camTarget, target);
    // Lock on so the camera follows the body around its orbit
    this.followTarget = entry;
  }

  releaseFollow() { this.followTarget = null; }

  _tweenCamera(toPos, toTarget, dur = 1.0, onDone) {
    const fromPos = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();
    const t0 = performance.now();
    this._tweening = true;
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / (dur * 1000));
      const k = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      this.camera.position.lerpVectors(fromPos, toPos, k);
      this.controls.target.lerpVectors(fromTarget, toTarget, k);
      if (t < 1) requestAnimationFrame(tick);
      else { this._tweening = false; if (onDone) onDone(); }
    };
    tick();
  }

  resetView() {
    this.followTarget = null;
    this._tweenCamera(new THREE.Vector3(0, 35, 90), new THREE.Vector3(0, 0, 0));
  }

  // ---- Toggles -------------------------------------------------------------

  setShowOrbits(v) {
    this.showOrbits = v;
    for (const l of this.orbitLines) l.visible = v;
  }
  setShowLabels(v) {
    this.showLabels = v;
    this._updateLabels();
  }
  setRealSize(v) {
    this.realSize = v;
    for (const [id, entry] of this.bodies) {
      if (id === 'sun' || entry.isMoon) continue;
      const newR = v ? this._realRadiusMap(entry.data.radiusKm) : this._radiusMap(entry.data.radiusKm);
      const newD = v ? this._realDistanceMap(entry.data.distanceAU) : this._distanceMap(entry.data.distanceAU);
      entry.object3D.scale.setScalar(newR / entry.radius);
      entry.tiltGroup.position.set(newD, 0, 0);
      // rebuild orbit line
      this.root.remove(entry.orbitLine);
      const idx = this.orbitLines.indexOf(entry.orbitLine);
      if (idx >= 0) this.orbitLines.splice(idx, 1);
      const newLine = this._makeOrbitLine(newD, entry.data.eccentricity || 0);
      newLine.visible = this.showOrbits;
      this.root.add(newLine);
      this.orbitLines.push(newLine);
      entry.orbitLine = newLine;
      entry.distance = newD;
    }
  }
  setStarfield(v) {
    this.scene.background = v ? this.starfield : new THREE.Color(0x000005);
  }
  setTimeScale(v) { this.timeScale = v; }

  // ---- AR ------------------------------------------------------------------

  setupAR(arButtonEl) {
    if (!('xr' in navigator)) {
      arButtonEl.textContent = 'AR not supported';
      arButtonEl.disabled = true;
      return;
    }
    navigator.xr.isSessionSupported('immersive-ar').then((ok) => {
      if (!ok) {
        arButtonEl.textContent = 'AR not available';
        arButtonEl.disabled = true;
        return;
      }
      const real = ARButton.createButton(this.renderer, {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.body }
      });
      // Style the auto-generated button to match the page button, but actually
      // forward clicks from our visible button into the hidden ARButton.
      real.style.display = 'none';
      document.body.appendChild(real);
      arButtonEl.disabled = false;
      arButtonEl.textContent = 'Enter AR';
      arButtonEl.addEventListener('click', () => real.click());

      this._setupHitTest();
    }).catch(() => {
      arButtonEl.textContent = 'AR unavailable';
      arButtonEl.disabled = true;
    });

    this.renderer.xr.addEventListener('sessionstart', () => this._onAREnter());
    this.renderer.xr.addEventListener('sessionend', () => this._onARExit());
  }

  _setupHitTest() {
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.06, 0.075, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x67b3ff })
    );
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    this.controller = this.renderer.xr.getController(0);
    this.controller.addEventListener('select', () => {
      if (this.reticle.visible && !this.placed) {
        this.root.position.setFromMatrixPosition(this.reticle.matrix);
        this.root.scale.setScalar(0.0035); // 1 unit ≈ 3.5 mm in AR space
        this.placed = true;
        const hint = document.getElementById('ar-hint');
        if (hint) hint.classList.add('hidden');
      }
    });
    this.scene.add(this.controller);
  }

  async _onAREnter() {
    this.scene.background = null;
    this.controls.enabled = false;
    this.placed = false;
    this.root.scale.setScalar(0.0035);
    this.root.position.set(0, -0.5, -1.5); // tentative until placed
    const hint = document.getElementById('ar-hint');
    if (hint) hint.classList.remove('hidden');

    const session = this.renderer.xr.getSession();
    const refSpace = await session.requestReferenceSpace('viewer');
    this.hitTestSource = await session.requestHitTestSource({ space: refSpace });
  }

  _onARExit() {
    this.scene.background = this.starfield;
    this.controls.enabled = true;
    this.root.scale.setScalar(1);
    this.root.position.set(0, 0, 0);
    if (this.reticle) this.reticle.visible = false;
    this.placed = false;
    document.getElementById('ar-hint')?.classList.add('hidden');
    this.hitTestSource = null;
  }

  _updateAR(frame) {
    if (!frame || !this.hitTestSource) return;
    const refSpace = this.renderer.xr.getReferenceSpace();
    const results = frame.getHitTestResults(this.hitTestSource);
    if (results.length && !this.placed) {
      const pose = results[0].getPose(refSpace);
      this.reticle.visible = true;
      this.reticle.matrix.fromArray(pose.transform.matrix);
    } else if (this.placed) {
      this.reticle.visible = false;
    }
  }

  // ---- Animation loop ------------------------------------------------------

  start() {
    this.renderer.setAnimationLoop((time, frame) => this._tick(time, frame));
  }

  _tick(time, frame) {
    const dt = Math.min(0.05, this.clock.getDelta()); // seconds
    const days = dt * this.timeScale;
    this.simTime += days;

    // Sun rotation
    const sun = this.bodies.get('sun');
    if (sun) sun.mesh.rotation.y += dt * 0.02;

    // Planets / dwarfs / moons
    for (const [id, entry] of this.bodies) {
      if (id === 'sun') continue;
      const d = entry.data;
      // Orbital motion
      const orbitalDays = Math.abs(d.orbitalDays || 365);
      const orbitalRate = (Math.PI * 2) / orbitalDays;
      entry.orbitGroup.rotation.y += orbitalRate * days * (d.orbitalDays < 0 ? -1 : 1);

      // Self rotation
      const rotHours = d.rotationHours || 24;
      const spinPerDay = (Math.PI * 2) / (Math.abs(rotHours) / 24);
      entry.object3D.rotation.y += spinPerDay * days * (rotHours < 0 ? -1 : 1);

      if (entry.clouds) entry.clouds.rotation.y += spinPerDay * days * 0.3;
    }

    // Camera follow: keep the OrbitControls target glued to the body and
    // shift the camera by the same delta so its relative offset is preserved.
    if (this.followTarget && this.followTarget.object3D && !this._tweening) {
      const newTarget = new THREE.Vector3();
      this.followTarget.object3D.getWorldPosition(newTarget);
      const delta = newTarget.clone().sub(this.controls.target);
      this.controls.target.copy(newTarget);
      this.camera.position.add(delta);
    }

    // AR hit testing
    if (frame) this._updateAR(frame);

    this.controls.update();
    this._updateLabels();

    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  getBody(id) { return this.bodies.get(id); }
  bodyList() {
    const out = [];
    for (const [id, e] of this.bodies) out.push({ id, name: e.data.name, type: e.data.type });
    return out;
  }
}
