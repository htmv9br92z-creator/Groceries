# Groceries

A personal meal-prep app: save your own recipes, plan a week of meals, and get a
consolidated grocery list grouped by store section. Built for two people and one phone.

Everything is **one HTML file with no dependencies, no server, and no build step**.
All your data (recipes, plan, checked-off items) lives in your phone's browser
storage — nothing ever leaves your device.

## Get it on your iPhone (one-time setup)

The app is served free over HTTPS by GitHub Pages. A workflow in this repo
already publishes the app to the `gh-pages` branch on every push; Pages just has
to be switched on once:

1. **Enable Pages** (repo owner only): Settings → Pages → under "Build and
   deployment" choose Source: "Deploy from a branch" → branch `gh-pages`,
   folder `/ (root)` → Save. After a minute the app is at
   `https://<your-username>.github.io/Groceries/`.
2. **On your iPhone**: open that URL in Safari, tap the Share button, then
   **Add to Home Screen**. It now opens full-screen like a native app, works
   offline in the store, and — important — home-screen apps are exempt from
   Safari's periodic storage cleanup, so your data stays put.

## Using it

- **Today** tab: a dashboard of today's planned meals by slot, today's food cost,
  and the week at a glance (meal cost + grocery run estimate).
- **Recipes** tab: add recipes with ingredient amounts. Quantities accept decimals
  and fractions ("1.5", "1/2", "1 1/2"). Leave the amount blank for things like
  "salt to taste". Pick a store section per ingredient — that's how the grocery
  list gets organized.
- **Plan** tab: add meals to days of the week as breakfast, lunch, dinner, or
  snack, and adjust servings with the +/− steppers. Ingredient amounts scale
  automatically (a 4-serving recipe planned at 2 servings halves everything).
- **List** tab: builds itself from the plan. Same ingredient + same unit across
  recipes are summed into one line, grouped by section. Tap items to check them
  off while shopping; checks persist if you close the app mid-shop.
- **Items** tab: save ingredients the way you buy them ("rice · 1 kg · $3.50"),
  optionally with nutrition straight from the label ("per 100 g: 130 kcal,
  2.7 protein, 28 carbs, 0.3 fat"). An item can have a price, macros, or both.
  The app then shows cost per meal, per day, and per week, plus a grocery run
  estimate — and per-serving calories/protein/carbs/fat on every meal, with
  daily totals on the Today tab (one serving of each meal, i.e. what one person
  eats). Two cost numbers on purpose: *meal cost* counts just what recipes use
  (200 g of that 1 kg bag = $0.70); the *grocery run estimate* counts whole
  packages, which is what you pay at the register. Weight (g/kg/oz/lb) and
  volume (ml/l/tsp/tbsp/cup) convert automatically; other units (cans, heads,
  pieces) match when the recipe uses the same unit word. Ingredients without a
  price or nutrition info are flagged, never silently counted as zero.
- **Scanning with the camera**: the app uses the iPhone's built-in text
  recognition rather than bundling its own — tap into a scan box, then tap the
  **Scan Text** camera button on the iOS keyboard. "Scan a receipt" (Items tab)
  finds the priced line items, skips totals/tax/card noise, and shows a review
  list before saving; "Scan a nutrition label" (in the item form) reads serving
  size and macros from US Nutrition Facts or EU per-100g labels, ignoring
  saturated-fat and sugar sub-lines. Everything stays on the phone — no cloud
  OCR, no API keys.

## Backups & data safety

Tap **Backup** (top right) → **Export backup file** to save a JSON file to the
Files app (put it in iCloud Drive and it's off-device). **Import a backup**
restores it — on this phone or a new one.

Three safety nets run automatically:
- every save is mirrored to a second on-device store (IndexedDB), and if the
  main storage ever comes up empty the app restores from the mirror and tells you;
- the browser is asked to mark the app's storage as persistent;
- if it's been more than two weeks since your last export, the Today tab shows
  a one-tap backup reminder.

The export file is still the only copy that survives losing the phone itself,
so take the reminder seriously.

## Notes for future maintenance

- `index.html` is the whole app: CSS at the top, HTML skeleton in the middle,
  all logic in one `<script>` at the bottom (plain JavaScript, no framework).
- `sw.js` is a small service worker that caches the app so it loads offline.
  If you change `index.html`, just push — it fetches fresh when online, and the
  app reloads itself when reopened after a long suspension, so it never runs a
  stale version for long.
- `tests.mjs` tests the scaling/merging/costing logic: `node tests.mjs`. The
  deploy workflow runs it first and won't publish if a test fails.
- Data shape (also what the backup file contains):
  ```json
  {
    "recipes": [{ "id", "name", "servings", "notes",
                  "ingredients": [{ "qty", "unit", "name", "section" }] }],
    "plan":    [{ "id", "day", "slot", "recipeId", "servings" }],
    "checked": { "<name|unit>": true },
    "prices":  [{ "id", "name", "qty", "unit", "price",
                  "macros": { "qty", "unit", "kcal", "protein", "carbs", "fat" } }]
  }
  ```
- Deliberate v1 simplifications: ingredients merge on exact name + unit match
  (lowercased), so "1 cup milk" and "200 ml milk" stay separate lines; one active
  week at a time; no unit conversion.
