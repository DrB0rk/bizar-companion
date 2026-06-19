# Bizar Companion

React Native (Expo) Android app for the Bizar dashboard.

## Setup

```bash
npm install
npx expo start --android
```

## Build APK

```bash
eas build -p android --profile preview
```

## Pair with dashboard

1. Run the Bizar dashboard: `bizar` or `bizar-dash`
2. Open dashboard → Settings (mobile view at `/m`) → **Pair Device**
3. Tap the **Generate QR Code** button — the dashboard shows a QR
4. The companion app opens to its scanner automatically on first launch
5. Point the phone camera at the QR; the app verifies the token, stores the
   pairing in iOS/Android secure storage, and navigates to the main tabs

QR format: `bizar://pair?url=https://your-host&token=pair_<base64url>`

## Tabs

- **Activity** — recent events from the dashboard
- **Chat** — chat with the active agent
- **Tasks** — task list from the dashboard
- **Settings** — pairing info + unpair button
- **More** — placeholder for future features

## Architecture

```
App.tsx
└── SafeAreaProvider
    └── ThemeProvider
        └── PairingProvider (SecureStore)
            └── RootNav (Stack: Pair | Main)
                └── MainTabs (Bottom Tabs)
```

- **PairingProvider** — persists `{url, token, pairedAt}` via
  `expo-secure-store`. Hook: `usePairing()` returns
  `{pairing, loading, pair, unpair, isPaired}`.
- **api/client.ts** — `apiGet / apiPost / apiPut / apiPatch / apiDelete`
  add the Bearer header automatically. `BizarWs` is a thin WebSocket
  wrapper for `/ws?token=...`.
- **Bizar URL detection** — the dashboard's `POST /api/pair/start`
  detects Tailscale / localhost and returns a public URL the phone can
  reach.

## Development

Type-check:

```bash
npm run typecheck
```