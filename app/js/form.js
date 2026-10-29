// Form engine: turns a schema (schema.js) into the fast "answer, collapse, next" card flow.
import { h, s, num, bmi, bmiCat, localDate, hhmm, fmtDate, store } from './util.js';

export const isAnswered = (f, d) => {
  if (f.type === 'hw') return f.ids.some(i => d[i] != null && d[i] !== '');
  if (f.type === 'contact') return !!(d._contact && (d._contact.name || d._contact.phone));
  const v = d[f.id];
  return v != null && v !== '' && !(Array.isArray(v) && !v.length);
};
const stickyKey = (ns, id) => `kcct.sticky.${ns}.${id}`;
const PHONE_OK = v => /^(\+?254|0)[17]\d{8}$/.test(v.replace(/[\s-]/g, ''));

export function mountForm(root, opts) {
  const { schema, ns = 'x', ctx = {}, autoAdvance = true, onChange, isNew = true, banner } = opts;
  const d = JSON.parse(JSON.stringify(opts.data || {}));
  const skipped = new Set();
  const st = { pinned: null, openId: null, touched: false, lastOpen: null, mounted: false };
  const cards = new Map();
  const groups = new Map();
  const bannerEl = h('div', { class: 'banners' });
  const list = h('div', { class: 'q-list' });
  root.replaceChildren(bannerEl, list);

  // defaults (new records only)
  if (isNew) for (const f of schema) {
    if (f.type === 'hw' || f.type === 'contact') continue;
    if (d[f.id] != null) continue;
    if (f.def != null) d[f.id] = typeof f.def === 'function' ? f.def(ctx) : f.def;
    else if (f.sticky) { const v = store.get(stickyKey(ns, f.id)); if (v != null) d[f.id] = v; }
  }

  const touch = () => { if (!st.touched) { st.touched = true; opts.onFirstTouch && opts.onFirstTouch(); } };
  function commit(id, val, advance = true) {
    d[id] = val; touch(); skipped.delete(id); st.pinned = null; st.openId = null;
    const f = schema.find(x => x.id === id); if (f && f.sticky && val) store.set(stickyKey(ns, id), val);
    refresh(advance);
  }
  function live(id, val) { d[id] = val; touch(); st.pinned = id; refresh(false); }
  function finishCard(f, advance = true) {
    if (!isAnswered(f, d) && !skipped.has(f.id) && f.req) return;
    st.pinned = null; st.openId = null; touch(); refresh(advance);
  }
  const skip = f => { skipped.add(f.id); touch(); st.pinned = null; st.openId = null; refresh(true); };

  const nextBtn = f => h('button', { type: 'button', class: 'btn primary next', onclick: () => finishCard(f) }, 'Next');
  const skipBtn = f => (f.req ? null : h('button', { type: 'button', class: 'btn quiet', onclick: () => skip(f) }, 'Skip'));
  const hintEl = f => (f.hint ? h('p', { class: 'hint' }, f.hint) : null);
  const warnEl = h => h; // placeholder to keep linter quiet

  const put = (el, ...k) => el.append(...k.filter(x => x != null && x !== false));

  function numInput(placeholder, decimal) {
    return h('input', { class: 'big-input', type: 'text', inputmode: decimal ? 'decimal' : 'numeric', autocomplete: 'off', placeholder: placeholder || '–', enterkeyhint: 'next' });
  }

  // ───────── control builders ─────────
  function build(f) {
    const pad = h('div', { class: 'q-pad' });
    const api = { sync() {}, focus() {} };
    const warn = h('p', { class: 'hint warn', hidden: true });
    switch (f.type) {
      case 'chips': {
        const btns = f.opts.map(o => h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onclick: () => commit(f.id, o) }, o));
        put(pad, h('div', { class: 'chips' + (f.opts.length <= 3 ? ' row' : '') }, btns), hintEl(f), warn, h('div', { class: 'q-foot' }, skipBtn(f)));
        api.sync = () => btns.forEach((b, i) => b.setAttribute('aria-pressed', String(d[f.id] === f.opts[i])));
        break;
      }
      case 'multi': {
        const ex = f.exclusive || [];
        const btns = f.opts.map(o => h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onclick: () => {
          let cur = Array.isArray(d[f.id]) ? [...d[f.id]] : [];
          if (cur.includes(o)) cur = cur.filter(x => x !== o);
          else if (ex.includes(o)) { commit(f.id, [o]); return; }
          else cur = [...cur.filter(x => !ex.includes(x)), o];
          live(f.id, cur.length ? cur : null);
        } }, o));
        put(pad, h('div', { class: 'chips' }, btns), hintEl(f), h('div', { class: 'q-foot' }, skipBtn(f), nextBtn(f)));
        api.sync = () => btns.forEach((b, i) => b.setAttribute('aria-pressed', String(Array.isArray(d[f.id]) && d[f.id].includes(f.opts[i]))));
        break;
      }
      case 'num': {
        const inp = numInput('–', f.decimal);
        const unit = h('span', { class: 'unit' }, f.unit || '');
        const err = h('p', { class: 'hint err', hidden: true }, `Enter a number from ${f.min} to ${f.max}.`);
        inp.addEventListener('input', () => {
          const n = num(inp.value.replace(',', '.'));
          const ok = n != null && n >= f.min && n <= f.max;
          err.hidden = ok || inp.value === '';
          live(f.id, ok ? n : null);
        });
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finishCard(f); } });
        const alts = (f.alts || []).map(a => h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onclick: () => { inp.value = ''; commit(f.id, a); } }, a));
        put(pad, h('div', { class: 'num-row' }, inp, unit), err, warn, alts.length ? h('div', { class: 'chips alts' }, alts) : null, hintEl(f), h('div', { class: 'q-foot' }, skipBtn(f), nextBtn(f)));
        api.sync = () => {
          if (document.activeElement !== inp) inp.value = typeof d[f.id] === 'number' ? d[f.id] : '';
          alts.forEach((b, i) => b.setAttribute('aria-pressed', String(d[f.id] === f.alts[i])));
        };
        api.focus = () => inp.focus({ preventScroll: true });
        break;
      }
      case 'hw': {
        const [hid, wid] = f.ids;
        const hi = numInput('165'), wi = numInput('62', true);
        const read = h('div', { class: 'bmi', 'aria-live': 'polite' });
        const mk = (id, inp, lo, hi2) => () => {
          const n = num(inp.value.replace(',', '.'));
          d[id] = n != null && n >= lo && n <= hi2 ? n : null; touch(); st.pinned = f.id; refresh(false);
        };
        hi.addEventListener('input', mk(hid, hi, 100, 220)); wi.addEventListener('input', mk(wid, wi, 20, 250));
        hi.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); wi.focus(); } });
        wi.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finishCard(f); } });
        put(pad, 
          h('div', { class: 'hw' },
            h('label', {}, h('span', { class: 'lbl' }, 'Height'), h('div', { class: 'num-row' }, hi, h('span', { class: 'unit' }, 'cm'))),
            h('label', {}, h('span', { class: 'lbl' }, 'Weight'), h('div', { class: 'num-row' }, wi, h('span', { class: 'unit' }, 'kg')))),
          read, h('div', { class: 'q-foot' }, skipBtn(f), nextBtn(f)));
        api.sync = () => {
          if (document.activeElement !== hi) hi.value = d[hid] ?? '';
          if (document.activeElement !== wi) wi.value = d[wid] ?? '';
          const b = bmi(d[hid], d[wid]);
          read.replaceChildren();
          if (b != null) {
            const cat = bmiCat(b);
            const pos = Math.max(0, Math.min(100, (b - 15) / 25 * 100));
            read.append(
              h('div', { class: 'bmi-top' }, h('strong', { class: 'bmi-n' }, b.toFixed(1)), h('span', { class: 'bmi-u' }, 'BMI'), h('span', { class: 'pill ' + (cat === 'Healthy' ? 'good' : 'watch') }, cat)),
              h('div', { class: 'bmi-scale' }, h('i', { class: 'seg u' }), h('i', { class: 'seg h' }), h('i', { class: 'seg o' }), h('i', { class: 'seg b' }), h('b', { class: 'mark', style: { left: pos + '%' } })));
          } else read.append(h('p', { class: 'hint' }, 'BMI appears here once both are entered.'));
        };
        api.focus = () => hi.focus({ preventScroll: true });
        break;
      }
      case 'date': {
        const inp = h('input', { class: 'date-input', type: 'date' });
        inp.addEventListener('change', () => live(f.id, inp.value || null));
        put(pad, h('div', { class: 'date-row' }, inp, f.noToday ? null : h('button', { type: 'button', class: 'chip', onclick: () => commit(f.id, localDate()) }, 'Today')), h('div', { class: 'q-foot' }, skipBtn(f), nextBtn(f)));
        api.sync = () => { inp.value = d[f.id] || ''; };
        break;
      }
      case 'now': {
        const out = h('div', { class: 'now-out' });
        const btn = h('button', { type: 'button', class: 'btn primary', onclick: () => commit(f.id, new Date().toISOString()) }, 'Record the time now');
        const clear = h('button', { type: 'button', class: 'btn quiet', onclick: () => live(f.id, null) }, 'Clear');
        put(pad, out, h('div', { class: 'q-foot' }, skipBtn(f), clear, btn));
        api.sync = () => { out.textContent = d[f.id] ? 'Recorded at ' + hhmm(d[f.id]) : 'Tap when it happens. Turnaround times are worked out for you.'; };
        break;
      }
      case 'text': {
        const inp = h('input', { class: 'txt-input', type: 'text', placeholder: f.placeholder || '', autocomplete: 'off', enterkeyhint: 'next' });
        if (f.suggest && ctx.suggest) {
          const id = `dl-${ns}-${f.id}`; inp.setAttribute('list', id);
          put(pad, h('datalist', { id }, (ctx.suggest(f.suggest) || []).map(v => h('option', { value: v }))));
        }
        inp.addEventListener('input', () => live(f.id, inp.value.trim() || null));
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finishCard(f); } });
        put(pad, inp, hintEl(f), h('div', { class: 'q-foot' }, skipBtn(f), nextBtn(f)));
        api.sync = () => { if (document.activeElement !== inp) inp.value = d[f.id] || ''; };
        api.focus = () => inp.focus({ preventScroll: true });
        break;
      }
      case 'select': {
        const sel = h('select', { class: 'sel' }, f.opts.map(o => h('option', { value: o }, o)));
        sel.addEventListener('change', () => live(f.id, sel.value));
        put(pad, sel, h('div', { class: 'q-foot' }, skipBtn(f), nextBtn(f)));
        api.sync = () => { sel.value = d[f.id] || f.opts[0]; };
        break;
      }
      case 'contact': {
        const nm = h('input', { class: 'txt-input', type: 'text', placeholder: 'Full name (optional)', autocomplete: 'off' });
        const ph = h('input', { class: 'txt-input', type: 'tel', placeholder: 'Phone, e.g. 0712 345 678', autocomplete: 'off', inputmode: 'tel' });
        const upd = () => {
          const c = { name: nm.value.trim() || null, phone: ph.value.trim() || null };
          d._contact = c.name || c.phone ? c : null; touch(); st.pinned = f.id;
          warn.hidden = !(c.phone && !PHONE_OK(c.phone)); warn.textContent = 'That does not look like a Kenyan mobile number. Check it, or continue anyway.';
          refresh(false);
        };
        nm.addEventListener('input', upd); ph.addEventListener('input', upd);
        put(pad, nm, ph, warn, hintEl(f), h('div', { class: 'q-foot' }, skipBtn(f), nextBtn(f)));
        api.sync = () => { if (document.activeElement !== nm) nm.value = d._contact?.name || ''; if (document.activeElement !== ph) ph.value = d._contact?.phone || ''; };
        api.focus = () => nm.focus({ preventScroll: true });
        break;
      }
    }
    api.warn = warn;
    return { pad, api };
  }

  // ───────── summary text for a collapsed card ─────────
  function summary(f) {
    if (skipped.has(f.id) && !isAnswered(f, d)) return 'Skipped';
    if (!isAnswered(f, d)) return '';
    switch (f.type) {
      case 'hw': { const b = bmi(d[f.ids[0]], d[f.ids[1]]); return [d[f.ids[0]] && d[f.ids[0]] + ' cm', d[f.ids[1]] && d[f.ids[1]] + ' kg', b && 'BMI ' + b.toFixed(1)].filter(Boolean).join(' · '); }
      case 'num': return typeof d[f.id] === 'number' ? `${d[f.id]}${f.unit ? ' ' + f.unit : ''}` : d[f.id];
      case 'multi': return d[f.id].join(', ');
      case 'date': return fmtDate(d[f.id]);
      case 'now': return hhmm(d[f.id]);
      case 'contact': return [d._contact.name, d._contact.phone].filter(Boolean).join(' · ');
      default: return String(d[f.id]);
    }
  }

  // ───────── build all cards once ─────────
  let lastGroup = null;
  for (const f of schema) {
    if (f.group && f.group !== lastGroup) {
      const g = h('h3', { class: 'q-group' }, f.group); groups.set(f.group, g); list.append(g); lastGroup = f.group;
    }
    const { pad, api } = build(f);
    const val = h('span', { class: 'q-val' });
    const head = h('button', { type: 'button', class: 'q-head', onclick: () => { const open = cards.get(f.id).el.classList.contains('open'); st.pinned = null; st.openId = open ? '' : f.id; refresh(!open); } },
      h('span', { class: 'tick', 'aria-hidden': 'true' }, s('svg', { viewBox: '0 0 24 24' }, s('path', { d: 'M5 12.5l4.5 4.5L19 7.5' }))),
      h('span', { class: 'q-label' }, f.label, f.req ? h('em', { class: 'req' }, 'needed') : null),
      val);
    const body = h('div', { class: 'q-body' }, h('div', { class: 'q-clip' }, pad));
    const el = h('section', { class: 'q', 'data-id': f.id }, head, body);
    list.append(el);
    cards.set(f.id, { el, f, api, val, group: f.group, body });
  }

  // ───────── refresh ─────────
  function refresh(scroll = false) {
    let first = null, vis = 0, done = 0;
    const need = []; let block = null;
    for (const f of schema) {
      const c = cards.get(f.id);
      const show = !f.show || !!f.show(d, ctx);
      if (!show && c.visible !== false) {
        // a hidden question must not keep a stale answer
        if (f.type === 'hw') f.ids.forEach(i => { d[i] = null; }); else if (f.type === 'contact') d._contact = null; else d[f.id] = null;
        skipped.delete(f.id);
      }
      if (show && c.visible === false && st.mounted) c.el.classList.add('enter');
      c.visible = show; c.el.hidden = !show;
      if (!show) continue;
      vis++;
      const ans = isAnswered(f, d), res = ans || skipped.has(f.id);
      if (res) done++;
      if (!res && !first) first = f.id;
      if (f.req && !ans) need.push(f.label);
      if (f.block && ans && f.block(d[f.id])) block = f.block(d[f.id]);
      c.el.classList.toggle('done', ans);
      c.el.classList.toggle('skipped', !ans && skipped.has(f.id));
      c.val.textContent = summary(f);
      c.api.sync();
      // soft warning
      if (f.warn && c.api.warn) {
        const msg = ans ? f.warn(d[f.id], d, ctx) : null;
        c.api.warn.hidden = !msg; if (msg) c.api.warn.textContent = msg;
        c.el.classList.toggle('has-warn', !!msg);
      }
      if (f.block) { c.el.classList.toggle('blocked', !!(ans && f.block(d[f.id]))); }
    }
    for (const [name, g] of groups) g.hidden = ![...cards.values()].some(c => c.group === name && c.visible);
    const open = st.pinned || (st.openId !== null ? (st.openId || null) : (autoAdvance ? first : null));
    for (const [id, c] of cards) c.el.classList.toggle('open', id === open);
    if (open !== st.lastOpen) {
      st.lastOpen = open;
      if (open && scroll && st.mounted) {
        const c = cards.get(open);
        setTimeout(() => { c.el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); c.api.focus(); }, 140);
      }
    }
    if (banner) {
      const bs = banner(d, ctx) || [];
      bannerEl.replaceChildren(...bs.map(b => h('div', { class: 'banner ' + b.level, role: 'status' }, b.text)));
    }
    st.mounted = true;
    onChange && onChange({ d, need, block, total: vis, done });
  }

  refresh(false);
  const firstCard = [...cards.values()].find(c => c.el.classList.contains('open'));
  return {
    get data() { return d; },
    refresh: () => refresh(false),
    focusFirst() { firstCard && firstCard.api.focus(); },
    openFirstUnresolved() { st.openId = null; refresh(true); },
  };
}
