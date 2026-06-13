/**
 * KAI LAVATAI — CLAIM THE WORD
 * js/main.js
 *
 * Responsibilities:
 *  1. Custom HTML5 Audio API music player
 *  2. Scroll-driven blob parallax with hue-rotate drift
 *  3. Pill nav press-hold-scroll (desktop hover + mobile touchstart)
 *  4. Track seek bar fill update (CSS custom property)
 */

'use strict';

/* ================================================================
   1. TRACK DATA
   Hardcoded JS array. /audio/ relative paths, placeholder filenames.
   Replace src values with real self-hosted MP3s before launch.
   ================================================================ */
const TRACKS = [
  {
    artist: 'Kai Lavatai',
    title:  'Saved',
    src:    'audio/track-01.mp3'
  },
  {
    artist: 'Kai Lavatai',
    title:  'Born Again',
    src:    'audio/track-02.mp3'
  },
  {
    artist: 'Kai Lavatai',
    title:  'The Word',
    src:    'audio/track-03.mp3'
  }
];

/* ================================================================
   2. PLAYER STATE
   ================================================================ */
let currentTrackIndex = 0;
let isPlaying = false;
let volume = 7; // 0–10 scale
const VOLUME_STEPS = 10;

/* ================================================================
   3. DOM REFERENCES
   ================================================================ */
const audioEl         = document.getElementById('audio-player');
const playBtn         = document.getElementById('music-player-track-controls-play-button');
const pauseBtn        = document.getElementById('music-player-track-controls-pause-button');
const prevBtn         = document.getElementById('music-player-track-controls-previous-track-button');
const nextBtn         = document.getElementById('music-player-track-controls-next-track-button');
const volDownBtn      = document.getElementById('music-player-volume-control-lower-encoder');
const volUpBtn        = document.getElementById('music-player-volume-control-raise-encoder');
const volIndicator    = document.getElementById('music-player-volume-control_indicator-fill');
const seekBar         = document.getElementById('track-seek-bar');
const artistEl        = document.getElementById('music-player-song-credits-text-artist_li');
const trackEl         = document.getElementById('music-player-song-credits-text-track_li');

/* ================================================================
   4. PLAYER FUNCTIONS
   ================================================================ */

/**
 * loadTrack(index)
 * Sets audio src, updates credits display, resets seek bar.
 */
function loadTrack(index) {
  const track = TRACKS[index];
  if (!track) return;

  audioEl.src = track.src;
  audioEl.load();

  // Update credits display: "Artist Name / Song Title" inline
  if (artistEl) artistEl.textContent = track.artist;
  if (trackEl)  trackEl.textContent  = track.title;

  // Reset seek
  if (seekBar) {
    seekBar.value = 0;
    seekBar.style.setProperty('--seek-fill', '0%');
  }
}

/**
 * playTrack()
 * Attempts playback; handles browser autoplay policy gracefully.
 */
function playTrack() {
  const promise = audioEl.play();
  if (promise !== undefined) {
    promise
      .then(() => {
        isPlaying = true;
        updatePlayPauseButtons();
      })
      .catch(() => {
        // Autoplay blocked — user must interact first; UI already set
        isPlaying = false;
        updatePlayPauseButtons();
      });
  } else {
    isPlaying = true;
    updatePlayPauseButtons();
  }
}

/**
 * pauseTrack()
 */
function pauseTrack() {
  audioEl.pause();
  isPlaying = false;
  updatePlayPauseButtons();
}

/**
 * updatePlayPauseButtons()
 * Toggles display of play vs pause button per spec:
 * "Swaps display with play button on click."
 */
function updatePlayPauseButtons() {
  if (isPlaying) {
    if (playBtn)  playBtn.style.display  = 'none';
    if (pauseBtn) pauseBtn.style.display = 'flex';
  } else {
    if (playBtn)  playBtn.style.display  = 'flex';
    if (pauseBtn) pauseBtn.style.display = 'none';
  }
}

/**
 * goToTrack(index, autoplay)
 */
function goToTrack(index, autoplay) {
  currentTrackIndex = ((index % TRACKS.length) + TRACKS.length) % TRACKS.length;
  loadTrack(currentTrackIndex);
  if (autoplay) {
    playTrack();
  }
}

/**
 * setVolume(level)
 * level: integer 0–10
 * Updates audio element gain and indicator bar width.
 * linearGradient396: filled width = volume level 0–10; transparent = headroom.
 */
function setVolume(level) {
  volume = Math.max(0, Math.min(VOLUME_STEPS, level));
  audioEl.volume = volume / VOLUME_STEPS;

  const pct = (volume / VOLUME_STEPS) * 100;
  if (volIndicator) {
    volIndicator.style.width = `${pct}%`;
  }
}

