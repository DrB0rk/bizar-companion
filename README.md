# Bizar Companion

Android app for the Bizar dashboard.

## Status

**v1.2.0-beta.1** — beta. Requires Bizar dashboard **5.6.0 or later** (enforced at startup via `expo.extra.bizar.minSupportedDashboardVersion`).

## What it does

- Pair the app with a dashboard via QR code or manual URL entry.
- Paste the dashboard secret once; it's stored in `expo-secure-store` on the device.
- Live **Activity**, **Chat**, **Tasks**, **Agents** (background), **Alerts** (notifications), **Settings**, and **More** tabs.
- WebSocket-backed updates over the dashboard's `/ws` endpoint.
- Auto-reconnect with exponential backoff (capped at 30s).

## Tab overview

| Tab          | What it shows                                                   |
|--------------|-----------------------------------------------------------------|
| **Activity** | Dashboard activity stream (paginated, colour-coded by category)  |
| **Chat**     | Streaming chat with the active agent                            |
| **Tasks**    | All tasks grouped by status, project switcher                   |
| **Agents**   | Background-agent viewer — list, detail, pause/resume/steer/kill |
| **Alerts**   | Notifications — mark read, dismiss, mark-all-read              |
| **Settings** | Pairing info, connection diagnostics, dashboard version         |
| **More**     | Build info, link-outs to dashboard docs                         |

## Setup

```bash
npm install
npx expo start --android   # dev
```

## Build APK

Local `gradle` builds are **not supported on this machine** (no Android SDK / JDK 17 / `eas` available). The recommended path is the GitHub Actions release workflow — push a tag and the APK is built and released:

```bash
git tag v1.2.0-beta.1
git push origin v1.2.0-beta.1
```

For local builds on a machine that has the Android SDK + JDK 17 installed:

```bash
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleDebug
```

The release workflow in `.github/workflows/release.yml` injects `android:usesCleartextTraffic="true"` into `android/app/src/main/AndroidManifest.xml` after `expo prebuild` so the app can reach dashboards served over plain HTTP (e.g. LAN / Tailscale setups). If you build locally and need the same, do it manually or patch your prebuild config.

## Pair with dashboard

1. Open the app. Allow camera permission.
2. Scan the QR code shown under **Dashboard → Settings → Pair Device**.
3. (Optional) Switch to **Manual** to paste the dashboard URL.
4. On the next screen, paste the dashboard secret from **Dashboard → Settings → API**.
5. The app stores `{url, secret, deviceName, pairedAt, dashboardVersion}` in `expo-secure-store` and starts streaming live updates.

## API surface (v1.2.0)

The app uses a typed `api.*` namespace defined in `src/api/client.ts`:

```ts
import { api } from '../api/client';

api.overview();                              // GET /api/overview
api.tasks.list();                            // GET /api/tasks
api.tasks.start('t1');                       // POST /api/tasks/t1/start
api.tasks.setStatus('t1', 'doing');          // PATCH /api/tasks/t1/status
api.projects.activate('p1');                 // POST /api/projects/p1/activate
api.chat.list();                             // GET /api/chat
api.chat.send('hello');                      // POST /api/chat
api.agents.list();                           // GET /api/agents
api.background.list();                       // GET /api/background
api.background.pause('bg1');                 // POST /api/background/bg1/pause
api.background.steer('bg1', 'message');      // POST /api/background/bg1/steer
api.notifications.list();                    // GET /api/notifications
api.notifications.markRead('n1');            // POST /api/notifications/n1/read
api.notifications.markAllRead();             // POST /api/notifications/read-all
api.artifacts.list();                        // GET /api/artifacts
api.voice.list();                            // GET /api/voice/list
api.memory.status();                         // GET /api/memory/status
api.memory.search('query');                  // GET /api/memory/search?q=...
api.activity.list();                         // GET /api/activity
```

All helpers accept an optional `RequestOptions` arg for retries, abort signals, and 404 handling:

```ts
apiGet('/api/foo', { retries: 2, signal: ctrl.signal, allowNotFound: true });
```

## Tests

```bash
npm test             # vitest run
npm run test:watch   # vitest (watch mode)
npm run typecheck    # tsc --noEmit
```

Tests cover:
- HTTP client: retries, 401 handling, network state
- WebSocket singleton: state transitions, reconnect logic
- API namespace: verb + path correctness

## Architecture

```
src/
├── App.tsx                 # Top-level provider stack
├── api/
│   ├── client.ts          # HTTP client + typed api.* namespace
│   ├── ws.ts              # WebSocket singleton
│   ├── types.ts           # Shared API response types
│   └── __tests__/         # vitest tests
├── components/            # Reusable UI (Card, Button, TaskCard)
├── hooks/                 # React hooks (useWsEvent, useWsSnapshot)
├── navigation/            # RootNav, tab + stack navigators
├── screens/               # One file per screen
├── store/                 # PairingProvider context
└── theme/                 # Dark-theme colors
```

## Changelog

- **v1.2.0-beta.1** (this version) — Notifications + Background agents tabs, typed API namespace, retry/abort/network-state plumbing, 31 unit tests
- **v1.1.0-beta.1** — Initial beta with Activity, Chat, Tasks, Settings
