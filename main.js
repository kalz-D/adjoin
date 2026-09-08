/* =========================================================
   ADJOIN — interactions
   ========================================================= */
(function () {
  "use strict";

  var doc = document;
  var body = doc.body;

  /* ---- Current year ---- */
  var yearEl = doc.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---- Header scrolled state ---- */
  var header = doc.getElementById("siteHeader");
  var onScroll = function () {
    if (!header) return;
    if (window.scrollY > 8) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Mobile menu (with focus management + trap) ---- */
  var toggle = doc.getElementById("menuToggle");
  var menu = doc.getElementById("mobileMenu");
  var menuLinks = menu ? Array.prototype.slice.call(menu.querySelectorAll("a")) : [];

  var closeMenu = function (returnFocus) {
    if (!menu || !toggle) return;
    var wasOpen = menu.classList.contains("open");
    menu.classList.remove("open");
    menu.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    body.classList.remove("menu-open");
    if (returnFocus && wasOpen) toggle.focus();
  };

  if (toggle && menu) {
    var openMenu = function () {
      menu.classList.add("open");
      menu.setAttribute("aria-hidden", "false");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
      body.classList.add("menu-open");
      if (menuLinks[0]) menuLinks[0].focus();
    };

    toggle.addEventListener("click", function () {
      if (menu.classList.contains("open")) closeMenu(true);
      else openMenu();
    });

    menuLinks.forEach(function (a) {
      a.addEventListener("click", function () { closeMenu(false); });
    });

    doc.addEventListener("keydown", function (e) {
      if (!menu.classList.contains("open")) return;
      if (e.key === "Escape") { closeMenu(true); return; }
      if (e.key === "Tab") {
        var focusable = [toggle].concat(menuLinks);
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---- Scroll reveal ---- */
  var reveals = doc.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach(function (el) { io.observe(el); });

    // Safety net: if the observer never marks anything visible (e.g. it failed
    // to fire in some browser), reveal everything so content can't stay hidden.
    window.setTimeout(function () {
      if (!doc.querySelector(".reveal.in")) {
        reveals.forEach(function (el) { el.classList.add("in"); });
      }
    }, 2500);
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- Role toggle (business / partner) ---- */
  var roleField = doc.getElementById("roleField");
  var roleBtns = Array.prototype.slice.call(doc.querySelectorAll(".role-btn"));
  var roleFieldsets = Array.prototype.slice.call(doc.querySelectorAll(".role-fields"));
  var enquireTitle = doc.getElementById("enquire-title");
  var submitBtn = doc.getElementById("submitBtn");

  var COPY = {
    business: { title: "Ready for a space of your own?", submit: "Find my space →" },
    partner:  { title: "Ready to fill your space?",      submit: "Start the conversation →" }
  };

  var setFieldRequired = function (id, on) {
    var el = doc.getElementById(id);
    if (!el) return;
    if (on) el.setAttribute("required", "");
    else el.removeAttribute("required");
  };

  var setRole = function (role) {
    if (!COPY[role]) return;
    if (roleField) roleField.value = role;
    roleBtns.forEach(function (b) {
      var active = b.getAttribute("data-target") === role;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", active ? "true" : "false");
    });
    roleFieldsets.forEach(function (fs) {
      var show = fs.getAttribute("data-fields") === role;
      fs.classList.toggle("is-hidden", !show);
      if (show) fs.removeAttribute("hidden");
      else fs.setAttribute("hidden", "");
    });
    setFieldRequired("business", role === "business");
    setFieldRequired("area", role === "business");
    setFieldRequired("location", role === "partner");
    if (enquireTitle) enquireTitle.textContent = COPY[role].title;
    if (submitBtn && !submitBtn.disabled) submitBtn.textContent = COPY[role].submit;
  };

  roleBtns.forEach(function (b) {
    b.addEventListener("click", function () { setRole(b.getAttribute("data-target")); });
  });

  /* Deep-link CTAs can preset the role, e.g. hero "List your space" */
  doc.querySelectorAll("[data-role]").forEach(function (link) {
    link.addEventListener("click", function () {
      var r = link.getAttribute("data-role");
      if (r === "business" || r === "partner") setRole(r);
    });
  });

  /* ---- Active section in desktop nav ---- */
  var navLinks = Array.prototype.slice.call(doc.querySelectorAll(".nav-desktop a[href^='#']"));
  var sectionIds = navLinks.map(function (a) { return a.getAttribute("href").slice(1); }).filter(Boolean);
  var sections = sectionIds.map(function (id) { return doc.getElementById(id); }).filter(Boolean);
  if (navLinks.length && "IntersectionObserver" in window) {
    var currentId = "";
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) currentId = entry.target.id;
        });
        navLinks.forEach(function (a) {
          var on = a.getAttribute("href") === "#" + currentId;
          if (on) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0.01 }
    );
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* Sync initial state from CTA, query string, or default */
  var params = new URLSearchParams(window.location.search);
  var initialRole = params.get("role");
  if (initialRole !== "business" && initialRole !== "partner") {
    initialRole = "business";
  }
  if (roleBtns.length) setRole(initialRole);

  /* ---- Netlify form: progressive AJAX submit with inline success ---- */
  var form = doc.getElementById("enquiryForm");
  var formError = doc.getElementById("formError");
  var showFormError = function (msg) {
    if (!formError) return;
    formError.textContent = msg;
    formError.classList.add("is-visible");
  };
  var hideFormError = function () {
    if (!formError) return;
    formError.textContent = "";
    formError.classList.remove("is-visible");
  };

  if (form) {
    form.addEventListener("submit", function (e) {
      hideFormError();
      if (!form.checkValidity()) {
        e.preventDefault();
        form.reportValidity();
        return;
      }
      // If fetch isn't available, let the native POST (action="/success.html") run.
      if (typeof window.fetch !== "function") return;

      e.preventDefault();
      var btn = doc.getElementById("submitBtn");
      var role = roleField ? roleField.value : "business";
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }

      var data = new FormData(form);
      var payload = new URLSearchParams(data).toString();

      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: payload
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Network response was not ok");
          renderSuccess();
        })
        .catch(function () {
          if (btn) {
            btn.disabled = false;
            btn.textContent = COPY[role] ? COPY[role].submit : "Send enquiry →";
          }
          showFormError("Something went wrong sending that. Try again, or email connect@careinmovement.com.");
        });
    });
  }

  function renderSuccess() {
    var wrap = doc.querySelector(".enquire-form-wrap");
    if (!wrap) return;
    wrap.innerHTML =
      '<div class="form-success" role="status">' +
      '<span class="fs-mark" aria-hidden="true">✓</span>' +
      '<h3 tabindex="-1">Thank you — message received.</h3>' +
      "<p>We&rsquo;ve got your details and we&rsquo;ll be in touch soon. In the meantime, " +
      'feel free to email us directly at <a href="mailto:connect@careinmovement.com">connect@careinmovement.com</a>.</p>' +
      "</div>";
    var heading = wrap.querySelector("h3");
    if (heading) heading.focus();
    var rm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    wrap.scrollIntoView({ behavior: rm ? "auto" : "smooth", block: "center" });
  }
})();

