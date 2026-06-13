/**
 * KAI LAVATAI — CLAIM THE WORD
 * js/blog.js
 *
 * Responsibilities:
 *  1. Fetch Blogger Atom/JSON feed (no API key, no proxy, CORS-safe)
 *  2. localStorage cache — 15-min threshold to limit API thrashing
 *  3. Build semantic DOM cards from GData payload schema
 *  4. XSS mitigation via DOMParser sandboxing of raw HTML content
 *  5. Responsive image override — neutralizes Blogger inline width/height
 *  6. Feed state management: loading → posts | error | empty
 */

'use strict';

/* ================================================================
   CONFIG
   ================================================================ */
const BLOG_CONFIG = {
  // Production Atom-to-JSON endpoint (no API key required)
  endpoint: 'https://claimtheword.blogspot.com/feeds/posts/default?alt=json&max-results=6&orderby=published',
  params: {
    alt:        'json',
    'max-results': '6',
    orderby:    'published'
  },
  // localStorage cache key + TTL (milliseconds)
  cacheKey:    'ctw_blog_cache',
  cacheTTL:    15 * 60 * 1000  // 15 minutes
};

/* ================================================================
   DOM REFERENCES
   ================================================================ */
const feedOutput  = document.getElementById('blog-feed-output');
const feedLoading = document.getElementById('blog-feed-loading');
const feedError   = document.getElementById('blog-feed-error');
const feedEmpty   = document.getElementById('blog-feed-empty');
const retryBtn    = document.getElementById('blog-feed-retry-btn');

/* ================================================================
   STATE HELPERS
   Show one panel, hide the rest.
   ================================================================ */
function showState(state) {
  feedLoading.hidden = state !== 'loading';
  feedError.hidden   = state !== 'error';
  feedEmpty.hidden   = state !== 'empty';
  feedOutput.hidden  = state !== 'posts';

  if (state === 'loading') {
    feedLoading.setAttribute('aria-busy', 'true');
  } else {
    feedLoading.setAttribute('aria-busy', 'false');
  }
}

/* ================================================================
   CACHE
   localStorage with timestamp guard.
   Falls back gracefully if localStorage is unavailable (private
   browsing modes that block storage access).
   ================================================================ */
function cacheRead() {
  try {
    const raw = localStorage.getItem(BLOG_CONFIG.cacheKey);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > BLOG_CONFIG.cacheTTL) return null;
    return data;
  } catch {
    return null;
  }
}

function cacheWrite(data) {
  try {
    localStorage.setItem(
      BLOG_CONFIG.cacheKey,
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {
    // Storage full or blocked — fail silently, content still renders
  }
}

/* ================================================================
   XSS MITIGATION — DOMParser sandbox
   Blogger's entry.content.$t is a raw HTML string that may
   contain inline scripts, iframes, or injected event handlers
   from the Blogger editor or comments.

   Strategy:
   1. Parse via DOMParser into an inert document (no script exec)
   2. Walk all elements and strip dangerous attributes
   3. Remove script/iframe/object/embed tags entirely
   4. Return sanitized innerHTML string

   DOMPurify would be the production-grade choice if the blog
   accepts third-party comments. For admin-only posts this
   lightweight implementation is sufficient.
   ================================================================ */
const STRIP_TAGS  = new Set(['script','iframe','object','embed','form','input','button','textarea','select']);
const STRIP_ATTRS = /^(on\w+|javascript:|data:)/i;

function sanitizeHTML(rawHTML) {
  if (!rawHTML) return '';

  // Parse into an inert document — scripts do not execute here
  const doc = new DOMParser().parseFromString(rawHTML, 'text/html');

  // Walk the DOM and remove dangerous elements + attributes
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const toRemove = [];

  let node = walker.currentNode;
  while (node) {
    if (STRIP_TAGS.has(node.tagName.toLowerCase())) {
      toRemove.push(node);
    } else {
      // Strip event handler and javascript: attributes
      for (const attr of [...node.attributes]) {
        if (STRIP_ATTRS.test(attr.name) || STRIP_ATTRS.test(attr.value)) {
          node.removeAttribute(attr.name);
        }
      }
    }
    node = walker.nextNode();
  }

  toRemove.forEach(el => el.remove());

  return doc.body.innerHTML;
}

/* ================================================================
   DATE FORMATTER
   ISO 8601 timestamp from Blogger → human-readable local date.
   e.g. "2026-06-12T10:30:00.000-07:00" → "June 12, 2026"
   ================================================================ */
function formatDate(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      year:  'numeric',
      month: 'long',
      day:   'numeric'
    });
  } catch {
    return '';
  }
}

