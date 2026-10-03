// dom.js: tiny DOM helpers. No framework.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

/** Escape any value for safe interpolation into HTML text or a quoted attribute. */
export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"'`]/g, (c) => ESC[c]);
}

/** querySelector / querySelectorAll shortcuts. */
export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

/** Remove all children. */
export function clear(el) {
  if (!el) return el;
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/**
 * h(tag, attrs, ...children)
 * attrs: { class, style (string|object), dataset: {}, testid, on: { click: fn }, onclick: fn, html (trusted string), ...attributes }
 * children: strings (text, escaped by the DOM), nodes, arrays, null/false (skipped).
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class' || k === 'className') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'testid') el.setAttribute('data-testid', v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'on' && typeof v === 'object') { for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn); }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  } else if (attrs !== undefined && attrs !== null) {
    children.unshift(attrs);
  }
  appendKids(el, children);
  return el;
}

function appendKids(el, kids) {
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) appendKids(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

/** Create an element from a trusted HTML string (all dynamic parts must be esc()'d). */
export function fromHTML(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html).trim();
  return t.content.childElementCount === 1 ? t.content.firstElementChild : t.content;
}

/**
 * Event delegation: on(root, 'click', '[data-act]', (event, matchedEl) => ...). Returns an unsubscribe function.
 */
export function on(root, type, selector, fn, opts) {
  const handler = (e) => {
    const t = e.target && e.target.closest ? e.target.closest(selector) : null;
    if (!t || !root.contains(t)) return;
    fn(e, t);
  };
  root.addEventListener(type, handler, opts);
  return () => root.removeEventListener(type, handler, opts);
}
