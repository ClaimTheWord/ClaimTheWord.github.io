/**
 * KAI LAVATAI — CLAIM THE WORD
 * js/blog.js
 *
 * Reads feed.json — a static file committed to the repo by the
 * GitHub Action (.github/workflows/fetch-blog.yml) which fetches
 * the Blogger feed server-side every 6 hours.
 *
 * No CORS issues. No JSONP. No API keys. Works on GitHub Pages.
 */

'use strict';

/* ================================================================
   CONFIG
   ================================================================ */
const BLOG_CONFIG = {
  feedFile:  'feed.json',         /* relative to site root */
  cacheKey:  'ctw_blog_cache',
  cacheTTL:  15 * 60 * 1000      /* 15 minutes */
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
   STATE
   ================================================================ */
function showState(state) {
  feedLoading.hidden = state !== 'loading';
  feedError.hidden   = state !== 'error';
  feedEmpty.hidden   = state !== 'empty';
  feedOutput.hidden  = state !== 'posts';
  feedLoading.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
}

/* ================================================================
   CACHE
   ================================================================ */
function cacheRead() {
  try {
    const raw = localStorage.getItem(BLOG_CONFIG.cacheKey);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > BLOG_CONFIG.cacheTTL) return null;
    return data;
  } catch { return null; }
}

function cacheWrite(data) {
  try {
    localStorage.setItem(
      BLOG_CONFIG.cacheKey,
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {}
}

/* ================================================================
   XSS MITIGATION
   ================================================================ */
const STRIP_TAGS  = new Set(['script','iframe','object','embed','form','input','button','textarea','select']);
const STRIP_ATTRS = /^(on\w+|javascript:|data:)/i;

function sanitizeHTML(rawHTML) {
  if (!rawHTML) return '';
  const doc = new DOMParser().parseFromString(rawHTML, 'text/html');
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const toRemove = [];
  let node = walker.currentNode;
  while (node) {
    if (STRIP_TAGS.has(node.tagName.toLowerCase())) {
      toRemove.push(node);
    } else {
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
   HELPERS
   ================================================================ */
function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return ''; }
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
  const title     = entry.title?.$t             || 'Untitled';
  const author    = entry.author?.[0]?.name?.$t || '';
  const published = entry.published?.$t          || '';
  const content   = entry.content?.$t            || '';
  const permalink = getPermalink(entry.link);

  const article = document.createElement('article');
  article.className = 'blog-post';

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'blog-post-meta';
  const timeEl = document.createElement('time');
  timeEl.setAttribute('datetime', published);
  timeEl.textContent = formatDate(published);
  meta.appendChild(timeEl);
  if (author) {
    const authorEl = document.createElement('span');
    authorEl.className   = 'blog-post-author';
    authorEl.textContent = author;
    meta.appendChild(authorEl);
  }
  article.appendChild(meta);

  // Title
  const titleEl   = document.createElement('h2');
  titleEl.className = 'blog-post-title';
  const titleLink = document.createElement('a');
  titleLink.href        = permalink;
  titleLink.rel         = 'noopener';
  titleLink.target      = '_blank';
  titleLink.textContent = title;
  titleEl.appendChild(titleLink);
  article.appendChild(titleEl);

  // Body
  const bodyEl      = document.createElement('div');
  bodyEl.className  = 'blog-post-body';
  bodyEl.innerHTML  = sanitizeHTML(content);
  bodyEl.querySelectorAll('img').forEach(img => {
    img.style.removeProperty('width');
    img.style.removeProperty('height');
    img.setAttribute('loading', 'lazy');
    if (!img.alt) img.alt = '';
  });
  article.appendChild(bodyEl);

  // Read More
  const readMore       = document.createElement('a');
  readMore.className   = 'blog-post-readmore';
  readMore.href        = permalink;
  readMore.rel         = 'noopener';
  readMore.target      = '_blank';
  readMore.textContent = 'Read on Blogger';
  readMore.setAttribute('aria-label', `Read full post: ${title}`);
  article.appendChild(readMore);

  return article;
}

/* ================================================================
   RENDER
   ================================================================ */
function renderFeed(entries) {
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

/* ================================================================
   FETCH — reads local feed.json, no CORS involved
   ================================================================ */
async function fetchFeed() {
  showState('loading');

  const cached = cacheRead();
  if (cached) {
    renderFeed(cached);
    return;
  }

  try {
    const response = await fetch(BLOG_CONFIG.feedFile);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data    = await response.json();
    const entries = data?.feed?.entry ?? [];

    cacheWrite(entries);
    renderFeed(entries);

  } catch (err) {
    console.error('[CTW Blog] Failed to load feed.json:', err.message);
    showState('error');
  }
}

/* ================================================================
   RETRY
   ================================================================ */
if (retryBtn) {
  retryBtn.addEventListener('click', () => {
    try { localStorage.removeItem(BLOG_CONFIG.cacheKey); } catch {}
    fetchFeed();
  });
}

/* ================================================================
   INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  if (!feedOutput) return;
  fetchFeed();
});
 
