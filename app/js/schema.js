// The whole questionnaire lives here. Add, remove or reorder questions and the
// form, the analytics inputs and the data dictionary all follow.
//
// Field types:  chips | multi | num | hw | date | now | text | select | contact
// Options:      show:(d,ctx)=>bool   hides a question (and clears its answer)
//               req:true             must be answered before saving
//               warn:(v,d)=>string   soft warning (never blocks)
//               block:(v)=>string    hard stop with a message
import { COUNTIES } from './util.js';

const YN = ['Yes', 'No'];
const is = (d, id, ...v) => v.includes(d[id]);
const has = (d, id, v) => Array.isArray(d[id]) && d[id].includes(v);
const none = 'None';

// ───────────────────────────── INTAKE (the 1-minute form) ─────────────────────────────
export const INTAKE = [
  // Consent -------------------------------------------------------------
  { id: 'consent_care', group: 'Consent', label: 'Consent for clinical care given?', type: 'chips', opts: YN, req: true,
    block: v => (v === 'No' ? 'No consent means no data is recorded. Thank her and close this form.' : null) },
  { id: 'privacy_explained', group: 'Consent', label: 'Privacy notice explained?', type: 'chips', opts: ['Explained', 'Not explained', 'Declined data use'], req: true },
  { id: 'consent_research', group: 'Consent', label: 'Consent for research use of data?', type: 'chips', opts: ['Yes', 'No', 'Not sought'], def: 'Not sought',
    hint: 'Clinical consent never replaces research consent. Leave as “Not sought” until ethics approval is in place.' },

  // About her -----------------------------------------------------------
  { id: 'age', group: 'About her', label: 'Age', type: 'num', unit: 'years', min: 15, max: 99, req: true,
    warn: (v, d, ctx) => (v < ctx.ageRange[0] || v > ctx.ageRange[1] ? `Outside the ${ctx.ageRange[0]}–${ctx.ageRange[1]} target group. You can still continue.` : null) },
  { id: 'body', group: 'About her', label: 'Height and weight', type: 'hw', ids: ['height_cm', 'weight_kg'] },
  { id: 'marital', group: 'About her', label: 'Marital status', type: 'chips', opts: ['Single', 'Married / cohabiting', 'Separated / divorced', 'Widowed', 'Declined'] },
  { id: 'education', group: 'About her', label: 'Highest education', type: 'chips', opts: ['None', 'Primary', 'Secondary', 'Tertiary', 'Declined'] },
  { id: 'county', group: 'About her', label: 'County of residence', type: 'select', opts: COUNTIES, def: ctx => ctx.setup.county || 'Nairobi' },
  { id: 'subcounty', group: 'About her', label: 'Sub-county or ward', type: 'text', suggest: 'subcounty', placeholder: 'e.g. Narok North' },

  // Work and income -----------------------------------------------------
  { id: 'emp_status', group: 'Work and income', label: 'Main daily activity', type: 'chips',
    opts: ['Formal employment', 'Self-employed / business', 'Casual / informal work', 'Student', 'Home-maker', 'Unemployed, seeking work', 'Unemployed, not seeking', 'Retired', 'Declined'],
    hint: 'One tap replaces five tick-boxes. Sector and income follow separately so they can be analysed.' },
  { id: 'emp_sector', group: 'Work and income', label: 'Type of work', type: 'chips',
    opts: ['Farming / livestock', 'Trade / market / shop', 'Hospitality / domestic', 'Health / education', 'Transport', 'Construction / manual', 'Other'],
    show: d => is(d, 'emp_status', 'Formal employment', 'Self-employed / business', 'Casual / informal work') },
  { id: 'emp_detail', group: 'Work and income', label: 'Please specify the work', type: 'text', placeholder: 'Job or business',
    show: d => is(d, 'emp_sector', 'Other') },
  { id: 'income', group: 'Work and income', label: 'Her own monthly income (KES)', type: 'chips',
    opts: ['No income', 'Under 5,000', '5,000–14,999', '15,000–29,999', '30,000–59,999', '60,000+', 'Declined'],
    show: d => !is(d, 'emp_status', 'Declined') },
  { id: 'insurance', group: 'Work and income', label: 'Health insurance', type: 'chips', opts: ['SHA', 'Private', 'None', 'Other'] },

  // Reproductive health -------------------------------------------------
  { id: 'sexual_debut', group: 'Reproductive health', label: 'Age at first sex', type: 'num', unit: 'years', min: 8, max: 45, alts: ['Never had sex', 'Declined'],
    warn: (v, d) => (typeof v === 'number' && d.age && v > d.age ? 'Later than her current age. Please check.' : null) },
  { id: 'gravida', group: 'Reproductive health', label: 'Pregnancies so far', type: 'chips', opts: ['0', '1', '2', '3', '4', '5+'] },
  { id: 'parity', group: 'Reproductive health', label: 'Births so far', type: 'chips', opts: ['0', '1', '2', '3', '4', '5+'],
    show: d => d.gravida && d.gravida !== '0' },
  { id: 'menopausal', group: 'Reproductive health', label: 'Reached menopause?', type: 'chips', opts: YN, show: d => d.age >= 40 },
  { id: 'pregnant', group: 'Reproductive health', label: 'Pregnant now?', type: 'chips', opts: ['Yes', 'No', 'Unsure'], req: true, show: d => !is(d, 'menopausal', 'Yes') },
  { id: 'gest_weeks', group: 'Reproductive health', label: 'Weeks pregnant', type: 'num', unit: 'weeks', min: 1, max: 42, show: d => is(d, 'pregnant', 'Yes') },
  { id: 'breastfeeding', group: 'Reproductive health', label: 'Breastfeeding?', type: 'chips', opts: YN, show: d => !is(d, 'menopausal', 'Yes') },
  { id: 'contraception', group: 'Reproductive health', label: 'Family planning in use', type: 'multi', exclusive: [none],
    opts: [none, 'Pill', 'Injectable', 'Implant', 'IUD', 'Condoms', 'Permanent method', 'Other'], show: d => !is(d, 'menopausal', 'Yes') && !is(d, 'sexual_debut', 'Never had sex') },
  { id: 'partners', group: 'Reproductive health', label: 'Lifetime sexual partners', type: 'chips', opts: ['1', '2–3', '4 or more', 'Declined'], show: d => !is(d, 'sexual_debut', 'Never had sex') },

  // Health and medicines ------------------------------------------------
  { id: 'hiv_status', group: 'Health and medicines', label: 'HIV status', type: 'chips', opts: ['Positive', 'Negative', 'Unknown', 'Declined'], req: true },
  { id: 'hiv_last_test', group: 'Health and medicines', label: 'Last HIV test', type: 'chips', opts: ['Under 3 months ago', '3–12 months ago', 'Over 12 months ago', 'Never tested'], show: d => is(d, 'hiv_status', 'Negative', 'Unknown') },
  { id: 'hiv_on_art', group: 'Health and medicines', label: 'On HIV treatment (ART)?', type: 'chips', opts: YN, show: d => is(d, 'hiv_status', 'Positive') },
  { id: 'hiv_art_duration', group: 'Health and medicines', label: 'How long on treatment?', type: 'chips', opts: ['Under 6 months', '6–12 months', '1–5 years', 'Over 5 years'], show: d => is(d, 'hiv_on_art', 'Yes') },
  { id: 'hiv_vl', group: 'Health and medicines', label: 'Latest viral load', type: 'chips', opts: ['Suppressed', 'Not suppressed', 'Unknown'], show: d => is(d, 'hiv_on_art', 'Yes') },
  { id: 'tb', group: 'Health and medicines', label: 'Ever treated for TB?', type: 'chips',
    opts: ['Never', 'On treatment now', 'Under 1 year ago', '1–5 years ago', 'Over 5 years ago', 'Unsure'] },
  { id: 'chronic_meds', group: 'Health and medicines', label: 'Long-term medicines (3+ months)', type: 'multi', exclusive: [none],
    opts: [none, 'ARVs', 'TB drugs', 'Blood pressure', 'Diabetes', 'Steroids / immune-suppressing', 'Other'] },
  { id: 'substances', group: 'Health and medicines', label: 'Tobacco, alcohol or other drugs', type: 'multi', exclusive: [none, 'Declined'],
    opts: [none, 'Tobacco / smoking', 'Alcohol', 'Khat (miraa)', 'Other drugs', 'Declined'] },
  { id: 'hpv_vax', group: 'Health and medicines', label: 'HPV vaccine received', type: 'chips', opts: ['None', '1 dose', '2 or more doses', 'Unknown'] },
  { id: 'fam_hx', group: 'Health and medicines', label: 'Family history of cervical cancer?', type: 'chips', opts: ['Yes', 'No', 'Unknown'] },
  { id: 'symptoms', group: 'Health and medicines', label: 'Any of these symptoms?', type: 'multi', exclusive: [none],
    opts: [none, 'Bleeding after sex', 'Bleeding between periods', 'Bleeding after menopause', 'Abnormal discharge', 'Pelvic pain', 'Other'] },

  // Screening history ---------------------------------------------------
  { id: 'prev_screen', group: 'Screening history', label: 'Screened for cervical cancer before?', type: 'chips', opts: YN, req: true },
  { id: 'prev_type', group: 'Screening history', label: 'Which test?', type: 'multi', opts: ['VIA / VILI', 'Pap smear', 'HPV DNA', 'E6/E7', 'Other', 'Do not remember'], show: d => is(d, 'prev_screen', 'Yes') },
  { id: 'prev_when', group: 'Screening history', label: 'How long ago?', type: 'chips', opts: ['Under 1 year', '1–3 years', '3–5 years', 'Over 5 years'], show: d => is(d, 'prev_screen', 'Yes') },
  { id: 'prev_result', group: 'Screening history', label: 'Result she was given', type: 'chips', opts: ['Normal', 'Abnormal', 'Not told / unknown'], show: d => is(d, 'prev_screen', 'Yes') },
  { id: 'prev_reason', group: 'Screening history', label: 'Why not screened before?', type: 'multi',
    opts: ['Did not know about it', 'Cost', 'Distance / transport', 'Fear or embarrassment', 'No symptoms', 'No time', 'Partner or family objection', 'Service not available', 'Other'],
    show: d => is(d, 'prev_screen', 'No') },
  { id: 'prev_treat', group: 'Screening history', label: 'Earlier cervical treatment', type: 'chips', opts: ['None', 'Ablation / cryotherapy', 'LEEP / LLETZ', 'Cone biopsy', 'Other'] },

  // Access and follow-up ------------------------------------------------
  { id: 'travel_time', group: 'Access and follow-up', label: 'Travel time to a health facility', type: 'chips', opts: ['Under 30 min', '30–60 min', '1–2 hours', 'Over 2 hours'] },
  { id: 'travel_cost', group: 'Access and follow-up', label: 'Return travel cost (KES)', type: 'chips', opts: ['0', 'Under 200', '200–500', 'Over 500'] },
  { id: 'heard_via', group: 'Access and follow-up', label: 'How did she hear about today?', type: 'chips', opts: ['CHV / community talk', 'Church or chief’s baraza', 'Radio', 'Social media', 'Friend or family', 'Health facility', 'Other'] },
  { id: 'followup_mode', group: 'Access and follow-up', label: 'Best way to reach her', type: 'chips', opts: ['Phone call', 'SMS', 'WhatsApp', 'Home visit / CHV', 'Not needed'] },
  { id: 'contact', group: 'Access and follow-up', label: 'Name and phone (kept in the private register)', type: 'contact',
    hint: 'Stored apart from the clinical record, visible only to clinicians and admins.' },
];

