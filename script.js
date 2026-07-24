// v1.1.2

// Page transitions + work filter + case study

gsap.registerPlugin(CustomEase, Draggable, InertiaPlugin, ScrollTrigger);
history.scrollRestoration = 'manual';

// Global state
let lenis                    = null;
let nextPage                 = document;
let onceFunctionsInitialized = false;
let mobileMenuInitialized    = false;
let enterScrollOffset        = 0;
let showreelPlayer           = null;

const hasLenis         = typeof window.Lenis !== 'undefined';
const hasScrollTrigger = typeof window.ScrollTrigger !== 'undefined';

// Reduced motion
const rmMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = rmMQ.matches;
rmMQ.addEventListener?.('change', e => (reducedMotion = e.matches));

CustomEase.create('osmo', '0.625, 0.05, 0, 1');
gsap.defaults({ ease: 'osmo', duration: 0.6 });
if (!CustomEase.get?.('osmo-ease')) CustomEase.create('osmo-ease', '0.625, 0.05, 0, 1');



//Work constants — shared by the filter, the view toggle, see-more and the nav dot.
//Declared up here so init order can never put them in a temporal dead zone.

const WORK_VIEWS    = { grid: '/work', list: '/work-list' };
const VIEW_PREF_KEY = 'bh:workView';

// Slug maps — left = URL param, right = the label as authored in the CMS
const INDUSTRY_SLUGS = {
  'accounting':         'Accounting',
  'aec':                'Architecture, Engineering & Construction',
  'consulting':         'Consulting',
  'financial-services': 'Financial Services',
  'insurance':          'Insurance',
  'law-firm':           'Law Firm',
  'private-equity':     'Private Equity',
  'real-estate':        'Real Estate',
};

const WORK_SLUGS = {
  'identity': 'Brand Identity',
  'launch':   'Brand launch',
  'naming':   'Naming',
  'websites': 'Websites',
};

// CMS values carry double/trailing spaces ("Architecture, Engineering  & Construction ")
// so every label comparison goes through this. Exact-match selectors would miss.
const normLabel = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

const slugToIndustry = slug => INDUSTRY_SLUGS[slug] || slug;
const slugToWork     = slug => WORK_SLUGS[slug]     || slug;
const industryToSlug = name => Object.keys(INDUSTRY_SLUGS).find(k => normLabel(INDUSTRY_SLUGS[k]) === normLabel(name)) || name;
const workToSlug     = name => Object.keys(WORK_SLUGS).find(k => normLabel(WORK_SLUGS[k]) === normLabel(name))         || name;

// Which axis does a bare slug belong to? see-more only stores one value.
function resolveSlugAxis(slug) {
  if (INDUSTRY_SLUGS[slug]) return 'industry';
  if (WORK_SLUGS[slug])     return 'work';
  return null;
}



//Scroll

