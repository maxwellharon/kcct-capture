// Small helpers shared by every screen.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const SVGNS = 'http://www.w3.org/2000/svg';
function apply(el, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
}
function add(el, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
export function h(tag, attrs, ...kids) { const el = document.createElement(tag); apply(el, attrs); return add(el, kids); }
export function s(tag, attrs, ...kids) { const el = document.createElementNS(SVGNS, tag); apply(el, attrs); return add(el, kids); }

// ---- dates (always local time – Nairobi staff, Nairobi dates) ----
const p2 = n => String(n).padStart(2, '0');
export const localDate = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const hhmm = iso => { const d = new Date(iso); return isNaN(d) ? '' : `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
export const dayOf = iso => (iso ? localDate(new Date(iso)) : null);
export const daysBetween = (a, b) => Math.round((new Date(b + (b.length === 10 ? 'T00:00' : '')) - new Date(a + (a.length === 10 ? 'T00:00' : ''))) / 864e5);
export const daysSince = iso => (iso ? daysBetween(dayOf(iso) || iso, localDate()) : null);
export const fmtDate = v => {
  if (!v) return '';
  const d = new Date(v.length === 10 ? v + 'T00:00' : v);
  return isNaN(d) ? v : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const fmtDay = v => {
  const d = new Date(v + 'T00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
export const mmss = sec => `${Math.floor(sec / 60)}:${p2(Math.floor(sec % 60))}`;

// ---- numbers ----
export const num = v => (v === '' || v == null || isNaN(+v) ? null : +v);
export const pct = (a, b, d = 0) => (b ? (100 * a / b).toFixed(d) + '%' : '–');
export const median = arr => {
  const a = arr.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
export const mean = arr => { const a = arr.filter(x => x != null && !isNaN(x)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };

export function bmi(hCm, wKg) {
  if (!hCm || !wKg) return null;
  return +(wKg / ((hCm / 100) ** 2)).toFixed(1);
}
export function bmiCat(b) {
  if (b == null) return null;
  return b < 18.5 ? 'Underweight' : b < 25 ? 'Healthy' : b < 30 ? 'Overweight' : 'Obese';
}

export function deepMerge(a, b) {
  if (Array.isArray(b) || b === null || typeof b !== 'object') return b;
  const out = { ...(a && typeof a === 'object' && !Array.isArray(a) ? a : {}) };
  for (const k of Object.keys(b)) out[k] = deepMerge(out[k], b[k]);
  return out;
}
export const clean = o => JSON.parse(JSON.stringify(o, (k, v) => (v === undefined ? null : v)));

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* */ } },
};

export function toast(msg, kind = '') {
  let box = document.getElementById('toasts');
  if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: 'toast ' + kind }, msg);
  box.append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}

export function download(name, text, type = 'text/csv') {
  const blob = new Blob([text], { type: type + ';charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
export const csvCell = v => {
  if (v == null) return '';
  if (Array.isArray(v)) v = v.join('|');
  v = String(v);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};

export const COUNTIES = ['Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a", 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'];
