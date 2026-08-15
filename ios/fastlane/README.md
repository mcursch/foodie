fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios setup

```sh
[bundle exec] fastlane ios setup
```

Write your Team ID + Bundle ID into the Xcode project (one time)

### ios preflight

```sh
[bundle exec] fastlane ios preflight
```

Check that your Apple setup is complete before you try to build

### ios friends

```sh
[bundle exec] fastlane ios friends
```

Build and ship to the external TestFlight group (the shareable-link path)

### ios friends_distribute

```sh
[bundle exec] fastlane ios friends_distribute
```

Distribute an ALREADY-uploaded build to the external group (no rebuild)

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Build and upload a new build to TestFlight (internal testers only)

### ios release

```sh
[bundle exec] fastlane ios release
```

Build, upload, and submit for App Store review

### ios submit

```sh
[bundle exec] fastlane ios submit
```

Submit an already-uploaded build for review (no rebuild)

### ios certificates

```sh
[bundle exec] fastlane ios certificates
```

One-time: create/store the distribution cert + profile in the match repo

### ios ci_beta

```sh
[bundle exec] fastlane ios ci_beta
```

CI: build + upload to TestFlight using match signing

### ios ci_friends

```sh
[bundle exec] fastlane ios ci_friends
```

CI: build + ship to the external TestFlight group using match signing

### ios ci_release

```sh
[bundle exec] fastlane ios ci_release
```

CI: build + upload + submit for App Store review using match signing

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