function hardScrollToTop() {
  if (lenis) {
    lenis.stop();
    lenis.scrollTo(0, { immediate: true, force: true });
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}



//Init registry

function initOnceFunctions() {
  initLenis();
  if (onceFunctionsInitialized) return;
  onceFunctionsInitialized = true;
  initNavPill();
  initMobileMenu();
  if (document.querySelector('.img-land')) initMuxVideos();
}

function initBeforeEnterFunctions(next) {
  nextPage = next || document;
  window._collapseNavPill?.();
  window._closeMobileMenu?.();
}

function initAfterEnterFunctions(next) {
  const container = next || document;

  // On first load this runs TWICE — once from Barba's `once` hook and again
  // from the global `afterEnter` hook — which double-binds every click handler
  // below. (The accordion ends up with two handlers that cancel each other, so
  // it never opens.) Mark the container so the duplicate same-container call is
  // a no-op. A real navigation supplies a fresh container node, so it still
  // re-initialises correctly each time.
  if (container._afterEnterInited) return;
  container._afterEnterInited = true;

  nextPage = container;
  initNavActiveDot();
  initModal();
  initAccordion();
  initAccordionFilterLink();
  initSlider();
  initCenteredSliders();
  initWorkFilter();
  initViewToggle();   // must follow initWorkFilter — reads FilterAPI.currentParams()
  syncWorkNavLinks();
  initWorkListMedia();
  initGalleryScroll();
  initGalleryVideo();
  initShowreel();
  initSeeMore();
  initPeopleGrid();
  initThemeVideo();
  if (lenis) lenis.resize(); // guard on the instance, not the library — instance may not exist yet on first load
  if (hasScrollTrigger) ScrollTrigger.refresh();
}



//Transitions

let transitionOverlay = null;

function getTransitionOverlay() {
  if (transitionOverlay) return transitionOverlay;
  transitionOverlay = document.createElement('div');
  transitionOverlay.style.cssText = 'position:fixed;inset:0;background:var(--black);z-index:9999;pointer-events:none;';
  gsap.set(transitionOverlay, { autoAlpha: 0 });
  document.body.appendChild(transitionOverlay);
  return transitionOverlay;
}

function runPageOnceAnimation(next) {
  getTransitionOverlay();
  const tl = gsap.timeline();
  tl.call(() => resetPage(next), null, 0);
  return tl;
}

function runPageLeaveAnimation(current) {
  const overlay = getTransitionOverlay();
  const tl = gsap.timeline({ onComplete: () => current.remove() });
  if (reducedMotion) return tl.set(overlay, { autoAlpha: 1 });
  tl.to(overlay, { autoAlpha: 1, duration: 0.35, ease: 'power2.inOut' });
  return tl;
}

function runPageEnterAnimation(next) {
  const overlay = getTransitionOverlay();
  const tl = gsap.timeline();

  if (reducedMotion) {
    tl.call(() => resetPage(next));
    tl.set(overlay, { autoAlpha: 0 });
    return Promise.resolve();
  }

  // Screen is black from leave — scroll to top invisibly, then reveal
  tl.call(() => resetPage(next), null, 0);
  tl.to(overlay, { autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, 0.05);

  const h1 = next.querySelector('h1');
  if (h1) {
    tl.fromTo(h1,
      { yPercent: 20, autoAlpha: 0 },
      { yPercent: 0, autoAlpha: 1, ease: 'expo.out', duration: 0.8 },
      0.15
    );
  }

  return new Promise(resolve => tl.call(resolve));
}



//Barba

barba.hooks.beforeEnter(data => {
  if (lenis?.stop) lenis.stop();
  initBeforeEnterFunctions(data.next.container);
  applyThemeFrom(data.next.container);
});

barba.hooks.afterLeave(() => {
  window.GALLERY_PLAYBACK_ID = null;
  if (hasScrollTrigger) ScrollTrigger.getAll().forEach(t => t.kill());
});

barba.hooks.enter(data => {
  initBarbaNavUpdate(data);
});

barba.hooks.afterEnter(data => {
  initAfterEnterFunctions(data.next.container);
  if (data.next.container.querySelector('.img-land')) initMuxVideos();
  if (lenis) { lenis.resize(); lenis.start(); }
  if (hasScrollTrigger) ScrollTrigger.refresh();
});

barba.init({
  debug: false,
  timeout: 7000,
  preventRunning: true,
  transitions: [
    {
      name: 'default',
      sync: false,
      async once(data) {
        // initOnceFunctions creates the lenis instance and wires global,
        // one-time things; initAfterEnterFunctions wires the page's
        // interactive bits. Each is isolated so a throw in one can't stop
        // the other from running.
        try { initOnceFunctions(); }
        catch (e) { console.error('[once] initOnceFunctions failed:', e); }

        try { initAfterEnterFunctions(data.next.container); }
        catch (e) { console.error('[once] initAfterEnterFunctions failed:', e); }

        return runPageOnceAnimation(data.next.container);
      },
      async leave(data) {
        return runPageLeaveAnimation(data.current.container);
      },
      async enter(data) {
        return runPageEnterAnimation(data.next.container);
      },
    },
  ],
});


window.addEventListener('load', () => {
  requestAnimationFrame(() => {
    document.querySelector('.nav-pill')?.style.setProperty('will-change', 'transform');
  });
});


  

//Helpers

const themeConfig = {
  light: { nav: 'dark',  transition: 'light' },
  dark:  { nav: 'light', transition: 'dark'  },
};

function applyThemeFrom(container) {
  const pageTheme = container?.dataset?.pageTheme || 'light';
  const config    = themeConfig[pageTheme] || themeConfig.light;
  document.body.dataset.pageTheme = pageTheme;
  const transitionEl = document.querySelector('[data-theme-transition]');
  if (transitionEl) transitionEl.dataset.themeTransition = config.transition;
  const nav = document.querySelector('[data-theme-nav]');
  if (nav) nav.dataset.themeNav = config.nav;
}

function initLenis() {
  if (lenis || !hasLenis) return;
  lenis = new Lenis({ lerp: 0.165, wheelMultiplier: 1.25 });
  if (hasScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function resetPage(container) {
  hardScrollToTop();
  if (lenis) { lenis.resize(); lenis.start(); }
  enterScrollOffset = 0;
}

function initBarbaNavUpdate(data) {
  const tpl = document.createElement('template');
  tpl.innerHTML = data.next.html.trim();
  const nextNodes    = tpl.content.querySelectorAll('[data-barba-update]');
  const currentNodes = document.querySelectorAll('nav [data-barba-update]');
  currentNodes.forEach((curr, i) => {
    const next = nextNodes[i];
    if (!next) return;
    const newStatus = next.getAttribute('aria-current');
    newStatus !== null
      ? curr.setAttribute('aria-current', newStatus)
      : curr.removeAttribute('aria-current');
    curr.setAttribute('class', next.getAttribute('class') || '');
  });
}



//Nav pill

function initNavPill() {
  const pill    = document.querySelector('.nav-pill');
  const trigger = document.querySelector('.mobile-menu-trigger');
  if (!pill) return;

  const THRESHOLD = 150;
  let expanded = false;

  const expand = () => {
    if (expanded) return;
    pill.classList.add('is-expanded');
    expanded = true;
  };

  const collapse = (instant = false) => {
    if (!expanded) return;
    if (instant) {
      const wrapper = pill.querySelector('.nav-link-wrapper');
      const links   = pill.querySelectorAll('.link');
      const snapOff = el => { el.style.transition = 'none'; };
      const snapOn  = el => { el.style.transition = '';     };
      [pill, wrapper, ...links].forEach(el => el && snapOff(el));
      pill.classList.remove('is-expanded');
      expanded = false;
      requestAnimationFrame(() => [pill, wrapper, ...links].forEach(el => el && snapOn(el)));
    } else {
      pill.classList.remove('is-expanded');
      expanded = false;
    }
  };

  // For now: desktop pill stays open permanently; mobile keeps its trigger.
  // Open on desktop at init and whenever we cross back into desktop width.
  const openOnDesktop = () => { if (window.innerWidth > 767) expand(); };
  openOnDesktop();
  window.addEventListener('resize', openOnDesktop, { passive: true });

  // Keep page transitions from snapping it shut on desktop.
  window._collapseNavPill = () => { if (window.innerWidth <= 767) collapse(true); };

  /* ── Original open-on-scroll / toggle-on-trigger behaviour (desktop) ──
     Restore this block to bring back the collapsible pill.

  window._collapseNavPill = () => collapse(true);

  // Scroll: one-way open only — never collapses on scroll.
  const onScroll = () => {
    if (window.innerWidth <= 767) return;
    if (window.scrollY > THRESHOLD) expand();
  };

  if (lenis) lenis.on('scroll', onScroll);
  else window.addEventListener('scroll', onScroll, { passive: true });

  // Trigger click: toggle open/close on desktop.
  if (trigger) {
    trigger.addEventListener('click', () => {
      if (window.innerWidth <= 767) return; // mobile handled by initMobileMenu
      expanded ? collapse() : expand();
    });
  }
  ────────────────────────────────────────────────────────────────────── */
}



//Nav active dot

function initNavActiveDot() {
  const links = document.querySelectorAll('.nav-link-wrapper .link');
  if (!links.length) return;
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  // /work and /work-list are one section — the nav link href may point at either
  const isWork = h => h === WORK_VIEWS.grid || h === WORK_VIEWS.list;
  links.forEach(link => {
    const href = (link.getAttribute('href') || '').replace(/\/$/, '');
    link.classList.toggle('is-active', href === path || (isWork(href) && isWork(path)));
  });
}



//Mobile menu

function initMobileMenu() {
  if (mobileMenuInitialized) return;

  const pill    = document.querySelector('.nav-pill');
  const trigger = document.querySelector('.mobile-menu-trigger');
  const links   = document.querySelector('.mobile-links-only');
  if (!pill || !trigger || !links) return;

  mobileMenuInitialized = true;

  let isOpen      = false;
  let isAnimating = false;

  function resetPillStyles() {
    pill.style.height = pill.style.overflow = pill.style.transition = pill.style.borderRadius = '';
  }

  function resetLinkStyles() {
    links.style.visibility = links.style.opacity = links.style.transition = '';
  }

  function openMenu() {
    if (isAnimating) return;
    isOpen = isAnimating = true;

    resetPillStyles();
    resetLinkStyles();
    pill.getBoundingClientRect();

    pill.style.height   = '54px';
    pill.style.overflow = 'hidden';
    pill.getBoundingClientRect();

    pill.style.transition = [
      'border-radius 0.25s cubic-bezier(0.76, 0, 0.24, 1)',
      'height 0.6s cubic-bezier(0.76, 0, 0.24, 1) 0.15s',
    ].join(', ');

    pill.classList.add('is-open');
    pill.style.height       = '321px';
    pill.style.borderRadius = '1.4rem';

    setTimeout(() => {
      links.style.visibility = 'visible';
      links.style.opacity    = '1';
      links.style.transition = 'opacity 0.25s ease';
    }, 380);

    pill.addEventListener('transitionend', function onOpen(e) {
      if (e.propertyName !== 'height') return;
      pill.removeEventListener('transitionend', onOpen);
      isAnimating = false;
    });

    if (lenis) lenis.stop();
  }

  function closeMenu() {
    if (isAnimating) return;
    isOpen      = false;
    isAnimating = true;

    links.style.transition = 'opacity 0.15s ease';
    links.style.opacity    = '0';

    setTimeout(() => {
      links.style.visibility = 'hidden';
      pill.style.height = '321px';
      pill.getBoundingClientRect();

      pill.style.transition = [
        'height 0.55s cubic-bezier(0.76, 0, 0.24, 1)',
        'border-radius 0.3s cubic-bezier(0.76, 0, 0.24, 1) 0.35s',
      ].join(', ');

      pill.style.height       = '54px';
      pill.style.borderRadius = '100vw';
      pill.classList.remove('is-open');

      pill.addEventListener('transitionend', function onClose(e) {
        if (e.propertyName !== 'height') return;
        pill.removeEventListener('transitionend', onClose);
        resetPillStyles();
        resetLinkStyles();
        isAnimating = false;
      });
    }, 150);

    if (lenis) lenis.start();
  }

  // Exposed so Barba beforeEnter can close the menu on page transitions.
  // Uses an instant snap (no animation) so the pill doesn't animate
  // while the transition overlay is fading out (the "blob" effect).
  window._closeMobileMenu = () => {
    if (!isOpen) return;
    isAnimating = false;
    isOpen      = false;
    pill.classList.remove('is-open');
    resetPillStyles();
    resetLinkStyles();
    if (lenis) lenis.start();
  };

  let lastTouch = 0;
  function toggleMenu(e) {
    if (window.innerWidth > 767) return; // desktop handled by initNavPill
    if (e.type === 'click' && Date.now() - lastTouch < 500) return; // touch already handled it
    if (e.type === 'touchend') { lastTouch = Date.now(); e.preventDefault(); }
    e.stopPropagation();
    isOpen ? closeMenu() : openMenu();
  }
  trigger.addEventListener('touchend', toggleMenu, { passive: false });
  trigger.addEventListener('click', toggleMenu);

  document.addEventListener('click', e => {
    if (isOpen && !e.target.closest('.nav-pill')) closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 767 && isOpen) closeMenu();
  }, { passive: true });
}



//Modal

let modalOpen = false;

function initModal() {
  const overlay  = document.querySelector('.overlay');
  const modal    = document.querySelector('.modal');
  const closeBtn = document.querySelector('.close');
  if (!overlay || !modal) return;

  gsap.set(overlay, { autoAlpha: 0, pointerEvents: 'none' });
  gsap.set(modal,   { y: 40, opacity: 0, scale: 0.97 });

  const openModal = () => {
    if (modalOpen) return;
    modalOpen = true;
    if (lenis) lenis.stop();
    document.body.style.overflow = 'hidden';
    gsap.set(overlay, { pointerEvents: 'auto' });
    gsap.timeline()
      .to(overlay, { autoAlpha: 1, duration: 0.45, ease: 'power2.out' })
      .to(modal,   { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'osmo' }, '<0.05');
  };

  const closeModal = () => {
    if (!modalOpen) return;
    gsap.timeline({
      onComplete: () => {
        modalOpen = false;
        gsap.set(overlay, { pointerEvents: 'none' });
        gsap.set(modal,   { y: 40, opacity: 0, scale: 0.97 });
        document.body.style.overflow = '';
        if (lenis) lenis.start();
      },
    })
      .to(modal,   { y: 20, opacity: 0, scale: 0.97, duration: 0.4, ease: 'power2.in' })
      .to(overlay, { autoAlpha: 0, duration: 0.3, ease: 'power2.in' }, '<0.05');
  };

  // Two #subscribe elements exist (main nav + mobile), so this is querySelectorAll
  document.querySelectorAll('[id="subscribe"]').forEach(btn => btn.addEventListener('click', openModal));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalOpen) closeModal(); });
}



