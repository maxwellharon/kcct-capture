// Participant ID:  KCT-<SITE>-<yymmdd>-<device letter><running no.>-<check digit>
// e.g. KCT-NGT-261028-A07-4. The last digit catches typing mistakes.
import { store } from './util.js';

const CH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function checkDigit(str) {
  let t = 0;
  [...str.toUpperCase().replace(/[^0-9A-Z]/g, '')].forEach((c, i) => { t += CH.indexOf(c) * (i % 7 + 1); });
  return t % 10;
}
export function deviceLetter() {
  let d = store.get('kcct.device');
  if (!d) { d = CH.slice(10)[Math.floor(Math.random() * 26)]; store.set('kcct.device', d); }
  return d;
}
const yymmdd = (dt = new Date()) => String(dt.getFullYear()).slice(2) + String(dt.getMonth() + 1).padStart(2, '0') + String(dt.getDate()).padStart(2, '0');

export function nextSeq() { return (store.get('kcct.seq.' + yymmdd(), 0)) + 1; }
export function commitSeq(n) { store.set('kcct.seq.' + yymmdd(), n); }

export function makePid(siteCode, seq) {
  const site = (siteCode || 'XXX').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'XXX';
  const base = `KCT-${site}-${yymmdd()}-${deviceLetter()}${String(seq).padStart(2, '0')}`;
  return `${base}-${checkDigit(base)}`;
}
export function pidValid(pid) {
  const m = /^(.*)-(\d)$/.exec(pid || '');
  return !!m && checkDigit(m[1]) === +m[2];
}
