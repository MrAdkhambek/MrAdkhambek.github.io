(function () {
  'use strict';

  // ===== Neural Network Background =====
  var canvas = document.getElementById('neural-bg');
  if (canvas && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var ctx = canvas.getContext('2d');
    var layers = [];       // array of arrays of {x, y}
    var connections = [];   // {from: node, to: node, layerIdx}
    var pulses = [];
    var nodeActivations = []; // per-node glow intensity

    // Layer config: [input, hidden1, hidden2, hidden3, output]
    var LAYER_SIZES = [4, 6, 8, 6, 4];
    var NODE_R = 10;
    var LINE_ALPHA = 0.02;
    var NODE_ALPHA = 0.05;
    var aR = 40, aG = 80, aB = 130; // muted dark blue

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      buildNetwork();
    }

    function buildNetwork() {
      layers = [];
      connections = [];
      pulses = [];
      nodeActivations = [];
      var w = canvas.width, h = canvas.height;
      var padX = w * 0.12;
      var padY = h * 0.15;
      var usableW = w - padX * 2;
      var usableH = h - padY * 2;
      var layerCount = LAYER_SIZES.length;
      var layerSpacing = usableW / (layerCount - 1);

      for (var l = 0; l < layerCount; l++) {
        var count = LAYER_SIZES[l];
        var x = padX + l * layerSpacing;
        var nodeSpacing = usableH / (count + 1);
        var layerNodes = [];
        for (var n = 0; n < count; n++) {
          var y = padY + (n + 1) * nodeSpacing;
          layerNodes.push({ x: x, y: y, activation: 0 });
        }
        layers.push(layerNodes);
      }

      // Build fully-connected edges between adjacent layers
      for (var l = 0; l < layers.length - 1; l++) {
        for (var a = 0; a < layers[l].length; a++) {
          for (var b = 0; b < layers[l + 1].length; b++) {
            connections.push({
              from: layers[l][a],
              to: layers[l + 1][b],
              layerIdx: l
            });
          }
        }
      }
    }

    // Forward pass: spawn pulses from input layer through all layers
    function spawnForwardPass() {
      var startLayer = 0;
      var delay = 0;
      for (var l = 0; l < layers.length - 1; l++) {
        for (var a = 0; a < layers[l].length; a++) {
          for (var b = 0; b < layers[l + 1].length; b++) {
            // Only fire ~40% of connections per pass for variety
            if (Math.random() > 0.4) continue;
            pulses.push({
              from: layers[l][a],
              to: layers[l + 1][b],
              t: 0,
              speed: 0.012 + Math.random() * 0.008,
              delay: l * 0.6 + Math.random() * 0.3,
              age: 0
            });
          }
        }
      }
    }

    var passTimer = 0;
    var PASS_INTERVAL = 3; // seconds between forward passes

    function update(dt) {
      passTimer += dt;
      if (passTimer > PASS_INTERVAL) {
        passTimer = 0;
        spawnForwardPass();
      }

      // Decay all node activations
      for (var l = 0; l < layers.length; l++) {
        for (var n = 0; n < layers[l].length; n++) {
          layers[l][n].activation *= 0.95;
        }
      }

      // Update pulses
      for (var p = pulses.length - 1; p >= 0; p--) {
        var pulse = pulses[p];
        pulse.age += dt;
        if (pulse.age < pulse.delay) continue;
        pulse.t += pulse.speed;
        if (pulse.t >= 1) {
          // Activate target node
          pulse.to.activation = Math.min(1, pulse.to.activation + 0.5);
          pulses.splice(p, 1);
        }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections
      ctx.lineWidth = 0.8;
      for (var i = 0; i < connections.length; i++) {
        var c = connections[i];
        ctx.beginPath();
        ctx.moveTo(c.from.x, c.from.y);
        ctx.lineTo(c.to.x, c.to.y);
        ctx.strokeStyle = 'rgba(' + aR + ',' + aG + ',' + aB + ',' + LINE_ALPHA + ')';
        ctx.stroke();
      }

      // Draw active pulses
      for (var p = 0; p < pulses.length; p++) {
        var pulse = pulses[p];
        if (pulse.age < pulse.delay) continue;
        var t = pulse.t;
        var px = pulse.from.x + (pulse.to.x - pulse.from.x) * t;
        var py = pulse.from.y + (pulse.to.y - pulse.from.y) * t;
        var glow = Math.sin(t * Math.PI);

        // Bright line trail
        ctx.beginPath();
        ctx.moveTo(pulse.from.x, pulse.from.y);
        ctx.lineTo(px, py);
        ctx.strokeStyle = 'rgba(' + aR + ',' + aG + ',' + aB + ',' + (glow * 0.1) + ')';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Pulse dot
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + aR + ',' + aG + ',' + aB + ',' + (glow * 0.4) + ')';
        ctx.fill();
      }
      ctx.lineWidth = 0.8;

      // Draw nodes
      for (var l = 0; l < layers.length; l++) {
        for (var n = 0; n < layers[l].length; n++) {
          var node = layers[l][n];
          var act = node.activation;

          // Glow ring when activated
          if (act > 0.05) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, NODE_R + 6, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(' + aR + ',' + aG + ',' + aB + ',' + (act * 0.06) + ')';
            ctx.fill();
          }

          // Node circle (outlined)
          ctx.beginPath();
          ctx.arc(node.x, node.y, NODE_R, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(' + aR + ',' + aG + ',' + aB + ',' + (NODE_ALPHA + act * 0.15) + ')';
          ctx.fill();
          ctx.strokeStyle = 'rgba(' + aR + ',' + aG + ',' + aB + ',' + (0.1 + act * 0.2) + ')';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    }

    var lastTime = performance.now();
    function loop(now) {
      var dt = (now - lastTime) / 1000;
      lastTime = now;
      if (dt > 0.1) dt = 0.016; // cap large jumps
      update(dt);
      draw();
      requestAnimationFrame(loop);
    }

    resize();
    spawnForwardPass();
    requestAnimationFrame(loop);

    window.addEventListener('resize', function () { resize(); });
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