//Accordion filter link

const ACCORDION_LINK_MAP = {
  'naming':       { slug: 'naming',   text: 'See our naming work' },
  'brand':        { slug: 'identity', text: 'See our brand identity work' },
  'websites':     { slug: 'websites', text: 'See our website work' },
  'brand-launch': { slug: 'launch',   text: 'See our brand launch work' },
};

function initAccordionFilterLink() {
  const accordionList = document.querySelector('.accordion-css__list');
  const linkEl        = document.getElementById('link-filter');
  const labelEl       = document.getElementById('update');
  if (!accordionList || !linkEl || !labelEl) return;

  function syncLink(dataId) {
    const config = ACCORDION_LINK_MAP[dataId];
    if (!config) return;
    // Respect the visitor's last-used view instead of forcing the grid
    let view = 'grid';
    try { view = localStorage.getItem(VIEW_PREF_KEY) || 'grid'; } catch (e) {}
    const base = WORK_VIEWS[view] || WORK_VIEWS.grid;
    linkEl.href         = `${base}?work=${config.slug}`;
    labelEl.textContent = config.text;
  }

  const initialActive = accordionList.querySelector('[data-accordion-status="active"]');
  if (initialActive) syncLink(initialActive.dataset.id);

  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (
        m.type === 'attributes' &&
        m.attributeName === 'data-accordion-status' &&
        m.target.dataset.accordionStatus === 'active'
      ) syncLink(m.target.dataset.id);
    });
  });

  accordionList.querySelectorAll('.accordion-css__item').forEach(item => {
    observer.observe(item, { attributes: true, attributeFilter: ['data-accordion-status'] });
  });
}



//Accordion

function initAccordion() {
  const accordions = document.querySelectorAll('[data-accordion-css-init]');
  if (!accordions.length) return;

  accordions.forEach(accordion => {
    const closeSiblings = accordion.hasAttribute('data-accordion-close-siblings');
    const items         = accordion.querySelectorAll('.accordion-css__item');

    items.forEach(item => {
      const toggle = item.querySelector('[data-accordion-toggle]');
      if (!toggle || toggle._accordionWired) return; // never bind the same toggle twice
      toggle._accordionWired = true;
      toggle.addEventListener('click', () => {
        const isActive = item.dataset.accordionStatus === 'active';
        if (closeSiblings) items.forEach(s => { s.dataset.accordionStatus = 'not-active'; });
        item.dataset.accordionStatus = isActive ? 'not-active' : 'active';
      });
    });
  });
}



//Slider

function initSlider() {
  const sliders = document.querySelectorAll('[data-gsap-slider-init]');
  if (!sliders.length) return;

  sliders.forEach(root => {
    if (root._sliderDraggable) {
      root._sliderDraggable.kill();
      root._sliderDraggable = null;
    }

    // Stop any autoplay left over from a previous init (Barba enter / resize),
    // otherwise each re-init leaks another setInterval and the loops stack up.
    root._sliderStopAuto?.();

    const collection = root.querySelector('[data-gsap-slider-collection]');
    const track      = root.querySelector('[data-gsap-slider-list]');
    const items      = Array.from(root.querySelectorAll('[data-gsap-slider-item]'));
    const controls   = Array.from(root.querySelectorAll('[data-gsap-slider-control]'));
    if (!collection || !track || !items.length) return;

    // ARIA
    root.setAttribute('role', 'region');
    root.setAttribute('aria-roledescription', 'carousel');
    root.setAttribute('aria-label', 'Slider');
    collection.setAttribute('role', 'group');
    collection.setAttribute('aria-roledescription', 'Slides List');
    collection.setAttribute('aria-label', 'Slides');
    items.forEach((slide, i) => {
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'Slide');
      slide.setAttribute('aria-label', `Slide ${i + 1} of ${items.length}`);
      slide.setAttribute('aria-hidden', 'true');
      slide.setAttribute('aria-selected', 'false');
      slide.setAttribute('tabindex', '-1');
    });
    controls.forEach(btn => {
      const dir = btn.getAttribute('data-gsap-slider-control');
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', dir === 'prev' ? 'Previous Slide' : 'Next Slide');
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
    });

    // Dimensions
    const styles      = getComputedStyle(root);
    const statusVar   = styles.getPropertyValue('--slider-status').trim();
    let   spvVar      = parseFloat(styles.getPropertyValue('--slider-spv'));
    const rect        = items[0].getBoundingClientRect();
    const marginRight = parseFloat(getComputedStyle(items[0]).marginRight);
    const slideW      = rect.width + marginRight;
    if (isNaN(spvVar)) spvVar = collection.clientWidth / slideW;

    const spv           = Math.max(1, Math.min(spvVar, items.length));
    const sliderEnabled = statusVar === 'on' && spv < items.length;
    root.setAttribute('data-gsap-slider-status', sliderEnabled ? 'active' : 'not-active');

    if (!sliderEnabled) {
      track.removeAttribute('style');
      track.onmouseenter = track.onmouseleave = null;
      track.removeAttribute('data-gsap-slider-list-status');
      ['role', 'aria-roledescription', 'aria-label'].forEach(a => {
        root.removeAttribute(a);
        collection.removeAttribute(a);
      });
      items.forEach(slide => {
        ['role','aria-roledescription','aria-label','aria-hidden',
         'aria-selected','tabindex','data-gsap-slider-item-status'].forEach(a => slide.removeAttribute(a));
      });
      controls.forEach(btn => {
        btn.disabled = false;
        ['role','aria-label','aria-disabled','data-gsap-slider-control-status'].forEach(a => btn.removeAttribute(a));
      });
      return;
    }

    track.onmouseenter = () => track.setAttribute('data-gsap-slider-list-status', 'grab');
    track.onmouseleave = () => track.removeAttribute('data-gsap-slider-list-status');

    const vw        = collection.clientWidth;
    const maxScroll = Math.max(track.scrollWidth - vw, 0);
    const minX      = -maxScroll;
    const maxX      = 0;
    const maxIndex  = maxScroll / slideW;
    const full      = Math.floor(maxIndex);
    const snapPoints = [];
    for (let i = 0; i <= full; i++) snapPoints.push(-i * slideW);
    if (full < maxIndex) snapPoints.push(-maxIndex * slideW);

    let activeIndex    = 0;
    const setX         = gsap.quickSetter(track, 'x', 'px');
    let collectionRect = collection.getBoundingClientRect();

    function updateStatus(x) {
      if (x > maxX || x < minX) return;
      const calcX = Math.max(minX, Math.min(maxX, x));
      let closest = snapPoints[0];
      snapPoints.forEach(pt => {
        if (Math.abs(pt - calcX) < Math.abs(closest - calcX)) closest = pt;
      });
      activeIndex = snapPoints.indexOf(closest);

      items.forEach((slide, i) => {
        const r           = slide.getBoundingClientRect();
        const leftEdge    = r.left - collectionRect.left;
        const slideCenter = leftEdge + r.width / 2;
        const inView      = slideCenter > 0 && slideCenter < collectionRect.width;
        const status      = i === activeIndex ? 'active' : inView ? 'inview' : 'not-active';
        slide.setAttribute('data-gsap-slider-item-status', status);
        slide.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
        slide.setAttribute('aria-hidden', inView ? 'false' : 'true');
        slide.setAttribute('tabindex', i === activeIndex ? '0' : '-1');
      });

      controls.forEach(btn => {
        const dir = btn.getAttribute('data-gsap-slider-control');
        const can = dir === 'prev' ? activeIndex > 0 : activeIndex < snapPoints.length - 1;
        btn.disabled = !can;
        btn.setAttribute('aria-disabled', can ? 'false' : 'true');
        btn.setAttribute('data-gsap-slider-control-status', can ? 'active' : 'not-active');
      });
    }

    controls.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const dir    = btn.getAttribute('data-gsap-slider-control');
        const target = activeIndex + (dir === 'next' ? 1 : -1);
        gsap.to(track, {
          duration: 0.4,
          x: snapPoints[target],
          onUpdate: () => updateStatus(gsap.getProperty(track, 'x')),
        });
      });
    });

    root._sliderDraggable = Draggable.create(track, {
      type: 'x',
      inertia: true,
      bounds: { minX, maxX },
      throwResistance: 2000,
      dragResistance: 0.05,
      maxDuration: 0.6,
      minDuration: 0.2,
      edgeResistance: 0.75,
      snap: { x: snapPoints, duration: 0.4 },
      onPress()        { track.setAttribute('data-gsap-slider-list-status', 'grabbing'); collectionRect = collection.getBoundingClientRect(); },
      onDrag()         { setX(this.x);    updateStatus(this.x);    },
      onThrowUpdate()  { setX(this.x);    updateStatus(this.x);    },
      onThrowComplete(){ setX(this.endX); updateStatus(this.endX); track.setAttribute('data-gsap-slider-list-status', 'grab'); },
      onRelease()      { setX(this.x);    updateStatus(this.x);    track.setAttribute('data-gsap-slider-list-status', 'grab'); },
    })[0];

    setX(0);
    updateStatus(0);

    //Autoplay — advances every 4s; any pointer contact stops it permanently
    let autoTimer = null;

    function autoAdvance() {
      const next    = activeIndex < snapPoints.length - 1 ? activeIndex + 1 : 0;
      const targetX = snapPoints[next];
      collectionRect = collection.getBoundingClientRect();
      gsap.killTweensOf(track);
      gsap.to(track, {
        duration: 0.9,
        ease: 'power2.inOut',
        x: targetX,
        onUpdate() {
          const x = gsap.getProperty(track, 'x');
          setX(x);
          updateStatus(x);
        },
        onComplete() {
          setX(targetX);
          updateStatus(targetX);
        },
      });
    }

    function startAuto() {
      if (autoTimer) return;
      autoTimer = setInterval(autoAdvance, 4000);
    }

    function stopAuto() {
      clearInterval(autoTimer);
      autoTimer = null;
    }

    root.addEventListener('pointerdown', () => stopAuto(), { once: true, passive: true });

    startAuto();
    root._sliderStopAuto = stopAuto;
  });

  // Resize handler — attached once, reinitialises all sliders on width change
  if (!window._sliderResizeAttached) {
    window._sliderResizeAttached = true;
    let lastWidth  = window.innerWidth;
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth !== lastWidth) {
          lastWidth = window.innerWidth;
          initSlider();
        }
      }, 200);
    }, { passive: true });
  }
}



