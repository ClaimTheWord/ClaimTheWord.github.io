/**
 * KAI LAVATAI — CLAIM THE WORD
 * js/blog.js
 *
 * Responsibilities:
 * 1. Fetch Blogger Atom/JSON feed (no API key, no proxy, CORS-safe)
 * 2. localStorage cache — 15-min threshold to limit API thrashing
 * 3. Build semantic DOM cards from GData payload schema
 * 4. XSS mitigation via DOMParser sandboxing of raw HTML content
 * 5. Responsive image override — neutralizes Blogger inline width/height
 * 6. Feed state management: loading → posts | error | empty
 */

'use strict';

/* ================================================================
   CONFIG
   ================================================================ */
const BLOG_CONFIG = {
  // Production Atom-to-JSON endpoint. 
  // NOTE: If your custom domain fails CORS locally, switch this to your *.blogspot.com URL
  endpoint: 'https://www.claimthewordllc.com/feeds/posts/default',
  params: {
    alt:           'json',
    'max-results': '6',
    orderby:       'published'
  },
  cacheKey: 'ctw_blog_cache',
  cacheTTL: 15 * 60 * 1000 // 15 minutes
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
   ================================================================ */
function showState(state) {
  if (!feedOutput) return;
  feedLoading.hidden = state !== 'loading';
  feedError.hidden   = state !== 'error';
  feedEmpty.hidden   = state !== 'empty';
  feedOutput.hidden  = state !== 'posts';

  feedLoading.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
}

/* ================================================================
   CACHE HANDLERS
   ================================================================ */
function cacheRead() {
  try {
    const raw = localStorage.getItem(BLOG_CONFIG.cacheKey);
    if (!raw) return null;
    
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > BLOG_CONFIG.cacheTTL) {
      localStorage.removeItem(BLOG_CONFIG.cacheKey);
      return null;
    }
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
    // Fail silently if storage is full or private mode blocks it
  }
}

/* ================================================================
   XSS MITIGATION & SANITIZATION
   Swapped out the fragile TreeWalker loop for a robust query pass.
   ================================================================ */
const STRIP_TAGS  = new Set(['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select']);
const STRIP_ATTRS = /^(on\w+|javascript:|data:)/i;

function sanitizeHTML(rawHTML) {
  if (!rawHTML) return '';

  const doc = new DOMParser().parseFromString(rawHTML, 'text/html');
  const allElements = doc.body.querySelectorAll('*');

  allElements.forEach(node => {
    if (STRIP_TAGS.has(node.tagName.toLowerCase())) {
      node.remove();
    } else {
      for (const attr of [...node.attributes]) {
        if (STRIP_ATTRS.test(attr.name) || STRIP_ATTRS.test(attr.value)) {
          node.removeAttribute(attr.name);
        }
      }
    }
  });

  return doc.body.innerHTML;
}

/* ================================================================
   TRANSFORMERS / RESOLVERS
   ================================================================ */
function formatDate(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      year:  'numeric',
      month: 'long',
      day:   'numeric'
    });
  } catch {
    return '';
  }
}

function getPermalink(links) {
  if (!Array.isArray(links)) return '#';
  const alt = links.find(l => l.rel === 'alternate');
  return alt ? alt.href : '#';
}

/* ================================================================
   DOM BUILDER
   ================================================================ */
function buildPostCard(entry) {
  const title     = entry.title?.$t     || 'Untitled';
  const author    = entry.author?.[0]?.name?.$t || '';
  const published = entry.published?.$t || '';
  const content   = entry.content?.$t   || entry.summary?.$t || '';
  const permalink = getPermalink(entry.link);

  const formattedDate = formatDate(published);
  const sanitizedBody = sanitizeHTML(content);

  const article = document.createElement('article');
  article.className = 'blog-post';

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'blog-post-meta';

  if (formattedDate) {
    const timeEl = document.createElement('time');
    timeEl.setAttribute('datetime', published);
    timeEl.textContent = formattedDate;
    meta.appendChild(timeEl);
  }

  if (author) {
    const authorEl = document.createElement('span');
    authorEl.className = 'blog-post-author';
    authorEl.textContent = author;
    meta.appendChild(authorEl);
  }
  
  if (meta.hasChildNodes()) article.appendChild(meta);

  // Title
  const titleEl = document.createElement('h2');
  titleEl.className = 'blog-post-title';
  const titleLink = document.createElement('a');
  titleLink.href = permalink;
  titleLink.rel = 'noopener';
  titleLink.target = '_blank';
  titleLink.textContent = title;
  titleEl.appendChild(titleLink);
  article.appendChild(titleEl);

  // Body content
  const bodyEl = document.createElement('div');
  bodyEl.className = 'blog-post-body';
  bodyEl.innerHTML = sanitizedBody;

  // Modernized responsive image management
  bodyEl.querySelectorAll('img').forEach(img => {
    img.removeAttribute('width');
    img.removeAttribute('height');
    img.style.width = '100%';
    img.style.height = 'auto';
    img.setAttribute('loading', 'lazy');
    if (!img.alt) img.alt = title;
  });
  article.appendChild(bodyEl);

  // Read More Action Link
  const readMore = document.createElement('a');
  readMore.className = 'blog-post-readmore';
  readMore.href = permalink;
  readMore.rel = 'noopener';
  readMore.target = '_blank';
  readMore.textContent = 'Read on Blogger';
  readMore.setAttribute('aria-label', `Read full post: ${title}`);
  article.appendChild(readMore);

  return article;
}

/* ================================================================
   RENDER & FETCH
   ================================================================ */
function renderFeed(entries) {
  if (!feedOutput) return;
  feedOutput.innerHTML = '';

  if (!entries || entries.length === 0) {
    showState('empty');
    return;
  }

  const fragment = document.createDocumentFragment();
  entries.forEach(entry => fragment.appendChild(buildPostCard(entry)));
  
  feedOutput.appendChild(fragment);
  showState('posts');
}

async function fetchFeed() {
  showState('loading');

  const cached = cacheRead();
  if (cached) {
    renderFeed(cached);
    return;
  }

  const url = new URL(BLOG_CONFIG.endpoint);
  Object.entries(BLOG_CONFIG.params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json();
    const entries = json?.feed?.entry ?? [];

    cacheWrite(entries);
    renderFeed(entries);
  } catch (err) {
    console.warn('[ClaimTheWord] Blog feed fetch failed:', err);
    showState('error');
  }
}

/* ================================================================
   INITIALIZATION
   ================================================================ */
if (retryBtn) {
  retryBtn.addEventListener('click', () => {
    try { localStorage.removeItem(BLOG_CONFIG.cacheKey); } catch {}
    fetchFeed();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!feedOutput) return; // Silent bail if not on the blog presentation layout
  fetchFeed();
});
