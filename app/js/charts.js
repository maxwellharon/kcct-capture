// Tiny dependency-free charts built from plain HTML so they work offline and stay crisp.
// One hue (the logo purple) carries magnitude; pink marks the single thing to look at.
import { h } from './util.js';

const tableOf = (cols, rows) => h('details', { class: 'tbl' }, h('summary', {}, 'View as table'),
  h('table', {}, h('thead', {}, h('tr', {}, cols.map(c => h('th', {}, c)))), h('tbody', {}, rows.map(r => h('tr', {}, r.map(c => h('td', {}, c)))))));

// Horizontal bars. rows: [{k, n, sub?, hot?}]
export function hbar(rows, { fmt = v => v, max, note, unit = 'women' } = {}) {
  if (!rows.length) return h('p', { class: 'empty-note' }, 'Nothing recorded yet.');
  const m = max ?? Math.max(...rows.map(r => r.n), 1);
  return h('div', { class: 'chart' },
    h('div', { class: 'hbar', role: 'img', 'aria-label': rows.map(r => `${r.k}: ${fmt(r.n)}`).join('; ') },
      rows.map(r => h('div', { class: 'hb-row' },
        h('span', { class: 'hb-k' }, r.k),
        h('span', { class: 'hb-track' }, h('i', { class: r.hot ? 'hot' : '', style: { width: Math.max(r.n / m * 100, r.n ? 1.5 : 0) + '%' } })),
        h('span', { class: 'hb-v' }, fmt(r.n), r.sub ? h('small', {}, r.sub) : null)))),
    note ? h('p', { class: 'chart-note' }, note) : null,
    tableOf(['Group', unit], rows.map(r => [r.k, fmt(r.n) + (r.sub ? ` (${r.sub})` : '')])));
}

// Daily columns
export function columns(days) {
  const m = Math.max(...days.map(d => d.n), 1);
  const peak = days.reduce((a, b) => (b.n > a.n ? b : a), days[0]);
  return h('div', { class: 'chart' },
    h('div', { class: 'cols', role: 'img', 'aria-label': 'Women registered per day, last 14 days' },
      days.map(d => h('div', { class: 'col' },
        h('span', { class: 'col-v' }, d.n || ''),
        h('i', { class: d === peak && d.n ? 'hot' : '', style: { height: Math.max(d.n / m * 100, d.n ? 3 : 0) + '%' }, title: `${d.key}: ${d.n}` }),
        h('span', { class: 'col-k' }, d.label)))),
    tableOf(['Day', 'Registered'], days.map(d => [d.key, d.n])));
}

// Rate bars (positivity): rows [{k,n,pos,rate}]
export function rateBars(rows, overall) {
  const m = Math.max(...rows.map(r => r.rate), 0.01);
  const top = rows.filter(r => r.n >= 5).sort((a, b) => b.rate - a.rate)[0];
  return hbar(rows.map(r => ({ k: r.k, n: r.rate * 100, sub: `${r.pos} of ${r.n}`, hot: r === top })),
    { fmt: v => v.toFixed(0) + '%', max: m * 100, note: overall != null ? `Overall positivity ${(overall * 100).toFixed(0)}%. Groups under 5 women are not highlighted.` : '', unit: 'positivity' });
}

// Funnel: rows [{k,n}] – each bar scaled to the first, with step-to-step retention
export function funnel(rows) {
  const first = rows[0].n || 1;
  return hbar(rows.map((r, i) => ({ k: r.k, n: r.n, sub: i ? (rows[i - 1].n ? `${Math.round(r.n / rows[i - 1].n * 100)}% of ${rows[i - 1].k.toLowerCase()}` : '') : '' })),
    { max: first, note: 'Not every woman needs every step. Colposcopy follows a positive test; treatment follows eligibility; referral follows suspected cancer or advanced pathology.' });
}

// Stat tile with optional progress bar
export function tile({ label, value, sub, ratio, tone }) {
  return h('div', { class: 'tile' + (tone ? ' ' + tone : '') },
    h('span', { class: 'tile-v' }, value),
    h('span', { class: 'tile-k' }, label),
    ratio != null ? h('span', { class: 'tile-bar', 'aria-hidden': 'true' }, h('i', { style: { width: Math.min(100, ratio * 100) + '%' } })) : null,
    sub ? h('span', { class: 'tile-s' }, sub) : null);
}
