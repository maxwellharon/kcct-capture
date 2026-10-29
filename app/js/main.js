// App shell, router and screens.
import { CONFIG } from './config.js';
import * as db from './db.js';
import { h, s, $, store, toast, download, csvCell, localDate, fmtDate, fmtDay, mmss, hhmm, bmi, bmiCat, daysBetween } from './util.js';
import { INTAKE, STAGES, STAGE_ORDER, FOLLOW, dictionary } from './schema.js';
import { mountForm } from './form.js';
import { makePid, nextSeq, commitSeq, pidValid } from './pid.js';
import { analyze, attention, riskFlags, finalResult, toCsv } from './analytics.js';
import { hbar, columns, rateBars, funnel, tile } from './charts.js';
import { makeDemo } from './demo.js';

const view = $('#view'), tabsEl = $('#tabs');
let current = null, installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });

// ───────────── tiny icon set ─────────────
const ic = d => s('svg', { viewBox: '0 0 24 24', class: 'ic', 'aria-hidden': 'true' }, s('path', { d }));
const ICON = {
  capture: 'M12 5v14M5 12h14', patients: 'M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1a3 3 0 0 0-2-2.8M16 5.2a3 3 0 0 1 0 5.6',
  analytics: 'M5 20V11M12 20V4M19 20v-6', settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4', back: 'M15 5l-7 7 7 7', close: 'M6 6l12 12M18 6L6 18',
  copy: 'M9 9h10v10H9zM5 15V5h10', warn: 'M12 4l9 16H3zM12 10v4M12 17v.5', good: 'M5 12.5l4.5 4.5L19 7.5', info: 'M12 8v.5M12 11v5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
  alert: 'M12 3l9 16H3zM12 9v5M12 16.5v.5', phone: 'M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2',
};
const TABS = [['capture', 'Capture'], ['patients', 'Patients'], ['analytics', 'AI Analytics'], ['settings', 'Settings']];
TABS.forEach(([k, l]) => tabsEl.append(h('a', { href: '#/' + k, 'data-tab': k, class: 'tab' }, ic(ICON[k]), h('span', {}, l))));

// ───────────── setup (per phone) ─────────────
const getSetup = () => store.get('kcct.setup');
const needSetup = () => { const u = getSetup(); return !u || !u.site || !u.siteCode || !u.staff; };

// ───────────── shared bits ─────────────
function syncPill() {
  const st = db.getState(), local = db.getMode() === 'local';
  let cls = 'good', txt = 'All saved';
  if (local) { cls = 'demo'; txt = 'Demo mode'; }
  else if (!st.online) { cls = 'watch'; txt = st.pending ? `Offline, ${st.pending} waiting` : 'Offline'; }
  else if (st.pending) { cls = 'watch'; txt = `Syncing ${st.pending}`; }
  return h('span', { class: 'sync ' + cls }, h('i', {}), txt);
}
const topbar = (title, { back, right } = {}) => h('header', { class: 'topbar' },
  back ? h('a', { class: 'icon-btn', href: back, 'aria-label': 'Back' }, ic(ICON.back)) : h('img', { class: 'brand-mark', src: 'assets/logo-mark.svg', alt: '' }),
  h('h1', {}, title), h('div', { class: 'grow' }), right || syncPill());
const pill = (t, cls = '') => h('span', { class: 'pill ' + cls }, t);
const glyph = lvl => ic(lvl === 'alert' ? ICON.alert : lvl === 'watch' ? ICON.warn : lvl === 'good' ? ICON.good : ICON.info);
const LEVEL = { alert: 'Urgent', watch: 'Watch', info: 'Insight', good: 'On track' };

