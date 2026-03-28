/* ─────────────────────────────────────────────
   three-scene.js — Hero 3D Background
   Starfield · Floating geometries · Bloom · Mouse parallax
───────────────────────────────────────────── */
(function () {
  'use strict';

  let renderer, scene, camera, composer;
  let particles;
  let mouseX = 0, mouseY = 0;
  let camX = 0, camY = 0;
  let rafId;
  let clock;
  let inited = false;

  /* ────────────────────────────────── */
  function init(canvasId, opts) {
    const options = opts || {};
    const lite = options.lite || false;

    const canvas = document.getElementById(canvasId);
    if (!canvas || inited) return;
    inited = true;

    /* Renderer */
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: !lite,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = lite ? 0.9 : 1.2;
    renderer.outputEncoding = THREE.sRGBEncoding;

    /* Scene */
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04030f, lite ? 0.02 : 0.028);

    /* Camera */
    camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 120);
    camera.position.z = 9;

    /* Clock */
    clock = new THREE.Clock();

    /* Build scene */
    buildStarfield(lite ? 1500 : 3000);
    buildLights(lite);
    buildPostProcessing(lite);

    /* Events */
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    animate();
  }

  /* ── Starfield ─────────────────────────── */
  function buildStarfield(count) {
    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);

    const palette = [
      [1.0, 1.0, 1.0],   // white
      [0.78, 0.85, 1.0],  // blue-white
      [0.7,  0.55, 1.0],  // violet
      [1.0,  0.85, 0.7],  // warm
      [0.6,  0.8,  1.0],  // blue
    ];

    for (let i = 0; i < count; i++) {
      const r     = 18 + Math.random() * 45;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const col = palette[Math.floor(Math.random() * palette.length)];
      const brt = 0.5 + Math.random() * 0.5;
      colors[i * 3]     = col[0] * brt;
      colors[i * 3 + 1] = col[1] * brt;
      colors[i * 3 + 2] = col[2] * brt;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    particles = new THREE.Points(geo, mat);
    scene.add(particles);
  }

  /* ── Lights ─────────────────────────────── */
  function buildLights(lite) {
    scene.add(new THREE.AmbientLight(0x160830, lite ? 0.8 : 0.5));

    const key = new THREE.PointLight(0x7c3aed, lite ? 2 : 4, 22);
    key.position.set(-3, 3, 5);
    scene.add(key);

    if (!lite) {
      const fill = new THREE.PointLight(0xf59e0b, 2, 18);
      fill.position.set(5, -3, 4);
      scene.add(fill);

      const rim = new THREE.PointLight(0x06b6d4, 2.5, 14);
      rim.position.set(0, -5, 2);
      scene.add(rim);
    }
  }

  /* ── Post-Processing ────────────────────── */
  function buildPostProcessing(lite) {
    if (lite) return;
    if (!THREE.EffectComposer || !THREE.UnrealBloomPass) return;

    try {
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene, camera));

      const bloom = new THREE.UnrealBloomPass(
        new THREE.Vector2(innerWidth, innerHeight),
        1.4,   /* strength  */
        0.5,   /* radius    */
        0.12   /* threshold */
      );
      composer.addPass(bloom);
    } catch (e) {
      composer = null;
    }
  }

  /* ── Animation Loop ─────────────────────── */
  function animate() {
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    /* Slow starfield rotation */
    if (particles) {
      particles.rotation.y = t * 0.015;
      particles.rotation.x = Math.sin(t * 0.008) * 0.08;
    }

    /* Smooth camera parallax */
    camX += (mouseX * 1.8 - camX) * 0.04;
    camY += (mouseY * 1.2 - camY) * 0.04;
    camera.position.x = camX;
    camera.position.y = camY;
    camera.lookAt(0, 0, 0);

    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  /* ── Event Handlers ─────────────────────── */
  function onMouseMove(e) {
    mouseX = (e.clientX / innerWidth  - 0.5) * 2;
    mouseY = -(e.clientY / innerHeight - 0.5) * 1.5;
  }

  function onResize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
  }

  function destroy() {
    cancelAnimationFrame(rafId);
    document.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('resize', onResize);
    inited = false;
  }

  /* ── Public API ─────────────────────────── */
  window.ThreeScene = { init: init, destroy: destroy };
})();
