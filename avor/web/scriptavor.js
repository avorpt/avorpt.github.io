// ownership slider
const ownershipSlider = document.querySelector(".ownership");

if (ownershipSlider) {
  const slides = [...ownershipSlider.querySelectorAll(".ownership-slide")];
  const prevBtn = ownershipSlider.querySelector(".ownership-arrow.prev");
  const nextBtn = ownershipSlider.querySelector(".ownership-arrow.next");
  const currentEl = ownershipSlider.querySelector(".ownership-current");
  const totalEl = ownershipSlider.querySelector(".ownership-total");

  if (slides.length > 0 && prevBtn && nextBtn && currentEl && totalEl) {
    let currentIndex = 0;

    const updateSlider = (nextIndex) => {
      slides[currentIndex].classList.remove("is-active");
      currentIndex = (nextIndex + slides.length) % slides.length;
      slides[currentIndex].classList.add("is-active");
      currentEl.textContent = String(currentIndex + 1).padStart(2, "0");
    };

    currentEl.textContent = String(currentIndex + 1).padStart(2, "0");
    totalEl.textContent = String(slides.length).padStart(2, "0");

    prevBtn.addEventListener("click", () => updateSlider(currentIndex - 1));
    nextBtn.addEventListener("click", () => updateSlider(currentIndex + 1));
  }
}

// search / filters
const searchControls = document.querySelector(".search-controls");

if (searchControls) {
  const searchCards = [...document.querySelectorAll(".search-card")];
  const searchEmpty = document.querySelector(".search-empty");
  const filterFields = [...searchControls.querySelectorAll(".filter-field")];

  const setTriggerLabel = (trigger, label, isSelected = false) => {
    trigger.replaceChildren(label);

    if (isSelected) {
      const clearMark = document.createElement("span");
      clearMark.className = "filter-clear";
      clearMark.setAttribute("aria-hidden", "true");
      clearMark.textContent = "x";
      trigger.append(clearMark);
    }
  };

  const closeFilter = (field) => {
    field.classList.remove("open");
    field
      .querySelector(".filter-trigger")
      ?.setAttribute("aria-expanded", "false");
  };

  const closeFilters = (currentField) => {
    filterFields.forEach((field) => {
      if (field !== currentField) {
        closeFilter(field);
      }
    });
  };

  const updateSearch = () => {
    const formData = new FormData(searchControls);
    let visibleCount = 0;

    searchCards.forEach((card) => {
      const isVisible = [...formData.entries()].every(([key, value]) => {
        if (value === "all") {
          return true;
        }

        if (key === "price") {
          return Number(card.dataset.price) <= Number(value);
        }

        if (key === "mileage") {
          return Number(card.dataset.mileage) <= Number(value);
        }

        return card.dataset[key] === value;
      });

      card.hidden = !isVisible;

      if (isVisible) {
        visibleCount += 1;
      }
    });

    if (searchEmpty) {
      searchEmpty.hidden = visibleCount > 0;
    }
  };

  filterFields.forEach((field) => {
    const input = field.querySelector('input[type="hidden"]');
    const trigger = field.querySelector(".filter-trigger");
    const options = [...field.querySelectorAll(".filter-options button")];

    trigger?.addEventListener("click", () => {
      if (input.value !== "all") {
        input.value = "all";
        setTriggerLabel(trigger, "All");
        options.forEach((item) => item.setAttribute("aria-pressed", "false"));
        closeFilter(field);
        updateSearch();
        return;
      }

      const isOpen = field.classList.toggle("open");
      trigger.setAttribute("aria-expanded", String(isOpen));
      closeFilters(field);
    });

    options.forEach((option) => {
      option.addEventListener("click", () => {
        input.value = option.dataset.value;
        setTriggerLabel(trigger, option.textContent, true);

        options.forEach((item) =>
          item.setAttribute("aria-pressed", String(item === option)),
        );
        closeFilter(field);
        updateSearch();
      });
    });
  });

  document.addEventListener("click", (event) => {
    if (!searchControls.contains(event.target)) {
      closeFilters();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeFilters();
    }
  });

  searchControls.addEventListener("change", updateSearch);
  updateSearch();
}

// menu
const nav = document.querySelector(".nav");
const navTrigger = document.querySelector(".nav-trigger");
const navBackdrop = document.querySelector(".nav-backdrop");
const navLinks = document.querySelectorAll(".nav-menu a");

if (nav && navTrigger) {
  const closeNav = () => {
    nav.classList.remove("open");
    document.body.classList.remove("menu-open");
    navTrigger.setAttribute("aria-expanded", "false");
  };

  const openNav = () => {
    nav.classList.add("open");
    document.body.classList.add("menu-open");
    navTrigger.setAttribute("aria-expanded", "true");
  };

  navTrigger.addEventListener("click", () => {
    if (nav.classList.contains("open")) {
      closeNav();
    } else {
      openNav();
    }
  });

  navBackdrop?.addEventListener("click", closeNav);

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      closeNav();
    });
  });

  window.addEventListener(
    "scroll",
    () => {
      if (nav.classList.contains("open")) {
        closeNav();
      }
    },
    { passive: true },
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNav();
    }
  });
}

// footer "Top" — slower scroll than native (CSS scroll-behavior has no duration knob).
// Reduced-motion is honored: we bail, leaving the native instant jump in place.
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

document.querySelectorAll(".footer-top").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (reduceMotion.matches || window.scrollY === 0) return;
    event.preventDefault();

    const start = window.scrollY;
    const t0 = performance.now();
    const duration = 850; // ms — raise for slower

    // no mid-scroll interrupt guard; a Top link doesn't need one.
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      window.scrollTo({ top: start * (1 - eased), behavior: "instant" }); // 'instant' bypasses CSS smooth
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
});
