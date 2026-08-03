# 🚀 Foodie — Deploy Runbook (ship today, update anytime)

This gets Foodie **built, signed, and submitted for App Store review today**, then
makes every future update a single command.

> **Honest timeline:** everything below is doable today. After you submit, the app
> enters **Apple App Review** — often under 24 hours (sometimes a few hours), but
> Apple controls the timing, so "live on the store" may land today or tomorrow. We
> turn on *auto-release after approval*, so it goes live the moment they approve —
> no second step from you.

The pipeline is **local Fastlane** with **Xcode automatic signing** (no CI, no
`match`, no certificates to juggle). You run it from your Mac.

---

## Part A — One-time setup (~30–45 min)

### 0. Prerequisites (on your Mac)
- **Xcode 16+** installed and opened once (accept the license).
- Command line tools: `xcode-select --install` (if not already).
- **Homebrew** + Ruby bundler:
  ```bash
  brew install rbenv ruby-build   # optional, for a clean Ruby; system Ruby also works
  gem install bundler
  ```
- Your **Apple Developer Program** membership is active.

### 1. Install Fastlane
```bash
cd ios
bundle install          # installs fastlane; also GENERATES ios/Gemfile.lock
bundle exec fastlane --version   # sanity check
```
Commit the generated lock so CI installs are reproducible. For CI runner platform
coverage, add the macOS platforms once:
```bash
bundle lock --add-platform arm64-darwin x86_64-darwin
git add ios/Gemfile.lock && git commit -m "Add Gemfile.lock"
```
> The lock isn't in the repo yet because it must be generated on macOS (to capture
> the `arm64-darwin` platform). This one-time step is all it needs.

### 2. Create an App Store Connect API key (used for uploads)
1. Go to [App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api).
2. Click **+**, name it "Fastlane", role **App Manager**, **Generate**.
3. **Download the `.p8` key** (you can only download it once) and note:
   - **Key ID** (10 chars)
   - **Issuer ID** (the UUID at the top of the page)
4. Move the key into the gitignored folder:
   ```bash
   mv ~/Downloads/AuthKey_XXXXXXXXXX.p8 ios/fastlane/private/
   ```

