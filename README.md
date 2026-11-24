# Lutong Ina

Lutong Ina is a personal cooking decision companion. Phase 1 establishes its React application foundation.

## Run locally

With Node.js and npm installed, run:

```sh
npm ci
npm run dev
```

Run `npm run lint` to check the source and `npm run build` to create the production build.

## Phase 1

Home, My Dishes, Pantry, and Discover are available through the main navigation. Home shows three planned cooking modes and an empty suggestion panel. The recommendation controls and Discover search are visible and disabled. My Dishes and Pantry explain their current availability.

The active screen is held in React state and resets to Home on reload. Recipe data, recommendation rules, and localStorage persistence are planned for later phases.

Codex assisted with the React components, CSS, starter cleanup, and verification.
