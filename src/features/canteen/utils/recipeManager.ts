export interface RawInventoryItem {
  id: string;
  name: string;
  nameBn: string;
  category: string;
  unit: string;
  currentStock: number;
  minStockAlert: number;
  unitCost: number;
  lastRestockedDate: string;
  supplier?: string;
  notes?: string;
}

export interface RawStockLog {
  id: string;
  itemId: string;
  itemName: string;
  type: 'RESTOCK' | 'ISSUE' | 'WASTAGE';
  quantity: number;
  unit: string;
  previousStock: number;
  newStock: number;
  cost?: number;
  date: string;
  notes?: string;
  recordedBy?: string;
}

export interface RecipeIngredient {
  rawItemId: string;
  rawItemName: string;
  quantity: number;
  unit: string;
}

export type MenuRecipeMap = Record<string, RecipeIngredient[]>;

export const RAW_ITEMS_STORAGE_KEY = 'canteen_raw_inventory_items_v2';
export const RAW_LOGS_STORAGE_KEY = 'canteen_raw_stock_logs_v2';
export const RECIPES_STORAGE_KEY = 'canteen_menu_recipes_v2';

export const INITIAL_RAW_ITEMS: RawInventoryItem[] = [
  {
    id: 'raw-1',
    name: 'Chicken',
    nameBn: 'ব্রয়লার মুরগির মাংস',
    category: 'Meat & Poultry',
    unit: 'kg',
    currentStock: 35,
    minStockAlert: 12,
    unitCost: 230,
    lastRestockedDate: '2026-09-18',
    supplier: 'Local Poultry Market',
    notes: 'Fresh broiler chicken for daily dishes'
  },
  {
    id: 'raw-2',
    name: 'Rice',
    nameBn: 'মিনিকেট চাল',
    category: 'Grains & Pulses',
    unit: 'kg',
    currentStock: 140,
    minStockAlert: 40,
    unitCost: 75,
    lastRestockedDate: '2026-09-15',
    supplier: 'Base Ration Depot',
    notes: 'Premium Miniket rice 50kg sacks'
  },
  {
    id: 'raw-3',
    name: 'Dal',
    nameBn: 'মসুর ডাল',
    category: 'Grains & Pulses',
    unit: 'kg',
    currentStock: 42,
    minStockAlert: 15,
    unitCost: 135,
    lastRestockedDate: '2026-09-16',
    supplier: 'Base Ration Depot',
    notes: 'Red split lentils'
  },
  {
    id: 'raw-4',
    name: 'Milk Powder',
    nameBn: 'গুঁড়া দুধ (Dano/Diploma)',
    category: 'Dairy & Beverages',
    unit: 'kg',
    currentStock: 18,
    minStockAlert: 6,
    unitCost: 880,
    lastRestockedDate: '2026-09-17',
    supplier: 'City Super Store',
    notes: 'For canteen milk tea and coffee preparation'
  },
  {
    id: 'raw-5',
    name: 'Tea Bag',
    nameBn: 'টি ব্যাগ / চা পাতা',
    category: 'Dairy & Beverages',
    unit: 'packet',
    currentStock: 48,
    minStockAlert: 15,
    unitCost: 165,
    lastRestockedDate: '2026-09-19',
    supplier: 'Ispahani / Taaza Distributor',
    notes: '100 pcs per box'
  },
  {
    id: 'raw-6',
    name: 'Noodles',
    nameBn: 'কাঁচা নুডলস (Raw Maggi/Egg)',
    category: 'Dry Food & Snacks',
    unit: 'packet',
    currentStock: 75,
    minStockAlert: 25,
    unitCost: 45,
    lastRestockedDate: '2026-09-20',
    supplier: 'Wholesale Store',
    notes: 'Standard family pack noodles'
  },
  {
    id: 'raw-7',
    name: 'Egg',
    nameBn: 'মুরগির ডিম (লাল ডিম)',
    category: 'Meat & Poultry',
    unit: 'pcs',
    currentStock: 280,
    minStockAlert: 80,
    unitCost: 12.5,
    lastRestockedDate: '2026-09-20',
    supplier: 'Poultry Farm Direct',
    notes: 'Daily breakfast and snacks omelet supply'
  },
  {
    id: 'raw-8',
    name: 'Biscuit',
    nameBn: 'বিস্কুট প্যাকেট (টোস্ট / ড্রাই কেক)',
    category: 'Dry Food & Snacks',
    unit: 'packet',
    currentStock: 95,
    minStockAlert: 30,
    unitCost: 35,
    lastRestockedDate: '2026-09-18',
    supplier: 'Olympic / Dan Cake',
    notes: 'Canteen counter biscuits'
  },
  {
    id: 'raw-9',
    name: 'One Time Box',
    nameBn: 'ওয়ান টাইম ফুড বক্স ও কাপ',
    category: 'Packaging & Disposables',
    unit: 'pcs',
    currentStock: 420,
    minStockAlert: 100,
    unitCost: 6.5,
    lastRestockedDate: '2026-09-14',
    supplier: 'Packaging Mart',
    notes: 'Food grade disposable boxes for takeaway'
  },
  {
    id: 'raw-10',
    name: 'Pasta',
    nameBn: 'কাঁচা পাস্তা (Macaroni/Spiral)',
    category: 'Dry Food & Snacks',
    unit: 'kg',
    currentStock: 22,
    minStockAlert: 8,
    unitCost: 145,
    lastRestockedDate: '2026-09-15',
    supplier: 'City Grocery',
    notes: 'Evening snacks pasta preparation'
  },
  {
    id: 'raw-11',
    name: 'Frozen Porota',
    nameBn: 'ফ্রোজেন পরোটা (Kazi/CP)',
    category: 'Frozen Foods',
    unit: 'pcs',
    currentStock: 160,
    minStockAlert: 45,
    unitCost: 16,
    lastRestockedDate: '2026-09-19',
    supplier: 'Deep Freezer Store',
    notes: 'Quick breakfast & night snack'
  },
  {
    id: 'raw-12',
    name: 'Soyabin Oil',
    nameBn: 'সয়াবিন তেল (রূপচাঁদা/তীর)',
    category: 'Oil & Spices',
    unit: 'liter',
    currentStock: 52,
    minStockAlert: 18,
    unitCost: 185,
    lastRestockedDate: '2026-09-16',
    supplier: 'City Edible Oil Co',
    notes: 'Cooking oil 5L bottles'
  },
  {
    id: 'raw-13',
    name: 'Sugar',
    nameBn: 'সাদা চিনি',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 38,
    minStockAlert: 12,
    unitCost: 132,
    lastRestockedDate: '2026-09-17',
    supplier: 'Local Wholesale',
    notes: 'For tea, coffee and desserts'
  },
  {
    id: 'raw-14',
    name: 'Onion',
    nameBn: 'পেঁয়াজ (দেশি / আমদানিকৃত)',
    category: 'Vegetables',
    unit: 'kg',
    currentStock: 28,
    minStockAlert: 10,
    unitCost: 78,
    lastRestockedDate: '2026-09-20',
    supplier: 'Local Bazar',
    notes: 'Daily kitchen staple'
  }
];