/**
 * updateSeekBar()
 * Called on timeupdate. Updates range input value and CSS fill variable.
 */
function updateSeekBar() {
  if (!audioEl.duration || isNaN(audioEl.duration)) return;
  const pct = (audioEl.currentTime / audioEl.duration) * 100;
  if (seekBar) {
    seekBar.value = pct;
    // Drive the WebKit track gradient via CSS custom property
    seekBar.style.setProperty('--seek-fill', `${pct}%`);
  }
}

/**
 * onSeekInput()
 * User drags the seek bar — seek to position in track.
 */
function onSeekInput() {
  if (!audioEl.duration || isNaN(audioEl.duration)) return;
  const pct = parseFloat(seekBar.value) / 100;
  audioEl.currentTime = pct * audioEl.duration;
  seekBar.style.setProperty('--seek-fill', `${seekBar.value}%`);
}

/* ================================================================
   5. PLAYER EVENT BINDINGS
   ================================================================ */

// Play / Pause toggle
if (playBtn) {
  playBtn.addEventListener('click', () => {
    if (!audioEl.src || audioEl.src === window.location.href) {
      loadTrack(currentTrackIndex);
    }
    playTrack();
  });
}

if (pauseBtn) {
  pauseBtn.addEventListener('click', () => {
    pauseTrack();
  });
}

// Previous track
if (prevBtn) {
  prevBtn.addEventListener('click', () => {
    // If more than 3s in, restart current; otherwise go back
    if (audioEl.currentTime > 3) {
      audioEl.currentTime = 0;
    } else {
      goToTrack(currentTrackIndex - 1, isPlaying);
    }
  });
}

// Next track
if (nextBtn) {
  nextBtn.addEventListener('click', () => {
    goToTrack(currentTrackIndex + 1, isPlaying);
  });
}

// Volume controls
if (volDownBtn) {
  volDownBtn.addEventListener('click', () => setVolume(volume - 1));
}
if (volUpBtn) {
  volUpBtn.addEventListener('click', () => setVolume(volume + 1));
}

// Seek bar input (draggable)
if (seekBar) {
  seekBar.addEventListener('input', onSeekInput);
}

// Audio events
audioEl.addEventListener('timeupdate', updateSeekBar);

audioEl.addEventListener('ended', () => {
  goToTrack(currentTrackIndex + 1, true);
});

audioEl.addEventListener('play', () => {
  isPlaying = true;
  updatePlayPauseButtons();
});

audioEl.addEventListener('pause', () => {
  isPlaying = false;
  updatePlayPauseButtons();
});

/* ================================================================
   6. NAV PRESS-HOLD-SCROLL
   Desktop: scroll while mouse held over left/right button.
   Mobile: scroll while finger held; ceases on touchend/touchleave.
   Continuous only while interaction is active — not repeating auto.
   ================================================================ */

const navContainer   = document.getElementById('nav-menu-scroll-container');
const navLeftBtn     = document.getElementById('nav-menu-scroll-left-button');
const navRightBtn    = document.getElementById('nav-menu-scroll-right-button');

const NAV_SCROLL_SPEED = 3; // px per animation frame
let navScrollRAF = null;
let navScrollDir = 0; // -1 = left, +1 = right, 0 = stopped

function navScrollStep() {
  if (navScrollDir === 0 || !navContainer) {
    navScrollRAF = null;
    return;
  }
  navContainer.scrollLeft += NAV_SCROLL_SPEED * navScrollDir;
  navScrollRAF = requestAnimationFrame(navScrollStep);
}

function startNavScroll(dir) {
  navScrollDir = dir;
  if (!navScrollRAF) {
    navScrollRAF = requestAnimationFrame(navScrollStep);
  }
}

function stopNavScroll() {
  navScrollDir = 0;
  if (navScrollRAF) {
    cancelAnimationFrame(navScrollRAF);
    navScrollRAF = null;
  }
}

if (navLeftBtn) {
  // Desktop — hold mouse button
  navLeftBtn.addEventListener('mousedown',  () => startNavScroll(-1));
  // Mobile — hold touch
  navLeftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startNavScroll(-1); }, { passive: false });
}

if (navRightBtn) {
  navRightBtn.addEventListener('mousedown',  () => startNavScroll(1));
  navRightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startNavScroll(1); }, { passive: false });
}

// Stop scrolling on any release or leave
['mouseup', 'mouseleave'].forEach(evt => {
  if (navLeftBtn)  navLeftBtn.addEventListener(evt,  stopNavScroll);
  if (navRightBtn) navRightBtn.addEventListener(evt, stopNavScroll);
  document.addEventListener('mouseup', stopNavScroll);
});