// ───────────────────────────── CASCADE STAGES ─────────────────────────────
const today = 'today';
export const STAGES = {
  test: {
    key: 'test', title: 'E6/E7 test', short: 'Test', section: 'D',
    fields: [
      { id: 'result', label: 'E6/E7 oncoprotein result', type: 'chips', opts: ['Positive', 'Negative', 'Invalid'], req: true },
      { id: 'specimen', label: 'Specimen', type: 'chips', opts: ['Clinician-collected cervical', 'Self-collected vaginal', 'Other'], def: 'Clinician-collected cervical' },
      { id: 'adequate', label: 'Sample adequate?', type: 'chips', opts: ['Adequate', 'Inadequate'] },
      { id: 'qc', label: 'Quality control', type: 'chips', opts: ['Passed', 'Failed', 'Not done'] },
      { id: 'repeat_done', label: 'Test repeated?', type: 'chips', opts: YN, show: d => d.result === 'Invalid' },
      { id: 'repeat_result', label: 'Repeat result', type: 'chips', opts: ['Positive', 'Negative', 'Invalid'], show: d => d.repeat_done === 'Yes' },
      { id: 'lot', label: 'Kit lot number', type: 'text', sticky: true, placeholder: 'Lot' },
      { id: 'expiry', label: 'Kit expiry', type: 'date', sticky: true, noToday: true },
      { id: 't_collect', label: 'Sample collected at', type: 'now' },
      { id: 't_result', label: 'Result read at', type: 'now' },
      { id: 'disclosed', label: 'Result given to her?', type: 'chips', opts: YN },
      { id: 'counselled', label: 'Counselling documented?', type: 'chips', opts: YN },
    ],
  },
  colpo: {
    key: 'colpo', title: 'Colposcopy', short: 'Colposcopy', section: 'E',
    fields: [
      { id: 'done', label: 'Colposcopy done?', type: 'chips', opts: YN, req: true },
      { id: 'not_done_reason', label: 'Why not?', type: 'chips', opts: ['Not indicated (negative)', 'Patient declined', 'Equipment', 'Staffing', 'Pregnancy or other reason', 'Other'], show: d => d.done === 'No' },
      { id: 'indication', label: 'Reason for colposcopy', type: 'chips', opts: ['Positive E6/E7', 'Symptoms', 'Visible lesion', 'Follow-up', 'Referred in'], show: d => d.done === 'Yes' },
      { id: 'speculum', label: 'Speculum exam', type: 'chips', opts: ['Normal', 'Suspicious lesion', 'Cervicitis', 'Other'], show: d => d.done === 'Yes' },
      { id: 'scj', label: 'Squamocolumnar junction', type: 'chips', opts: ['Fully visible', 'Partly visible', 'Not visible'], show: d => d.done === 'Yes' },
      { id: 'tz', label: 'Transformation zone', type: 'chips', opts: ['Type 1', 'Type 2', 'Type 3', 'Unknown'], show: d => d.done === 'Yes' },
      { id: 'findings', label: 'Findings', type: 'chips', opts: ['Normal', 'Minor change', 'Major change', 'Suspicious for invasion', 'Unsatisfactory'], show: d => d.done === 'Yes', req: true },
      { id: 'quadrants', label: 'Lesion extent (quadrants)', type: 'chips', opts: ['1', '2', '3', '4'], show: d => d.done === 'Yes' && d.findings && d.findings !== 'Normal' },
      { id: 'endo_ext', label: 'Extends into the canal?', type: 'chips', opts: ['Yes', 'No', 'Uncertain'], show: d => d.done === 'Yes' && d.findings && d.findings !== 'Normal' },
      { id: 'impression', label: 'Impression', type: 'chips', opts: ['Normal', 'Low grade (LSIL)', 'High grade (HSIL)', 'Suspected cancer', 'Other'], show: d => d.done === 'Yes', req: true },
      { id: 'recommend', label: 'Recommendation', type: 'chips', opts: ['Routine follow-up', 'Biopsy', 'Treatment', 'Refer', 'Further tests'], show: d => d.done === 'Yes' },
      { id: 'image_id', label: 'Image ID (no patient name)', type: 'text', show: d => d.done === 'Yes', placeholder: 'Optional' },
      { id: 't_colpo', label: 'Colposcopy done at', type: 'now', show: d => d.done === 'Yes' },
    ],
  },
  biopsy: {
    key: 'biopsy', title: 'Biopsy and histology', short: 'Biopsy', section: 'F',
    fields: [
      { id: 'done', label: 'Biopsy taken?', type: 'chips', opts: YN, req: true },
      { id: 'type', label: 'Biopsy type', type: 'chips', opts: ['Directed punch', 'Excisional', 'Other'], show: d => d.done === 'Yes' },
      { id: 'n', label: 'Number of biopsies', type: 'chips', opts: ['1', '2', '3', '4 or more'], show: d => d.done === 'Yes' },
      { id: 'specimen_id', label: 'Specimen ID', type: 'text', show: d => d.done === 'Yes' },
      { id: 'lab', label: 'Laboratory sent to', type: 'text', sticky: true, show: d => d.done === 'Yes' },
      { id: 'dispatched', label: 'Date dispatched', type: 'date', show: d => d.done === 'Yes' },
      { id: 'histology', label: 'Histology result', type: 'chips', opts: ['Pending', 'Benign', 'CIN1', 'CIN2', 'CIN3', 'AIS', 'Invasive carcinoma', 'Inadequate', 'Other'], show: d => d.done === 'Yes', req: true },
      { id: 'hist_date', label: 'Report date', type: 'date', show: d => d.done === 'Yes' && d.histology && d.histology !== 'Pending' },
      { id: 'informed_date', label: 'Date she was told', type: 'date', show: d => d.done === 'Yes' && d.histology && d.histology !== 'Pending' },
      { id: 'lvsi', label: 'LVSI reported?', type: 'chips', opts: ['Yes', 'No', 'Not reported'], show: d => d.histology === 'Invasive carcinoma' },
      { id: 'concordance', label: 'Colposcopy and pathology agree?', type: 'chips', opts: ['Yes', 'No', 'Unclear'], show: d => d.done === 'Yes' && d.histology && d.histology !== 'Pending' },
    ],
  },
  treat: {
    key: 'treat', title: 'Same-day treatment', short: 'Treatment', section: 'G',
    banner: (d, ctx) => {
      const out = [];
      const p = ctx.p || {};
      if ((p.colpo || {}).impression === 'Suspected cancer' || (p.biopsy || {}).histology === 'Invasive carcinoma')
        out.push({ level: 'alert', text: 'Suspected invasive disease. Do not use ablation. Follow the referral pathway.' });
      if ((p.intake || {}).pregnant === 'Yes') out.push({ level: 'watch', text: 'She reported being pregnant. Check eligibility against protocol before any procedure.' });
      return out;
    },
    fields: [
      { id: 'eligible', label: 'Eligible for same-day treatment?', type: 'chips', opts: ['Eligible', 'Not eligible', 'Deferred'], req: true },
      { id: 'ineligible_reason', label: 'Reason', type: 'chips', opts: ['Pregnancy', 'Suspected invasion', 'Large lesion or canal extension', 'Infection', 'Patient preference', 'Other'], show: d => d.eligible === 'Not eligible' || d.eligible === 'Deferred' },
      { id: 'decision', label: 'Her decision', type: 'chips', opts: ['Accepted', 'Declined', 'Deferred'], show: d => d.eligible === 'Eligible' },
      { id: 'proc_consent', label: 'Procedure consent given?', type: 'chips', opts: YN, show: d => d.decision === 'Accepted' },
      { id: 'procedure', label: 'Procedure', type: 'chips', opts: ['Thermal ablation', 'Cryotherapy', 'LEEP / LLETZ', 'Other', 'None'], show: d => d.decision === 'Accepted', req: true },
      { id: 'anaesthesia', label: 'Anaesthesia', type: 'chips', opts: ['None', 'Local', 'Other'], show: d => d.decision === 'Accepted' },
      { id: 'operator', label: 'Operator ID', type: 'text', sticky: true, show: d => d.decision === 'Accepted' },
      { id: 'biopsy_before', label: 'Biopsy taken before treatment?', type: 'chips', opts: ['Yes', 'No', 'Not applicable'], show: d => d.decision === 'Accepted' },
      { id: 't_treat', label: 'Treated at', type: 'now', show: d => d.decision === 'Accepted' },
      { id: 'ae', label: 'Immediate adverse events', type: 'multi', exclusive: [none], opts: [none, 'Bleeding', 'Vasovagal', 'Pain', 'Other'], show: d => d.decision === 'Accepted' },
      { id: 'ae_severity', label: 'Severity', type: 'chips', opts: ['Mild', 'Moderate', 'Severe'], show: d => Array.isArray(d.ae) && d.ae.length && !d.ae.includes(none) },
      { id: 'instructions', label: 'After-care instructions given?', type: 'chips', opts: YN, show: d => d.decision === 'Accepted' },
      { id: 'warning_signs', label: 'Warning signs explained?', type: 'chips', opts: YN, show: d => d.decision === 'Accepted' },
      { id: 'preg_checked', label: 'Pregnancy status checked?', type: 'chips', opts: YN, show: d => d.decision === 'Accepted' },
      { id: 'invasion_excluded', label: 'Invasive disease excluded before ablation?', type: 'chips', opts: ['Yes', 'No', 'Not applicable'], show: d => d.decision === 'Accepted' },
      { id: 'not_done_reason', label: 'Why was treatment not completed?', type: 'chips', opts: ['Clinical ineligibility', 'Patient preference', 'Equipment', 'Staffing', 'Referral', 'Financial constraint'], show: d => d.decision === 'Declined' || d.decision === 'Deferred' || d.procedure === 'None' },
    ],
  },
  referral: {
    key: 'referral', title: 'Referral', short: 'Referral', section: 'H',
    fields: [
      { id: 'required', label: 'Referral needed?', type: 'chips', opts: YN, req: true },
      { id: 'indication', label: 'Reason', type: 'multi', opts: ['Suspected cancer', 'Histology result', 'Complex lesion', 'Other'], show: d => d.required === 'Yes' },
      { id: 'destination', label: 'Referred to (facility)', type: 'text', sticky: true, show: d => d.required === 'Yes' },
      { id: 'urgency', label: 'Urgency', type: 'chips', opts: ['Routine', 'Urgent'], show: d => d.required === 'Yes' },
      { id: 'ref_date', label: 'Referral date', type: 'date', show: d => d.required === 'Yes' },
      { id: 'appt_date', label: 'Appointment date', type: 'date', noToday: true, show: d => d.required === 'Yes' },
      { id: 'attended', label: 'Attended the appointment?', type: 'chips', opts: ['Yes', 'No', 'Unknown'], show: d => d.required === 'Yes' },
      { id: 'attended_date', label: 'Date attended', type: 'date', show: d => d.attended === 'Yes' },
      { id: 'diagnosis', label: 'Definitive diagnosis', type: 'text', show: d => d.attended === 'Yes' },
      { id: 'care_started', label: 'Care started?', type: 'chips', opts: ['Yes', 'No', 'Pending'], show: d => d.attended === 'Yes' },
      { id: 'barriers', label: 'Barriers met', type: 'multi', exclusive: [none], opts: [none, 'Cost', 'Transport', 'Fear', 'Time', 'Service availability', 'Other'], show: d => d.required === 'Yes' },
      { id: 'support', label: 'Support given by navigator', type: 'text', show: d => d.required === 'Yes' },
    ],
  },
  exp: {
    key: 'exp', title: 'Experience and cost', short: 'Experience', section: 'J',
    fields: [
      { id: 'recommend', label: 'Would she recommend the service?', type: 'chips', opts: ['Yes', 'No', 'Unsure'] },
      { id: 'selfcollect', label: 'Self-collection', type: 'chips', opts: ['Preferred', 'Acceptable', 'Not acceptable', 'Not applicable'] },
      { id: 'wtp', label: 'Willing to pay (KES)', type: 'num', unit: 'KES', min: 0, max: 100000 },
      { id: 'oop', label: 'Paid out of pocket (KES)', type: 'num', unit: 'KES', min: 0, max: 100000 },
      { id: 'delay', label: 'Reasons for delay today', type: 'multi', exclusive: [none], opts: [none, 'Patient', 'Staffing', 'Supplies', 'Equipment', 'Laboratory', 'Referral', 'Other'] },
      { id: 'feedback', label: 'Her feedback in her words', type: 'text', placeholder: 'Optional' },
    ],
  },
  close: {
    key: 'close', title: 'Quality and close-out', short: 'Close-out', section: 'K',
    fields: [
      { id: 'serious_event', label: 'Serious adverse event?', type: 'chips', opts: YN },
      { id: 'incident_id', label: 'Incident ID', type: 'text', show: d => d.serious_event === 'Yes' },
      { id: 'escalated', label: 'Escalated?', type: 'chips', opts: YN, show: d => d.serious_event === 'Yes' },
      { id: 'deviation', label: 'Protocol deviation?', type: 'chips', opts: YN },
      { id: 'deviation_note', label: 'Describe the deviation', type: 'text', show: d => d.deviation === 'Yes' },
      { id: 'case_status', label: 'Case status', type: 'chips', opts: ['Open', 'Completed', 'Referred'], req: true },
    ],
  },
};
export const STAGE_ORDER = ['test', 'colpo', 'biopsy', 'treat', 'referral', 'exp', 'close'];

