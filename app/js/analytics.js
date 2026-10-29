// Analytics engine: programme indicators (Appendix 1 of the KCCT draft instrument),
// cascade funnel, distributions, a "needs attention" worklist and plain-language insights.
// It runs on the phone, on the data already synced, so it also works offline.
// The insights are statistical rules (rates, comparisons, outlier checks) – not a language model.
import { CONFIG } from './config.js';
import { median, pct, dayOf, daysBetween, localDate, fmtDate } from './util.js';

const POS = 'Positive', NEG = 'Negative';
export const finalResult = p => {
  const t = p.test || {};
  if (t.result === 'Invalid' && t.repeat_done === 'Yes' && t.repeat_result) return t.repeat_result;
  return t.result || null;
};
const isPos = p => finalResult(p) === POS;
const isValid = p => [POS, NEG].includes(finalResult(p));
const CIN2P = ['CIN2', 'CIN3', 'AIS', 'Invasive carcinoma'];
const CIN3P = ['CIN3', 'AIS', 'Invasive carcinoma'];
const treated = p => p.treat && p.treat.decision === 'Accepted' && p.treat.procedure && p.treat.procedure !== 'None';
const mins = (a, b) => (a && b ? (new Date(b) - new Date(a)) / 6e4 : null);
const lastFollow = p => Object.values(p.follow || {}).filter(Boolean);
const ratio = (a, b) => ({ a, b, v: b ? a / b : null });
const arr = v => (Array.isArray(v) ? v : v ? [v] : []);

export function ageBand(a) { return a == null ? null : a < 30 ? 'Under 30' : a < 40 ? '30–39' : a < 50 ? '40–49' : '50 and over'; }