//Mux videos

const MUX_VIDEOS = {
  'naming':       '3yDSbqafilcYGjuYIyX01iyu00CIWv1cNnyXT6dULY4yI',
  'brand':        'rsUy02cWWl01riBQVatHmxCwE014hwth7SN3EM1opMZ402w',
  'brand-launch': 'id9OpdoK91RnknAYujajRActAIg00XiOej6mABjUQaE00',
  'websites':     'MSc9sxO702zTdMuxAmZUz3I7vrBNw8wtt4G01LLYNevrk',
};

const muxPreloadCache = {};

function initMuxVideos() {
  if (customElements.get('mux-player')) {
    setupHomeMux();
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@mux/mux-player';
  script.addEventListener('load', setupHomeMux);
  document.head.appendChild(script);
}

function setupHomeMux() {
  preloadMuxVideos();
  swapMuxVideo(MUX_VIDEOS['naming']);
  const namingItem = document.querySelector('.accordion-css__item[data-id="naming"]');
  if (namingItem) namingItem.setAttribute('data-accordion-status', 'active');

  // Swap video whenever the active accordion item changes
  const accordionList = document.querySelector('.accordion-css__list');
  if (accordionList) {
    const videoObserver = new MutationObserver(mutations => {
      mutations.forEach(m => {
        if (
          m.type === 'attributes' &&
          m.attributeName === 'data-accordion-status' &&
          m.target.dataset.accordionStatus === 'active'
        ) {
          swapMuxVideo(MUX_VIDEOS[m.target.dataset.id]);
        }
      });
    });
    accordionList.querySelectorAll('.accordion-css__item').forEach(item => {
      videoObserver.observe(item, { attributes: true, attributeFilter: ['data-accordion-status'] });
    });
  }
}

function preloadMuxVideos() {
  Object.entries(MUX_VIDEOS).forEach(([id, playbackId]) => {
    if (muxPreloadCache[id]) return;
    const player = document.createElement('mux-player');
    player.setAttribute('playback-id', playbackId);
    player.setAttribute('stream-type', 'on-demand');
    player.setAttribute('preload', 'auto');
    player.setAttribute('muted', '');
    player.setAttribute('playsinline', '');
    player.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(player);
    muxPreloadCache[id] = player;
  });
}

function swapMuxVideo(playbackId) {
  const container = document.querySelector('.img-land');
  if (!container) return;
  const existing = container.querySelector('mux-player');
  if (existing) existing.remove();
  if (!playbackId) return;
  const player = document.createElement('mux-player');
  player.setAttribute('playback-id', playbackId);
  player.setAttribute('stream-type', 'on-demand');
  player.setAttribute('preload', 'auto');
  player.setAttribute('autoplay', '');
  player.setAttribute('muted', '');
  player.setAttribute('playsinline', '');
  player.setAttribute('loop', '');
  player.style.cssText = 'width:100%;height:100%;--controls:none;';
  container.appendChild(player);
}



//Case study gallery drag

function initGalleryScroll() {
  const wrap  = document.querySelector('.work-gallery-wrap');
  const track = document.querySelector('._w-gallery-list');
  if (!wrap || !track) return;

  if (track._galleryDraggable) {
    track._galleryDraggable.kill();
    track._galleryDraggable = null;
  }

  // Stop any autoplay left over from a previous init. initGalleryScroll runs
  // twice on case-study pages (on enter, then again from initGalleryVideo once
  // the video widens the track), so without this each call leaks an interval.
  track._galleryStopAuto?.();

  const items = Array.from(track.children);
  if (!items.length) return;

  const gap     = 16;
  const itemW   = items[0].offsetWidth + gap;
  const maxDrag = -(track.scrollWidth - wrap.offsetWidth);

  track._galleryDraggable = Draggable.create(track, {
    type: 'x',
    inertia: true,
    bounds: { minX: maxDrag, maxX: 0 },
    throwResistance: 2000,
    edgeResistance: 0.85,
    maxDuration: 0.6,
    snap: { x: value => Math.round(value / itemW) * itemW },
    onThrowComplete() {
      if (this.endX > -(itemW / 2)) {
        gsap.to(track, { x: 0, duration: 0.5, ease: 'power3.out' });
      }
    },
  })[0];

  //Autoplay — advances one image every 4s, loops at end; pointer contact stops it
  let autoTimer = null;

  function autoAdvance() {
    const current = gsap.getProperty(track, 'x');
    // Snap current to the nearest item, then step one forward.
    const index   = Math.round(current / itemW);
    let   nextX   = (index - 1) * itemW;
    if (nextX < maxDrag + 1) nextX = 0; // past the end → loop to start
    gsap.to(track, { x: nextX, duration: 0.7, ease: 'power2.inOut' });
  }

  function stopAuto() {
    clearInterval(autoTimer);
    autoTimer = null;
  }

  // Don't autoplay if everything already fits (nothing to scroll).
  if (maxDrag < 0) {
    autoTimer = setInterval(autoAdvance, 4000);
    track.addEventListener('pointerdown', stopAuto, { once: true, passive: true });
  }

  track._galleryStopAuto = stopAuto;
}



//Case study gallery video

function initGalleryVideo() {
  const list       = document.querySelector('._w-gallery-list');
  const playbackId = window.GALLERY_PLAYBACK_ID;
  window.GALLERY_PLAYBACK_ID = null;
  if (!list || !playbackId) return;

  // The inline page script may have already injected this — don't double up
  if (list.querySelector('mux-player')) return;

  const item = document.createElement('div');
  item.setAttribute('role', 'listitem');
  item.className = '_w-gallery-item w-dyn-item w-dyn-repeater-item';

  const playerWrap = document.createElement('div');
  playerWrap.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none;user-select:none;';

  const player = document.createElement('mux-player');
  player.setAttribute('playback-id', playbackId);
  player.setAttribute('stream-type', 'on-demand');
  player.setAttribute('autoplay', '');
  player.setAttribute('muted', '');
  player.setAttribute('playsinline', '');
  player.setAttribute('loop', '');
  player.style.cssText = 'width:100%;height:100%;display:block;--controls:none;';

  playerWrap.appendChild(player);
  item.appendChild(playerWrap);

  const existingItems = list.querySelectorAll('._w-gallery-item');
  if (existingItems.length >= 2) {
    existingItems[1].insertAdjacentElement('afterend', item);
  } else {
    list.appendChild(item);
  }

  // Pause when scrolled out of view to save bandwidth
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { if (typeof player.play  === 'function') player.play();  }
      else                  { if (typeof player.pause === 'function') player.pause(); }
    });
  }, { threshold: 0.25 });

  observer.observe(item);

  // Reinit gallery drag now that the track is wider
  initGalleryScroll();
}