/* =========================================================
   ADJOIN — space planner tool
   ========================================================= */
(function () {
  "use strict";
  var doc = document;
  var grid = doc.getElementById("planGrid");
  if (!grid) return;

  var palette = doc.getElementById("chipPalette");
  var countEl = doc.getElementById("plannerCount");
  var perHeadEl = doc.getElementById("perHead");
  var subEl = doc.getElementById("readoutSub");
  var compareWrap = doc.getElementById("compareWrap");
  var soloEl = doc.getElementById("soloCost");
  var adjoinEl = doc.getElementById("adjoinCost");
  var adjoinFill = doc.getElementById("adjoinFill");
  var resetBtn = doc.getElementById("plannerReset");

  var SHARED = 3600;   // illustrative monthly shared building cost
  var SOLO = 4200;     // illustrative cost of taking a comparable unit alone
  var MAX = 8;

  var IC = {
    scissors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
    dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11"/></svg>',
    laptop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="11" rx="1"/><path d="M2 20h20"/></svg>',
    pot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8h10l-1 10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"/><path d="M6 8h12"/></svg>',
    lotus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20c-4-2-7-5-7-9 3 0 5 2 7 5 2-3 4-5 7-5 0 4-3 7-7 9z"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.2"/><path d="M8.5 7l1.2-2h4.6l1.2 2"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14z"/><path d="M5 19c4-4 7-6 10-7"/></svg>'
  };

  var TRADES = [
    { name: "Barber", zone: 450, icon: IC.scissors },
    { name: "Hairdresser", zone: 450, icon: IC.scissors },
    { name: "Trainer", zone: 500, icon: IC.dumbbell },
    { name: "Developer", zone: 300, icon: IC.laptop },
    { name: "Ceramicist", zone: 400, icon: IC.pot },
    { name: "Therapist", zone: 400, icon: IC.lotus },
    { name: "Photographer", zone: 400, icon: IC.camera },
    { name: "Nutritionist", zone: 300, icon: IC.leaf }
  ];

  var added = [];

  function fmt(n) { return "£" + Number(n).toLocaleString("en-GB"); }

  function render() {
    grid.innerHTML = "";
    for (var i = 0; i < MAX; i++) {
      var cell = doc.createElement("div");
      if (i < added.length) {
        var t = added[i];
        cell.className = "plan-cell filled";
        cell.innerHTML =
          '<span class="pc-icon">' + t.icon + "</span>" +
          '<span class="pc-name">' + t.name + "</span>" +
          '<span class="pc-remove" aria-hidden="true">×</span>';
        cell.setAttribute("role", "button");
        cell.setAttribute("tabindex", "0");
        cell.setAttribute("aria-label", "Remove " + t.name);
        (function (idx) {
          function remove() { added.splice(idx, 1); render(); }
          cell.addEventListener("click", remove);
          cell.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); remove(); }
          });
        })(i);
      } else {
        cell.className = "plan-cell empty";
        cell.setAttribute("aria-hidden", "true");
      }
      grid.appendChild(cell);
    }

    countEl.textContent = added.length + " / " + MAX + " spaces";

    var chips = palette.querySelectorAll(".chip");
    for (var c = 0; c < chips.length; c++) chips[c].disabled = added.length >= MAX;

    var n = added.length;
    if (!n) {
      perHeadEl.textContent = "£—";
      subEl.textContent = "Add a business to start splitting the cost of the space.";
      compareWrap.hidden = true;
      return;
    }
    var zoneSum = 0;
    added.forEach(function (t) { zoneSum += t.zone; });
    var perHead = Math.round((zoneSum / n + SHARED / n) / 10) * 10;
    perHeadEl.textContent = fmt(perHead);
    subEl.textContent = n === 1
      ? "One business carrying the whole space. Add neighbours to share the load."
      : "Shared between " + n + " businesses — the fixed costs split " + n + " ways.";
    compareWrap.hidden = false;
    soloEl.textContent = fmt(SOLO);
    adjoinEl.textContent = fmt(perHead);
    adjoinFill.style.width = Math.max(6, Math.round((perHead / SOLO) * 100)) + "%";
  }

  TRADES.forEach(function (t) {
    var b = doc.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.innerHTML = '<span class="chip-ic">' + t.icon + "</span>" + t.name;
    b.addEventListener("click", function () {
      if (added.length < MAX) { added.push(t); render(); }
    });
    palette.appendChild(b);
  });

  if (resetBtn) resetBtn.addEventListener("click", function () { added = []; render(); });

  added = [TRADES[0], TRADES[2], TRADES[3]];
  render();
})();