### 3. Find your Team ID
[developer.apple.com/account](https://developer.apple.com/account) → **Membership details** → **Team ID** (10 chars).

### 4. Fill in your environment file
```bash
cp ios/fastlane/.env.example ios/fastlane/.env
```
Edit `ios/fastlane/.env` with your `APP_IDENTIFIER`, `DEV_TEAM_ID`, `ASC_KEY_ID`,
`ASC_ISSUER_ID`, and the `.p8` path. **Pick a bundle id you own**, e.g.
`com.yourname.Foodie`.

> **App name availability:** the display name "Foodie" is likely taken on the App
> Store. Your **bundle id** just needs to be unique to you, but the **app name**
> shown on the store must be globally unique. Have a fallback ready (e.g.
> "Foodie — Calorie Log", "MyFoodie", "Foodie Cal"). You choose the store name in
> step 6; it's independent of the bundle id and the in-app name.

### 5. Register the Bundle ID + create the app record
- **Bundle ID:** with automatic signing, Xcode/Fastlane can register it for you on
  first build. To be safe you can pre-create it at
  [Certificates, IDs & Profiles → Identifiers](https://developer.apple.com/account/resources/identifiers/list).
- **App record:** in [App Store Connect → Apps → +](https://appstoreconnect.apple.com/apps)
  → **New App**:
  - Platform **iOS**, your **app name**, primary language, your **bundle id**,
    and an **SKU** (any string, e.g. `foodie-001`).

### 6. Write your Team ID + Bundle ID into the project
```bash
cd ios
bundle exec fastlane setup
```
This sets automatic signing + your team, and replaces the placeholder
`com.example.Foodie` with your real bundle id. Commit the change.

> Prefer clicking? Open `Foodie.xcodeproj`, select the **Foodie** target →
> **Signing & Capabilities** → set **Team** and **Bundle Identifier**. Same result.

---

## Part B — App Store listing (the parts only you can do) (~20–30 min)

These live in the App Store Connect web UI for your new app version
("1.0 Prepare for Submission"). Fastlane submits the build; you provide the
store content.

### 7. Screenshots (required)
Apple needs at least one screenshot at the **6.9" iPhone** size (1320×2868) — or
6.7" (1290×2796). Fastest way:
1. In Xcode, run the app on an **iPhone 16 Pro Max** simulator (⌘R).
2. Add a few entries so it looks alive.
3. **⌘S** in the simulator saves a screenshot to your Desktop (correct pixel size).
4. Capture 3–5 screens (summary ring, add-food, a filled log).
5. Upload them to the app version in App Store Connect.

> **Speed tip:** if you're iPhone-only for launch, you avoid iPad screenshots.
> To drop iPad now, set `TARGETED_DEVICE_FAMILY = 1` in the target build settings
> (you can re-enable iPad + add its screenshots in a later update).

### 8. Metadata
Fill in: **Description**, **Keywords**, **Support URL**, **Category** (Health &
Fitness → suggested), and **Privacy Policy URL**.
- A ready privacy policy is included: host `web/privacy.html` (e.g. GitHub Pages)
  and use that URL. Update the contact email inside it first.

### 9. App Privacy (easy win)
App Store Connect → your app → **App Privacy** → **Get Started** →
**"No, we do not collect data from this app."** (True — everything is on-device.)

### 10. Age rating & pricing
- **Age rating:** answer the questionnaire → **4+**.
- **Price:** Free (or set a tier).

### 11. Export compliance & IDFA
Already auto-answered by the pipeline (`export_compliance_uses_encryption: false`,
`add_id_info_uses_idfa: false`) — the app uses only standard HTTPS/none, so it's
exempt. No action needed.

---

## Part C — Ship it 🎉

```bash
cd ios
bundle exec fastlane release
```

This will:
1. Bump the build number (TestFlight latest + 1; starts at 1).
2. Build + archive with automatic signing (`-allowProvisioningUpdates`).
3. Upload the binary to App Store Connect.
4. Submit for review with **auto-release after approval** on.

> If the submit step runs before Apple finishes **processing** the binary (5–15
> min), just wait a bit and run the no-rebuild submit:
> ```bash
> bundle exec fastlane submit
> ```
> Or click **Submit for Review** in App Store Connect once the build appears.

**Optional dry run first:** push to TestFlight to confirm signing/upload works
before the real submission:
```bash
bundle exec fastlane beta
```

---

## Future updates (the "post updates as I feel fit" flow)

1. Make your code changes.
2. Bump the version if it's user-facing: set `MARKETING_VERSION` (e.g. `1.1`) in
   the target build settings, and create the new version in App Store Connect
   (Apps → your app → **+ Version**). Add your "What's New" text there.
3. Ship:
   ```bash
   cd ios && bundle exec fastlane release
   ```
The build number auto-increments; it uploads and resubmits, auto-releasing on
approval. That's the whole loop.

> Tiny fixes with no new version number → `fastlane beta` to push a TestFlight
> build for yourself, then promote when happy.

---

## GitHub Actions (optional — hands-off updates)

Local Fastlane is the fastest path for today's launch. Once you're set up, you can
*also* deploy from CI: push a tag `v1.1` and a macOS runner builds, signs, and
submits automatically.

> **Why the extra setup?** CI runners are ephemeral and have no signing
> certificate, so automatic signing can't work there. CI uses **Fastlane match**,
> which keeps your distribution cert + provisioning profile encrypted in a private
> git repo and pulls them onto the runner. Your local `fastlane release` flow is
> unchanged.
>
> **Cost note:** macOS runner minutes are billed at **10×** on private repos (free
> on public repos). A release run is a few minutes.

### One-time match setup (on your Mac)
1. Create a **private** git repo for your certs, e.g. `foodie-certs` (empty).
2. Add to `ios/fastlane/.env`:
   ```
   MATCH_GIT_URL=https://github.com/yourname/foodie-certs.git
   MATCH_PASSWORD=choose-a-strong-passphrase   # remember this
   ```
3. Populate it (creates your App Store distribution cert + profile and stores them):
   ```bash
   cd ios
   bundle exec fastlane certificates
   ```

### Add repository secrets (GitHub → repo → Settings → Secrets and variables → Actions)
| Secret | Value |
| --- | --- |
| `APP_IDENTIFIER` | your bundle id, e.g. `com.yourname.Foodie` |
| `DEV_TEAM_ID` | your 10-char Team ID |
| `ASC_KEY_ID` | App Store Connect API Key ID |
| `ASC_ISSUER_ID` | App Store Connect Issuer ID |
| `ASC_KEY_CONTENT` | the `.p8` as base64: `base64 -i ios/fastlane/private/AuthKey_*.p8` |
| `MATCH_GIT_URL` | your certs repo URL |
| `MATCH_PASSWORD` | the passphrase from above |
| `MATCH_GIT_BASIC_AUTHORIZATION` | base64 of `your-github-username:PAT` (a PAT with **repo** read access to the certs repo): `echo -n user:ghp_xxx \| base64` |

### Trigger it
- **Automatic:** tag a release and push it →
  ```bash
  git tag v1.0 && git push origin v1.0
  ```
  (runs `ci_release` → uploads + submits for review)
- **Manual:** GitHub → **Actions** → **iOS Release** → **Run workflow** → pick
  `ci_beta` (TestFlight) or `ci_release` (App Store).

> Screenshots + metadata still live in App Store Connect (same as local). CI only
> handles build → sign → upload → submit.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `No signing certificate` / provisioning errors | Ensure you're signed into your Apple account in **Xcode → Settings → Accounts**; automatic signing needs it. Re-run with the Mac online. |
| `Could not find scheme Foodie` | The shared scheme is committed at `Foodie.xcodeproj/xcshareddata/xcschemes/Foodie.xcscheme`; open the project in Xcode once, then retry. |
| `latest_testflight_build_number` errors on first run | Expected before the first upload — the pipeline catches it and starts at build 1. |
| Submit fails: "build is still processing" | Wait 5–15 min, then `bundle exec fastlane submit`. |
| "App name is already taken" | Change the **app name** in App Store Connect (bundle id can stay). |
| Missing privacy policy URL | Host `web/privacy.html` and paste its URL. |
| `bundle: command not found` | `gem install bundler`, then `cd ios && bundle install`. |
| CI: `Couldn't find profile 'match AppStore ...'` | Run `bundle exec fastlane certificates` locally first to populate the match repo. |
| CI: match can't access certs repo | Check `MATCH_GIT_BASIC_AUTHORIZATION` = base64 of `user:PAT`, and the PAT has read access to the certs repo. |
| CI: wrong Xcode version | Bump `xcode-version` / the `runs-on` image in `.github/workflows/ios-release.yml`. |

---

## What's already handled for you
- ✅ Shared scheme committed (headless builds find the target)
- ✅ `apple-generic` versioning enabled (build-number bumping works)
- ✅ App Store icon: 1024×1024, opaque, no alpha (Apple-compliant)
- ✅ Export compliance + IDFA answers automated in the submit step
- ✅ Secrets (`.env`, `.p8`) gitignored
- ✅ Privacy policy page ready to host
- ✅ Auto-release after approval enabled
