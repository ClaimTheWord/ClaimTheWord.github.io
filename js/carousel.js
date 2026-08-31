/**
 * CLAIM THE WORD — js/carousel.js
 *
 * Set-it-and-forget-it merch carousel.
 * Reads from products.json, builds DOM, handles all interaction.
 *
 * To add a product: edit products.json only. No JS or HTML changes needed.
 *
 * Works on: index.html, resources.html, any page that includes
 *   <link rel="stylesheet" href="css/carousel.css" />
 *   <script src="js/carousel.js"></script>
 *   and has <div id="merch-carousel-mount"></div> at the desired insertion point.
 *
 * Interaction model:
 *   - Prev/Next buttons
 *   - Dot indicators (click to jump)
 *   - Keyboard: left/right arrow keys when carousel is focused
 *   - Touch: swipe left/right
 *   - Each card + image + title + description = full link to Spreadshirt product in new tab
 */

(function () {
  'use strict';

  /* ── CONFIG ────────────────────────────────────────────────── */
  const CONFIG = {
    dataPath:     'products.json',   // relative to page — works from any depth if adjusted
    mountId:      'merch-carousel-mount',
    visibleCards: null,              // null = auto-detect from CSS card width
    gap:          null,              // null = read from computed style
    autoplay:     true,             // set true to enable; pauses on hover/focus
    autoplayMs:   4800,
    shopUrl:      'https://claimtheword.myspreadshop.com/',
    shopLabel:    'Shop all items at claimtheword.myspreadshop.com →',
  };

  /* ── STATE ─────────────────────────────────────────────────── */
  let products   = [];
  let current    = 0;    // index of leftmost visible card
  let cardWidth  = 0;
  let gapWidth   = 0;
  let visible    = 3;    // cards visible at once
  let autoTimer  = null;

  /* ── DOM REFS ──────────────────────────────────────────────── */
  let mount, section, track, prevBtn, nextBtn, dotsWrap;

  /* ── BOOT ──────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    mount = document.getElementById(CONFIG.mountId);
    if (!mount) return; // page doesn't have the carousel mount point — bail silently

    fetchProducts();
  }

  /* ── DATA ──────────────────────────────────────────────────── */
  function fetchProducts() {
    fetch(CONFIG.dataPath)
      .then(function (res) {
        if (!res.ok) throw new Error('products.json not found (' + res.status + ')');
        return res.json();
      })
      .then(function (data) {
        products = Array.isArray(data) ? data : [];
        buildCarousel();
      })
      .catch(function (err) {
        console.warn('[carousel.js] Could not load products.json:', err.message);
        buildCarousel(); // build empty state
      });
  }

  /* ── BUILD ─────────────────────────────────────────────────── */
  function buildCarousel() {
    /* Section wrapper */
    section = el('section', { id: 'merch-carousel-section', 'aria-label': 'Merch & souvenirs' });

    /* Header */
    const header = el('div', { id: 'merch-carousel-header' });
    header.appendChild(el('p',  { id: 'merch-carousel-eyebrow' }, 'Claim The Word'));
    header.appendChild(el('h2', { id: 'merch-carousel-title'   }, 'Souvenirs'));
    header.appendChild(el('p',  { id: 'merch-carousel-subtitle'}, 'Wearable ministry — available on Spreadshirt'));
    section.appendChild(header);

    /* Viewport (masks track overflow) */
    const viewport = el('div', { id: 'merch-carousel-viewport' });

    /* Prev button */
    prevBtn = el('button', {
      id:           'merch-carousel-prev',
      class:        'merch-carousel-btn',
      'aria-label': 'Previous item',
      type:         'button',
    });
    prevBtn.innerHTML = svgChevron('left');
    prevBtn.addEventListener('click', goPrev);
    viewport.appendChild(prevBtn);

    /* Track */
    track = el('div', { id: 'merch-carousel-track', role: 'list' });

    if (products.length === 0) {
      /* Empty state */
      const empty = el('p', { id: 'merch-carousel-empty' },
        'New items coming soon — check back after the next release.');
      empty.style.display = 'block';
      track.appendChild(empty);
    } else {
      products.forEach(function (product, i) {
        track.appendChild(buildCard(product, i));
      });
    }

    viewport.appendChild(track);

    /* Next button */
    nextBtn = el('button', {
      id:           'merch-carousel-next',
      class:        'merch-carousel-btn',
      'aria-label': 'Next item',
      type:         'button',
    });
    nextBtn.innerHTML = svgChevron('right');
    nextBtn.addEventListener('click', goNext);
    viewport.appendChild(nextBtn);

    section.appendChild(viewport);

    /* Dot indicators */
    dotsWrap = el('div', { id: 'merch-carousel-dots', role: 'tablist', 'aria-label': 'Go to item' });
    section.appendChild(dotsWrap);

    /* Shop link */
    const shopLinkWrap = el('div', { id: 'merch-carousel-shop-link' });
    const shopA = el('a', {
      href:   CONFIG.shopUrl,
      target: '_blank',
      rel:    'noopener noreferrer',
    }, CONFIG.shopLabel);
    shopLinkWrap.appendChild(shopA);
    section.appendChild(shopLinkWrap);

    /* Mount into page */
    mount.appendChild(section);

    /* Measure, build dots, go to start */
    if (products.length > 0) {
      requestAnimationFrame(function () {
        measure();
        buildDots();
        goTo(0, false);
        bindKeyboard();
        bindTouch();
        bindResize();
        if (CONFIG.autoplay) startAutoplay();
      });
    }
  }

  /* ── BUILD CARD ────────────────────────────────────────────── */
  function buildCard(product, index) {
    /*
      Visual hierarchy order in DOM (left→right reads as top→bottom in card):
        image  → title → price → description → [SKU stamp, lower-left of image]

      Full card is wrapped in an <article> with a transparent overlay <a>
      so the whole card is one keyboard-focusable, screen-reader-announced link.
    */
    const card = el('article', {
      class:        'merch-card',
      role:         'listitem',
      'aria-label': product.title + ', ' + product.price,
    });

    /* Image block */
    const imgWrap = el('div', { class: 'merch-card-image-wrap' });

    const img = el('img', {
      src:     product.img,
      alt:     product.alt || product.title,
      loading: index < 3 ? 'eager' : 'lazy',
    });
    /* Graceful fallback if image 404s */
    img.addEventListener('error', function () {
      imgWrap.style.background = 'rgba(141,95,211,0.18)';
      img.style.display = 'none';
    });
    imgWrap.appendChild(img);

    /* SKU stamp — lower-left of image, boomerang terminus */
    const sku = el('div', {
      class:       'merch-card-sku',
      'data-id':   product.id   || '',
      'aria-hidden': 'true',
    }, product.sku || '');
    imgWrap.appendChild(sku);

    card.appendChild(imgWrap);

    /* Card body: title → price → description */
    const body = el('div', { class: 'merch-card-body' });

    body.appendChild(el('h3', { class: 'merch-card-title' }, product.title));
    body.appendChild(el('p',  { class: 'merch-card-price' }, product.price));
    body.appendChild(el('p',  { class: 'merch-card-description' }, product.description));

    card.appendChild(body);

    /* Full-card link overlay — entire card clickable, opens Spreadshirt in new tab */
    const overlay = el('a', {
      href:   product.url,
      target: '_blank',
      rel:    'noopener noreferrer',
      class:  'merch-card-link-overlay',
      'aria-label': product.title + ' — ' + product.price + ' — open in Spreadshirt',
    });
    card.appendChild(overlay);

    return card;
  }

  /* ── MEASURE ───────────────────────────────────────────────── */
  /* Called after first paint to read real CSS values */
  function measure() {
    const cards = track.querySelectorAll('.merch-card');
    if (cards.length === 0) return;

    const firstCard = cards[0];
    cardWidth = firstCard.getBoundingClientRect().width;

    /* Gap: difference between two adjacent card left edges minus one card width */
    if (cards.length > 1) {
      const r0 = cards[0].getBoundingClientRect();
      const r1 = cards[1].getBoundingClientRect();
      gapWidth = r1.left - r0.right;
      if (gapWidth < 0) gapWidth = 0;
    } else {
      gapWidth = 0;
    }

    const viewportWidth = track.parentElement.getBoundingClientRect().width;
    /* Subtract prev/next button widths (approx) */
    const usableWidth = viewportWidth - 88;
    visible = Math.max(1, Math.floor((usableWidth + gapWidth) / (cardWidth + gapWidth)));
  }

  /* ── DOTS ───────────────────────────────────────────────────── */
  function buildDots() {
    dotsWrap.innerHTML = '';
    const count = Math.max(0, products.length - visible + 1);
    for (let i = 0; i < count; i++) {
      const dot = el('button', {
        class:        'merch-dot' + (i === 0 ? ' active' : ''),
        type:         'button',
        role:         'tab',
        'aria-label': 'Go to item ' + (i + 1),
        'aria-selected': i === 0 ? 'true' : 'false',
      });
      (function (idx) {
        dot.addEventListener('click', function () { goTo(idx); });
      }(i));
      dotsWrap.appendChild(dot);
    }
  }

  /* ── NAVIGATION ─────────────────────────────────────────────── */
  function goTo(index, animate) {
    if (typeof animate === 'undefined') animate = true;
    const maxIndex = Math.max(0, products.length - visible);
    current = Math.max(0, Math.min(index, maxIndex));

    const offset = current * (cardWidth + gapWidth);

    if (!animate) {
      track.style.transition = 'none';
    } else {
      track.style.transition = '';
    }
    track.style.transform = 'translateX(-' + offset + 'px)';

    /* Restore transition after instant jump */
    if (!animate) {
      requestAnimationFrame(function () {
        track.style.transition = '';
      });
    }

    updateDots();
    updateButtons();
  }

  function goPrev() {
    goTo(current - 1);
    if (CONFIG.autoplay) resetAutoplay();
  }

  function goNext() {
    goTo(current + 1);
    if (CONFIG.autoplay) resetAutoplay();
  }

  function updateDots() {
    const dots = dotsWrap.querySelectorAll('.merch-dot');
    dots.forEach(function (dot, i) {
      const isActive = i === current;
      dot.classList.toggle('active', isActive);
      dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  function updateButtons() {
    const maxIndex = Math.max(0, products.length - visible);
    prevBtn.disabled = current <= 0;
    nextBtn.disabled = current >= maxIndex;
    prevBtn.setAttribute('aria-disabled', current <= 0 ? 'true' : 'false');
    nextBtn.setAttribute('aria-disabled', current >= maxIndex ? 'true' : 'false');
  }

  /* ── KEYBOARD ───────────────────────────────────────────────── */
  function bindKeyboard() {
    section.setAttribute('tabindex', '-1'); /* make focusable for key events */
    section.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    });
  }

  /* ── TOUCH SWIPE ────────────────────────────────────────────── */
  function bindTouch() {
    let startX = 0;
    let isDragging = false;

    track.addEventListener('touchstart', function (e) {
      startX    = e.touches[0].clientX;
      isDragging = true;
    }, { passive: true });

    track.addEventListener('touchend', function (e) {
      if (!isDragging) return;
      isDragging = false;
      const delta = e.changedTouches[0].clientX - startX;
      if (Math.abs(delta) > 40) {
        delta < 0 ? goNext() : goPrev();
      }
    }, { passive: true });

    track.addEventListener('touchcancel', function () {
      isDragging = false;
    }, { passive: true });
  }

  /* ── RESIZE ─────────────────────────────────────────────────── */
  function bindResize() {
    let resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        measure();
        buildDots();
        /* Clamp current to new maxIndex */
        goTo(current, false);
      }, 160);
    });
  }

  /* ── AUTOPLAY ───────────────────────────────────────────────── */
  function startAutoplay() {
        autoTimer = setInterval(function () {
      const maxIndex = Math.max(0, products.length - visible);
      if (current >= maxIndex) {
        current = -1;
        goTo(0);
      } else {
        goNext();
      }
    }, CONFIG.autoplayMs);

    /* Pause on hover or focus within */
    section.addEventListener('mouseenter', pauseAutoplay);
    section.addEventListener('focusin',    pauseAutoplay);
    section.addEventListener('mouseleave', resumeAutoplay);
    section.addEventListener('focusout',   resumeAutoplay);
  }

  function pauseAutoplay()  { clearInterval(autoTimer); }
  function resumeAutoplay() { startAutoplay(); }
  function resetAutoplay()  { pauseAutoplay(); resumeAutoplay(); }

  /* ── HELPERS ────────────────────────────────────────────────── */

  /* Create an element with attributes and optional text content */
  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'class') {
          node.className = attrs[key];
        } else {
          node.setAttribute(key, attrs[key]);
        }
      });
    }
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  /* Inline SVG chevrons for prev/next buttons */
  function svgChevron(dir) {
    const d = dir === 'left'
      ? 'M8 2 L2 8 L8 14'
      : 'M2 2 L8 8 L2 14';
    return '<svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">'
      + '<path d="' + d + '" stroke="currentColor" stroke-width="2" fill="none"'
      + ' stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

}());