//Showreel overlay

function initShowreel() {
  const overlay = document.querySelector('.showreel-overlay');
  if (!overlay) return;

  const videoWrap = overlay.querySelector('.showreel-overlay__video');
  const backdrop  = overlay.querySelector('.showreel-overlay__backdrop');
  if (!videoWrap || !backdrop) return;

  // Wire overlay controls once — they persist across Barba navigations
  if (!overlay._ready) {
    overlay._ready = true;

    overlay.querySelector('[data-ctrl="playpause"]')?.addEventListener('click', () => {
      if (!showreelPlayer) return;
      showreelPlayer.paused ? showreelPlayer.play() : showreelPlayer.pause();
    });

    overlay.querySelector('[data-ctrl="restart"]')?.addEventListener('click', () => {
      if (!showreelPlayer) return;
      showreelPlayer.currentTime = 0;
      showreelPlayer.play();
    });

    overlay.querySelector('[data-ctrl="close"]')?.addEventListener('click', closeShowreel);
    backdrop.addEventListener('click', closeShowreel);
  }

  // Re-wire triggers on every enter — they live inside the Barba container
  document.querySelectorAll('[data-mini-showreel-open]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const id  = trigger.getAttribute('data-mini-showreel-open');
      const src = document.querySelector(`[data-mini-showreel-player="${id}"]`);
      const pb  = src?.querySelector('mux-player')?.getAttribute('playback-id');
      if (pb) openShowreel(pb);
    });
  });
}

function openShowreel(playbackId) {
  const overlay   = document.querySelector('.showreel-overlay');
  const videoWrap = overlay?.querySelector('.showreel-overlay__video');
  if (!overlay || !videoWrap) return;

  videoWrap.innerHTML = '';
  showreelPlayer = document.createElement('mux-player');
  showreelPlayer.setAttribute('playback-id', playbackId);
  showreelPlayer.setAttribute('stream-type', 'on-demand');
  showreelPlayer.setAttribute('autoplay', '');
  showreelPlayer.setAttribute('playsinline', '');
  showreelPlayer.removeAttribute('muted'); // unmuted in the modal
  videoWrap.appendChild(showreelPlayer);

  overlay.classList.add('is-open');

  gsap.fromTo(overlay,   { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
  gsap.fromTo(videoWrap, { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'power3.out', delay: 0.05 });

  showreelPlayer.addEventListener('play',  () => overlay.classList.add('is-playing'));
  showreelPlayer.addEventListener('pause', () => overlay.classList.remove('is-playing'));

  document.addEventListener('keydown', onShowreelKeyDown);
}

function closeShowreel() {
  const overlay   = document.querySelector('.showreel-overlay');
  const videoWrap = overlay?.querySelector('.showreel-overlay__video');
  if (!overlay) return;

  gsap.to(overlay, {
    opacity: 0,
    duration: 0.3,
    ease: 'power2.in',
    onComplete: () => {
      overlay.classList.remove('is-open', 'is-playing');
      if (videoWrap) videoWrap.innerHTML = '';
      showreelPlayer = null;
    },
  });

  document.removeEventListener('keydown', onShowreelKeyDown);
}

function onShowreelKeyDown(e) {
  if (e.key === 'Escape') { closeShowreel(); return; }
  if (e.key === ' ') {
    e.preventDefault();
    if (!showreelPlayer) return;
    showreelPlayer.paused ? showreelPlayer.play() : showreelPlayer.pause();
  }
}



//Case study see-more

function initSeeMore() {
  const seeMoreEl = document.getElementById('see-more-section');
  const seeBtnEl  = document.getElementById('see-btn');
  if (!seeMoreEl && !seeBtnEl) return;

  const params   = new URLSearchParams(window.location.search);
  const category = params.get('category');
  if (category) sessionStorage.setItem('selectedCategory', category);

  const stored = sessionStorage.getItem('selectedCategory');

  function formatCategory(cat) {
    if (!cat || cat === 'all') return '';
    const axis  = resolveSlugAxis(cat);
    const label = axis === 'industry' ? INDUSTRY_SLUGS[cat]
                : axis === 'work'     ? WORK_SLUGS[cat]
                : null;
    if (label) return label.toLowerCase();
    return cat.split('-').map(w => w.charAt(0).toLowerCase() + w.slice(1)).join(' ');
  }

  if (seeMoreEl) {
    const label = formatCategory(stored);
    seeMoreEl.innerHTML = stored && stored !== 'all'
      ? `<div class="see-more-section"><h3 class="heading-3">See more ${label} projects</h3></div>`
      : `<div class="see-more-section"><h3 class="heading-3 is-big">See more projects</h3></div>`;
  }

  if (seeBtnEl) {
    // Send them to their preferred view, with a param FilterAPI actually reads.
    // (This link previously wrote ?filter= which nothing consumed.)
    let view = 'grid';
    try { view = localStorage.getItem(VIEW_PREF_KEY) || 'grid'; } catch (e) {}
    const base = WORK_VIEWS[view] || WORK_VIEWS.grid;

    const axis = stored && stored !== 'all' ? resolveSlugAxis(stored) : null;
    const href = axis ? `${base}?${axis}=${encodeURIComponent(stored)}` : base;

    seeBtnEl.innerHTML = `
      <a href="${href}" class="see-more-button">See more work
        <div class="arrow-size is-white" style="transform:translate3d(0px,3px,0px);transform-style:preserve-3d;">
          <svg width="auto" height="18" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.6211 2.30273H7.01562L5.06055 0.333984H15.9844V11.2578L14.0156 9.30273V3.69727L1.42383 16.3027L0.015625 14.8945L12.6211 2.30273Z" fill="currentColor"/>
          </svg>
        </div>
      </a>`;
  }
}



//Work list media preview (cursor-follow on hover devices, inline reveal on touch)

function initWorkListMedia() {
  const root = document.querySelector('.work-list-view');
  console.log('[workListMedia] init called, root found:', !!root);
  if (!root) return;
  if (root._workMediaInited) {
    console.log('[workListMedia] already inited on this root, skipping');
    return;
  }
  root._workMediaInited = true;

  const rows = Array.from(root.querySelectorAll('.work-item-list'));
  console.log('[workListMedia] rows found:', rows.length);
  if (!rows.length) return;

  const isTouch = window.matchMedia('(hover: none)').matches;
  console.log('[workListMedia] hover:none matches (touch branch)?', isTouch);

  if (isTouch) {
    // Touch/tablet — no cursor to follow, so reveal each row's image inline as it scrolls into view
    rows.forEach(row => {
      const wrap = row.querySelector('.flex-list');
      if (wrap) wrap.classList.add('is-touch-thumb');
    });

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        console.log('[workListMedia] touch row intersecting?', entry.isIntersecting, entry.target);
        entry.target.querySelector('.flex-list')?.classList.toggle('is-inview', entry.isIntersecting);
      });
    }, { threshold: 0.2 });

    rows.forEach(row => observer.observe(row));
    return;
  }

  console.log('[workListMedia] gsap available?', !!window.gsap);
  if (!window.gsap) return;

  // Built here, not in Webflow — lives on <body> so positioning is document-relative
  const mediaContainer = document.createElement('div');
  mediaContainer.className = 'work-media-container';
  document.body.appendChild(mediaContainer);
  console.log('[workListMedia] mediaContainer created and appended to body');

  gsap.set(mediaContainer, { yPercent: -50 });
  const yTo = gsap.quickTo(mediaContainer, 'y', { duration: 0.5, ease: 'power4' });

  let current = null;

  root.addEventListener('mouseenter', () => {
    console.log('[workListMedia] root mouseenter — adding .on');
    mediaContainer.classList.add('on');
  });
  root.addEventListener('mouseleave', () => {
    console.log('[workListMedia] root mouseleave — removing .on, clearing container');
    mediaContainer.classList.remove('on');
    mediaContainer.replaceChildren();
    current = null;
  });
  root.addEventListener('mousemove', e => yTo(e.clientY + window.scrollY));

  // Delegated — survives CMS filtering and re-renders
  root.addEventListener('mouseover', e => {
    const row = e.target.closest('.work-item-list');
    if (!row || row === current) return; // guard against child re-fires
    current = row;
    const img = row.querySelector('.work-img-list');
    console.log('[workListMedia] mouseover row, img found?', !!img, img?.currentSrc || img?.src);
    if (img) createMedia(img.currentSrc || img.src);
  });

  function createMedia(url) {
    console.log('[workListMedia] createMedia called with url:', url);
    const div   = document.createElement('div');
    const image = document.createElement('img');
    image.src = url;
    div.appendChild(image);
    mediaContainer.appendChild(div);
    gsap.to([div, image], { y: 0, duration: 0.6, ease: 'expo.inOut' });
    if (mediaContainer.children.length > 20) mediaContainer.children[0].remove();
  }
}



