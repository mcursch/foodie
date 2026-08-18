# 🍎 Foodie — a calorie tracker for iOS

A basic calorie + macro tracker for iPhone. Two builds live in this repo:

- **`ios/` — native SwiftUI app (primary).** A real App Store app you build in
  Xcode and can submit with your Apple Developer account. This is the main
  deliverable.
- **`web/` — the original PWA (free fallback).** A zero-cost web version you can
  add to the home screen without the App Store. Handy for quick testing or if you
  ever want a no-account, cross-platform option.

Everything here is built with **free tooling** (Xcode is free; the app has no
paid dependencies, no server, no accounts). The only paid piece is Apple's
**$99/yr Developer Program** — which you already have — needed to ship to the App
Store.

---

## Native iOS app (`ios/`)

### What it does (all on-device, all free)
- Log foods with calories + optional protein / carbs / fat
- **Search foods** — a bundled table of ~145 common whole foods (instant, offline)
  plus branded products from Open Food Facts
- **Barcode scanner** — VisionKit `DataScannerViewController`; scan a package and
  the calories/macros fill themselves in
- Portion picker with sensible servings ("1 medium banana", "1 tbsp") or a custom
  gram weight, with a live macro preview
- Animated daily progress ring vs. an editable calorie goal (turns red when over)
- One-tap re-add of recent foods
- Browse previous days (chevrons; tap the date to jump back to Today)
- Swipe/tap to delete entries
- Data stored **locally** as JSON in the app's Documents dir — your log never leaves the phone
- Export / import a JSON backup (via the share sheet & Files)
- Automatic light & dark mode; iPhone (iPad support easy to re-enable later)

### Tech
- **SwiftUI**, `ObservableObject` store, `Codable` persistence to a JSON file
- No third-party packages — pure Apple frameworks (VisionKit for scanning)
- Requires the **camera** permission, prompted only on first tap of Scan
- Deployment target **iOS 17.0**
- Requires **Xcode 16 or newer** (the project uses file-system synchronized groups)

### Build & run it (on your Mac)
```bash
open ios/Foodie.xcodeproj
```
1. In Xcode, select the **Foodie** target → **Signing & Capabilities**.
2. Set your **Team** (your Apple Developer account) and change the
   **Bundle Identifier** from `com.example.Foodie` to something you own,
   e.g. `com.yourname.Foodie`.
3. Pick a simulator or your iPhone and press **⌘R**.

> If the project ever fails to open on a different Xcode version, regenerate it:
> ```bash
> brew install xcodegen && cd ios && xcodegen generate
> ```
> (`ios/project.yml` is the spec.)

### Ship it (deploy pipeline)
A full Fastlane deploy pipeline is set up. Two runbooks:

- **[`ios/TESTFLIGHT.md`](ios/TESTFLIGHT.md)** — get it on friends' phones via a
  shareable TestFlight link. No App Store submission needed.
- **[`ios/DEPLOY.md`](ios/DEPLOY.md)** — the full App Store launch.
- **[`ios/CI_SETUP.md`](ios/CI_SETUP.md)** — one-time setup to deploy from GitHub
  Actions instead of your Mac.

Quick version, from `ios/`:
```bash
bundle install
bundle exec fastlane setup      # one-time: your Team ID + Bundle ID
bundle exec fastlane preflight  # verify the setup before building
bundle exec fastlane friends    # build + ship to TestFlight (shareable link)
bundle exec fastlane release    # build + upload + submit for App Store review
```
For hands-off updates, a **GitHub Actions** workflow
(`.github/workflows/ios-release.yml`) deploys on a pushed `v*` tag using Fastlane
match. Setup + required secrets are in `ios/DEPLOY.md`.

