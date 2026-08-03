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
- Animated daily progress ring vs. an editable calorie goal (turns red when over)
- One-tap re-add of recent foods
- Browse previous days (chevrons; tap the date to jump back to Today)
- Swipe/tap to delete entries
- Data stored **locally** as JSON in the app's Documents dir — nothing leaves the phone
- Export / import a JSON backup (via the share sheet & Files)
- Automatic light & dark mode; iPhone + iPad

### Tech
- **SwiftUI**, `ObservableObject` store, `Codable` persistence to a JSON file
- No third-party packages — pure Apple frameworks
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
A full Fastlane deploy pipeline is set up — see **[`ios/DEPLOY.md`](ios/DEPLOY.md)**
for the step-by-step runbook. Quick version, from `ios/`:
```bash
bundle install
bundle exec fastlane setup      # one-time: your Team ID + Bundle ID
bundle exec fastlane release    # build + upload + submit for review
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
    ├── AddFoodView.swift       # Add-food card + recent chips
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

## Web PWA (`web/`) — the free fallback

Add-to-home-screen web app, no App Store needed. Test locally:
```bash
cd web && python3 -m http.server 8000   # open http://localhost:8000
```
To install on a phone it must be served over **HTTPS** (free static hosts:
GitHub Pages, Cloudflare Pages, Netlify, Vercel). Then in Safari:
**Share → Add to Home Screen**.

---

## Alternatives that could improve the app

The app is deliberately free and self-contained. Here's a menu of upgrades,
grouped by what they buy you. **(free tier)** = has a no-cost way to start.

### 1. Food database & barcode scanning (biggest UX win)
Stop typing calories — look them up.

| Option | Cost | Notes |
| --- | --- | --- |
| **Open Food Facts API** | **Free / open** | Huge crowd-sourced product DB with barcodes & macros, no key. Best free upgrade. |
| **USDA FoodData Central** | **Free (key)** | Authoritative US nutrition data. |
| **Nutritionix API** | (free tier) | Natural-language logging ("2 eggs and toast") + restaurant items. |
| **Edamam / FatSecret** | (free tier) | Recipe/food parsing, large branded DBs. |

On iOS, barcode scanning is **free & native** via **VisionKit `DataScannerViewController`**
or **AVFoundation** metadata capture — no third-party SDK needed.

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

### Suggested first three upgrades
1. **Open Food Facts + VisionKit barcode scan** — kills manual entry (free).
2. **HealthKit + iCloud (SwiftData + CloudKit)** — native sync & Health integration (free).
3. **Swift Charts** — trends and history, zero dependencies (free).

---

Free, private, and offline by default — native on iOS, with a clear paid/optional
upgrade path only if and when you want it.