// Default built-in recipes mapped by name
const DEFAULT_MENU_RECIPES: Record<string, RecipeIngredient[]> = {
  'EGG MUMLET': [
    { rawItemId: 'raw-7', rawItemName: 'Egg', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 0.02, unit: 'kg' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 0.01, unit: 'liter' }
  ],
  'EGG NOODLES': [
    { rawItemId: 'raw-6', rawItemName: 'Noodles', quantity: 1, unit: 'packet' },
    { rawItemId: 'raw-7', rawItemName: 'Egg', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 0.02, unit: 'kg' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 0.01, unit: 'liter' }
  ],
  'GREEN TEA': [
    { rawItemId: 'raw-5', rawItemName: 'Tea Bag', quantity: 1, unit: 'packet' },
    { rawItemId: 'raw-13', rawItemName: 'Sugar', quantity: 0.01, unit: 'kg' }
  ],
  'HALIM': [
    { rawItemId: 'raw-3', rawItemName: 'Dal', quantity: 0.05, unit: 'kg' },
    { rawItemId: 'raw-1', rawItemName: 'Chicken', quantity: 0.05, unit: 'kg' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 0.02, unit: 'kg' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 0.015, unit: 'liter' }
  ],
  'LEMON JUICE': [
    { rawItemId: 'raw-13', rawItemName: 'Sugar', quantity: 0.025, unit: 'kg' },
    { rawItemId: 'raw-9', rawItemName: 'One Time Box', quantity: 1, unit: 'pcs' }
  ],
  'LIQUOR TEA': [
    { rawItemId: 'raw-5', rawItemName: 'Tea Bag', quantity: 1, unit: 'packet' },
    { rawItemId: 'raw-13', rawItemName: 'Sugar', quantity: 0.015, unit: 'kg' }
  ],
  'MILK COFFEE': [
    { rawItemId: 'raw-4', rawItemName: 'Milk Powder', quantity: 0.025, unit: 'kg' },
    { rawItemId: 'raw-13', rawItemName: 'Sugar', quantity: 0.015, unit: 'kg' }
  ],
  'MILK TEA': [
    { rawItemId: 'raw-4', rawItemName: 'Milk Powder', quantity: 0.02, unit: 'kg' },
    { rawItemId: 'raw-5', rawItemName: 'Tea Bag', quantity: 1, unit: 'packet' },
    { rawItemId: 'raw-13', rawItemName: 'Sugar', quantity: 0.015, unit: 'kg' }
  ],
  'NOODLES': [
    { rawItemId: 'raw-6', rawItemName: 'Noodles', quantity: 1, unit: 'packet' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 0.01, unit: 'liter' }
  ],
  'NORMAL BISCUIT': [
    { rawItemId: 'raw-8', rawItemName: 'Biscuit', quantity: 1, unit: 'packet' }
  ],
  'ONE TIME BOX': [
    { rawItemId: 'raw-9', rawItemName: 'One Time Box', quantity: 1, unit: 'pcs' }
  ],
  'PASTA': [
    { rawItemId: 'raw-10', rawItemName: 'Pasta', quantity: 0.1, unit: 'kg' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 0.02, unit: 'kg' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 0.015, unit: 'liter' }
  ]
};

