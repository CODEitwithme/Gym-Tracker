# Gym Tracker

A personal fitness tracker foundation built with React, TypeScript, Vite,
Redux Toolkit, React Router, Tailwind CSS, and Lucide icons.

## Getting started

```sh
npm install
npm run dev
```

## Validation

```sh
npm run build
npm run lint
npm test
```

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
    dashboard/         Dashboard route
    not-found/         Fallback route
    workouts/          Workout data types
    nutrition/         Nutrition data types
  App.tsx
  index.css
  main.tsx
```

IndexedDB via Dexie is the persistent source of truth for workout and nutrition
records. The Redux store remains empty until UI state and asynchronous workflows
are introduced. No sample records are seeded, and cloud sync or backend
functionality is not implemented.
