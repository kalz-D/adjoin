/* =========================================================
   ADJOIN interactions
   ========================================================= */
(function () {
  "use strict";
  var doc = document;
  var body = doc.body;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Year ---- */
  var yearEl = doc.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---- Header state ---- */
  var header = doc.getElementById("siteHeader");
  var onScroll = function () {
    if (header) header.classList.toggle("scrolled", window.scrollY > 8);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Mobile menu ---- */
  var toggle = doc.getElementById("menuToggle");
  var menu = doc.getElementById("mobileMenu");
  var menuLinks = menu ? Array.prototype.slice.call(menu.querySelectorAll("a")) : [];

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
  var navLinks = Array.prototype.slice.call(doc.querySelectorAll(".nav-desktop a[href^='#']"));
  if (navLinks.length && "IntersectionObserver" in window) {
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
     Lease splitter: one 300 m² unit, 60 m² shared lounge,
     240 m² split between 1 to 5 businesses.
     ========================================================= */
  var plan = doc.getElementById("plan");
  var fracEl = doc.getElementById("splitFrac");
  var mainEl = doc.getElementById("splitMain");
  var subEl = doc.getElementById("splitSub");
  var carryEl = doc.getElementById("carryFill");
  var shareSelect = doc.getElementById("share");
  var SVGNS = "http://www.w3.org/2000/svg";
  var C = { paper: "#F5F4F0", soft: "#C4C2BB", dim: "#6E7176", signal: "#FF5F1F", char: "#232427", euc: "#6F8F7D", sand: "#E6CFA8" };

  function el(name, attrs, text) {
    var n = doc.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function drawPlan(n) {
    if (!plan) return;
    var desc = plan.querySelector("desc");
    while (plan.lastChild && plan.lastChild !== desc) plan.removeChild(plan.lastChild);

    // Dimension line
    plan.appendChild(el("path", { d: "M20 20 H620 M20 13 V27 M620 13 V27", stroke: C.dim, "stroke-width": 1.5, fill: "none" }));
    plan.appendChild(el("rect", { x: 278, y: 8, width: 84, height: 22, fill: "#2F3134" }));
    plan.appendChild(el("text", { x: 320, y: 25, "text-anchor": "middle", fill: C.soft, "font-size": 16, "font-weight": 600 }, "300 m²"));

    // Private sections
    var privW = 480, x0 = 20, colW = privW / n;
    var each = Math.round(240 / n);
    for (var i = 0; i < n; i++) {
      var x = x0 + i * colW + 5, w = colW - 10, you = i === 0;
      var g = el("g", {});
      var r = el("rect", {
        x: x, y: 46, width: w, height: 318,
        fill: you ? C.signal : "rgba(245,244,240,0.05)",
        stroke: you ? C.signal : C.dim, "stroke-width": 1.5,
        "class": "z-draw z-fill"
      });
      r.style.animationDelay = (i * 70) + "ms";
      g.appendChild(r);
      var cx = x + w / 2;
      g.appendChild(el("text", {
        x: cx, y: 196, "text-anchor": "middle", fill: you ? C.char : C.soft,
        "font-size": you ? 30 : (n >= 5 ? 15 : 18), "font-weight": you ? 700 : 500, "class": "z-fill"
      }, you ? "You" : "Neighbour"));
      g.appendChild(el("text", {
        x: cx, y: 226, "text-anchor": "middle", fill: you ? C.char : C.soft,
        "font-size": 17, "font-weight": 500, "class": "z-fill"
      }, "~" + each + " m²"));
      plan.appendChild(g);
    }

    // Shared lounge
    var s = el("g", {});
    s.appendChild(el("rect", { x: 505, y: 46, width: 110, height: 318, fill: "rgba(111,143,125,0.28)", stroke: C.euc, "stroke-width": 1.5, rx: 18 }));
    // couch
    s.appendChild(el("rect", { x: 525, y: 250, width: 70, height: 30, rx: 10, fill: "none", stroke: C.sand, "stroke-width": 2 }));
    s.appendChild(el("path", { d: "M530 262 H590", stroke: C.sand, "stroke-width": 2 }));
    // plant
    s.appendChild(el("circle", { cx: 560, cy: 318, r: 11, fill: "none", stroke: C.euc, "stroke-width": 2 }));
    s.appendChild(el("path", { d: "M560 318 l-7 -7 M560 318 l7 -7 M560 318 v-10", stroke: C.euc, "stroke-width": 2, "stroke-linecap": "round" }));
    s.appendChild(el("text", { x: 560, y: 106, "text-anchor": "middle", fill: C.paper, "font-size": 18, "font-weight": 600 }, "Shared"));
    s.appendChild(el("text", { x: 560, y: 130, "text-anchor": "middle", fill: C.soft, "font-size": 15 }, "lounge,"));
    s.appendChild(el("text", { x: 560, y: 150, "text-anchor": "middle", fill: C.soft, "font-size": 15 }, "kitchen"));
    plan.appendChild(s);

    // Building shell and roller door
    plan.appendChild(el("rect", { x: 20, y: 40, width: 600, height: 330, fill: "none", stroke: C.paper, "stroke-width": 3 }));
    plan.appendChild(el("path", { d: "M515 370 H605", stroke: C.char, "stroke-width": 5 }));
    plan.appendChild(el("path", { d: "M515 370 H605", stroke: C.sand, "stroke-width": 2, "stroke-dasharray": "6 5" }));
    plan.appendChild(el("text", { x: 560, y: 392, "text-anchor": "middle", fill: C.dim, "font-size": 14 }, "roller door"));

    if (!reduceMotion) {
      plan.classList.remove("animating");
      void plan.getBoundingClientRect();
      plan.classList.add("animating");
    }
  }

  function updateSplit(n) {
    drawPlan(n);
    if (fracEl) fracEl.textContent = "1/" + n;
    if (n === 1) {
      mainEl.textContent = "The whole lease is yours to carry.";
      subEl.textContent = "That's the usual way. Add people and watch your share shrink.";
    } else {
      mainEl.textContent = "of the lease is yours to carry.";
      subEl.textContent = "About " + Math.round(240 / n) + " m² of your own, plus the shared lounge, kitchen and loading bay.";
    }
    if (carryEl) carryEl.style.width = (100 / n) + "%";
    if (shareSelect && n > 1) shareSelect.value = (n - 1) + (n === 2 ? " other" : " others");
  }

  var splitInputs = Array.prototype.slice.call(doc.querySelectorAll("input[name='split']"));
  splitInputs.forEach(function (input) {
    input.addEventListener("change", function () { updateSplit(parseInt(input.value, 10)); });
  });
  var checked = doc.querySelector("input[name='split']:checked");
  updateSplit(checked ? parseInt(checked.value, 10) : 3);

  /* =========================================================
     Enquiry form: business / unit owner
     ========================================================= */
  var roleField = doc.getElementById("roleField");
  var roleBtns = Array.prototype.slice.call(doc.querySelectorAll(".role-btn"));
  var roleSets = Array.prototype.slice.call(doc.querySelectorAll(".role-fields"));
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
      lead: "We'll come back to you with how Adjoin could work in your building. No commitment either way.",
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
  doc.querySelectorAll("[data-role]").forEach(function (link) {
    link.addEventListener("click", function () { setRole(link.getAttribute("data-role")); });
  });
  var qRole = new URLSearchParams(window.location.search).get("role");
  setRole(qRole === "partner" ? "partner" : "business");

  var form = doc.getElementById("enquiryForm");
  var formError = doc.getElementById("formError");

  if (form) {
    form.addEventListener("submit", function (e) {
      if (formError) { formError.textContent = ""; formError.classList.remove("is-visible"); }
      if (!form.checkValidity()) { e.preventDefault(); form.reportValidity(); return; }
      if (typeof window.fetch !== "function") return;
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