/* ================================================================
   PERMALINK RESOLVER
   GData link array — find the entry with rel === "alternate"
   which is the public post URL.
   ================================================================ */
function getPermalink(links) {
  if (!Array.isArray(links)) return '#';
  const alt = links.find(l => l.rel === 'alternate');
  return alt ? alt.href : '#';
}

/* ================================================================
   DOM BUILDER
   Assembles one <article> card per Blogger entry.
   All Blogger content is contained under .blog-post-body
   within the .synth-blog-feed namespace.
   ================================================================ */
function buildPostCard(entry) {
  const title     = entry.title?.$t     || 'Untitled';
  const author    = entry.author?.[0]?.name?.$t || '';
  const published = entry.published?.$t || '';
  const content   = entry.content?.$t   || '';
  const permalink = getPermalink(entry.link);

  const formattedDate   = formatDate(published);
  const sanitizedBody   = sanitizeHTML(content);

  // <article class="blog-post">
  const article = document.createElement('article');
  article.className = 'blog-post';

  // Meta row: date + author
  const meta = document.createElement('div');
  meta.className = 'blog-post-meta';

  const timeEl = document.createElement('time');
  timeEl.setAttribute('datetime', published);
  timeEl.textContent = formattedDate;
  meta.appendChild(timeEl);

  if (author) {
    const authorEl = document.createElement('span');
    authorEl.className = 'blog-post-author';
    authorEl.textContent = author;
    meta.appendChild(authorEl);
  }

  article.appendChild(meta);

  // Title
  const titleEl = document.createElement('h2');
  titleEl.className = 'blog-post-title';

  const titleLink = document.createElement('a');
  titleLink.href        = permalink;
  titleLink.rel         = 'noopener';
  titleLink.target      = '_blank';
  titleLink.textContent = title;
  titleEl.appendChild(titleLink);
  article.appendChild(titleEl);

  // Body — sanitized Blogger HTML
  const bodyEl = document.createElement('div');
  bodyEl.className = 'blog-post-body';
  // innerHTML is safe here: sanitizeHTML() has already
  // stripped all scripts, event handlers, and dangerous tags.
  bodyEl.innerHTML = sanitizedBody;

  // Force responsive images — override Blogger's inline width/height
  bodyEl.querySelectorAll('img').forEach(img => {
    img.style.removeProperty('width');
    img.style.removeProperty('height');
    img.setAttribute('loading', 'lazy');
    if (!img.alt) img.alt = '';
  });

  article.appendChild(bodyEl);

  // Read More link
  const readMore = document.createElement('a');
  readMore.className  = 'blog-post-readmore';
  readMore.href       = permalink;
  readMore.rel        = 'noopener';
  readMore.target     = '_blank';
  readMore.textContent = 'Read on Blogger';
  readMore.setAttribute('aria-label', `Read full post: ${title}`);
  article.appendChild(readMore);

  return article;
}

/* ================================================================
   RENDER
   Clears output, builds cards, shows feed.
   ================================================================ */
function renderFeed(entries) {
  feedOutput.innerHTML = '';

  if (!entries || entries.length === 0) {
    showState('empty');
    return;
  }

  const fragment = document.createDocumentFragment();
  entries.forEach(entry => {
    fragment.appendChild(buildPostCard(entry));
  });

  feedOutput.appendChild(fragment);
  showState('posts');
}

/* ================================================================
   FETCH
   1. Check localStorage cache first
   2. Build URL from config
   3. Fetch → parse JSON → isolate entry array
   4. Cache result, render
   5. On error: show error state
   ================================================================ */
async function fetchFeed() {
  showState('loading');

  // Cache hit — render immediately, skip network
  const cached = cacheRead();
  if (cached) {
    renderFeed(cached);
    return;
  }

  // Build URL
  const url = new URL(BLOG_CONFIG.endpoint);
  Object.entries(BLOG_CONFIG.params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json    = await response.json();
    const entries = json?.feed?.entry ?? [];

    // Cache successful payload
    cacheWrite(entries);
    renderFeed(entries);

  } catch (err) {
    console.warn('[ClaimTheWord] Blog feed fetch failed:', err);
    showState('error');
  }
}

/* ================================================================
   RETRY BUTTON
   ================================================================ */
if (retryBtn) {
  retryBtn.addEventListener('click', () => {
    // Clear cache so retry hits the network
    try { localStorage.removeItem(BLOG_CONFIG.cacheKey); } catch {}
    fetchFeed();
  });
}

/* ================================================================
   INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Only run on blog.html — guard against main.js loading this
  // on pages that don't have the feed elements
  if (!feedOutput) return;

  fetchFeed();
  console.log('[ClaimTheWord] Blog feed initialized. Endpoint:', BLOG_CONFIG.endpoint);
});
