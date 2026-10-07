# ADR-0008: Build the mobile app locally, without an Expo account

- Status: Accepted (owner decision, 2026-10-08)
- Date: 2026-10-08
- Spec sections: §2 (Mobile), §13.1, §13.3, §16.1, §16.2
- Amends: §2 Mobile row (EAS Build/Update), §13.1 environments bullet, §13.3 OTA bullet, §16.1 Mobile row,
  §16.2 mobile releases bullet

## Context

The spec pins EAS Build and EAS Update, which need an Expo account. The owner wants to build the app themselves with
no Expo account.

## Decision

- **Continuous Native Generation, built locally.** `expo prebuild` generates `android/` and `ios/` from
  `app.config.ts`; both folders are git-ignored and never edited by hand. Native changes are made through app config
  and config plugins only.
- **Variants** come from `env/<variant>.env` (public values only; per-machine overrides in git-ignored
  `env/<variant>.local.env`), applied by `scripts/with-variant.mjs`. The three side-by-side installs from §13.1 stay:
  `com.learnvianotes.dev`, `com.learnvianotes.sandbox`, `com.learnvianotes`.
- **Android:** `pnpm build:android <variant>` → `expo prebuild --clean` → Gradle `assembleRelease` → APK in `dist/`.
  Until a store upload key exists, release builds are signed with the debug keystore: fine for installing on phones,
  not accepted by Google Play. Store signing is added before the first store release through a config plugin that
  reads the keystore path and passwords from the developer's `~/.gradle/gradle.properties` (never the repo).
- **iOS:** `expo run:ios --configuration Release` on a Mac with Xcode. A free Apple ID can install on your own
  device (7-day profiles) but cannot sign Associated Domains (universal links) or push; TestFlight and the App Store
  need the paid Apple Developer Program — an Apple account, not an Expo one.
- **No over-the-air updates for now.** Every change ships as a new build. If OTA is wanted later, `expo-updates` with a
  self-hosted update server (the open Expo Updates protocol) works without an Expo account — new ADR at that time.
- **CI** builds the sandbox APK on GitHub Actions for every push to `main` and keeps it as a downloadable artifact.
- **Releases:** Google Play Console (internal track → staged rollout 10 % → 50 % → 100 %, crash-rate gate < 0.5 %
  as §16.2) and Xcode Organizer / Transporter for iOS, uploaded by hand.

## Consequences

- No Expo account, no EAS cost; builds are reproducible from the repo plus a local toolchain (JDK 17+, Android SDK;
  Xcode for iOS).
- Hotfixes need a store review instead of an OTA push. Staged rollout still comes from the stores.
- Universal links on iOS wait for the paid Apple membership; the `learnvianotes://` scheme works meanwhile.
