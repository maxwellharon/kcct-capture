# KCCT Capture: setup guide (no coding needed)

You will do four things: **(A)** create the Firebase project, **(B)** paste its keys into one file, **(C)** put the app online and build the Android APK, **(D)** install it on a phone.
Allow about 40 minutes the first time.

> **About "API keys".** Nobody, including Claude, needs your keys sent over chat. You paste them into `app/js/config.js` yourself.
> Firebase web keys are not passwords. They only point the app at your project. What protects the data is the **login** plus the **rules** in step A6.
> Never share your Google account password or a "service account" JSON file with anyone.

---

## A. Create the Firebase project

1. Go to **console.firebase.google.com** and sign in with a Google account that the Trust owns (not a personal one, so access survives staff changes).
2. **Create a project** → name it `kcct-capture` → turn **Google Analytics off** → **Create project**.
3. Left menu **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save**.
4. Left menu **Build → Firestore Database → Create database**.
   - Location: pick the closest (for example `africa-south1` Johannesburg, or `eur3`). This cannot be changed later.
   - Choose **Start in production mode** → **Create**.
5. Open the **Rules** tab. Delete everything, paste the full contents of `firebase/firestore.rules`, click **Publish**.
6. **Add your staff.**
   - **Authentication → Users → Add user**: enter their email and a password. Repeat for each person.
   - **Firestore Database → Data → Start collection**: Collection ID `staff`.
     Document ID = the person's email **in lower case** (for example `mary@kcct.org`).
     Add a field `role` (string) with one of: `admin`, `clinician`, `collector`. Add another field `name` if you like.
   - Roles: **collector** can register patients and record stages. **clinician** can also see names and phone numbers. **admin** can also delete records.
   - Someone with a login but no `staff` document sees "not on the staff list" and can read nothing.

## B. Paste the keys into the app

1. Firebase console → click the **gear icon → Project settings → General**.
2. Scroll to **Your apps → click the `</>` (Web) icon** → nickname `KCCT Capture` → leave "Firebase Hosting" unticked → **Register app**.
3. You will see a block starting `const firebaseConfig = { apiKey: "...", ... }`. Copy the values.
4. Open `app/js/config.js` in any text editor and replace each `PASTE_...` value:

```js
firebase: {
  apiKey: 'AIza...',
  authDomain: 'kcct-capture.firebaseapp.com',
  projectId: 'kcct-capture',
  storageBucket: 'kcct-capture.firebasestorage.app',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abc123',
},
```

While those still say `PASTE_...` the app runs in **demo mode** (data stays on the phone). That is deliberate, so you can try everything first.

## C. Put it online and get the APK (free, from your browser)

1. Create a free account at **github.com** and click **New repository** → name `kcct-capture` → **Public** → Create.
   (It must be public for free web hosting. The repository holds only the app and your Firebase web keys, never patient data.)
2. Click **uploading an existing file** and drag in the **contents** of the `kcct-capture` folder, including the hidden `.github` folder. Commit.
   If the `.github` folder will not drag in: **Add file → Create new file**, type `.github/workflows/build.yml`, paste in the file's contents, commit.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
4. Open the **Actions** tab → **Build KCCT Capture** → **Run workflow**. Wait 5–10 minutes.
5. When it turns green:
   - **APK**: open the run → scroll to **Artifacts** → download **KCCT-Capture-APK** (a zip containing `app-debug.apk`).
   - **Web link**: the `pages` job shows the address, like `https://yourname.github.io/kcct-capture/`.

> I could not run this build myself (my workspace cannot download the Android build tools), so the workflow is untested. If a run fails, open it, copy the red error text, and send it to me. The usual fix is one line.

**Alternative APK route:** go to **pwabuilder.com**, paste the web link from step 5, choose **Android**, download the package. No GitHub Actions needed.

## D. Install on an Android phone

**Option 1, the APK:** send `app-debug.apk` to the phone (WhatsApp, Drive, USB). Tap it. If asked, allow **Install unknown apps** for that app. Open **KCCT Capture**.
**Option 2, no APK at all:** open the web link in Chrome on the phone → ⋮ menu → **Install app** (or **Add to Home screen**). It then behaves like an installed app and works offline.

First launch: connect to the internet, sign in, then fill **This phone's setup** (site, 3-letter code, county, your initials). You only do this once per camp.

---

## How it behaves in the field

- **Offline**: forms save on the phone and upload automatically when a signal returns. The top-right badge shows "All saved" or "Syncing 3".
- **Participant ID**: `KCT-NGT-261028-A07-4` = site, date, phone letter + running number, check digit. The check digit catches typing mistakes.
- **Names and phone numbers** go into a separate `contacts` collection. The analysis CSV never contains them.
- **Updating the app later**: edit files in GitHub, change `VERSION` in `app/sw.js` (for example to `v2`), re-run the workflow. Phones update next time they open it online.

## Costs

Firebase's free plan (Spark) covers roughly 50,000 reads and 20,000 writes a day, plenty for a screening programme of a few thousand women. If usage grows, the paid plan is pay-as-you-go.

## Adding or changing questions

Everything is in `app/js/schema.js`. Add a line, save, redeploy. The form, analytics inputs, CSV export and the data dictionary all pick it up.

## Optional later: an LLM-written analytics summary

The AI Analytics tab runs statistical rules on the phone, so no patient data leaves the device. To add a language-model summary of **aggregated numbers only**, put a small Firebase Cloud Function between the app and the Claude API so the API key never sits in the app. That needs the Blaze (pay-as-you-go) plan.