// Where is she in the cascade?
function stageInfo(p, k) {
  const g = p[k] || {};
  switch (k) {
    case 'test': return g.result ? { done: true, text: g.result === 'Invalid' && g.repeat_result ? `Invalid, repeat ${g.repeat_result.toLowerCase()}` : g.result } : { text: 'Not recorded' };
    case 'colpo': return g.done === 'Yes' ? { done: true, text: g.impression || 'Done' } : g.done === 'No' ? { done: true, text: 'Not done' } : { text: 'Not recorded' };
    case 'biopsy': return g.done === 'Yes' ? { done: true, text: g.histology || 'Taken' } : g.done === 'No' ? { done: true, text: 'Not taken' } : { text: 'Not recorded' };
    case 'treat': return g.procedure && g.procedure !== 'None' ? { done: true, text: g.procedure } : g.eligible ? { done: true, text: g.eligible === 'Eligible' ? (g.decision || 'Eligible') : g.eligible } : { text: 'Not recorded' };
    case 'referral': return g.required === 'Yes' ? { done: true, text: g.attended === 'Yes' ? 'Attended' : 'Referred' } : g.required === 'No' ? { done: true, text: 'Not needed' } : { text: 'Not recorded' };
    case 'exp': return g._at ? { done: true, text: 'Recorded' } : { text: 'Optional' };
    case 'close': return g.case_status ? { done: true, text: g.case_status } : { text: 'Optional' };
  }
}
function nextStage(p) {
  const fr = finalResult(p), c = p.colpo || {}, b = p.biopsy || {};
  if (!(p.test && p.test.result)) return 'test';
  if (p.test.result === 'Invalid' && p.test.repeat_done !== 'Yes') return 'test';
  if (fr === 'Positive' && !c.done) return 'colpo';
  if (c.done === 'Yes' && ['Biopsy'].includes(c.recommend) && !b.done) return 'biopsy';
  if (fr === 'Positive' && c.done === 'Yes' && c.impression !== 'Normal' && !(p.treat && p.treat.eligible) && c.impression !== 'Suspected cancer') return 'treat';
  if ((c.impression === 'Suspected cancer' || b.histology === 'Invasive carcinoma') && !p.referral) return 'referral';
  return null;
}
function statusLine(p) {
  const t = stageInfo(p, 'test');
  if (!t.done) return 'Awaiting E6/E7 result';
  const parts = ['E6/E7 ' + t.text.toLowerCase()];
  for (const k of ['colpo', 'biopsy', 'treat', 'referral']) { const i = stageInfo(p, k); if (i.done && (k !== 'referral' || p.referral.required === 'Yes')) parts.push(STAGES[k].short + ': ' + i.text); }
  return parts.join('  ›  ');
}

// ═════════════════════════════ LOGIN ═════════════════════════════
function loginView() {
  const err = h('p', { class: 'form-err', hidden: true, role: 'alert' });
  const email = h('input', { class: 'txt-input', type: 'email', autocomplete: 'username', placeholder: 'Work email', required: true });
  const pw = h('input', { class: 'txt-input', type: 'password', autocomplete: 'current-password', placeholder: 'Password', required: true });
  const btn = h('button', { class: 'btn primary wide', type: 'submit' }, 'Sign in');
  const form = h('form', { class: 'login-card', onsubmit: async e => {
    e.preventDefault(); err.hidden = true; btn.disabled = true; btn.textContent = 'Signing in';
    try { await db.signIn(email.value, pw.value); location.hash = '#/capture'; route(); }
    catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Sign in'; }
  } },
    h('img', { src: 'assets/logo-horizontal.svg', class: 'login-logo', alt: 'Kenya Cervical Cancer Trust' }),
    h('h1', {}, 'Screening data capture'), h('p', { class: 'sub' }, 'Sign in with the account your administrator created for you.'),
    email, pw, err, btn, h('p', { class: 'fine' }, 'You need internet once to sign in. After that the app works offline at camps and syncs when a signal returns.'));
  return { el: h('div', { class: 'center-screen' }, form), noTabs: true };
}

// ═════════════════════════════ SETUP ═════════════════════════════
function setupView() {
  const cur = getSetup() || {};
  const v = { site: cur.site || '', siteCode: cur.siteCode || '', county: cur.county || 'Narok', setting: cur.setting || 'Outreach', staff: cur.staff || '' };
  const err = h('p', { class: 'form-err', hidden: true });
  const field = (label, ctrl, hint) => h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), ctrl, hint ? h('small', {}, hint) : null);
  const site = h('input', { class: 'txt-input', value: v.site, placeholder: 'e.g. Ngiro Talek HC', autocomplete: 'off' });
  const code = h('input', { class: 'txt-input', value: v.siteCode, placeholder: 'NGT', maxlength: 4, autocapitalize: 'characters', autocomplete: 'off' });
  const staff = h('input', { class: 'txt-input', value: v.staff, placeholder: 'Your initials, e.g. AW', maxlength: 6, autocapitalize: 'characters', autocomplete: 'off' });
  const county = h('select', { class: 'sel' }, INTAKE.find(f => f.id === 'county').opts.map(c => h('option', { value: c, selected: c === v.county }, c)));
  const setting = h('div', { class: 'chips row' }, ['Outreach', 'Facility', 'Referral clinic'].map(o => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(o === v.setting), onclick: e => { v.setting = o; [...e.target.parentNode.children].forEach(b => b.setAttribute('aria-pressed', String(b === e.target))); } }, o)));
  const el = h('div', { class: 'page narrow' },
    topbar('This phone’s setup', { back: needSetup() ? null : '#/settings' }),
    h('p', { class: 'lead' }, 'Set this once per camp. Every form then fills in site, county, date and your ID for you.'),
    field('Site or camp name', site), field('Site code (3–4 letters)', code, 'Goes into every participant ID.'), field('County', county), field('Setting', setting), field('Your staff ID', staff),
    err, h('button', { class: 'btn primary wide', onclick: () => {
      const u = { site: site.value.trim(), siteCode: code.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''), county: county.value, setting: v.setting, staff: staff.value.trim().toUpperCase() };
      if (!u.site || u.siteCode.length < 2 || !u.staff) { err.textContent = 'Fill in the site name, a code of at least 2 letters, and your staff ID.'; err.hidden = false; return; }
      store.set('kcct.setup', u); toast('Setup saved'); location.hash = '#/capture';
    } }, 'Save and start'));
  return { el, noTabs: needSetup() };
}

