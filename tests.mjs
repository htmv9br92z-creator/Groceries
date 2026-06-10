// Logic tests for the app. Run with: node tests.mjs
// Extracts the <script> from index.html and exercises the pure functions.
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
let js = html.match(/<script>([\s\S]*)<\/script>/)[1];
// sloppy-mode eval so declarations land on global; `var` so tests can swap `data`
js = js.replace('"use strict";', "").replace("let data = load();", "var data = load();");

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
(0, eval)(js);

let fails = 0;
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { fails++; console.log(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); }
  else console.log(`ok   ${label}`);
}
function close(actual, expected, label) {
  const ok = typeof actual === "number" && Math.abs(actual - expected) < 0.005;
  if (!ok) { fails++; console.log(`FAIL ${label}: got ${actual}, want ~${expected}`); }
  else console.log(`ok   ${label}`);
}

// --- quantity parsing & formatting ---
eq(parseQty("1.5"), 1.5, "parse decimal");
eq(parseQty("1,5"), 1.5, "parse comma decimal");
eq(parseQty("1/2"), 0.5, "parse fraction");
eq(parseQty("1 1/2"), 1.5, "parse mixed fraction");
eq(parseQty(""), null, "parse empty");
eq(parseQty("to taste"), null, "parse non-numeric");
eq(formatQty(0.5), "½", "format half");
eq(formatQty(1.5), "1 ½", "format mixed");
eq(formatQty(2), "2", "format whole");
eq(formatQty(1 / 3), "⅓", "format third");
eq(formatQty(0.4), "0.4", "format odd decimal");
eq(formatQty(null), "", "format null");

// --- shared fixture ---
globalThis.data = {
  recipes: [
    { id: "r1", name: "Soup", servings: 2, ingredients: [
      { qty: 200, unit: "g", name: "rice", section: "pantry" },
      { qty: 2, unit: "", name: "carrots", section: "produce" },
      { qty: null, unit: "", name: "salt", section: "pantry" },
    ]},
    { id: "r2", name: "Salad", servings: 4, ingredients: [
      { qty: 4, unit: "", name: "Carrots", section: "produce" },
      { qty: 1, unit: "head", name: "lettuce", section: "produce" },
    ]},
  ],
  plan: [
    { id: "m1", day: 0, slot: "dinner", recipeId: "r1", servings: 4 },  // 2x soup
    { id: "m2", day: 1, slot: "lunch", recipeId: "r2", servings: 2 },   // 0.5x salad
  ],
  checked: {},
  prices: [
    { id: "p1", name: "rice", qty: 1, unit: "kg", price: 3.5 },
    { id: "p2", name: "carrots", qty: 1, unit: "", price: 0.4 },
  ],
};

// --- grocery list: scaling, merging, sections ---
const groups = buildList();
eq(groups.map((g) => g[0]), ["Produce", "Pantry"], "section order");
const produce = groups[0][1];
const pantry = groups[1][1];
eq(produce.find((i) => i.name.toLowerCase() === "carrots").qty, 6, "carrots merged + scaled (2*2 + 4*0.5)");
eq(produce.find((i) => i.name === "lettuce").qty, 0.5, "lettuce scaled down");
eq(pantry.find((i) => i.name === "rice").qty, 400, "rice doubled");
eq(pantry.find((i) => i.name === "salt").hasQty, false, "unmeasured salt kept without qty");

// --- costs ---
// rice: 400 g of a 1 kg / $3.50 package → proportional $1.40
close(ingredientCost({ qty: 200, unit: "g", name: "rice" }, 2), 1.4, "g→kg unit conversion in cost");
eq(ingredientCost({ qty: 1, unit: "cup", name: "rice" }, 1), null, "volume vs weight package → not costable");
eq(ingredientCost({ qty: null, unit: "", name: "salt" }, 1), 0, "unmeasured ingredient costs nothing");
eq(ingredientCost({ qty: 1, unit: "head", name: "lettuce" }, 1), null, "no saved price → null");

const m1cost = mealCost(data.plan[0]);  // 2x soup: rice $1.40 + 4 carrots $1.60, salt free
close(m1cost.total, 3.0, "meal cost sums priced ingredients");
eq(m1cost.unknown, 0, "no unknowns in fully priced meal");
const m2cost = mealCost(data.plan[1]);  // 0.5x salad: 2 carrots $0.80, lettuce unpriced
close(m2cost.total, 0.8, "partial meal cost");
eq(m2cost.unknown, 1, "lettuce counted as unpriced");
close(sumCosts(data.plan).total, 3.8, "weekly cost is sum of meals");

// --- shopping estimate: whole packages ---
const riceItem = pantry.find((i) => i.name === "rice");
eq(itemPurchase(riceItem).packages, 1, "400 g needs 1 × 1 kg package");
eq(itemPurchase(riceItem).cost, 3.5, "package cost is full package price");
const carrotItem = produce.find((i) => i.name.toLowerCase() === "carrots");
eq(itemPurchase(carrotItem).packages, 6, "6 loose carrots = 6 packages");
eq(itemPurchase(produce.find((i) => i.name === "lettuce")), null, "unpriced item has no purchase");
eq(itemPurchase(pantry.find((i) => i.name === "salt")), null, "unmeasured item has no purchase");

// --- unpriced names for the Prices tab ---
eq(unpricedNames(), ["lettuce"], "lettuce is the only unpriced planned ingredient");

// --- plan slot migration on import shape ---
const migrated = (() => {
  const d = { recipes: [], plan: [{ id: "x", day: 0, recipeId: "r1", servings: 2 }], checked: {}, prices: [] };
  for (const m of d.plan) if (!m.slot) m.slot = "dinner";
  return d.plan[0].slot;
})();
eq(migrated, "dinner", "plan entries without slot default to dinner");

// --- deleted recipe in plan is ignored everywhere ---
data.plan.push({ id: "m3", day: 2, slot: "dinner", recipeId: "ghost", servings: 2 });
eq(buildList().length, 2, "missing recipe ignored in list");
eq(mealCost(data.plan[2]).total, 0, "missing recipe costs nothing");

console.log(fails ? `\n${fails} TEST(S) FAILED` : "\nALL TESTS PASSED");
process.exit(fails ? 1 : 0);
