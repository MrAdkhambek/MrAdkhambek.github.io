(function () {
  'use strict';

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
