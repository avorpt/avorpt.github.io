/* ==========================================================================
   Main interactions
   --------------------------------------------------------------------------
   [01]  Gallery (on-page stepper)
   [02]  Viewer (modal slideshow, built on <dialog>)
   [03]  Contact mail link
   ========================================================================== */

// === [01] GALLERY ==========================================================
document.querySelectorAll(".gallery").forEach((gallery) => {
  const slides = [...gallery.querySelectorAll(".gallery-slide")];
  const count = gallery.querySelector(".gallery-count");
  const prev = gallery.querySelector(".gallery-prev");
  const next = gallery.querySelector(".gallery-next");
  const stage = gallery.querySelector(".gallery-stage");
  let current = slides.findIndex((slide) =>
    slide.classList.contains("is-active"),
  );

  if (!stage || !count || !prev || !next || slides.length === 0) return;
  if (current === -1) current = 0;

  // Normalize startup state so exactly one slide owns the active class.
  slides.forEach((slide, index) => {
    slide.classList.toggle("is-active", index === current);
  });

  if (slides.length === 1) {
    prev.disabled = true;
    next.disabled = true;
  }

  const updateCount = () => {
    count.textContent = `${current + 1} / ${slides.length}`;
  };

  function show(index) {
    slides[current].classList.remove("is-active");
    current = (index + slides.length) % slides.length;
    slides[current].classList.add("is-active");
    updateCount();

    slides.forEach((s, i) => {
      if (s.tagName === "VIDEO" && i !== current) s.pause();
    });
  }

  updateCount();

  function handleGalleryButton(event, direction) {
    event.preventDefault();
    show(current + direction);
  }

  prev.addEventListener("click", (event) => handleGalleryButton(event, -1));
  next.addEventListener("click", (event) => handleGalleryButton(event, 1));
  prev.addEventListener("pointerup", () => prev.blur());
  next.addEventListener("pointerup", () => next.blur());

  stage.tabIndex = 0;
  stage.setAttribute("role", "button");
  stage.setAttribute("aria-label", "Open image viewer");
  stage.addEventListener("click", () => openViewer(slides, current));
  stage.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openViewer(slides, current);
    }
  });
});

// === [02] VIEWER ===========================================================
// A minimal modal slideshow on <dialog>. The element provides Esc-to-close,
// top-layer stacking and an inert background; JS swaps slides and keeps Tab
// within the viewer controls. One layout for every device.
const viewer = buildViewer();

function openViewer(slides, index) {
  viewer?.open(slides, index);
}

function buildViewer() {
  if (!document.querySelector(".gallery")) return null;

  const dialog = document.createElement("dialog");
  dialog.className = "viewer";
  dialog.tabIndex = -1;
  dialog.setAttribute("aria-label", "Media viewer");

  const close = document.createElement("button");
  close.type = "button";
  close.className = "viewer-close";
  close.setAttribute("aria-label", "Close viewer");
  close.innerHTML = "&times;";

  const track = document.createElement("div");
  track.className = "viewer-track";

  const nav = document.createElement("div");
  nav.className = "viewer-nav";
  const counter = document.createElement("span");
  counter.className = "viewer-count";
  counter.setAttribute("aria-live", "polite");
  const prev = navButton("Previous image", "‹", -1);
  const next = navButton("Next image", "›", 1);
  nav.append(prev, counter, next);

  dialog.append(close, track, nav);
  document.body.append(dialog);

  const state = { slides: [], index: 0 };

  function navButton(label, glyph, dir) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "viewer-nav-btn";
    btn.setAttribute("aria-label", label);
    btn.textContent = glyph;
    btn.addEventListener("click", () => go(state.index + dir));
    return btn;
  }

  function render() {
    [...track.children].forEach((figure, i) => {
      const active = i === state.index;
      figure.classList.toggle("is-active", active);
      const video = figure.querySelector("video");
      if (video && !active) video.pause();
    });
    counter.textContent = `${state.index + 1} / ${state.slides.length}`;
  }

  function go(i) {
    const n = state.slides.length;
    if (!n) return;
    state.index = ((i % n) + n) % n; // wrap both directions
    render();
  }

  function focusableItems() {
    const video = track.querySelector(".viewer-slide.is-active video[controls]");
    return [close, video, prev, next].filter((item) =>
      item && !item.disabled && item.getClientRects().length,
    );
  }

  function keepFocusInside(event) {
    const items = focusableItems();
    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const leavingStart =
      event.shiftKey && (active === first || active === dialog);
    const leavingEnd =
      !event.shiftKey && (active === last || active === dialog);

    if (!dialog.contains(active) || leavingStart || leavingEnd) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  function open(slides, index) {
    state.slides = slides;
    state.index = index;
    track.replaceChildren(...slides.map(slideToFigure));
    nav.hidden = slides.length < 2;
    render();
    if (!dialog.open) {
      dialog.showModal();
      dialog.focus({ preventScroll: true });
    }
  }

  close.addEventListener("click", () => dialog.close());

  // Click the backdrop or the empty space around the media to close.
  dialog.addEventListener("click", (event) => {
    if (
      event.target === dialog ||
      event.target === track ||
      event.target.classList.contains("viewer-slide")
    ) {
      dialog.close();
    }
  });

  // Esc is handled natively by <dialog>; arrows step through the set.
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      keepFocusInside(event);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(state.index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(state.index + 1);
    }
  });

  // Touch swipe (mobile): horizontal flick steps slides.
  let startX = 0;
  let startY = 0;
  track.addEventListener(
    "touchstart",
    (event) => {
      startX = event.changedTouches[0].clientX;
      startY = event.changedTouches[0].clientY;
    },
    { passive: true },
  );
  track.addEventListener(
    "touchend",
    (event) => {
      const dx = event.changedTouches[0].clientX - startX;
      const dy = event.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        go(state.index + (dx < 0 ? 1 : -1));
      }
    },
    { passive: true },
  );

  dialog.addEventListener("close", () => {
    track.querySelectorAll("video").forEach((v) => v.pause());
    track.replaceChildren();
  });

  return { open };
}

// Clone a gallery slide (<img>/<video>) into a viewer figure.
function slideToFigure(slide) {
  const figure = document.createElement("figure");
  figure.className = "viewer-slide";
  const isVideo = slide.tagName === "VIDEO" || slide.dataset.type === "video";

  if (isVideo) {
    const video = document.createElement("video");
    video.src = slide.getAttribute("src") || slide.querySelector("source")?.src || "";
    const poster = slide.getAttribute("poster");
    if (poster) video.poster = poster;
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
    figure.append(video);
  } else {
    const img = document.createElement("img");
    img.src = slide.getAttribute("src");
    img.alt = slide.alt || "";
    figure.append(img);
  }

  return figure;
}

// === [03] CONTACT MAIL LINK ================================================
// Assemble the mailto at runtime so the raw address never sits in the HTML
// source as one string (deters naive scrapers). Without JS the link is inert.
document.querySelectorAll(".js-mail").forEach((el) => {
  el.href = `mailto:${el.dataset.user}@${el.dataset.domain}`;
});
