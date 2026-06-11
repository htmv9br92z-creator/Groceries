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
    { id: "p1", name: "rice", qty: 1, unit: "kg", price: 3.5,
      macros: { qty: 100, unit: "g", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } },
    { id: "p2", name: "carrots", qty: 1, unit: "", price: 0.4 },
    { id: "p3", name: "lettuce", qty: 1, unit: "head", price: null,
      macros: { qty: 1, unit: "head", kcal: 50, protein: 4, carbs: 10, fat: 0 } },
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

// --- macros ---
// rice: 400 g at 130 kcal / 100 g → 520 kcal
const riceMac = ingredientMacros({ qty: 200, unit: "g", name: "rice" }, 2);
close(riceMac.kcal, 520, "macro unit conversion (g per 100 g)");
close(riceMac.protein, 10.8, "protein scales");
eq(ingredientMacros({ qty: null, unit: "", name: "salt" }, 1), false, "unmeasured ingredient skipped in macros");
eq(ingredientMacros({ qty: 2, unit: "", name: "carrots" }, 1), null, "item without macros → null");
close(ingredientMacros({ qty: 1, unit: "head", name: "lettuce" }, 0.5).kcal, 25, "count-unit macros match by unit word");

const m1mac = mealMacros(data.plan[0]);  // 2x soup
close(m1mac.kcal, 520, "meal macros sum tracked ingredients");
eq(m1mac.tracked, 1, "rice tracked");
eq(m1mac.untracked, 1, "carrots untracked (no macros on item)");
eq(macroSub(data.plan[0]).includes("130 kcal"), true, "per-serving kcal in meal label");

const day = perServingMacros(data.plan);  // 520/4 + 25/2
close(day.kcal, 142.5, "per-person day macros sum one serving of each meal");

// macros-only item (lettuce, price null) must not cost $0
eq(hasValidPrice(findPrice("lettuce")), false, "null price is not a valid price");

// --- receipt parsing ---
const receipt = `WHOLE FOODS MARKET
123 Main Street
BANANAS 1.29 F
2% MILK 4.59
0123456789 RICE 1KG 3.50
AVOCADO 2 @ 1.50 3.00
SUBTOTAL 12.38
TAX 0.85
TOTAL 13.23
VISA ****1234
THANK YOU`;
const recItems = parseReceiptText(receipt);
eq(recItems.length, 4, "receipt: four item lines found");
eq(recItems[0], { name: "bananas", price: 1.29 }, "receipt: trailing flag letter ignored");
eq(recItems[1], { name: "2% milk", price: 4.59 }, "receipt: short leading digits kept in name");
eq(recItems[2], { name: "rice 1kg", price: 3.5 }, "receipt: long barcode stripped from name");
eq(recItems[3], { name: "avocado", price: 1.5 }, "receipt: '2 @ 1.50' uses per-unit price");
eq(parseReceiptText("just some words\nno prices here"), [], "receipt: no priced lines → empty");

// --- nutrition label parsing (US style) ---
const usLabel = `Nutrition Facts
8 servings per container
Serving size 2/3 cup (55g)
Amount per serving
Calories 230
Total Fat 8g 10%
Saturated Fat 1g 5%
Trans Fat 0g
Cholesterol 0mg
Sodium 160mg 7%
Total Carbohydrate 37g 13%
Dietary Fiber 4g
Total Sugars 12g
Includes 10g Added Sugars
Protein 3g`;
const us = parseNutritionText(usLabel);
eq(us.qty, 55, "US label: gram serving size from parenthetical");
eq(us.unit, "g", "US label: serving unit");
eq(us.kcal, 230, "US label: calories");
eq(us.fat, 8, "US label: total fat, not saturated/trans");
eq(us.carbs, 37, "US label: total carbs, not fiber/sugars");
eq(us.protein, 3, "US label: protein");

// --- nutrition label parsing (EU style) ---
const euLabel = `Nutrition information per 100 g
Energy 1046 kJ / 250 kcal
Fat 9.0 g
of which saturates 1.2 g
Carbohydrate 33 g
of which sugars 5.6 g
Fibre 3.1 g
Protein 8.4 g
Salt 0.9 g`;
const eu = parseNutritionText(euLabel);
eq(eu.qty, 100, "EU label: per-100g reference amount");
eq(eu.kcal, 250, "EU label: kcal taken from kJ/kcal pair");
eq(eu.fat, 9, "EU label: fat, saturates skipped");
eq(eu.carbs, 33, "EU label: carbs, sugars skipped");
eq(eu.protein, 8.4, "EU label: protein");
eq(parseNutritionText("hello world").kcal, undefined, "label: garbage text finds nothing");

// --- unpriced names for the Prices tab ---
eq(unpricedNames(), ["lettuce"], "lettuce is the only unpriced planned ingredient");

// --- migration of older data shapes ---
const old = migrate({ recipes: [], plan: [{ id: "x", day: 0, recipeId: "r1", servings: 2 }] });
eq(old.plan[0].slot, "dinner", "plan entries without slot default to dinner");
eq(Array.isArray(old.prices), true, "migrate adds prices array");
eq(old.meta.created > 0, true, "migrate stamps a created date");

// --- backup nudge ---
const realData = data;
const week = 7 * 864e5;
globalThis.data = { recipes: [{}], plan: [], prices: [], meta: { created: Date.now() - 3 * week } };
eq(needsBackupNudge(), true, "nudge after two weeks with no backup");
data.meta.lastBackup = Date.now() - week;
eq(needsBackupNudge(), false, "no nudge soon after a backup");
data.meta.lastBackup = Date.now() - 3 * week;
eq(needsBackupNudge(), true, "nudge again when backup is stale");
data.meta.snoozeUntil = Date.now() + week;
eq(needsBackupNudge(), false, "snooze silences the nudge");
globalThis.data = { recipes: [], plan: [], prices: [], meta: { created: 0 } };
eq(needsBackupNudge(), false, "no nudge when there is nothing to lose");
globalThis.data = realData;

// --- deleted recipe in plan is ignored everywhere ---
data.plan.push({ id: "m3", day: 2, slot: "dinner", recipeId: "ghost", servings: 2 });
eq(buildList().length, 2, "missing recipe ignored in list");
eq(mealCost(data.plan[2]).total, 0, "missing recipe costs nothing");

console.log(fails ? `\n${fails} TEST(S) FAILED` : "\nALL TESTS PASSED");
process.exit(fails ? 1 : 0);