// ═════════════════════════════ CAPTURE ═════════════════════════════
function captureView() {
  if (needSetup()) { location.hash = '#/setup'; return setupView(); }
  const setup = getSetup();
  let seq = nextSeq(), pid = makePid(setup.siteCode, seq);
  while (db.get(pid)) { seq++; pid = makePid(setup.siteCode, seq); }
  let startedAt = null, timerId = null, last = { need: [], block: null, total: 1, done: 0 };
  const C = 2 * Math.PI * 19;

  const ringArc = s('circle', { cx: 22, cy: 22, r: 19, class: 'ring-arc', 'stroke-dasharray': C, 'stroke-dashoffset': C });
  const ringTxt = h('span', { class: 'ring-t' }, '0:00');
  const ring = h('div', { class: 'ring', title: `Target ${mmss(CONFIG.TARGET_SECONDS)}`, 'aria-label': 'Elapsed time' },
    s('svg', { viewBox: '0 0 44 44' }, s('circle', { cx: 22, cy: 22, r: 19, class: 'ring-bg' }), ringArc), ringTxt);
  const tick = () => {
    const sec = startedAt ? (Date.now() - startedAt) / 1000 : 0;
    ringTxt.textContent = mmss(sec);
    ringArc.setAttribute('stroke-dashoffset', C * (1 - Math.min(1, sec / CONFIG.TARGET_SECONDS)));
    ring.className = 'ring ' + (!startedAt ? '' : sec <= CONFIG.FAST_SECONDS ? 'fast' : sec <= CONFIG.TARGET_SECONDS ? 'ok' : 'slow');
  };
  const pidEl = h('button', { class: 'pid', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(pid); toast('ID copied'); }, title: 'Tap to copy' }, pid);
  const prog = h('i', {});
  const cancel = h('button', { class: 'icon-btn cancel', hidden: true, 'aria-label': 'Discard this form', onclick: () => { if (confirm('Discard this form? Nothing has been saved.')) { document.body.classList.remove('form-mode'); route(); } } }, ic(ICON.close));
  const head = h('header', { class: 'cap-head' }, h('div', { class: 'cap-row' }, h('div', { class: 'cap-id' }, h('span', { class: 'cap-site' }, `${setup.site}`, h('a', { href: '#/setup', class: 'edit-link' }, 'change')), pidEl), ring, cancel), h('div', { class: 'ribbon' }, prog));

  const saveHint = h('span', { class: 'save-hint' });
  const saveBtn = h('button', { class: 'btn primary save', disabled: true, onclick: save }, 'Save patient');
  const bar = h('div', { class: 'savebar' }, saveHint, saveBtn);
  const formRoot = h('div', { class: 'form-root' });
  const subs = () => [...new Set(db.all().map(p => p.intake && p.intake.subcounty).filter(Boolean))].slice(0, 40);

  const form = mountForm(formRoot, {
    schema: INTAKE, ns: 'intake', ctx: { setup, ageRange: CONFIG.AGE_RANGE, suggest: subs }, isNew: true,
    onFirstTouch: () => { startedAt = Date.now(); timerId = setInterval(tick, 250); tick(); document.body.classList.add('form-mode'); cancel.hidden = false; },
    onChange: x => {
      last = x; prog.style.width = (x.total ? x.done / x.total * 100 : 0) + '%';
      const blocked = !!x.block, missing = x.need.length;
      saveBtn.disabled = blocked || missing > 0;
      saveHint.textContent = blocked ? x.block : missing ? 'Still needed: ' + x.need.slice(0, 3).join(', ') + (missing > 3 ? '…' : '') : `${x.done} of ${x.total} answered`;
      saveHint.className = 'save-hint' + (blocked ? ' err' : '');
    },
  });

  function save() {
    const d = form.data; const secs = startedAt ? Math.round((Date.now() - startedAt) / 1000) : null;
    clearInterval(timerId);
    const intake = {}; Object.keys(d).forEach(k => { if (k !== '_contact' && d[k] != null) intake[k] = d[k]; });
    const b = bmi(d.height_cm, d.weight_kg); if (b != null) { intake.bmi = b; intake.bmi_cat = bmiCat(b); }
    intake.fill_seconds = secs; intake.completeness = Math.round(last.done / last.total * 100);
    const rec = { pid, date: localDate(), created: new Date().toISOString(), site: setup.site, site_code: setup.siteCode, setting: setup.setting, staff: setup.staff, schema: 1, intake };
    db.save(pid, rec).catch(() => toast('Could not save. Try again.', 'err'));
    if (d._contact) db.saveContact(pid, d._contact);
    commitSeq(seq);
    document.body.classList.remove('form-mode');
    done(secs, b);
  }
  function done(secs, b) {
    const speed = secs <= CONFIG.FAST_SECONDS ? 'fast' : secs <= CONFIG.TARGET_SECONDS ? 'ok' : 'slow';
    const note = speed === 'slow' ? `Target is ${mmss(CONFIG.TARGET_SECONDS)}` : speed === 'fast' ? 'Under 30 seconds' : 'Inside the target';
    const ov = h('div', { class: 'done-overlay', role: 'dialog', 'aria-label': 'Saved' },
      h('div', { class: 'done-card' },
        s('svg', { viewBox: '0 0 64 64', class: 'done-check' }, s('circle', { cx: 32, cy: 32, r: 28 }), s('path', { d: 'M19 33l9 9 17-19' })),
        h('h2', {}, 'Saved'), h('p', { class: 'done-pid' }, pid),
        h('div', { class: 'done-stats' }, h('span', { class: 'pill ' + (speed === 'slow' ? 'watch' : 'good') }, `${mmss(secs || 0)} · ${note}`), b != null ? h('span', { class: 'pill' }, `BMI ${b.toFixed(1)} ${bmiCat(b)}`) : null),
        h('p', { class: 'fine' }, db.getMode() === 'local' ? 'Saved on this phone (demo mode).' : db.getState().online ? 'Saved and syncing.' : 'Saved on this phone. It will sync when you are back online.'),
        h('button', { class: 'btn primary wide', onclick: () => { ov.remove(); route(); } }, 'Next patient'),
        h('a', { class: 'btn quiet wide', href: `#/p/${pid}/test`, onclick: () => ov.remove() }, 'Record E6/E7 result now')));
    document.body.append(ov);
  }
  tick();
  return { el: h('div', { class: 'page cap capture' }, head, formRoot, bar), destroy: () => { clearInterval(timerId); document.body.classList.remove('form-mode'); }, full: true };
}