export const FOLLOW = {
  key: 'follow', title: 'Follow-up visit', short: 'Follow-up', section: 'I',
  fields: [
    { id: 'status', label: 'Visit status', type: 'chips', opts: ['Attended', 'Telephone', 'Missed', 'Unable to reach', 'Withdrew', 'Died (verified)', 'Other'], req: true },
    { id: 'scheduled', label: 'Scheduled date', type: 'date', noToday: true },
    { id: 'actual', label: 'Actual date', type: 'date', show: d => d.status === 'Attended' || d.status === 'Telephone' },
    { id: 'assessment', label: 'Clinical assessment', type: 'chips', opts: ['Healing well', 'Signs of infection', 'Other problem', 'No symptoms'], show: d => d.status === 'Attended' || d.status === 'Telephone' },
    { id: 'retest', label: 'Repeat test done', type: 'chips', opts: ['None', 'E6/E7', 'Colposcopy', 'Cytology', 'Biopsy'], show: d => d.status === 'Attended' },
    { id: 'retest_result', label: 'Repeat result', type: 'chips', opts: ['Negative', 'Positive', 'Abnormal', 'Pending'], show: d => d.retest && d.retest !== 'None' },
    { id: 'attempts', label: 'Contact attempts', type: 'chips', opts: ['1', '2', '3', '4 or more'], show: d => d.status === 'Missed' || d.status === 'Unable to reach' },
    { id: 'outcome', label: 'Treatment or referral outcome', type: 'chips', opts: ['Completed', 'Pending', 'Declined', 'Lost to follow-up', 'Other'] },
    { id: 'next_step', label: 'Next step', type: 'chips', opts: ['Routine screening programme', 'Next visit', 'Treat', 'Refer', 'Discharged'] },
    { id: 'next_date', label: 'Date of next visit', type: 'date', noToday: true, show: d => d.next_step === 'Next visit' },
  ],
};

