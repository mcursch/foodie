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
**`Track calories and macros in seconds — no account, no ads, no tracking. Your food log stays private on your iPhone, and it works completely offline.`**

## Description (max 4000 chars — plain text, no markdown)
```
Foodie is the simplest way to track what you eat — private, fast, and free.

Log your meals in seconds, set a daily calorie goal, and watch a clean progress ring fill as your day goes on. Add protein, carbs, and fat when you want the detail, or just track calories when you don't.

Everything stays on your iPhone. No account. No sign-up. No ads. No tracking. Foodie doesn't collect any data — your food log never leaves your device.

FEATURES
• Quick add — log a food and its calories in seconds
• Daily calorie goal with an at-a-glance progress ring
• Optional protein, carbs & fat (macro) tracking
• One-tap re-add of foods you eat often
• Browse and edit previous days
• Automatic light & dark mode
• Export a backup of your data anytime
• Works fully offline

Foodie is built for people who want a calorie tracker that respects their time and their privacy — no bloat, no paywalls, no data harvesting. Just open it, log your food, and get on with your day.

Download Foodie and start tracking today.
```

## Keywords (max 100 chars — comma-separated, spaces count)
**`calorie,counter,macro,tracker,food,diary,nutrition,diet,fasting,protein,carbs,health,weight,log,meal`**  *(100 chars)*

> Apple already indexes words in your app **name**, so don't waste keyword space
> on them. If your chosen name contains "Calorie/Macro/Tracker", swap those three
> out and add, e.g.: `journal,scanner,keto,vegan,gym,water`.

## What's New (release notes for 1.0)
```
Welcome to Foodie 1.0! Track calories and macros, set a daily goal, and watch your progress fill in — all private and offline. Thanks for trying it out.
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
Select **"No, we do not collect data from this app."** — true; everything is
stored locally on the device.

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
