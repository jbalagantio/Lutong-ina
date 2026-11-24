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

Pantry search accepts partial names in both English and Filipino when an explicit equivalent exists. For example, searching `kang` finds `Water spinach`, and searching `water spinach` finds an entry saved as `Kangkong`. Search still respects the selected category and availability. Duplicate validation uses the same equivalents as recommendations, while existing entries keep their saved names and availability.

Run `node --test` to verify ingredient matching, pantry utilities, and recommendation rules.

If browser storage is unavailable, you can keep editing the pantry in memory and retry loading or saving. A successful load retry keeps saved entries alongside ingredients added during the outage. If saved data is unreadable or only partly recoverable, it is kept as-is until you confirm **Replace saved pantry**. Unsaved changes can be lost on refresh.

If a load retry brings back an alias equivalent to an ingredient entered during the outage, both entries keep their names and availability. Recommendations count the ingredient once, and either entry can satisfy the match when available.

Codex assisted with the React components, CSS, sample recipe data, pantry behavior, recommendation rules, and verification.