// two-proportion z (positive = group higher than rest)
function zTest(a1, n1, a2, n2) {
  if (!n1 || !n2) return 0;
  const p1 = a1 / n1, p2 = a2 / n2, p = (a1 + a2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  return se ? (p1 - p2) / se : 0;
}

// ───────── worklist ─────────
export function attention(p) {
  const out = []; const add = (level, reason, since) => out.push({ pid: p.pid, level, reason, since });
  const age = d => (d ? daysBetween(dayOf(d) || d, localDate()) : 0);
  const fr = finalResult(p), t = p.test || {}, c = p.colpo || {}, b = p.biopsy || {}, tr = p.treat || {}, rf = p.referral || {};
  const enrolDays = age(p.date);
  if (!t.result && enrolDays >= 1) add('watch', 'E6/E7 result not recorded', enrolDays);
  if (t.result === 'Invalid' && t.repeat_done !== 'Yes') add('watch', 'Invalid test, no repeat recorded', age(t._at));
  if (fr === POS && !c.done && enrolDays >= 1) add('alert', 'Positive, colposcopy not recorded', enrolDays);
  if (b.done === 'Yes' && b.histology === 'Pending') { const a = age(b.dispatched || b._at); if (a > CONFIG.HISTOLOGY_TAT_DAYS) add('watch', `Histology pending ${a} days`, a); }
  if (CIN2P.includes(b.histology) && !treated(p) && rf.required !== 'Yes') add('alert', `${b.histology} with no treatment or referral`, age(b.hist_date || b._at));
  if ((c.impression === 'Suspected cancer' || b.histology === 'Invasive carcinoma') && rf.required !== 'Yes') add('alert', 'Suspected cancer, no referral recorded', age(c._at || b._at));
  if (rf.required === 'Yes' && rf.attended !== 'Yes') { const a = age(rf.ref_date || rf._at); if (a > CONFIG.REFERRAL_WINDOW_DAYS) add('alert', `Referral not attended after ${a} days`, a); }
  const f = lastFollow(p);
  const due = f.filter(v => v.next_date && v.next_date < localDate());
  if (due.length && !f.some(v => (v.actual || '') > (due[due.length - 1].next_date || ''))) add('watch', 'Follow-up visit overdue', age(due[due.length - 1].next_date));
  if (tr.ae && tr.ae.length && !tr.ae.includes('None') && tr.ae_severity === 'Severe') add('alert', 'Severe adverse event after treatment', age(tr._at));
  return out;
}

export function riskFlags(p) {
  const i = p.intake || {}; const out = [];
  if (i.hiv_status === 'Positive') out.push('HIV positive');
  if (i.hiv_status === 'Unknown') out.push('HIV status unknown');
  if (i.prev_screen === 'No') out.push('Never screened');
  if (arr(i.symptoms).some(s => s !== 'None')) out.push('Has symptoms');
  if (i.pregnant === 'Yes') out.push('Pregnant');
  if (arr(i.chronic_meds).includes('Steroids / immune-suppressing')) out.push('Immune-suppressing medicine');
  if (i.fam_hx === 'Yes') out.push('Family history');
  return out;
}

// ───────── main ─────────
export function analyze(rows) {
  const R = rows.filter(p => p.intake);
  const n = R.length;
  const todayStr = localDate();
  const A = { n, empty: n === 0 };
  if (!n) return A;

  const byDay = new Map(); R.forEach(p => byDay.set(p.date, (byDay.get(p.date) || 0) + 1));
  A.today = byDay.get(todayStr) || 0;
  A.days = [...Array(14)].map((_, k) => { const dt = new Date(); dt.setDate(dt.getDate() - (13 - k)); const key = localDate(dt); return { key, label: dt.getDate(), n: byDay.get(key) || 0 }; });
  A.siteCount = new Set(R.map(p => p.site_code)).size;

  // speed
  const fills = R.map(p => p.intake.fill_seconds).filter(x => x != null);
  A.fill = { median: median(fills), n: fills.length, within75: fills.filter(x => x <= CONFIG.TARGET_SECONDS).length, within30: fills.filter(x => x <= CONFIG.FAST_SECONDS).length, rushed: fills.filter(x => x < 15).length };

  // test cascade
  const tested = R.filter(p => p.test && p.test.result);
  const valid = R.filter(isValid), pos = R.filter(isPos);
  A.positivity = ratio(pos.length, valid.length);
  A.invalid = ratio(tested.filter(p => p.test.result === 'Invalid').length, tested.length);
  const posColpoDone = pos.filter(p => p.colpo && p.colpo.done === 'Yes');
  A.colpo = ratio(posColpoDone.length, pos.length);
  A.colpoSame = ratio(posColpoDone.filter(p => dayOf(p.colpo._at) === p.date).length, pos.length);
  const elig = R.filter(p => p.treat && p.treat.eligible === 'Eligible');
  const trt = elig.filter(treated);
  A.treat = ratio(trt.length, elig.length);
  A.treatSame = ratio(trt.filter(p => dayOf(p.treat._at) === p.date).length, elig.length);
  const evalH = R.filter(p => p.biopsy && p.biopsy.done === 'Yes' && p.biopsy.histology && !['Pending', 'Inadequate', 'Other'].includes(p.biopsy.histology));
  A.cin2 = ratio(evalH.filter(p => CIN2P.includes(p.biopsy.histology)).length, evalH.length);
  A.cin3 = ratio(evalH.filter(p => CIN3P.includes(p.biopsy.histology)).length, evalH.length);
  A.invasive = ratio(evalH.filter(p => p.biopsy.histology === 'Invasive carcinoma').length, evalH.length);
  const refs = R.filter(p => p.referral && p.referral.required === 'Yes');
  const refOk = refs.filter(p => p.referral.attended === 'Yes' && (!p.referral.ref_date || !p.referral.attended_date || daysBetween(p.referral.ref_date, p.referral.attended_date) <= CONFIG.REFERRAL_WINDOW_DAYS));
  A.referral = ratio(refOk.length, refs.length);
  const dueF = pos.filter(p => daysBetween(p.date, todayStr) >= CONFIG.FOLLOWUP_DUE_DAYS);
  A.retention = ratio(dueF.filter(p => lastFollow(p).some(v => ['Attended', 'Telephone'].includes(v.status))).length, dueF.length);
  A.tat = {
    sampleToResult: median(R.map(p => mins(p.test && p.test.t_collect, p.test && p.test.t_result)).filter(x => x != null && x >= 0)),
    sampleToColpo: median(R.map(p => mins(p.test && p.test.t_collect, p.colpo && p.colpo.t_colpo)).filter(x => x != null && x >= 0)),
    biopsyToHist: median(R.filter(p => p.biopsy && p.biopsy.dispatched && p.biopsy.hist_date).map(p => daysBetween(p.biopsy.dispatched, p.biopsy.hist_date))),
  };
  const procs = R.filter(treated);
  const aes = procs.filter(p => arr(p.treat.ae).some(x => x !== 'None'));
  A.safety = ratio(aes.length, procs.length);
  A.severeAe = aes.filter(p => p.treat.ae_severity === 'Severe').length;

  A.funnel = [
    { k: 'Registered', n },
    { k: 'Valid E6/E7 result', n: valid.length },
    { k: 'Positive', n: pos.length },
    { k: 'Colposcopy done', n: R.filter(p => p.colpo && p.colpo.done === 'Yes').length },
    { k: 'Biopsy taken', n: R.filter(p => p.biopsy && p.biopsy.done === 'Yes').length },
    { k: 'Treated', n: procs.length },
    { k: 'Referred', n: refs.length },
    { k: 'Referral attended', n: refs.filter(p => p.referral.attended === 'Yes').length },
  ];

  // distributions
  const countBy = (list, f) => { const m = new Map(); list.forEach(p => arr(f(p)).forEach(v => v != null && m.set(v, (m.get(v) || 0) + 1))); return m; };
  const toRows = (m, order) => { let r = [...m].map(([k, v]) => ({ k, n: v })); r = order ? order.filter(o => m.has(o)).map(o => ({ k: o, n: m.get(o) })) : r.sort((a, b) => b.n - a.n); return r; };
  const posBy = (f, order, minN = 1) => {
    const g = new Map(); valid.forEach(p => { const k = f(p); if (k == null) return; const o = g.get(k) || { n: 0, pos: 0 }; o.n++; if (isPos(p)) o.pos++; g.set(k, o); });
    const keys = order ? order.filter(k => g.has(k)) : [...g.keys()];
    return keys.map(k => ({ k, n: g.get(k).n, pos: g.get(k).pos, rate: g.get(k).pos / g.get(k).n })).filter(x => x.n >= minN);
  };
  const I = p => p.intake;
  A.ageBands = posBy(p => ageBand(I(p).age), ['Under 30', '30–39', '40–49', '50 and over']);
  A.hivPos = posBy(p => I(p).hiv_status, ['Positive', 'Negative', 'Unknown', 'Declined']);
  A.emp = toRows(countBy(R, p => I(p).emp_status));
  A.income = toRows(countBy(R, p => I(p).income), ['No income', 'Under 5,000', '5,000–14,999', '15,000–29,999', '30,000–59,999', '60,000+', 'Declined']);
  A.bmiCats = toRows(countBy(R, p => I(p).bmi_cat), ['Underweight', 'Healthy', 'Overweight', 'Obese']);
  A.reasons = toRows(countBy(R.filter(p => I(p).prev_screen === 'No'), p => I(p).prev_reason));
  A.channels = toRows(countBy(R, p => I(p).heard_via));
  A.travel = toRows(countBy(R, p => I(p).travel_time), ['Under 30 min', '30–60 min', '1–2 hours', 'Over 2 hours']);
  A.neverScreened = ratio(R.filter(p => I(p).prev_screen === 'No').length, R.filter(p => I(p).prev_screen).length);
  A.hivPosShare = ratio(R.filter(p => I(p).hiv_status === 'Positive').length, R.filter(p => I(p).hiv_status).length);
  A.meanAge = R.map(p => I(p).age).filter(Boolean).reduce((a, b) => a + b, 0) / R.filter(p => I(p).age).length;
  A.sites = [...new Set(R.map(p => p.site_code))].map(code => {
    const rs = R.filter(p => p.site_code === code); const t = rs.filter(p => p.test && p.test.result);
    return { code, name: rs[0].site, n: rs.length, tested: t.length, invalid: t.filter(p => p.test.result === 'Invalid').length, valid: rs.filter(isValid).length, pos: rs.filter(isPos).length };
  }).sort((a, b) => b.n - a.n);

  // worklist
  A.work = R.flatMap(attention).sort((a, b) => (a.level === b.level ? b.since - a.since : a.level === 'alert' ? -1 : 1));
  A.insights = insights(R, A, { valid, pos, posBy });
  return A;
}

// ───────── plain-language insights ─────────
function insights(R, A, { valid, pos }) {
  const out = []; const I = p => p.intake;
  const say = (level, title, body) => out.push({ level, title, body });

  // 1. speed
  if (A.fill.n >= 5) {
    const half = Math.floor(R.length / 2);
    const ordered = [...R].filter(p => I(p).fill_seconds != null).sort((a, b) => (a.created || '').localeCompare(b.created || ''));
    const m = A.fill.median;
    let trend = '';
    if (ordered.length >= 20) {
      const a = median(ordered.slice(0, ordered.length >> 1).map(p => I(p).fill_seconds)), b = median(ordered.slice(ordered.length >> 1).map(p => I(p).fill_seconds));
      if (b < a * 0.9) trend = ` The second half is quicker (${Math.round(a)} s then ${Math.round(b)} s), so the team is getting faster.`;
      else if (b > a * 1.1) trend = ` The second half is slower (${Math.round(a)} s then ${Math.round(b)} s). Worth asking whether the form or the queue changed.`;
    }
    say(m <= CONFIG.TARGET_SECONDS ? 'good' : 'watch', `Median intake time is ${Math.round(m)} seconds`,
      `${pct(A.fill.within75, A.fill.n)} of forms finish inside the ${CONFIG.TARGET_SECONDS}-second target and ${pct(A.fill.within30, A.fill.n)} inside ${CONFIG.FAST_SECONDS}.${trend}`);
    if (A.fill.rushed >= 3) say('watch', `${A.fill.rushed} forms took under 15 seconds`, 'That is faster than the questions can be read. Check these were answered, not tapped through.');
  }

  // 2. what is associated with a positive test
  if (valid.length >= 30) {
    const factors = [
      ['HIV-positive', p => I(p).hiv_status === 'Positive'], ['Aged 40 or over', p => I(p).age >= 40], ['Aged under 30', p => I(p).age < 30],
      ['Never screened before', p => I(p).prev_screen === 'No'], ['4 or more lifetime partners', p => I(p).partners === '4 or more'],
      ['First sex before 16', p => typeof I(p).sexual_debut === 'number' && I(p).sexual_debut < 16], ['Five or more pregnancies', p => I(p).gravida === '5+'],
      ['Past TB treatment', p => I(p).tb && !['Never', 'Unsure'].includes(I(p).tb)], ['Tobacco use', p => arr(I(p).substances).includes('Tobacco / smoking')],
      ['Has symptoms', p => arr(I(p).symptoms).some(x => x !== 'None')], ['No personal income', p => I(p).income === 'No income'],
      ['Travels over an hour to a facility', p => ['1–2 hours', 'Over 2 hours'].includes(I(p).travel_time)],
    ];
    const found = [];
    for (const [label, f] of factors) {
      const g = valid.filter(f), o = valid.filter(p => !f(p));
      if (g.length < 8 || o.length < 8) continue;
      const gp = g.filter(isPos).length, op = o.filter(isPos).length;
      const z = zTest(gp, g.length, op, o.length), rr = (gp / g.length) / Math.max(op / o.length, 1e-9);
      if (z >= 1.96 && rr >= 1.4) found.push({ label, z, rr, gp, gn: g.length, op, on: o.length });
    }
    found.sort((a, b) => b.z - a.z).slice(0, 3).forEach(f => say('info', `${f.label}: positivity ${pct(f.gp, f.gn)} vs ${pct(f.op, f.on)}`,
      `Women in this group test positive about ${f.rr.toFixed(1)} times as often (${f.gp} of ${f.gn} against ${f.op} of ${f.on}). This is a pattern in your data, not proof of cause. It may help decide who to prioritise for outreach.`));
    if (!found.length) say('info', 'No risk factor stands out yet', `With ${valid.length} valid results, none of the recorded factors separates positive from negative clearly. This will sharpen as more data arrives.`);
  } else if (valid.length) say('info', 'Risk-factor analysis starts at 30 valid results', `You have ${valid.length}. The engine waits so small numbers do not mislead.`);

  // 3. leaks in the cascade
  const steps = [
    ['positive women reaching colposcopy', A.funnel[2].n, A.funnel[3].n, p => (p.colpo && p.colpo.not_done_reason)],
    ['eligible women treated', R.filter(p => p.treat && p.treat.eligible === 'Eligible').length, A.funnel[5].n, p => p.treat && p.treat.not_done_reason],
    ['referred women attending', A.funnel[6].n, A.funnel[7].n, p => arr(p.referral && p.referral.barriers).filter(x => x !== 'None')],
  ];
  for (const [label, den, num, why] of steps) {
    if (den < 5 || num / den >= 0.8) continue;
    const m = new Map(); R.forEach(p => arr(why(p)).forEach(x => x && m.set(x, (m.get(x) || 0) + 1)));
    const top = [...m].sort((a, b) => b[1] - a[1])[0];
    say('alert', `Only ${pct(num, den)} of ${label}`, `${num} of ${den}.${top ? ` The most recorded reason is “${top[0]}” (${top[1]}).` : ' No reason has been recorded, which is itself a gap.'}`);
  }

  // 4. screening history and barriers
  if (A.neverScreened.b >= 10) {
    const top = A.reasons[0];
    say('info', `${pct(A.neverScreened.a, A.neverScreened.b)} had never been screened`, top ? `Most common reason: “${top.k}” (${top.n} women).${A.reasons[1] ? ` Next: “${A.reasons[1].k}” (${A.reasons[1].n}).` : ''} This is the barrier evidence your research aims need.` : 'No reasons recorded yet.');
  }
  if (A.channels.length >= 2 && R.length >= 30) say('info', `“${A.channels[0].k}” brings the most women`, `${pct(A.channels[0].n, R.length)} heard about the camp this way. ${A.channels[A.channels.length - 1].k} brings the fewest.`);

  // 5. site quality
  A.sites.filter(s => s.tested >= 10 && s.invalid / s.tested > 0.05).forEach(s => say('alert', `${s.name || s.code}: ${pct(s.invalid, s.tested)} of tests invalid`, `${s.invalid} of ${s.tested}. Check specimen collection, storage and kit lots at this site.`));
  if (A.invalid.b >= 20 && A.invalid.v <= 0.05 && !out.some(o => o.title.includes('invalid'))) say('good', `Invalid tests are low (${pct(A.invalid.a, A.invalid.b, 1)})`, 'Below the 5% level most programmes aim for.');

  // 6. data quality
  const miss = (f, label) => { const k = R.filter(p => I(p)[f] == null).length; return k / R.length > 0.2 ? `${label} is missing on ${pct(k, R.length)}` : null; };
  const gaps = [miss('height_cm', 'Height'), miss('weight_kg', 'Weight'), miss('hiv_status', 'HIV status')].filter(Boolean);
  const hivUnk = R.filter(p => ['Unknown', 'Declined'].includes(I(p).hiv_status)).length;
  if (hivUnk / R.length > 0.15) gaps.push(`HIV status is unknown or declined for ${pct(hivUnk, R.length)}`);
  if (gaps.length) say('watch', 'Data gaps to fix', gaps.join('. ') + '.');
  const noTest = R.filter(p => !(p.test && p.test.result) && daysBetween(p.date, localDate()) >= 1).length;
  if (noTest) say('watch', `${noTest} women have no E6/E7 result recorded`, 'Registered on an earlier day, but the test stage is empty. Open the “Needs attention” list.');

  // 7. safety
  if (A.severeAe) say('alert', `${A.severeAe} severe adverse event${A.severeAe > 1 ? 's' : ''} recorded`, 'Review these cases and confirm they were escalated.');
  else if (A.safety.b >= 10) say('good', `Adverse events after treatment: ${pct(A.safety.a, A.safety.b, 1)}`, `${A.safety.a} of ${A.safety.b} procedures. No severe events recorded.`);

  if (A.work.length) say('watch', `${A.work.length} items need follow-up`, `${A.work.filter(w => w.level === 'alert').length} are urgent. They are listed under “Needs attention” in Patients.`);
  const order = { alert: 0, watch: 1, info: 2, good: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

// ───────── export ─────────
export function flatten(p) {
  const row = { pid: p.pid, date: p.date, site: p.site, site_code: p.site_code, setting: p.setting, staff: p.staff, demo: p.demo ? 'yes' : '' };
  const put = (pre, o) => { for (const [k, v] of Object.entries(o || {})) { if (k.startsWith('_') || v == null) continue; if (typeof v === 'object' && !Array.isArray(v)) put(pre + k + '.', v); else row[pre + k] = v; } };
  put('intake.', p.intake);
  ['test', 'colpo', 'biopsy', 'treat', 'referral', 'exp', 'close'].forEach(k => put(k + '.', p[k]));
  Object.entries(p.follow || {}).forEach(([k, v]) => put(`follow.${k}.`, v));
  row.final_result = finalResult(p) || '';
  return row;
}
export function toCsv(rows, csvCell) {
  const flat = rows.map(flatten); const cols = [...new Set(flat.flatMap(Object.keys))];
  return [cols.join(','), ...flat.map(r => cols.map(c => csvCell(r[c])).join(','))].join('\n');
}
export { fmtDate };
