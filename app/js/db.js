// Data layer. Two interchangeable back-ends behind one tiny API:
//   • Firebase (Auth + Firestore with offline cache)  – used once config.js has your keys
//   • Local demo store (browser storage)             – used while config.js still says PASTE_…
import { CONFIG } from './config.js';
import { deepMerge, clean, store as ls } from './util.js';

const FB_VER = '10.14.1';
const CDN = `https://www.gstatic.com/firebasejs/${FB_VER}/`;

let mode = 'local';
let fb = null;           // firebase modules + instances
let user = null;
let rows = new Map();    // pid -> participant
let unsub = null;
const subs = new Set();
const state = { pending: 0, fromCache: false, error: null };

export const isConfigured = () => !!(CONFIG.firebase.apiKey && !CONFIG.firebase.apiKey.startsWith('PASTE'));
export const getMode = () => mode;
export const getUser = () => user;
export const getState = () => ({ ...state, online: navigator.onLine });
const emit = () => subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
export const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };
export const all = () => [...rows.values()];
export const get = pid => rows.get(pid) || null;

// ───────── start-up ─────────
export async function init() {
  if (!isConfigured()) { mode = 'local'; loadLocal(); return { mode, needsLogin: false }; }
  mode = 'firebase';
  const [app, auth, fs] = await Promise.all([import(CDN + 'firebase-app.js'), import(CDN + 'firebase-auth.js'), import(CDN + 'firebase-firestore.js')]);
  const a = app.initializeApp(CONFIG.firebase);
  fb = {
    auth, fs, app: a,
    authI: auth.getAuth(a),
    db: fs.initializeFirestore(a, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      experimentalAutoDetectLongPolling: true,
    }),
  };
  await new Promise(res => { const off = auth.onAuthStateChanged(fb.authI, u => { user = u; off(); res(); }); });
  if (user) startSync();
  window.addEventListener('online', emit); window.addEventListener('offline', emit);
  return { mode, needsLogin: !user };
}

function startSync() {
  stopSync();
  const { fs } = fb;
  unsub = fs.onSnapshot(fs.collection(fb.db, 'participants'), { includeMetadataChanges: true }, snap => {
    const m = new Map();
    let pend = 0;
    snap.docs.forEach(d => { const v = d.data(); v._pending = d.metadata.hasPendingWrites; if (v._pending) pend++; m.set(d.id, v); });
    rows = m; state.pending = pend; state.fromCache = snap.metadata.fromCache; state.error = null; emit();
  }, err => {
    state.error = err.code === 'permission-denied' ? 'This account is not on the staff list yet. Ask the administrator to add it.' : err.message;
    emit();
  });
}
function stopSync() { if (unsub) { unsub(); unsub = null; } rows = new Map(); }

export async function signIn(email, password) {
  try {
    const cred = await fb.auth.signInWithEmailAndPassword(fb.authI, email.trim(), password);
    user = cred.user; startSync(); return user;
  } catch (e) {
    const map = {
      'auth/invalid-credential': 'Wrong email or password.', 'auth/wrong-password': 'Wrong email or password.', 'auth/user-not-found': 'Wrong email or password.',
      'auth/invalid-email': 'That email address is not valid.', 'auth/network-request-failed': 'No internet. You need a connection for the first sign-in.',
      'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    };
    throw new Error(map[e.code] || e.message);
  }
}
export async function signOut() { if (mode === 'firebase') { await fb.auth.signOut(fb.authI); user = null; stopSync(); emit(); } }

// ───────── writes ─────────
export function save(pid, patch) {
  patch = clean({ ...patch, _updatedAt: new Date().toISOString(), _updatedBy: user?.email || 'demo' });
  const merged = deepMerge(rows.get(pid) || {}, patch);
  if (mode === 'local') { rows.set(pid, merged); persistLocal(); emit(); return Promise.resolve(); }
  // Do not wait for the server: Firestore queues the write offline and syncs later.
  const { fs } = fb;
  rows.set(pid, { ...merged, _pending: true }); emit();
  return fs.setDoc(fs.doc(fb.db, 'participants', pid), patch, { merge: true }).catch(e => { console.error(e); state.error = e.message; emit(); throw e; });
}
export async function saveContact(pid, c) {
  c = clean({ ...c, pid, _updatedAt: new Date().toISOString() });
  if (mode === 'local') { const all = ls.get('kcct.contacts', {}); all[pid] = deepMerge(all[pid], c); ls.set('kcct.contacts', all); return; }
  const { fs } = fb; fs.setDoc(fs.doc(fb.db, 'contacts', pid), c, { merge: true }).catch(console.error);
}
export async function getContact(pid) {
  if (mode === 'local') return ls.get('kcct.contacts', {})[pid] || null;
  try { const { fs } = fb; const s = await fs.getDoc(fs.doc(fb.db, 'contacts', pid)); return s.exists() ? s.data() : null; } catch { return null; }
}

// ───────── local demo store ─────────
function loadLocal() { rows = new Map(Object.entries(ls.get('kcct.participants', {}))); emit(); }
function persistLocal() { ls.set('kcct.participants', Object.fromEntries(rows)); }
export function replaceLocal(list) { rows = new Map(list.map(p => [p.pid, p])); persistLocal(); emit(); }
export function removeDemo() { for (const [k, v] of rows) if (v.demo) rows.delete(k); persistLocal(); emit(); }
export function wipeLocal() { rows = new Map(); persistLocal(); ls.del('kcct.contacts'); emit(); }