// ═════════════════════════════ PATIENTS ═════════════════════════════
function patientsView() {
  let q = '', filter = 'all', shown = 40;
  const list = h('div', { class: 'plist' });
  const FILTERS = [['all', 'All'], ['attn', 'Needs attention'], ['pos', 'Positive'], ['wait', 'No result yet'], ['hist', 'Histology pending']];
  const chipRow = h('div', { class: 'chips scroll' }, FILTERS.map(([k, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(k === 'all'), 'data-k': k, onclick: e => { filter = k; shown = 40; [...chipRow.children].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k))); draw(); } }, l)));
  const search = h('input', { class: 'txt-input search', type: 'search', placeholder: 'Find by ID, site or staff', oninput: e => { q = e.target.value.trim().toUpperCase(); shown = 40; draw(); } });
  function draw() {
    let rows = db.all().filter(p => p.intake).sort((a, b) => (b.created || '').localeCompare(a.created || ''));
    const total = rows.length;
    if (q) rows = rows.filter(p => (p.pid + ' ' + p.site + ' ' + p.staff).toUpperCase().includes(q));
    if (filter === 'attn') rows = rows.filter(p => attention(p).length);
    if (filter === 'pos') rows = rows.filter(p => finalResult(p) === 'Positive');
    if (filter === 'wait') rows = rows.filter(p => !(p.test && p.test.result));
    if (filter === 'hist') rows = rows.filter(p => p.biopsy && p.biopsy.histology === 'Pending');
    list.replaceChildren();
    if (!rows.length) { list.append(h('div', { class: 'empty' }, h('h3', {}, total ? 'No one matches' : 'No patients yet'), h('p', {}, total ? 'Try a different filter or search.' : 'Registered patients appear here. Start with Capture.'), total ? null : h('a', { class: 'btn primary', href: '#/capture' }, 'Register the first patient'))); return; }
    rows.slice(0, shown).forEach(p => {
      const at = attention(p); const fr = finalResult(p);
      list.append(h('a', { class: 'prow', href: '#/p/' + p.pid },
        h('div', { class: 'prow-top' }, h('strong', { class: 'prow-id' }, p.pid), p._pending ? pill('Syncing', 'watch') : null, fr ? pill(fr, fr === 'Positive' ? 'pos' : fr === 'Invalid' ? 'watch' : 'good') : pill('No result', '')),
        h('div', { class: 'prow-sub' }, `${p.intake.age ?? '–'} years · ${p.site} · ${fmtDate(p.date)}`),
        h('div', { class: 'prow-status' }, statusLine(p)),
        at.length ? h('div', { class: 'prow-attn ' + at[0].level }, glyph(at[0].level), at[0].reason, at.length > 1 ? ` +${at.length - 1} more` : '') : null));
    });
    if (rows.length > shown) list.append(h('button', { class: 'btn quiet wide', onclick: () => { shown += 40; draw(); } }, `Show more (${rows.length - shown} left)`));
  }
  draw();
  return { el: h('div', { class: 'page' }, topbar('Patients'), search, chipRow, list), onData: draw };
}

