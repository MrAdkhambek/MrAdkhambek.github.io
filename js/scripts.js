(function () {
  'use strict';

  // ===== Three.js Neural Network Background =====
  var container = document.getElementById('neural-bg');
  if (container && typeof THREE !== 'undefined' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {

    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.z = 10;

    var LAYER_SIZES = [3, 5, 5, 3];
    var LINE_COLOR = new THREE.Color(0x284f82);
    var NODE_COLOR = new THREE.Color(0x284f82);
    var PULSE_COLOR = new THREE.Color(0x4f9cf7);
    var LINE_ALPHA = 0.10;
    var NODE_ALPHA = 0.16;
    var PASS_INTERVAL = 3;

    var nodes = [];       // flat array of {pos: Vector3, activation: 0, layer: l}
    var connections = [];  // {from: idx, to: idx}
    var pulses = [];
    var passTimer = 0;

    // Three.js objects
    var linesMesh, nodesMesh, pulseMesh;
    var linePositions, lineColors;
    var nodePositions, nodeColors, nodeSizes;
    var pulsePositions, pulseColors, pulseSizes;
    var MAX_PULSES = 200;

    function buildNetwork() {
      nodes = [];
      connections = [];
      pulses = [];
      var aspect = window.innerWidth / window.innerHeight;
      var padX = 0.7;
      var padY = 0.7;
      var layerCount = LAYER_SIZES.length;
      var layerSpacing = (padX * 2) / (layerCount - 1);

      for (var l = 0; l < layerCount; l++) {
        var count = LAYER_SIZES[l];
        var x = -padX + l * layerSpacing;
        var nodeSpacing = (padY * 2) / (count + 1);
        for (var n = 0; n < count; n++) {
          var y = -padY + (n + 1) * nodeSpacing;
          nodes.push({ pos: new THREE.Vector3(x * aspect, y, 0), activation: 0, layer: l });
        }
      }

      // Fully connected adjacent layers
      var offset = 0;
      for (var l = 0; l < layerCount - 1; l++) {
        var nextOffset = offset + LAYER_SIZES[l];
        for (var a = 0; a < LAYER_SIZES[l]; a++) {
          for (var b = 0; b < LAYER_SIZES[l + 1]; b++) {
            connections.push({ from: offset + a, to: nextOffset + b });
          }
        }
        offset = nextOffset;
      }
    }

    function createLines() {
      var geo = new THREE.BufferGeometry();
      linePositions = new Float32Array(connections.length * 6);
      lineColors = new Float32Array(connections.length * 6);

      for (var i = 0; i < connections.length; i++) {
        var c = connections[i];
        var f = nodes[c.from].pos, t = nodes[c.to].pos;
        var idx = i * 6;
        linePositions[idx] = f.x; linePositions[idx+1] = f.y; linePositions[idx+2] = 0;
        linePositions[idx+3] = t.x; linePositions[idx+4] = t.y; linePositions[idx+5] = 0;
        for (var j = 0; j < 6; j += 3) {
          lineColors[idx+j] = LINE_COLOR.r;
          lineColors[idx+j+1] = LINE_COLOR.g;
          lineColors[idx+j+2] = LINE_COLOR.b;
        }
      }

      geo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

      var mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: LINE_ALPHA
      });
      linesMesh = new THREE.LineSegments(geo, mat);
      scene.add(linesMesh);
    }

    function createNodes() {
      var geo = new THREE.BufferGeometry();
      nodePositions = new Float32Array(nodes.length * 3);
      nodeColors = new Float32Array(nodes.length * 3);
      nodeSizes = new Float32Array(nodes.length);

      for (var i = 0; i < nodes.length; i++) {
        nodePositions[i*3] = nodes[i].pos.x;
        nodePositions[i*3+1] = nodes[i].pos.y;
        nodePositions[i*3+2] = 0;
        nodeColors[i*3] = NODE_COLOR.r;
        nodeColors[i*3+1] = NODE_COLOR.g;
        nodeColors[i*3+2] = NODE_COLOR.b;
        nodeSizes[i] = 20;
      }

      geo.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(nodeColors, 3));
      geo.setAttribute('size', new THREE.BufferAttribute(nodeSizes, 1));

      var mat = new THREE.ShaderMaterial({
        uniforms: { baseAlpha: { value: NODE_ALPHA } },
        vertexShader: [
          'attribute float size;',
          'attribute vec3 color;',
          'varying vec3 vColor;',
          'varying float vSize;',
          'void main() {',
          '  vColor = color;',
          '  vSize = size;',
          '  gl_PointSize = size;',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform float baseAlpha;',
          'varying vec3 vColor;',
          'void main() {',
          '  float d = length(gl_PointCoord - vec2(0.5));',
          '  if (d > 0.5) discard;',
          '  float edge = smoothstep(0.45, 0.5, d);',
          '  float ring = smoothstep(0.3, 0.4, d) * (1.0 - edge);',
          '  float alpha = baseAlpha + ring * 0.15;',
          '  gl_FragColor = vec4(vColor, alpha);',
          '}'
        ].join('\n'),
        transparent: true,
        depthTest: false
      });

      nodesMesh = new THREE.Points(geo, mat);
      scene.add(nodesMesh);
    }

    function createPulsePoints() {
      var geo = new THREE.BufferGeometry();
      pulsePositions = new Float32Array(MAX_PULSES * 3);
      pulseColors = new Float32Array(MAX_PULSES * 3);
      pulseSizes = new Float32Array(MAX_PULSES);

      geo.setAttribute('position', new THREE.BufferAttribute(pulsePositions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(pulseColors, 3));
      geo.setAttribute('size', new THREE.BufferAttribute(pulseSizes, 1));

      var mat = new THREE.ShaderMaterial({
        vertexShader: [
          'attribute float size;',
          'attribute vec3 color;',
          'varying vec3 vColor;',
          'void main() {',
          '  vColor = color;',
          '  gl_PointSize = size;',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'varying vec3 vColor;',
          'void main() {',
          '  float d = length(gl_PointCoord - vec2(0.5));',
          '  if (d > 0.5) discard;',
          '  float glow = 1.0 - d * 2.0;',
          '  gl_FragColor = vec4(vColor, glow * 0.5);',
          '}'
        ].join('\n'),
        transparent: true,
        depthTest: false
      });

      pulseMesh = new THREE.Points(geo, mat);
      scene.add(pulseMesh);
    }

    function spawnForwardPass() {
      var offset = 0;
      for (var l = 0; l < LAYER_SIZES.length - 1; l++) {
        var nextOffset = offset + LAYER_SIZES[l];
        for (var a = 0; a < LAYER_SIZES[l]; a++) {
          for (var b = 0; b < LAYER_SIZES[l + 1]; b++) {
            if (Math.random() > 0.4) continue;
            if (pulses.length >= MAX_PULSES) return;
            pulses.push({
              from: offset + a,
              to: nextOffset + b,
              t: 0,
              speed: 0.012 + Math.random() * 0.008,
              delay: l * 0.6 + Math.random() * 0.3,
              age: 0
            });
          }
        }
        offset = nextOffset;
      }
    }

    function update(dt) {
      passTimer += dt;
      if (passTimer > PASS_INTERVAL) {
        passTimer = 0;
        spawnForwardPass();
      }

      // Decay activations
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].activation *= 0.95;
      }

      // Update node sizes based on activation
      for (var i = 0; i < nodes.length; i++) {
        nodeSizes[i] = 20 + nodes[i].activation * 12;
        var a = nodes[i].activation;
        nodeColors[i*3] = NODE_COLOR.r + (PULSE_COLOR.r - NODE_COLOR.r) * a;
        nodeColors[i*3+1] = NODE_COLOR.g + (PULSE_COLOR.g - NODE_COLOR.g) * a;
        nodeColors[i*3+2] = NODE_COLOR.b + (PULSE_COLOR.b - NODE_COLOR.b) * a;
      }
      nodesMesh.geometry.attributes.size.needsUpdate = true;
      nodesMesh.geometry.attributes.color.needsUpdate = true;

      // Update pulses
      var active = 0;
      for (var p = pulses.length - 1; p >= 0; p--) {
        var pulse = pulses[p];
        pulse.age += dt;
        if (pulse.age < pulse.delay) continue;
        pulse.t += pulse.speed;
        if (pulse.t >= 1) {
          nodes[pulse.to].activation = Math.min(1, nodes[pulse.to].activation + 0.5);
          pulses.splice(p, 1);
          continue;
        }

        var f = nodes[pulse.from].pos, t = nodes[pulse.to].pos;
        var tt = pulse.t;
        var glow = Math.sin(tt * Math.PI);
        pulsePositions[active*3] = f.x + (t.x - f.x) * tt;
        pulsePositions[active*3+1] = f.y + (t.y - f.y) * tt;
        pulsePositions[active*3+2] = 0;
        pulseColors[active*3] = PULSE_COLOR.r;
        pulseColors[active*3+1] = PULSE_COLOR.g;
        pulseColors[active*3+2] = PULSE_COLOR.b;
        pulseSizes[active] = 8 + glow * 8;
        active++;
      }

      // Zero out unused pulse slots
      for (var i = active; i < MAX_PULSES; i++) {
        pulseSizes[i] = 0;
      }

      pulseMesh.geometry.attributes.position.needsUpdate = true;
      pulseMesh.geometry.attributes.color.needsUpdate = true;
      pulseMesh.geometry.attributes.size.needsUpdate = true;
      pulseMesh.geometry.setDrawRange(0, active);
    }

    function onResize() {
      var w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h);
      var aspect = w / h;
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();

      // Rebuild node positions for new aspect
      scene.remove(linesMesh);
      scene.remove(nodesMesh);
      scene.remove(pulseMesh);
      linesMesh.geometry.dispose();
      nodesMesh.geometry.dispose();
      pulseMesh.geometry.dispose();

      buildNetwork();
      createLines();
      createNodes();
      createPulsePoints();
    }

    buildNetwork();
    createLines();
    createNodes();
    createPulsePoints();
    spawnForwardPass();

    var clock = new THREE.Clock();

    function animate() {
      var dt = Math.min(clock.getDelta(), 0.1);
      update(dt);
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    // Set initial camera
    var aspect = window.innerWidth / window.innerHeight;
    camera.left = -aspect;
    camera.right = aspect;
    camera.updateProjectionMatrix();

    animate();
    window.addEventListener('resize', onResize);
  }

  // ===== Scroll Reveal =====
  var reveals = document.querySelectorAll('.reveal');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    reveals.forEach(function (el) { el.classList.add('visible'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    reveals.forEach(function (el) { revealObserver.observe(el); });
  }

  // ===== Scroll Spy for Nav =====
  var navLinks = document.querySelectorAll('.nav-links a');
  var sections = [];

  navLinks.forEach(function (link) {
    var id = link.getAttribute('href').slice(1);
    var section = document.getElementById(id);
    if (section) sections.push({ el: section, link: link });
  });

  var spyObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        navLinks.forEach(function (l) { l.classList.remove('active'); });
        sections.forEach(function (s) {
          if (s.el === entry.target) s.link.classList.add('active');
        });
      }
    });
  }, { rootMargin: '-40% 0px -60% 0px' });

  sections.forEach(function (s) { spyObserver.observe(s.el); });

  // ===== Close mobile nav on link click =====
  var navToggle = document.getElementById('nav-toggle');

  navLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      if (navToggle) navToggle.checked = false;
    });
  });

  // ===== Smooth scroll for nav links (fallback) =====
  navLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = this.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
})();
