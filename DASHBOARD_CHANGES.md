
# Bizar Dashboard Changes for Companion Compatibility

**Target repo:** `~/Projects/BizarHarness` (the `@polderlabs/bizar` source)
**Audience:** whoever is touching the BizarHarness server, dashboards, or auth
**Status (2026-07-07, v1.2.0-beta.2):** The companion now ships with a
typed `api.*` namespace that talks to existing dashboard endpoints. The
**pair-token-as-bearer** change (Critical §1) is still pending in the
dashboard — until that lands, the companion flow is:

  1. Scan QR → confirm `GET /api/pair/verify` succeeds.
  2. Companion saves URL only.
  3. User pastes the dashboard secret manually (Dashboard → Settings → API).
  4. Companion uses the secret as Bearer for everything else.

This is the **DASHBOARD_CHANGES.md** document — the original spec for what
the dashboard would need to do to allow the QR-only flow (no manual secret
paste). The companion no longer *requires* it, but adopting §1 (pair token
→ bearer) would let us drop the manual paste step.

**Companion version this targets:** v1.2.0-beta.2
**Minimum dashboard version:** 5.6.0+ (enforced via `app.json:extra.bizar.minSupportedDashboardVersion`)



## TL;DR — the one-line summary

The dashboard currently distinguishes between two bearer tokens: the **dashboard secret** (long-lived, single credential for the operator, accepted everywhere) and the **pair token** (short-lived, single-use, accepted only on `/api/pair/*`). The companion, once paired, has no way to obtain or persist the dashboard secret without the operator copy-pasting it. Either (a) widen `requireAuth`/`checkWebSocketAuth` to accept pair tokens for the lifetime of the pair token, or (b) add a `/api/pair/exchange` endpoint that mints a long-lived HMAC-signed companion credential from a valid pair token. The companion currently implements (a) as a workaround but documents (b) as the preferred fix.

---

## Critical — without these the companion cannot work on non-loopback

### 1. Pair tokens must authenticate the REST + WebSocket surfaces

**Current state** (`bizar-dash/src/server/auth.mjs`):

```js
// requireAuth (lines 171-204) and checkWebSocketAuth (lines 214-235)
const expected = getOrCreateSecret();
if (!token || !timingSafeEqual(token, expected)) {
  res.status(401).json({ error: 'unauthorized', ... });
}
```

Pair tokens minted by `pairStore.mint()` (`bizar-dash/src/server/pair-store.mjs:45-55`) are random 24-byte base64url strings prefixed `pair_` and are **only** recognized by `pairStore.verify()` (`pair-store.mjs:62-71`). They are not in the `getOrCreateSecret()` table. The comment block at `pair-store.mjs:10-12` explicitly says "The pair token is unrelated to the v3.6.0 dashboard auth token."

**Why this breaks the companion.** The companion scans a QR carrying `bizar://pair?url=<url>&token=<pair_token>`, calls `GET /api/pair/verify` to confirm the token works (this succeeds — the endpoint is in `skipPaths`), then stores `{url, token}` and uses the pair token as Bearer for every subsequent REST call and WebSocket upgrade. Every one of those fails with 401. The companion screen never receives data.

**Required fix — pick one:**

#### Option A (minimal change, lower security)

Modify `requireAuth` and `checkWebSocketAuth` to **also** accept a valid pair token. Roughly:

```js
// in requireAuth (auth.mjs), before falling through to the secret check:
import { pairStore } from './pair-store.mjs';

function tryPairToken(token) {
  const entry = pairStore.verify(token);
  return entry ? { kind: 'pair', entry } : null;
}

// then in the middleware body, after the loopback check:
const pairResult = token ? tryPairToken(token) : null;
if (pairResult) {
  req.pairToken = pairResult.entry.token;
  req.pairEntry = pairResult.entry;
  return next();
}
// ...existing secret check continues
```

