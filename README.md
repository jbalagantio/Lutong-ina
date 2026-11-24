# Lutong Ina

Lutong Ina is a personal cooking decision companion built with React and Vite.

## Run locally

With Node.js and npm installed, run:

```sh
npm ci
npm run dev
```

Run `npm run lint` to check the source and `npm run build` to create the production build.

## Current features

Open **Pantry** to add, edit, remove, and mark ingredients as available or out of stock. Search by name and combine category and availability filters. Pantry data is stored locally in the current browser when localStorage is available. The first pantry starts empty.

Choose one of three cooking modes on **Home**:

- **Use what I have** ranks dishes with at least one match by ingredient coverage, fewest missing ingredients, shortest cooking time, and recipe name.
- **I'll go grocery shopping** draws from all 15 Filipino recipes and shows which ingredients to shop for.
- **Something new** draws from recipes you have yet to see in the current round.

Matches use available pantry entries, an explicit list of equivalent names, and distinct tracked ingredients. Water is excluded from matching. The app checks presence only. Suggestion rounds reset when changing modes or leaving Home. Pantry data stays in this browser, and the app shows a warning if storage fails. Recipe browsing, recipe details, and My Dishes management are planned for later phases.

Run `node --test tests/recommendations.test.js` to verify the recommendation rules.

Codex assisted with the React components, CSS, sample recipe data, pantry behavior, recommendation rules, and verification.
