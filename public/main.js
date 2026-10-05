/* =========================================================
   ADJOIN interactions
   ========================================================= */
(function () {
  "use strict";
  var doc = document;
  var win = window;
  var body = doc.body;
  var reduceMotion = win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVGNS = "http://www.w3.org/2000/svg";
  var toArray = function (list) { return Array.prototype.slice.call(list); };
  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

  /* ---- Year ---- */
  var yearEl = doc.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---- Mobile menu ---- */
  var toggle = doc.getElementById("menuToggle");
  var menu = doc.getElementById("mobileMenu");
  var menuLinks = menu ? toArray(menu.querySelectorAll("a")) : [];

  function closeMenu(returnFocus) {
    if (!menu || !toggle) return;
    var wasOpen = menu.classList.contains("open");
    menu.classList.remove("open");
    menu.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    body.classList.remove("menu-open");
    if (returnFocus && wasOpen) toggle.focus();
  }
  function openMenu() {
    menu.classList.add("open");
    menu.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    body.classList.add("menu-open");
    if (menuLinks[0]) menuLinks[0].focus();
  }
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      if (menu.classList.contains("open")) closeMenu(true); else openMenu();
    });
    menuLinks.forEach(function (a) { a.addEventListener("click", function () { closeMenu(false); }); });
    doc.addEventListener("keydown", function (e) {
      if (!menu.classList.contains("open")) return;
      if (e.key === "Escape") { closeMenu(true); return; }
      if (e.key === "Tab") {
        var f = [toggle].concat(menuLinks), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---- Active nav link ---- */
  var navLinks = toArray(doc.querySelectorAll(".nav-desktop a[href^='#']"));
  if (navLinks.length && "IntersectionObserver" in win) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          if (a.getAttribute("href") === "#" + entry.target.id) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    navLinks.forEach(function (a) {
      var s = doc.getElementById(a.getAttribute("href").slice(1));
      if (s) spy.observe(s);
    });
  }

  /* =========================================================
     Hero headline cycle on a set timer. It holds while hovered,
     off screen, in a background tab, or paused from the keyboard.
     ========================================================= */
  var heroTitle = doc.getElementById("hero-title");
  var heroSlides = heroTitle ? toArray(heroTitle.querySelectorAll(".hero-slide")) : [];
  var heroPause = doc.getElementById("heroPause");
  if (heroSlides.length > 1 && !reduceMotion) {
    var SLIDE_MS = 4500;
    var FIRST_DELAY_MS = 1200;
    var currentSlide = 0;
    var leaveTimer = 0;
    var cycleTimer = 0;
    var remaining = SLIDE_MS + FIRST_DELAY_MS;
    var runningSince = 0;
    var held = { paused: false, hover: false, offscreen: false };
    if (heroPause) heroPause.hidden = false;

    var cycleHeld = function () {
      return doc.hidden || held.paused || held.hover || held.offscreen;
    };
    var holdCycle = function () {
      if (!runningSince) return;
      remaining = Math.max(0, remaining - (performance.now() - runningSince));
      runningSince = 0;
      win.clearTimeout(cycleTimer);
    };
    var runCycle = function () {
      win.clearTimeout(cycleTimer);
      runningSince = 0;
      if (cycleHeld()) return;
      runningSince = performance.now();
      cycleTimer = win.setTimeout(function () {
        runningSince = 0;
        showSlide((currentSlide + 1) % heroSlides.length);
      }, remaining);
    };

    var showSlide = function (next) {
      var from = heroSlides[currentSlide];
      var to = heroSlides[next];
      heroSlides.forEach(function (s) { if (s !== from) s.classList.remove("is-leaving"); });
      to.classList.add("is-entering", "is-active");
      void to.offsetWidth;
      to.classList.remove("is-entering");
      from.classList.remove("is-active");
      from.classList.add("is-leaving");
      win.clearTimeout(leaveTimer);
      leaveTimer = win.setTimeout(function () { from.classList.remove("is-leaving"); }, 1200);
      currentSlide = next;
      remaining = SLIDE_MS;
      runCycle();
    };

    var setHeld = function (key, value) {
      held[key] = value;
      if (cycleHeld()) holdCycle(); else if (!runningSince) runCycle();
    };

    heroTitle.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") setHeld("hover", true); });
    heroTitle.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") setHeld("hover", false); });

    if (heroPause) {
      heroPause.addEventListener("click", function () {
        var paused = !held.paused;
        heroPause.setAttribute("aria-pressed", paused ? "true" : "false");
        heroPause.textContent = paused ? "Play headlines" : "Pause headlines";
        setHeld("paused", paused);
      });
    }

    if ("IntersectionObserver" in win) {
      new IntersectionObserver(function (entries) {
        setHeld("offscreen", !entries[0].isIntersecting);
      }).observe(heroTitle);
    }
    doc.addEventListener("visibilitychange", function () { setHeld("tab", doc.hidden); });

    runCycle();
  }

  /* =========================================================
     Scroll reveals. Only content below the fold at load is
     ever hidden, so nothing ships blank if this never runs.
     ========================================================= */
  var revealEls = toArray(doc.querySelectorAll("[data-reveal]"));
  if (!reduceMotion && "IntersectionObserver" in win && !doc.hidden) {
    var vh0 = win.innerHeight;
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        (entry.target.__reveal || entry.target).classList.remove("rv-pending");
        revealer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
    revealEls.forEach(function (el) {
      if (el.getBoundingClientRect().top > vh0 * 0.92) {
        el.classList.add("rv-pending");
        // A fully clipped element never intersects, so watch its parent instead.
        var watch = el.getAttribute("data-reveal") === "clip" ? el.parentNode : el;
        watch.__reveal = el;
        revealer.observe(watch);
      }
    });
    win.addEventListener("beforeprint", function () {
      revealEls.forEach(function (el) { el.classList.remove("rv-pending"); });
    });
  }

  /* =========================================================
     Scroll-linked: header rule, hero drift, steps line
     ========================================================= */
  var header = doc.getElementById("siteHeader");
  var heroVisual = doc.getElementById("heroVisual");
  var drifters = heroVisual ? toArray(heroVisual.querySelectorAll(".hv[data-depth]")).map(function (el) {
    return { el: el, depth: parseFloat(el.getAttribute("data-depth")) || 0 };
  }) : [];
  var steps = doc.getElementById("steps");
  var stepItems = steps ? toArray(steps.querySelectorAll("li")) : [];
  if (steps && !reduceMotion) steps.classList.add("js-progress");

  function updateSteps() {
    if (!steps || reduceMotion) return;
    var r = steps.getBoundingClientRect();
    var span = Math.max(1, r.height - 56);
    var p = clamp((win.innerHeight * 0.62 - (r.top + 28)) / span, 0, 1);
    steps.style.setProperty("--p", p.toFixed(4));
    var reach = p * span;
    stepItems.forEach(function (li) {
      li.classList.toggle("is-reached", reach >= li.offsetTop - 2);
    });
  }

  // The collage only drifts when it sits beside the copy; stacked on small screens it holds still.
  var wideHero = win.matchMedia ? win.matchMedia("(min-width: 941px)") : { matches: true };
  // "Big unit. Small business. Share it." slides together as the band scrolls in.
  var statement = doc.getElementById("statement");
  function updateStatement() {
    if (!statement || reduceMotion) return;
    var r = statement.getBoundingClientRect();
    var vh = win.innerHeight;
    if (r.top > vh || r.bottom < 0) return;
    var p = clamp((vh - r.top) / (vh * 0.7), 0, 1);
    statement.style.setProperty("--sp", (1 - Math.pow(1 - p, 3)).toFixed(4));
    statement.style.setProperty("--sd", clamp((p - 0.75) / 0.25, 0, 1).toFixed(3));
  }

  var scrollQueued = false;
  function onScrollFrame() {
    scrollQueued = false;
    var y = win.scrollY;
    if (header) header.classList.toggle("scrolled", y > 8);
    if (!reduceMotion && y < win.innerHeight * 1.4) {
      var drift = wideHero.matches ? y : 0;
      drifters.forEach(function (d) { d.el.style.setProperty("--py", (drift * d.depth).toFixed(1) + "px"); });
    }
    updateStatement();
    updateSteps();
  }
  function queueScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    win.requestAnimationFrame(onScrollFrame);
  }
  win.addEventListener("scroll", queueScroll, { passive: true });
  win.addEventListener("resize", queueScroll);
  onScrollFrame();

  /* =========================================================
     The space: an abstract plan of one building, shared.
     Sections vary in size, overlap and reshuffle, because no
     two groups (or buildings) split the same way.
     ========================================================= */
  var plan = doc.getElementById("plan");
  var planStage = doc.getElementById("planStage");
  var planDesc = doc.getElementById("planDesc");
  var fracEl = doc.getElementById("splitFrac");
  var mainEl = doc.getElementById("splitMain");
  var subEl = doc.getElementById("splitSub");
  var shareSelect = doc.getElementById("share");
  var workTypeSelect = doc.getElementById("workType");
  var splitOptions = doc.getElementById("splitOptions");
  var shuffleBtn = doc.getElementById("shuffle");

  // Sections as fractions of the building's floor: [x, y, w, h, corner radius]. Zone 0 is always "You".
  var LAYOUTS = {
    1: [
      [[0, 0, 1, 1, 6]],
      [[0, 0, 1, 1, 34]]
    ],
    2: [
      [[0, 0, 0.577, 1, 6], [0.5, 0.113, 0.5, 0.887, 30]],
      [[0, 0.351, 0.481, 0.649, 30], [0, 0, 1, 0.476, 4]],
      [[0.404, 0, 0.596, 0.595, 4], [0, 0.321, 0.692, 0.679, 28]]
    ],
    3: [
      [[0, 0, 0.404, 0.595, 4], [0.346, 0, 0.654, 0.446, 28], [0.212, 0.411, 0.788, 0.589, 4]],
      [[0.558, 0.44, 0.442, 0.56, 28], [0, 0, 0.577, 1, 4], [0.5, 0, 0.5, 0.524, 12]],
      [[0, 0.548, 0.481, 0.452, 4], [0, 0, 0.385, 0.625, 28], [0.327, 0.173, 0.673, 0.827, 4]]
    ],
    4: [
      [[0, 0, 0.346, 0.506, 4], [0.3, 0, 0.7, 0.357, 28], [0, 0.429, 0.481, 0.571, 4], [0.427, 0.292, 0.573, 0.708, 20]],
      [[0.654, 0.583, 0.346, 0.417, 28], [0, 0, 0.423, 0.565, 4], [0.377, 0, 0.623, 0.655, 4], [0, 0.488, 0.704, 0.512, 24]],
      [[0.308, 0.262, 0.385, 0.446, 28], [0, 0, 0.481, 0.357, 4], [0.5, 0, 0.5, 0.565, 4], [0, 0.321, 0.365, 0.679, 4]]
    ],
    5: [
      [[0, 0, 0.288, 0.446, 4], [0.25, 0, 0.385, 0.387, 28], [0.596, 0, 0.404, 0.625, 4], [0, 0.393, 0.462, 0.607, 20], [0.415, 0.321, 0.385, 0.679, 4]],
      [[0.731, 0.649, 0.269, 0.351, 28], [0, 0, 0.308, 1, 4], [0.269, 0, 0.731, 0.327, 4], [0.269, 0.268, 0.346, 0.476, 24], [0.377, 0.679, 0.385, 0.321, 4]],
      [[0.365, 0.351, 0.288, 0.357, 28], [0, 0, 0.423, 0.446, 4], [0.385, 0, 0.615, 0.417, 20], [0, 0.381, 0.404, 0.619, 4], [0.596, 0.351, 0.404, 0.649, 4]]
    ]
  };

  // Groups are formed by how people work, so each kind gets its own building and neighbours.
  var KINDS = {
    desk: {
      shell: { x: 110, y: 82, w: 380, h: 276, door: 64 },
      size: "Compact unit, around 150 m²",
      unit: "a compact unit", group: "studio and desk",
      radius: function (r) { return Math.max(r, 18); },
      patterns: ["dots", "grid", "lines"],
      names: ["Design studio", "Developer", "Mortgage broker", "Bookkeeper", "Architect", "Copywriter", "Photographer", "Consultant", "Remote team"],
      form: "Studio or desk",
      sub: "Sections are sized to what each business needs, next to people who keep similar hours and noise. Where they meet, you might share a meeting table or somewhere for lunch."
    },
    services: {
      shell: { x: 64, y: 58, w: 472, h: 320, door: 90 },
      size: "Mid-size unit, around 250 m²",
      unit: "a mid-size unit", group: "boutique service",
      radius: function (r) { return r; },
      patterns: ["hatch", "dots", "lines", "grid"],
      names: ["Barber", "PT studio", "Jeweller", "Beauty", "Physio", "Pilates", "Tattoo", "Massage", "Florist"],
      form: "Boutique service",
      sub: "Sections are sized to what each business needs, next to services whose clients overlap. Where they meet, you might share a waiting area or a kitchen."
    },
    workshop: {
      shell: { x: 24, y: 36, w: 552, h: 368, door: 140 },
      size: "Large unit, around 500 m²",
      unit: "a large unit", group: "workshop and trade",
      radius: function () { return 3; },
      patterns: ["hatch", "lines", "grid"],
      names: ["Joinery", "Fabrication", "Sign writer", "Cabinet maker", "Upholstery", "Bike repair", "Ceramics", "Auto detailing", "Electrician"],
      form: "Workshop or trade",
      sub: "Sections are sized to what each business needs, next to trades that can live with noise and dust. Where they meet, you might share a loading bay or a big bench."
    }
  };
  var PATTERN_FILL = { hatch: "url(#pHatch)", dots: "url(#pDots)", lines: "url(#pLines)", grid: "url(#pGrid)", you: "url(#pYou)" };
  var WORDS = ["", "one", "two", "three", "four", "five"];
  var MAX_ZONES = 5;

  function svg(name, attrs, text) {
    var n = doc.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  var zones = [];
  var inbetween = null;
  var planNotes = null;
  // Text inside the plan scales with the drawing, so boost it when the plan is drawn small.
  var labelScale = 1;
  function measureLabelScale() {
    var w = plan.getBoundingClientRect().width || 600;
    labelScale = clamp(560 / w, 1, 1.9);
    if (planNotes) planNotes.setAttribute("font-size", (11 * Math.min(labelScale, 1.5)).toFixed(1));
    if (inbetween) inbetween.setAttribute("font-size", (12.5 * labelScale).toFixed(1));
    if (shellEls.size) shellEls.size.setAttribute("font-size", (12.5 * Math.min(labelScale, 1.5)).toFixed(1));
  }
  var planState = { kind: "desk", n: 3, v: 0 };
  var tweenRaf = 0;
  var userTouched = false;
  var shellEls = {};
  var shellCur = null;
  var sizeText = "";

  function buildPlan() {
    var defs = svg("defs", {});
    var hatch = svg("pattern", { id: "pHatch", width: 8, height: 8, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    hatch.appendChild(svg("line", { x1: 0, y1: 0, x2: 0, y2: 8, stroke: "#111", "stroke-width": 1.1, "stroke-opacity": 0.36 }));
    var dots = svg("pattern", { id: "pDots", width: 10, height: 10, patternUnits: "userSpaceOnUse" });
    dots.appendChild(svg("circle", { cx: 5, cy: 5, r: 1.25, fill: "#111", "fill-opacity": 0.42 }));
    var lines = svg("pattern", { id: "pLines", width: 10, height: 9, patternUnits: "userSpaceOnUse" });
    lines.appendChild(svg("line", { x1: 0, y1: 4.5, x2: 10, y2: 4.5, stroke: "#111", "stroke-width": 1, "stroke-opacity": 0.3 }));
    var grid = svg("pattern", { id: "pGrid", width: 14, height: 14, patternUnits: "userSpaceOnUse" });
    grid.appendChild(svg("path", { d: "M14 0H0V14", fill: "none", stroke: "#111", "stroke-width": 0.9, "stroke-opacity": 0.28 }));
    var you = svg("pattern", { id: "pYou", width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(-45)" });
    you.appendChild(svg("line", { x1: 0, y1: 0, x2: 0, y2: 7, stroke: "#FF5F1F", "stroke-width": 1.4, "stroke-opacity": 0.6 }));
    defs.appendChild(hatch); defs.appendChild(dots); defs.appendChild(lines); defs.appendChild(grid); defs.appendChild(you);
    plan.appendChild(defs);

    var zoneLayer = svg("g", { "class": "zones" });
    var labelLayer = svg("g", { "class": "labels" });
    for (var i = 0; i < MAX_ZONES; i++) {
      var g = svg("g", { "class": "zone" + (i === 0 ? " is-you" : ""), opacity: 0 });
      var base = svg("rect", { "class": "z-base" });
      var pat = svg("rect", { "class": "z-pat", fill: "none" });
      g.appendChild(base); g.appendChild(pat);
      zoneLayer.appendChild(g);
      var label = svg("text", { "class": "z-label" + (i === 0 ? " is-you" : ""), opacity: 0 });
      labelLayer.appendChild(label);
      zones.push({ g: g, base: base, pat: pat, label: label, isYou: i === 0,
        cur: { x: 300, y: 220, w: 0, h: 0, r: 0, o: 0 }, text: "", pattern: "" });
    }

    var shell = svg("g", { "class": "shell", fill: "none", stroke: "#111" });
    shellEls.rect = shell.appendChild(svg("rect", { "stroke-width": 2 }));
    // Side door: a gap in the wall with its swing
    shellEls.doorGap = shell.appendChild(svg("path", { stroke: "#fff", "stroke-width": 4 }));
    shellEls.doorLeaf = shell.appendChild(svg("path", { "stroke-width": 1, "stroke-opacity": 0.6 }));
    // Roller door
    shellEls.rollerGap = shell.appendChild(svg("path", { stroke: "#fff", "stroke-width": 4 }));
    shellEls.roller = shell.appendChild(svg("path", { "stroke-width": 2, "stroke-dasharray": "6 5" }));
    // North point
    shell.appendChild(svg("path", { d: "M552 8 L558 24 L552 20 L546 24 Z", fill: "#111", stroke: "none" }));

    var notes = svg("g", { fill: "#6A6761", "font-size": 11 });
    planNotes = notes;
    shellEls.rollerLabel = notes.appendChild(svg("text", { "text-anchor": "middle" }, "roller door"));
    notes.appendChild(svg("text", { x: 24, y: 432 }, "Illustrative plan, not to scale"));
    notes.appendChild(svg("text", { x: 566, y: 22 }, "N"));
    shellEls.size = svg("text", { "class": "plan-size" });

    inbetween = svg("text", { "class": "inbetween" }, "in between");

    plan.appendChild(zoneLayer);
    plan.appendChild(shell);
    plan.appendChild(labelLayer);
    plan.appendChild(inbetween);
    plan.appendChild(notes);
    plan.appendChild(shellEls.size);
  }

  function layoutFor(state) {
    var kind = KINDS[state.kind];
    var sets = LAYOUTS[state.n];
    var geo = sets[((state.v % sets.length) + sets.length) % sets.length];
    var s = kind.shell, pad = 16;
    var ix = s.x + pad, iy = s.y + pad, iw = s.w - pad * 2, ih = s.h - pad * 2;
    var out = [];
    for (var i = 0; i < MAX_ZONES; i++) {
      var g = geo[i];
      out.push(g ? {
        x: ix + g[0] * iw, y: iy + g[1] * ih, w: g[2] * iw, h: g[3] * ih,
        r: kind.radius(g[4]), o: 1,
        pattern: i === 0 ? "you" : kind.patterns[(i - 1 + state.v) % kind.patterns.length],
        text: i === 0 ? "You" : kind.names[(state.v * 3 + i - 1) % kind.names.length]
      } : null);
    }
    return { zones: out, shell: { x: s.x, y: s.y, w: s.w, h: s.h, door: s.door }, size: kind.size };
  }

  function paintShell(s, sizeAlpha) {
    var f = function (v) { return v.toFixed(1); };
    shellEls.rect.setAttribute("x", f(s.x));
    shellEls.rect.setAttribute("y", f(s.y));
    shellEls.rect.setAttribute("width", f(s.w));
    shellEls.rect.setAttribute("height", f(s.h));
    var dy = s.y + s.h * 0.66;
    shellEls.doorGap.setAttribute("d", "M" + f(s.x) + " " + f(dy) + " V" + f(dy + 38));
    shellEls.doorLeaf.setAttribute("d", "M" + f(s.x) + " " + f(dy + 38) + " H" + f(s.x + 38) +
      " M" + f(s.x) + " " + f(dy) + " A38 38 0 0 1 " + f(s.x + 38) + " " + f(dy + 38));
    var by = s.y + s.h, rx2 = s.x + s.w - 24, rx1 = rx2 - s.door;
    var roller = "M" + f(rx1) + " " + f(by) + " H" + f(rx2);
    shellEls.rollerGap.setAttribute("d", roller);
    shellEls.roller.setAttribute("d", roller);
    shellEls.rollerLabel.setAttribute("x", f((rx1 + rx2) / 2));
    shellEls.rollerLabel.setAttribute("y", f(by + 18));
    shellEls.size.setAttribute("x", f(s.x));
    shellEls.size.setAttribute("y", f(s.y - 12));
    shellEls.size.setAttribute("opacity", sizeAlpha.toFixed(3));
  }

  function paintZone(z, s, swapAlpha) {
    var w = Math.max(0, s.w), h = Math.max(0, s.h);
    var r = Math.max(0, Math.min(s.r, w / 2, h / 2));
    [z.base, z.pat].forEach(function (rect) {
      rect.setAttribute("x", s.x.toFixed(2));
      rect.setAttribute("y", s.y.toFixed(2));
      rect.setAttribute("width", w.toFixed(2));
      rect.setAttribute("height", h.toFixed(2));
      rect.setAttribute("rx", r.toFixed(2));
    });
    z.g.setAttribute("opacity", clamp(s.o, 0, 1).toFixed(3));
    z.pat.setAttribute("opacity", swapAlpha.toFixed(3));
    var fs = (z.isYou ? clamp(Math.min(w, h) / 5, 14, 22) : clamp(Math.min(w, h) / 8, 11, 14)) * labelScale;
    fs = Math.min(fs, Math.max(1, Math.min(w, h) / 2.6));
    // Long trade names shrink to fit the section's width.
    var chars = (z.label.textContent || "x").length;
    fs = Math.min(fs, Math.max(1, (w - 12) / (0.56 * chars)));
    z.label.setAttribute("font-size", fs.toFixed(1));
    z.label.setAttribute("x", (s.x + w / 2).toFixed(2));
    z.label.setAttribute("y", (s.y + h / 2 + fs * 0.35).toFixed(2));
    z.label.setAttribute("opacity", (clamp(s.o, 0, 1) * swapAlpha).toFixed(3));
  }

  function commitLook(z, t) {
    z.text = t.text;
    z.pattern = t.pattern;
    z.label.textContent = t.text;
    z.pat.setAttribute("fill", PATTERN_FILL[t.pattern] || "none");
  }

  function placeInbetween(targets) {
    if (!inbetween) return;
    var best = null;
    var minLong = Math.max(70, 12.5 * labelScale * 4);
    for (var i = 0; i < targets.length; i++) {
      for (var j = i + 1; j < targets.length; j++) {
        var a = targets[i], b = targets[j];
        if (!a || !b) continue;
        var x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
        var x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
        var iw = x2 - x1, ih = y2 - y1;
        if (iw <= 0 || ih <= 0) continue;
        if (Math.max(iw, ih) < minLong || Math.min(iw, ih) < 16) continue;
        if (!best || iw * ih > best.area) best = { x: x1, y: y1, w: iw, h: ih, area: iw * ih };
      }
    }
    if (!best) { inbetween.classList.remove("show"); return; }
    var cx = best.x + best.w / 2, cy = best.y + best.h / 2;
    inbetween.setAttribute("x", cx.toFixed(1));
    inbetween.setAttribute("y", (cy + 4).toFixed(1));
    if (best.h > best.w * 1.3) inbetween.setAttribute("transform", "rotate(-90 " + cx.toFixed(1) + " " + cy.toFixed(1) + ")");
    else inbetween.removeAttribute("transform");
    inbetween.classList.add("show");
  }

  function morphPlan(duration) {
    var layout = layoutFor(planState);
    var targets = layout.zones;
    var shellFrom = shellCur;
    var shellTo = layout.shell;
    var sizeSwap = sizeText !== layout.size;
    var sizeSwapped = false;
    var commitSize = function () {
      sizeText = layout.size;
      shellEls.size.textContent = sizeText;
    };
    var jobs = zones.map(function (z, i) {
      var t = targets[i];
      var from = { x: z.cur.x, y: z.cur.y, w: z.cur.w, h: z.cur.h, r: z.cur.r, o: z.cur.o };
      var to;
      var swap = false;
      if (t) {
        if (from.o < 0.01) {
          from = { x: t.x + t.w / 2, y: t.y + t.h / 2, w: 0, h: 0, r: t.r, o: 0 };
          commitLook(z, t);
        } else if (z.text !== t.text || z.pattern !== t.pattern) {
          swap = true;
        }
        to = t;
      } else {
        to = { x: from.x + from.w / 2, y: from.y + from.h / 2, w: 0, h: 0, r: 0, o: 0 };
      }
      return { z: z, t: t, from: from, to: to, swap: swap, swapped: false, delay: i * 55 };
    });

    win.cancelAnimationFrame(tweenRaf);

    if (reduceMotion || !duration) {
      jobs.forEach(function (j) {
        if (j.t) commitLook(j.z, j.t);
        j.z.cur = { x: j.to.x, y: j.to.y, w: j.to.w, h: j.to.h, r: j.to.r, o: j.to.o };
        paintZone(j.z, j.z.cur, 1);
      });
      commitSize();
      shellCur = shellTo;
      paintShell(shellCur, 1);
      placeInbetween(targets);
      return;
    }

    if (inbetween) inbetween.classList.remove("show");
    var start = null;
    var total = duration + (MAX_ZONES - 1) * 55;
    function frame(ts) {
      if (start === null) start = ts;
      var elapsed = ts - start;
      var sp = clamp(elapsed / duration, 0, 1);
      var se = sp === 1 ? 1 : 1 - Math.pow(2, -10 * sp);
      shellCur = {
        x: shellFrom.x + (shellTo.x - shellFrom.x) * se,
        y: shellFrom.y + (shellTo.y - shellFrom.y) * se,
        w: shellFrom.w + (shellTo.w - shellFrom.w) * se,
        h: shellFrom.h + (shellTo.h - shellFrom.h) * se,
        door: shellFrom.door + (shellTo.door - shellFrom.door) * se
      };
      var sizeAlpha = 1;
      if (sizeSwap) {
        if (sp < 0.35) sizeAlpha = 1 - sp / 0.35;
        else {
          if (!sizeSwapped) { commitSize(); sizeSwapped = true; }
          sizeAlpha = (sp - 0.35) / 0.65;
        }
      }
      paintShell(shellCur, sizeAlpha);
      jobs.forEach(function (j) {
        var p = clamp((elapsed - j.delay) / duration, 0, 1);
        var e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        var s = {
          x: j.from.x + (j.to.x - j.from.x) * e,
          y: j.from.y + (j.to.y - j.from.y) * e,
          w: j.from.w + (j.to.w - j.from.w) * e,
          h: j.from.h + (j.to.h - j.from.h) * e,
          r: j.from.r + (j.to.r - j.from.r) * e,
          o: j.from.o + (j.to.o - j.from.o) * e
        };
        var alpha = 1;
        if (j.swap) {
          if (p < 0.35) alpha = 1 - p / 0.35;
          else {
            if (!j.swapped) { commitLook(j.z, j.t); j.swapped = true; }
            alpha = (p - 0.35) / 0.65;
          }
        }
        j.z.cur = s;
        paintZone(j.z, s, alpha);
      });
      if (elapsed < total) tweenRaf = win.requestAnimationFrame(frame);
      else placeInbetween(targets);
    }
    tweenRaf = win.requestAnimationFrame(frame);
  }

  function setReadout(tick) {
    var n = planState.n, kind = KINDS[planState.kind];
    if (fracEl) {
      fracEl.textContent = "1/" + n;
      fracEl.classList.remove("tick");
      if (tick) { void fracEl.offsetWidth; fracEl.classList.add("tick"); }
    }
    if (n === 1) {
      mainEl.textContent = "The whole lease is yours to carry.";
      subEl.textContent = "That's the usual way. Add a neighbour and watch your share shrink.";
    } else {
      mainEl.textContent = "of the lease is yours to carry, give or take.";
      subEl.textContent = kind.sub + " That part is up to the group.";
    }
    if (planDesc) {
      planDesc.textContent = n === 1
        ? "Illustrative plan of " + kind.unit + " used by one " + kind.group + " business on its own."
        : "Illustrative plan of " + kind.unit + " shared by " + WORDS[n] + " " + kind.group +
          " businesses, with sections of different sizes that overlap into shared in-between spaces.";
    }
    if (shareSelect && n > 1) shareSelect.value = (n - 1) + (n === 2 ? " other" : " others");
  }

  var thumb = splitOptions ? splitOptions.querySelector(".split-thumb") : null;
  function moveThumb(instant) {
    if (!thumb || !splitOptions) return;
    var checked = splitOptions.querySelector("input:checked");
    if (!checked) return;
    var label = checked.parentNode;
    if (instant) thumb.style.transition = "none";
    thumb.style.width = label.offsetWidth + "px";
    thumb.style.translate = label.offsetLeft + "px 0";
    if (instant) { void thumb.offsetWidth; thumb.style.transition = ""; }
  }

  if (plan) {
    buildPlan();
    measureLabelScale();
    win.addEventListener("resize", function () {
      measureLabelScale();
      zones.forEach(function (z) { paintZone(z, z.cur, 1); });
    });
    var checkedSplit = doc.querySelector("input[name='split']:checked");
    planState.n = checkedSplit ? parseInt(checkedSplit.value, 10) : 3;
    var checkedKind = doc.querySelector("input[name='kind']:checked");
    if (checkedKind && KINDS[checkedKind.value]) planState.kind = checkedKind.value;
    setReadout(false);
    var startShell = KINDS[planState.kind].shell;
    shellCur = { x: startShell.x, y: startShell.y, w: startShell.w, h: startShell.h, door: startShell.door };
    sizeText = KINDS[planState.kind].size;
    shellEls.size.textContent = sizeText;
    paintShell(shellCur, 1);

    toArray(doc.querySelectorAll("input[name='kind']")).forEach(function (input) {
      input.addEventListener("change", function () {
        if (!KINDS[input.value]) return;
        userTouched = true;
        planState.kind = input.value;
        setReadout(false);
        if (workTypeSelect) workTypeSelect.value = KINDS[input.value].form;
        morphPlan(1000);
      });
    });

    if (splitOptions && thumb) {
      splitOptions.classList.add("has-thumb");
      moveThumb(true);
      win.addEventListener("resize", function () { moveThumb(true); });
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { moveThumb(true); });
    }

    toArray(doc.querySelectorAll("input[name='split']")).forEach(function (input) {
      input.addEventListener("change", function () {
        userTouched = true;
        planState.n = parseInt(input.value, 10);
        moveThumb(false);
        setReadout(true);
        morphPlan(900);
      });
    });

    var spins = 0;
    if (shuffleBtn) {
      shuffleBtn.addEventListener("click", function () {
        userTouched = true;
        planState.v += 1;
        spins += 1;
        var icon = shuffleBtn.querySelector("svg");
        if (icon && !reduceMotion) icon.style.rotate = (spins * 180) + "deg";
        morphPlan(900);
      });
    }

    if (reduceMotion || !("IntersectionObserver" in win) || doc.hidden) {
      morphPlan(0);
    } else {
      var introDone = false;
      var planIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || introDone) return;
          introDone = true;
          planIO.disconnect();
          morphPlan(1300);
          // One unprompted reshuffle to show layouts vary, then it waits for you.
          win.setTimeout(function () {
            if (userTouched) return;
            planState.v += 1;
            morphPlan(1100);
          }, 3400);
        });
      }, { threshold: 0.35 });
      planIO.observe(planStage || plan);
    }
  }

  /* =========================================================
     Who it's for: a photo follows the cursor down the list
     ========================================================= */
  var peek = doc.getElementById("whoPeek");
  var whoList = doc.getElementById("whoList");
  var finePointer = win.matchMedia && win.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (peek && whoList && finePointer && !reduceMotion) {
    peek.classList.add("is-ready");
    var rows = toArray(whoList.querySelectorAll(".who-row"));
    rows.forEach(function (row) {
      if (row.hasAttribute("data-peek")) { var img = new Image(); img.src = row.getAttribute("data-peek"); }
    });

    var tx = 0, ty = 0, cx = 0, cy = 0, peekOn = false, peekRunning = false;
    var peekLoop = function () {
      var dx = tx - cx, dy = ty - cy;
      cx += dx * 0.16;
      cy += dy * 0.16;
      var w = peek.offsetWidth, h = peek.offsetHeight;
      // Sit below and right of the cursor so the row being read stays clear.
      var x = cx + 28;
      if (x + w > win.innerWidth - 16) x = cx - w - 28;
      var y = cy + 28;
      if (y + h > win.innerHeight - 16) y = cy - h - 28;
      peek.style.translate = x.toFixed(1) + "px " + y.toFixed(1) + "px";
      peek.style.rotate = clamp(dx * 0.06, -7, 7).toFixed(2) + "deg";
      if (peekOn || Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) win.requestAnimationFrame(peekLoop);
      else peekRunning = false;
    };
    var kick = function () { if (!peekRunning) { peekRunning = true; win.requestAnimationFrame(peekLoop); } };

    whoList.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; kick(); });
    rows.forEach(function (row) {
      row.addEventListener("pointerenter", function (e) {
        tx = e.clientX; ty = e.clientY;
        var src = row.getAttribute("data-peek");
        if (!src) { peekOn = false; peek.classList.remove("show"); return; }
        if (!peekOn) { cx = tx; cy = ty; }
        if (peek.getAttribute("src") !== src) peek.setAttribute("src", src);
        peekOn = true;
        peek.classList.add("show");
        kick();
      });
    });
    whoList.addEventListener("pointerleave", function () {
      peekOn = false;
      peek.classList.remove("show");
    });
  }

  /* =========================================================
     Enquiry form: business / unit owner
     ========================================================= */
  var roleField = doc.getElementById("roleField");
  var roleBtns = toArray(doc.querySelectorAll(".role-btn"));
  var roleSets = toArray(doc.querySelectorAll(".role-fields"));
  var titleEl = doc.getElementById("enquire-title");
  var leadEl = doc.getElementById("enquireLead");
  var submitBtn = doc.getElementById("submitBtn");

  var COPY = {
    business: {
      title: "Tell us what you need.",
      lead: "This is step one. The more you tell us, the better we can match you and design your section.",
      submit: "Send my brief", done: "Brief received."
    },
    partner: {
      title: "Tell us about your unit.",
      lead: "We'll come back to you with how Adjoin could work in your building, whatever its size. No commitment either way.",
      submit: "Send unit details", done: "Details received."
    }
  };
  var REQUIRED = { business: ["business", "area"], partner: ["location"] };

  function setRole(role) {
    if (!COPY[role]) return;
    if (roleField) roleField.value = role;
    roleBtns.forEach(function (b) {
      var on = b.getAttribute("data-target") === role;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    roleSets.forEach(function (fs) {
      if (fs.getAttribute("data-fields") === role) fs.removeAttribute("hidden");
      else fs.setAttribute("hidden", "");
    });
    Object.keys(REQUIRED).forEach(function (r) {
      REQUIRED[r].forEach(function (id) {
        var f = doc.getElementById(id);
        if (!f) return;
        if (r === role) f.setAttribute("required", ""); else f.removeAttribute("required");
      });
    });
    if (titleEl) titleEl.textContent = COPY[role].title;
    if (leadEl) leadEl.textContent = COPY[role].lead;
    if (submitBtn && !submitBtn.disabled) submitBtn.textContent = COPY[role].submit;
  }

  roleBtns.forEach(function (b) { b.addEventListener("click", function () { setRole(b.getAttribute("data-target")); }); });
  toArray(doc.querySelectorAll("[data-role]")).forEach(function (link) {
    link.addEventListener("click", function () { setRole(link.getAttribute("data-role")); });
  });
  var qRole = new URLSearchParams(win.location.search).get("role");
  setRole(qRole === "partner" ? "partner" : "business");

  var form = doc.getElementById("enquiryForm");
  var formError = doc.getElementById("formError");

  if (form) {
    form.addEventListener("submit", function (e) {
      if (formError) { formError.textContent = ""; formError.classList.remove("is-visible"); }
      if (!form.checkValidity()) { e.preventDefault(); form.reportValidity(); return; }
      if (typeof win.fetch !== "function") return;
      e.preventDefault();

      var role = roleField ? roleField.value : "business";
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";

      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form)).toString()
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Request failed");
          renderSuccess(role);
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = COPY[role].submit;
          if (formError) {
            formError.textContent = "That didn't send. Check your connection and try again, or email hello@adjoin.com.au.";
            formError.classList.add("is-visible");
          }
        });
    });
  }

  function renderSuccess(role) {
    var wrap = doc.querySelector(".form-wrap");
    if (!wrap) return;
    wrap.innerHTML =
      '<div class="form-success" role="status">' +
      '<span class="fs-mark" aria-hidden="true">✓</span>' +
      '<h3 tabindex="-1">' + COPY[role].done + "</h3>" +
      "<p>Thanks. We'll read it properly and get back to you. If anything else comes to mind, email " +
      '<a href="mailto:hello@adjoin.com.au">hello@adjoin.com.au</a>.</p></div>';
    var h = wrap.querySelector("h3");
    if (h) h.focus();
    wrap.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }
})();
