"use strict";

/*────────────────────────────────────────────────────────────
  script.js — Single-page scroll interactions
  · Smooth anchor scroll      · Active nav + dot tracking
  · Scroll progress bar       · Reveal animations (IO)
  · Portfolio filter + modal  · Skill bar animation
  · Tech tags stagger         · Mobile nav toggle
  · Form validation
────────────────────────────────────────────────────────────*/


/* ── Smooth scroll for all anchor links ────────────────── */

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (e) => {
    const id = link.getAttribute("href");
    if (!id || id === "#") return;

    const target = document.querySelector(id);
    if (!target) return;

    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });

    // Close mobile nav if open
    closeMobileNav();
  });
});


/* ── Scroll progress bar ────────────────────────────────── */

const progressBar = document.getElementById("scrollProgress");

function updateProgress() {
  if (!progressBar) return;
  const total = document.documentElement.scrollHeight - window.innerHeight;
  const pct   = total > 0 ? (window.scrollY / total) * 100 : 0;
  progressBar.style.width = pct + "%";
}


/* ── Active section tracking ────────────────────────────── */

const sections   = document.querySelectorAll(".section[data-section]");
const navLinks   = document.querySelectorAll("[data-nav]");
const sideDots   = document.querySelectorAll("[data-dot]");
const siteHeader = document.getElementById("siteHeader");

function getActiveSection() {
  // The section whose top is closest to 40% of the viewport
  const threshold = window.scrollY + window.innerHeight * 0.40;
  let current = sections[0];

  sections.forEach((sec) => {
    if (sec.offsetTop <= threshold) current = sec;
  });

  return current ? current.dataset.section : null;
}

function updateNav() {
  const active = getActiveSection();

  navLinks.forEach((l) =>
    l.classList.toggle("active", l.dataset.nav === active)
  );
  sideDots.forEach((d) =>
    d.classList.toggle("active", d.dataset.dot === active)
  );

  // Solid header once user starts scrolling
  if (siteHeader) {
    siteHeader.classList.toggle("scrolled", window.scrollY > 50);
  }
}


/* ── Mobile nav ─────────────────────────────────────────── */

const headerNav    = document.getElementById("headerNav");
const navHamburger = document.getElementById("navHamburger");

function closeMobileNav() {
  if (headerNav)    headerNav.classList.remove("is-open");
  if (navHamburger) navHamburger.classList.remove("is-open");
  document.body.style.overflow = "";
}

if (navHamburger && headerNav) {
  navHamburger.addEventListener("click", () => {
    const open = headerNav.classList.toggle("is-open");
    navHamburger.classList.toggle("is-open", open);
    document.body.style.overflow = open ? "hidden" : "";
  });
}

// Close on backdrop click (mobile full-screen nav)
document.addEventListener("click", (e) => {
  if (
    headerNav &&
    headerNav.classList.contains("is-open") &&
    !headerNav.contains(e.target) &&
    e.target !== navHamburger
  ) {
    closeMobileNav();
  }
});


/* ── Unified scroll handler ─────────────────────────────── */

window.addEventListener(
  "scroll",
  () => {
    updateProgress();
    updateNav();
  },
  { passive: true }
);


/* ── Reveal animations via IntersectionObserver ─────────── */

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.10, rootMargin: "0px 0px -60px 0px" }
);

function initReveal() {
  document
    .querySelectorAll(".reveal-up, .reveal-left, .reveal-right, .reveal-scale")
    .forEach((el) => {
      // Hero elements should already be visible on page load
      if (el.closest(".hero-section")) {
        el.classList.add("is-visible");
      } else {
        revealObserver.observe(el);
      }
    });
}


/* ── Skill bar animation ────────────────────────────────── */

function initSkillBars() {
  const skillsSection = document.querySelector(".skills-section");
  if (!skillsSection) return;

  new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll(".skill-fill").forEach((fill) => {
            const w = fill.dataset.width;
            if (w) fill.style.width = w + "%";
          });
        }
      });
    },
    { threshold: 0.30 }
  ).observe(skillsSection);
}


/* ── Mouse-tracking glow border — section + individual tags ─ */