This widens the credential model: a pair token becomes a Bearer credential for its entire TTL on every endpoint, not just `/api/pair/*`. The TTL must be extended (see #2) so the operator doesn't have to re-pair every 5 minutes.

**Audit-log implication.** Server logs will show `req.pairToken` populated on pair-token-authed requests. Worth preserving — it lets us tell a paired-companion request from an operator-browser request after the fact.

#### Option B (preferred — scoped credential, JWT mint)

Add a new endpoint `POST /api/pair/exchange` that, given a valid pair token, mints a long-lived HMAC-signed companion credential:

- **Request:** `{pairToken: string, deviceName?: string}` (no auth — pair token IS the auth here).
- **Response:** `{token: string, expiresAt: number}`. The token is `mintToken({kind: 'companion', deviceId, scope: 'companion'})` — same `mintToken` primitive that already exists at `auth.mjs:407-419` for user JWTs.
- **Storage:** the token lives in `~/.config/bizar/companion-tokens.json` keyed by deviceId. Add a `loadCompanionTokens()` / `saveCompanionTokens()` helper alongside `getOrCreateSecret()`.
- **Verification:** extend `extractToken` / `requireAuth` to also check the companion-tokens file before falling through to the secret check. Companion tokens have a 30-day TTL.

The companion flow becomes:

1. Scan QR → `GET /api/pair/verify` → confirm.
2. Companion calls `POST /api/pair/exchange` with the pair token → receives `{token, expiresAt}`.
3. Companion stores `{url, secret: <the exchanged token>, pairedAt}` in `expo-secure-store`.
4. Companion uses the exchanged token as Bearer for everything else.
5. The pair token is discarded. On dashboard restart (pair store is in-memory), the exchanged token survives — it lives in a JSON file.

**Why this is better than A.** Option A gives a pair token access to `/api/auth/reveal` and `/api/auth/regenerate` (`routes/auth.mjs:56-66`), which leak and rotate the master dashboard secret. Option B scopes the companion credential at the storage layer and never elevates it to operator privileges.

**Companion compatibility.** Either option is acceptable from the client side; the companion will work with whichever lands first. Document the chosen option in `CHANGELOG.md` under the next BizarHarness release.

### 2. Pair-token TTL must be long enough for normal companion use

**Current state:**

- `pair-store.mjs:30` — `DEFAULT_TTL_MS = 5 * 60 * 1000` (5 minutes).
- `pair.mjs:30` — request TTL is clamped to `Math.min(15 * 60 * 1000, ...)` (15 minutes max).
- `pair-store.mjs:28` — `tokens = new Map()` — in-memory only. Restart drops all tokens.

**Why this matters.** Even with Option A, a 5-minute pair token forces the user to re-scan every 5 minutes. With Option B, the pair token is short-lived but is exchanged for a long-lived companion token — the *companion token* needs the longer TTL, not the pair token.

**Required fix:**

- Bump `DEFAULT_TTL_MS` in `pair-store.mjs:30` to `30 * 24 * 60 * 60 * 1000` (30 days) IF Option A is chosen. Leave it at 5 minutes if Option B is chosen.
- Bump the `Math.min(...)` clamp in `pair.mjs:30` to match (only matters if Option A).
- If Option B: add `COMPANION_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000` constant alongside `getOrCreateSecret()` and use it in `mintCompanionToken()`.

### 3. WebSocket origin check must accept React Native clients

**Current state** (`auth.mjs:297-324` `isAllowedDashboardOrigin` and `server.mjs:550-557`):

```js
if (!isAllowedDashboardOriginForRequest(req)) {
  socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
  socket.destroy();
  return;
}
```

The `isAllowedDashboardOrigin` function allows loopback origins or origins whose hostname matches the `Host` header. **React Native's `WebSocket` polyfill does NOT send an `Origin` header on Android** — the check at `server.mjs:550-557` short-circuits to `true` when origin is missing. This actually works in our favor, but the comment in the auth.mjs file implies the check is enforced.

**Recommended:** add a clarifying comment at `auth.mjs:311-324` explaining that origin absence is treated as "browser-like client with no Origin header" and accepted; React Native clients fall into this category intentionally.

If a stricter origin policy is later added (e.g., CSRF protection via Origin), companion clients must be allowlisted explicitly via `Sec-WebSocket-Protocol: bizar-v1` subprotocol negotiation. Document this in `auth.mjs`.

---

## Recommended — improves the companion experience meaningfully

### 4. Broadcast activity events

**Current state.** `state.appendActivity(...)` (`bizar-dash/src/server/state.mjs:355-368`) writes to the per-project activity log but does NOT call `broadcast(...)`. The companion's `ActivityScreen` currently has to poll `GET /api/activity` every 10s to see live events.

**Recommended:** add a single broadcast call site in `state.appendActivity`:

```js
// after the appendFileSync:
broadcast({ type: 'activity:append', item: record, projectId: project?.id });
```

Define the `activity:append` envelope as `{type: 'activity:append', item: ActivityRecord, projectId: string|null}`. Companion can drop the 10s poll and append items on receipt.

### 5. Add an unauthenticated health endpoint

**Current state.** The companion's Settings "Test connection" button needs an unauthed endpoint to check reachability. `GET /api/auth/status` (`routes/auth.mjs:34-39`) is unauthed and returns `{required, loopback, peer}` — this is the endpoint the companion currently uses. No change strictly required, but consider adding `GET /api/health` mounted at the root (not `/api/overview/health`) for clearer semantics:

```js
// in api.mjs, BEFORE the requireAuth chain:
router.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
```

Document this in `routes/_shared.mjs` so future route authors know it's intentionally unauthed.

### 6. Add `Sec-WebSocket-Protocol` subprotocol auth as an alternative to `?token=`

**Current state.** The companion's WebSocket URL is `wss://host/ws?token=<secret>`. The token appears in the URL and is logged in `server.mjs:686-694` and any reverse-proxy logs.

**Recommended:** in `checkWebSocketAuth` (`auth.mjs:214-235`), also accept the token from `req.headers['sec-websocket-protocol']` (the second entry, after a fixed prefix like `bizar-v1`):

```js
// after the existing header/query extraction:
const protocols = (req.headers['sec-websocket-protocol'] || '').split(',').map(s => s.trim());
const protoToken = protocols[1]; // ['bizar-v1', '<token>']
if (!token && protoToken) token = protoToken;
```

The companion can then connect with `new WebSocket(url, ['bizar-v1', secret])`. This is supported on both Android and iOS RN WebSocket polyfills.

Document the negotiation in `auth.mjs` comments. The companion defaults to `?token=` for v1.1.0-beta.1 but can be flipped to subprotocol in a later release.

---

## Nice to have — not required for v1.1.0-beta.1

### 7. Default agent endpoint for chat

The companion's `ChatScreen` doesn't let the user pick an agent — it sends `POST /api/chat` with no `agent` field and lets the dashboard fall back to `'odin'` (`routes/chat.mjs:280`).

If a future companion version wants to render an agent picker, the dashboard already has `GET /api/agents` (returns `{agents: Agent[]}`) which is sufficient. **No dashboard change needed** for this.

### 8. Project switching endpoint idempotency

The companion's `TasksScreen` will call `POST /api/projects/:id/activate` when the user taps a project. Today this is idempotent (re-activating the active project returns the same record), but the response shape differs from `GET /api/projects` (the activated record vs the list). **Document the difference** in `routes/projects.mjs` header comments so future client authors know what to expect.

### 9. Snapshot envelope versioning

The companion's `useWsSnapshot` hook reads the `snapshot` envelope on WS connect. The current shape (`server.mjs:886-917`) is unversioned. **Add a `version: 1` field** to the snapshot envelope and document the field in `server.mjs:886` so future dashboard changes can bump it without breaking older companions.

---

## Security considerations

### Pair token as Bearer (Option A) is a privilege expansion

If Option A is chosen, a 30-day pair token can:

- `GET /api/auth/reveal` (`routes/auth.mjs:56`) — exfiltrate the master dashboard secret.
- `POST /api/auth/regenerate` (`routes/auth.mjs:71`) — rotate the master secret, locking the operator out of their own dashboard.

Mitigations if Option A is shipped:

1. **Reject pair-token auth on sensitive endpoints.** Wrap `requireAuth` so routes can opt out:

   ```js
   app.use('/api', requireAuth({ rejectPairTokenPaths: ['/auth/reveal', '/auth/regenerate'] }));
   ```

2. **Audit log every pair-token-authed request** with `req.pairToken` so post-hoc review is possible.

3. **Add a "paired devices" management UI** so the operator can see and revoke outstanding pair tokens. Suggested location: `routes/pair.mjs` `DELETE /api/pair/:token` handler that calls `pairStore.revoke(token)`.

### Option B is more secure

Option B avoids all of the above by minting a scoped companion credential that is NEVER checked against `/api/auth/reveal` or `/api/auth/regenerate`. The companion-tokens store can be a separate file (`~/.config/bizar/companion-tokens.json`) with its own rotation lifecycle.

**Recommendation: implement Option B.** The 40 extra lines are worth it for the security boundary.

### The companion currently uses Option A as a workaround

The companion's v1.1.0-beta.1 has BOTH paths implemented:

- **Path 1 (default):** QR scan + paste the dashboard secret from `Settings → API → Reveal token`. Works against the unmodified dashboard — the operator copy-pastes the long-lived secret directly. This is the minimum viable auth and what the companion does today, in lieu of any of the dashboard-side changes in this doc.
- **Path 2 (future):** QR scan → `POST /api/pair/exchange` → companion stores the exchanged token. Activates once `/api/pair/exchange` lands.

Path 1 is poor UX (operator has to copy a long random token). Land Option B on the dashboard to enable Path 2.

---

## API contract additions (if Option B)

### `POST /api/pair/exchange`

**Auth:** none required (pair token in body is the auth).

**Request:**

```json
{ "pairToken": "pair_<base64url>", "deviceName": "Bizar Companion on Pixel 7" }
```

**Response 200:**

```json
{
  "token": "comp_<base64url>",
  "expiresAt": 1735689600000,
  "deviceId": "comp_a1b2c3d4"
}
```

**Response 401:**

```json
{ "error": "expired", "message": "pair token invalid or expired" }
```

**Server-side sketch:**

```js
// in routes/pair.mjs, alongside /pair/start and /pair/verify
router.post('/pair/exchange', wrap(async (req, res) => {
  const pairToken = String(req.body?.pairToken || '');
  const deviceName = String(req.body?.deviceName || '').slice(0, 64);
  const entry = pairStore.verify(pairToken);
  if (!entry) {
    return res.status(401).json({ error: 'expired', message: 'pair token invalid or expired' });
  }
  const deviceId = 'comp_' + randomBytes(6).toString('hex');
  const { token, expiresAt } = mintCompanionToken({
    kind: 'companion',
    deviceId,
    deviceName,
    pairedFrom: entry.publicUrl,
  });
  saveCompanionToken(deviceId, { token, expiresAt, deviceName, pairedFrom: entry.publicUrl });
  res.json({ token, expiresAt, deviceId });
}));
```

Companion tokens live in `~/.config/bizar/companion-tokens.json`:

```json
{
  "comp_a1b2c3d4": {
    "token": "...",
    "expiresAt": 1735689600000,
    "deviceName": "Bizar Companion on Pixel 7",
    "pairedFrom": "https://borkpc.tail2cdf4d.ts.net",
    "createdAt": 1733011200000
  }
}
```

`requireAuth` and `checkWebSocketAuth` learn to check this file before falling through to the dashboard secret.

---

## Migration notes

### For dashboard maintainers

1. Land the changes in this order: **#3 first** (origin clarification — non-breaking), **#1 + #2 together** (auth widening), **#4** (activity broadcast — additive), **#5–#6** (quality of life), **#7–#9** (later).
2. Bump `bizar-dash/CHANGELOG.md` with the auth model change. Operator-facing: "Pair tokens now usable as Bearer for 30 days, OR exchanged for scoped companion credentials via `/api/pair/exchange`."
3. Add a "Paired devices" card to the dashboard Settings page so the operator can see and revoke outstanding companion credentials. Reads from `companion-tokens.json`.

### For companion maintainers

1. The companion's `src/api/ws.ts` singleton currently connects with `?token=<secret>`. After #6 lands, switch to `Sec-WebSocket-Protocol: bizar-v1, <secret>`.
2. After Option B lands, replace Path 1 in `src/screens/PairScreen.tsx` (paste-secret flow) with a call to `POST /api/pair/exchange` from the verified-pair-token state. Path 1 becomes a fallback for self-hosted setups that don't ship `/api/pair/exchange` yet.

### Backwards compatibility

- All changes are additive except #1+#2, which widen an existing credential's scope. Document this in `CHANGELOG.md` with a clear callout.
- The companion's Path 1 (paste-secret) works against the **unmodified** dashboard. If a user upgrades the companion first, they get the manual-setup UX. If they upgrade the dashboard first but not the companion, the companion continues to work (Option A kicks in). Both upgrade orders are safe.

---

## Coordination

Other agents are currently working in `~/Projects/BizarHarness/`. Before landing any of the changes in this document:

1. `git fetch` and check for in-progress branches.
2. Read `.bizar/AGENTS_SELF_IMPROVEMENT.md` in BizarHarness for recent lessons.
3. Read `.bizar/PROJECT.md` in BizarHarness for the current roadmap.
4. Land on a feature branch (`feature/companion-auth-2026-q3` or similar) and PR. Do not commit to `master` directly.
5. After merge, bump the companion's `app.json` `expo.extra.bizar.minSupportedDashboardVersion` if any of the changes become required (vs recommended).

---

## Open questions for the dashboard maintainer

1. Is the dashboard secret (`getOrCreateSecret()` at `auth.mjs:74-103`) considered operator-only, or is it acceptable for it to be in `companion-tokens.json` sibling files? If operator-only, Option B needs a separate signing key.
2. Should companion tokens be auto-revoked on dashboard restart, or persist across restarts (current plan: persist)? Persisting is more convenient but means a stolen device stays valid until expiry.
3. Should the `?token=` WebSocket auth method be deprecated once `#6` lands, or kept as a fallback? Recommendation: keep both, document precedence (`Sec-WebSocket-Protocol` > `Authorization` > `?token=`).
4. Should `state.appendActivity` also broadcast a `activity:append` event to make the companion's ActivityScreen live-update? (See #4.) If yes, what's the payload shape — the full record, or just `{kind, ts}`?

---

## File:line reference index

| Concern | Server file:line |
|---|---|
| Dashboard secret storage | `bizar-dash/src/server/auth.mjs:74-103` |
| `requireAuth` middleware | `bizar-dash/src/server/auth.mjs:171-204` |
| `checkWebSocketAuth` | `bizar-dash/src/server/auth.mjs:214-235` |
| WS upgrade handler | `bizar-dash/src/server/server.mjs:544-571` |
| Origin check | `bizar-dash/src/server/auth.mjs:297-324` |
| Pair token store | `bizar-dash/src/server/pair-store.mjs` (whole file) |
| `/api/pair/start` route | `bizar-dash/src/server/routes/pair.mjs:27-40` |
| `/api/pair/verify` route | `bizar-dash/src/server/routes/pair.mjs:45-58` |
| Pair TTL clamp | `bizar-dash/src/server/routes/pair.mjs:30` |
| Activity write site | `bizar-dash/src/server/state.mjs:355-368` |
| Activity broadcast (none currently) | n/a — must add |
| Companion token storage (to add) | new file `companion-tokens.json` under `~/.config/bizar/` |
| `/api/pair/exchange` (to add) | new route in `bizar-dash/src/server/routes/pair.mjs` |
| `mintToken` primitive | `bizar-dash/src/server/auth.mjs:407-419` |
| WS broadcast hub | `bizar-dash/src/server/server.mjs:439-445` |
| Snapshot envelope | `bizar-dash/src/server/server.mjs:886-917` |

---

## Companion v1.2.0 — New Endpoints Used

The companion v1.2.0 uses these additional endpoints that exist in dashboard
v5.6.0 today (no dashboard changes needed):

| Endpoint                                                    | Source                     |
|-------------------------------------------------------------|----------------------------|
| `GET /api/overview`                                         | New — `routes/overview.mjs` |
| `GET /api/notifications`                                    | Existing — `routes/notifications.mjs` |
| `POST /api/notifications/:id/read`                         | Existing                   |
| `POST /api/notifications/read-all`                         | Existing                   |
| `DELETE /api/notifications/:id`                            | Existing                   |
| `GET /api/background`                                       | Existing — `routes/background.mjs` |
| `POST /api/background/:id/pause`                            | Existing                   |
| `POST /api/background/:id/resume`                           | Existing                   |
| `POST /api/background/:id/steer`                            | Existing                   |
| `POST /api/background/:id/kill`                             | New (added in v5.6.0)      |
| `GET /api/background/:id/output`                            | Existing                   |
| `GET /api/voice/list`                                       | Existing — `routes/voice.mjs` |
| `GET /api/voice/:id`                                        | Existing                   |
| `POST /api/voice/upload`                                    | Existing                   |
| `GET /api/memory/status`                                    | Existing — `routes/memory.mjs` |
| `GET /api/memory/notes`                                     | Existing                   |
| `GET /api/memory/search?q=...`                              | Existing                   |
| `GET /api/artifacts`                                        | Existing — `routes/artifacts.mjs` |
| `GET /api/artifacts/:slug`                                  | Existing                   |
| `GET /api/artifacts/:slug/render`                           | Existing                   |

All 20 endpoints above are exercised by the v1.2.0 screens.

### WebSocket events consumed

| Event                       | Source                       |
|-----------------------------|------------------------------|
| `snapshot`                  | Already broadcast            |
| `tasks:change`              | Already broadcast            |
| `tasks:delete`              | Already broadcast            |
| `task:progress`             | Already broadcast            |
| `task:started`              | New (added v5.6.0)           |
| `task:completed`            | New (added v5.6.0)           |
| `task:failed`               | New (added v5.6.0)           |
| `agents:change`             | Already broadcast            |
| `agent:status`              | Already broadcast            |
| `agent:restarted`           | Already broadcast            |
| `project:change`            | Already broadcast            |
| `chat:message` / `chat:delta` | Already broadcast          |
| `chat:error` / `chat:session:create` / `chat:regenerate` | Already |
| `pair:change`               | Already broadcast            |
| `notification:new`          | Already broadcast            |
| `notifications:change`      | New (added v5.6.0)           |
| `background:change`         | Already broadcast            |
| `background:status`         | New (added v5.6.0)           |
| `artifact:new`              | Already broadcast            |
| `settings:change`           | Already broadcast            |
