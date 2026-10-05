/* =========================================================
   ADJOIN members area
   Everything members write is rendered as text, never as HTML.
   ========================================================= */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const KINDS = ["desk", "services", "workshop"];

/* ---------- API ---------- */

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function api(path, { method = "GET", json, blob } = {}) {
  const init = { method, credentials: "same-origin", headers: {} };
  if (json !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(json);
  }
  if (blob) {
    init.headers["Content-Type"] = blob.type;
    init.body = blob;
  }
  let res;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError("We couldn't reach Adjoin. Check your connection and try again.", 0, "network");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new ApiError(data?.error?.message || "Something went wrong. Please try again.", res.status, data?.error?.code);
  }
  return data;
}

/* ---------- DOM ---------- */

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

function safeSrc(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : null;
}

function safeHref(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function showError(el, message) {
  el.textContent = message || "";
  el.classList.toggle("is-visible", Boolean(message));
}

function loadingEl(label) {
  return h("div", { class: "wrap m-loading" }, h("span", { class: "sq", "aria-hidden": "true" }), label);
}

function paragraphsOf(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => h("p", { style: "white-space: pre-line" }, para));
}

function dateLabel(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

/* ---------- Session ---------- */

function goToSignIn() {
  const next = location.pathname + location.search;
  location.replace(`/members/?next=${encodeURIComponent(next)}`);
}

async function loadMe() {
  try {
    return await api("/api/me");
  } catch (err) {
    if (err.status === 401) {
      goToSignIn();
      return new Promise(() => {});
    }
    throw err;
  }
}

function setupNav(me, current) {
  const nav = $(".m-nav");
  if (!nav) return;
  nav.hidden = false;
  $$("[data-nav]", nav).forEach((link) => {
    if (link.dataset.nav === current) link.setAttribute("aria-current", "page");
  });
  const admin = $('[data-nav="admin"]', nav);
  if (admin) admin.hidden = !me.user.isAdmin;
  $(".m-signout", nav)?.addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      location.assign("/members/");
    }
  });
}

function destinationAfterSignIn(me) {
  const next = new URLSearchParams(location.search).get("next") || "";
  if (/^\/members\/(circle|me|profile|admin)\.html(\?[\w=&%.-]*)?$/.test(next)) return next;
  return me.profile.status === "live" || me.user.isAdmin ? "/members/circle.html" : "/members/me.html";
}

/* ---------- Motion ---------- */

let panelObserver = null;
let parallaxQueued = false;

function updateParallax() {
  parallaxQueued = false;
  const vh = window.innerHeight;
  $$(".c-panel .c-media img, .pf-hero-parallax").forEach((img) => {
    const rect = img.parentElement.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > vh) return;
    const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
    img.style.setProperty("--shift", `${(-5 + Math.max(-1, Math.min(1, progress)) * 5).toFixed(2)}%`);
  });
}

function watchPanels() {
  if (reduceMotion) return;
  if ("IntersectionObserver" in window) {
    panelObserver?.disconnect();
    panelObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.remove("is-pending");
          panelObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12 },
    );
    $$(".c-panel").forEach((panel) => {
      if (panel.getBoundingClientRect().top > window.innerHeight * 0.9) {
        panel.classList.add("is-pending");
        panelObserver.observe(panel);
      }
    });
  }
  updateParallax();
}

if (!reduceMotion) {
  const queue = () => {
    if (parallaxQueued) return;
    parallaxQueued = true;
    requestAnimationFrame(updateParallax);
  };
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
}

/* =========================================================
   Sign in / create account
   ========================================================= */