function initGlowEffect() {
  const section = document.querySelector(".tech-section");
  const tags    = Array.from(document.querySelectorAll(".tech-tag"));
  const cards   = Array.from(document.querySelectorAll(".client-card"));
  const targets = [...(section ? [section] : []), ...tags, ...cards];
  if (!targets.length) return;

  // Per-element angle state (avoid closure mutation bugs)
  const state = new Map(
    targets.map((el) => [el, { current: 0, target: 0 }])
  );

  // Single rAF loop — lerps every tracked element's glow angle
  function tick() {
    state.forEach((s, el) => {
      const diff = ((s.target - s.current + 180) % 360) - 180;
      if (Math.abs(diff) > 0.05) {
        s.current += diff * 0.06;
        el.style.setProperty("--glow-start", s.current.toFixed(1));
      }
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  document.addEventListener(
    "pointermove",
    (e) => {
      targets.forEach((el) => {
        const isTag  = el.classList.contains("tech-tag") || el.classList.contains("client-card");
        const prox   = isTag ? 4 : 80;
        const rect   = el.getBoundingClientRect();
        const cx     = rect.left + rect.width  * 0.5;
        const cy     = rect.top  + rect.height * 0.5;

        const inBounds =
          e.clientX > rect.left   - prox &&
          e.clientX < rect.right  + prox &&
          e.clientY > rect.top    - prox &&
          e.clientY < rect.bottom + prox;

        el.style.setProperty("--glow-active", inBounds ? "1" : "0");
        if (!inBounds) return;

        const angle     = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
        const s         = state.get(el);
        const angleDiff = ((angle - s.target + 180) % 360) - 180;
        s.target += angleDiff;
      });
    },
    { passive: true }
  );
}


/* ── Tech tag stagger ───────────────────────────────────── */

function initTechTags() {
  const tags        = document.querySelectorAll(".tech-tag");
  const techSection = document.querySelector(".tech-section");
  if (!tags.length || !techSection) return;

  // Set initial hidden state via inline style (JS-owned)
  tags.forEach((tag, i) => {
    tag.style.opacity   = "0";
    tag.style.transform = "translateY(10px)";
    tag.style.transition = `opacity 0.45s ease ${i * 0.028}s, transform 0.45s ease ${i * 0.028}s`;
  });

  new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          tags.forEach((tag) => {
            tag.style.opacity   = "1";
            tag.style.transform = "translateY(0)";
          });
        }
      });
    },
    { threshold: 0.25 }
  ).observe(techSection);
}


/* ── Portfolio filter ───────────────────────────────────── */

const filterBtns   = document.querySelectorAll("[data-filter]");
const projectCards = document.querySelectorAll(".project-card");

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const filter = btn.dataset.filter;

    projectCards.forEach((card) => {
      const show = filter === "all" || card.dataset.category === filter;
      card.style.display = show ? "" : "none";
    });
  });
});


/* ── Portfolio modal ────────────────────────────────────── */

const projectModal  = document.getElementById("projectModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalClose    = document.getElementById("modalClose");
const modalImg      = document.getElementById("modalImg");
const modalTitle    = document.getElementById("modalTitle");
const modalCat      = document.getElementById("modalCat");
const modalDesc     = document.getElementById("modalDesc");

function openModal(card) {
  if (!projectModal) return;

  const img   = card.querySelector("img");
  const title = card.querySelector(".project-name");
  const cat   = card.querySelector(".project-cat");
  const desc  = card.querySelector(".project-desc");

  if (img   && modalImg)   { modalImg.src = img.src; modalImg.alt = img.alt || ""; }
  if (title && modalTitle) modalTitle.textContent = title.textContent;
  if (cat   && modalCat)   modalCat.textContent   = cat.textContent;
  if (desc  && modalDesc)  modalDesc.textContent  = desc.textContent;

  projectModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  if (!projectModal) return;
  projectModal.classList.remove("active");
  document.body.style.overflow = "";
}

document.querySelectorAll("[data-project]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    openModal(link.closest(".project-card"));
  });
});

if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);
if (modalClose)    modalClose.addEventListener("click", closeModal);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});


/* ── Contact form validation ────────────────────────────── */

const form       = document.querySelector("[data-form]");
const formInputs = document.querySelectorAll("[data-form-input]");
const formBtn    = document.querySelector("[data-form-btn]");

if (form && formBtn) {
  formInputs.forEach((input) => {
    input.addEventListener("input", () => {
      formBtn.disabled = !form.checkValidity();
    });
  });
}


/* ── Init ───────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  initReveal();
  initSkillBars();
  initTechTags();
  initGlowEffect();
  updateProgress();
  updateNav();
});
