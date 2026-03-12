"use strict";

(function () {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;

  const isReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (isReducedMotion) return;

  let scene, camera, renderer, particles, connections;
  let mouseX = 0;
  let mouseY = 0;
  let targetRotationX = 0;
  let targetRotationY = 0;
  let animationId;
  let isVisible = true;

  const PARTICLE_COUNT = 80;
  const CONNECTION_DISTANCE = 2.2;
  const ROTATION_SPEED = 0.0003;
  const MOUSE_INFLUENCE = 0.00015;

  const colors = {
    primary: 0x6366f1,
    secondary: 0x8b5cf6,
    accent: 0x22d3ee,
  };

  function init() {
    scene = new THREE.Scene();

    const aspect = canvas.clientWidth / canvas.clientHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
    camera.position.z = 6;

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    createParticles();
    createConnections();

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);

    observeVisibility();
    animate();
  }

  function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const particleColors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);

    const colorOptions = [
      new THREE.Color(colors.primary),
      new THREE.Color(colors.secondary),
      new THREE.Color(colors.accent),
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 2 + Math.random() * 1.5;

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      const color =
        colorOptions[Math.floor(Math.random() * colorOptions.length)];
      particleColors[i3] = color.r;
      particleColors[i3 + 1] = color.g;
      particleColors[i3 + 2] = color.b;

      sizes[i] = 0.04 + Math.random() * 0.06;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(particleColors, 3),
    );
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
				attribute float size;
				attribute vec3 color;
				varying vec3 vColor;
				varying float vAlpha;
				uniform float uTime;
				
				void main() {
					vColor = color;
					vec3 pos = position;
					
					float wave = sin(uTime * 0.5 + position.x * 0.5 + position.y * 0.5) * 0.1;
					pos += normalize(position) * wave;
					
					vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
					gl_PointSize = size * (300.0 / -mvPosition.z);
					gl_Position = projectionMatrix * mvPosition;
					
					vAlpha = 0.6 + 0.4 * sin(uTime + length(position));
				}
			`,
      fragmentShader: `
				varying vec3 vColor;
				varying float vAlpha;
				
				void main() {
					float dist = length(gl_PointCoord - vec2(0.5));
					if (dist > 0.5) discard;
					
					float alpha = smoothstep(0.5, 0.1, dist) * vAlpha;
					gl_FragColor = vec4(vColor, alpha);
				}
			`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
  }

  function createConnections() {
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = new Float32Array(PARTICLE_COUNT * PARTICLE_COUNT * 6);
    const lineColors = new Float32Array(PARTICLE_COUNT * PARTICLE_COUNT * 6);

    lineGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(linePositions, 3),
    );
    lineGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(lineColors, 3),
    );

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
    });

    connections = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(connections);
  }

  function updateConnections() {
    const positions = particles.geometry.attributes.position.array;
    const linePositions = connections.geometry.attributes.position.array;
    const lineColors = connections.geometry.attributes.color.array;

    let lineIndex = 0;
    const connectionColor = new THREE.Color(colors.primary);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = positions[i * 3];
      const iy = positions[i * 3 + 1];
      const iz = positions[i * 3 + 2];

      for (let j = i + 1; j < PARTICLE_COUNT; j++) {
        const jx = positions[j * 3];
        const jy = positions[j * 3 + 1];
        const jz = positions[j * 3 + 2];

        const dx = ix - jx;
        const dy = iy - jy;
        const dz = iz - jz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < CONNECTION_DISTANCE) {
          const alpha = 1 - dist / CONNECTION_DISTANCE;

          linePositions[lineIndex * 6] = ix;
          linePositions[lineIndex * 6 + 1] = iy;
          linePositions[lineIndex * 6 + 2] = iz;
          linePositions[lineIndex * 6 + 3] = jx;
          linePositions[lineIndex * 6 + 4] = jy;
          linePositions[lineIndex * 6 + 5] = jz;

          lineColors[lineIndex * 6] = connectionColor.r * alpha;
          lineColors[lineIndex * 6 + 1] = connectionColor.g * alpha;
          lineColors[lineIndex * 6 + 2] = connectionColor.b * alpha;
          lineColors[lineIndex * 6 + 3] = connectionColor.r * alpha;
          lineColors[lineIndex * 6 + 4] = connectionColor.g * alpha;
          lineColors[lineIndex * 6 + 5] = connectionColor.b * alpha;

          lineIndex++;
        }
      }
    }

    connections.geometry.setDrawRange(0, lineIndex * 2);
    connections.geometry.attributes.position.needsUpdate = true;
    connections.geometry.attributes.color.needsUpdate = true;
  }

  function animate() {
    if (!isVisible) {
      animationId = requestAnimationFrame(animate);
      return;
    }

    const time = performance.now() * 0.001;

    particles.material.uniforms.uTime.value = time;

    targetRotationY += (mouseX * MOUSE_INFLUENCE - targetRotationY) * 0.05;
    targetRotationX += (mouseY * MOUSE_INFLUENCE - targetRotationX) * 0.05;

    particles.rotation.y += ROTATION_SPEED + targetRotationY;
    particles.rotation.x = targetRotationX;
    connections.rotation.y = particles.rotation.y;
    connections.rotation.x = particles.rotation.x;

    updateConnections();

    renderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
  }

  function onResize() {
    if (!canvas.clientWidth || !canvas.clientHeight) return;

    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  }

  function onMouseMove(event) {
    mouseX = event.clientX - window.innerWidth / 2;
    mouseY = event.clientY - window.innerHeight / 2;
  }

  function observeVisibility() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
        });
      },
      { threshold: 0.1 },
    );

    observer.observe(canvas);
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    window.removeEventListener("resize", onResize);
    window.removeEventListener("mousemove", onMouseMove);

    if (particles) {
      particles.geometry.dispose();
      particles.material.dispose();
    }
    if (connections) {
      connections.geometry.dispose();
      connections.material.dispose();
    }
    if (renderer) {
      renderer.dispose();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("beforeunload", cleanup);
})();