async function initAuth() {
  try {
    if ((await api("/api/session")).signedIn) {
      location.replace(destinationAfterSignIn(await api("/api/me")));
      return;
    }
  } catch {
    // Can't tell: show the form.
  }

  const COPY = {
    signin: {
      title: "Welcome back.",
      lead: "Sign in to see your circle: the handful of businesses looking for space like yours.",
      submit: "Sign in",
      autocomplete: "current-password",
    },
    signup: {
      title: "Find your people.",
      lead: "Make a profile, tell us what you're after, and meet the few businesses that would suit sharing with you.",
      submit: "Create account",
      autocomplete: "new-password",
    },
  };
  const form = $("#authForm");
  const error = $("#authError");
  const submit = $("#authSubmit");
  const email = $("#authEmail");
  const password = $("#authPassword");
  const toggle = $(".pw-toggle");
  let mode = location.hash === "#join" ? "signup" : "signin";

  function setMode(next) {
    mode = next;
    const copy = COPY[mode];
    $$(".auth-toggle [data-mode]").forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.mode === mode)));
    $("#authTitle").textContent = copy.title;
    $("#authLead").textContent = copy.lead;
    submit.textContent = copy.submit;
    password.setAttribute("autocomplete", copy.autocomplete);
    $$("[data-when]").forEach((el) => {
      el.hidden = el.dataset.when !== mode;
    });
    showError(error, "");
  }

  $$(".auth-toggle [data-mode]").forEach((btn) =>
    btn.addEventListener("click", () => {
      setMode(btn.dataset.mode);
      history.replaceState(null, "", `${location.pathname}${location.search}${mode === "signup" ? "#join" : ""}`);
      email.focus();
    }),
  );

  toggle.addEventListener("click", () => {
    const show = password.type === "password";
    password.type = show ? "text" : "password";
    toggle.textContent = show ? "Hide" : "Show";
    toggle.setAttribute("aria-pressed", String(show));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError(error, "");
    if (!email.value.includes("@")) return showError(error, "Enter your email address.");
    if (mode === "signup" && password.value.length < 8) return showError(error, "Use at least 8 characters for your password.");
    if (!password.value) return showError(error, "Enter your password.");

    submit.disabled = true;
    submit.textContent = "One moment…";
    try {
      await api(`/api/auth/${mode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        json: { email: email.value, password: password.value },
      });
      const me = await api("/api/me");
      location.assign(destinationAfterSignIn(me));
    } catch (err) {
      showError(error, err.message);
      submit.disabled = false;
      submit.textContent = COPY[mode].submit;
    }
  });

  setMode(mode);
}

/* =========================================================
   Your circle
   ========================================================= */

const NOTICES = {
  none: [
    "Finish your profile to join the circle.",
    "Add a photo and a few details, then send it to us. Once we've welcomed you in, you'll see the businesses looking for space like yours.",
    "Finish your profile",
  ],
  pending: [
    "Thanks, we're reading your profile.",
    "We look at every profile before it goes live. Your circle opens as soon as we've welcomed you in.",
    "See your profile",
  ],
  hidden: [
    "Your profile is hidden for now.",
    "Get in touch at hello@adjoin.com.au and we'll sort it out.",
    "See your profile",
  ],
};
NOTICES.draft = NOTICES.none;

function circlePanel(p, index, total, isExample) {
  const href = `/members/profile.html?id=${encodeURIComponent(p.id)}`;
  const src = safeSrc(p.hero);
  const meta = [p.trade, p.area].filter(Boolean).join(" · ");
  const counter = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  return h(
    "article",
    { class: "c-panel" },
    h(
      "a",
      { class: "c-media", href, tabindex: "-1", "aria-hidden": "true" },
      src ? h("img", { src, alt: "", loading: index ? "lazy" : "eager", decoding: "async" }) : null,
    ),
    h(
      "div",
      { class: "c-card" },
      h(
        "div",
        { class: "c-top" },
        h("p", { class: "c-meta", text: meta }),
        isExample ? h("span", { class: "tag", text: "Example" }) : h("span", { class: "c-index", text: counter }),
      ),
      h("h2", { class: "c-name" }, h("a", { href, text: p.businessName })),
      p.headline ? h("p", { class: "c-headline", text: p.headline }) : null,
      p.lookingFor?.length
        ? h(
            "dl",
            { class: "c-facts" },
            p.lookingFor.map((fact) => h("div", {}, h("dt", { text: fact.label }), h("dd", { text: fact.value }))),
          )
        : null,
      h(
        "div",
        { class: "c-foot" },
        h("span", { class: "c-link" }, "View profile", h("span", { class: "arrow", "aria-hidden": "true", text: "→" })),
        p.personName ? h("span", { class: "c-meta", text: p.personName }) : null,
      ),
    ),
  );
}

async function initCircle() {
  const me = await loadMe();
  setupNav(me, "circle");

  const requested = new URLSearchParams(location.search).get("kind");
  const state = {
    kind: KINDS.includes(requested) ? requested : me.profile.raw.kind || "desk",
    page: 0,
    total: 0,
  };
  const list = $("#circleList");
  const notice = $("#circleNotice");
  const empty = $("#circleEmpty");
  const foot = $("#circleFoot");
  const more = $("#circleMore");
  const count = $("#circleCount");
  const examplesNote = $("#circleExamplesNote");
  const kindButtons = $$(".kind-switch [data-kind]");

  const syncKind = () =>
    kindButtons.forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.kind === state.kind)));

  function renderNotice(data) {
    if (!data.locked || me.user.isAdmin) {
      notice.hidden = true;
      return;
    }
    const [title, body, cta] = NOTICES[data.status] || NOTICES.none;
    notice.replaceChildren(
      h(
        "div",
        { class: "notice" },
        h("div", {}, h("h2", { text: title }), h("p", { text: body })),
        h("a", { class: "btn btn-primary", href: "/members/me.html", text: cta }),
      ),
    );
    notice.hidden = false;
  }

  async function load(scrollToList) {
    list.replaceChildren(loadingEl("Finding your circle"));
    empty.hidden = true;
    foot.hidden = true;
    examplesNote.hidden = true;

    let data;
    try {
      data = await api(`/api/circle?kind=${state.kind}&page=${state.page}`);
    } catch (err) {
      list.replaceChildren(h("div", { class: "wrap" }, h("p", { class: "form-error is-visible", text: err.message })));
      return;
    }
    state.total = data.total;
    renderNotice(data);

    const isExample = !data.profiles.length && data.examples.length > 0;
    const items = isExample ? data.examples : data.profiles;
    list.replaceChildren(...items.map((p, i) => circlePanel(p, i, items.length, isExample)));
    examplesNote.hidden = !isExample;
    empty.hidden = items.length > 0 || data.locked;

    if (!isExample && data.total > data.pageSize) {
      const shown = Math.min(data.total, data.page * data.pageSize + data.profiles.length);
      more.textContent = shown < data.total ? "Show me others" : "Back to the start";
      count.textContent = `${shown} of ${data.total}`;
      foot.hidden = false;
    }
    watchPanels();
    if (scrollToList) list.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  kindButtons.forEach((btn) =>
    btn.addEventListener("click", () => {
      if (state.kind === btn.dataset.kind) return;
      state.kind = btn.dataset.kind;
      state.page = 0;
      syncKind();
      history.replaceState(null, "", `?kind=${state.kind}`);
      load(false);
    }),
  );

  more.addEventListener("click", () => {
    state.page = (state.page + 1) * 5 < state.total ? state.page + 1 : 0;
    load(true);
  });

  syncKind();
  load(false);
}

/* =========================================================
   A profile
   ========================================================= */

function renderState(root, title, body, href, cta) {
  root.replaceChildren(
    h(
      "div",
      { class: "wrap pf-state" },
      h("h1", { text: title }),
      h("p", { text: body }),
      h("a", { class: "btn btn-primary", href, text: cta }),
    ),
  );
}

function introBlock(p, isOwn) {
  if (isOwn) return null;
  if (p.example) {
    return h("div", { class: "pf-intro" }, h("p", { text: "This is an example profile, so introductions are switched off." }));
  }
  const status = h("p", { class: "form-error", role: "alert" });
  const message = h("textarea", {
    id: "introMessage",
    maxlength: "600",
    placeholder: `Anything you'd like ${p.personName || "them"} to know? (optional)`,
  });
  const button = h("button", { type: "submit", class: "btn btn-primary btn-block", text: "Ask Adjoin to introduce us" });
  const form = h(
    "form",
    { class: "pf-intro" },
    h("p", { text: "Want to meet? We'll introduce you both, and neither of you shares contact details until you're ready." }),
    status,
    h("label", { class: "visually-hidden", for: "introMessage", text: "Message" }),
    message,
    button,
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError(status, "");
    button.disabled = true;
    button.textContent = "Sending…";
    try {
      await api("/api/intros", { method: "POST", json: { to: p.id, message: message.value } });
      form.replaceChildren(h("p", { class: "form-ok", text: "Thanks. We'll be in touch to introduce you." }));
    } catch (err) {
      showError(status, err.message);
      button.disabled = false;
      button.textContent = "Ask Adjoin to introduce us";
    }
  });
  return form;
}

