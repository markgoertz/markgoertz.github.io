"use strict";

/*────────────────────────────────────────────────────────────
  cosmos.js — Deep-space Three.js background
  Layers: far stars · mid stars · near stars · nebula clouds
  Driven by: page scroll (camera travel) + mouse (parallax)
────────────────────────────────────────────────────────────*/

(function () {
  const canvas = document.getElementById("cosmos-canvas");
  if (!canvas || typeof THREE === "undefined") return;

  // Respect prefers-reduced-motion
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* ── Scene setup ─────────────────────────────────────── */

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    200,
  );
  camera.position.set(0, 0, 15);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0); // fully transparent — body bg shows through

  /* ── Shaders ─────────────────────────────────────────── */

  // Stars: circular soft discs with twinkle
  const STAR_VERT = `
    attribute float aSize;
    attribute vec3  aColor;
    varying   vec3  vColor;
    varying   float vAlpha;
    uniform   float uTime;

    void main() {
      vColor = aColor;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float depth = max(-mv.z, 0.5);
      gl_PointSize = aSize * (140.0 / depth);
      gl_Position  = projectionMatrix * mv;
      // Subtle per-star twinkle
      vAlpha = 0.18 + 0.38 * abs(sin(uTime * 1.2 + position.x * 11.3 + position.y * 7.1));
    }
  `;

  const STAR_FRAG = `
    varying vec3  vColor;
    varying float vAlpha;

    void main() {
      vec2  c    = gl_PointCoord - 0.5;
      float dist = length(c);
      if (dist > 0.5) discard;
      float alpha = smoothstep(0.5, 0.05, dist) * vAlpha;
      gl_FragColor = vec4(vColor, alpha);
    }
  `;

  // Nebula: large, extremely soft clouds — alpha is kept very low,
  // additive blending causes them to accumulate into luminous masses
  const NEBULA_VERT = `
    attribute float aSize;
    attribute vec3  aColor;
    varying   vec3  vColor;

    void main() {
      vColor = aColor;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float depth = max(-mv.z, 0.5);
      gl_PointSize = aSize * (350.0 / depth);
      gl_Position  = projectionMatrix * mv;
    }
  `;

  const NEBULA_FRAG = `
    varying vec3 vColor;

    void main() {
      vec2  c    = gl_PointCoord - 0.5;
      float dist = length(c);
      if (dist > 0.5) discard;
      float alpha = smoothstep(0.5, 0.0, dist) * 0.042;
      gl_FragColor = vec4(vColor, alpha);
    }
  `;

  /* ── Gaussian helper ─────────────────────────────────── */

  function gauss(mean, sigma) {
    // Box-Muller transform
    const u1 = Math.max(Math.random(), 1e-10);
    const u2 = Math.random();
    return (
      mean + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    );
  }

  /* ── Star layer factory ──────────────────────────────── */

  function makeStars(count, minR, maxR, minSz, maxSz, colorFn) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Uniform sphere distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = minR + Math.random() * (maxR - minR);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      const c = colorFn();
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;

      sz[i] = minSz + Math.random() * (maxSz - minSz);
    }

    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sz, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return new THREE.Points(geo, mat);
  }

  /* ── Nebula cluster factory ──────────────────────────── */

  function makeNebula(count, cx, cy, cz, sx, sy, sz, colA, colB) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);

    const ca = new THREE.Color(colA);
    const cb = new THREE.Color(colB);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = gauss(cx, sx);
      pos[i * 3 + 1] = gauss(cy, sy);
      pos[i * 3 + 2] = gauss(cz, sz);

      const t = Math.random();
      const c = ca.clone().lerp(cb, t);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;

      siz[i] = 4 + Math.random() * 18;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return new THREE.Points(geo, mat);
  }

  /* ── Build scene ─────────────────────────────────────── */

  // Distant stars — tiny, white/blue-white, barely move
  const farStars = makeStars(900, 45, 95, 0.1, 0.35, () => {
    const v = 0.78 + Math.random() * 0.22;
    return new THREE.Color(v, v, Math.min(v + 0.08, 1));
  });

  // Mid stars — slightly larger, some color tints
  const midStars = makeStars(160, 25, 50, 0.28, 0.65, () => {
    const r = Math.random();
    if (r < 0.55) return new THREE.Color(0.88, 0.93, 1.0); // blue-white
    if (r < 0.8) return new THREE.Color(0.6, 0.72, 1.0); // blue
    return new THREE.Color(0.75, 0.52, 1.0); // soft violet
  });

  // Near stars — large, bright, most parallax
  const nearStars = makeStars(20, 14, 28, 0.55, 1.2, () => {
    const r = Math.random();
    if (r < 0.5) return new THREE.Color(0.88, 0.9, 1.0);
    if (r < 0.8) return new THREE.Color(0.55, 0.68, 1.0);
    return new THREE.Color(0.7, 0.48, 1.0);
  });

  // ── Nebula clouds: balanced visibility ──

  // Main indigo nebula — centered, visible on load
  const neb1 = makeNebula(2000, -2, 2, -22, 10, 8, 12, "#5b5edb", "#8b5cf6");

  // Deep violet cloud
  const neb2 = makeNebula(1600, 8, -2, -30, 12, 10, 14, "#8b5cf6", "#a855f7");

  // Purple-blue cloud
  const neb3 = makeNebula(1400, -8, -6, -40, 14, 10, 14, "#7c3aed", "#6366f1");

  // Distant faint purple haze
  const neb4 = makeNebula(1000, 4, 6, -50, 12, 9, 12, "#a855f7", "#c084fc");

  // Accent cyan wisps near centre
  const neb5 = makeNebula(600, 1, -3, -18, 6, 5, 7, "#1e9ab0", "#22d3ee");

  scene.add(farStars, midStars, nearStars, neb1, neb2, neb3, neb4, neb5);

  /* ── Reactive state ──────────────────────────────────── */

  let scrollY = 0;
  let lerpScroll = 0;

  let mouseX = 0;
  let mouseY = 0;
  let lerpMouseX = 0;
  let lerpMouseY = 0;

  window.addEventListener(
    "scroll",
    () => {
      scrollY = window.scrollY;
    },
    { passive: true },
  );
  window.addEventListener(
    "mousemove",
    (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    },
    { passive: true },
  );

  /* ── Resize ──────────────────────────────────────────── */

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener("resize", onResize);

  /* ── Animation loop ──────────────────────────────────── */

  function animate() {
    requestAnimationFrame(animate);

    const t = performance.now() * 0.001;

    // Smooth scroll interpolation (lag behind scroll for cinematic feel)
    lerpScroll += (scrollY - lerpScroll) * 0.055;

    // Smooth mouse interpolation
    lerpMouseX += (mouseX - lerpMouseX) * 0.038;
    lerpMouseY += (mouseY - lerpMouseY) * 0.038;

    // ── Update star twinkle uniforms ──
    farStars.material.uniforms.uTime.value = t;
    midStars.material.uniforms.uTime.value = t;
    nearStars.material.uniforms.uTime.value = t;

    // ── Camera: travel through space as user scrolls ──
    // Camera drifts slightly downward and forward
    camera.position.y = -lerpScroll * 0.001;
    camera.position.z = 15 - lerpScroll * 0.0022;

    // Mouse look (camera tilts slightly toward cursor)
    camera.rotation.y = lerpMouseX * -0.035;
    camera.rotation.x = lerpMouseY * 0.022;

    // ── Stars: ambient drift rotation ──
    farStars.rotation.y = t * 0.000035;
    midStars.rotation.y = t * 0.00008;
    nearStars.rotation.y = t * 0.0002;

    // ── Nebula: each cluster rotates independently + scroll parallax ──
    // Different rates create natural depth parallax as you scroll
    neb1.rotation.y = t * 0.000055 + lerpScroll * 0.000038;
    neb1.rotation.x = t * 0.000028;

    neb2.rotation.y = t * 0.000042 - lerpScroll * 0.00002;
    neb2.rotation.z = t * 0.000015;

    neb3.rotation.y = t * 0.000036 + lerpScroll * 0.000025;
    neb3.rotation.x = t * 0.000012;

    neb4.rotation.y = t * 0.000025 - lerpScroll * 0.000012;

    neb5.rotation.y = t * 0.00009 + lerpScroll * 0.000055;
    neb5.rotation.z = t * 0.00003;

    renderer.render(scene, camera);
  }

  animate();

  // Cleanup on unload
  window.addEventListener("beforeunload", () => {
    renderer.dispose();
    [farStars, midStars, nearStars, neb1, neb2, neb3, neb4, neb5].forEach(
      (obj) => {
        obj.geometry.dispose();
        obj.material.dispose();
      },
    );
  });
})();
