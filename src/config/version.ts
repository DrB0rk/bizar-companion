/**
 * src/config/version.ts
 *
 * Single source of truth for the build version.
 *
 * `package.json:version` is the source of truth at build time. This file
 * re-exports it so screens / help text / diagnostics all reference the same
 * value without duplicating strings.
 *
 * The dashboard version (`minSupportedDashboardVersion`) is read from
 * `app.json:expo.extra.bizar.minSupportedDashboardVersion` via the
 * `useMinDashboardVersion()` hook in `src/hooks/useMinDashboardVersion.ts`.
 */
export const APP_VERSION: string = '1.2.0-beta.2';