function renderProfile(root, data) {
  const p = data.profile;
  document.title = `${p.businessName || "Profile"} | Adjoin`;
  const src = safeSrc(p.hero);
  const meta = [p.trade, p.area].filter(Boolean).join(" · ");

  const hero = h(
    "section",
    { class: "pf-hero", "aria-labelledby": "pfName" },
    src ? h("img", { src, alt: `${p.businessName}${p.trade ? `, ${p.trade}` : ""}` }) : null,
    h(
      "div",
      { class: "pf-card" },
      h(
        "div",
        { class: "c-top" },
        h("p", { class: "c-meta", text: meta }),
        p.example ? h("span", { class: "tag", text: "Example" }) : p.kindLabel ? h("span", { class: "tag", text: p.kindLabel }) : null,
      ),
      h("h1", { class: "pf-name", id: "pfName", text: p.businessName || "Your business name" }),
      p.headline ? h("p", { class: "pf-headline", text: p.headline }) : null,
      data.isOwn
        ? h(
            "div",
            { class: "pf-banner" },
            h("span", { text: "This is how other members see your profile." }),
            h("a", { class: "btn btn-line btn-xs", href: "/members/me.html", text: "Edit" }),
          )
        : null,
    ),
  );

  const website = safeHref(p.website);
  const links = [];
  if (website) {
    links.push(h("a", { href: website, target: "_blank", rel: "noopener noreferrer nofollow", text: new URL(website).hostname.replace(/^www\./, "") }));
  }
  if (p.instagram && /^[A-Za-z0-9._]{1,30}$/.test(p.instagram)) {
    links.push(
      h("a", {
        href: `https://www.instagram.com/${p.instagram}/`,
        target: "_blank",
        rel: "noopener noreferrer nofollow",
        text: `@${p.instagram}`,
      }),
    );
  }

  const main = h(
    "div",
    {},
    h("section", { class: "pf-section" }, h("h2", { text: "About" }), ...paragraphsOf(p.about || "Nothing here yet.")),
    p.neighbours
      ? h("section", { class: "pf-section" }, h("h2", { text: "Who they'd love next door" }), ...paragraphsOf(p.neighbours))
      : null,
  );

  const side = h(
    "aside",
    { class: "pf-side" },
    h("h2", { text: "Looking for" }),
    p.lookingFor?.length
      ? h("dl", { class: "pf-facts" }, p.lookingFor.map((f) => h("div", {}, h("dt", { text: f.label }), h("dd", { text: f.value }))))
      : null,
    p.needs?.length ? h("div", { class: "chips" }, p.needs.map((n) => h("span", { class: "chip", text: n }))) : null,
    links.length ? h("div", { class: "pf-links" }, links) : null,
    introBlock(p, data.isOwn),
  );

  const gallery = (p.gallery || []).map(safeSrc).filter(Boolean);
  root.replaceChildren(
    hero,
    h("div", { class: "wrap pf-body" }, main, side),
    gallery.length
      ? h("div", { class: "wrap pf-gallery" }, gallery.map((g) => h("img", { src: g, alt: "", loading: "lazy", decoding: "async" })))
      : null,
    h("div", { class: "wrap pf-foot" }, h("a", { class: "m-back", href: "/members/circle.html", text: "← Back to your circle" })),
  );
}

