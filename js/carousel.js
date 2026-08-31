/**
 * CLAIM THE WORD — js/carousel.js
 *
 * Set-it-and-forget-it merch carousel.
 * Reads from products.json, builds DOM, handles all interaction.
 *
 * To add a product: edit products.json only. No JS or HTML changes needed.
 * Supports any number of items. Infinite loop — no rewind.
 */

(function () {
  'use strict';

  /* ── CONFIG ────────────────────────────────────────────────── */
  const CONFIG = {
    dataPath:   'products.json',
    mountId:    'merch-carousel-mount',
    autoplay:   true,
    autoplayMs: 4800,
    shopUrl:    'https://claimtheword.myspreadshop.com/',
    shopLabel:  'Shop all items at claimtheword.myspreadshop.com →',
  };

  /* ── STATE ─────────────────────────────────────────────────── */
  let products  = [];
  let current   = 0;      // logical index into products[] (0-based)
  let cardW     = 0;      // card width px — measured once after paint
  let gapW      = 0;      // gap width px  — measured once after paint
  let visible   = 3;      // cards visible at once — measured once after paint
  let cloneHead = 0;      // how many clones prepended (= visible)
  let isTransitioning = false;
  let autoTimer = null;

  /* ── DOM REFS ──────────────────────────────────────────────── */
  let mount, section, track, prevBtn, nextBtn, dotsWrap;

  /* ── BOOT ──────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    mount = document.getElementById(CONFIG.mountId);
    if (!mount) return;
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
        console.warn('[carousel.js]', err.message);
        buildCarousel();
      });
  }

  /* ── BUILD ─────────────────────────────────────────────────── */
  function buildCarousel() {
    section = el('section', { id: 'merch-carousel-section', 'aria-label': 'Merch & souvenirs' });

    /* Header */
    const header = el('div', { id: 'merch-carousel-header' });
    header.appendChild(el('p',  { id: 'merch-carousel-eyebrow' }, 'Claim The Word'));
    header.appendChild(el('h2', { id: 'merch-carousel-title'   }, 'Souvenirs'));
    header.appendChild(el('p',  { id: 'merch-carousel-subtitle'}, 'Wearable ministry — available on Spreadshirt'));
    section.appendChild(header);

    /* Viewport */
    const viewport = el('div', { id: 'merch-carousel-viewport' });

    /* Prev button */
    prevBtn = el('button', {
      id: 'merch-carousel-prev', class: 'merch-carousel-btn',
      'aria-label': 'Previous item', type: 'button',
    });
    prevBtn.innerHTML = svgChevron('left');
    prevBtn.addEventListener('click', goPrev);
    viewport.appendChild(prevBtn);

    /* Track */
    track = el('div', { id: 'merch-carousel-track', role: 'list' });

    if (products.length === 0) {
      const empty = el('p', { id: 'merch-carousel-empty' },
        'New items coming soon — check back after the next release.');
      empty.style.display = 'block';
      track.appendChild(empty);
    } else {
      products.forEach(function (p, i) {
        track.appendChild(buildCard(p, i));
      });
    }

    viewport.appendChild(track);

    /* Next button */
    nextBtn = el('button', {
      id: 'merch-carousel-next', class: 'merch-carousel-btn',
      'aria-label': 'Next item', type: 'button',
    });
    nextBtn.innerHTML = svgChevron('right');
    nextBtn.addEventListener('click', goNext);
    viewport.appendChild(nextBtn);

    section.appendChild(viewport);

    /* Dots */
    dotsWrap = el('div', { id: 'merch-carousel-dots', role: 'tablist', 'aria-label': 'Go to item' });
    section.appendChild(dotsWrap);

    /* Shop link */
    const shopWrap = el('div', { id: 'merch-carousel-shop-link' });
    shopWrap.appendChild(el('a', {
      href: CONFIG.shopUrl, target: '_blank', rel: 'noopener noreferrer',
    }, CONFIG.shopLabel));
    section.appendChild(shopWrap);

    mount.appendChild(section);

    if (products.length > 0) {
      /* Double rAF — guarantees layout is fully settled before measuring */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          measure();
          injectClones();
          buildDots();
          setPosition(current, false);
          updateButtons();
          bindKeyboard();
          bindTouch();
          bindResize();
          if (CONFIG.autoplay) startAutoplay();
        });
      });
    }
  }

  /* ── BUILD CARD ────────────────────────────────────────────── */
  function buildCard(product, index) {
    const card = el('article', {
      class: 'merch-card', role: 'listitem',
      'aria-label': product.title + ', ' + product.price,
    });

    const imgWrap = el('div', { class: 'merch-card-image-wrap' });
    const img = el('img', {
      src:     product.img,
      alt:     product.alt || product.title,
      loading: index < 3 ? 'eager' : 'lazy',
    });
    img.addEventListener('error', function () {
      imgWrap.style.background = 'rgba(141,95,211,0.18)';
      img.style.display = 'none';
    });
    imgWrap.appendChild(img);

    /* SKU stamp — lower-left of image, boomerang terminus */
    const sku = el('div', {
      class:         'merch-card-sku',
      'data-id':     product.id || '',
      'aria-hidden': 'true',
    }, product.sku || '');
    imgWrap.appendChild(sku);
    card.appendChild(imgWrap);

    const body = el('div', { class: 'merch-card-body' });
    body.appendChild(el('h3', { class: 'merch-card-title'       }, product.title));
    body.appendChild(el('p',  { class: 'merch-card-price'       }, product.price));
    body.appendChild(el('p',  { class: 'merch-card-description' }, product.description));
    card.appendChild(body);

    const overlay = el('a', {
      href:         product.url,
      target:       '_blank',
      rel:          'noopener noreferrer',
      class:        'merch-card-link-overlay',
      'aria-label': product.title + ' — ' + product.price + ' — open in Spreadshirt',
    });
    card.appendChild(overlay);

    return card;
  }

  /* ── MEASURE — called once after first paint ───────────────── */
  function measure() {
    const cards = track.querySelectorAll('.merch-card');
    if (cards.length === 0) return;

    cardW = cards[0].getBoundingClientRect().width;

    if (cards.length > 1) {
      const r0 = cards[0].getBoundingClientRect();
      const r1 = cards[1].getBoundingClientRect();
      gapW = Math.max(0, r1.left - r0.right);
    } else {
      gapW = 0;
    }

    const usableWidth = track.parentElement.getBoundingClientRect().width - 88;
    visible = Math.max(1, Math.floor((usableWidth + gapW) / (cardW + gapW)));
  }

  /* ── CLONES — infinite loop technique ─────────────────────── */
  /*
    Track layout after injectClones():
      [tail clones: last N real cards] [real cards 0..n-1] [head clones: first N real cards]

    current is always a logical index (0 to products.length-1).
    trackIndex = current + cloneHead maps it into the full track.

    When transitionend fires and current is out of real range,
    we silently snap to the real equivalent — invisible to the user.
  */
  function injectClones() {
    const realCards = Array.from(track.querySelectorAll('.merch-card:not(.merch-card-clone)'));
    const n = realCards.length;
    if (n === 0) return;

    cloneHead = Math.min(visible, n);

    /* Tail clones — prepend (last cloneHead real cards, in order) */
    const tailFragment = document.createDocumentFragment();
    for (let i = n - cloneHead; i < n; i++) {
      const clone = realCards[i].cloneNode(true);
      clone.classList.add('merch-card-clone');
      clone.setAttribute('aria-hidden', 'true');
      tailFragment.appendChild(clone);
    }
    track.insertBefore(tailFragment, track.firstChild);

    /* Head clones — append (first cloneHead real cards, in order) */
    for (let i = 0; i < cloneHead; i++) {
      const clone = realCards[i].cloneNode(true);
      clone.classList.add('merch-card-clone');
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    }
  }

  /* ── SET POSITION — pure transform, no state side-effects ──── */
  function setPosition(logicalIndex, animate) {
    const trackIndex = logicalIndex + cloneHead;
    const offset = trackIndex * (cardW + gapW);

    track.style.transition = animate ? '' : 'none';
    track.style.transform  = 'translateX(-' + offset + 'px)';

    if (!animate) {
      requestAnimationFrame(function () {
        track.style.transition = '';
      });
    }
  }

  /* ── NAVIGATION ─────────────────────────────────────────────── */
  function goTo(logicalIndex) {
    if (isTransitioning) return;
    isTransitioning = true;

    current = logicalIndex;
    setPosition(current, true);
    updateDots();
    updateButtons();

    track.addEventListener('transitionend', onTransitionEnd, { once: true });
  }

  function onTransitionEnd() {
    isTransitioning = false;
    const n = products.length;

    /* Landed in head clone zone — snap back to real start */
    if (current >= n) {
      current = current - n;
      setPosition(current, false);
    }

    /* Landed in tail clone zone — snap forward to real end */
    if (current < 0) {
      current = current + n;
      setPosition(current, false);
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

  /* ── DOTS ───────────────────────────────────────────────────── */
  function buildDots() {
    dotsWrap.innerHTML = '';
    products.forEach(function (_, i) {
      const dot = el('button', {
        class:           'merch-dot' + (i === 0 ? ' active' : ''),
        type:            'button',
        role:            'tab',
        'aria-label':    'Go to item ' + (i + 1),
        'aria-selected': i === 0 ? 'true' : 'false',
      });
      (function (idx) {
        dot.addEventListener('click', function () { goTo(idx); });
      }(i));
      dotsWrap.appendChild(dot);
    });
  }

  function updateDots() {
    const dots  = dotsWrap.querySelectorAll('.merch-dot');
    const n     = products.length;
    /* Wrap into 0..n-1 regardless of over/underflow during clone traversal */
    const active = ((current % n) + n) % n;
    dots.forEach(function (dot, i) {
      const on = i === active;
      dot.classList.toggle('active', on);
      dot.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  /* Infinite loop — both buttons always enabled */
  function updateButtons() {
    prevBtn.disabled = false;
    nextBtn.disabled = false;
    prevBtn.setAttribute('aria-disabled', 'false');
    nextBtn.setAttribute('aria-disabled', 'false');
  }

  /* ── KEYBOARD ───────────────────────────────────────────────── */
  function bindKeyboard() {
    section.setAttribute('tabindex', '-1');
    section.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    });
  }

  /* ── TOUCH SWIPE ────────────────────────────────────────────── */
  function bindTouch() {
    let startX   = 0;
    let dragging = false;

    track.addEventListener('touchstart', function (e) {
      startX   = e.touches[0].clientX;
      dragging = true;
    }, { passive: true });

    track.addEventListener('touchend', function (e) {
      if (!dragging) return;
      dragging = false;
      const delta = e.changedTouches[0].clientX - startX;
      if (Math.abs(delta) > 40) {
        delta < 0 ? goNext() : goPrev();
      }
    }, { passive: true });

    track.addEventListener('touchcancel', function () {
      dragging = false;
    }, { passive: true });
  }

  /* ── RESIZE ─────────────────────────────────────────────────── */
  function bindResize() {
    let timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        /* Remove clones, re-measure, rebuild cleanly */
        Array.from(track.querySelectorAll('.merch-card-clone'))
          .forEach(function (c) { c.parentNode.removeChild(c); });
        measure();
        injectClones();
        buildDots();
        /* Clamp current to valid range after reflow */
        current = Math.max(0, Math.min(current, products.length - 1));
        setPosition(current, false);
        updateDots();
        updateButtons();
      }, 200);
    });
  }

  /* ── AUTOPLAY ───────────────────────────────────────────────── */
  function startAutoplay() {
    autoTimer = setInterval(goNext, CONFIG.autoplayMs);
    section.addEventListener('mouseenter', pauseAutoplay);
    section.addEventListener('focusin',    pauseAutoplay);
    section.addEventListener('mouseleave', resumeAutoplay);
    section.addEventListener('focusout',   resumeAutoplay);
  }

  function pauseAutoplay()  { clearInterval(autoTimer); }
  function resumeAutoplay() { autoTimer = setInterval(goNext, CONFIG.autoplayMs); }
  function resetAutoplay()  { pauseAutoplay(); resumeAutoplay(); }

  /* ── HELPERS ────────────────────────────────────────────────── */
  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'class') { node.className = attrs[key]; }
        else { node.setAttribute(key, attrs[key]); }
      });
    }
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function svgChevron(dir) {
    const d = dir === 'left' ? 'M8 2 L2 8 L8 14' : 'M2 2 L8 8 L2 14';
    return '<svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">'
      + '<path d="' + d + '" stroke="currentColor" stroke-width="2" fill="none"'
      + ' stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

}());
