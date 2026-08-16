# 🧪 Foodie on TestFlight — share a link with friends

Goal: your friends tap a link, install TestFlight, and get Foodie on their iPhone.
No App Store submission, no adding people one at a time.

That link is a **TestFlight public link**, and it belongs to an **external tester
group**. This runbook gets you there.

> **The one thing you can't skip:** the first build you send to an external group
> goes through Apple's **Beta App Review**. It's much lighter than App Store
> review — usually a few hours, occasionally up to a day. After that, new builds
> of the same version go out to your friends immediately.
>
> **Want something in the next 10 minutes instead?** See
> [Shortcut: internal testers](#shortcut-internal-testers-no-review) at the bottom.

---

## What you need

- A **Mac** with **Xcode 16+**, opened once (license accepted).
- An active **Apple Developer Program** membership ($99/yr).
- ~45 min for one-time setup. After that, shipping an update is one command.

---

## Part A — One-time setup

### 1. Install the toolchain

```bash
cd ios
gem install bundler          # if you don't have it
bundle install               # installs fastlane, generates Gemfile.lock
bundle exec fastlane --version
```

Commit the lock file so future installs are reproducible:

```bash
bundle lock --add-platform arm64-darwin x86_64-darwin
git add ios/Gemfile.lock && git commit -m "Add Gemfile.lock"
```

### 2. Create an App Store Connect API key

This is how Fastlane uploads without your password or 2FA prompts.

1. [App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
2. **+** → name it `Fastlane` → role **App Manager** → **Generate**
3. **Download the `.p8`** — you only get one chance. Note the **Key ID** (10 chars)
   and the **Issuer ID** (UUID at the top of the page).
4. Park it in the gitignored folder:
   ```bash
   mv ~/Downloads/AuthKey_*.p8 ios/fastlane/private/
   ```

### 3. Grab your Team ID

[developer.apple.com/account](https://developer.apple.com/account) → **Membership details** → **Team ID**.

### 4. Pick a bundle ID and create the app record

Your bundle ID has to be globally unique and owned by you — e.g.
`com.mattcurschman.Foodie`. The repo currently uses the placeholder
`com.example.Foodie`, which will **not** work.

In [App Store Connect → Apps → **+** → New App](https://appstoreconnect.apple.com/apps):

| Field | Value |
| --- | --- |
| Platform | iOS |
| Name | Anything unique on the App Store (e.g. `Foodie Calorie Log`) |
| Primary language | English (U.S.) |
| Bundle ID | your bundle ID — pick it from the dropdown, or **Register a new one** first at [Identifiers](https://developer.apple.com/account/resources/identifiers/list) |
| SKU | any string, e.g. `foodie-001` |

> You need the app record even for TestFlight-only distribution. You do **not**
> need screenshots, a description, or an App Store submission.

### 5. Fill in your config

```bash
cp ios/fastlane/.env.example ios/fastlane/.env
```

Edit `ios/fastlane/.env`:

```
APP_IDENTIFIER=com.yourname.Foodie
DEV_TEAM_ID=ABCDE12345
ASC_KEY_ID=XXXXXXXXXX
ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ASC_KEY_PATH=./fastlane/private/AuthKey_XXXXXXXXXX.p8

TESTFLIGHT_GROUP=Friends
BETA_CONTACT_NAME=Your Name
BETA_CONTACT_EMAIL=you@example.com
BETA_CONTACT_PHONE=+15555550123
BETA_FEEDBACK_EMAIL=you@example.com
```

`.env` and the `.p8` are gitignored. Keep them that way.

### 6. Write your identity into the Xcode project

```bash
cd ios
bundle exec fastlane setup
git add -A && git commit -m "Configure signing"
```

This turns on automatic signing with your team and replaces `com.example.Foodie`
everywhere with your real bundle ID.

### 7. Confirm it all works before you build

```bash
bundle exec fastlane preflight
```

This checks your `.env`, confirms the project's bundle ID is no longer the
placeholder, and calls App Store Connect — which proves both that your API key
works and that the app record exists. It tells you exactly what's missing if
something isn't right.

---

## Part B — Ship it

```bash
cd ios
bundle exec fastlane friends
```

What happens, in order:

1. Build number is set to (latest on TestFlight + 1) — starts at 1.
2. Release build + archive, signed automatically.
3. Upload to App Store Connect.
4. **Wait for Apple to process the binary** (~5–15 min — this is why the lane
   takes longer than a plain upload; external distribution needs a processed build).
5. Create/find the `Friends` group and hand it the build, with the beta review
   info and "What to Test" text filled in.

If it's the first build for this version, it now sits in **Beta App Review**.
You'll get an email when it's approved.

### Get the link

[App Store Connect](https://appstoreconnect.apple.com/apps) → your app →
**TestFlight** → **Friends** (under Testers and Groups) → **Public Link** →
**Enable Public Link**.

You get a URL like `https://testflight.apple.com/join/xxxxxxxx`. That's the one
you text your friends. Optionally cap how many people can use it (default is up
to 10,000).

> Enabling the public link is a manual toggle — Apple provides no API for it, so
> Fastlane can't do it. You only do it once; the link stays stable across builds.

### What your friends do

1. Tap the link on their iPhone.
2. Install **TestFlight** from the App Store if prompted.
3. Tap **Install** inside TestFlight.

They need iOS 17 or newer. They don't need a developer account, and you don't
need their email or device UDID.

---

## Shipping updates

```bash
cd ios
# optional: describe what changed for testers
TESTFLIGHT_CHANGELOG="Fixed the ring animation, added protein totals." \
  bundle exec fastlane friends
```

Build number auto-increments; testers get a push notification. Same-version
builds skip Beta App Review, so it's live as soon as processing finishes.

Bumping `MARKETING_VERSION` (e.g. 1.0 → 1.1) in the target's build settings
triggers one more Beta App Review for that new version.

**Builds expire after 90 days.** Push a fresh one before then or the app stops
launching for your testers.

---

## Shortcut: internal testers (no review)

If you just want a couple of people on it *today* and don't mind the friction:
**internal testers** skip Beta App Review entirely — a build is available minutes
after processing.

The catch: each internal tester needs to be added as a user on your App Store
Connect team (Users and Access → **+** → role **Customer Support** is enough),
and they have to accept an email invite. Up to 100 people. There's no public link.

```bash
cd ios
bundle exec fastlane beta        # uploads without waiting; internal testers only
```

Then App Store Connect → TestFlight → **Internal Testing** → add the group/testers.

For actual friends, the public link is worth the one-time review wait.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `No signing certificate` / provisioning errors | Sign into your Apple account in **Xcode → Settings → Accounts**. Automatic signing needs it, and the Mac needs to be online. |
| `preflight` says the app record isn't found | Create the app in App Store Connect (step 4) with the exact bundle ID from `.env`. |
| Build stuck on "Missing Compliance" | Shouldn't happen — `ITSAppUsesNonExemptEncryption = NO` is baked into the project. If it does, answer the encryption question in App Store Connect (answer: no non-exempt encryption). |
| Upload succeeded but the lane failed at distribution | The build is already up. Re-run just the distribution: `bundle exec fastlane friends_distribute` |
| "Beta App Review" rejected for missing info | Fill in **TestFlight → Test Information** (feedback email, description, contact) in App Store Connect, then resubmit the build there. |
| Testers see "This beta isn't accepting new testers" | The public link is disabled or hit its tester cap. Re-enable / raise the cap under the group's Public Link. |
| Tester's iPhone is too old | Deployment target is iOS 17. Lower `IPHONEOS_DEPLOYMENT_TARGET` if you need older devices. |
| `bundle: command not found` | `gem install bundler`, then `cd ios && bundle install`. |

---

Related runbooks:
- [`CI_SETUP.md`](CI_SETUP.md) — ship TestFlight builds from GitHub Actions so you
  don't need the Mac for routine updates.
- [`DEPLOY.md`](DEPLOY.md) — App Store submission (the real, public launch).