async function initProfile() {
  const me = await loadMe();
  setupNav(me, "");
  const root = $("#profileRoot");
  let id = new URLSearchParams(location.search).get("id") || "";
  if (id === "me") id = me.profile.id;

  const notFound = () =>
    renderState(root, "We couldn't find that profile.", "It may have been taken down, or the link isn't quite right.", "/members/circle.html", "Back to your circle");
  if (!/^[0-9a-f-]{36}$|^example-[a-z]+$/.test(id)) return notFound();

  let data;
  try {
    data = await api(`/api/profiles/${id}`);
  } catch {
    return notFound();
  }
  if (data.locked) {
    return renderState(
      root,
      "Profiles open up once we've welcomed you in.",
      "Finish your profile and send it to us. We'll let you in as soon as we've had a look.",
      "/members/me.html",
      "Finish your profile",
    );
  }
  renderProfile(root, data);
}

/* =========================================================
   Your profile (editor)
   ========================================================= */

const STATUS_LABELS = { draft: "Draft", pending: "With us for review", live: "Live", hidden: "Hidden" };
const MAX_PHOTOS = 4;

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("We couldn't read that photo. Try a JPEG or PNG."));
    };
    img.src = url;
  });
}

// Resize on the device so uploads stay small and fast, whatever the camera produced.
async function preparePhoto(file) {
  if (file.size > 40 * 1024 * 1024) throw new Error("That photo is very large. Try one under 40 MB.");
  let source;
  try {
    source = await createImageBitmap(file);
  } catch {
    source = await loadImageElement(file);
  }
  const scale = Math.min(1, 2400 / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.86, 0.78, 0.7]) {
    const blob = await toBlob(canvas, "image/jpeg", quality);
    if (blob && blob.size <= 4 * 1024 * 1024) return blob;
  }
  throw new Error("That photo is still too large after resizing. Try a smaller one.");
}