### Submit to the App Store (manual, via Xcode)
1. Bump **MARKETING_VERSION** / build number if needed (target build settings).
2. **Product → Archive**, then **Distribute App → App Store Connect**.
3. In [App Store Connect](https://appstoreconnect.apple.com), create the app
   record (same bundle ID), fill in metadata + screenshots, attach the build,
   and submit for review.

The 1024×1024 App Store icon is already generated (opaque, no alpha — as Apple
requires) at `ios/Foodie/Assets.xcassets/AppIcon.appiconset/icon-1024.png`.

### Project layout
```
ios/
├── Foodie.xcodeproj/           # Xcode project (synchronized-group format)
├── project.yml                 # XcodeGen spec (fallback regenerator)
└── Foodie/
    ├── FoodieApp.swift         # @main entry + brand color
    ├── Models.swift            # FoodEntry, Totals, Snapshot (Codable)
    ├── FoodStore.swift         # ObservableObject + JSON persistence
    ├── ContentView.swift       # Main screen: summary, log, date nav
    ├── AddFoodView.swift       # Add-food card + recent chips + search/scan buttons
    ├── FoodSearch.swift        # Search models + Open Food Facts client
    ├── FoodSearchView.swift    # Search sheet + portion picker
    ├── BarcodeScannerView.swift# VisionKit scanner (+ typed-barcode fallback)
    ├── CommonFoods.swift       # GENERATED — see scripts/gen_foods.py
    ├── RingView.swift          # Progress ring + macro columns
    ├── SettingsView.swift      # Goal, export/import, about
    ├── Assets.xcassets/        # AppIcon (1024) + AccentColor
    └── Preview Content/
```

### Regenerate icons (optional)
```bash
python3 scripts/gen_icons.py   # writes web/icons/* AND the iOS 1024 app icon
```

---

## Food data

Two sources, both free, neither needing an API key or having a monthly quota.

| Source | Used for | Where |
| --- | --- | --- |
| **Bundled table** (`data/common_foods.json`) | ~145 common whole foods, per 100 g, with typical servings | Compiled into both apps; instant and offline |
| **[Open Food Facts](https://world.openfoodfacts.org)** | Branded products and all barcode lookups | Live API, no key |

### Editing the bundled table
`data/common_foods.json` is the single source of truth. After editing it:

```bash
python3 scripts/gen_foods.py   # rewrites web/foods.js AND ios/Foodie/CommonFoods.swift
```

Both generated files are committed, so neither app needs a build step. The script
validates ids and serving weights and fails loudly on a typo.

### Open Food Facts endpoint notes (why the code looks like it does)
OFF exposes two text-search endpoints and they fail in opposite ways, which is
why each platform picks a different one:

- `search.openfoodfacts.org/search` — fast and reliable, but sends **no
  `Access-Control-Allow-Origin` header**, so a browser can't call it. The iOS app
  uses it (URLSession has no CORS).
- `world.openfoodfacts.org/cgi/search.pl` — proper CORS, but sheds load with a
  **503** under pressure. The web app uses it, with one automatic retry.

Barcode lookups use `world.openfoodfacts.org/api/v2/product/<code>.json`, which is
both CORS-enabled and reliable, on both platforms.

OFF asks clients to send an identifying `User-Agent`; the iOS app does. Browsers
forbid setting that header, so the web app can't and doesn't need to.

### Attribution (required)
Open Food Facts product data is © its contributors and licensed under the
**[ODbL](https://opendatacommons.org/licenses/odbl/)**. The attribution is shown
in-app (iOS Settings → Food data; web Settings sheet) and in `web/privacy.html`.
Common-food values come from **USDA FoodData Central** (public domain).

---

## Web PWA (`web/`) — the free fallback

Add-to-home-screen web app, no App Store needed. Test locally:
```bash
cd web && python3 -m http.server 8000   # open http://localhost:8000
```
To install on a phone it must be served over **HTTPS** (free static hosts:
GitHub Pages, Cloudflare Pages, Netlify, Vercel). Then in Safari:
**Share → Add to Home Screen**.

The PWA has the same search and scanner as the native app. Camera access needs a
**secure context**, so scanning works on `https://` and `http://localhost` but not
over plain `http://` on a LAN address — the scanner falls back to typing the
barcode number there.

```
web/
├── index.html          # markup incl. the search + portion sheets
├── app.js              # state, rendering, sheet wiring
├── foodsearch.js       # bundled-table search + Open Food Facts client
├── scanner.js          # camera + barcode decoding
├── foods.js            # GENERATED — see scripts/gen_foods.py
├── vendor/zxing.min.js # vendored @zxing/library 0.21.3 UMD (~336 KB, ~90 KB gzipped)
├── styles.css
└── sw.js               # offline shell — bump CACHE when shell files change
```

**Why ZXing is vendored:** Safari has no `BarcodeDetector` API, so iOS needs a JS
decoder. `scanner.js` uses the native detector where it exists (Chrome, Edge,
Android) and only loads ZXing otherwise — lazily, on first scan, so page load
never pays for it. It's committed rather than pulled from a CDN so the app stays
offline-capable and dependency-free.

> ⚠️ `sw.js` serves same-origin GETs **cache-first**, so any change to
> `index.html` / `app.js` / `styles.css` / the new modules needs `CACHE` bumped
> (`foodie-v2` → `foodie-v3`) or returning users keep the old build.

---

## Alternatives that could improve the app

The app is deliberately free and self-contained. Here's a menu of upgrades,
grouped by what they buy you. **(free tier)** = has a no-cost way to start.

### 1. ~~Food database & barcode scanning~~ ✅ done
Shipped — see [Food data](#food-data) above. Bundled common foods + Open Food
Facts, with VisionKit scanning on iOS and ZXing in the PWA.

Still open if you want to go further:

| Option | Cost | Notes |
| --- | --- | --- |
| **USDA FoodData Central** | **Free (key)** | Authoritative generic foods, far beyond the bundled 145. Needs a key embedded in the client. |
| **Nutritionix API** | (free tier) | Natural-language logging ("2 eggs and toast") + restaurant items. |
| **Edamam / FatSecret** | (free tier) | Recipe/food parsing, large branded DBs. |

### 2. Apple platform integrations (you have the Developer account — use it)
- **HealthKit** — read weight/activity, write nutrition (energy + macros) back to
  the Health app. Free framework; needs the HealthKit capability + usage strings.
- **WidgetKit** — a home-screen widget showing calories remaining. Free.
- **App Intents / Siri & Shortcuts** — "log 200 calories" by voice. Free.
- **iCloud + SwiftData / Core Data + CloudKit** — free sync across the user's own
  devices using their iCloud (no backend to run). Great first "sync" step.
- **Live Activities / Dynamic Island** — live daily progress. Free.

### 3. Cloud sync & accounts (multi-user / cross-platform)
Only needed if you want non-iCloud accounts or an Android/web client too:
- **Supabase** (free tier) — Postgres + auth + realtime.
- **Firebase** (free Spark tier) — Firestore + auth, easy offline sync.
- **CloudKit** (above) is the cheapest if you stay Apple-only.

### 4. Smarter logging
- **AI food logging** — photograph or describe a meal and estimate calories/macros
  via the **Claude API** (vision + natural language). Small text/image calls are
  cheap; a great "photo → macros" feature.
- **Speech-to-text** logging via `SFSpeechRecognizer` (free).

### 5. Richer insights & charts
- **Swift Charts** (built-in, free) — weekly/monthly trends, macro breakdowns,
  weight-vs-intake. No dependency needed.
- **SwiftData** instead of a JSON file — for years of history with fast queries.

### 6. Reminders & retention
- **UserNotifications** (free) — local meal-time reminders.
- **Push via APNs** — free from Apple; you only need a tiny server (or a free
  Cloudflare Worker) to send.

### 7. Quality & distribution
- **XCTest / Swift Testing** (free) — unit + UI tests.
- **TestFlight** (free with your account) — beta distribution before release.
- **Fastlane** (free) — automate screenshots, signing, and App Store uploads.

### Suggested next upgrades
1. ~~**Open Food Facts + VisionKit barcode scan**~~ — done.
2. **HealthKit + iCloud (SwiftData + CloudKit)** — native sync & Health integration (free).
3. **Swift Charts** — trends and history, zero dependencies (free).

---

Free, private, and offline by default — native on iOS, with a clear paid/optional
upgrade path only if and when you want it.
