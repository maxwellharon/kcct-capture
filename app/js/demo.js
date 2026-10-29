// Synthetic practice data so you can try analytics before any real patient is entered.
// Every record is flagged demo:true and can be removed from Settings. Not used in Firebase mode.
import { localDate, bmi, bmiCat } from './util.js';
import { checkDigit } from './pid.js';

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const SITES = [{ name: 'Demo Camp A', code: 'DMA', county: 'Narok' }, { name: 'Demo Camp B', code: 'DMB', county: 'Narok' }, { name: 'Demo Facility C', code: 'DMC', county: 'Nairobi' }];

export function makeDemo(count = 170) {
  const r = rng(20261028);
  const pick = a => a[Math.floor(r() * a.length)];
  const wpick = (a, w) => { let t = r() * w.reduce((x, y) => x + y, 0); for (let i = 0; i < a.length; i++) { t -= w[i]; if (t <= 0) return a[i]; } return a[a.length - 1]; };
  const chance = p => r() < p;
  const addDays = (ds, k) => { const d = new Date(ds + 'T12:00'); d.setDate(d.getDate() + k); return localDate(d); };
  const at = (ds, min) => new Date(`${ds}T08:00:00`).getTime() + min * 6e4;
  const iso = ms => new Date(ms).toISOString();
  const seqs = {}; const out = [];

  for (let i = 0; i < count; i++) {
    const ago = Math.min(70, Math.floor(-Math.log(1 - r() * 0.97) * 16));
    const date = addDays(localDate(), -ago);
    const site = pick(SITES);
    const age = Math.round(Math.min(64, Math.max(24, 25 + (r() + r() + r()) / 3 * 36)));
    const hiv = wpick(['Positive', 'Negative', 'Unknown', 'Declined'], [14, 76, 7, 3]);
    const debut = chance(0.06) ? 'Declined' : Math.round(14 + r() * 7);
    const partners = wpick(['1', '2–3', '4 or more', 'Declined'], [38, 40, 15, 7]);
    const prev = chance(0.66) ? 'No' : 'Yes';
    const emp = wpick(['Formal employment', 'Self-employed / business', 'Casual / informal work', 'Student', 'Home-maker', 'Unemployed, seeking work', 'Unemployed, not seeking', 'Retired', 'Declined'], [9, 28, 22, 2, 18, 9, 6, 3, 3]);
    const works = ['Formal employment', 'Self-employed / business', 'Casual / informal work'].includes(emp);
    const income = works ? wpick(['Under 5,000', '5,000–14,999', '15,000–29,999', '30,000–59,999', '60,000+'], [28, 34, 22, 11, 5]) : wpick(['No income', 'Under 5,000', 'Declined'], [70, 20, 10]);
    const h = Math.round(150 + r() * 25), w = Math.round(48 + r() * 42);
    const b = bmi(h, w);
    const gravida = wpick(['0', '1', '2', '3', '4', '5+'], [4, 12, 22, 26, 20, 16]);
    const symptoms = chance(0.15) ? [pick(['Bleeding after sex', 'Abnormal discharge', 'Pelvic pain', 'Bleeding between periods'])] : ['None'];
    const key = site.code + date; seqs[key] = (seqs[key] || 0) + 1;
    const base = `KCT-${site.code}-${date.slice(2).replace(/-/g, '')}-D${String(seqs[key]).padStart(2, '0')}`;
    const pid = `${base}-${checkDigit(base)}`;
    const start = at(date, seqs[key] * 6);
    const intake = {
      consent_care: 'Yes', privacy_explained: 'Explained', consent_research: 'Not sought', age, height_cm: h, weight_kg: w, bmi: b, bmi_cat: bmiCat(b),
      marital: wpick(['Single', 'Married / cohabiting', 'Separated / divorced', 'Widowed'], [18, 58, 14, 10]), education: wpick(['None', 'Primary', 'Secondary', 'Tertiary'], [12, 38, 34, 16]),
      county: site.county, emp_status: emp, income, insurance: wpick(['SHA', 'Private', 'None'], [45, 5, 50]),
      sexual_debut: debut, gravida, pregnant: chance(0.03) ? 'Yes' : 'No', partners,
      hiv_status: hiv, tb: wpick(['Never', 'Under 1 year ago', '1–5 years ago', 'Over 5 years ago'], [90, 2, 5, 3]),
      chronic_meds: hiv === 'Positive' ? ['ARVs'] : ['None'], substances: [wpick(['None', 'Tobacco / smoking', 'Alcohol'], [86, 4, 10])],
      hpv_vax: wpick(['None', '2 or more doses', 'Unknown'], [88, 3, 9]), fam_hx: wpick(['No', 'Yes', 'Unknown'], [80, 6, 14]), symptoms,
      prev_screen: prev, prev_treat: 'None', travel_time: wpick(['Under 30 min', '30–60 min', '1–2 hours', 'Over 2 hours'], [28, 34, 26, 12]),
      travel_cost: wpick(['0', 'Under 200', '200–500', 'Over 500'], [30, 35, 25, 10]), heard_via: wpick(['CHV / community talk', 'Church or chief’s baraza', 'Radio', 'Social media', 'Friend or family', 'Health facility'], [38, 20, 12, 8, 14, 8]),
      followup_mode: wpick(['Phone call', 'SMS', 'WhatsApp', 'Home visit / CHV'], [50, 20, 15, 15]),
      fill_seconds: Math.max(22, Math.round((105 - Math.max(0, 40 - ago) * 1.1) * (0.55 + r() * 0.75))), completeness: 88 + Math.round(r() * 12),
    };
    if (age >= 40) intake.menopausal = age > 52 && chance(0.7) ? 'Yes' : 'No';
    if (gravida !== '0') intake.parity = gravida;
    if (hiv === 'Positive') { intake.hiv_on_art = chance(0.92) ? 'Yes' : 'No'; if (intake.hiv_on_art === 'Yes') { intake.hiv_art_duration = pick(['6–12 months', '1–5 years', 'Over 5 years']); intake.hiv_vl = wpick(['Suppressed', 'Not suppressed', 'Unknown'], [75, 12, 13]); } }
    else if (hiv !== 'Declined') intake.hiv_last_test = pick(['Under 3 months ago', '3–12 months ago', 'Over 12 months ago', 'Never tested']);
    if (prev === 'Yes') { intake.prev_type = [pick(['VIA / VILI', 'Pap smear', 'HPV DNA'])]; intake.prev_when = pick(['Under 1 year', '1–3 years', '3–5 years', 'Over 5 years']); intake.prev_result = pick(['Normal', 'Normal', 'Not told / unknown']); }
    else intake.prev_reason = [wpick(['Did not know about it', 'Cost', 'Distance / transport', 'Fear or embarrassment', 'No symptoms', 'No time', 'Service not available'], [38, 12, 16, 14, 12, 5, 3])];
    if (works) intake.emp_sector = pick(['Farming / livestock', 'Trade / market / shop', 'Hospitality / domestic', 'Health / education', 'Transport']);

    const p = { pid, demo: true, date, created: iso(start), site: site.name, site_code: site.code, setting: site === SITES[2] ? 'Facility' : 'Outreach', staff: pick(['AW', 'JK', 'MN']), intake, _updatedAt: iso(start), _updatedBy: 'demo' };

    // ---- cascade ----
    if (ago >= 0 && !(ago === 0 && chance(0.25))) {
      const pPos = Math.min(0.5, 0.075 * (hiv === 'Positive' ? 2.6 : 1) * (age >= 40 ? 1.4 : 1) * (partners === '4 or more' ? 1.5 : 1) * (prev === 'No' ? 1.25 : 1) * (symptoms[0] !== 'None' ? 1.6 : 1));
      const inv = chance(site.code === 'DMC' ? 0.14 : 0.035);
      let result = inv ? 'Invalid' : chance(pPos) ? 'Positive' : 'Negative';
      const t0 = start + 10 * 6e4, t1 = t0 + (18 + r() * 14) * 6e4;
      p.test = { result, specimen: 'Clinician-collected cervical', adequate: inv ? 'Inadequate' : 'Adequate', qc: 'Passed', lot: 'L2610A', t_collect: iso(t0), t_result: iso(t1), disclosed: 'Yes', counselled: 'Yes', _at: iso(t1) };
      if (inv) { p.test.repeat_done = 'Yes'; result = chance(pPos) ? 'Positive' : 'Negative'; p.test.repeat_result = result; }
      if (result === 'Positive') {
        const doColpo = ago > 0 ? chance(0.8) : chance(0.7);
        if (doColpo) {
          const sameDay = chance(0.78); const cd = sameDay ? date : addDays(date, 1 + Math.floor(r() * 6));
          const imp = wpick(['Normal', 'Low grade (LSIL)', 'High grade (HSIL)', 'Suspected cancer'], [18, 34, 40, 8]);
          const ct = at(cd, 60 + seqs[key] * 6 + 50);
          p.colpo = { done: 'Yes', indication: 'Positive E6/E7', scj: 'Fully visible', tz: pick(['Type 1', 'Type 2', 'Type 3']), findings: imp === 'Normal' ? 'Normal' : imp.startsWith('Low') ? 'Minor change' : imp.startsWith('High') ? 'Major change' : 'Suspicious for invasion', impression: imp, recommend: imp === 'Normal' ? 'Routine follow-up' : imp.startsWith('Low') ? 'Treatment' : imp === 'Suspected cancer' ? 'Refer' : 'Biopsy', t_colpo: iso(ct), _at: iso(ct) };
          if (imp !== 'Normal') {
            if (imp !== 'Suspected cancer' || chance(0.5)) {
              const hist = imp.startsWith('High') ? wpick(['CIN2', 'CIN3', 'Benign', 'Invasive carcinoma'], [30, 40, 18, 12]) : imp === 'Suspected cancer' ? 'Invasive carcinoma' : wpick(['CIN1', 'Benign', 'CIN2'], [50, 30, 20]);
              const pending = ago < 8 || chance(0.1);
              p.biopsy = { done: 'Yes', type: 'Directed punch', n: '2', specimen_id: 'B' + (1000 + i), lab: 'Demo Lab', dispatched: cd, histology: pending ? 'Pending' : hist, _at: iso(ct + 36e5) };
              if (!pending) { p.biopsy.hist_date = addDays(cd, 9 + Math.floor(r() * 8)); p.biopsy.informed_date = addDays(p.biopsy.hist_date, Math.floor(r() * 5)); p.biopsy.concordance = chance(0.85) ? 'Yes' : 'Unclear'; }
            }
            const ablate = imp !== 'Suspected cancer' && !(p.biopsy && p.biopsy.histology === 'Invasive carcinoma');
            if (ablate) {
              const el = chance(0.85);
              p.treat = { eligible: el ? 'Eligible' : 'Not eligible', _at: iso(ct + 72e5) };
              if (el) {
                const acc = chance(0.88);
                p.treat.decision = acc ? 'Accepted' : 'Declined';
                if (acc) { p.treat.proc_consent = 'Yes'; p.treat.procedure = pick(['Thermal ablation', 'Thermal ablation', 'Cryotherapy', 'LEEP / LLETZ']); p.treat.ae = chance(0.07) ? [pick(['Bleeding', 'Pain', 'Vasovagal'])] : ['None']; if (p.treat.ae[0] !== 'None') p.treat.ae_severity = chance(0.1) ? 'Moderate' : 'Mild'; p.treat.instructions = 'Yes'; p.treat._at = iso(ct + 72e5); }
                else p.treat.not_done_reason = pick(['Patient preference', 'Financial constraint']);
              } else p.treat.ineligible_reason = 'Large lesion or canal extension';
            }
            if (!ablate || (p.biopsy && ['CIN3', 'Invasive carcinoma'].includes(p.biopsy.histology) && chance(0.3))) {
              const refDate = addDays(cd, 1);
              const att = ago > 14 ? chance(0.62) : chance(0.4);
              p.referral = { required: 'Yes', indication: ['Suspected cancer'], destination: 'Demo Referral Hospital', urgency: 'Urgent', ref_date: refDate, attended: att ? 'Yes' : ago > 20 ? 'No' : 'Unknown', barriers: att ? ['None'] : [pick(['Transport', 'Cost', 'Fear'])], _at: iso(ct + 9e6) };
              if (att) { p.referral.attended_date = addDays(refDate, 3 + Math.floor(r() * 25)); p.referral.care_started = 'Yes'; }
            }
          }
        } else if (ago > 0 && chance(0.5)) p.colpo = { done: 'No', not_done_reason: pick(['Patient declined', 'Equipment', 'Staffing']), _at: iso(start + 9e6) };
        if (ago >= 42 && p.colpo && p.colpo.done === 'Yes' && chance(0.6)) p.follow = { v1: { status: chance(0.85) ? 'Attended' : 'Missed', scheduled: addDays(date, 42), actual: addDays(date, 42 + Math.floor(r() * 5)), assessment: 'Healing well', outcome: 'Completed', next_step: 'Routine screening programme' } };
      }
      if (chance(0.5)) p.exp = { recommend: chance(0.9) ? 'Yes' : 'Unsure', oop: 0, _at: iso(t1) };
    }
    out.push(p);
  }
  return out;
}
