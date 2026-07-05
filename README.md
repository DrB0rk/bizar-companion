# Bizar Companion

Android app for the Bizar dashboard.

## Status

**v1.1.0-beta.1** — beta. Requires Bizar dashboard **5.3.0 or later** (enforced at startup via `expo.extra.bizar.minSupportedDashboardVersion`).

## What it does

- Pair the app with a dashboard via QR code or manual URL entry.
- Paste the dashboard secret once; it's stored in `expo-secure-store` on the device.
- Live **Activity**, **Chat**, **Tasks**, **Settings**, and **More** tabs, with WebSocket-backed updates over the dashboard's `/ws` endpoint.

## Setup

```bash
npm install
npx expo start --android   # dev
```

## Build APK

Local `gradle` builds are **not supported on this machine** (no Android SDK / JDK 17 / `eas` available). The recommended path is the GitHub Actions release workflow — push a tag and the APK is built and released:

```bash
git tag v1.1.0-beta.1
git push origin v1.1.0-beta.1
```

For local builds on a machine that has the Android SDK + JDK 17 installed:

```bash
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleDebug
```

The release workflow in `.github/workflows/release.yml` injects `android:usesCleartextTraffic="true"` into `android/app/src/main/AndroidManifest.xml` after `expo prebuild` so the app can reach dashboards served over plain HTTP (e.g. LAN / Tailscale setups). If you build locally and need the same, do it manually or patch your prebuild config.

## Pair with dashboard

1. Start the Bizar dashboard (any way — `bizar` CLI, `bizar-dash`, etc.).
2. Open dashboard → **Settings** → **API** → **Reveal token** → copy the secret.
3. Open the companion app and choose one of:
   - **Scan QR**: tap **Pair Device** on the dashboard, scan the QR with the companion camera, then paste the dashboard secret on the next screen.
   - **Manual**: tap the **Manual** tab, paste the dashboard URL, then paste the dashboard secret.
4. The token is stored in `expo-secure-store`. To reconnect to a different dashboard, unpair from **Settings** and repeat.

See `DASHBOARD_CHANGES.md` for the long-term fix: a `/api/pair/exchange` endpoint on the dashboard that mints a scoped companion credential and avoids storing the operator's master secret on the device.

## Architecture

```
App.tsx
└── SafeAreaProvider
    └── ThemeProvider
        └── PairingProvider (SecureStore: {url, secret, pairedAt})
            └── RootNav (Stack: Pair | SecretEntry | Main)
                └── MainTabs (Bottom Tabs)
                    ├── ActivityScreen  ← REST /api/activity + WS
                    ├── ChatScreen      ← REST /api/chat + WS (chat:*)
                    ├── TasksScreen     ← REST /api/tasks + WS (tasks:*)
                    ├── SettingsScreen  ← /api/auth/status + /api/chat/sessions
                    └── MoreScreen
```

- **PairingProvider** stores `{url, secret, pairedAt}` (not a pair token — that's a one-time verify credential only).
- **api/client.ts** — `apiGet / apiPost / apiPut / apiPatch / apiDelete` add the Bearer header automatically. On 401, fires an `onUnauthorized` callback that opens the re-pair modal.
- **api/ws.ts** — singleton WebSocket to `/ws?token=<secret>`. Exposes `subscribe()` and `getSnapshot()`. Reconnects on close with exponential backoff (capped at 30 s).
- **hooks/useWsEvent / useWsSnapshot** — typed event subscriptions and snapshot hydration.

## Auth model

The companion uses the dashboard's long-lived secret as a Bearer token. Pair tokens (returned by `POST /api/pair/start`) are used **only** to verify the QR scan — they are then discarded. Storing the dashboard secret directly is intentional: it is the simplest workable model against the dashboard's current auth surface.

This is a workaround, not the recommended design. The dashboard should expose `/api/pair/exchange` (see `DASHBOARD_CHANGES.md`) which mints a scoped, 30-day companion credential that cannot reveal or rotate the operator's master secret. When that endpoint lands, the companion will switch to it automatically.

## Release process

1. Update version in `app.json` (`expo.version` AND `expo.android.versionCode` — bump `versionCode` on every release, even pre-releases).
2. Commit to `main`.
3. Tag and push: `git tag v1.1.0-beta.1 && git push origin v1.1.0-beta.1`.
4. The `release.yml` workflow builds the APK and creates a GitHub pre-release with the APK attached.

For local iteration without tagging, run the `release.yml` workflow manually via **Run workflow** in the Actions tab.

## Known limitations (v1.1.0-beta.1)

- **Debug APK only** — not signed for Play Store distribution. Manual install (sideload) required.
- **Single project view in Tasks** — server-side scoping by the active project; no in-app project picker yet.
- **Chat agent defaults to `odin`** (dashboard default); no agent picker yet.
- **QR scanner only** — no other barcode types.
- **Cleartext HTTP allowed** (`usesCleartextTraffic="true"` is injected by the release workflow after prebuild). Required for LAN / Tailscale deployments where the dashboard URL is `http://`.
- **`eas.json` is a placeholder** — no EAS account is bound, so v1.1.0-beta.1 ships via the GitHub Actions `gradle assembleDebug` path only. EAS Build can be enabled later by adding credentials.

## Type-check

```bash
npm run typecheck
```

CI runs this on every push and PR to `main` (`.github/workflows/ci.yml`). The release workflow does not run typecheck — it assumes `main` is green.