// ═════════════════════════════ PATIENT ═════════════════════════════
function patientView(pid) {
  const el = h('div', { class: 'page narrow' });
  async function draw() {
    const p = db.get(pid);
    if (!p) { el.replaceChildren(topbar('Patient', { back: '#/patients' }), h('div', { class: 'empty' }, h('h3', {}, 'Record not found'), h('p', {}, db.getState().fromCache ? 'It may not have synced to this phone yet.' : 'Check the ID. The last digit is a check digit.'), pidValid(pid) ? null : pill('ID check digit does not match', 'watch'))); return; }
    const flags = riskFlags(p), at = attention(p), nxt = nextStage(p), I = p.intake;
    const fr = finalResult(p);
    const tiles = STAGE_ORDER.map(k => { const i = stageInfo(p, k); return h('a', { class: 'stage-tile' + (i.done ? ' done' : '') + (k === nxt ? ' next' : ''), href: `#/p/${pid}/${k}` }, h('span', { class: 'st-t' }, STAGES[k].title), h('span', { class: 'st-v' }, i.text), k === nxt ? h('em', {}, 'Next step') : null); });
    const fu = Object.entries(p.follow || {}).sort();
    const contactBox = h('div', { class: 'card contact' }, h('h3', {}, 'Private contact'), h('p', { class: 'fine' }, 'Name and phone live in a separate register.'));
    const revealBtn = h('button', { class: 'btn', onclick: async () => { const c = await db.getContact(pid); revealBtn.remove(); contactBox.append(c && (c.name || c.phone) ? h('div', { class: 'contact-row' }, h('strong', {}, c.name || 'No name'), c.phone ? h('a', { class: 'btn primary', href: 'tel:' + c.phone.replace(/\s/g, '') }, ic(ICON.phone), c.phone) : h('span', {}, 'No phone')) : h('p', {}, 'No contact saved, or your account cannot view the register.')); } }, 'Show contact');
    contactBox.append(revealBtn);
    el.replaceChildren(
      topbar(pid.split('-').slice(1, 3).join(' ') , { back: '#/patients', right: h('button', { class: 'icon-btn', 'aria-label': 'Copy ID', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(pid); toast('ID copied'); } }, ic(ICON.copy)) }),
      h('div', { class: 'pid-big' }, pid),
      h('div', { class: 'chips static' }, pill(`${I.age ?? '–'} years`), pill(p.site), pill(fmtDate(p.date)), I.bmi ? pill(`BMI ${I.bmi} ${I.bmi_cat}`) : null, fr ? pill('E6/E7 ' + fr, fr === 'Positive' ? 'pos' : fr === 'Invalid' ? 'watch' : 'good') : null, flags.map(f => pill(f, 'flag'))),
      at.length ? h('div', { class: 'card attn' }, h('h3', {}, 'Needs attention'), at.map(a => h('div', { class: 'attn-row ' + a.level }, glyph(a.level), h('span', {}, a.reason)))) : null,
      h('h2', { class: 'sec' }, 'Care pathway'), h('div', { class: 'stage-grid' }, tiles),
      h('h2', { class: 'sec' }, 'Follow-up visits'),
      fu.length ? h('div', { class: 'card flist' }, fu.map(([k, v]) => h('a', { href: `#/p/${pid}/follow/${k}`, class: 'frow' }, h('strong', {}, 'Visit ' + k.slice(1)), h('span', {}, v.status || '–'), h('small', {}, fmtDate(v.actual || v.scheduled))))) : h('p', { class: 'fine' }, 'No visits recorded yet.'),
      h('a', { class: 'btn wide', href: `#/p/${pid}/follow/v${fu.length + 1}` }, 'Add follow-up visit'),
      contactBox,
      h('a', { class: 'btn quiet wide', href: `#/p/${pid}/intake` }, 'Review or correct intake answers'),
      h('p', { class: 'fine' }, `Captured by ${p.staff} at ${p.site}, ${I.fill_seconds != null ? mmss(I.fill_seconds) + ' to complete, ' : ''}${I.completeness ?? '–'}% answered.`));
  }
  draw();
  return { el, onData: draw };
}