// ───────────────────────────── Data dictionary ─────────────────────────────
export function dictionary() {
  const rows = [];
  const push = (section, prefix, f) => {
    const ids = f.type === 'hw' ? [['height_cm', 'Height', 'cm', 'number'], ['weight_kg', 'Weight', 'kg', 'number']] : f.type === 'contact' ? [] : [[f.id, f.label, f.unit || '', f.type]];
    for (const [id, label, unit, type] of ids)
      rows.push([`${prefix}${id}`, section, label, type === 'chips' ? 'single choice' : type === 'multi' ? 'multiple choice' : type, f.opts ? f.opts.join(' | ') : (f.alts ? 'number or ' + f.alts.join(' | ') : ''), unit, f.req ? 'yes' : 'no']);
  };
  rows.push(['pid', 'Identification', 'Unique participant ID (KCT-site-date-device+no.-check digit)', 'text', '', '', 'yes']);
  rows.push(['intake.bmi', 'Derived', 'Body mass index (kg/m²)', 'number', '', 'kg/m²', 'no']);
  rows.push(['intake.bmi_cat', 'Derived', 'BMI category (WHO)', 'single choice', 'Underweight | Healthy | Overweight | Obese', '', 'no']);
  rows.push(['intake.fill_seconds', 'Derived', 'Seconds taken to complete intake', 'number', '', 'seconds', 'no']);
  rows.push(['intake.completeness', 'Derived', 'Share of shown questions answered', 'number', '', '%', 'no']);
  rows.push(['site / site_code / setting / staff', 'Identification', 'Where and by whom the intake was captured', 'text', '', '', 'yes']);
  INTAKE.forEach(f => push('Intake – ' + f.group, 'intake.', f));
  STAGES && STAGE_ORDER.forEach(k => STAGES[k].fields.forEach(f => push(`Stage ${STAGES[k].section} – ${STAGES[k].title}`, k + '.', f)));
  FOLLOW.fields.forEach(f => push('Stage I – Follow-up visit', 'follow.v#.', f));
  return [['variable', 'section', 'question', 'type', 'allowed values', 'unit', 'required'], ...rows];
}
