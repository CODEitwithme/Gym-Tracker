# Gym Tracker

Gym Tracker is a local-first fitness tracker for recording workouts, exercise
sets, saved meals, daily nutrition, and progress over time. It is built with
React, TypeScript, Vite, Redux Toolkit, React Router, Tailwind CSS, and Dexie.
It does not require an account or a backend.

## Data, privacy, and backups

- Workout and nutrition records are stored in IndexedDB in the browser profile
  and origin where the app is used. This MVP has no account-based cloud sync,
  backend, or cross-device synchronization.
- The demo feature stores only its record-ID and snapshot manifest in browser
  local storage so its cleanup action can identify its own records.
- Clearing browser/site data can erase records. Browser storage may also be
  evicted, and is not a guaranteed permanent backup.
- Private browsing sessions and different browsers or devices may not share
  records. Do not rely on browser storage as the only copy of important data.
- Export full JSON backups regularly from **Settings → Data management** and
  store them somewhere safe. A JSON backup includes workout and nutrition
  information, including history and soft-deleted records; treat it as
  sensitive personal data.
- The **CSV reports** are for analysis and spreadsheets. They are not complete
  backups and cannot restore all records and relationships. CSV exports omit
  soft-deleted records; use JSON for backup and restore.
- Restore supports merging records and replacing all local application
  records. Replacement requires confirmation. Review the selected backup
  carefully and keep a separate current backup before replacing local data.
- To test the dashboard and history, open **Settings → Data management** and
  choose **Load 7 Days of Demo Data**. After confirmation, this adds fictional
  workouts and nutrition records for today and the preceding six local calendar
  days; it does not seed automatically or overwrite existing records. The
  separate **Remove demo data** action removes only unchanged records tracked
  by the browser's demo manifest and preserves records that have been edited or
  referenced by other data.

Data is stored locally by this application; this README makes no claim that it
is encrypted by Gym Tracker.

## Requirements

Use Node.js `^20.19.0` or `>=22.12.0` and npm, as specified in
`package.json`.

## Install and run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

## Checks and production build

```sh
npx tsc -b
npm test
npm run lint
npm run build
```

The production build is written to `dist/`. Preview that build locally with:

```sh
npm run preview
```

The preview command serves the built app locally; it does not deploy the
application.

## Vercel deployment and client-side routes

The app uses React Router browser-history routes, including `/progress`,
`/workouts`, `/workouts/active`, `/workouts/:workoutId`, `/nutrition`,
`/nutrition/meals`, and `/settings/data`. The root-level `vercel.json` sends
extension-free requests to `index.html`, which allows these routes (and unknown
routes handled by the app) to load directly or after refresh. Paths containing
a dot are not rewritten, so static asset requests are not sent back as HTML.

To deploy on Vercel, import the GitHub repository and use the repository root,
the Vite framework preset, `npm run build` as the build command, and `dist` as
the output directory. Vercel can use the checked-in `package-lock.json` to
install dependencies. No environment variables or client-side secrets are
required for this frontend.

The production build is written to `dist/`. Preview it locally with
`npm run preview`; this does not deploy the application.

Workout, exercise, meal, and log records remain in browser IndexedDB, scoped to
the browser profile and deployed origin. The app has no backend, account, or
cross-browser/device synchronization. Clearing browser/site data can erase
records; export backups from **Settings → Data management** and store them
safely.

## Project structure

```text
src/
  app/                 Store, typed hooks, providers, and router
  db/                  Dexie schema, migrations, and repositories
  components/
    common/            Reusable UI components
    layout/            Responsive application shell and navigation
  lib/                 Date, validation, unit, and nutrition utilities
  types/               Shared record types
  features/
    dashboard/         Dashboard and progress analytics
    data-management/   Demo data, JSON backup/restore, and CSV reports
    nutrition/         Daily nutrition and saved meals
    workouts/          Workout entry, history, and details
    not-found/          Unknown-route page
```

No environment variables or client-side secrets are required for the MVP.