// ═════════════════════════════ STAGE / EDIT FORM ═════════════════════════════
function stageView(pid, key, sub) {
  const p = db.get(pid);
  const isIntake = key === 'intake', isFollow = key === 'follow';
  const spec = isIntake ? { title: 'Intake answers', fields: INTAKE } : isFollow ? FOLLOW : STAGES[key];
  if (!p || !spec) { location.hash = '#/patients'; return { el: h('div') }; }
  const existing = isIntake ? p.intake : isFollow ? (p.follow || {})[sub] : p[key];
  const root = h('div', { class: 'form-root' });
  const saveBtn = h('button', { class: 'btn primary save', disabled: true }, 'Save');
  const hint = h('span', { class: 'save-hint' });
  const bar = h('div', { class: 'savebar' }, hint, saveBtn);
  const ctx = { p, setup: getSetup() || {}, ageRange: CONFIG.AGE_RANGE, suggest: () => [] };
  let data = { ...(existing || {}) };
  const form = mountForm(root, {
    schema: spec.fields, ns: isIntake ? 'intake' : key, ctx, data, isNew: !existing, autoAdvance: !existing, banner: spec.banner,
    onChange: x => { saveBtn.disabled = !!x.block || x.need.length > 0; hint.textContent = x.block || (x.need.length ? 'Still needed: ' + x.need.slice(0, 2).join(', ') : `${x.done} of ${x.total} answered`); hint.className = 'save-hint' + (x.block ? ' err' : ''); },
  });
  if (isIntake) db.getContact(pid).then(c => { if (c && !form.data._contact) { form.data._contact = { name: c.name, phone: c.phone }; form.refresh(); } });
  saveBtn.onclick = () => {
    const d = form.data; const out = {}; Object.keys(d).forEach(k => { if (k !== '_contact') out[k] = d[k]; });
    if (isIntake) { const b = bmi(d.height_cm, d.weight_kg); out.bmi = b; out.bmi_cat = bmiCat(b); if (d._contact) db.saveContact(pid, d._contact); db.save(pid, { intake: out }); }
    else if (isFollow) db.save(pid, { follow: { [sub]: { ...out, _at: (existing && existing._at) || new Date().toISOString() } } });
    else db.save(pid, { [key]: { ...out, _at: (existing && existing._at) || new Date().toISOString() } });
    toast('Saved'); location.hash = '#/p/' + pid;
  };
  const title = isFollow ? `Follow-up visit ${sub.slice(1)}` : spec.title;
  return { el: h('div', { class: 'page cap' }, topbar(title, { back: '#/p/' + pid, right: h('span', { class: 'pid small' }, pid.split('-').slice(1, 3).join(' ')) }), root, bar), noTabs: true, full: true };
}