//Work filter

function initWorkFilter() {
  // Grid page uses .work-list, list page uses .work-list-view — support both
  const workLists = document.querySelectorAll('.work-list.w-dyn-items, .work-list-view.w-dyn-items');
  if (!workLists.length) return;

  // Active filter state — stores the full DOM label, not the slug
  const activeFilters = { industry: null, work: null };


  // URL
  function setURLParams() {
    const params = new URLSearchParams();
    if (activeFilters.industry) params.set('industry', industryToSlug(activeFilters.industry));
    if (activeFilters.work)     params.set('work',     workToSlug(activeFilters.work));
    const newURL = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.pushState({}, '', newURL);
  }


  // Reset helpers — clear state and depress all buttons for that axis
  function resetIndustry() {
    activeFilters.industry = null;
    document.querySelectorAll('[data-filter-industry-name]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  }

  function resetWork() {
    activeFilters.work = null;
    document.querySelectorAll('[data-filter-work-name]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  }

  function pressButtons(attr, name) {
    document.querySelectorAll(`[${attr}]`).forEach(b => {
      b.setAttribute('aria-pressed', normLabel(b.getAttribute(attr)) === normLabel(name) ? 'true' : 'false');
    });
  }


  // Dropdowns
  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown.is-open').forEach(d => d.classList.remove('is-open'));
  }

  document.querySelectorAll('[data-filter-dropdown]').forEach(wrap => {
    const trigger  = wrap.querySelector(':scope > .filter-name');
    const dropdown = wrap.querySelector('.dropdown');
    if (!trigger || !dropdown || trigger._dropdownWired) return;
    trigger._dropdownWired = true;
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('is-open');
      closeAllDropdowns();
      if (!isOpen) dropdown.classList.add('is-open');
    });
  });

  // Document-level listener would stack up on every Barba enter — wire it once
  if (!window._filterDocWired) {
    window._filterDocWired = true;
    document.addEventListener('click', e => {
      if (!e.target.closest('[data-filter-dropdown]')) closeAllDropdowns();
    });
  }


  // Matching — normalized, so dirty CMS whitespace can't break it
  function matches(item, attr, value) {
    if (!value) return true;
    return Array.from(item.querySelectorAll(`[${attr}]`))
      .some(el => normLabel(el.getAttribute(attr)) === normLabel(value));
  }

  // Page height changes when items hide — Lenis caches scroll length
  function refreshScroll() {
    if (lenis) lenis.resize();
    if (hasScrollTrigger) ScrollTrigger.refresh();
  }


  // Apply — sorts visible items to the front, hidden to the back
  function applyFilters({ animate = true } = {}) {
    workLists.forEach(workList => {
      const items   = Array.from(workList.querySelectorAll(':scope > .w-dyn-item'));
      const visible = [];
      const hidden  = [];

      items.forEach(item => {
        const ok = matches(item, 'data-filter-industry', activeFilters.industry)
                && matches(item, 'data-filter-work',     activeFilters.work);
        (ok ? visible : hidden).push(item);
      });

      // Instant apply — no animation, used when restoring from URL params on load
      if (!animate) {
        hidden.forEach(i => { i.style.opacity = '0'; i.style.display = 'none'; i.style.pointerEvents = 'none'; });
        visible.forEach(i => { i.style.display = ''; i.style.opacity = '1'; i.style.pointerEvents = ''; });
        [...visible, ...hidden].forEach(i => workList.appendChild(i));
        refreshScroll();
        return;
      }

      // Animated apply — fade out → reorder → fade in
      items.forEach(i => { i.style.opacity = '0'; i.style.pointerEvents = 'none'; });

      setTimeout(() => {
        hidden.forEach(i => { i.style.display = 'none'; });
        visible.forEach(i => { i.style.display = ''; });
        [...visible, ...hidden].forEach(i => workList.appendChild(i));
        workList.offsetHeight; // force reflow so CSS transition fires
        requestAnimationFrame(() => requestAnimationFrame(() => {
          visible.forEach(i => { i.style.opacity = '1'; i.style.pointerEvents = ''; });
          refreshScroll();
        }));
      }, 400);
    });
  }


  // Public API — accessible globally so external links and scripts can drive filters
  window.FilterAPI = {

    setIndustry(slug) {
      const name     = slugToIndustry(slug);
      const isToggle = normLabel(activeFilters.industry) === normLabel(name);
      resetWork();
      resetIndustry();
      if (!isToggle) {
        activeFilters.industry = name;
        pressButtons('data-filter-industry-name', name);
      }
      closeAllDropdowns();
      setURLParams();
      applyFilters();
    },

    setWork(slug) {
      const name     = slugToWork(slug);
      const isToggle = normLabel(activeFilters.work) === normLabel(name);
      resetIndustry();
      resetWork();
      if (!isToggle) {
        activeFilters.work = name;
        pressButtons('data-filter-work-name', name);
      }
      closeAllDropdowns();
      setURLParams();
      applyFilters();
    },

    clear() {
      resetIndustry();
      resetWork();
      setURLParams();
      applyFilters();
    },

    applyFromURL() {
      const params = new URLSearchParams(window.location.search);
      this.applyFromParams({
        industry: params.get('industry') || null,
        work:     params.get('work')     || null,
      });
    },

    applyFromParams({ industry = null, work = null } = {}) {
      const resolvedIndustry = industry ? slugToIndustry(industry) : null;
      const resolvedWork     = work     ? slugToWork(work)         : null;
      resetIndustry();
      resetWork();
      if (resolvedIndustry) {
        activeFilters.industry = resolvedIndustry;
        pressButtons('data-filter-industry-name', resolvedIndustry);
      }
      if (resolvedWork) {
        activeFilters.work = resolvedWork;
        pressButtons('data-filter-work-name', resolvedWork);
      }
      applyFilters({ animate: false });
    },

    // Read by initViewToggle so filters survive a grid ⇄ list switch
    currentParams() {
      const params = new URLSearchParams();
      if (activeFilters.industry) params.set('industry', industryToSlug(activeFilters.industry));
      if (activeFilters.work)     params.set('work',     workToSlug(activeFilters.work));
      return params.toString() ? `?${params.toString()}` : '';
    },

  };


  // Wire up filter buttons
  document.querySelectorAll('[data-filter-industry-name]').forEach(btn => {
    if (btn._filterWired) return;
    btn._filterWired = true;
    btn.addEventListener('click', () => window.FilterAPI.setIndustry(industryToSlug(btn.getAttribute('data-filter-industry-name'))));
  });

  document.querySelectorAll('[data-filter-work-name]').forEach(btn => {
    if (btn._filterWired) return;
    btn._filterWired = true;
    btn.addEventListener('click', () => window.FilterAPI.setWork(workToSlug(btn.getAttribute('data-filter-work-name'))));
  });


  // Restore filter state from URL on page load
  const initParams = new URLSearchParams(window.location.search);
  if (initParams.get('industry') || initParams.get('work')) {
    window.FilterAPI.applyFromURL();
  }
}



//Work view toggle (grid ⇄ list)

// DOM is the source of truth — pathname differs between prod and webflow.io
function getWorkView() {
  if (document.querySelector('.work-list-view')) return 'list';
  if (document.querySelector('.work-list'))      return 'grid';
  return null; // not a work page
}

function findToggle(view) {
  const explicit = document.querySelector(`[data-view="${view}"]`);
  if (explicit) return explicit;
  // Fallback: match by visible label. Add data-view="grid"/"list" in Webflow to kill this.
  const label = view === 'grid' ? 'grid view' : 'list view';
  return Array.from(document.querySelectorAll('.filter-wrap .filter-name'))
    .find(el => el.textContent.trim().toLowerCase() === label) || null;
}

function initViewToggle() {
  const current = getWorkView();
  if (!current) return;

  try { localStorage.setItem(VIEW_PREF_KEY, current); } catch (e) {}

  // Drop the hardcoded • — CSS redraws it from aria-current instead
  document.querySelectorAll('.filter-wrap .filter-name').forEach(el => {
    if (el.textContent.trim() === '•') el.remove();
  });

  Object.keys(WORK_VIEWS).forEach(view => {
    const toggle = findToggle(view);
    if (!toggle) return;

    const isActive = view === current;
    isActive
      ? toggle.setAttribute('aria-current', 'page')
      : toggle.removeAttribute('aria-current');

    // Carry active filters across the switch
    const search = window.FilterAPI?.currentParams?.() ?? window.location.search;
    const target = WORK_VIEWS[view] + search;

    if (toggle.tagName === 'A') {
      toggle.setAttribute('href', target); // Barba intercepts anchors itself
      if (toggle._viewWired) return;
      toggle._viewWired = true;
      toggle.addEventListener('click', () => {
        try { localStorage.setItem(VIEW_PREF_KEY, view); } catch (e) {}
      });
      return;
    }

    // Div fallback — manual nav + keyboard support
    if (toggle._viewWired) return;
    toggle._viewWired = true;
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('tabindex', '0');

    const go = () => {
      if (view === getWorkView()) return;
      const href = WORK_VIEWS[view] + (window.FilterAPI?.currentParams?.() ?? '');
      try { localStorage.setItem(VIEW_PREF_KEY, view); } catch (e) {}
      if (typeof barba !== 'undefined' && barba.go) barba.go(href);
      else window.location.href = href;
    };

    toggle.addEventListener('click', go);
    toggle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });
}

// Point the nav's Work link at whichever view they last used.
// Deliberately NOT a redirect on /work — shared links must stay predictable.
function syncWorkNavLinks() {
  let pref = null;
  try { pref = localStorage.getItem(VIEW_PREF_KEY); } catch (e) {}
  if (!pref || !WORK_VIEWS[pref]) return;
  document.querySelectorAll('nav a').forEach(a => {
    const href = (a.getAttribute('href') || '').replace(/\/$/, '');
    if (href === WORK_VIEWS.grid || href === WORK_VIEWS.list) {
      a.setAttribute('href', WORK_VIEWS[pref]);
    }
  });
}



//Theme video (#my-mux-player2)

const THEME_VIDEO_LIGHT = 'AC12wVkiNly6ze029rg22bWBaWbHNDD6WR624r33iqJg';
const THEME_VIDEO_DARK  = 'x0202bCEd3HvfiThbYDzwwcihd1ivsdbot1nRoJ2wtWt00';

function initThemeVideo() {
  const player = document.getElementById('my-mux-player2');
  if (!player) return;

  const isDark   = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const targetId = isDark ? THEME_VIDEO_DARK : THEME_VIDEO_LIGHT;
  if (player.getAttribute('playback-id') !== targetId) {
    player.setAttribute('playback-id', targetId);
  }

  // Wire the OS preference listener once — stays active across navigations
  if (!window._themeVideoWired) {
    window._themeVideoWired = true;
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      const p = document.getElementById('my-mux-player2');
      if (p) p.setAttribute('playback-id', e.matches ? THEME_VIDEO_DARK : THEME_VIDEO_LIGHT);
    });
  }
}