['touchend', 'touchcancel'].forEach(evt => {
  if (navLeftBtn)  navLeftBtn.addEventListener(evt,  stopNavScroll);
  if (navRightBtn) navRightBtn.addEventListener(evt, stopNavScroll);
});

/* ================================================================
   7. SCROLL-DRIVEN BLOB PARALLAX
   Uses scrollY to translate each absolute-positioned radial-gradient
   blob layer at differing rates.
   Applies subtle CSS filter:hue-rotate() shift on scroll for
   atmospheric pastel drift.
   ================================================================ */

const BLOB_CONFIG = [
  // [selector, translateRate, hueRateMultiplier]
  // Header blobs — move at slower rates, less drift
  { sel: '.blob-header-1', rate: 0.08,  hueBase:  0  },
  { sel: '.blob-header-2', rate: 0.14,  hueBase:  30 },
  { sel: '.blob-header-3', rate: 0.10,  hueBase:  60 },
  { sel: '.blob-header-4', rate: 0.18,  hueBase:  90 },
  // Main blobs — move at varied rates
  { sel: '.blob-main-1',   rate: 0.06,  hueBase:  0  },
  { sel: '.blob-main-2',   rate: 0.12,  hueBase:  45 },
  { sel: '.blob-main-3',   rate: 0.09,  hueBase:  90 },
  { sel: '.blob-main-4',   rate: 0.15,  hueBase: 135 },
];

// Cache node references
const blobNodes = BLOB_CONFIG.map(cfg => ({
  ...cfg,
  el: document.querySelector(cfg.sel)
})).filter(b => b.el !== null);

let ticking = false;
let lastScrollY = window.scrollY;

function applyParallax() {
  const scrollY = window.scrollY;

  blobNodes.forEach(blob => {
    const translateY = scrollY * blob.rate;
    // hue-rotate shifts gradually — max ±40deg, looping
    const hue = (blob.hueBase + scrollY * 0.04) % 360;
    blob.el.style.transform = `translateY(${translateY}px)`;
    blob.el.style.filter    = `blur(inherit) hue-rotate(${hue}deg)`;
    // Re-apply blur since transform replaces filter chain
    // Use combined filter string
    const blurPx = blob.sel.includes('header') ? '40px' : '55px';
    blob.el.style.filter = `blur(${blurPx}) hue-rotate(${hue}deg)`;
  });

  ticking = false;
  lastScrollY = scrollY;
}

window.addEventListener('scroll', () => {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(applyParallax);
  }
}, { passive: true });

/* ================================================================
   8. INITIALIZATION — DOMContentLoaded
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {

  // Initialize player: load first track, don't autoplay
  loadTrack(currentTrackIndex);
  setVolume(volume);
  updatePlayPauseButtons();

  // Kickstart parallax at page load position
  applyParallax();

  // Smooth same-page anchor scroll for nav items
  document.querySelectorAll('#nav-menu-ul a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Nav scroll container: mouse wheel also scrolls horizontally
  if (navContainer) {
    navContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      navContainer.scrollLeft += e.deltaY;
    }, { passive: false });
  }

  // Seek bar: update fill on load if audio has a valid duration
  audioEl.addEventListener('loadedmetadata', () => {
    updateSeekBar();
  });

  // Announce player ready in console for debug
  console.log('[ClaimTheWord] Player initialized. Tracks:', TRACKS.length);
});

/* ================================================================
   9. KEYBOARD ACCESSIBILITY FOR PLAYER
   Space = play/pause, Arrow keys = seek 5s, M = mute/unmute
   ================================================================ */
document.addEventListener('keydown', (e) => {
  // Only intercept when not focused on an input/textarea
  const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea') return;

  switch (e.key) {
    case ' ':
    case 'k':
      e.preventDefault();
      if (isPlaying) {
        pauseTrack();
      } else {
        playTrack();
      }
      break;
    case 'ArrowRight':
      e.preventDefault();
      audioEl.currentTime = Math.min(
        (audioEl.duration || 0),
        audioEl.currentTime + 5
      );
      break;
    case 'ArrowLeft':
      e.preventDefault();
      audioEl.currentTime = Math.max(0, audioEl.currentTime - 5);
      break;
    case 'ArrowUp':
      e.preventDefault();
      setVolume(volume + 1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      setVolume(volume - 1);
      break;
    case 'm':
    case 'M':
      e.preventDefault();
      audioEl.muted = !audioEl.muted;
      break;
    case 'n':
    case 'N':
      e.preventDefault();
      goToTrack(currentTrackIndex + 1, isPlaying);
      break;
    case 'p':
    case 'P':
      e.preventDefault();
      goToTrack(currentTrackIndex - 1, isPlaying);
      break;
    default:
      break;
  }
});