// ═════════════════════════════ ANALYTICS ═════════════════════════════
function analyticsView() {
  let period = 'all', site = 'all';
  const body = h('div', { class: 'an-body' });
  const periods = [['all', 'All time'], ['30', '30 days'], ['7', '7 days']];
  const pChips = h('div', { class: 'chips' }, periods.map(([k, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(k === 'all'), 'data-k': k, onclick: e => { period = k; [...pChips.children].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k))); draw(); } }, l)));
  const siteSel = h('select', { class: 'sel compact', onchange: e => { site = e.target.value; draw(); }, 'aria-label': 'Site' });
  const how = h('details', { class: 'how' }, h('summary', {}, 'How the AI analytics work'),
    h('p', {}, 'Everything is calculated on this phone from the records already synced. The engine computes the programme indicators from your draft instrument, compares groups with a standard two-proportion test, looks for gaps and outliers, and writes the findings in plain language. It is a statistical engine, not a chat model, and it does not send patient data anywhere.'),
    h('p', {}, 'Patterns describe your data and are not proof of cause. Clinical decisions follow your protocol.'));
  function draw() {
    const all = db.all().filter(p => p.intake);
    const sites = [...new Map(all.map(p => [p.site_code, p.site])).entries()];
    if (siteSel.options.length !== sites.length + 1) { siteSel.replaceChildren(h('option', { value: 'all' }, 'All sites'), ...sites.map(([c, n]) => h('option', { value: c }, n || c))); siteSel.value = site; }
    let rows = all;
    if (site !== 'all') rows = rows.filter(p => p.site_code === site);
    if (period !== 'all') rows = rows.filter(p => daysBetween(p.date, localDate()) < +period);
    const A = analyze(rows);
    body.replaceChildren();
    if (A.empty) { body.append(h('div', { class: 'empty' }, h('h3', {}, 'No data to analyse yet'), h('p', {}, db.getMode() === 'local' ? 'Register a patient, or load practice data from Settings to see how this page works.' : 'Analysis appears as soon as the first patients are saved.'), h('a', { class: 'btn primary', href: '#/capture' }, 'Register a patient'))); return; }
    const pc = (r, d = 0) => r.v == null ? '–' : (r.v * 100).toFixed(d) + '%';
    const sec = (t, sub, ...kids) => h('section', { class: 'an-sec' }, h('h2', {}, t), sub ? h('p', { class: 'fine' }, sub) : null, ...kids);
    body.append(
      sec('What the data is saying', `Based on ${A.n} patients. Updated as records sync.`, h('div', { class: 'insights' }, A.insights.length ? A.insights.map(i => h('article', { class: 'insight ' + i.level }, h('span', { class: 'in-ic' }, glyph(i.level)), h('div', {}, h('h3', {}, i.title), h('p', {}, i.body), h('span', { class: 'in-tag' }, LEVEL[i.level])))) : h('p', { class: 'fine' }, 'Nothing to flag yet.'))),
      sec('Programme indicators', null, h('div', { class: 'tiles' },
        tile({ label: 'Patients registered', value: A.n, sub: `${A.today} today · ${A.siteCount} site${A.siteCount > 1 ? 's' : ''}` }),
        tile({ label: 'E6/E7 positivity', value: pc(A.positivity, 1), sub: `${A.funnel[2].n} of ${A.positivity.b} valid`, ratio: A.positivity.v }),
        tile({ label: 'Invalid tests', value: pc(A.invalid, 1), sub: `${A.invalid.a} of ${A.invalid.b}`, ratio: A.invalid.v, tone: A.invalid.v > 0.05 ? 'bad' : '' }),
        tile({ label: 'Same-day colposcopy', value: pc(A.colpoSame), sub: `${A.colpoSame.a} of ${A.colpoSame.b} positives`, ratio: A.colpoSame.v }),
        tile({ label: 'Same-day treatment', value: pc(A.treatSame), sub: `${A.treatSame.a} of ${A.treatSame.b} eligible`, ratio: A.treatSame.v }),
        tile({ label: 'CIN2+ yield', value: pc(A.cin2), sub: `${A.cin2.a} of ${A.cin2.b} biopsies · CIN3+ ${pc(A.cin3)}` }),
        tile({ label: 'Referral completion', value: pc(A.referral), sub: `${A.referral.a} of ${A.referral.b} within ${CONFIG.REFERRAL_WINDOW_DAYS} days`, ratio: A.referral.v }),
        tile({ label: 'Follow-up retention', value: pc(A.retention), sub: `${A.retention.a} of ${A.retention.b} due`, ratio: A.retention.v }),
        tile({ label: 'Adverse events', value: pc(A.safety, 1), sub: `${A.safety.a} of ${A.safety.b} procedures` }),
        tile({ label: 'Median intake time', value: A.fill.median != null ? mmss(A.fill.median) : '–', sub: `${A.fill.within75} of ${A.fill.n} within ${mmss(CONFIG.TARGET_SECONDS)}`, ratio: A.fill.n ? A.fill.within75 / A.fill.n : null }),
        tile({ label: 'Sample to result', value: A.tat.sampleToResult != null ? Math.round(A.tat.sampleToResult) + ' min' : '–', sub: `Sample to colposcopy ${A.tat.sampleToColpo != null ? Math.round(A.tat.sampleToColpo) + ' min' : '–'}` }),
        tile({ label: 'Biopsy to histology', value: A.tat.biopsyToHist != null ? A.tat.biopsyToHist.toFixed(0) + ' days' : '–', sub: 'median turnaround' }))),
      sec('Where women drop out of care', 'Each bar is a step in the cascade.', funnel(A.funnel)),
      sec('Registrations per day', 'Last 14 days.', columns(A.days)),
      sec('Positivity by age', null, rateBars(A.ageBands, A.positivity.v)),
      sec('Positivity by HIV status', null, rateBars(A.hivPos, A.positivity.v)),
      sec('Why women had not been screened before', `${pc(A.neverScreened)} had never been screened.`, hbar(A.reasons.map(r => ({ k: r.k, n: r.n })))),
      sec('Work and income', null, h('h3', { class: 'sub-h' }, 'Main daily activity'), hbar(A.emp), h('h3', { class: 'sub-h' }, 'Monthly income (KES)'), hbar(A.income)),
      sec('Body mass index', null, hbar(A.bmiCats)),
      sec('Access', null, h('h3', { class: 'sub-h' }, 'Travel time to a facility'), hbar(A.travel), h('h3', { class: 'sub-h' }, 'How women heard about the camp'), hbar(A.channels)),
      A.sites.length > 1 ? sec('Sites', null, h('div', { class: 'table-wrap' }, h('table', { class: 'sites' }, h('thead', {}, h('tr', {}, ['Site', 'Registered', 'Positivity', 'Invalid'].map(c => h('th', {}, c)))), h('tbody', {}, A.sites.map(x => h('tr', {}, h('td', {}, x.name || x.code), h('td', {}, x.n), h('td', {}, x.valid ? (x.pos / x.valid * 100).toFixed(0) + '%' : '–'), h('td', {}, x.tested ? (x.invalid / x.tested * 100).toFixed(0) + '%' : '–'))))))) : null);
  }
  draw();
  return { el: h('div', { class: 'page wide' }, topbar('AI Analytics'), h('div', { class: 'an-tools' }, pChips, siteSel), how, body), onData: draw };
}

