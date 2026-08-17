# App Store Listing — Foodie

Copy-paste-ready draft for the App Store Connect fields. Character limits noted.
The same text also lives in `ios/fastlane/metadata/en-US/` so Fastlane can manage
it automatically later (flip `skip_metadata: false` in the Fastfile).

---

## App name (max 30 chars)
> "Foodie" alone is almost certainly taken. Pick a unique full name — recommended:

**`Foodie: Calorie & Macro Log`**  *(27 chars)*

Alternates if that's taken:
- `Foodie — Calorie Tracker` (24)
- `Foodie Calorie & Macro` (22)
- `Calorie Log: Foodie` (19)

> Check availability while creating the app record in App Store Connect.

## Subtitle (max 30 chars)
**`Private calorie & macro log`**  *(27 chars)*

## Promotional text (max 170 chars — editable anytime without review)
**`Track calories and macros in seconds — no account, no ads, no tracking. Search common foods or scan a barcode, and your food log stays private on your iPhone.`**  *(158 chars)*

## Description (max 4000 chars — plain text, no markdown)
```
Foodie is the simplest way to track what you eat — private, fast, and free.

Log your meals in seconds, set a daily calorie goal, and watch a clean progress ring fill as your day goes on. Add protein, carbs, and fat when you want the detail, or just track calories when you don't.

Don't want to type numbers? Search a built-in table of everyday foods, or scan a product's barcode and Foodie fills in the calories and macros for you.

Your food log stays on your iPhone. No account. No sign-up. No ads. No tracking.

FEATURES
• Quick add — log a food and its calories in seconds
• Search hundreds of common foods, with sensible portion sizes built in
• Barcode scanner — point the camera at a package and log it
• Daily calorie goal with an at-a-glance progress ring
• Optional protein, carbs & fat (macro) tracking
• One-tap re-add of foods you eat often
• Browse and edit previous days
• Automatic light & dark mode
• Export a backup of your data anytime
• Logging works fully offline — common foods are bundled in the app

PRIVACY
Foodie has no accounts and collects nothing about you. Your log, your goal, and your history never leave your device. Searching or scanning sends only that search word or barcode number to Open Food Facts, the free open food database — never your food log. If you never search or scan, Foodie makes no network requests at all.

Foodie is built for people who want a calorie tracker that respects their time and their privacy — no bloat, no paywalls, no data harvesting. Just open it, log your food, and get on with your day.

Product data from Open Food Facts, © its contributors, licensed under the ODbL. Common-food nutrition values from USDA FoodData Central.

Download Foodie and start tracking today.
```

## Keywords (max 100 chars — comma-separated, spaces count)
**`calorie,counter,macro,tracker,barcode,scanner,food,diary,nutrition,diet,protein,carbs,log,meal`**  *(94 chars)*

> Apple already indexes words in your app **name**, so don't waste keyword space
> on them. If your chosen name contains "Calorie/Macro/Tracker", swap those three
> out and add, e.g.: `journal,scanner,keto,vegan,gym,water`.

## What's New (release notes for 1.0)
```
Welcome to Foodie 1.0! Track calories and macros, set a daily goal, and watch your progress fill in. New: search hundreds of common foods, or scan a product barcode to fill in the numbers for you.
```

## URLs
- **Support URL** (required): `https://mcursch.github.io/foodie/`
- **Marketing URL** (optional): `https://mcursch.github.io/foodie/`
- **Privacy Policy URL** (required): `https://mcursch.github.io/foodie/privacy.html`

> These go live once you enable GitHub Pages (see below). Until then you can point
> Support URL at any page you control.

## Category
- **Primary:** Health & Fitness
- **Secondary (optional):** Food & Drink

## Age rating
Answer the questionnaire truthfully → resolves to **4+** (no objectionable content).

## App Privacy (data collection questionnaire)
Select **"No, we do not collect data from this app."** — still true. Foodie has no
analytics, no accounts, and no identifiers, and your food log never leaves the
device.

> Food search and barcode lookup do send the typed search word or the scanned
> barcode number to Open Food Facts. That is not "data collection" in Apple's
> sense — nothing is linked to the user or an identifier, and neither Foodie nor
> Open Food Facts retains it against a profile — so the questionnaire answer is
> unchanged. It *is* disclosed in `web/privacy.html` and in the description,
> which is what App Review checks against.

## Permissions (usage strings)
The app requests **camera** access, and only when you first tap Scan. The prompt
text lives in `INFOPLIST_KEY_NSCameraUsageDescription` (set in both
`Foodie.xcodeproj` and `ios/project.yml`):

> "Foodie uses the camera to scan product barcodes so it can fill in calories and
> macros for you."

Review rejects builds whose camera use isn't obvious from the UI — ours is behind
a clearly-labelled "Scan" button, so a screenshot of the scanner is worth
including.

## Pricing
Free.

---

## Hosting the privacy policy (required URL)

The privacy page (`web/privacy.html`) deploys via `.github/workflows/pages.yml`.

**One-time enable:** repo **Settings → Pages → Build and deployment → Source:
"GitHub Actions"**. Then it publishes automatically.

⚠️ **Plan requirement:** GitHub Pages from a **private** repo needs GitHub
**Pro/Team/Enterprise**. On the **Free** plan you have three options:
1. Make this repo **public** (the code is client-side + Swift; no secrets — those
   are gitignored), or
2. Create a small **public** repo just for the site and enable Pages there, or
3. Host `web/privacy.html` on any free static host (Netlify / Cloudflare Pages /
   Vercel) and use that URL.

> Also: edit the **support email** inside `web/privacy.html` before publishing —
> it currently has a placeholder (I didn't publish a personal address without
> your okay).

---

## Still needed before submit (not text you can paste)
- [ ] Compile the app once on a Mac (first real build)
- [ ] App Store Connect: API key + app record (unique name) + bundle id
- [ ] Enable Pages (or host privacy page) + set support email
- [ ] iPhone screenshots (6.9"/6.7") — **no iPad screenshots needed** (iPhone-only)
- [ ] Run `bundle exec fastlane release`

Full runbook: `ios/DEPLOY.md`.
