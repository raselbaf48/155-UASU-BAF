var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/features/canteen/utils/recipeManager.ts
var recipeManager_exports = {};
__export(recipeManager_exports, {
  INITIAL_RAW_ITEMS: () => INITIAL_RAW_ITEMS,
  LEGACY_RECIPES_STORAGE_KEY: () => LEGACY_RECIPES_STORAGE_KEY,
  RAW_ITEMS_STORAGE_KEY: () => RAW_ITEMS_STORAGE_KEY,
  RAW_LOGS_STORAGE_KEY: () => RAW_LOGS_STORAGE_KEY,
  RECIPES_STORAGE_KEY: () => RECIPES_STORAGE_KEY,
  autoRestockFromExpense: () => autoRestockFromExpense,
  calculateMenuItemCost: () => calculateMenuItemCost,
  deductRawStockForSales: () => deductRawStockForSales,
  deduplicateRawItems: () => deduplicateRawItems,
  ensureCookingIngredients: () => ensureCookingIngredients,
  formatRecipeRawItemsString: () => formatRecipeRawItemsString,
  getEffectiveRawUnitCost: () => getEffectiveRawUnitCost,
  getIngredientToInventoryRatio: () => getIngredientToInventoryRatio,
  getMenuRecipes: () => getMenuRecipes,
  getRawInventoryItems: () => getRawInventoryItems,
  getRawItemSubUnitInfo: () => getRawItemSubUnitInfo,
  getRecipeForMenuItem: () => getRecipeForMenuItem,
  normalizeRawItemName: () => normalizeRawItemName,
  restoreRawStockForSaleCancellation: () => restoreRawStockForSaleCancellation,
  saveRawInventoryItems: () => saveRawInventoryItems,
  saveRecipeForMenuItem: () => saveRecipeForMenuItem
});
module.exports = __toCommonJS(recipeManager_exports);
var import_supabase = require("../../../supabase");
var RAW_ITEMS_STORAGE_KEY = "canteen_raw_inventory_items_v2";
var RAW_LOGS_STORAGE_KEY = "canteen_raw_stock_logs_v2";
var RECIPES_STORAGE_KEY = "canteen_menu_recipes_v3";
var LEGACY_RECIPES_STORAGE_KEY = "canteen_menu_recipes_v2";
var getRawItemSubUnitInfo = (item) => {
  if (!item) {
    return { hasSubUnit: false, subUnit: "", packSize: 1, label: "" };
  }
  const u = (item.unit || "").toLowerCase().trim();
  const explicitSub = (item.subUnit || "").toLowerCase().trim();
  if (u === "pcs" || u === "pc" || u === "piece" || u === "\u099F\u09BF" || u === "\u099F\u09BE") {
    return { hasSubUnit: false, subUnit: "", packSize: 1, label: "" };
  }
  if (u && explicitSub && u === explicitSub) {
    return { hasSubUnit: false, subUnit: "", packSize: 1, label: "" };
  }
  if (u === "kg" || explicitSub === "gm" && u !== "gm") {
    const size = item.packSize && item.packSize > 1 ? item.packSize : 1e3;
    return { hasSubUnit: true, subUnit: "gm", packSize: size, label: `\u09E7 \u0995\u09C7\u099C\u09BF = ${size} \u0997\u09CD\u09B0\u09BE\u09AE` };
  }
  if (["liter", "ltr", "litre", "l"].includes(u) || explicitSub === "ml" && !["liter", "ltr", "litre", "l"].includes(u)) {
    const size = item.packSize && item.packSize > 1 ? item.packSize : 1e3;
    return { hasSubUnit: true, subUnit: "ml", packSize: size, label: `\u09E7 \u09B2\u09BF\u099F\u09BE\u09B0 = ${size} \u09AE\u09BF\u09B2\u09BF` };
  }
  if (["case", "crate"].includes(u) || u.includes("case") && explicitSub === "pcs") {
    const size = item.packSize && item.packSize > 1 ? item.packSize : 30;
    return { hasSubUnit: true, subUnit: "pcs", packSize: size, label: `\u09E7 \u0995\u09C7\u09B8 = ${size} \u09AA\u09BF\u09B8` };
  }
  if (["packet", "box", "pkt"].includes(u)) {
    const sub = item.subUnit && item.subUnit.toLowerCase().trim() !== u ? item.subUnit.trim() : "pcs";
    const size = item.packSize && item.packSize > 1 ? item.packSize : 24;
    return { hasSubUnit: true, subUnit: sub, packSize: size, label: `\u09E7 ${item.unit || "\u09AA\u09CD\u09AF\u09BE\u0995\u09C7\u099F"} = ${size} ${sub}` };
  }
  if (Boolean(item.hasSubUnits) && item.subUnit && item.subUnit.toLowerCase().trim() !== u) {
    const size = item.packSize && item.packSize > 1 ? item.packSize : 1;
    if (size > 1) {
      return { hasSubUnit: true, subUnit: item.subUnit, packSize: size, label: `\u09E7 ${item.unit} = ${size} ${item.subUnit}` };
    }
  }
  return { hasSubUnit: false, subUnit: item.unit || "pcs", packSize: 1, label: "" };
};
var getIngredientToInventoryRatio = (rawItem, ingredientUnit) => {
  const ingUnit = (ingredientUnit || "").toLowerCase().trim();
  const rawUnit = (rawItem.unit || "").toLowerCase().trim();
  const subUnit = (rawItem.subUnit || "").toLowerCase().trim();
  if (ingUnit === rawUnit) {
    return 1;
  }
  if (rawUnit === "pcs" || rawUnit === "pc" || rawUnit === "piece" || rawUnit === "\u099F\u09BF" || rawUnit === "\u099F\u09BE") {
    return 1;
  }
  const isGm = ingUnit === "gm" || ingUnit === "g" || ingUnit === "gram";
  const isKg = rawUnit === "kg";
  if (isGm && (isKg || subUnit === "gm")) {
    return rawItem.packSize && rawItem.packSize > 1 ? rawItem.packSize : 1e3;
  }
  const isMl = ingUnit === "ml" || ingUnit === "milli" || ingUnit === "milliliter";
  const isLtr = rawUnit === "liter" || rawUnit === "ltr" || rawUnit === "litre" || rawUnit === "l";
  if (isMl && (isLtr || subUnit === "ml")) {
    return rawItem.packSize && rawItem.packSize > 1 ? rawItem.packSize : 1e3;
  }
  const isPcs = ingUnit === "pcs" || ingUnit === "piece" || ingUnit === "pc" || ingUnit === "slice" || ingUnit === "cup" || ingUnit === "sheet";
  const isCase = rawUnit === "case" || rawUnit === "crate";
  if (isCase && isPcs) {
    return rawItem.packSize && rawItem.packSize > 1 ? rawItem.packSize : 30;
  }
  const isPkt = rawUnit === "packet" || rawUnit === "box" || rawUnit === "pkt";
  if (rawItem.packSize && rawItem.packSize > 1 && subUnit && subUnit !== rawUnit) {
    if (ingUnit === subUnit || isPkt && isPcs) {
      return rawItem.packSize;
    }
  }
  return 1;
};
var INITIAL_RAW_ITEMS = [
  {
    id: "raw-1",
    name: "Chicken",
    nameBn: "\u09AC\u09CD\u09B0\u09AF\u09BC\u09B2\u09BE\u09B0 \u09AE\u09C1\u09B0\u0997\u09BF\u09B0 \u09AE\u09BE\u0982\u09B8",
    category: "Meat & Poultry",
    subCategory: "Kg - gm",
    unit: "kg",
    currentStock: 35,
    minStockAlert: 12,
    unitCost: 230,
    wastagePercentage: 30,
    lastRestockedDate: "2026-09-18",
    supplier: "Local Poultry Market",
    notes: "Fresh broiler chicken for daily dishes",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-2",
    name: "Rice",
    nameBn: "\u09AE\u09BF\u09A8\u09BF\u0995\u09C7\u099F \u099A\u09BE\u09B2",
    category: "Grains & Pulses",
    subCategory: "Kg - gm",
    unit: "kg",
    currentStock: 140,
    minStockAlert: 40,
    unitCost: 75,
    lastRestockedDate: "2026-09-15",
    supplier: "Base Ration Depot",
    notes: "Premium Miniket rice 50kg sacks",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-3",
    name: "Dal",
    nameBn: "\u09AE\u09B8\u09C1\u09B0 \u09A1\u09BE\u09B2",
    category: "Grains & Pulses",
    subCategory: "Kg - gm",
    unit: "kg",
    currentStock: 42,
    minStockAlert: 15,
    unitCost: 135,
    lastRestockedDate: "2026-09-16",
    supplier: "Base Ration Depot",
    notes: "Red split lentils",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-4",
    name: "Milk Powder",
    nameBn: "\u0997\u09C1\u0981\u09A1\u09BC\u09BE \u09A6\u09C1\u09A7 (Dano/Diploma)",
    category: "Dairy & Beverages",
    subCategory: "Kg - gm",
    unit: "kg",
    currentStock: 18,
    minStockAlert: 6,
    unitCost: 880,
    lastRestockedDate: "2026-09-17",
    supplier: "City Super Store",
    notes: "For canteen milk tea and coffee preparation",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-5",
    name: "Tea Bag",
    nameBn: "\u099F\u09BF \u09AC\u09CD\u09AF\u09BE\u0997 (Tea Bag)",
    category: "Dairy & Beverages",
    subCategory: "Packet - Pcs",
    unit: "packet",
    currentStock: 48,
    minStockAlert: 15,
    unitCost: 165,
    lastRestockedDate: "2026-09-19",
    supplier: "Ispahani / Taaza Distributor",
    notes: "\u09E7 \u09AA\u09CD\u09AF\u09BE\u0995\u09C7\u099F\u09C7 \u09E7\u09E6\u09E6 \u099F\u09BF \u099F\u09BF-\u09AC\u09CD\u09AF\u09BE\u0997 \u09A5\u09BE\u0995\u09C7 (1 packet = 100 pcs)",
    packSize: 100,
    subUnit: "pcs",
    hasSubUnits: true
  },
  {
    id: "raw-6",
    name: "Noodles",
    nameBn: "\u0995\u09BE\u0981\u099A\u09BE \u09A8\u09C1\u09A1\u09B2\u09B8 (Raw Maggi/Egg)",
    category: "Dry Food & Snacks",
    subCategory: "Packet - Pcs",
    unit: "packet",
    currentStock: 75,
    minStockAlert: 25,
    unitCost: 45,
    lastRestockedDate: "2026-09-20",
    supplier: "Wholesale Store",
    notes: "Standard family pack noodles",
    packSize: 1,
    subUnit: "pcs",
    hasSubUnits: true
  },
  {
    id: "raw-7",
    name: "Egg",
    nameBn: "\u09AE\u09C1\u09B0\u0997\u09BF\u09B0 \u09A1\u09BF\u09AE (\u09B2\u09BE\u09B2 \u09A1\u09BF\u09AE)",
    category: "Meat & Poultry",
    subCategory: "Case - Pcs",
    unit: "case",
    currentStock: 10,
    minStockAlert: 3,
    unitCost: 375,
    lastRestockedDate: "2026-09-20",
    supplier: "Poultry Farm Direct",
    notes: "Daily breakfast and snacks omelet supply (\u09E7 \u0995\u09C7\u09B8 = \u09E9\u09E6 \u09AA\u09BF\u09B8 \u09A1\u09BF\u09AE)",
    packSize: 30,
    subUnit: "pcs",
    hasSubUnits: true
  },
  {
    id: "raw-8",
    name: "Biscuit",
    nameBn: "\u09AC\u09BF\u09B8\u09CD\u0995\u09C1\u099F \u09AA\u09CD\u09AF\u09BE\u0995\u09C7\u099F (\u099F\u09CB\u09B8\u09CD\u099F / \u09A1\u09CD\u09B0\u09BE\u0987 \u0995\u09C7\u0995)",
    category: "Dry Food & Snacks",
    subCategory: "Packet - Pcs",
    unit: "packet",
    currentStock: 95,
    minStockAlert: 30,
    unitCost: 35,
    lastRestockedDate: "2026-09-18",
    supplier: "Olympic / Dan Cake",
    notes: "Canteen counter biscuits",
    packSize: 24,
    subUnit: "pcs",
    hasSubUnits: true
  },
  {
    id: "raw-9",
    name: "One Time Box",
    nameBn: "\u0993\u09AF\u09BC\u09BE\u09A8 \u099F\u09BE\u0987\u09AE \u09AB\u09C1\u09A1 \u09AC\u0995\u09CD\u09B8 \u0993 \u0995\u09BE\u09AA",
    category: "Packaging & Disposables",
    unit: "pcs",
    currentStock: 420,
    minStockAlert: 100,
    unitCost: 6.5,
    lastRestockedDate: "2026-09-14",
    supplier: "Packaging Mart",
    notes: "Food grade disposable boxes for takeaway"
  },
  {
    id: "raw-10",
    name: "Pasta",
    nameBn: "\u0995\u09BE\u0981\u099A\u09BE \u09AA\u09BE\u09B8\u09CD\u09A4\u09BE (Macaroni/Spiral)",
    category: "Dry Food & Snacks",
    subCategory: "Kg - gm",
    unit: "kg",
    currentStock: 22,
    minStockAlert: 8,
    unitCost: 145,
    lastRestockedDate: "2026-09-15",
    supplier: "City Grocery",
    notes: "Evening snacks pasta preparation",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-12",
    name: "Soyabin Oil",
    nameBn: "\u09B8\u09AF\u09BC\u09BE\u09AC\u09BF\u09A8 \u09A4\u09C7\u09B2 (\u09B0\u09C2\u09AA\u099A\u09BE\u0981\u09A6\u09BE/\u09A4\u09C0\u09B0)",
    category: "Oil & Spices",
    subCategory: "Ltr - ml",
    unit: "liter",
    currentStock: 52,
    minStockAlert: 18,
    unitCost: 185,
    lastRestockedDate: "2026-09-16",
    supplier: "City Edible Oil Co",
    notes: "Cooking oil 5L bottles",
    packSize: 1e3,
    subUnit: "ml",
    hasSubUnits: true
  },
  {
    id: "raw-13",
    name: "Sugar",
    nameBn: "\u09B8\u09BE\u09A6\u09BE \u099A\u09BF\u09A8\u09BF",
    category: "Oil & Spices",
    subCategory: "Kg - gm",
    unit: "kg",
    currentStock: 38,
    minStockAlert: 12,
    unitCost: 132,
    lastRestockedDate: "2026-09-17",
    supplier: "Local Wholesale",
    notes: "For tea, coffee and desserts",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-14",
    name: "Onion",
    nameBn: "\u09AA\u09C7\u0981\u09DF\u09BE\u099C (\u09A6\u09C7\u09B6\u09BF / \u0986\u09AE\u09A6\u09BE\u09A8\u09BF\u0995\u09C3\u09A4)",
    category: "Vegetables",
    subCategory: "Kg - gm",
    unit: "kg",
    currentStock: 28,
    minStockAlert: 10,
    unitCost: 78,
    lastRestockedDate: "2026-09-20",
    supplier: "Local Bazar",
    notes: "Daily kitchen staple",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-15",
    name: "Halim Mix",
    nameBn: "\u09B9\u09BE\u09B2\u09BF\u09AE \u09AE\u09BF\u0995\u09CD\u09B8 \u09AE\u09B8\u09B2\u09BE \u0993 \u09A1\u09BE\u09B2",
    category: "Oil & Spices",
    subCategory: "Packet - Pcs",
    unit: "packet",
    currentStock: 30,
    minStockAlert: 10,
    unitCost: 65,
    lastRestockedDate: "2026-09-21",
    supplier: "Radhuni / Pran",
    notes: "Halim mix pulses & spices packet for special halim",
    packSize: 1,
    subUnit: "pcs",
    hasSubUnits: true
  },
  {
    id: "raw-16",
    name: "LPG",
    nameBn: "\u098F\u09B2\u09AA\u09BF\u099C\u09BF \u0997\u09CD\u09AF\u09BE\u09B8 (LPG)",
    category: "Fuel & Utilities",
    subCategory: "Gas Cylinder",
    unit: "cylinder",
    currentStock: 4,
    minStockAlert: 1,
    unitCost: 1450,
    lastRestockedDate: "2026-09-21",
    supplier: "Beximco / Omera Gas",
    notes: "Commercial 12kg LPG gas cylinder for cooking stove"
  },
  {
    id: "raw-17",
    name: "Tomato Sauce",
    nameBn: "\u099F\u09AE\u09C7\u099F\u09CB \u09B8\u09B8 (Tometo Sos)",
    category: "Oil & Spices",
    subCategory: "Ltr - ml",
    unit: "bottle",
    currentStock: 25,
    minStockAlert: 8,
    unitCost: 110,
    lastRestockedDate: "2026-09-21",
    supplier: "Pran / Ahmed",
    notes: "Tomato sauce / ketchup for shawarma, snacks & fast food",
    packSize: 1e3,
    subUnit: "ml",
    hasSubUnits: true
  },
  {
    id: "raw-18",
    name: "Maggi Masala",
    nameBn: "\u09AE\u09CD\u09AF\u09BE\u0997\u09BF \u09AE\u09B8\u09B2\u09BE (Maggi Mosla)",
    category: "Oil & Spices",
    subCategory: "Packet - Pcs",
    unit: "packet",
    currentStock: 120,
    minStockAlert: 30,
    unitCost: 8,
    lastRestockedDate: "2026-09-21",
    supplier: "Nestle Wholesale",
    notes: "Maggi taste-maker seasoning sachets",
    packSize: 1,
    subUnit: "pcs",
    hasSubUnits: true
  },
  {
    id: "raw-19",
    name: "Green Chili",
    nameBn: "\u0995\u09BE\u0981\u099A\u09BE \u09AE\u09B0\u09BF\u099A (Green Chili)",
    category: "Vegetables",
    subCategory: "Kg - gm",
    unit: "kg",
    currentStock: 15,
    minStockAlert: 5,
    unitCost: 180,
    wastagePercentage: 10,
    lastRestockedDate: "2026-09-22",
    supplier: "Local Bazar",
    notes: "Fresh green chili for omelet, noodles & snacks",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-20",
    name: "Coffee",
    nameBn: "\u0995\u09AB\u09BF \u09AA\u09BE\u0989\u09A1\u09BE\u09B0 (Coffee)",
    category: "Dairy & Beverages",
    subCategory: "Packet - Pcs",
    unit: "packet",
    currentStock: 40,
    minStockAlert: 12,
    unitCost: 320,
    lastRestockedDate: "2026-09-20",
    supplier: "City Super Store",
    notes: "Nescafe instant coffee powder for milk & cold coffee",
    packSize: 100,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-21",
    name: "Dry Cake",
    nameBn: "\u09A1\u09CD\u09B0\u09BE\u0987 \u0995\u09C7\u0995 (Dry Cake)",
    category: "Dry Food & Snacks",
    subCategory: "Packet - Pcs",
    unit: "packet",
    currentStock: 60,
    minStockAlert: 20,
    unitCost: 12,
    lastRestockedDate: "2026-09-21",
    supplier: "Olympic / Dan Cake",
    notes: "Crispy dry cake for counter sales",
    packSize: 10,
    subUnit: "pcs",
    hasSubUnits: true
  },
  {
    id: "raw-22",
    name: "Swarma Bread",
    nameBn: "\u09B6\u09BE\u09B0\u09CD\u09AE\u09BE \u09AC\u09CD\u09B0\u09C7\u09A1 / \u09B0\u09C1\u099F\u09BF (Swarma)",
    category: "Frozen Foods",
    unit: "pcs",
    currentStock: 80,
    minStockAlert: 25,
    unitCost: 18,
    lastRestockedDate: "2026-09-21",
    supplier: "Bakery Supply",
    notes: "Shawarma pita bread wraps"
  },
  {
    id: "raw-23",
    name: "Butter Ban",
    nameBn: "\u09AC\u09BE\u099F\u09BE\u09B0 \u09AC\u09A8 (Butter Ban)",
    category: "Dry Food & Snacks",
    unit: "pcs",
    currentStock: 70,
    minStockAlert: 20,
    unitCost: 15,
    lastRestockedDate: "2026-09-22",
    supplier: "Local Bakery",
    notes: "Sweet cream butter bun"
  },
  {
    id: "raw-24",
    name: "Sandwich Bread",
    nameBn: "\u09B8\u09CD\u09AF\u09BE\u09A8\u09CD\u09A1\u0989\u0987\u099A \u09AC\u09CD\u09B0\u09C7\u09A1 (Sandwitch)",
    category: "Dry Food & Snacks",
    subCategory: "Packet - Pcs",
    unit: "packet",
    currentStock: 45,
    minStockAlert: 15,
    unitCost: 45,
    lastRestockedDate: "2026-09-21",
    supplier: "City Bakery",
    notes: "\u09E7 \u09AA\u09CD\u09AF\u09BE\u0995\u09C7\u099F\u09C7 \u09E7\u09E8 \u09B8\u09CD\u09B2\u09BE\u0987\u09B8 \u09AA\u09BE\u0989\u09B0\u09C1\u099F\u09BF \u09A5\u09BE\u0995\u09C7 (1 pack = 12 slices)",
    packSize: 12,
    subUnit: "slice",
    hasSubUnits: true
  },
  {
    id: "raw-25",
    name: "Burger Bun",
    nameBn: "\u09AC\u09BE\u09B0\u09CD\u0997\u09BE\u09B0 \u09AC\u09BE\u09A8 (Burger)",
    category: "Dry Food & Snacks",
    unit: "pcs",
    currentStock: 60,
    minStockAlert: 20,
    unitCost: 16,
    lastRestockedDate: "2026-09-22",
    supplier: "City Bakery",
    notes: "Soft sesame burger bun"
  },
  {
    id: "raw-26",
    name: "Hotel Porota",
    nameBn: "\u09B9\u09CB\u099F\u09C7\u09B2 \u09AA\u09B0\u09CB\u099F\u09BE (Hotel Porota)",
    category: "Frozen Foods",
    unit: "pcs",
    currentStock: 160,
    minStockAlert: 40,
    unitCost: 10,
    lastRestockedDate: "2026-09-22",
    supplier: "Hotel Paratha Supply",
    notes: "\u09B9\u09BE\u09A4\u09C7 \u09A4\u09C8\u09B0\u09BF \u09B8\u09C1\u09B8\u09CD\u09AC\u09BE\u09A6\u09C1 \u09B9\u09CB\u099F\u09C7\u09B2 \u09AA\u09B0\u09CB\u099F\u09BE"
  },
  {
    id: "raw-27",
    name: "Salt",
    nameBn: "\u0996\u09BE\u09AC\u09BE\u09B0 \u09B2\u09AC\u09A3 (Salt)",
    category: "Oil & Spices",
    subCategory: "Kg - gm",
    unit: "kg",
    currentStock: 50,
    minStockAlert: 15,
    unitCost: 40,
    lastRestockedDate: "2026-09-18",
    supplier: "Molla / ACI Salt",
    notes: "\u09B0\u09BE\u09A8\u09CD\u09A8\u09BE\u09DF \u09AC\u09CD\u09AF\u09AC\u09B9\u09C3\u09A4 \u0986\u09DF\u09CB\u09A1\u09BF\u09A8\u09AF\u09C1\u0995\u09CD\u09A4 \u0996\u09BE\u09AC\u09BE\u09B0 \u09B2\u09AC\u09A3",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-28",
    name: "Lemon",
    nameBn: "\u0995\u09BE\u0981\u099A\u09BE \u09B2\u09C7\u09AC\u09C1 (Lemon)",
    category: "Vegetables",
    unit: "pcs",
    currentStock: 100,
    minStockAlert: 30,
    unitCost: 6,
    wastagePercentage: 15,
    lastRestockedDate: "2026-09-22",
    supplier: "Local Green Grocer",
    notes: "Fresh juicy lemons for lemon juice, tea & meals"
  },
  {
    id: "raw-29",
    name: "Garlic",
    nameBn: "\u09B0\u09B8\u09C1\u09A8 (Garlic)",
    category: "Oil & Spices",
    unit: "kg",
    currentStock: 15,
    minStockAlert: 5,
    unitCost: 220,
    wastagePercentage: 10,
    lastRestockedDate: "2026-09-22",
    supplier: "Local Bazar",
    notes: "\u09A6\u09C7\u09B6\u09BF \u09AC\u09BE \u099A\u09BE\u09DF\u09A8\u09BE \u0995\u09CB\u09DF\u09BE \u09B0\u09B8\u09C1\u09A8 (\u09B0\u09BE\u09A8\u09CD\u09A8\u09BE \u0993 \u09AA\u09C7\u09B8\u09CD\u099F\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF)",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-30",
    name: "Ginger",
    nameBn: "\u0986\u09A6\u09BE (Ginger)",
    category: "Oil & Spices",
    unit: "kg",
    currentStock: 12,
    minStockAlert: 4,
    unitCost: 240,
    wastagePercentage: 10,
    lastRestockedDate: "2026-09-22",
    supplier: "Local Bazar",
    notes: "\u09A4\u09BE\u099C\u09BE \u0986\u09A6\u09BE (\u0986\u09A6\u09BE \u09AC\u09BE\u099F\u09BE, \u099A\u09BE \u0993 \u09AE\u09BE\u0982\u09B8\u09C7\u09B0 \u09B0\u09BE\u09A8\u09CD\u09A8\u09BE\u09DF \u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF)",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-31",
    name: "Turmeric Powder",
    nameBn: "\u09B9\u09B2\u09C1\u09A6 \u0997\u09C1\u0981\u09DC\u09BE (Holud Gura)",
    category: "Oil & Spices",
    unit: "kg",
    currentStock: 10,
    minStockAlert: 3,
    unitCost: 320,
    lastRestockedDate: "2026-09-22",
    supplier: "Radhuni / Wholesale",
    notes: "\u09B0\u09BE\u09A8\u09CD\u09A8\u09BE\u09DF \u09AC\u09CD\u09AF\u09AC\u09B9\u09C3\u09A4 \u0996\u09BE\u0981\u099F\u09BF \u09B9\u09B2\u09C1\u09A6 \u0997\u09C1\u0981\u09DC\u09BE",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-32",
    name: "Chili Powder",
    nameBn: "\u09AE\u09B0\u09BF\u099A\u09C7\u09B0 \u0997\u09C1\u0981\u09DC\u09BE (Morich Gura)",
    category: "Oil & Spices",
    unit: "kg",
    currentStock: 10,
    minStockAlert: 3,
    unitCost: 380,
    lastRestockedDate: "2026-09-22",
    supplier: "Radhuni / Wholesale",
    notes: "\u09B0\u09BE\u09A8\u09CD\u09A8\u09BE\u09DF \u09AC\u09CD\u09AF\u09AC\u09B9\u09C3\u09A4 \u09B2\u09BE\u09B2 \u09AE\u09B0\u09BF\u099A\u09C7\u09B0 \u0997\u09C1\u0981\u09DC\u09BE",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-33",
    name: "Coriander Powder",
    nameBn: "\u09A7\u09A8\u09C7 \u0997\u09C1\u0981\u09DC\u09BE (Dhone Gura)",
    category: "Oil & Spices",
    unit: "kg",
    currentStock: 8,
    minStockAlert: 2,
    unitCost: 280,
    lastRestockedDate: "2026-09-22",
    supplier: "Radhuni / Wholesale",
    notes: "\u09B8\u09C1\u0997\u09A8\u09CD\u09A7\u09BF \u09A7\u09A8\u09BF\u09DF\u09BE \u0997\u09C1\u0981\u09DC\u09BE \u09AE\u09B8\u09B2\u09BE",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-34",
    name: "Cumin Powder",
    nameBn: "\u099C\u09BF\u09B0\u09BE \u0997\u09C1\u0981\u09DC\u09BE \u0993 \u0997\u09CB\u099F\u09BE \u099C\u09BF\u09B0\u09BE (Jeera)",
    category: "Oil & Spices",
    unit: "kg",
    currentStock: 8,
    minStockAlert: 2,
    unitCost: 850,
    lastRestockedDate: "2026-09-22",
    supplier: "Wholesale Masala Market",
    notes: "\u0996\u09BE\u0981\u099F\u09BF \u099C\u09BF\u09B0\u09BE \u0997\u09C1\u0981\u09DC\u09BE \u0993 \u09B0\u09BE\u09A8\u09CD\u09A8\u09BE\u09B0 \u0997\u09CB\u099F\u09BE \u099C\u09BF\u09B0\u09BE",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-35",
    name: "Garam Masala",
    nameBn: "\u0997\u09B0\u09AE \u09AE\u09B8\u09B2\u09BE \u0997\u09C1\u0981\u09DC\u09BE (Garam Masala)",
    category: "Oil & Spices",
    unit: "kg",
    currentStock: 5,
    minStockAlert: 2,
    unitCost: 950,
    lastRestockedDate: "2026-09-22",
    supplier: "Radhuni / Wholesale",
    notes: "\u09AE\u09BE\u0982\u09B8, \u0996\u09BF\u099A\u09C1\u09DC\u09BF \u0993 \u09B8\u09CD\u09AA\u09C7\u09B6\u09BE\u09B2 \u09B0\u09BE\u09A8\u09CD\u09A8\u09BE\u09DF \u09AC\u09CD\u09AF\u09AC\u09B9\u09C3\u09A4 \u0997\u09B0\u09AE \u09AE\u09B8\u09B2\u09BE \u0997\u09C1\u0981\u09DC\u09BE",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-36",
    name: "Cardamom",
    nameBn: "\u09B8\u09AC\u09C1\u099C \u098F\u09B2\u09BE\u099A (Elachi)",
    category: "Oil & Spices",
    unit: "kg",
    currentStock: 2,
    minStockAlert: 0.5,
    unitCost: 3200,
    lastRestockedDate: "2026-09-22",
    supplier: "Spice Wholesale",
    notes: "\u09B8\u09C1\u0997\u09A8\u09CD\u09A7\u09BF \u099B\u09CB\u099F \u09B8\u09AC\u09C1\u099C \u098F\u09B2\u09BE\u099A",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-37",
    name: "Cinnamon",
    nameBn: "\u09A6\u09BE\u09B0\u09C1\u099A\u09BF\u09A8\u09BF (Daruchini)",
    category: "Oil & Spices",
    unit: "kg",
    currentStock: 4,
    minStockAlert: 1,
    unitCost: 600,
    lastRestockedDate: "2026-09-22",
    supplier: "Spice Wholesale",
    notes: "\u09B8\u09C1\u0997\u09A8\u09CD\u09A7\u09BF \u0986\u09B8\u09B2 \u09A6\u09BE\u09B0\u09C1\u099A\u09BF\u09A8\u09BF \u099B\u09BE\u09B2",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-38",
    name: "Cloves",
    nameBn: "\u09B2\u09AC\u0999\u09CD\u0997 (Lobongo)",
    category: "Oil & Spices",
    unit: "kg",
    currentStock: 2,
    minStockAlert: 0.5,
    unitCost: 1400,
    lastRestockedDate: "2026-09-22",
    supplier: "Spice Wholesale",
    notes: "\u09B0\u09BE\u09A8\u09CD\u09A8\u09BE \u0993 \u099A\u09BE\u09DF\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u0986\u09B8\u09CD\u09A4 \u09B2\u09AC\u0999\u09CD\u0997",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-39",
    name: "Bay Leaf",
    nameBn: "\u09A4\u09C7\u099C\u09AA\u09BE\u09A4\u09BE (Tej Pata)",
    category: "Oil & Spices",
    unit: "kg",
    currentStock: 5,
    minStockAlert: 1,
    unitCost: 180,
    lastRestockedDate: "2026-09-22",
    supplier: "Local Grocery",
    notes: "\u09B6\u09C1\u0995\u09A8\u09BE \u09B8\u09C1\u0997\u09A8\u09CD\u09A7\u09BF \u09A4\u09C7\u099C\u09AA\u09BE\u09A4\u09BE",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-40",
    name: "Black Pepper",
    nameBn: "\u0997\u09CB\u09B2\u09AE\u09B0\u09BF\u099A (Golmorich)",
    category: "Oil & Spices",
    unit: "kg",
    currentStock: 3,
    minStockAlert: 1,
    unitCost: 1100,
    lastRestockedDate: "2026-09-22",
    supplier: "Spice Wholesale",
    notes: "\u0995\u09BE\u09B2\u09CB \u0997\u09CB\u09B2\u09AE\u09B0\u09BF\u099A \u0997\u09CB\u099F\u09BE \u0993 \u0997\u09C1\u0981\u09DC\u09BE",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-41",
    name: "Panch Phoron",
    nameBn: "\u09AA\u09BE\u0981\u099A\u09AB\u09CB\u09DC\u09A8 (Panch Phoron)",
    category: "Oil & Spices",
    unit: "kg",
    currentStock: 5,
    minStockAlert: 1,
    unitCost: 240,
    lastRestockedDate: "2026-09-22",
    supplier: "Local Grocery",
    notes: "\u09A1\u09BE\u09B2 \u0993 \u09A4\u09B0\u0995\u09BE\u09B0\u09BF\u09B0 \u09AA\u09BE\u0981\u099A\u09AE\u09BF\u09B6\u09BE\u09B2\u09BF \u09AB\u09CB\u09DC\u09A8 \u09AE\u09B8\u09B2\u09BE",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-42",
    name: "Mustard Oil",
    nameBn: "\u09B8\u09B0\u09BF\u09B7\u09BE\u09B0 \u09A4\u09C7\u09B2 (Mustard Oil)",
    category: "Oil & Spices",
    unit: "liter",
    currentStock: 15,
    minStockAlert: 5,
    unitCost: 280,
    lastRestockedDate: "2026-09-22",
    supplier: "Radhuni / Teer",
    notes: "\u099D\u09BE\u0981\u099D\u09BE\u09B2\u09CB \u0996\u09BE\u0981\u099F\u09BF \u09B8\u09B0\u09BF\u09B7\u09BE\u09B0 \u09A4\u09C7\u09B2 (\u09AD\u09B0\u09CD\u09A4\u09BE \u0993 \u09B0\u09BE\u09A8\u09CD\u09A8\u09BE\u09B0 \u0995\u09BE\u099C\u09C7)",
    packSize: 1e3,
    subUnit: "ml",
    hasSubUnits: true
  },
  {
    id: "raw-43",
    name: "Cucumber",
    nameBn: "\u09B6\u09B8\u09BE (Cucumber / \u09B8\u09BE\u09B2\u09BE\u09A6)",
    category: "Vegetables",
    subCategory: "Kg - gm",
    unit: "kg",
    currentStock: 25,
    minStockAlert: 8,
    unitCost: 50,
    wastagePercentage: 10,
    lastRestockedDate: "2026-09-22",
    supplier: "Local Green Grocer",
    notes: "\u09B8\u09BE\u09B2\u09BE\u09A6 \u0993 \u0996\u09BE\u09AC\u09BE\u09B0\u09C7\u09B0 \u09B8\u09BE\u09A5\u09C7 \u09AA\u09B0\u09BF\u09AC\u09C7\u09B6\u09A8\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u09A4\u09BE\u099C\u09BE \u09B6\u09B8\u09BE",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  },
  {
    id: "raw-44",
    name: "Black Salt",
    nameBn: "\u09AC\u09BF\u099F \u09B2\u09AC\u09A3 (Black Salt / Bit Lobon)",
    category: "Oil & Spices",
    subCategory: "Kg - gm",
    unit: "kg",
    currentStock: 8,
    minStockAlert: 2,
    unitCost: 120,
    wastagePercentage: 0,
    lastRestockedDate: "2026-09-22",
    supplier: "Local Grocery / Spices Market",
    notes: "\u099A\u099F\u09AA\u099F\u09BF, \u09AB\u09C1\u099A\u0995\u09BE, \u09B9\u09BE\u09B2\u09BF\u09AE, \u09B8\u09BE\u09B2\u09BE\u09A6 \u0993 \u09B2\u09C7\u09AC\u09C1 \u09B6\u09B0\u09AC\u09A4\u09C7\u09B0 \u09AC\u09BF\u09B6\u09C7\u09B7 \u09AC\u09BF\u099F \u09B2\u09AC\u09A3",
    packSize: 1e3,
    subUnit: "gm",
    hasSubUnits: true
  }
];
var DEFAULT_MENU_RECIPES = {
  "EGG MUMLET": [
    { rawItemId: "raw-7", rawItemName: "Egg", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 20, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 5, unit: "gm" },
    { rawItemId: "raw-40", rawItemName: "Black Pepper", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 10, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 2e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 2, unit: "gm" }
  ],
  "EGG OMELET": [
    { rawItemId: "raw-7", rawItemName: "Egg", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 20, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 5, unit: "gm" },
    { rawItemId: "raw-40", rawItemName: "Black Pepper", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 10, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 2e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 2, unit: "gm" }
  ],
  "EGG FRY": [
    { rawItemId: "raw-7", rawItemName: "Egg", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-40", rawItemName: "Black Pepper", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 10, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 2e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 2, unit: "gm" }
  ],
  "EGG POACH": [
    { rawItemId: "raw-7", rawItemName: "Egg", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-40", rawItemName: "Black Pepper", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 10, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 2e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 2, unit: "gm" }
  ],
  "BOILED EGG": [
    { rawItemId: "raw-7", rawItemName: "Egg", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-40", rawItemName: "Black Pepper", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 2e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 2, unit: "gm" }
  ],
  "EGG NOODLES": [
    { rawItemId: "raw-6", rawItemName: "Noodles", quantity: 1, unit: "packet" },
    { rawItemId: "raw-7", rawItemName: "Egg", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-18", rawItemName: "Maggi Masala", quantity: 1, unit: "packet" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 20, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 15, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 3e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 3, unit: "gm" }
  ],
  "GREEN TEA": [
    { rawItemId: "raw-5", rawItemName: "Tea Bag", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-13", rawItemName: "Sugar", quantity: 10, unit: "gm" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 1e-3, unit: "cylinder" }
  ],
  "HALIM": [
    { rawItemId: "raw-1", rawItemName: "Chicken", quantity: 50, unit: "gm" },
    { rawItemId: "raw-15", rawItemName: "Halim Mix", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-3", rawItemName: "Dal", quantity: 30, unit: "gm" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 25, unit: "gm" },
    { rawItemId: "raw-29", rawItemName: "Garlic", quantity: 4, unit: "gm" },
    { rawItemId: "raw-30", rawItemName: "Ginger", quantity: 4, unit: "gm" },
    { rawItemId: "raw-31", rawItemName: "Turmeric Powder", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-32", rawItemName: "Chili Powder", quantity: 2, unit: "gm" },
    { rawItemId: "raw-34", rawItemName: "Cumin Powder", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-35", rawItemName: "Garam Masala", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 15, unit: "ml" },
    { rawItemId: "raw-42", rawItemName: "Mustard Oil", quantity: 3, unit: "ml" },
    { rawItemId: "raw-44", rawItemName: "Black Salt", quantity: 1, unit: "gm" },
    { rawItemId: "raw-28", rawItemName: "Lemon", quantity: 0.25, unit: "pcs" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 5e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 3, unit: "gm" }
  ],
  "LEMON JUICE": [
    { rawItemId: "raw-28", rawItemName: "Lemon", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-13", rawItemName: "Sugar", quantity: 25, unit: "gm" },
    { rawItemId: "raw-44", rawItemName: "Black Salt", quantity: 1, unit: "gm" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 1, unit: "gm" },
    { rawItemId: "raw-9", rawItemName: "One Time Box", quantity: 1, unit: "pcs" }
  ],
  "LIQUOR TEA": [
    { rawItemId: "raw-5", rawItemName: "Tea Bag", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-13", rawItemName: "Sugar", quantity: 15, unit: "gm" },
    { rawItemId: "raw-28", rawItemName: "Lemon", quantity: 0.25, unit: "pcs" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 1e-3, unit: "cylinder" }
  ],
  "MILK COFFEE": [
    { rawItemId: "raw-20", rawItemName: "Coffee", quantity: 2, unit: "gm" },
    { rawItemId: "raw-4", rawItemName: "Milk Powder", quantity: 20, unit: "gm" },
    { rawItemId: "raw-13", rawItemName: "Sugar", quantity: 15, unit: "gm" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 15e-4, unit: "cylinder" }
  ],
  "COLD COFFEE": [
    { rawItemId: "raw-20", rawItemName: "Coffee", quantity: 2, unit: "gm" },
    { rawItemId: "raw-4", rawItemName: "Milk Powder", quantity: 25, unit: "gm" },
    { rawItemId: "raw-13", rawItemName: "Sugar", quantity: 20, unit: "gm" },
    { rawItemId: "raw-9", rawItemName: "One Time Box", quantity: 1, unit: "pcs" }
  ],
  "MILK TEA": [
    { rawItemId: "raw-4", rawItemName: "Milk Powder", quantity: 20, unit: "gm" },
    { rawItemId: "raw-5", rawItemName: "Tea Bag", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-13", rawItemName: "Sugar", quantity: 15, unit: "gm" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 15e-4, unit: "cylinder" }
  ],
  "NOODLES": [
    { rawItemId: "raw-6", rawItemName: "Noodles", quantity: 1, unit: "packet" },
    { rawItemId: "raw-18", rawItemName: "Maggi Masala", quantity: 1, unit: "packet" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 15, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 10, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 3e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 2, unit: "gm" }
  ],
  "NORMAL BISCUIT": [
    { rawItemId: "raw-8", rawItemName: "Biscuit", quantity: 1, unit: "packet" }
  ],
  "DRY CAKE": [
    { rawItemId: "raw-21", rawItemName: "Dry Cake", quantity: 1, unit: "packet" }
  ],
  "BUTTER BAN": [
    { rawItemId: "raw-23", rawItemName: "Butter Ban", quantity: 1, unit: "pcs" }
  ],
  "BURGER": [
    { rawItemId: "raw-25", rawItemName: "Burger Bun", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-1", rawItemName: "Chicken", quantity: 60, unit: "gm" },
    { rawItemId: "raw-17", rawItemName: "Tomato Sauce", quantity: 15, unit: "ml" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 15, unit: "gm" },
    { rawItemId: "raw-29", rawItemName: "Garlic", quantity: 2, unit: "gm" },
    { rawItemId: "raw-30", rawItemName: "Ginger", quantity: 2, unit: "gm" },
    { rawItemId: "raw-40", rawItemName: "Black Pepper", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 10, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 3e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 2, unit: "gm" }
  ],
  "SANDWITCH": [
    { rawItemId: "raw-24", rawItemName: "Sandwich Bread", quantity: 2, unit: "slice" },
    { rawItemId: "raw-7", rawItemName: "Egg", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-17", rawItemName: "Tomato Sauce", quantity: 10, unit: "ml" },
    { rawItemId: "raw-40", rawItemName: "Black Pepper", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 5, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 2e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 2, unit: "gm" }
  ],
  "SANDWICH": [
    { rawItemId: "raw-24", rawItemName: "Sandwich Bread", quantity: 2, unit: "slice" },
    { rawItemId: "raw-7", rawItemName: "Egg", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-17", rawItemName: "Tomato Sauce", quantity: 10, unit: "ml" },
    { rawItemId: "raw-40", rawItemName: "Black Pepper", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 5, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 2e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 2, unit: "gm" }
  ],
  "ONE TIME BOX": [
    { rawItemId: "raw-9", rawItemName: "One Time Box", quantity: 1, unit: "pcs" }
  ],
  "PASTA": [
    { rawItemId: "raw-10", rawItemName: "Pasta", quantity: 100, unit: "gm" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 20, unit: "gm" },
    { rawItemId: "raw-29", rawItemName: "Garlic", quantity: 3, unit: "gm" },
    { rawItemId: "raw-17", rawItemName: "Tomato Sauce", quantity: 15, unit: "ml" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 3, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 15, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 3e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 3, unit: "gm" }
  ],
  "CHICKEN PASTA": [
    { rawItemId: "raw-1", rawItemName: "Chicken", quantity: 80, unit: "gm" },
    { rawItemId: "raw-10", rawItemName: "Pasta", quantity: 80, unit: "gm" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 30, unit: "gm" },
    { rawItemId: "raw-29", rawItemName: "Garlic", quantity: 5, unit: "gm" },
    { rawItemId: "raw-17", rawItemName: "Tomato Sauce", quantity: 15, unit: "ml" },
    { rawItemId: "raw-40", rawItemName: "Black Pepper", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 3, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 15, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 4e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 4, unit: "gm" }
  ],
  "PORATA": [
    { rawItemId: "raw-26", rawItemName: "Hotel Porota", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 10, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 2e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 1, unit: "gm" }
  ],
  "PORATA (HOTEL)": [
    { rawItemId: "raw-26", rawItemName: "Hotel Porota", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 10, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 2e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 1, unit: "gm" }
  ],
  "PORATA (UNIT)": [
    { rawItemId: "raw-26", rawItemName: "Hotel Porota", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 10, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 2e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 1, unit: "gm" }
  ],
  "CHICKEN BIRIYANI": [
    { rawItemId: "raw-1", rawItemName: "Chicken", quantity: 150, unit: "gm" },
    { rawItemId: "raw-2", rawItemName: "Rice", quantity: 150, unit: "gm" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 40, unit: "gm" },
    { rawItemId: "raw-29", rawItemName: "Garlic", quantity: 6, unit: "gm" },
    { rawItemId: "raw-30", rawItemName: "Ginger", quantity: 6, unit: "gm" },
    { rawItemId: "raw-35", rawItemName: "Garam Masala", quantity: 2, unit: "gm" },
    { rawItemId: "raw-36", rawItemName: "Cardamom", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-37", rawItemName: "Cinnamon", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-38", rawItemName: "Cloves", quantity: 0.3, unit: "gm" },
    { rawItemId: "raw-39", rawItemName: "Bay Leaf", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-34", rawItemName: "Cumin Powder", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-32", rawItemName: "Chili Powder", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 25, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 6e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 6, unit: "gm" }
  ],
  "CHICKEN CURRY": [
    { rawItemId: "raw-1", rawItemName: "Chicken", quantity: 150, unit: "gm" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 40, unit: "gm" },
    { rawItemId: "raw-29", rawItemName: "Garlic", quantity: 8, unit: "gm" },
    { rawItemId: "raw-30", rawItemName: "Ginger", quantity: 6, unit: "gm" },
    { rawItemId: "raw-31", rawItemName: "Turmeric Powder", quantity: 3, unit: "gm" },
    { rawItemId: "raw-32", rawItemName: "Chili Powder", quantity: 3, unit: "gm" },
    { rawItemId: "raw-33", rawItemName: "Coriander Powder", quantity: 2, unit: "gm" },
    { rawItemId: "raw-34", rawItemName: "Cumin Powder", quantity: 2, unit: "gm" },
    { rawItemId: "raw-35", rawItemName: "Garam Masala", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-36", rawItemName: "Cardamom", quantity: 0.3, unit: "gm" },
    { rawItemId: "raw-37", rawItemName: "Cinnamon", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-39", rawItemName: "Bay Leaf", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 20, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 5e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 5, unit: "gm" }
  ],
  "CHICKEN KHICHURI": [
    { rawItemId: "raw-1", rawItemName: "Chicken", quantity: 120, unit: "gm" },
    { rawItemId: "raw-2", rawItemName: "Rice", quantity: 120, unit: "gm" },
    { rawItemId: "raw-3", rawItemName: "Dal", quantity: 30, unit: "gm" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 30, unit: "gm" },
    { rawItemId: "raw-29", rawItemName: "Garlic", quantity: 6, unit: "gm" },
    { rawItemId: "raw-30", rawItemName: "Ginger", quantity: 5, unit: "gm" },
    { rawItemId: "raw-31", rawItemName: "Turmeric Powder", quantity: 2.5, unit: "gm" },
    { rawItemId: "raw-32", rawItemName: "Chili Powder", quantity: 2, unit: "gm" },
    { rawItemId: "raw-33", rawItemName: "Coriander Powder", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-34", rawItemName: "Cumin Powder", quantity: 2, unit: "gm" },
    { rawItemId: "raw-35", rawItemName: "Garam Masala", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-39", rawItemName: "Bay Leaf", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 20, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 5e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 5, unit: "gm" }
  ],
  "CHICKEN ONION": [
    { rawItemId: "raw-1", rawItemName: "Chicken", quantity: 120, unit: "gm" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 50, unit: "gm" },
    { rawItemId: "raw-29", rawItemName: "Garlic", quantity: 6, unit: "gm" },
    { rawItemId: "raw-30", rawItemName: "Ginger", quantity: 5, unit: "gm" },
    { rawItemId: "raw-31", rawItemName: "Turmeric Powder", quantity: 2, unit: "gm" },
    { rawItemId: "raw-32", rawItemName: "Chili Powder", quantity: 2.5, unit: "gm" },
    { rawItemId: "raw-33", rawItemName: "Coriander Powder", quantity: 1, unit: "gm" },
    { rawItemId: "raw-34", rawItemName: "Cumin Powder", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-35", rawItemName: "Garam Masala", quantity: 1, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 20, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 4e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 4, unit: "gm" }
  ],
  "CHICKEN PULAW": [
    { rawItemId: "raw-1", rawItemName: "Chicken", quantity: 150, unit: "gm" },
    { rawItemId: "raw-2", rawItemName: "Rice", quantity: 150, unit: "gm" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 35, unit: "gm" },
    { rawItemId: "raw-29", rawItemName: "Garlic", quantity: 5, unit: "gm" },
    { rawItemId: "raw-30", rawItemName: "Ginger", quantity: 5, unit: "gm" },
    { rawItemId: "raw-35", rawItemName: "Garam Masala", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-36", rawItemName: "Cardamom", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-37", rawItemName: "Cinnamon", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-39", rawItemName: "Bay Leaf", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 25, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 5e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 5, unit: "gm" }
  ],
  "CHICKEN POLAO": [
    { rawItemId: "raw-1", rawItemName: "Chicken", quantity: 150, unit: "gm" },
    { rawItemId: "raw-2", rawItemName: "Rice", quantity: 150, unit: "gm" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 35, unit: "gm" },
    { rawItemId: "raw-29", rawItemName: "Garlic", quantity: 5, unit: "gm" },
    { rawItemId: "raw-30", rawItemName: "Ginger", quantity: 5, unit: "gm" },
    { rawItemId: "raw-35", rawItemName: "Garam Masala", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-36", rawItemName: "Cardamom", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-37", rawItemName: "Cinnamon", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-39", rawItemName: "Bay Leaf", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 25, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 5e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 5, unit: "gm" }
  ],
  "EGG KHICURI": [
    { rawItemId: "raw-7", rawItemName: "Egg", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-2", rawItemName: "Rice", quantity: 120, unit: "gm" },
    { rawItemId: "raw-3", rawItemName: "Dal", quantity: 30, unit: "gm" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 30, unit: "gm" },
    { rawItemId: "raw-29", rawItemName: "Garlic", quantity: 4, unit: "gm" },
    { rawItemId: "raw-30", rawItemName: "Ginger", quantity: 4, unit: "gm" },
    { rawItemId: "raw-31", rawItemName: "Turmeric Powder", quantity: 2, unit: "gm" },
    { rawItemId: "raw-32", rawItemName: "Chili Powder", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-34", rawItemName: "Cumin Powder", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-39", rawItemName: "Bay Leaf", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 20, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 4e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 4, unit: "gm" }
  ],
  "EGG KHICHURI": [
    { rawItemId: "raw-7", rawItemName: "Egg", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-2", rawItemName: "Rice", quantity: 120, unit: "gm" },
    { rawItemId: "raw-3", rawItemName: "Dal", quantity: 30, unit: "gm" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 30, unit: "gm" },
    { rawItemId: "raw-29", rawItemName: "Garlic", quantity: 4, unit: "gm" },
    { rawItemId: "raw-30", rawItemName: "Ginger", quantity: 4, unit: "gm" },
    { rawItemId: "raw-31", rawItemName: "Turmeric Powder", quantity: 2, unit: "gm" },
    { rawItemId: "raw-32", rawItemName: "Chili Powder", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-34", rawItemName: "Cumin Powder", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-39", rawItemName: "Bay Leaf", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 20, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 4e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 4, unit: "gm" }
  ],
  "CHOTPOTI": [
    { rawItemId: "raw-3", rawItemName: "Dal", quantity: 60, unit: "gm" },
    { rawItemId: "raw-7", rawItemName: "Egg", quantity: 0.5, unit: "pcs" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 20, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 5, unit: "gm" },
    { rawItemId: "raw-34", rawItemName: "Cumin Powder", quantity: 2, unit: "gm" },
    { rawItemId: "raw-32", rawItemName: "Chili Powder", quantity: 1, unit: "gm" },
    { rawItemId: "raw-44", rawItemName: "Black Salt", quantity: 1.5, unit: "gm" },
    { rawItemId: "raw-28", rawItemName: "Lemon", quantity: 0.25, unit: "pcs" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 4e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 2, unit: "gm" }
  ],
  "SWARMA": [
    { rawItemId: "raw-22", rawItemName: "Swarma Bread", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-1", rawItemName: "Chicken", quantity: 70, unit: "gm" },
    { rawItemId: "raw-17", rawItemName: "Tomato Sauce", quantity: 15, unit: "ml" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 20, unit: "gm" },
    { rawItemId: "raw-29", rawItemName: "Garlic", quantity: 3, unit: "gm" },
    { rawItemId: "raw-30", rawItemName: "Ginger", quantity: 2, unit: "gm" },
    { rawItemId: "raw-35", rawItemName: "Garam Masala", quantity: 1, unit: "gm" },
    { rawItemId: "raw-40", rawItemName: "Black Pepper", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 10, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 3e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 2, unit: "gm" }
  ],
  "SHAWARMA": [
    { rawItemId: "raw-22", rawItemName: "Swarma Bread", quantity: 1, unit: "pcs" },
    { rawItemId: "raw-1", rawItemName: "Chicken", quantity: 70, unit: "gm" },
    { rawItemId: "raw-17", rawItemName: "Tomato Sauce", quantity: 15, unit: "ml" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 20, unit: "gm" },
    { rawItemId: "raw-29", rawItemName: "Garlic", quantity: 3, unit: "gm" },
    { rawItemId: "raw-30", rawItemName: "Ginger", quantity: 2, unit: "gm" },
    { rawItemId: "raw-35", rawItemName: "Garam Masala", quantity: 1, unit: "gm" },
    { rawItemId: "raw-40", rawItemName: "Black Pepper", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-12", rawItemName: "Soyabin Oil", quantity: 10, unit: "ml" },
    { rawItemId: "raw-16", rawItemName: "Gas Cylinder", quantity: 3e-3, unit: "cylinder" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 2, unit: "gm" }
  ],
  "SOSA": [
    { rawItemId: "raw-43", rawItemName: "Cucumber", quantity: 100, unit: "gm" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 15, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 3, unit: "gm" },
    { rawItemId: "raw-28", rawItemName: "Lemon", quantity: 0.25, unit: "pcs" },
    { rawItemId: "raw-44", rawItemName: "Black Salt", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 1, unit: "gm" }
  ],
  "SALAD": [
    { rawItemId: "raw-43", rawItemName: "Cucumber", quantity: 100, unit: "gm" },
    { rawItemId: "raw-14", rawItemName: "Onion", quantity: 15, unit: "gm" },
    { rawItemId: "raw-19", rawItemName: "Green Chili", quantity: 3, unit: "gm" },
    { rawItemId: "raw-28", rawItemName: "Lemon", quantity: 0.25, unit: "pcs" },
    { rawItemId: "raw-44", rawItemName: "Black Salt", quantity: 0.5, unit: "gm" },
    { rawItemId: "raw-27", rawItemName: "Salt", quantity: 1, unit: "gm" }
  ]
};
var normalizeRawItemName = (name) => {
  const s = (name || "").toLowerCase().trim();
  if (s.includes("black salt") || s.includes("bit lobon") || s.includes("bit laban") || s.includes("\u09AC\u09BF\u099F \u09B2\u09AC\u09A3") || s.includes("\u09AC\u09BF\u099F \u09B2\u09AC\u09A8") || s.includes("beet salt")) return "black-salt";
  if (s.includes("cucumber") || s.includes("\u09B6\u09B8\u09BE") || s.includes("shosa") || s.includes("sosa")) return "cucumber";
  if (s.includes("salt") || s.includes("\u09B2\u09AC\u09A3")) return "salt";
  if (s.includes("gas") || s.includes("\u0997\u09CD\u09AF\u09BE\u09B8") || s.includes("cylinder") || s.includes("lpg")) return "gas-cylinder";
  if (s.includes("coffee") || s.includes("\u0995\u09AB\u09BF")) return "coffee";
  if (s.includes("dry cake") || s.includes("\u09A1\u09CD\u09B0\u09BE\u0987 \u0995\u09C7\u0995")) return "dry-cake";
  if (s.includes("halim") || s.includes("\u09B9\u09BE\u09B2\u09BF\u09AE")) return "halim-mix";
  if (s.includes("tometo") || s.includes("tomato") || s.includes("\u099F\u09AE\u09C7\u099F\u09CB")) return "tomato-sauce";
  if (s.includes("maggi") || s.includes("\u09AE\u09CD\u09AF\u09BE\u0997\u09BF")) return "maggi-masala";
  if (s.includes("green chili") || s.includes("\u0995\u09BE\u0981\u099A\u09BE \u09AE\u09B0\u09BF\u099A")) return "green-chili";
  if (s.includes("garlic") || s.includes("\u09B0\u09B8\u09C1\u09A8")) return "garlic";
  if (s.includes("ginger") || s.includes("\u0986\u09A6\u09BE")) return "ginger";
  if (s.includes("turmeric") || s.includes("\u09B9\u09B2\u09C1\u09A6") || s.includes("holud")) return "turmeric";
  if (s.includes("chili powder") || s.includes("\u09AE\u09B0\u09BF\u099A \u0997\u09C1\u0981\u09DC\u09BE") || s.includes("\u09AE\u09B0\u09BF\u099A\u09C7\u09B0 \u0997\u09C1\u0981\u09DC\u09BE") || s.includes("morich gura")) return "chili-powder";
  if (s.includes("coriander") || s.includes("\u09A7\u09A8\u09C7") || s.includes("\u09A7\u09A8\u09BF\u09DF\u09BE") || s.includes("dhone")) return "coriander-powder";
  if (s.includes("cumin") || s.includes("jeera") || s.includes("jira") || s.includes("\u099C\u09BF\u09B0\u09BE")) return "cumin";
  if (s.includes("garam masala") || s.includes("\u0997\u09B0\u09AE \u09AE\u09B8\u09B2\u09BE") || s.includes("\u0997\u09B0\u09AE \u09AE\u09B6\u09B2\u09BE")) return "garam-masala";
  if (s.includes("cardamom") || s.includes("elachi") || s.includes("elach") || s.includes("\u098F\u09B2\u09BE\u099A") || s.includes("\u098F\u09B2\u09BE\u099A\u09BF")) return "cardamom";
  if (s.includes("cinnamon") || s.includes("daruchini") || s.includes("\u09A6\u09BE\u09B0\u09C1\u099A\u09BF\u09A8\u09BF")) return "cinnamon";
  if (s.includes("clove") || s.includes("lobongo") || s.includes("\u09B2\u09AC\u0999\u09CD\u0997")) return "cloves";
  if (s.includes("bay leaf") || s.includes("bay leaves") || s.includes("tej pata") || s.includes("tejpata") || s.includes("\u09A4\u09C7\u099C\u09AA\u09BE\u09A4\u09BE")) return "bay-leaf";
  if (s.includes("black pepper") || s.includes("golmorich") || s.includes("\u0997\u09CB\u09B2\u09AE\u09B0\u09BF\u099A")) return "black-pepper";
  if (s.includes("panch phoron") || s.includes("panchforon") || s.includes("\u09AA\u09BE\u0981\u099A\u09AB\u09CB\u09DC\u09A8") || s.includes("\u09AA\u09BE\u0981\u099A\u09AB\u09CB\u09A1\u09BC\u09A8")) return "panch-phoron";
  if (s.includes("mustard oil") || s.includes("shorisha") || s.includes("\u09B8\u09B0\u09BF\u09B7\u09BE\u09B0 \u09A4\u09C7\u09B2")) return "mustard-oil";
  if (s.includes("swarma") || s.includes("\u09B6\u09BE\u09B0\u09CD\u09AE\u09BE") || s.includes("shawarma")) return "swarma-bread";
  if (s.includes("butter ban") || s.includes("\u09AC\u09BE\u099F\u09BE\u09B0 \u09AC\u09A8") || s.includes("butter bun")) return "butter-ban";
  if (s.includes("sandwitch") || s.includes("sandwich") || s.includes("\u09B8\u09CD\u09AF\u09BE\u09A8\u09CD\u09A1\u0989\u0987\u099A")) return "sandwich-bread";
  if (s.includes("burger") || s.includes("\u09AC\u09BE\u09B0\u09CD\u0997\u09BE\u09B0")) return "burger-bun";
  if (s.includes("porota") || s.includes("\u09AA\u09B0\u09CB\u099F\u09BE")) return "porota";
  if (s.includes("lemon") || s.includes("\u09B2\u09C7\u09AC\u09C1")) return "lemon";
  if (s.includes("tea bag") || s.includes("\u099F\u09BF \u09AC\u09CD\u09AF\u09BE\u0997")) return "tea-bag";
  if (s.includes("chicken") || s.includes("\u09AE\u09C1\u09B0\u0997\u09BF")) return "chicken";
  if (s.includes("rice") || s.includes("\u099A\u09BE\u09B2")) return "rice";
  if (s.includes("dal") || s.includes("\u09A1\u09BE\u09B2")) return "dal";
  if (s.includes("milk") || s.includes("\u09A6\u09C1\u09A7")) return "milk-powder";
  if (s.includes("noodle") || s.includes("\u09A8\u09C1\u09A1\u09B2\u09B8")) return "noodles";
  if (s.includes("egg") || s.includes("\u09A1\u09BF\u09AE")) return "egg";
  if (s.includes("oil") || s.includes("\u09A4\u09C7\u09B2")) return "oil";
  if (s.includes("sugar") || s.includes("\u099A\u09BF\u09A8\u09BF")) return "sugar";
  if (s.includes("onion") || s.includes("\u09AA\u09C7\u0981\u09DF\u09BE\u099C") || s.includes("\u09AA\u09C7\u09AF\u09BC\u09BE\u099C")) return "onion";
  if (s.includes("pasta") || s.includes("\u09AA\u09BE\u09B8\u09CD\u09A4\u09BE")) return "pasta";
  if (s.includes("biscuit") || s.includes("\u09AC\u09BF\u09B8\u09CD\u0995\u09C1\u099F")) return "biscuit";
  if (s.includes("box") || s.includes("one time") || s.includes("\u0993\u09AF\u09BC\u09BE\u09A8 \u099F\u09BE\u0987\u09AE")) return "one-time-box";
  return s.replace(/[^a-z0-9]/g, "");
};
var encodeNotesWithMeta = (notes, meta) => {
  let base = (notes || "").replace(/<!--META:[\s\S]*?-->/g, "").trim();
  if (meta && Object.keys(meta).length > 0) {
    base = base ? `${base} <!--META:${JSON.stringify(meta)}-->` : `<!--META:${JSON.stringify(meta)}-->`;
  }
  return base;
};
var deduplicateRawItems = (items) => {
  const actualItems = Array.isArray(items) ? items : items && Array.isArray(items.deduplicated) ? items.deduplicated : [];
  const seenKeys = /* @__PURE__ */ new Map();
  const removedIds = [];
  for (const item of actualItems) {
    const key = normalizeRawItemName(item.name);
    const u = (item.unit || "").toLowerCase().trim();
    const subCatLower = (item.subCategory || "").toLowerCase().trim();
    const explicitSub = (item.subUnit || "").toLowerCase().trim();
    const isPcs = u === "pcs" || u === "pc" || u === "piece" || u === "\u099F\u09BF" || u === "\u099F\u09BE";
    const isKg = !isPcs && (u === "kg" || explicitSub === "gm" || subCatLower.includes("kg"));
    const isLtr = !isPcs && (u === "liter" || u === "ltr" || u === "litre" || u === "l" || explicitSub === "ml" || subCatLower.includes("ltr"));
    const isCase = !isPcs && (u === "case" || u === "crate" || subCatLower.includes("case") || key === "egg");
    const isPacket = !isPcs && (u === "packet" || u === "box" || u === "pkt" || subCatLower.includes("packet"));
    let subCategory = item.subCategory;
    let subUnit = item.subUnit;
    let packSize = item.packSize;
    let hasSubUnits = Boolean(item.hasSubUnits);
    if (isPcs) {
      subCategory = item.subCategory || "Pcs";
      subUnit = void 0;
      packSize = 1;
      hasSubUnits = false;
    } else if (isKg) {
      subCategory = item.subCategory || "Kg - gm";
      subUnit = "gm";
      packSize = item.packSize && item.packSize > 1 ? item.packSize : 1e3;
      hasSubUnits = true;
    } else if (isLtr) {
      subCategory = item.subCategory || "Ltr - ml";
      subUnit = "ml";
      packSize = item.packSize && item.packSize > 1 ? item.packSize : 1e3;
      hasSubUnits = true;
    } else if (isCase || key === "egg") {
      subCategory = item.subCategory || "Case - Pcs";
      subUnit = "pcs";
      packSize = item.packSize && item.packSize > 1 ? item.packSize : 30;
      hasSubUnits = true;
    } else if (isPacket) {
      subCategory = item.subCategory || "Packet - Pcs";
      subUnit = item.subUnit && item.subUnit.toLowerCase().trim() !== u ? item.subUnit : "pcs";
      packSize = item.packSize && item.packSize > 1 ? item.packSize : 24;
      hasSubUnits = true;
    }
    if (subUnit && subUnit.toLowerCase().trim() === u) {
      hasSubUnits = false;
      packSize = 1;
      subUnit = void 0;
    }
    const normalizedItem = {
      ...item,
      unit: isCase || key === "egg" ? "case" : item.unit,
      subCategory: isPcs ? item.subCategory || "Pcs" : subCategory,
      hasSubUnits: isPcs ? false : hasSubUnits,
      packSize: isPcs ? 1 : packSize || 1,
      subUnit: isPcs ? void 0 : subUnit
    };
    if (!seenKeys.has(key)) {
      if (key === "egg") {
        const wasPcs = u === "pcs";
        const eggPackSize = item.packSize && item.packSize > 1 ? item.packSize : 30;
        const currentStock = wasPcs ? Math.round((item.currentStock || 0) / eggPackSize * 100) / 100 : item.currentStock || 10;
        const unitCost = wasPcs ? Math.round((item.unitCost || 12.5) * eggPackSize) : item.unitCost || 375;
        const minStockAlert = wasPcs ? Math.max(1, Math.round((item.minStockAlert || 80) / eggPackSize * 10) / 10) : item.minStockAlert || 3;
        seenKeys.set(key, {
          ...normalizedItem,
          unit: "case",
          subCategory: "Case - Pcs",
          packSize: eggPackSize,
          subUnit: "pcs",
          hasSubUnits: true,
          currentStock,
          unitCost,
          minStockAlert,
          notes: normalizedItem.notes || "Daily breakfast and snacks omelet supply (\u09E7 \u0995\u09C7\u09B8 = \u09E9\u09E6 \u09AA\u09BF\u09B8 \u09A1\u09BF\u09AE)"
        });
      } else if (key === "tea-bag") {
        seenKeys.set(key, {
          ...normalizedItem,
          subCategory: "Packet - Pcs",
          packSize: normalizedItem.packSize && normalizedItem.packSize > 1 ? normalizedItem.packSize : 100,
          subUnit: "pcs",
          hasSubUnits: true,
          notes: normalizedItem.notes || "\u09E7 \u09AA\u09CD\u09AF\u09BE\u0995\u09C7\u099F\u09C7 \u09E7\u09E6\u09E6 \u099F\u09BF \u099F\u09BF-\u09AC\u09CD\u09AF\u09BE\u0997 \u09A5\u09BE\u0995\u09C7 (1 packet = 100 pcs)"
        });
      } else if (key === "sandwich-bread") {
        seenKeys.set(key, {
          ...normalizedItem,
          subCategory: "Packet - Pcs",
          packSize: normalizedItem.packSize && normalizedItem.packSize > 1 ? normalizedItem.packSize : 12,
          subUnit: "slice",
          hasSubUnits: true
        });
      } else if (key === "cucumber") {
        seenKeys.set(key, {
          ...normalizedItem,
          category: "Vegetables",
          subCategory: "Kg - gm",
          unit: "kg",
          packSize: 1e3,
          subUnit: "gm",
          hasSubUnits: true
        });
      } else if (key === "black-salt") {
        seenKeys.set(key, {
          ...normalizedItem,
          category: "Oil & Spices",
          subCategory: "Kg - gm",
          unit: "kg",
          packSize: 1e3,
          subUnit: "gm",
          hasSubUnits: true
        });
      } else {
        seenKeys.set(key, normalizedItem);
      }
    } else {
      const existing = seenKeys.get(key);
      const currentIsStandard = item.id.startsWith("raw-") && !item.id.startsWith("raw-item-") && !item.id.includes(Date.now().toString().slice(0, 4));
      const existingIsStandard = existing.id.startsWith("raw-") && !existing.id.startsWith("raw-item-") && !existing.id.includes(Date.now().toString().slice(0, 4));
      const chooseName = (a, b) => {
        if (!a) return b;
        if (!b) return a;
        if (b === "Gas Cylinder" && a && a !== "Gas Cylinder") return a;
        if (a === "Gas Cylinder" && b && b !== "Gas Cylinder") return b;
        return a;
      };
      const preferredName = chooseName(item.name, existing.name);
      const preferredNameBn = chooseName(item.nameBn, existing.nameBn);
      const chosenCategory = item.category || existing.category || "Packaging & Disposables";
      const chosenSubCategory = normalizedItem.subCategory || existing.subCategory || (key === "gas-cylinder" ? "Gas Cylinder" : "");
      if (currentIsStandard && !existingIsStandard) {
        removedIds.push(existing.id);
        const mergedUnit = normalizedItem.unit || existing.unit || "kg";
        const mergedIsPcs = ["pcs", "pc", "piece", "\u099F\u09BF", "\u099F\u09BE"].includes(mergedUnit.toLowerCase().trim());
        seenKeys.set(key, {
          ...existing,
          ...normalizedItem,
          name: preferredName,
          nameBn: preferredNameBn,
          category: chosenCategory,
          subCategory: chosenSubCategory,
          currentStock: Math.max(existing.currentStock, normalizedItem.currentStock),
          packSize: mergedIsPcs ? 1 : normalizedItem.packSize || existing.packSize || 1,
          subUnit: mergedIsPcs ? void 0 : normalizedItem.subUnit || existing.subUnit,
          hasSubUnits: mergedIsPcs ? false : normalizedItem.hasSubUnits ?? existing.hasSubUnits
        });
      } else {
        removedIds.push(item.id);
        const mergedUnit = existing.unit || normalizedItem.unit || "kg";
        const mergedIsPcs = ["pcs", "pc", "piece", "\u099F\u09BF", "\u099F\u09BE"].includes(mergedUnit.toLowerCase().trim());
        seenKeys.set(key, {
          ...normalizedItem,
          ...existing,
          name: preferredName,
          nameBn: preferredNameBn,
          category: chosenCategory,
          subCategory: chosenSubCategory,
          currentStock: Math.max(existing.currentStock, normalizedItem.currentStock),
          packSize: mergedIsPcs ? 1 : existing.packSize || normalizedItem.packSize || 1,
          subUnit: mergedIsPcs ? void 0 : existing.subUnit || normalizedItem.subUnit,
          hasSubUnits: mergedIsPcs ? false : existing.hasSubUnits ?? normalizedItem.hasSubUnits
        });
      }
    }
  }
  const deduplicated = Array.from(seenKeys.values()).map((it) => {
    const itUnit = (it.unit || "").toLowerCase().trim();
    const itSub = (it.subUnit || "").toLowerCase().trim();
    const itIsPcs = itUnit === "pcs" || itUnit === "pc" || itUnit === "piece" || itUnit === "\u099F\u09BF" || itUnit === "\u099F\u09BE";
    const isSame = Boolean(itUnit && itSub && itUnit === itSub);
    if (it.id === "raw-7" || normalizeRawItemName(it.name) === "egg") {
      const wasPcs = (it.unit || "").toLowerCase().trim() === "pcs";
      const eggPackSize = it.packSize && it.packSize > 1 ? it.packSize : 30;
      return {
        ...it,
        unit: "case",
        subCategory: "Case - Pcs",
        packSize: eggPackSize,
        subUnit: "pcs",
        hasSubUnits: true,
        currentStock: wasPcs ? Math.round((it.currentStock || 0) / eggPackSize * 100) / 100 : it.currentStock,
        unitCost: wasPcs ? Math.round((it.unitCost || 12.5) * eggPackSize) : it.unitCost,
        minStockAlert: wasPcs ? Math.max(1, Math.round((it.minStockAlert || 80) / eggPackSize * 10) / 10) : it.minStockAlert,
        notes: it.notes || "Daily breakfast and snacks omelet supply (\u09E7 \u0995\u09C7\u09B8 = \u09E9\u09E6 \u09AA\u09BF\u09B8 \u09A1\u09BF\u09AE)"
      };
    }
    if (itIsPcs || isSame || it.packSize && it.packSize <= 1) {
      return {
        ...it,
        hasSubUnits: false,
        packSize: 1,
        subUnit: void 0
      };
    }
    return it;
  });
  return { deduplicated, removedIds };
};
var getRawInventoryItems = () => {
  try {
    const stored = localStorage.getItem(RAW_ITEMS_STORAGE_KEY);
    let itemsToProcess = INITIAL_RAW_ITEMS;
    let isInitialSeeding = true;
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        itemsToProcess = parsed;
        isInitialSeeding = false;
      }
    }
    const { deduplicated, removedIds } = deduplicateRawItems(itemsToProcess);
    let hasAdded = false;
    const currentKeys = new Set(deduplicated.map((it) => normalizeRawItemName(it.name)));
    for (const init of INITIAL_RAW_ITEMS) {
      const k = normalizeRawItemName(init.name);
      if (!currentKeys.has(k)) {
        deduplicated.push(init);
        currentKeys.add(k);
        hasAdded = true;
      }
    }
    const cleanJson = JSON.stringify(deduplicated);
    if (removedIds.length > 0 || hasAdded || cleanJson !== stored) {
      try {
        localStorage.setItem(RAW_ITEMS_STORAGE_KEY, cleanJson);
        if (removedIds.length > 0) {
          Promise.resolve(import_supabase.supabase.from("Canteen_Inventory").delete().in("id", removedIds)).catch((err) => console.warn("Cleaned duplicate raw items from DB:", err));
        }
      } catch {
      }
    }
    return deduplicated;
  } catch (e) {
    console.warn("Failed to load raw items from localStorage:", e);
  }
  return INITIAL_RAW_ITEMS;
};
var saveRawInventoryItems = (items) => {
  try {
    const { deduplicated } = deduplicateRawItems(items);
    localStorage.setItem(RAW_ITEMS_STORAGE_KEY, JSON.stringify(deduplicated));
    window.dispatchEvent(new Event("canteen_raw_inventory_updated"));
    window.dispatchEvent(new Event("storage"));
    if (deduplicated && deduplicated.length > 0) {
      const payload = deduplicated.map((it) => ({
        id: it.id,
        name: it.name,
        nameBn: it.nameBn || "",
        unit: it.unit || "kg",
        "Sub Unit": it.subUnit || (it.unit?.toLowerCase() === "kg" ? "gm" : it.unit?.toLowerCase() === "liter" ? "ml" : it.unit?.toLowerCase() === "case" || it.unit?.toLowerCase() === "packet" ? "pcs" : ""),
        subUnit: it.subUnit || (it.unit?.toLowerCase() === "kg" ? "gm" : it.unit?.toLowerCase() === "liter" ? "ml" : it.unit?.toLowerCase() === "case" || it.unit?.toLowerCase() === "packet" ? "pcs" : ""),
        sub_unit: it.subUnit || (it.unit?.toLowerCase() === "kg" ? "gm" : it.unit?.toLowerCase() === "liter" ? "ml" : it.unit?.toLowerCase() === "case" || it.unit?.toLowerCase() === "packet" ? "pcs" : ""),
        currentStock: it.currentStock ?? 0,
        minStockAlert: it.minStockAlert ?? 5,
        unitCost: it.unitCost ?? 0,
        wastagePercentage: it.wastagePercentage ?? 0,
        lastRestockedDate: it.lastRestockedDate || "",
        supplier: it.supplier || "",
        notes: encodeNotesWithMeta(it.notes, {
          category: it.category,
          subCategory: it.subCategory,
          hasSubUnits: it.hasSubUnits,
          packSize: it.packSize,
          subUnit: it.subUnit
        })
      }));
      Promise.resolve(import_supabase.supabase.from("Canteen_Inventory").upsert(payload, { onConflict: "id" })).catch((err) => console.warn("Supabase Canteen_Inventory upsert note from recipeManager:", err));
    }
  } catch (e) {
    console.warn("Failed to save raw items:", e);
  }
};
var getMenuRecipes = () => {
  try {
    let stored = localStorage.getItem(RECIPES_STORAGE_KEY);
    if (!stored) {
      stored = localStorage.getItem(LEGACY_RECIPES_STORAGE_KEY);
    }
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        let hasChanges = false;
        const merged = { ...parsed };
        for (const [key, defaultIngredients] of Object.entries(DEFAULT_MENU_RECIPES)) {
          if (!merged[key] || merged[key].length === 0) {
            merged[key] = defaultIngredients;
            hasChanges = true;
          } else {
            const existingIds = new Set(merged[key].map((ing) => ing.rawItemId));
            const existingNames = new Set(merged[key].map((ing) => (ing.rawItemName || "").toLowerCase().trim()));
            const missingItems = defaultIngredients.filter((defIng) => {
              const defName = (defIng.rawItemName || "").toLowerCase().trim();
              const hasById = existingIds.has(defIng.rawItemId);
              const hasByName = existingNames.has(defName);
              const isBlackSalt = defIng.rawItemId === "raw-44" || defName.includes("black") || defName.includes("\u09AC\u09BF\u099F");
              const isNormalSalt = !isBlackSalt && (defName.includes("salt") || defName.includes("\u09B2\u09AC\u09A3"));
              const hasBlackSalt = isBlackSalt && (existingIds.has("raw-44") || Array.from(existingNames).some((n) => n.includes("black") || n.includes("\u09AC\u09BF\u099F")));
              const hasNormalSalt = isNormalSalt && Array.from(existingNames).some((n) => (n.includes("salt") || n.includes("\u09B2\u09AC\u09A3")) && !n.includes("black") && !n.includes("\u09AC\u09BF\u099F"));
              const isGas = defName.includes("gas") || defName.includes("lpg") || defName.includes("cylinder") || defName.includes("\u0997\u09CD\u09AF\u09BE\u09B8");
              const hasGas = isGas && Array.from(existingNames).some((n) => n.includes("gas") || n.includes("lpg") || n.includes("cylinder"));
              if (isBlackSalt) return !hasBlackSalt;
              if (isNormalSalt) return !hasNormalSalt;
              if (isGas) return !hasGas;
              return !hasById && !hasByName;
            });
            if (missingItems.length > 0) {
              merged[key] = [...merged[key], ...missingItems];
              hasChanges = true;
            }
          }
        }
        for (const [recipeKey, ingredients] of Object.entries(merged)) {
          if (Array.isArray(ingredients)) {
            let rowChanged = false;
            const updated = ingredients.map((ing) => {
              const u = (ing.unit || "").toLowerCase().trim();
              if (u === "kg" && ing.quantity <= 1) {
                rowChanged = true;
                return {
                  ...ing,
                  quantity: Math.round(ing.quantity * 1e3 * 100) / 100,
                  unit: "gm"
                };
              }
              return ing;
            });
            if (rowChanged) {
              merged[recipeKey] = updated;
              hasChanges = true;
            }
          }
        }
        if (hasChanges) {
          try {
            localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(merged));
          } catch {
          }
        }
        return merged;
      }
    }
  } catch (e) {
    console.warn("Failed to load recipes from localStorage:", e);
  }
  try {
    localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(DEFAULT_MENU_RECIPES));
  } catch (e) {
    console.warn("Failed to save initial recipes:", e);
  }
  return DEFAULT_MENU_RECIPES;
};
var getRecipeForMenuItem = (menuItemId, menuItemName) => {
  const recipes = getMenuRecipes();
  let found = [];
  if (menuItemId && recipes[menuItemId]) {
    found = recipes[menuItemId];
  } else if (menuItemName) {
    const normalized = menuItemName.trim().toUpperCase();
    if (recipes[normalized]) {
      found = recipes[normalized];
    } else {
      for (const [key, ings] of Object.entries(recipes)) {
        const kUpper = key.toUpperCase();
        if (normalized.includes(kUpper) || kUpper.includes(normalized)) {
          found = ings;
          break;
        }
      }
      if (!found || found.length === 0) {
        const lower = menuItemName.toLowerCase();
        if ((lower.includes("\u099A\u099F\u09AA\u099F\u09BF") || lower.includes("chotpoti")) && recipes["CHOTPOTI"]) {
          found = recipes["CHOTPOTI"];
        } else if ((lower.includes("\u09B9\u09BE\u09B2\u09BF\u09AE") || lower.includes("halim")) && recipes["HALIM"]) {
          found = recipes["HALIM"];
        } else if ((lower.includes("\u09B2\u09C7\u09AC\u09C1") || lower.includes("lemon")) && recipes["LEMON JUICE"]) {
          found = recipes["LEMON JUICE"];
        } else if ((lower.includes("\u09B6\u09B8\u09BE") || lower.includes("sosa")) && recipes["SOSA"]) {
          found = recipes["SOSA"];
        } else if ((lower.includes("\u09B8\u09BE\u09B2\u09BE\u09A6") || lower.includes("salad")) && recipes["SALAD"]) {
          found = recipes["SALAD"];
        }
      }
    }
  }
  if (found.length === 0) return [];
  try {
    const rawItems = getRawInventoryItems();
    const rawMap = /* @__PURE__ */ new Map();
    rawItems.forEach((r) => {
      rawMap.set(r.id, r);
      rawMap.set(r.name.toLowerCase().trim(), r);
    });
    return found.map((ing) => {
      const raw = rawMap.get(ing.rawItemId) || (ing.rawItemName ? rawMap.get(ing.rawItemName.toLowerCase().trim()) : void 0);
      if (!raw) return ing;
      const subInfo = getRawItemSubUnitInfo(raw);
      if (subInfo.hasSubUnit && subInfo.subUnit) {
        const currentUnit = (ing.unit || "").toLowerCase().trim();
        const rawUnit = (raw.unit || "").toLowerCase().trim();
        const subUnitLower = subInfo.subUnit.toLowerCase().trim();
        if (currentUnit === rawUnit && currentUnit !== subUnitLower) {
          const ratio = subInfo.packSize || 1e3;
          return {
            ...ing,
            quantity: Math.round(ing.quantity * ratio * 100) / 100,
            unit: subInfo.subUnit
          };
        }
      }
      return ing;
    });
  } catch {
    return found;
  }
};
var ensureCookingIngredients = (ingredients, rawItems) => {
  if (!ingredients || ingredients.length === 0) return ingredients;
  const allRaw = rawItems && rawItems.length > 0 ? rawItems : getRawInventoryItems();
  const cookingIndicatorKeywords = [
    "chicken",
    "meat",
    "beef",
    "egg",
    "dim",
    "rice",
    "dal",
    "pasta",
    "khichuri",
    "biriyani",
    "curry",
    "porota",
    "oil",
    "onion",
    "chili",
    "vegetable",
    "alu",
    "potato"
  ];
  const hasCookedRaw = ingredients.some((ing) => {
    const rawName = (ing.rawItemName || "").toLowerCase();
    return cookingIndicatorKeywords.some((kw) => rawName.includes(kw));
  });
  if (!hasCookedRaw) {
    return ingredients;
  }
  const hasGas = ingredients.some((ing) => {
    const name = (ing.rawItemName || "").toLowerCase();
    return name.includes("gas") || name.includes("lpg") || name.includes("cylinder") || name.includes("\u0997\u09CD\u09AF\u09BE\u09B8");
  });
  const hasSalt = ingredients.some((ing) => {
    const name = (ing.rawItemName || "").toLowerCase();
    return name.includes("salt") || name.includes("\u09B2\u09AC\u09A3");
  });
  let updated = [...ingredients];
  if (!hasGas) {
    const gasRaw = allRaw.find((r) => {
      const lower = r.name.toLowerCase();
      return lower.includes("lpg") || lower.includes("gas") || lower.includes("cylinder") || r.nameBn && r.nameBn.includes("\u0997\u09CD\u09AF\u09BE\u09B8");
    }) || {
      id: "raw-16",
      name: "LPG",
      unit: "cylinder",
      unitCost: 1450
    };
    updated.push({
      rawItemId: gasRaw.id,
      rawItemName: gasRaw.name,
      quantity: 3e-3,
      unit: gasRaw.unit
    });
  }
  if (!hasSalt) {
    const saltRaw = allRaw.find((r) => {
      const lower = r.name.toLowerCase();
      const lowerBn = (r.nameBn || "").toLowerCase();
      const isBlack = lower.includes("black") || lowerBn.includes("\u09AC\u09BF\u099F");
      return !isBlack && (lower.includes("salt") || lowerBn.includes("\u09B2\u09AC\u09A3"));
    }) || {
      id: "raw-27",
      name: "Salt",
      unit: "kg",
      unitCost: 42
    };
    updated.push({
      rawItemId: saltRaw.id,
      rawItemName: saltRaw.name,
      quantity: 2,
      unit: "gm"
    });
  }
  return updated;
};
var saveRecipeForMenuItem = (menuItemId, ingredients, menuItemName) => {
  try {
    const recipes = { ...getMenuRecipes() };
    const validatedIngredients = ensureCookingIngredients(ingredients);
    if (menuItemId) {
      recipes[menuItemId] = validatedIngredients;
    }
    if (menuItemName) {
      recipes[menuItemName.trim().toUpperCase()] = validatedIngredients;
    }
    localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(recipes));
    window.dispatchEvent(new Event("canteen_menu_recipes_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (e) {
    console.warn("Failed to save menu recipe:", e);
  }
};
var deductRawStockForSales = (soldItems) => {
  const rawItems = getRawInventoryItems();
  const rawItemsMap = /* @__PURE__ */ new Map();
  rawItems.forEach((item) => {
    rawItemsMap.set(item.id, { ...item });
    rawItemsMap.set(item.name.toLowerCase().trim(), item);
  });
  const deductionsMap = /* @__PURE__ */ new Map();
  const warnings = [];
  for (const sold of soldItems) {
    const soldQty = Number(sold.qty ?? sold.quantity ?? 0);
    if (soldQty <= 0) continue;
    const itemName = sold.menuItemName || sold.name || "";
    const recipe = getRecipeForMenuItem(sold.menuItemId || "", itemName);
    if (!recipe || recipe.length === 0) {
      continue;
    }
    for (const ing of recipe) {
      let rawItem = rawItemsMap.get(ing.rawItemId);
      if (!rawItem && ing.rawItemName) {
        rawItem = rawItems.find((r) => r.name.toLowerCase() === ing.rawItemName.toLowerCase());
      }
      if (rawItem) {
        const ratio = getIngredientToInventoryRatio(rawItem, ing.unit);
        const amount = ing.quantity / ratio * soldQty;
        const current = deductionsMap.get(rawItem.id);
        if (current) {
          current.totalUsed += amount;
        } else {
          deductionsMap.set(rawItem.id, { item: rawItem, totalUsed: amount });
        }
      }
    }
  }
  if (deductionsMap.size === 0) {
    return { success: true, deducted: [], warnings: [] };
  }
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const newLogs = [];
  const deductedSummary = [];
  const updatedItems = rawItems.map((item) => {
    const entry = deductionsMap.get(item.id);
    if (!entry) return item;
    const used = Math.round(entry.totalUsed * 1e4) / 1e4;
    const prevStock = item.currentStock;
    const newStock = Math.max(0, Math.round((prevStock - used) * 1e4) / 1e4);
    if (newStock < item.minStockAlert) {
      warnings.push(`Low raw stock alert: ${item.name} (${item.nameBn}) - ${newStock} ${item.unit} remaining`);
    }
    deductedSummary.push({
      rawItemId: item.id,
      rawItemName: item.name,
      qtyDeducted: used,
      unit: item.unit,
      previousStock: prevStock,
      remainingStock: newStock
    });
    newLogs.push({
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      itemId: item.id,
      itemName: item.name,
      type: "ISSUE",
      quantity: used,
      unit: item.unit,
      previousStock: prevStock,
      newStock,
      cost: Math.round(used * item.unitCost),
      date: today,
      notes: `[AUTO ISSUE - MENU SALE] ${soldItems.map((s) => `${s.menuItemName} x${s.qty}`).join(", ")}`,
      recordedBy: "POS Sale (Auto)"
    });
    return {
      ...item,
      currentStock: newStock
    };
  });
  saveRawInventoryItems(updatedItems);
  try {
    let existingLogs = [];
    const storedLogs = localStorage.getItem(RAW_LOGS_STORAGE_KEY);
    if (storedLogs) {
      existingLogs = JSON.parse(storedLogs);
    }
    const mergedLogs = [...newLogs, ...existingLogs].slice(0, 500);
    localStorage.setItem(RAW_LOGS_STORAGE_KEY, JSON.stringify(mergedLogs));
    window.dispatchEvent(new Event("canteen_raw_inventory_updated"));
    window.dispatchEvent(new Event("canteen_raw_stock_logs_updated"));
    window.dispatchEvent(new Event("canteen_state_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (e) {
    console.warn("Failed to append raw stock logs:", e);
  }
  return {
    success: true,
    deducted: deductedSummary,
    warnings
  };
};
var autoRestockFromExpense = (input) => {
  const rawItems = getRawInventoryItems();
  let matchedItem;
  if (input.rawItemId) {
    matchedItem = rawItems.find((r) => r.id === input.rawItemId);
  }
  if (!matchedItem) {
    const textToMatch = `${input.desc} ${input.subdesc || ""}`.toLowerCase();
    const synonymMap = {
      "raw-1": ["chicken", "chiken", "murgi", "murigi", "\u09AE\u09BE\u0982\u09B8", "\u09AE\u09C1\u09B0\u0997\u09BF", "\u09AE\u09C1\u09B0\u0997\u09C0\u09B0", "\u09AE\u09C1\u09B0\u0997\u09BF\u09B0", "\u09AC\u09CD\u09B0\u09AF\u09BC\u09B2\u09BE\u09B0"],
      "raw-2": ["rice", "chal", "chaal", "\u099A\u09BE\u09B2", "\u09AE\u09BF\u09A8\u09BF\u0995\u09C7\u099F", "\u09AD\u09BE\u09A4"],
      "raw-3": ["dal", "daal", "\u09A1\u09BE\u09B2", "\u09AE\u09B8\u09C1\u09B0"],
      "raw-4": ["milk", "powder", "doodh", "dano", "diploma", "\u09A6\u09C1\u09A7", "\u0997\u09C1\u0981\u09A1\u09BC\u09BE \u09A6\u09C1\u09A7"],
      "raw-5": ["tea", "tea bag", "cha", "isapahani", "taaza", "\u099A\u09BE \u09AA\u09BE\u09A4\u09BE", "\u099F\u09BF \u09AC\u09CD\u09AF\u09BE\u0997", "\u099A\u09BE"],
      "raw-6": ["noodles", "maggi", "nuduls", "\u09A8\u09C1\u09A1\u09B2\u09B8", "\u09AE\u09CD\u09AF\u09BE\u0997\u09BF"],
      "raw-7": ["egg", "eggs", "dim", "deem", "\u09A1\u09BF\u09AE", "\u0986\u09A8\u09CD\u09A1\u09BE"],
      "raw-8": ["biscuit", "biscuits", "cookies", "cake", "\u09AC\u09BF\u09B8\u09CD\u0995\u09C1\u099F", "\u099F\u09CB\u09B8\u09CD\u099F"],
      "raw-9": ["box", "one time", "cup", "disposable", "\u0993\u09AF\u09BC\u09BE\u09A8 \u099F\u09BE\u0987\u09AE", "\u09AC\u0995\u09CD\u09B8", "\u0993\u09AF\u09BC\u09BE\u09A8\u099F\u09BE\u0987\u09AE"],
      "raw-10": ["pasta", "macaroni", "\u09AA\u09BE\u09B8\u09CD\u09A4\u09BE"],
      "raw-11": ["porota", "paratha", "parota", "\u09AA\u09B0\u09CB\u099F\u09BE", "\u09AB\u09CD\u09B0\u09CB\u099C\u09C7\u09A8 \u09AA\u09B0\u09CB\u099F\u09BE"],
      "raw-12": ["oil", "soyabean", "soyabin", "tel", "\u09A4\u09C7\u09B2", "\u09B0\u09C2\u09AA\u099A\u09BE\u0981\u09A6\u09BE", "\u09B8\u09AF\u09BC\u09BE\u09AC\u09BF\u09A8"],
      "raw-13": ["sugar", "chini", "cheeni", "\u099A\u09BF\u09A8\u09BF"],
      "raw-14": ["onion", "peyaj", "peaj", "\u09AA\u09C7\u0981\u09DF\u09BE\u099C", "\u09AA\u09C7\u09AF\u09BC\u09BE\u099C"],
      "raw-15": ["halim", "halim mix", "haleem", "\u09B9\u09BE\u09B2\u09BF\u09AE \u09AE\u09BF\u0995\u09CD\u09B8", "\u09B9\u09BE\u09B2\u09BF\u09AE"],
      "raw-16": ["gas", "cylinder", "lpg", "\u0997\u09CD\u09AF\u09BE\u09B8", "\u09B8\u09BF\u09B2\u09BF\u09A8\u09CD\u09A1\u09BE\u09B0"],
      "raw-17": ["sos", "sauce", "tomato", "tometo", "\u09B8\u09B8", "\u099F\u09AE\u09C7\u099F\u09CB \u09B8\u09B8"],
      "raw-18": ["maggi mosla", "masala", "mosla", "\u09AE\u09CD\u09AF\u09BE\u0997\u09BF \u09AE\u09B8\u09B2\u09BE", "\u099F\u09C7\u09B8\u09CD\u099F\u09AE\u09C7\u0995\u09BE\u09B0"],
      "raw-19": ["green chili", "chili", "morich", "\u0995\u09BE\u0981\u099A\u09BE \u09AE\u09B0\u09BF\u099A", "\u09AE\u09B0\u09BF\u099A"],
      "raw-20": ["coffee", "nescafe", "\u0995\u09AB\u09BF", "\u0995\u09AB\u09BF \u09AA\u09BE\u0989\u09A1\u09BE\u09B0"],
      "raw-21": ["dry cake", "cake", "\u09A1\u09CD\u09B0\u09BE\u0987 \u0995\u09C7\u0995"],
      "raw-22": ["swarma", "shawarma", "pita", "\u09B6\u09BE\u09B0\u09CD\u09AE\u09BE", "\u09B6\u09BE\u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09AE\u09BE", "\u09B6\u09BE\u09B0\u09CD\u09AE\u09BE \u09AC\u09CD\u09B0\u09C7\u09A1"],
      "raw-23": ["butter ban", "ban", "bun", "\u09AC\u09BE\u099F\u09BE\u09B0 \u09AC\u09A8", "\u09AC\u09A8\u09B0\u09C1\u099F\u09BF"],
      "raw-24": ["sandwitch", "sandwich", "bread", "\u09B8\u09CD\u09AF\u09BE\u09A8\u09CD\u09A1\u0989\u0987\u099A", "\u09B8\u09CD\u09AF\u09BE\u09A8\u09CD\u09A1\u0989\u0987\u099A \u09AC\u09CD\u09B0\u09C7\u09A1"],
      "raw-25": ["burger", "burger bun", "\u09AC\u09BE\u09B0\u09CD\u0997\u09BE\u09B0", "\u09AC\u09BE\u09B0\u09CD\u0997\u09BE\u09B0 \u09AC\u09BE\u09A8"],
      "raw-26": ["hotel porota", "porota", "paratha", "\u09B9\u09CB\u099F\u09C7\u09B2 \u09AA\u09B0\u09CB\u099F\u09BE"],
      "raw-44": ["black salt", "bit lobon", "bit laban", "beet salt", "\u09AC\u09BF\u099F \u09B2\u09AC\u09A3", "\u09AC\u09BF\u099F \u09B2\u09AC\u09A8"],
      "raw-27": ["salt", "lobon", "\u09B2\u09AC\u09A3", "\u09A8\u09C1\u09A8"],
      "raw-28": ["lemon", "lebu", "\u09B2\u09C7\u09AC\u09C1", "\u0995\u09BE\u0997\u099C\u09BF \u09B2\u09C7\u09AC\u09C1"],
      "raw-29": ["garlic", "roshun", "rosun", "\u09B0\u09B8\u09C1\u09A8", "\u09B0\u09B8\u09C1\u09A8\u09C7\u09B0", "\u0995\u09CB\u09DF\u09BE \u09B0\u09B8\u09C1\u09A8"],
      "raw-30": ["ginger", "ada", "\u0986\u09A6\u09BE", "\u0986\u09A6\u09BE\u09B0", "\u0986\u09A6\u09BE \u09AC\u09BE\u099F\u09BE"],
      "raw-31": ["turmeric", "holud", "\u09B9\u09B2\u09C1\u09A6", "\u09B9\u09B2\u09C1\u09A6 \u0997\u09C1\u0981\u09DC\u09BE", "\u09B9\u09B2\u09C1\u09A6\u09C7\u09B0", "\u09B9\u09B2\u09C1\u09A6 \u0997\u09C1\u09DC\u09BE"],
      "raw-32": ["chili powder", "morich gura", "morich powder", "\u09AE\u09B0\u09BF\u099A \u0997\u09C1\u0981\u09DC\u09BE", "\u09AE\u09B0\u09BF\u099A\u09C7\u09B0 \u0997\u09C1\u0981\u09DC\u09BE", "\u09AE\u09B0\u09BF\u099A\u09C7\u09B0 \u0997\u09C1\u09DC\u09BE", "\u09B2\u09BE\u09B2 \u09AE\u09B0\u09BF\u099A"],
      "raw-33": ["coriander", "dhone", "dhonia", "\u09A7\u09A8\u09C7 \u0997\u09C1\u0981\u09DC\u09BE", "\u09A7\u09A8\u09BF\u09DF\u09BE \u0997\u09C1\u0981\u09DC\u09BE", "\u09A7\u09A8\u09C7 \u0997\u09C1\u09DC\u09BE", "\u09A7\u09A8\u09C7"],
      "raw-34": ["cumin", "jeera", "jira", "\u099C\u09BF\u09B0\u09BE", "\u099C\u09BF\u09B0\u09BE \u0997\u09C1\u0981\u09DC\u09BE", "\u099C\u09BF\u09B0\u09BE \u0997\u09C1\u09DC\u09BE", "\u0997\u09CB\u099F\u09BE \u099C\u09BF\u09B0\u09BE"],
      "raw-35": ["garam masala", "grom mosla", "\u0997\u09B0\u09AE \u09AE\u09B8\u09B2\u09BE", "\u0997\u09B0\u09AE \u09AE\u09B6\u09B2\u09BE", "\u0997\u09B0\u09AE \u09AE\u09B8\u09B2\u09BE \u0997\u09C1\u0981\u09DC\u09BE"],
      "raw-36": ["cardamom", "elachi", "elach", "\u098F\u09B2\u09BE\u099A", "\u098F\u09B2\u09BE\u099A\u09BF", "\u09B8\u09AC\u09C1\u099C \u098F\u09B2\u09BE\u099A"],
      "raw-37": ["cinnamon", "daruchini", "\u09A6\u09BE\u09B0\u09C1\u099A\u09BF\u09A8\u09BF"],
      "raw-38": ["clove", "cloves", "lobongo", "\u09B2\u09AC\u0999\u09CD\u0997"],
      "raw-39": ["bay leaf", "bay leaves", "tej pata", "tejpata", "\u09A4\u09C7\u099C\u09AA\u09BE\u09A4\u09BE"],
      "raw-40": ["black pepper", "gol morich", "golmorich", "\u0997\u09CB\u09B2\u09AE\u09B0\u09BF\u099A"],
      "raw-41": ["panch phoron", "panchforon", "\u09AA\u09BE\u0981\u099A\u09AB\u09CB\u09DC\u09A8", "\u09AA\u09BE\u0981\u099A\u09AB\u09CB\u09A1\u09BC\u09A8"],
      "raw-42": ["mustard oil", "shorisha tel", "shorishar tel", "\u09B8\u09B0\u09BF\u09B7\u09BE\u09B0 \u09A4\u09C7\u09B2"],
      "raw-43": ["cucumber", "shosa", "sosa", "khira", "\u09B6\u09B8\u09BE", "\u09B8\u09BE\u09B2\u09BE\u09A6"]
    };
    const sortedRawItems = [...rawItems].sort((a, b) => {
      const lenA = (a.nameBn?.length || 0) + a.name.length;
      const lenB = (b.nameBn?.length || 0) + b.name.length;
      return lenB - lenA;
    });
    for (const item of sortedRawItems) {
      if (textToMatch.includes(item.name.toLowerCase()) || item.nameBn && textToMatch.includes(item.nameBn.toLowerCase())) {
        matchedItem = item;
        break;
      }
    }
    if (!matchedItem) {
      for (const [id, words] of Object.entries(synonymMap)) {
        if (words.some((w) => textToMatch.includes(w))) {
          matchedItem = rawItems.find((r) => r.id === id);
          if (matchedItem) break;
        }
      }
    }
  }
  if (!matchedItem) {
    return { success: false, message: "No matching raw item found for this expenditure" };
  }
  let qtyToAdd = Number(input.rawItemQty);
  if (!qtyToAdd || isNaN(qtyToAdd) || qtyToAdd <= 0) {
    const matchCase = input.desc.match(/(\d+(?:\.\d+)?)\s*(?:case|crate|কেস|খাঁচি|ট্রে)/i);
    const matchKg = input.desc.match(/(\d+(?:\.\d+)?)\s*(?:kg|কেজি)/i);
    const matchPcs = input.desc.match(/(\d+(?:\.\d+)?)\s*(?:pcs|pc|টি|টা)/i);
    const matchLtr = input.desc.match(/(\d+(?:\.\d+)?)\s*(?:liter|litre|ltr|লিটার)/i);
    const matchPkt = input.desc.match(/(\d+(?:\.\d+)?)\s*(?:packet|pkt|প্যাকেট)/i);
    if (matchCase) {
      qtyToAdd = parseFloat(matchCase[1]);
    } else if (matchKg) qtyToAdd = parseFloat(matchKg[1]);
    else if (matchPcs) {
      const parsedPcs = parseFloat(matchPcs[1]);
      const isCaseItem = (matchedItem.unit || "").toLowerCase().trim() === "case";
      if (isCaseItem && matchedItem.packSize && matchedItem.packSize > 1) {
        qtyToAdd = Math.round(parsedPcs / matchedItem.packSize * 100) / 100;
      } else {
        qtyToAdd = parsedPcs;
      }
    } else if (matchLtr) qtyToAdd = parseFloat(matchLtr[1]);
    else if (matchPkt) qtyToAdd = parseFloat(matchPkt[1]);
    else if (input.amount > 0 && matchedItem.unitCost > 0) {
      qtyToAdd = Math.round(input.amount / matchedItem.unitCost * 10) / 10;
    } else {
      qtyToAdd = 1;
    }
  }
  qtyToAdd = Math.round(qtyToAdd * 100) / 100;
  if (qtyToAdd <= 0) qtyToAdd = 1;
  const wastagePct = Number(matchedItem.wastagePercentage) || 0;
  let netQtyToAdd = qtyToAdd;
  let wastageQty = 0;
  if (wastagePct > 0 && wastagePct < 100) {
    wastageQty = Math.round(qtyToAdd * (wastagePct / 100) * 1e3) / 1e3;
    netQtyToAdd = Math.round((qtyToAdd - wastageQty) * 1e3) / 1e3;
  }
  const prevStock = matchedItem.currentStock;
  const newStock = Math.round((prevStock + netQtyToAdd) * 100) / 100;
  const today = input.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const updatedItems = rawItems.map((item) => {
    if (item.id === matchedItem.id) {
      const calculatedUnitCost = input.amount > 0 && netQtyToAdd > 0 ? Math.round(input.amount / netQtyToAdd) : item.unitCost;
      return {
        ...item,
        currentStock: newStock,
        unitCost: calculatedUnitCost > 0 ? calculatedUnitCost : item.unitCost,
        lastRestockedDate: today
      };
    }
    return item;
  });
  saveRawInventoryItems(updatedItems);
  const newLogs = [];
  newLogs.push({
    id: `log-exp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    itemId: matchedItem.id,
    itemName: `${matchedItem.name} (${matchedItem.nameBn})`,
    type: "RESTOCK",
    quantity: netQtyToAdd,
    unit: matchedItem.unit,
    previousStock: prevStock,
    newStock,
    cost: input.amount,
    date: today,
    notes: wastagePct > 0 ? `[AUTO RESTOCK] Purchased: ${qtyToAdd} ${matchedItem.unit} (Wastage ${wastagePct}% deducted: -${wastageQty} ${matchedItem.unit}, Net: +${netQtyToAdd} ${matchedItem.unit})` : `[AUTO RESTOCK - EXPENDITURE] ${input.desc} (\u09F3${input.amount})`,
    recordedBy: "Expenditure (Auto)"
  });
  if (wastageQty > 0) {
    newLogs.push({
      id: `log-waste-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      itemId: matchedItem.id,
      itemName: `${matchedItem.name} (${matchedItem.nameBn})`,
      type: "WASTAGE",
      quantity: wastageQty,
      unit: matchedItem.unit,
      previousStock: Math.round((prevStock + qtyToAdd) * 100) / 100,
      newStock,
      cost: input.amount > 0 ? Math.round(input.amount * (wastagePct / 100) * 10) / 10 : 0,
      date: today,
      notes: `[AUTO WASTAGE] ${wastagePct}% processing loss from ${qtyToAdd} ${matchedItem.unit} purchased (${input.desc})`,
      recordedBy: "Auto Wastage Calculation"
    });
  }
  try {
    let existingLogs = [];
    const storedLogs = localStorage.getItem(RAW_LOGS_STORAGE_KEY);
    if (storedLogs) {
      existingLogs = JSON.parse(storedLogs);
    }
    const mergedLogs = [...newLogs, ...existingLogs].slice(0, 500);
    localStorage.setItem(RAW_LOGS_STORAGE_KEY, JSON.stringify(mergedLogs));
    window.dispatchEvent(new Event("canteen_raw_inventory_updated"));
    window.dispatchEvent(new Event("canteen_raw_stock_logs_updated"));
    window.dispatchEvent(new Event("canteen_state_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (e) {
    console.warn("Failed to append raw restock log:", e);
  }
  return {
    success: true,
    restockedItem: matchedItem,
    quantity: netQtyToAdd,
    message: wastagePct > 0 ? `${matchedItem.name}: ${qtyToAdd} ${matchedItem.unit} purchased (${wastagePct}% wastage: -${wastageQty} ${matchedItem.unit}, net +${netQtyToAdd} ${matchedItem.unit} added to stock)` : `${matchedItem.name} (+${netQtyToAdd} ${matchedItem.unit}) auto restocked from expenditure!`
  };
};
var restoreRawStockForSaleCancellation = (soldItems, txInfo) => {
  const rawItems = getRawInventoryItems();
  const rawItemsMap = /* @__PURE__ */ new Map();
  rawItems.forEach((item) => {
    rawItemsMap.set(item.id, { ...item });
    rawItemsMap.set(item.name.toLowerCase().trim(), item);
  });
  const restorationsMap = /* @__PURE__ */ new Map();
  for (const sold of soldItems) {
    const soldQty = Number(sold.qty ?? sold.quantity ?? 0);
    if (soldQty <= 0) continue;
    const itemName = sold.menuItemName || sold.name || "";
    const recipe = getRecipeForMenuItem(sold.menuItemId || "", itemName);
    if (!recipe || recipe.length === 0) {
      continue;
    }
    for (const ing of recipe) {
      let rawItem = rawItemsMap.get(ing.rawItemId);
      if (!rawItem && ing.rawItemName) {
        rawItem = rawItems.find((r) => r.name.toLowerCase() === ing.rawItemName.toLowerCase());
      }
      if (rawItem) {
        const ratio = getIngredientToInventoryRatio(rawItem, ing.unit);
        const amount = ing.quantity / ratio * soldQty;
        const current = restorationsMap.get(rawItem.id);
        if (current) {
          current.totalToRestore += amount;
        } else {
          restorationsMap.set(rawItem.id, { item: rawItem, totalToRestore: amount });
        }
      }
    }
  }
  if (restorationsMap.size === 0) {
    return { success: true, restored: [] };
  }
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const newLogs = [];
  const restoredSummary = [];
  const updatedItems = rawItems.map((item) => {
    const entry = restorationsMap.get(item.id);
    if (!entry) return item;
    const restoreQty = Math.round(entry.totalToRestore * 1e4) / 1e4;
    const prevStock = item.currentStock;
    const newStock = Math.round((prevStock + restoreQty) * 1e4) / 1e4;
    restoredSummary.push({
      rawItemId: item.id,
      rawItemName: item.name,
      qtyRestored: restoreQty,
      unit: item.unit,
      previousStock: prevStock,
      newStock
    });
    const memberDesc = txInfo?.memberName ? ` [${txInfo.memberName}]` : "";
    newLogs.push({
      id: `log-restore-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      itemId: item.id,
      itemName: item.name,
      type: "RESTOCK",
      quantity: restoreQty,
      unit: item.unit,
      previousStock: prevStock,
      newStock,
      cost: Math.round(restoreQty * item.unitCost),
      date: today,
      notes: `[RESTOCK - SALE CANCELLED] POS Sale cancelled${memberDesc}. Returned: ${soldItems.map((s) => `${s.menuItemName} x${s.qty}`).join(", ")}`,
      recordedBy: "POS Sale Cancellation"
    });
    return {
      ...item,
      currentStock: newStock
    };
  });
  saveRawInventoryItems(updatedItems);
  try {
    let existingLogs = [];
    const storedLogs = localStorage.getItem(RAW_LOGS_STORAGE_KEY);
    if (storedLogs) {
      existingLogs = JSON.parse(storedLogs);
    }
    const mergedLogs = [...newLogs, ...existingLogs].slice(0, 500);
    localStorage.setItem(RAW_LOGS_STORAGE_KEY, JSON.stringify(mergedLogs));
    window.dispatchEvent(new Event("canteen_raw_inventory_updated"));
    window.dispatchEvent(new Event("canteen_raw_stock_logs_updated"));
    window.dispatchEvent(new Event("canteen_state_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (e) {
    console.warn("Failed to append raw stock restoration logs:", e);
  }
  return {
    success: true,
    restored: restoredSummary
  };
};
var getEffectiveRawUnitCost = (item) => {
  const baseCost = Number(item.unitCost) || 0;
  const wastage = Number(item.wastagePercentage) || 0;
  if (wastage > 0 && wastage < 100) {
    return Math.round(baseCost / (1 - wastage / 100) * 100) / 100;
  }
  return baseCost;
};
var calculateMenuItemCost = (ingredients, customRawItems) => {
  const rawItems = customRawItems && customRawItems.length > 0 ? customRawItems : getRawInventoryItems();
  const rawMap = /* @__PURE__ */ new Map();
  rawItems.forEach((r) => {
    rawMap.set(r.id, r);
    rawMap.set(r.name.toLowerCase().trim(), r);
  });
  const breakdown = [];
  let totalCost = 0;
  for (const ing of ingredients) {
    const raw = rawMap.get(ing.rawItemId) || rawMap.get(ing.rawItemName.toLowerCase().trim());
    const baseCost = raw ? Number(raw.unitCost) || 0 : 0;
    const wastage = raw ? Number(raw.wastagePercentage) || 0 : 0;
    const effectiveCost = raw ? getEffectiveRawUnitCost(raw) : baseCost;
    const qty = Number(ing.quantity) || 0;
    let effectiveUnitPrice = effectiveCost;
    let lineCost = 0;
    if (raw) {
      const ratio = getIngredientToInventoryRatio(raw, ing.unit);
      effectiveUnitPrice = effectiveCost / ratio;
    }
    lineCost = Math.round(qty * effectiveUnitPrice * 100) / 100;
    totalCost += lineCost;
    breakdown.push({
      rawItemId: ing.rawItemId,
      rawItemName: ing.rawItemName || (raw ? raw.name : "Unknown Raw Item"),
      quantity: qty,
      unit: ing.unit || (raw ? raw.unit : "pcs"),
      unitCost: baseCost,
      effectiveUnitCost: Math.round(effectiveUnitPrice * 100) / 100,
      wastagePercentage: wastage,
      lineCost
    });
  }
  return {
    totalCost: Math.round(totalCost * 10) / 10,
    breakdown
  };
};
var formatRecipeRawItemsString = (recipe, rawItemsList) => {
  if (!recipe || recipe.length === 0) return "";
  return recipe.map((ing) => {
    const raw = rawItemsList.find((r) => r.id === ing.rawItemId) || rawItemsList.find((r) => (r.name || "").toLowerCase() === (ing.rawItemName || "").toLowerCase());
    let name = "";
    if (raw) {
      if (raw.nameBn && raw.nameBn.trim()) {
        const cleanBn = raw.nameBn.replace(/\s*\([a-zA-Z\s\/\-_0-9]+\)\s*$/, "").trim();
        name = cleanBn || raw.nameBn.trim();
      } else {
        name = raw.name || ing.rawItemName || "";
      }
    } else {
      name = ing.rawItemName || "";
    }
    const qty = ing.quantity !== "" && ing.quantity !== void 0 && !isNaN(Number(ing.quantity)) ? Number(ing.quantity) : ing.quantity ?? 0;
    const unit = ing.unit || (raw ? raw.unit : "") || "";
    if (!name) return "";
    return `${name} (${qty} ${unit})`.trim();
  }).filter(Boolean).join(", ");
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  INITIAL_RAW_ITEMS,
  LEGACY_RECIPES_STORAGE_KEY,
  RAW_ITEMS_STORAGE_KEY,
  RAW_LOGS_STORAGE_KEY,
  RECIPES_STORAGE_KEY,
  autoRestockFromExpense,
  calculateMenuItemCost,
  deductRawStockForSales,
  deduplicateRawItems,
  ensureCookingIngredients,
  formatRecipeRawItemsString,
  getEffectiveRawUnitCost,
  getIngredientToInventoryRatio,
  getMenuRecipes,
  getRawInventoryItems,
  getRawItemSubUnitInfo,
  getRecipeForMenuItem,
  normalizeRawItemName,
  restoreRawStockForSaleCancellation,
  saveRawInventoryItems,
  saveRecipeForMenuItem
});