//People grid

function initPeopleGrid() {
  const grid = document.querySelector('.people-magic-grid');
  if (!grid) return;

  const items = Array.from(grid.querySelectorAll('.m-img-wrap'));
  if (!items.length) return;

  // Assign each item a random sequence slot — this is what makes
  // unrelated grid positions fire together rather than row by row
  const fireOrder = Array.from({ length: items.length }, (_, i) => i)
    .sort(() => Math.random() - 0.5);

  gsap.set(items, { autoAlpha: 0, scale: 0.88, y: 20, transformOrigin: 'center center' });

  const observer = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();

    items.forEach((item, i) => {
      gsap.to(item, {
        autoAlpha: 1,
        scale: 1,
        y: 0,
        duration: 0.7,
        delay: fireOrder[i] * 0.065,
        ease: 'expo.out',
      });
    });
  }, { threshold: 0.1 });

  observer.observe(grid);
}



//Team slider (centered, draggable, autoplay)

function initCenteredSliders() {
  // Only treat elements that actually CONTAIN slides as sliders.
  // This ignores the buttons container even if it still carries the
  // data-centered-slider="wrapper" attribute (the phantom "Slider #1").
  const sliderWrappers = gsap.utils
    .toArray('[data-centered-slider="wrapper"]')
    .filter(w => w.querySelector('[data-centered-slider="slide"]'));

  sliderWrappers.forEach((sliderWrapper, wrapperIndex) => {
    // Barba-safe: don't double-bind if this exact element was already set up
    if (sliderWrapper._sliderInit) return;
    sliderWrapper._sliderInit = true;

    const slides = gsap.utils.toArray(sliderWrapper.querySelectorAll('[data-centered-slider="slide"]'));

    // Buttons may live OUTSIDE the slide wrapper (separate Webflow block).
    // Look inside the wrapper first, then fall back to the document.
    const prevButton = sliderWrapper.querySelector('[data-centered-slider="prev-button"]')
      || document.querySelector('[data-centered-slider="prev-button"]');
    const nextButton = sliderWrapper.querySelector('[data-centered-slider="next-button"]')
      || document.querySelector('[data-centered-slider="next-button"]');

    let activeElement;
    let autoplay;

    const autoplayEnabled  = sliderWrapper.getAttribute('data-slider-autoplay') === 'true';
    const autoplayDuration = autoplayEnabled
      ? parseFloat(sliderWrapper.getAttribute('data-slider-autoplay-duration')) || 4
      : 0;

    slides.forEach((slide, i) => slide.setAttribute("id", `slide-${i}`));

    const loop = horizontalLoop(slides, {
      paused: true,
      draggable: true,
      center: true,
      paddingRight: 120,
      onChange: (element) => {
        if (activeElement) activeElement.classList.remove("active");
        element.classList.add("active");
        activeElement = element;
      }
    });

    const startIndex = Math.floor(slides.length / 2);
    loop.toIndex(startIndex, { duration: 0 });

    // -- Re-measure once images/fonts have settled --------------------------
    // The helper measures widths once on init. We re-measure after load and
    // after any late-loading image, then snap back to the active slide.
    let refreshTimer;
    function settleRefresh() {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        const keep = loop.current();
        loop.refresh(true);
        loop.toIndex(keep, { duration: 0 });
      }, 60);
    }

    if (document.readyState === "complete") settleRefresh();
    else window.addEventListener("load", settleRefresh, { once: true });

    sliderWrapper.querySelectorAll("img").forEach(img => {
      if (!img.complete) img.addEventListener("load", settleRefresh, { once: true });
    });

    // -- Autoplay ------------------------------------------------------------
    function startAutoplay() {
      if (autoplayDuration > 0 && !autoplay) {
        const tick = () => {
          loop.next({ ease: "osmo-ease", duration: 0.725 });
          autoplay = gsap.delayedCall(autoplayDuration, tick);
        };
        autoplay = gsap.delayedCall(autoplayDuration, tick);
      }
    }
    function stopAutoplay() {
      if (autoplay) { autoplay.kill(); autoplay = null; }
    }

    ScrollTrigger.create({
      trigger: sliderWrapper,
      start: "top bottom",
      end: "bottom top",
      onEnter: startAutoplay,
      onLeave: stopAutoplay,
      onEnterBack: startAutoplay,
      onLeaveBack: stopAutoplay
    });

    sliderWrapper.addEventListener("mouseenter", stopAutoplay);
    sliderWrapper.addEventListener("mouseleave", () => {
      if (ScrollTrigger.isInViewport(sliderWrapper)) startAutoplay();
    });

    // -- Navigation: click, buttons, keyboard --------------------------------
    slides.forEach((slide, i) => {
      slide.addEventListener("click", () => {
        loop.toIndex(i, { ease: "osmo-ease", duration: 0.725 });
      });
    });

    if (prevButton) {
      prevButton.addEventListener("click", () => {
        stopAutoplay();
        loop.previous({ ease: "osmo-ease", duration: 0.725 });
      });
    }
    if (nextButton) {
      nextButton.addEventListener("click", () => {
        stopAutoplay();
        loop.next({ ease: "osmo-ease", duration: 0.725 });
      });
    }

    // keyboard arrows -- only while this slider is in view
    document.addEventListener("keydown", (e) => {
      if (!ScrollTrigger.isInViewport(sliderWrapper)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        stopAutoplay();
        loop.next({ ease: "osmo-ease", duration: 0.725 });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stopAutoplay();
        loop.previous({ ease: "osmo-ease", duration: 0.725 });
      }
    });
  });
}