async function initMe() {
  let me = await loadMe();
  setupNav(me, "me");

  const form = $("#profileForm");
  const error = $("#profileError");
  const saveState = $("#saveState");
  const saveBtn = $("#saveBtn");
  const submitBtn = $("#submitBtn");
  const photoInput = $("#photoInput");
  const options = me.options;
  let dirty = false;
  let photoSlot = "hero";

  // Selects and checkboxes come from the server so there's one list of options.
  const fillSelect = (select, entries) =>
    select.replaceChildren(h("option", { value: "", text: "Choose…" }), ...entries.map(([value, label]) => h("option", { value, text: label })));
  fillSelect($("#spaceSize"), Object.entries(options.spaceSizes));
  fillSelect($("#timing"), Object.entries(options.timings));
  fillSelect($("#shareWith"), Object.entries(options.share));
  $("#needsField").append(
    ...Object.entries(options.needs).map(([value, label]) =>
      h("label", {}, h("input", { type: "checkbox", name: "needs", value }), ` ${label}`),
    ),
  );

  const TEXT_FIELDS = ["personName", "businessName", "trade", "area", "headline", "about", "spaceSize", "timing", "shareWith", "neighbours", "website", "instagram"];

  function setValues(raw) {
    TEXT_FIELDS.forEach((name) => {
      form.elements[name].value = raw[name] || "";
    });
    $$('input[name="kind"]', form).forEach((radio) => {
      radio.checked = radio.value === raw.kind;
    });
    $$('input[name="needs"]', form).forEach((box) => {
      box.checked = raw.needs.includes(box.value);
    });
    $$("[data-counter-for]").forEach(updateCounter);
  }

  function collect() {
    const data = {};
    TEXT_FIELDS.forEach((name) => {
      data[name] = form.elements[name].value;
    });
    data.kind = $('input[name="kind"]:checked', form)?.value || "";
    data.needs = $$('input[name="needs"]:checked', form).map((box) => box.value);
    return data;
  }

  function updateCounter(counter) {
    const field = form.elements[counter.dataset.counterFor];
    counter.textContent = `${field.value.length} / ${field.maxLength}`;
  }

  function renderStatus(profile) {
    const chip = $("#statusChip");
    chip.dataset.status = profile.status;
    chip.textContent = STATUS_LABELS[profile.status] || "Draft";
    const copy = {
      draft:
        profile.missing.length > 3
          ? "Add a hero photo and fill in the sections below, then send it to us. We read every profile before welcoming someone in."
          : profile.missing.length
            ? `Nearly there. To send it for review, add ${profile.missing.join(", ")}.`
            : "Looking good. Send it to us when you're ready and we'll take a look.",
      pending: "Thanks. We're reading it now and will welcome you in soon. You can keep editing in the meantime.",
      live: "You're in. Other members can see your profile, and your circle is open.",
      hidden: "Your profile is hidden at the moment. Email hello@adjoin.com.au if you'd like to talk about it.",
    };
    $("#statusCopy").textContent = copy[profile.status] || copy.draft;
    submitBtn.hidden = profile.status === "pending" || profile.status === "live";
    $("#previewLink").href = `/members/profile.html?id=${encodeURIComponent(profile.id)}`;
  }

  function pickPhoto(slot) {
    photoSlot = slot;
    photoInput.value = "";
    photoInput.click();
  }

  async function photoAction(request, busyEl) {
    showError(error, "");
    busyEl?.classList.add("photo-busy");
    try {
      const res = await request();
      me.profile = res.profile;
      renderPhotos();
      renderStatus(me.profile);
    } catch (err) {
      showError(error, err.message);
      error.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    } finally {
      busyEl?.classList.remove("photo-busy");
    }
  }

  function renderPhotos() {
    const photos = me.profile.photos;
    const heroSlot = $("#heroSlot");
    const gallerySlot = $("#gallerySlot");
    const hero = photos[0];

    if (hero) {
      heroSlot.replaceChildren(
        h("img", { src: safeSrc(hero.url), alt: "Your hero photo" }),
        h(
          "div",
          { class: "photo-actions" },
          h("button", { type: "button", class: "btn btn-line btn-xs", text: "Replace", onclick: () => pickPhoto("hero") }),
          h("button", {
            type: "button",
            class: "btn btn-line btn-xs",
            text: "Remove",
            onclick: () => photoAction(() => api(`/api/me/photos/${hero.key}`, { method: "DELETE" }), heroSlot),
          }),
        ),
      );
    } else {
      heroSlot.replaceChildren(
        h(
          "div",
          { class: "photo-empty" },
          h("strong", { text: "Add your hero photo" }),
          h("span", { text: "Landscape works best. It's the first thing people see." }),
          h("div", { style: "margin-top:16px" }, h("button", { type: "button", class: "btn btn-primary", text: "Choose a photo", onclick: () => pickPhoto("hero") })),
        ),
      );
    }

    const tiles = photos.slice(1).map((photo) =>
      h(
        "div",
        { class: "photo-tile" },
        h("img", { src: safeSrc(photo.url), alt: "" }),
        h(
          "div",
          { class: "photo-actions" },
          h("button", {
            type: "button",
            class: "btn btn-line btn-xs",
            text: "Make hero",
            onclick: (e) => photoAction(() => api(`/api/me/photos/${photo.key}/hero`, { method: "POST" }), e.currentTarget.closest(".photo-tile")),
          }),
          h("button", {
            type: "button",
            class: "btn btn-line btn-xs",
            "aria-label": "Remove photo",
            text: "Remove",
            onclick: (e) => photoAction(() => api(`/api/me/photos/${photo.key}`, { method: "DELETE" }), e.currentTarget.closest(".photo-tile")),
          }),
        ),
      ),
    );
    if (hero && photos.length < MAX_PHOTOS) {
      tiles.push(h("button", { type: "button", class: "photo-add", text: "+ Add a photo", onclick: () => pickPhoto("gallery") }));
    }
    gallerySlot.replaceChildren(...tiles);
    gallerySlot.hidden = !tiles.length;
  }

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    const busy = photoSlot === "hero" ? $("#heroSlot") : $("#gallerySlot");
    await photoAction(async () => {
      const blob = await preparePhoto(file);
      return api(`/api/me/photos?slot=${photoSlot}`, { method: "POST", blob });
    }, busy);
  });

  async function save() {
    showError(error, "");
    saveBtn.disabled = true;
    saveState.textContent = "Saving…";
    try {
      const res = await api("/api/me/profile", { method: "PUT", json: collect() });
      me.profile = res.profile;
      dirty = false;
      renderStatus(me.profile);
      saveState.textContent = "Saved.";
      return true;
    } catch (err) {
      showError(error, err.message);
      saveState.textContent = "Not saved yet.";
      error.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      return false;
    } finally {
      saveBtn.disabled = false;
    }
  }

  form.addEventListener("input", (event) => {
    dirty = true;
    saveState.textContent = "You have unsaved changes.";
    if (event.target.matches("[maxlength]")) {
      const counter = $(`[data-counter-for="${event.target.name}"]`);
      if (counter) updateCounter(counter);
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    save();
  });
  saveBtn.addEventListener("click", save);
  submitBtn.addEventListener("click", async () => {
    if (!(await save())) return;
    submitBtn.disabled = true;
    try {
      const res = await api("/api/me/submit", { method: "POST" });
      me.profile = res.profile;
      renderStatus(me.profile);
      saveState.textContent = "Sent. We'll take a look soon.";
    } catch (err) {
      showError(error, err.message);
      error.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    } finally {
      submitBtn.disabled = false;
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  /* Account */
  $("#accountEmail").textContent = me.user.email;

  $("#passwordForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = $("#passwordError");
    const ok = $("#passwordOk");
    showError(errorEl, "");
    ok.hidden = true;
    try {
      await api("/api/me/password", {
        method: "POST",
        json: { current: $("#currentPassword").value, next: $("#newPassword").value },
      });
      event.target.reset();
      ok.hidden = false;
    } catch (err) {
      showError(errorEl, err.message);
    }
  });

  $("#deleteForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = $("#deleteError");
    showError(errorEl, "");
    if (!window.confirm("Delete your account, profile and photos for good?")) return;
    try {
      await api("/api/me", { method: "DELETE", json: { password: $("#deletePassword").value } });
      dirty = false;
      location.assign("/");
    } catch (err) {
      showError(errorEl, err.message);
    }
  });

  setValues(me.profile.raw);
  renderStatus(me.profile);
  renderPhotos();
}

/* =========================================================
   Admin
   ========================================================= */

async function initAdmin() {
  const me = await loadMe();
  setupNav(me, "admin");
  const list = $("#adminList");
  const error = $("#adminError");
  const tabs = $$(".ad-tabs [data-tab]");

  if (!me.user.isAdmin) {
    $(".ad-tabs").hidden = true;
    list.replaceChildren(h("p", { text: "This page is for Adjoin admins only." }));
    return;
  }

  let data = { profiles: [], intros: [] };
  let tab = "pending";
  const labels = { pending: "Waiting", live: "Live", hidden: "Hidden", draft: "Drafts" };

  function updateCounts() {
    tabs.forEach((btn) => {
      const key = btn.dataset.tab;
      if (labels[key]) btn.textContent = `${labels[key]} (${data.profiles.filter((p) => p.status === key).length})`;
      if (key === "intros") btn.textContent = `Introductions (${data.intros.length})`;
      btn.setAttribute("aria-pressed", String(key === tab));
    });
  }

  async function setStatus(id, status) {
    showError(error, "");
    try {
      const res = await api(`/api/admin/profiles/${id}`, { method: "POST", json: { status } });
      data.profiles = data.profiles.map((p) => (p.id === id ? res.profile : p));
      render();
    } catch (err) {
      showError(error, err.message);
    }
  }

  function profileRow(p) {
    const actions = [h("a", { class: "btn btn-line btn-xs", href: `/members/profile.html?id=${p.id}`, text: "View" })];
    if (p.status !== "live" && p.status !== "draft") {
      actions.push(h("button", { type: "button", class: "btn btn-primary btn-xs", text: "Welcome in", onclick: () => setStatus(p.id, "live") }));
    }
    if (p.status === "live" || p.status === "pending") {
      actions.push(h("button", { type: "button", class: "btn btn-line btn-xs", text: "Hide", onclick: () => setStatus(p.id, "hidden") }));
    }
    const thumb = safeSrc(p.hero);
    return h(
      "article",
      { class: "ad-row" },
      thumb ? h("img", { class: "ad-thumb", src: thumb, alt: "" }) : h("div", { class: "ad-thumb" }),
      h(
        "div",
        {},
        h("h3", { text: p.businessName || "No business name yet" }),
        h("p", { text: [p.trade, p.kindLabel, p.area].filter(Boolean).join(" · ") || "Profile not filled in yet" }),
        h("p", { text: [p.email, p.submittedAt ? `sent ${dateLabel(p.submittedAt)}` : `updated ${dateLabel(p.updatedAt)}`].join(" · ") }),
        p.missing ? h("p", { text: `${p.missing} thing${p.missing === 1 ? "" : "s"} still missing` }) : null,
      ),
      h("div", { class: "ad-actions" }, actions),
    );
  }

  function introCard(intro) {
    return h(
      "article",
      { class: "ad-intro" },
      h("h3", { text: `${intro.fromBusiness || intro.fromEmail} would like to meet ${intro.toBusiness}` }),
      h("p", { text: `${intro.fromEmail} → ${intro.toEmail} · ${dateLabel(intro.createdAt)}` }),
      intro.message ? h("p", { text: intro.message }) : null,
    );
  }

  function resetForm() {
    const input = h("input", { type: "email", id: "resetEmail", autocomplete: "off", maxlength: "254" });
    const result = h("div", {});
    const status = h("p", { class: "form-error", role: "alert" });
    const form = h(
      "form",
      { class: "form", style: "max-width:460px" },
      h("p", { text: "Creates a temporary password and signs them out everywhere. Pass it on privately; they can change it from their profile." }),
      status,
      h("div", { class: "field" }, h("label", { for: "resetEmail", text: "Member's email" }), input),
      h("button", { type: "submit", class: "btn btn-primary", text: "Create temporary password" }),
      result,
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      showError(status, "");
      result.replaceChildren();
      try {
        const res = await api("/api/admin/reset-password", { method: "POST", json: { email: input.value } });
        result.replaceChildren(h("p", { text: `Temporary password for ${res.email}:` }), h("p", { class: "ad-temp", text: res.temporaryPassword }));
      } catch (err) {
        showError(status, err.message);
      }
    });
    return form;
  }

  function render() {
    updateCounts();
    if (tab === "intros") {
      list.replaceChildren(...(data.intros.length ? data.intros.map(introCard) : [h("p", { text: "No introduction requests yet." })]));
    } else if (tab === "reset") {
      list.replaceChildren(resetForm());
    } else {
      const rows = data.profiles.filter((p) => p.status === tab).map(profileRow);
      list.replaceChildren(...(rows.length ? rows : [h("p", { text: "Nothing here right now." })]));
    }
  }

  tabs.forEach((btn) =>
    btn.addEventListener("click", () => {
      tab = btn.dataset.tab;
      render();
    }),
  );

  try {
    data = await api("/api/admin");
    render();
  } catch (err) {
    list.replaceChildren();
    showError(error, err.message);
  }
}

/* ---------- Start ---------- */

const PAGES = { auth: initAuth, circle: initCircle, profile: initProfile, me: initMe, admin: initAdmin };
PAGES[document.body.dataset.page]?.().catch((err) => {
  console.error(err);
  const main = $("#main");
  if (main) main.prepend(h("div", { class: "wrap", style: "padding-top:120px" }, h("p", { class: "form-error is-visible", text: err.message || "Something went wrong." })));
});
