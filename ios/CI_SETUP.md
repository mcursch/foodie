# 🤖 Deploy without a Mac — one-time CI setup

After this, you edit code anywhere (WSL, a Chromebook, the GitHub web editor),
push, and click a button to ship a TestFlight build. Your Mac is only needed for
this checklist and for anything you need to *see* running.

**Time:** ~15 minutes, all on your Mac. Do it once.

**Prerequisite:** you've already shipped a build with `fastlane friends`, so
`ios/fastlane/.env` is filled in and your app record exists.

---

## Why this is needed

GitHub's macOS runners are wiped after every job and have no signing certificate,
so Xcode's automatic signing can't work there. **Fastlane match** solves it: your
distribution certificate and provisioning profile get encrypted and stored in a
private git repo, and CI pulls them onto the runner at build time.

Your local `fastlane friends` flow keeps working exactly as it does now — match
runs alongside it, not instead of it.

> `foodie` is a **public** repo, so macOS runner minutes are free. The certs repo
> below must be **private** — it holds your signing identity.

---

## Step 1 — Create the private certs repo

Empty, private, no README:

```bash
gh repo create foodie-certs --private
```

Or via the GitHub UI. Nothing else to do with it — match populates it.

## Step 2 — Add match config to `.env`

Append to `ios/fastlane/.env`:

```
MATCH_GIT_URL=https://github.com/mcursch/foodie-certs.git
MATCH_PASSWORD=<a strong passphrase you generate and save>
```

Put `MATCH_PASSWORD` in your password manager now. Lose it and the repo contents
are unrecoverable — you'd have to revoke the cert and start over.

## Step 3 — Populate it

```bash
cd ios
bundle exec fastlane certificates
```

Creates your App Store distribution certificate + provisioning profile (or reuses
existing ones) and pushes them encrypted to `foodie-certs`. It'll prompt for the
passphrase.

Sanity check — the repo should now contain `certs/` and `profiles/` folders of
`.cer`/`.mobileprovision` files with unreadable contents.

## Step 4 — Create a PAT for CI to read the certs repo

CI needs read access to a *private* repo, which `GITHUB_TOKEN` doesn't have.

1. [github.com/settings/tokens](https://github.com/settings/tokens) → **Fine-grained token**
2. Repository access: **Only select repositories** → `foodie-certs`
3. Permissions: **Contents → Read-only**
4. Generate, copy the token.

Encode it the way match expects (`user:token`, base64):

```bash
printf '%s' 'mcursch:github_pat_xxxxx' | base64
```

## Step 5 — Add the repo secrets

From the repo root, with your `.env` values at hand:

```bash
cd /path/to/foodie
KEYB64=$(base64 -i ios/fastlane/private/AuthKey_XXXXXXXXXX.p8)
AUTHB64=$(printf '%s' 'mcursch:github_pat_xxxxx' | base64)

gh secret set APP_IDENTIFIER                --body "com.yourname.Foodie"
gh secret set DEV_TEAM_ID                   --body "ABCDE12345"
gh secret set ASC_KEY_ID                    --body "XXXXXXXXXX"
gh secret set ASC_ISSUER_ID                 --body "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
gh secret set ASC_KEY_CONTENT               --body "$KEYB64"
gh secret set MATCH_GIT_URL                 --body "https://github.com/mcursch/foodie-certs.git"
gh secret set MATCH_PASSWORD                --body "your-match-passphrase"
gh secret set MATCH_GIT_BASIC_AUTHORIZATION --body "$AUTHB64"
gh secret set BETA_CONTACT_PHONE            --body "+15555550123"
```

Optional non-secret values (skip and the lane uses its defaults):

```bash
gh variable set TESTFLIGHT_GROUP    --body "Friends"
gh variable set BETA_CONTACT_NAME   --body "Matt Curschman"
gh variable set BETA_CONTACT_EMAIL  --body "you@example.com"
gh variable set BETA_FEEDBACK_EMAIL --body "you@example.com"
```

Or paste them all under **Settings → Secrets and variables → Actions**.

## Step 6 — Prove it works

GitHub → **Actions** → **iOS Release** → **Run workflow** → lane **`ci_friends`**.

~10 minutes: match pulls the cert, the app builds and uploads, Apple processes it,
and the build goes to your `Friends` group. Testers get a push notification.

If it fails, the workflow uploads build logs as an artifact.

---

## The everyday loop after this

From WSL:

```bash
# edit Swift, commit, push
git push
```

Then Actions → **iOS Release** → **Run workflow** → `ci_friends`.

Changelog text is baked into the lane's default. To customize per-build, edit
`TESTFLIGHT_CHANGELOG` as a repo variable before running, or keep using
`fastlane friends` from the Mac when you want it per-run.

Pushing to `main` also triggers the free signing-free compile check
(`.github/workflows/ci.yml`) whenever `ios/**` changes — that's your safety net
for coding Swift without a compiler.

---

## ⚠️ Gotchas

**A pushed `v*` tag submits to the App Store.** The workflow's tag trigger runs
`ci_release`, which uploads *and submits for review with auto-release on
approval*. While you're in TestFlight-only mode, don't push version tags. Use the
manual **Run workflow** button with `ci_friends`.

**CI rewrites signing settings during the build.** `apply_match_signing` flips the
project to manual signing on the runner. That's a throwaway checkout — it's never
committed, and your local automatic signing is untouched.

**Certificates expire yearly.** When CI starts failing on signing, run
`bundle exec fastlane certificates` on the Mac again to renew.

**Never commit `.env` or the `.p8`.** Both are gitignored, and this repo is public.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Couldn't find profile 'match AppStore ...'` | Step 3 didn't run, or ran against a different bundle id. Re-run `bundle exec fastlane certificates` on the Mac. |
| match can't clone the certs repo | `MATCH_GIT_BASIC_AUTHORIZATION` must be base64 of `username:token` with no trailing newline — use `printf`, not `echo`. Check the PAT still has Contents:Read on `foodie-certs`. |
| `Invalid password` / decrypt failure | `MATCH_PASSWORD` secret doesn't match the passphrase used in step 3. |
| `Authentication credentials are missing or invalid` | `ASC_KEY_CONTENT` is malformed. Re-run `base64 -i` on the `.p8` and re-set the secret. |
| Build succeeds, distribution fails | Build is already uploaded — run `bundle exec fastlane friends_distribute` from the Mac, or re-run the workflow. |
| Wrong Xcode on the runner | Pin `xcode-version` in `.github/workflows/ios-release.yml` instead of `latest-stable`. |

---

Related: [`TESTFLIGHT.md`](TESTFLIGHT.md) (share a link with friends) ·
[`DEPLOY.md`](DEPLOY.md) (App Store launch).