// Barba-compatible: initAfterEnterFunctions() calls initCenteredSliders()
// directly (see above), so no DOMContentLoaded/global-exposure shim is needed.

// --- GSAP Horizontal Loop Helper --------------------------------------------
function horizontalLoop(items, config) {
  let timeline;
  items = gsap.utils.toArray(items);
  config = config || {};

  gsap.context(() => {
    let onChange = config.onChange,
      lastIndex = 0,
      tl = gsap.timeline({
        repeat: config.repeat,
        onUpdate: onChange && function () {
          let i = tl.closestIndex();
          if (lastIndex !== i) { lastIndex = i; onChange(items[i], i); }
        },
        paused: config.paused,
        defaults: { ease: "none" },
        onReverseComplete: () => tl.totalTime(tl.rawTime() + tl.duration() * 100)
      }),
      length = items.length,
      startX = items[0].offsetLeft,
      times = [],
      widths = [],
      spaceBefore = [],
      xPercents = [],
      curIndex = 0,
      indexIsDirty = false,
      center = config.center,
      pixelsPerSecond = (config.speed || 1) * 100,
      snap = config.snap === false ? v => v : gsap.utils.snap(config.snap || 1),
      timeOffset = 0,
      container = center === true
        ? items[0].parentNode
        : gsap.utils.toArray(center)[0] || items[0].parentNode,
      totalWidth,

      getTotalWidth = () =>
        items[length - 1].offsetLeft +
        xPercents[length - 1] / 100 * widths[length - 1] -
        startX +
        spaceBefore[0] +
        items[length - 1].offsetWidth * gsap.getProperty(items[length - 1], "scaleX") +
        (parseFloat(config.paddingRight) || 0),

      populateWidths = () => {
        let b1 = container.getBoundingClientRect(), b2;
        items.forEach((el, i) => {
          widths[i] = parseFloat(gsap.getProperty(el, "width", "px"));
          xPercents[i] = snap(
            parseFloat(gsap.getProperty(el, "x", "px")) / widths[i] * 100 +
            gsap.getProperty(el, "xPercent")
          );
          b2 = el.getBoundingClientRect();
          spaceBefore[i] = b2.left - (i ? b1.right : b1.left);
          b1 = b2;
        });
        gsap.set(items, { xPercent: i => xPercents[i] });
        totalWidth = getTotalWidth();
        if (widths.some(w => !w)) {
          console.warn("[horizontalLoop] A slide measured 0px wide -- measured before images loaded. settleRefresh() should correct this.");
        }
      },

      timeWrap,

      populateOffsets = () => {
        timeOffset = center ? tl.duration() * (container.offsetWidth / 2) / totalWidth : 0;
        center && times.forEach((t, i) => {
          times[i] = timeWrap(
            tl.labels["label" + i] +
            tl.duration() * widths[i] / 2 / totalWidth -
            timeOffset
          );
        });
      },

      getClosest = (values, value, wrap) => {
        let i = values.length, closest = 1e10, index = 0, d;
        while (i--) {
          d = Math.abs(values[i] - value);
          if (d > wrap / 2) d = wrap - d;
          if (d < closest) { closest = d; index = i; }
        }
        return index;
      },

      populateTimeline = () => {
        let i, item, curX, distanceToStart, distanceToLoop;
        tl.clear();
        for (i = 0; i < length; i++) {
          item = items[i];
          curX = xPercents[i] / 100 * widths[i];
          distanceToStart = item.offsetLeft + curX - startX + spaceBefore[0];
          distanceToLoop = distanceToStart + widths[i] * gsap.getProperty(item, "scaleX");
          tl.to(item, {
            xPercent: snap((curX - distanceToLoop) / widths[i] * 100),
            duration: distanceToLoop / pixelsPerSecond
          }, 0)
            .fromTo(item, {
              xPercent: snap((curX - distanceToLoop + totalWidth) / widths[i] * 100)
            }, {
              xPercent: xPercents[i],
              duration: (curX - distanceToLoop + totalWidth - curX) / pixelsPerSecond,
              immediateRender: false
            }, distanceToLoop / pixelsPerSecond)
            .add("label" + i, distanceToStart / pixelsPerSecond);
          times[i] = distanceToStart / pixelsPerSecond;
        }
        timeWrap = gsap.utils.wrap(0, tl.duration());
      },

      refresh = (deep) => {
        let progress = tl.progress();
        tl.progress(0, true);
        populateWidths();
        deep && populateTimeline();
        populateOffsets();
        deep && tl.draggable
          ? tl.time(times[curIndex], true)
          : tl.progress(progress, true);
      },

      proxy;

    gsap.set(items, { x: 0 });
    populateWidths();
    populateTimeline();
    populateOffsets();

    window.addEventListener("resize", () => refresh(true));

    function toIndex(index, vars) {
      vars = vars || {};
      if (Math.abs(index - curIndex) > length / 2) index += index > curIndex ? -length : length;
      let newIndex = gsap.utils.wrap(0, length, index),
        time = times[newIndex];
      if (time > tl.time() !== index > curIndex && index !== curIndex) {
        time += tl.duration() * (index > curIndex ? 1 : -1);
      }
      if (time < 0 || time > tl.duration()) vars.modifiers = { time: timeWrap };
      curIndex = newIndex;
      vars.overwrite = true;
      gsap.killTweensOf(proxy);
      return vars.duration === 0 ? tl.time(timeWrap(time)) : tl.tweenTo(time, vars);
    }

    tl.toIndex = (index, vars) => toIndex(index, vars);
    tl.closestIndex = setCurrent => {
      let index = getClosest(times, tl.time(), tl.duration());
      if (setCurrent) { curIndex = index; indexIsDirty = false; }
      return index;
    };
    tl.current = () => (indexIsDirty ? tl.closestIndex(true) : curIndex);
    tl.next = vars => toIndex(tl.current() + 1, vars);
    tl.previous = vars => toIndex(tl.current() - 1, vars);
    tl.refresh = refresh;
    tl.times = times;
    tl.progress(1, true).progress(0, true);

    if (config.reversed) { tl.vars.onReverseComplete(); tl.reverse(); }

    if (config.draggable && typeof Draggable === "function") {
      proxy = document.createElement("div");
      let wrap = gsap.utils.wrap(0, 1),
        ratio, startProgress, draggable, lastSnap, initChangeX, wasPlaying,
        align = () => tl.progress(wrap(startProgress + (draggable.startX - draggable.x) * ratio)),
        syncIndex = () => tl.closestIndex(true);

      draggable = Draggable.create(proxy, {
        trigger: items[0].parentNode,
        type: "x",
        onPressInit() {
          let x = this.x;
          gsap.killTweensOf(tl);
          wasPlaying = !tl.paused();
          tl.pause();
          startProgress = tl.progress();
          refresh();
          ratio = 1 / totalWidth;
          initChangeX = (startProgress / -ratio) - x;
          gsap.set(proxy, { x: startProgress / -ratio });
        },
        onDrag: align,
        onThrowUpdate: align,
        overshootTolerance: 0,
        inertia: true,
        snap(value) {
          if (Math.abs(startProgress / -ratio - this.x) < 10) return lastSnap + initChangeX;
          let time = -(value * ratio) * tl.duration(),
            wrappedTime = timeWrap(time),
            snapTime = times[getClosest(times, wrappedTime, tl.duration())],
            dif = snapTime - wrappedTime;
          if (Math.abs(dif) > tl.duration() / 2) dif += dif < 0 ? tl.duration() : -tl.duration();
          lastSnap = (time + dif) / tl.duration() / -ratio;
          return lastSnap;
        },
        onRelease() { syncIndex(); draggable.isThrowing && (indexIsDirty = true); },
        onThrowComplete: () => { syncIndex(); wasPlaying && tl.play(); }
      })[0];

      tl.draggable = draggable;
    }

    tl.closestIndex(true);
    lastIndex = curIndex;
    onChange && onChange(items[curIndex], curIndex);
    timeline = tl;
  });

  return timeline;
}