// ═════════════════════════════ SETTINGS ═════════════════════════════
function settingsView() {
  const mode = db.getMode(), st = db.getState(), u = getSetup() || {};
  const row = (t, sub, ...a) => h('div', { class: 'srow' }, h('div', {}, h('strong', {}, t), sub ? h('small', {}, sub) : null), ...a);
  const rows = db.all().filter(p => p.intake);
  const rowsFor = () => rows;
  const el = h('div', { class: 'page narrow' }, topbar('Settings'),
    mode === 'local' ? h('div', { class: 'banner watch' }, 'Demo mode. Data stays on this phone only. Add your Firebase keys in config.js to store data in the cloud (see SETUP.md).') : null,
    st.error ? h('div', { class: 'banner alert' }, st.error) : null,
    h('div', { class: 'card' },
      row('This phone', `${u.site || 'Not set'} · ${u.siteCode || ''} · ${u.county || ''} · ${u.setting || ''} · staff ${u.staff || ''}`, h('a', { class: 'btn', href: '#/setup' }, 'Edit')),
      row('Connection', mode === 'firebase' ? (st.online ? 'Online' : 'Offline. Saving on this phone.') + (st.pending ? ` · ${st.pending} waiting to sync` : ' · everything synced') : 'Demo store on this phone'),
      db.getUser() ? row('Signed in', db.getUser().email, h('button', { class: 'btn', onclick: async () => { await db.signOut(); route(); } }, 'Sign out')) : null,
      installEvt ? row('Install', 'Add to your home screen as an app', h('button', { class: 'btn', onclick: () => { installEvt.prompt(); } }, 'Install')) : null),
    h('h2', { class: 'sec' }, 'Export'),
    h('div', { class: 'card' },
      row('Analysis dataset', `${rows.length} records · no names or phone numbers`, h('button', { class: 'btn', onclick: () => download(`kcct-dataset-${localDate()}.csv`, toCsv(rowsFor(), csvCell)) }, 'Download CSV')),
      row('Data dictionary', 'Every variable, question and allowed value', h('button', { class: 'btn', onclick: () => download('kcct-data-dictionary.csv', dictionary().map(r => r.map(csvCell).join(',')).join('\n')) }, 'Download CSV'))),
    mode === 'local' ? h('div', {}, h('h2', { class: 'sec' }, 'Practice data'), h('div', { class: 'card' },
      row('Load practice data', '170 made-up patients so you can explore analytics', h('button', { class: 'btn', onclick: () => { db.replaceLocal([...db.all().filter(p => !p.demo), ...makeDemo()]); toast('Practice data loaded'); route(); } }, 'Load')),
      row('Remove practice data', 'Your own entries stay', h('button', { class: 'btn', onclick: () => { db.removeDemo(); toast('Practice data removed'); route(); } }, 'Remove')),
      row('Erase everything on this phone', 'Demo mode only', h('button', { class: 'btn danger', onclick: () => { if (confirm('Erase all demo data on this phone?')) { db.wipeLocal(); route(); } } }, 'Erase')))) : null,
    h('p', { class: 'fine center' }, 'KCCT Capture 1.0 · HPV E6/E7 screening data instrument draft 1.0'));
  return { el };
}

// ═════════════════════════════ ROUTER ═════════════════════════════
async function route() {
  if (current && current.destroy) current.destroy();
  const parts = (location.hash || '#/capture').replace(/^#\//, '').split('/');
  const root = parts[0] || 'capture';
  let v;
  if (db.getMode() === 'firebase' && !db.getUser()) v = loginView();
  else if (root === 'setup') v = setupView();
  else if (root === 'patients') v = patientsView();
  else if (root === 'analytics') v = analyticsView();
  else if (root === 'settings') v = settingsView();
  else if (root === 'p' && parts[1]) v = parts[2] ? stageView(parts[1], parts[2], parts[3]) : patientView(parts[1]);
  else v = captureView();
  current = v;
  view.replaceChildren(v.el);
  document.body.classList.toggle('no-tabs', !!v.noTabs);
  document.body.classList.toggle('full', !!v.full);
  $$tabs(root);
  window.scrollTo(0, 0);
}
const $$tabs = root => [...tabsEl.children].forEach(a => a.classList.toggle('active', a.dataset.tab === (root === 'p' ? 'patients' : root === 'setup' ? 'settings' : root)));
window.addEventListener('hashchange', route);
db.subscribe(() => { if (current && current.onData) current.onData(); const sp = document.querySelector('.sync'); if (sp) sp.replaceWith(syncPill()); });

// ═════════════════════════════ BOOT ═════════════════════════════
async function boot() {
  const t0 = Date.now();
  let err = null;
  try { await db.init(); } catch (e) { console.error(e); err = e; }
  const wait = Math.max(0, 1100 - (Date.now() - t0));
  setTimeout(() => { const sp = $('#splash'); sp.classList.add('out'); setTimeout(() => sp.remove(), 500); }, wait);
  if (err) {
    view.replaceChildren(h('div', { class: 'center-screen' }, h('div', { class: 'login-card' }, h('h1', {}, 'Cannot start yet'), h('p', { class: 'sub' }, 'The app could not load Firebase. Connect to the internet once, then reopen it. After the first successful start it works offline.'), h('button', { class: 'btn primary wide', onclick: () => location.reload() }, 'Try again'))));
    document.body.classList.add('no-tabs'); return;
  }
  route();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
window.__kcct = { db, route };
