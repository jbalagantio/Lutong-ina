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

Use **My Dishes** to create, search, expand, edit, and delete personal recipes. **Browse recipes** lets you save dishes from the built-in catalog. The collection combines both sources and supports name search and filters. Favorite and Familiar are independent choices and start off for every recipe.

My Dishes uses separate browser storage from Pantry. Library entries store recipe IDs and preferences. Removing a saved recipe or deleting a personal one removes its preferences. After a storage read failure, explicit session changes take precedence, including turning off a preference or removing a recipe. Untouched preferences are recovered from storage. Removing and saving the same recipe again starts its preferences fresh. If a personal recipe ID is reassigned, its session preferences follow the new ID. Duplicate entries already in storage retain enabled flags from either copy and require replacement confirmation along with other partially recovered data.

Personal recipe photos are optional. Choose a JPEG, PNG, or WebP up to 10 MB. Photos stay in this browser in IndexedDB. Recipe details and library preferences stay in localStorage. Built-in photos load from Wikimedia Commons and fall back to a placeholder when unavailable. Unused photo cleanup requires Web Locks, valid saved recipe data, and a single open Lutong Ina tab. When cleanup is deferred, the app keeps the photo files. See [photo credits](IMAGE_CREDITS.md).

Open **Pantry** to add, edit, remove, and mark ingredients as available or out of stock. Search by name and combine category and availability filters. Pantry data is stored locally in the current browser when localStorage is available. The first pantry starts empty.

Choose one of three cooking modes on **Home**:

- **Use what I have** ranks dishes with at least one match by ingredient coverage, fewest missing ingredients, shortest cooking time, and recipe name.
- **I'll go grocery shopping** draws from the full catalog and shows which ingredients to shop for.
- **Something new** draws from recipes not marked familiar. If all recipes are marked familiar, it draws from the full catalog. Each round avoids repeats.

Home recommendations include all built-in and personal recipes. Matches use available pantry entries, an explicit list of equivalent names, and distinct tracked ingredients. Water is excluded from matching. The app checks presence only. Each cooking mode keeps its own suggestion round while you navigate. Refreshing starts a new session. If a suggestion becomes ineligible, the app moves to an eligible unseen recipe when one exists. Pantry data stays in this browser, and the app shows a warning if storage fails.

Pantry search accepts partial names in both English and Filipino when an explicit equivalent exists. For example, searching `kang` finds `Water spinach`, and searching `water spinach` finds an entry saved as `Kangkong`. Search still respects the selected category and availability. Duplicate validation uses the same equivalents as recommendations, while existing entries keep their saved names and availability.

**Discover** shows the built-in recipe catalog in alphabetical order, with photographs, cooking times, and difficulty. The catalog includes saved and familiar built-in dishes. Search by recipe name or ingredient, including English and Filipino ingredient aliases. Combine cuisine, maximum cooking time, and difficulty filters, or clear them to restore the catalog. Discover filters are session-local and reset when the screen is unmounted. Recipe detail interactions are planned for a later checkpoint.

Run `node --test` to verify recipe and photo utilities, ingredient matching, pantry utilities, and recommendation rules.

If browser storage is unavailable, you can keep editing the pantry in memory and retry loading or saving. A successful load retry keeps saved entries alongside ingredients added during the outage. If saved data is unreadable or only partly recoverable, it is kept as-is until you confirm **Replace saved pantry**. Unsaved changes can be lost on refresh.

If a load retry brings back an alias equivalent to an ingredient entered during the outage, both entries keep their names and availability. Recommendations count the ingredient once, and either entry can satisfy the match when available.

Codex assisted with the React components, CSS, sample recipe data, pantry behavior, recommendation rules, and verification.
