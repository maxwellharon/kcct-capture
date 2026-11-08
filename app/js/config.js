// ─────────────────────────────────────────────────────────────
//  KCCT Capture – settings
//  1) Paste your Firebase web-app config below (see SETUP.md, step 4).
//  2) Leave the PASTE_… values as they are to run in offline DEMO mode.
// ─────────────────────────────────────────────────────────────
export const CONFIG = {
  firebase: {
    apiKey: 'PASTE_API_KEY',
    authDomain: 'PASTE_PROJECT_ID.firebaseapp.com',
    projectId: 'PASTE_PROJECT_ID',
    storageBucket: 'PASTE_PROJECT_ID.firebasestorage.app',
    messagingSenderId: 'PASTE_SENDER_ID',
    appId: 'PASTE_APP_ID',
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
