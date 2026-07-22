const ATTRIBUTE_ALIASES = Object.freeze({
  className: 'class',
  htmlFor: 'for',
  tabIndex: 'tabindex',
});

export function el(tagName, attributes = {}, children = []) {
  const node = document.createElement(tagName);
  for (const [rawName, value] of Object.entries(attributes || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (rawName === 'text') {
      node.textContent = String(value);
      continue;
    }
    if (rawName === 'dataset') {
      for (const [key, datasetValue] of Object.entries(value || {})) {
        if (datasetValue !== undefined && datasetValue !== null) {
          node.dataset[key] = String(datasetValue);
        }
      }
      continue;
    }
    if (rawName === 'checked' || rawName === 'disabled' || rawName === 'selected' || rawName === 'open') {
      node[rawName] = Boolean(value);
      continue;
    }
    if (rawName === 'value') {
      node.value = String(value);
      continue;
    }
    const name = ATTRIBUTE_ALIASES[rawName] || rawName;
    node.setAttribute(name, value === true ? '' : String(value));
  }
  append(node, children);
  return node;
}

export function append(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list.flat(Infinity)) {
    if (child === undefined || child === null || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function replaceChildren(node, children) {
  node.replaceChildren();
  append(node, children);
  return node;
}

export function text(value, fallback = 'Not available') {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  return String(value);
}

export function list(value) {
  return Array.isArray(value) ? value : [];
}

export function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function safeInternalHref(value, fallback = null) {
  if (typeof value !== 'string') return fallback;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/mmc-private/')) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function safeOpaqueId(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/u.test(candidate) ? candidate : null;
}

export function formatDateTime(value, options = {}) {
  if (!value) return 'Time not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text(value);
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: options.dateStyle || 'medium',
      timeStyle: options.dateOnly ? undefined : (options.timeStyle || 'short'),
      timeZone: options.timeZone,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function labelledValue(label, value, options = {}) {
  return el('div', { className: `labelled-value ${options.className || ''}`.trim() }, [
    el('span', { className: 'labelled-value__label', text: label }),
    el('span', { className: 'labelled-value__value', text: text(value) }),
  ]);
}

export function iconText(symbol, label) {
  return [
    el('span', { className: 'icon-symbol', 'aria-hidden': 'true', text: symbol }),
    el('span', { text: label }),
  ];
}

export function setDocumentTitle(title) {
  document.title = `${title} · Matrix Mentor Console`;
}
