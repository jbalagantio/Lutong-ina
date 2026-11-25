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

Use **My Dishes** to create, search, expand, edit, and delete personal recipes. **Browse recipes** opens Discover, the built-in catalog. The collection combines both sources and supports name search and filters. Favorite and Familiar are independent choices and start off for every recipe.

My Dishes uses separate browser storage from Pantry. Library entries store recipe IDs and preferences. Removing a saved recipe or deleting a personal one removes its preferences. After a storage read failure, explicit session changes take precedence, including turning off a preference or removing a recipe. Untouched preferences are recovered from storage. Removing and saving the same recipe again starts its preferences fresh. If a personal recipe ID is reassigned, its session preferences follow the new ID. Duplicate entries already in storage retain enabled flags from either copy and require replacement confirmation along with other partially recovered data.

Personal recipe photos are optional. Choose a JPEG, PNG, or WebP up to 10 MB. Photos stay in this browser in IndexedDB. Recipe details and library preferences stay in localStorage. Built-in photos load from Wikimedia Commons and fall back to a placeholder when unavailable. Unused photo cleanup requires Web Locks, valid saved recipe data, and a single open Lutong Ina tab. When cleanup is deferred, the app keeps the photo files. See [photo credits](IMAGE_CREDITS.md).

Open **Pantry** to add, edit, remove, and mark ingredients as available or out of stock. Search by name and combine category and availability filters. Pantry data is stored locally in the current browser when localStorage is available. The first pantry starts empty. **Ingredients** is the default view. Switching to **Grocery List** and back keeps the current ingredient filters and any open draft while Pantry stays mounted.

**Grocery List** starts empty and supports adding, editing, and removing items. Names are trimmed, must fit the 80-character ingredient name limit, and need a pantry category. New alias-equivalent duplicates such as Garlic and Bawang are blocked. Old entries can keep their current ingredient identity. Search matches English and Filipino names, including partial aliases, and works together with the category filter. Check an item to move it to **Purchased**, or uncheck it to move it back to **To buy**. Purchase counts use the full list.

**Add purchased items to pantry** includes every purchased item, even those hidden by filters. The transfer matches English and Filipino aliases. It leaves available ingredients as they are, restocks the first matching Pantry entry in list order when all matches are out of stock, and adds an available entry when there is no match. Pantry tracks availability only.

The transfer saves Pantry first, then removes successfully represented items from Grocery List only after the grocery save succeeds. Protected data requires recovery before transfer. If Pantry cannot be saved, purchased items stay on the list. If Pantry saves but grocery cleanup fails, the purchased items also stay on the list. Retry the transfer to finish cleanup without duplicating ingredients, including after a refresh.

Use **Add missing ingredients** on a Home recommendation, in Discover recipe details, or in an expanded recipe in My Dishes. The action checks the current Pantry and adds only eligible missing ingredients in one save. Pantry matching is presence-based. Out-of-stock and absent ingredients are eligible, while available ingredients and water aliases are excluded. Repeated and alias-equivalent ingredients count once, and existing purchased and unpurchased grocery items are preserved. Grocery additions do not change pantry availability or aggregate quantities.

New items use the first matching pantry record with a valid category, in displayed storage order, even when that record is out of stock. Without a match, known ingredients use the catalog category mapping and unknown personal ingredients use **Others**. Choose **View grocery list** to open Pantry directly in Grocery List. If storage is blocked or a save fails, that view provides retry or protected replacement controls for the items still in memory.

Both Pantry views keep their drafts and filters when switching. Leaving Pantry with a changed grocery draft asks for confirmation. Accepted grocery changes save to `lutong-ina-grocery-list` in the current browser. Loading does not write on startup. After a failed read, retry merges saved items with the surviving session items, assigns new IDs to colliding session items, and keeps valid legacy aliases. Invalid or partial storage stays protected until confirmed replacement. If saving fails, current changes stay in memory and can be lost on refresh. Grocery storage is local to this browser and does not synchronize concurrent edits across tabs.

Use **Mark as cooked** on a Home recommendation, in Discover recipe details, or on an expanded recipe in My Dishes. To record it again from the same open recipe, choose **Record another meal** and confirm. Each event stores the recipe ID, its name at the time, and a UTC timestamp. It leaves bookmarks, preferences, pantry availability, and grocery items alone. The current recommendation stays visible.

Open **My Dishes → Cooking History** to search name snapshots and remove individual events. Meals appear newest first, grouped by your device's local date. Name changes and recipe deletions leave past entries intact. Cooking History and Recipe Library preserve open recipe drafts when switching views.

