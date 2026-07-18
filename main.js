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
    if (enquireTitle) enquireTitle.textContent = COPY[role].title;
    if (submitBtn) submitBtn.textContent = COPY[role].submit;
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

  /* Sync initial state (business is the default) */
  if (roleBtns.length) setRole("business");

  /* ---- Netlify form: progressive AJAX submit with inline success ---- */
  var form = doc.getElementById("enquiryForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      // If fetch isn't available, let the native POST (action="/success.html") run.
      if (typeof window.fetch !== "function") return;

      e.preventDefault();
      var btn = doc.getElementById("submitBtn");
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
          // Fall back to the native navigation on error.
          form.submit();
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
