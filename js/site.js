/* =============================================================================
   VOYAIGE — page behaviour. Nav state, the how-it-works scroll, scroll reveal.

   No framework and no dependency. Every effect here degrades to "the content
   is simply visible", which is why the reveal class is applied by script
   rather than sitting in the stylesheet: a page whose JS never runs must not
   render blank.
============================================================================= */

(function () {
  'use strict';

  /* ── Nav ─────────────────────────────────────────────────────────────── */

  (function nav() {
    var el = document.getElementById('nav');
    if (!el) return;

    var SCROLLED_AT = 48;
    function update() { el.classList.toggle('scrolled', window.scrollY > SCROLLED_AT); }

    window.addEventListener('scroll', update, { passive: true });
    update();
  })();


  /* ── How it works — the phone follows the step you're reading ─────────
     One scroll listener drives both the active step and its progress bar.
     Below 860px the layout stacks and the sticky phone is out of the flow, so
     this does nothing and every step renders at full opacity (see the media
     query in site.css). ------------------------------------------------- */

  (function howItWorks() {
    var section = document.getElementById('how-it-works');
    var steps = document.querySelectorAll('.hiw-step');
    var screens = document.querySelectorAll('.phone-screen');
    if (!section || steps.length === 0 || screens.length === 0) return;

    var STACKED_BELOW = 860;
    var count = steps.length;
    var current = -1;

    function show(index) {
      if (index === current) return;
      current = index;
      for (var i = 0; i < count; i++) {
        steps[i].classList.toggle('active', i === index);
        if (screens[i]) screens[i].classList.toggle('active', i === index);
      }
    }

    function fill(index, ratio) {
      for (var i = 0; i < count; i++) {
        var bar = document.getElementById('fill-' + i);
        if (!bar) continue;
        bar.style.width = i < index ? '100%' : i === index ? (ratio * 100).toFixed(1) + '%' : '0%';
      }
    }

    function update() {
      if (window.innerWidth <= STACKED_BELOW) { show(0); fill(0, 1); return; }

      var box = section.getBoundingClientRect();
      var travel = box.height - window.innerHeight;
      if (travel <= 0) { show(0); fill(0, 1); return; }

      // 0 at the top of the section, 1 when its bottom reaches the viewport's.
      var progress = Math.min(1, Math.max(0, -box.top / travel));
      var scaled = progress * count;
      var index = Math.min(count - 1, Math.floor(scaled));

      show(index);
      fill(index, Math.min(1, scaled - index));
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();


  /* ── Scroll reveal ───────────────────────────────────────────────────── */

  (function reveal() {
    var items = document.querySelectorAll('.reveal');
    if (items.length === 0) return;

    // No observer, or the reader asked for less motion: show everything now.
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!('IntersectionObserver' in window) || reduced) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('visible');
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    items.forEach(function (item) { observer.observe(item); });
  })();
})();