History stays in this browser under `lutong-ina-cooking-history`. A failed read can be retried, merging readable saved records with current-session events. Invalid or partial storage requires confirmed replacement. Unsaved events may be lost on refresh. Cooking records for new personal recipes stay in memory until My Dishes saves their resolved IDs successfully. A later history write failure appears as a general warning and does not change the confirmation for a previously saved event.

The 30 built-in Filipino recipes include preparation, cooking order, approximate timings, and doneness cues. Recipes without a sourced photo use the existing cooking-pot placeholder. V1 runs as a standalone React app with browser-local storage. AI integration, a backend, accounts, and cloud sync are deferred to V2.

Choose one of three cooking modes on **Home**:

- **Use what I have** suggests dishes with at least one tracked ingredient available in Pantry.
- **I'll go grocery shopping** draws from the full catalog and shows which ingredients to shop for.
- **Something new** draws from recipes not marked familiar. If all recipes are marked familiar, it draws from the full catalog. Each round avoids repeats.

Home recommendations include all built-in and personal recipes. Matches use available pantry entries, an explicit list of equivalent names, and distinct tracked ingredients. Water is excluded from matching. The app checks presence only. Each cooking mode keeps its own suggestion round while you navigate. Refreshing starts a new session. If a suggestion becomes ineligible, the app moves to an eligible unseen recipe when one exists. Pantry data stays in this browser, and the app shows a warning if storage fails.

Home uses rule-based cooking history. From highest to lowest priority, the groups are recipes with no recorded meal, last cooked at least 7 local calendar days ago, 3–6 days ago, 1–2 days ago, and today. The latest valid event for each recipe ID determines its group, including events still in memory. Future timestamps receive today's priority without a date label. Groups are based on device-local dates and are recalculated when a recommendation is drawn.

**Use what I have** ranks by unrounded coverage, then missing ingredient count, recency group, cooking time, and name. **I'll go grocery shopping** picks randomly among unseen recipes in the highest available group. **Something new** applies that same draw within the unfamiliar pool, or across the full catalog when all recipes are familiar. Lower-priority recipes remain eligible. History updates affect subsequent draws within each round. Starting a new round skips the last suggestion when another eligible dish exists.

Pantry search accepts partial names in both English and Filipino when an explicit equivalent exists. For example, searching `kang` finds `Water spinach`, and searching `water spinach` finds an entry saved as `Kangkong`. Search still respects the selected category and availability. Duplicate validation uses the same equivalents as recommendations, while existing entries keep their saved names and availability.

**Discover** shows the built-in recipe catalog in alphabetical order, with photographs, cooking times, and difficulty. The catalog includes saved and familiar built-in dishes. Search by recipe name or ingredient, including English and Filipino ingredient aliases. Combine cuisine, maximum cooking time, and difficulty filters, or clear them to restore the catalog. Discover filters are session-local and reset when the screen is unmounted. Select a recipe photo or title to view its complete ingredients, quantities, and instructions. Back to Discover keeps the search and filters intact and returns focus to the selected recipe.

Save or remove built-in recipes from the Discover bookmark or recipe detail actions. Discover and My Dishes share the same library. Saving starts with Favorite and Familiar off, and both preferences can be changed independently from a saved recipe's detail view or My Dishes. Successful writes persist in browser storage. During storage failures, changes stay in memory. Use **Open My Dishes** in the Discover warning to reach retry, replacement, or conflict-resolution options.

Discover cards show how many tracked ingredients are available. Recipe details also show coverage and label each ingredient Available, Missing, or Not tracked. Matching checks pantry presence and in-stock status regardless of quantity. English and Filipino aliases share a match, equivalent ingredients count once toward coverage, and water and its aliases are untracked.

Run `node --test` to verify recipe and photo utilities, ingredient matching, pantry utilities, and recommendation rules.

If browser storage is unavailable, you can keep editing the pantry in memory and retry loading or saving. A successful load retry keeps saved entries alongside ingredients added during the outage. If saved data is unreadable or only partly recoverable, it is kept as-is until you confirm **Replace saved pantry**. Unsaved changes can be lost on refresh.

If a load retry brings back an alias equivalent to an ingredient entered during the outage, both entries keep their names and availability. Recommendations count the ingredient once, and either entry can satisfy the match when available. If saved and session ingredients share an ID, the session entry receives a new ID and any open edit follows it.

Codex assisted with the React components, CSS, sample recipe data, pantry behavior, recommendation rules, and verification.
