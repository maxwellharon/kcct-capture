// ─────────────────────────────────────────────────────────────
//  KCCT Capture – settings
//  1) Paste your Firebase web-app config below (see SETUP.md, step 4).
//  2) Leave the PASTE_… values as they are to run in offline DEMO mode.
// ─────────────────────────────────────────────────────────────
export const CONFIG = {
  firebase: {
    apiKey: "AIzaSyBEZgGMJJVdwtlqtkw-TNLiDgP4Ep6SslE",
    authDomain: "kcct-capture-cb6d2.firebaseapp.com",
    databaseURL: "https://kcct-capture-cb6d2-default-rtdb.firebaseio.com",
    projectId: "kcct-capture-cb6d2",
    storageBucket: "kcct-capture-cb6d2.firebasestorage.app",
    messagingSenderId: "1071191089482",
    appId: "1:1071191089482:web:a1cf068d42c5df77bc61b3"
  },

  // Speed targets for the intake form (seconds)
  FAST_SECONDS: 30,
  TARGET_SECONDS: 75,

  // Programme rules used by analytics (change to match your protocol)
  AGE_RANGE: [25, 60],
  REFERRAL_WINDOW_DAYS: 30,     // referral should be attended within…
  HISTOLOGY_TAT_DAYS: 14,       // histology expected back within…
  FOLLOWUP_DUE_DAYS: 42,        // positives are "due" for follow-up after…
};