export const getRawInventoryItems = (): RawInventoryItem[] => {
  try {
    const stored = localStorage.getItem(RAW_ITEMS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Failed to load raw items from localStorage:', e);
  }
  return INITIAL_RAW_ITEMS;
};

export const saveRawInventoryItems = (items: RawInventoryItem[]): void => {
  try {
    localStorage.setItem(RAW_ITEMS_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.warn('Failed to save raw items:', e);
  }
};

export const getMenuRecipes = (): MenuRecipeMap => {
  try {
    const stored = localStorage.getItem(RECIPES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load recipes from localStorage:', e);
  }

  // Initialize with default recipes
  try {
    localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(DEFAULT_MENU_RECIPES));
  } catch (e) {
    console.warn('Failed to save initial recipes:', e);
  }
  return DEFAULT_MENU_RECIPES;
};

export const getRecipeForMenuItem = (menuItemId: string, menuItemName?: string): RecipeIngredient[] => {
  const recipes = getMenuRecipes();
  if (menuItemId && recipes[menuItemId]) {
    return recipes[menuItemId];
  }
  if (menuItemName) {
    const normalized = menuItemName.trim().toUpperCase();
    if (recipes[normalized]) {
      return recipes[normalized];
    }
  }
  return [];
};

export const saveRecipeForMenuItem = (
  menuItemId: string,
  ingredients: RecipeIngredient[],
  menuItemName?: string
): void => {
  try {
    const recipes = { ...getMenuRecipes() };
    if (menuItemId) {
      recipes[menuItemId] = ingredients;
    }
    if (menuItemName) {
      recipes[menuItemName.trim().toUpperCase()] = ingredients;
    }
    localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(recipes));
    window.dispatchEvent(new Event('canteen_menu_recipes_updated'));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.warn('Failed to save menu recipe:', e);
  }
};

export interface RawStockDeductionResult {
  success: boolean;
  deducted: Array<{
    rawItemId: string;
    rawItemName: string;
    qtyDeducted: number;
    unit: string;
    previousStock: number;
    remainingStock: number;
  }>;
  warnings: string[];
}

export const deductRawStockForSales = (
  soldItems: Array<{ menuItemId?: string; menuItemName: string; qty: number }>
): RawStockDeductionResult => {
  const rawItems = getRawInventoryItems();
  const rawItemsMap = new Map<string, RawInventoryItem>();
  rawItems.forEach(item => {
    rawItemsMap.set(item.id, { ...item });
    rawItemsMap.set(item.name.toLowerCase().trim(), item);
  });

  const recipes = getMenuRecipes();
  const deductionsMap = new Map<string, { item: RawInventoryItem; totalUsed: number }>();
  const warnings: string[] = [];

  for (const sold of soldItems) {
    if (sold.qty <= 0) continue;
    
    // Find recipe
    let recipe: RecipeIngredient[] = [];
    if (sold.menuItemId && recipes[sold.menuItemId]) {
      recipe = recipes[sold.menuItemId];
    } else if (sold.menuItemName) {
      recipe = recipes[sold.menuItemName.trim().toUpperCase()] || [];
    }

    if (!recipe || recipe.length === 0) {
      continue;
    }

    for (const ing of recipe) {
      let rawItem = rawItemsMap.get(ing.rawItemId);
      if (!rawItem && ing.rawItemName) {
        rawItem = rawItems.find(r => r.name.toLowerCase() === ing.rawItemName.toLowerCase());
      }

      if (rawItem) {
        const amount = ing.quantity * sold.qty;
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

  const today = new Date().toISOString().split('T')[0];
  const newLogs: RawStockLog[] = [];
  const deductedSummary: RawStockDeductionResult['deducted'] = [];

  // Apply deductions to raw items
  const updatedItems = rawItems.map(item => {
    const entry = deductionsMap.get(item.id);
    if (!entry) return item;

    const used = Math.round(entry.totalUsed * 1000) / 1000;
    const prevStock = item.currentStock;
    const newStock = Math.max(0, Math.round((prevStock - used) * 1000) / 1000);

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
      type: 'ISSUE',
      quantity: used,
      unit: item.unit,
      previousStock: prevStock,
      newStock: newStock,
      cost: Math.round(used * item.unitCost),
      date: today,
      notes: `POS Sale auto deduction (${soldItems.map(s => `${s.menuItemName} x${s.qty}`).join(', ')})`,
      recordedBy: 'POS System'
    });

    return {
      ...item,
      currentStock: newStock
    };
  });

  // Save updated items
  saveRawInventoryItems(updatedItems);

  // Save logs
  try {
    let existingLogs: RawStockLog[] = [];
    const storedLogs = localStorage.getItem(RAW_LOGS_STORAGE_KEY);
    if (storedLogs) {
      existingLogs = JSON.parse(storedLogs);
    }
    const mergedLogs = [...newLogs, ...existingLogs].slice(0, 500);
    localStorage.setItem(RAW_LOGS_STORAGE_KEY, JSON.stringify(mergedLogs));
    window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.warn('Failed to append raw stock logs:', e);
  }

  return {
    success: true,
    deducted: deductedSummary,
    warnings
  };
};

export interface AutoRestockExpenseInput {
  desc: string;
  subdesc?: string;
  category: string;
  amount: number;
  date?: string;
  rawItemId?: string;
  rawItemQty?: number;
}

/**
 * Automatically restocks a raw inventory item when an expense is recorded in Expenditures
 */
export const autoRestockFromExpense = (input: AutoRestockExpenseInput): {
  success: boolean;
  restockedItem?: RawInventoryItem;
  quantity?: number;
  message?: string;
} => {
  const rawItems = getRawInventoryItems();
  let matchedItem: RawInventoryItem | undefined;

  // 1. Check explicit rawItemId
  if (input.rawItemId) {
    matchedItem = rawItems.find(r => r.id === input.rawItemId);
  }

  // 2. If not matched, try matching item name or nameBn in desc/subdesc
  if (!matchedItem) {
    const textToMatch = `${input.desc} ${input.subdesc || ''}`.toLowerCase();
    
    // Keyword synonyms dictionary for common canteen items
    const synonymMap: Record<string, string[]> = {
      'raw-1': ['chicken', 'chiken', 'murgi', 'murigi', 'মাংস', 'মুরগি', 'মুরগীর', 'মুরগির', 'ব্রয়লার'],
      'raw-2': ['rice', 'chal', 'chaal', 'চাল', 'মিনিকেট', 'ভাত'],
      'raw-3': ['dal', 'daal', 'ডাল', 'মসুর'],
      'raw-4': ['milk', 'powder', 'doodh', 'dano', 'diploma', 'দুধ', 'গুঁড়া দুধ'],
      'raw-5': ['tea', 'tea bag', 'cha', 'isapahani', 'taaza', 'চা পাতা', 'টি ব্যাগ', 'চা'],
      'raw-6': ['noodles', 'maggi', 'nuduls', 'নুডলস', 'ম্যাগি'],
      'raw-7': ['egg', 'eggs', 'dim', 'deem', 'ডিম', 'আন্ডা'],
      'raw-8': ['biscuit', 'biscuits', 'cookies', 'cake', 'বিস্কুট', 'টোস্ট'],
      'raw-9': ['box', 'one time', 'cup', 'disposable', 'ওয়ান টাইম', 'বক্স', 'ওয়ানটাইম'],
      'raw-10': ['pasta', 'macaroni', 'পাস্তা'],
      'raw-11': ['porota', 'paratha', 'parota', 'পরোটা', 'ফ্রোজেন পরোটা'],
      'raw-12': ['oil', 'soyabean', 'soyabin', 'tel', 'তেল', 'রূপচাঁদা', 'সয়াবিন'],
      'raw-13': ['sugar', 'chini', 'cheeni', 'চিনি'],
      'raw-14': ['onion', 'peyaj', 'peaj', 'পেঁয়াজ', 'পেয়াজ']
    };

    // Check direct names first
    for (const item of rawItems) {
      if (textToMatch.includes(item.name.toLowerCase()) || 
          (item.nameBn && textToMatch.includes(item.nameBn.toLowerCase()))) {
        matchedItem = item;
        break;
      }
    }

    // Check synonyms if still not matched
    if (!matchedItem) {
      for (const [id, words] of Object.entries(synonymMap)) {
        if (words.some(w => textToMatch.includes(w))) {
          matchedItem = rawItems.find(r => r.id === id);
          if (matchedItem) break;
        }
      }
    }
  }

  if (!matchedItem) {
    return { success: false, message: 'No matching raw item found for this expenditure' };
  }

  // Determine quantity to add
  let qtyToAdd = Number(input.rawItemQty);
  if (!qtyToAdd || isNaN(qtyToAdd) || qtyToAdd <= 0) {
    // Try to extract quantity from desc (e.g. "CHICKEN 10 KG" or "EGG 100 PCS")
    const matchKg = input.desc.match(/(\d+(?:\.\d+)?)\s*(?:kg|কেজি)/i);
    const matchPcs = input.desc.match(/(\d+(?:\.\d+)?)\s*(?:pcs|pc|টি|টা)/i);
    const matchLtr = input.desc.match(/(\d+(?:\.\d+)?)\s*(?:liter|litre|ltr|লিটার)/i);
    const matchPkt = input.desc.match(/(\d+(?:\.\d+)?)\s*(?:packet|pkt|প্যাকেট)/i);

    if (matchKg) qtyToAdd = parseFloat(matchKg[1]);
    else if (matchPcs) qtyToAdd = parseFloat(matchPcs[1]);
    else if (matchLtr) qtyToAdd = parseFloat(matchLtr[1]);
    else if (matchPkt) qtyToAdd = parseFloat(matchPkt[1]);
    else if (input.amount > 0 && matchedItem.unitCost > 0) {
      // Estimate from amount / unitCost
      qtyToAdd = Math.round((input.amount / matchedItem.unitCost) * 10) / 10;
    } else {
      qtyToAdd = 1;
    }
  }

  qtyToAdd = Math.round(qtyToAdd * 100) / 100;
  if (qtyToAdd <= 0) qtyToAdd = 1;

  const prevStock = matchedItem.currentStock;
  const newStock = Math.round((prevStock + qtyToAdd) * 100) / 100;
  const today = input.date || new Date().toISOString().split('T')[0];

  // Update item
  const updatedItems = rawItems.map(item => {
    if (item.id === matchedItem!.id) {
      const calculatedUnitCost = input.amount > 0 && qtyToAdd > 0
        ? Math.round(input.amount / qtyToAdd)
        : item.unitCost;

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

  // Add RESTOCK Log
  const newLog: RawStockLog = {
    id: `log-exp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    itemId: matchedItem.id,
    itemName: `${matchedItem.name} (${matchedItem.nameBn})`,
    type: 'RESTOCK',
    quantity: qtyToAdd,
    unit: matchedItem.unit,
    previousStock: prevStock,
    newStock: newStock,
    cost: input.amount,
    date: today,
    notes: `Expenditure Purchase: ${input.desc} (৳${input.amount})`,
    recordedBy: 'Expenditures Auto-Restock'
  };

  try {
    let existingLogs: RawStockLog[] = [];
    const storedLogs = localStorage.getItem(RAW_LOGS_STORAGE_KEY);
    if (storedLogs) {
      existingLogs = JSON.parse(storedLogs);
    }
    const mergedLogs = [newLog, ...existingLogs].slice(0, 500);
    localStorage.setItem(RAW_LOGS_STORAGE_KEY, JSON.stringify(mergedLogs));
    window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.warn('Failed to append raw restock log:', e);
  }

  return {
    success: true,
    restockedItem: matchedItem,
    quantity: qtyToAdd,
    message: `${matchedItem.name} (+${qtyToAdd} ${matchedItem.unit}) auto restocked from expenditure!`
  };
};

