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

- **Recipes** tab: add recipes with ingredient amounts. Quantities accept decimals
  and fractions ("1.5", "1/2", "1 1/2"). Leave the amount blank for things like
  "salt to taste". Pick a store section per ingredient — that's how the grocery
  list gets organized.
- **Plan** tab: add meals to days of the week and adjust servings with the +/−
  steppers. Ingredient amounts scale automatically (a 4-serving recipe planned at
  2 servings halves everything).
- **List** tab: builds itself from the plan. Same ingredient + same unit across
  recipes are summed into one line, grouped by section. Tap items to check them
  off while shopping; checks persist if you close the app mid-shop.

## Backups

Tap **Backup** (top right) → **Export backup file** to save a JSON file to the
Files app (put it in iCloud Drive and it's off-device). **Import a backup**
restores it — on this phone or a new one. Do this occasionally; browser storage
is durable for home-screen apps but not infallible.

## Notes for future maintenance

- `index.html` is the whole app: CSS at the top, HTML skeleton in the middle,
  all logic in one `<script>` at the bottom (plain JavaScript, no framework).
- `sw.js` is a small service worker that caches the app so it loads offline.
  If you change `index.html`, just push — it fetches fresh when online.
- Data shape (also what the backup file contains):
  ```json
  {
    "recipes": [{ "id", "name", "servings", "notes",
                  "ingredients": [{ "qty", "unit", "name", "section" }] }],
    "plan":    [{ "id", "day", "recipeId", "servings" }],
    "checked": { "<name|unit>": true }
  }
  ```
- Deliberate v1 simplifications: ingredients merge on exact name + unit match
  (lowercased), so "1 cup milk" and "200 ml milk" stay separate lines; one active
  week at a time; no unit conversion.
