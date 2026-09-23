const supabase = { from: () => ({ upsert: () => Promise.resolve() }) };

interface RawInventoryItem {
  id: string;
  name: string;
  nameBn: string;
  category?: string;
  subCategory?: string;
  unit: string;
  currentStock: number;
  minStockAlert: number;
  unitCost: number;
  wastagePercentage?: number; // e.g. 30 means 30% wastage, 70% enters stock
  lastRestockedDate: string;
  supplier?: string;
  notes?: string;
  packSize?: number; // e.g. 100 for Tea Bag (1 packet = 100 pcs)
  subUnit?: string;  // e.g. 'pcs'
  hasSubUnits?: boolean;
}

interface RawStockLog {
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

interface RecipeIngredient {
  rawItemId: string;
  rawItemName: string;
  quantity: number;
  unit: string;
}

type MenuRecipeMap = Record<string, RecipeIngredient[]>;

const RAW_ITEMS_STORAGE_KEY = 'canteen_raw_inventory_items_v2';
const RAW_LOGS_STORAGE_KEY = 'canteen_raw_stock_logs_v2';
const RECIPES_STORAGE_KEY = 'canteen_menu_recipes_v3';
const LEGACY_RECIPES_STORAGE_KEY = 'canteen_menu_recipes_v2';

/**
 * Information about sub-unit / subcategory conversions:
 * Ltr - ml (1 Ltr = 1000 ml)
 * Kg - gm (1 Kg = 1000 gm)
 * Packet - Pcs (1 Packet = packSize pcs)
 */
interface RawSubUnitInfo {
  hasSubUnit: boolean;
  subUnit: string;
  packSize: number;
  label: string;
}

const getRawItemSubUnitInfo = (item?: Partial<RawInventoryItem> | null): RawSubUnitInfo => {
  if (!item) {
    return { hasSubUnit: false, subUnit: '', packSize: 1, label: '' };
  }
  const u = (item.unit || '').toLowerCase().trim();
  const explicitSub = (item.subUnit || '').toLowerCase().trim();

  // 1. RULE: Pcs / Piece / টি items have NO sub-unit at all
  if (u === 'pcs' || u === 'pc' || u === 'piece' || u === 'টি' || u === 'টা') {
    return { hasSubUnit: false, subUnit: '', packSize: 1, label: '' };
  }

  // 2. RULE: Unit and Sub-unit must NEVER be identical
  if (u && explicitSub && u === explicitSub) {
    return { hasSubUnit: false, subUnit: '', packSize: 1, label: '' };
  }

  // 3. Kg - gm (1 kg = 1000 gm)
  if (u === 'kg' || (explicitSub === 'gm' && u !== 'gm')) {
    const size = (item.packSize && item.packSize > 1) ? item.packSize : 1000;
    return { hasSubUnit: true, subUnit: 'gm', packSize: size, label: `১ কেজি = ${size} গ্রাম` };
  }

  // 4. Ltr - ml (1 Ltr = 1000 ml)
  if (['liter', 'ltr', 'litre', 'l'].includes(u) || (explicitSub === 'ml' && !['liter', 'ltr', 'litre', 'l'].includes(u))) {
    const size = (item.packSize && item.packSize > 1) ? item.packSize : 1000;
    return { hasSubUnit: true, subUnit: 'ml', packSize: size, label: `১ লিটার = ${size} মিলি` };
  }

  // 5. Case / Crate - Pcs (1 Case = packSize pcs, default 30)
  if (['case', 'crate'].includes(u) || (u.includes('case') && explicitSub === 'pcs')) {
    const size = (item.packSize && item.packSize > 1) ? item.packSize : 30;
    return { hasSubUnit: true, subUnit: 'pcs', packSize: size, label: `১ কেস = ${size} পিস` };
  }

  // 6. Packet / Box - Pcs / Slice / Cup (ONLY if main unit is packet/box/pkt)
  if (['packet', 'box', 'pkt'].includes(u)) {
    const sub = item.subUnit && item.subUnit.toLowerCase().trim() !== u ? item.subUnit.trim() : 'pcs';
    const size = (item.packSize && item.packSize > 1) ? item.packSize : 24;
    return { hasSubUnit: true, subUnit: sub, packSize: size, label: `১ ${item.unit || 'প্যাকেট'} = ${size} ${sub}` };
  }

  // 7. Explicit configured sub-units where packSize > 1 and subUnit differs from unit
  if (Boolean(item.hasSubUnits) && item.subUnit && item.subUnit.toLowerCase().trim() !== u) {
    const size = (item.packSize && item.packSize > 1) ? item.packSize : 1;
    if (size > 1) {
      return { hasSubUnit: true, subUnit: item.subUnit, packSize: size, label: `১ ${item.unit} = ${size} ${item.subUnit}` };
    }
  }

  return { hasSubUnit: false, subUnit: item.unit || 'pcs', packSize: 1, label: '' };
};

/**
 * Determines conversion ratio between recipe ingredient unit and inventory stock unit
 */
const getIngredientToInventoryRatio = (
  rawItem: RawInventoryItem | Partial<RawInventoryItem>,
  ingredientUnit?: string
): number => {
  const ingUnit = (ingredientUnit || '').toLowerCase().trim();
  const rawUnit = (rawItem.unit || '').toLowerCase().trim();
  const subUnit = (rawItem.subUnit || '').toLowerCase().trim();

  // If units are identical, ratio is always 1:1
  if (ingUnit === rawUnit) {
    return 1;
  }

  // Pcs items have NO sub-unit
  if (rawUnit === 'pcs' || rawUnit === 'pc' || rawUnit === 'piece' || rawUnit === 'টি' || rawUnit === 'টা') {
    return 1;
  }

  // Kg - gm
  const isGm = ingUnit === 'gm' || ingUnit === 'g' || ingUnit === 'gram';
  const isKg = rawUnit === 'kg';
  if (isGm && (isKg || subUnit === 'gm')) {
    return (rawItem.packSize && rawItem.packSize > 1) ? rawItem.packSize : 1000;
  }

  // Ltr - ml
  const isMl = ingUnit === 'ml' || ingUnit === 'milli' || ingUnit === 'milliliter';
  const isLtr = rawUnit === 'liter' || rawUnit === 'ltr' || rawUnit === 'litre' || rawUnit === 'l';
  if (isMl && (isLtr || subUnit === 'ml')) {
    return (rawItem.packSize && rawItem.packSize > 1) ? rawItem.packSize : 1000;
  }

  // Case - Pcs (1 Case = packSize pcs, default 30)
  const isPcs = ingUnit === 'pcs' || ingUnit === 'piece' || ingUnit === 'pc' || ingUnit === 'slice' || ingUnit === 'cup' || ingUnit === 'sheet';
  const isCase = rawUnit === 'case' || rawUnit === 'crate';
  if (isCase && isPcs) {
    return (rawItem.packSize && rawItem.packSize > 1) ? rawItem.packSize : 30;
  }

  // Packet - Pcs / SubUnits
  const isPkt = rawUnit === 'packet' || rawUnit === 'box' || rawUnit === 'pkt';
  if (rawItem.packSize && rawItem.packSize > 1 && subUnit && subUnit !== rawUnit) {
    if (ingUnit === subUnit || (isPkt && isPcs)) {
      return rawItem.packSize;
    }
  }

  return 1;
};

const INITIAL_RAW_ITEMS: RawInventoryItem[] = [
  {
    id: 'raw-1',
    name: 'Chicken',
    nameBn: 'ব্রয়লার মুরগির মাংস',
    category: 'Meat & Poultry',
    subCategory: 'Kg - gm',
    unit: 'kg',
    currentStock: 35,
    minStockAlert: 12,
    unitCost: 230,
    wastagePercentage: 30,
    lastRestockedDate: '2026-09-18',
    supplier: 'Local Poultry Market',
    notes: 'Fresh broiler chicken for daily dishes',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-2',
    name: 'Rice',
    nameBn: 'মিনিকেট চাল',
    category: 'Grains & Pulses',
    subCategory: 'Kg - gm',
    unit: 'kg',
    currentStock: 140,
    minStockAlert: 40,
    unitCost: 75,
    lastRestockedDate: '2026-09-15',
    supplier: 'Base Ration Depot',
    notes: 'Premium Miniket rice 50kg sacks',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-3',
    name: 'Dal',
    nameBn: 'মসুর ডাল',
    category: 'Grains & Pulses',
    subCategory: 'Kg - gm',
    unit: 'kg',
    currentStock: 42,
    minStockAlert: 15,
    unitCost: 135,
    lastRestockedDate: '2026-09-16',
    supplier: 'Base Ration Depot',
    notes: 'Red split lentils',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-4',
    name: 'Milk Powder',
    nameBn: 'গুঁড়া দুধ (Dano/Diploma)',
    category: 'Dairy & Beverages',
    subCategory: 'Kg - gm',
    unit: 'kg',
    currentStock: 18,
    minStockAlert: 6,
    unitCost: 880,
    lastRestockedDate: '2026-09-17',
    supplier: 'City Super Store',
    notes: 'For canteen milk tea and coffee preparation',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-5',
    name: 'Tea Bag',
    nameBn: 'টি ব্যাগ (Tea Bag)',
    category: 'Dairy & Beverages',
    subCategory: 'Packet - Pcs',
    unit: 'packet',
    currentStock: 48,
    minStockAlert: 15,
    unitCost: 165,
    lastRestockedDate: '2026-09-19',
    supplier: 'Ispahani / Taaza Distributor',
    notes: '১ প্যাকেটে ১০০ টি টি-ব্যাগ থাকে (1 packet = 100 pcs)',
    packSize: 100,
    subUnit: 'pcs',
    hasSubUnits: true
  },
  {
    id: 'raw-6',
    name: 'Noodles',
    nameBn: 'কাঁচা নুডলস (Raw Maggi/Egg)',
    category: 'Dry Food & Snacks',
    subCategory: 'Packet - Pcs',
    unit: 'packet',
    currentStock: 75,
    minStockAlert: 25,
    unitCost: 45,
    lastRestockedDate: '2026-09-20',
    supplier: 'Wholesale Store',
    notes: 'Standard family pack noodles',
    packSize: 1,
    subUnit: 'pcs',
    hasSubUnits: true
  },
  {
    id: 'raw-7',
    name: 'Egg',
    nameBn: 'মুরগির ডিম (লাল ডিম)',
    category: 'Meat & Poultry',
    subCategory: 'Case - Pcs',
    unit: 'case',
    currentStock: 10,
    minStockAlert: 3,
    unitCost: 375,
    lastRestockedDate: '2026-09-20',
    supplier: 'Poultry Farm Direct',
    notes: 'Daily breakfast and snacks omelet supply (১ কেস = ৩০ পিস ডিম)',
    packSize: 30,
    subUnit: 'pcs',
    hasSubUnits: true
  },
  {
    id: 'raw-8',
    name: 'Biscuit',
    nameBn: 'বিস্কুট প্যাকেট (টোস্ট / ড্রাই কেক)',
    category: 'Dry Food & Snacks',
    subCategory: 'Packet - Pcs',
    unit: 'packet',
    currentStock: 95,
    minStockAlert: 30,
    unitCost: 35,
    lastRestockedDate: '2026-09-18',
    supplier: 'Olympic / Dan Cake',
    notes: 'Canteen counter biscuits',
    packSize: 24,
    subUnit: 'pcs',
    hasSubUnits: true
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
    subCategory: 'Kg - gm',
    unit: 'kg',
    currentStock: 22,
    minStockAlert: 8,
    unitCost: 145,
    lastRestockedDate: '2026-09-15',
    supplier: 'City Grocery',
    notes: 'Evening snacks pasta preparation',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-12',
    name: 'Soyabin Oil',
    nameBn: 'সয়াবিন তেল (রূপচাঁদা/তীর)',
    category: 'Oil & Spices',
    subCategory: 'Ltr - ml',
    unit: 'liter',
    currentStock: 52,
    minStockAlert: 18,
    unitCost: 185,
    lastRestockedDate: '2026-09-16',
    supplier: 'City Edible Oil Co',
    notes: 'Cooking oil 5L bottles',
    packSize: 1000,
    subUnit: 'ml',
    hasSubUnits: true
  },
  {
    id: 'raw-13',
    name: 'Sugar',
    nameBn: 'সাদা চিনি',
    category: 'Oil & Spices',
    subCategory: 'Kg - gm',
    unit: 'kg',
    currentStock: 38,
    minStockAlert: 12,
    unitCost: 132,
    lastRestockedDate: '2026-09-17',
    supplier: 'Local Wholesale',
    notes: 'For tea, coffee and desserts',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-14',
    name: 'Onion',
    nameBn: 'পেঁয়াজ (দেশি / আমদানিকৃত)',
    category: 'Vegetables',
    subCategory: 'Kg - gm',
    unit: 'kg',
    currentStock: 28,
    minStockAlert: 10,
    unitCost: 78,
    lastRestockedDate: '2026-09-20',
    supplier: 'Local Bazar',
    notes: 'Daily kitchen staple',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-15',
    name: 'Halim Mix',
    nameBn: 'হালিম মিক্স মসলা ও ডাল',
    category: 'Oil & Spices',
    subCategory: 'Packet - Pcs',
    unit: 'packet',
    currentStock: 30,
    minStockAlert: 10,
    unitCost: 65,
    lastRestockedDate: '2026-09-21',
    supplier: 'Radhuni / Pran',
    notes: 'Halim mix pulses & spices packet for special halim',
    packSize: 1,
    subUnit: 'pcs',
    hasSubUnits: true
  },
  {
    id: 'raw-16',
    name: 'LPG',
    nameBn: 'এলপিজি গ্যাস (LPG)',
    category: 'Fuel & Utilities',
    subCategory: 'Gas Cylinder',
    unit: 'cylinder',
    currentStock: 4,
    minStockAlert: 1,
    unitCost: 1450,
    lastRestockedDate: '2026-09-21',
    supplier: 'Beximco / Omera Gas',
    notes: 'Commercial 12kg LPG gas cylinder for cooking stove'
  },
  {
    id: 'raw-17',
    name: 'Tomato Sauce',
    nameBn: 'টমেটো সস (Tometo Sos)',
    category: 'Oil & Spices',
    subCategory: 'Ltr - ml',
    unit: 'bottle',
    currentStock: 25,
    minStockAlert: 8,
    unitCost: 110,
    lastRestockedDate: '2026-09-21',
    supplier: 'Pran / Ahmed',
    notes: 'Tomato sauce / ketchup for shawarma, snacks & fast food',
    packSize: 1000,
    subUnit: 'ml',
    hasSubUnits: true
  },
  {
    id: 'raw-18',
    name: 'Maggi Masala',
    nameBn: 'ম্যাগি মসলা (Maggi Mosla)',
    category: 'Oil & Spices',
    subCategory: 'Packet - Pcs',
    unit: 'packet',
    currentStock: 120,
    minStockAlert: 30,
    unitCost: 8,
    lastRestockedDate: '2026-09-21',
    supplier: 'Nestle Wholesale',
    notes: 'Maggi taste-maker seasoning sachets',
    packSize: 1,
    subUnit: 'pcs',
    hasSubUnits: true
  },
  {
    id: 'raw-19',
    name: 'Green Chili',
    nameBn: 'কাঁচা মরিচ (Green Chili)',
    category: 'Vegetables',
    subCategory: 'Kg - gm',
    unit: 'kg',
    currentStock: 15,
    minStockAlert: 5,
    unitCost: 180,
    wastagePercentage: 10,
    lastRestockedDate: '2026-09-22',
    supplier: 'Local Bazar',
    notes: 'Fresh green chili for omelet, noodles & snacks',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-20',
    name: 'Coffee',
    nameBn: 'কফি পাউডার (Coffee)',
    category: 'Dairy & Beverages',
    subCategory: 'Packet - Pcs',
    unit: 'packet',
    currentStock: 40,
    minStockAlert: 12,
    unitCost: 320,
    lastRestockedDate: '2026-09-20',
    supplier: 'City Super Store',
    notes: 'Nescafe instant coffee powder for milk & cold coffee',
    packSize: 100,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-21',
    name: 'Dry Cake',
    nameBn: 'ড্রাই কেক (Dry Cake)',
    category: 'Dry Food & Snacks',
    subCategory: 'Packet - Pcs',
    unit: 'packet',
    currentStock: 60,
    minStockAlert: 20,
    unitCost: 12,
    lastRestockedDate: '2026-09-21',
    supplier: 'Olympic / Dan Cake',
    notes: 'Crispy dry cake for counter sales',
    packSize: 10,
    subUnit: 'pcs',
    hasSubUnits: true
  },
  {
    id: 'raw-22',
    name: 'Swarma Bread',
    nameBn: 'শার্মা ব্রেড / রুটি (Swarma)',
    category: 'Frozen Foods',
    unit: 'pcs',
    currentStock: 80,
    minStockAlert: 25,
    unitCost: 18,
    lastRestockedDate: '2026-09-21',
    supplier: 'Bakery Supply',
    notes: 'Shawarma pita bread wraps'
  },
  {
    id: 'raw-23',
    name: 'Butter Ban',
    nameBn: 'বাটার বন (Butter Ban)',
    category: 'Dry Food & Snacks',
    unit: 'pcs',
    currentStock: 70,
    minStockAlert: 20,
    unitCost: 15,
    lastRestockedDate: '2026-09-22',
    supplier: 'Local Bakery',
    notes: 'Sweet cream butter bun'
  },
  {
    id: 'raw-24',
    name: 'Sandwich Bread',
    nameBn: 'স্যান্ডউইচ ব্রেড (Sandwitch)',
    category: 'Dry Food & Snacks',
    subCategory: 'Packet - Pcs',
    unit: 'packet',
    currentStock: 45,
    minStockAlert: 15,
    unitCost: 45,
    lastRestockedDate: '2026-09-21',
    supplier: 'City Bakery',
    notes: '১ প্যাকেটে ১২ স্লাইস পাউরুটি থাকে (1 pack = 12 slices)',
    packSize: 12,
    subUnit: 'slice',
    hasSubUnits: true
  },
  {
    id: 'raw-25',
    name: 'Burger Bun',
    nameBn: 'বার্গার বান (Burger)',
    category: 'Dry Food & Snacks',
    unit: 'pcs',
    currentStock: 60,
    minStockAlert: 20,
    unitCost: 16,
    lastRestockedDate: '2026-09-22',
    supplier: 'City Bakery',
    notes: 'Soft sesame burger bun'
  },
  {
    id: 'raw-26',
    name: 'Hotel Porota',
    nameBn: 'হোটেল পরোটা (Hotel Porota)',
    category: 'Frozen Foods',
    unit: 'pcs',
    currentStock: 160,
    minStockAlert: 40,
    unitCost: 10,
    lastRestockedDate: '2026-09-22',
    supplier: 'Hotel Paratha Supply',
    notes: 'হাতে তৈরি সুস্বাদু হোটেল পরোটা'
  },
  {
    id: 'raw-27',
    name: 'Salt',
    nameBn: 'খাবার লবণ (Salt)',
    category: 'Oil & Spices',
    subCategory: 'Kg - gm',
    unit: 'kg',
    currentStock: 50,
    minStockAlert: 15,
    unitCost: 40,
    lastRestockedDate: '2026-09-18',
    supplier: 'Molla / ACI Salt',
    notes: 'রান্নায় ব্যবহৃত আয়োডিনযুক্ত খাবার লবণ',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-28',
    name: 'Lemon',
    nameBn: 'কাঁচা লেবু (Lemon)',
    category: 'Vegetables',
    unit: 'pcs',
    currentStock: 100,
    minStockAlert: 30,
    unitCost: 6,
    wastagePercentage: 15,
    lastRestockedDate: '2026-09-22',
    supplier: 'Local Green Grocer',
    notes: 'Fresh juicy lemons for lemon juice, tea & meals'
  },
  {
    id: 'raw-29',
    name: 'Garlic',
    nameBn: 'রসুন (Garlic)',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 15,
    minStockAlert: 5,
    unitCost: 220,
    wastagePercentage: 10,
    lastRestockedDate: '2026-09-22',
    supplier: 'Local Bazar',
    notes: 'দেশি বা চায়না কোয়া রসুন (রান্না ও পেস্টের জন্য)',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-30',
    name: 'Ginger',
    nameBn: 'আদা (Ginger)',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 12,
    minStockAlert: 4,
    unitCost: 240,
    wastagePercentage: 10,
    lastRestockedDate: '2026-09-22',
    supplier: 'Local Bazar',
    notes: 'তাজা আদা (আদা বাটা, চা ও মাংসের রান্নায় ব্যবহারের জন্য)',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-31',
    name: 'Turmeric Powder',
    nameBn: 'হলুদ গুঁড়া (Holud Gura)',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 10,
    minStockAlert: 3,
    unitCost: 320,
    lastRestockedDate: '2026-09-22',
    supplier: 'Radhuni / Wholesale',
    notes: 'রান্নায় ব্যবহৃত খাঁটি হলুদ গুঁড়া',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-32',
    name: 'Chili Powder',
    nameBn: 'মরিচের গুঁড়া (Morich Gura)',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 10,
    minStockAlert: 3,
    unitCost: 380,
    lastRestockedDate: '2026-09-22',
    supplier: 'Radhuni / Wholesale',
    notes: 'রান্নায় ব্যবহৃত লাল মরিচের গুঁড়া',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-33',
    name: 'Coriander Powder',
    nameBn: 'ধনে গুঁড়া (Dhone Gura)',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 8,
    minStockAlert: 2,
    unitCost: 280,
    lastRestockedDate: '2026-09-22',
    supplier: 'Radhuni / Wholesale',
    notes: 'সুগন্ধি ধনিয়া গুঁড়া মসলা',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-34',
    name: 'Cumin Powder',
    nameBn: 'জিরা গুঁড়া ও গোটা জিরা (Jeera)',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 8,
    minStockAlert: 2,
    unitCost: 850,
    lastRestockedDate: '2026-09-22',
    supplier: 'Wholesale Masala Market',
    notes: 'খাঁটি জিরা গুঁড়া ও রান্নার গোটা জিরা',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-35',
    name: 'Garam Masala',
    nameBn: 'গরম মসলা গুঁড়া (Garam Masala)',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 5,
    minStockAlert: 2,
    unitCost: 950,
    lastRestockedDate: '2026-09-22',
    supplier: 'Radhuni / Wholesale',
    notes: 'মাংস, খিচুড়ি ও স্পেশাল রান্নায় ব্যবহৃত গরম মসলা গুঁড়া',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-36',
    name: 'Cardamom',
    nameBn: 'সবুজ এলাচ (Elachi)',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 2,
    minStockAlert: 0.5,
    unitCost: 3200,
    lastRestockedDate: '2026-09-22',
    supplier: 'Spice Wholesale',
    notes: 'সুগন্ধি ছোট সবুজ এলাচ',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-37',
    name: 'Cinnamon',
    nameBn: 'দারুচিনি (Daruchini)',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 4,
    minStockAlert: 1,
    unitCost: 600,
    lastRestockedDate: '2026-09-22',
    supplier: 'Spice Wholesale',
    notes: 'সুগন্ধি আসল দারুচিনি ছাল',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-38',
    name: 'Cloves',
    nameBn: 'লবঙ্গ (Lobongo)',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 2,
    minStockAlert: 0.5,
    unitCost: 1400,
    lastRestockedDate: '2026-09-22',
    supplier: 'Spice Wholesale',
    notes: 'রান্না ও চায়ের জন্য আস্ত লবঙ্গ',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-39',
    name: 'Bay Leaf',
    nameBn: 'তেজপাতা (Tej Pata)',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 5,
    minStockAlert: 1,
    unitCost: 180,
    lastRestockedDate: '2026-09-22',
    supplier: 'Local Grocery',
    notes: 'শুকনা সুগন্ধি তেজপাতা',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-40',
    name: 'Black Pepper',
    nameBn: 'গোলমরিচ (Golmorich)',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 3,
    minStockAlert: 1,
    unitCost: 1100,
    lastRestockedDate: '2026-09-22',
    supplier: 'Spice Wholesale',
    notes: 'কালো গোলমরিচ গোটা ও গুঁড়া',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-41',
    name: 'Panch Phoron',
    nameBn: 'পাঁচফোড়ন (Panch Phoron)',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 5,
    minStockAlert: 1,
    unitCost: 240,
    lastRestockedDate: '2026-09-22',
    supplier: 'Local Grocery',
    notes: 'ডাল ও তরকারির পাঁচমিশালি ফোড়ন মসলা',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-42',
    name: 'Mustard Oil',
    nameBn: 'সরিষার তেল (Mustard Oil)',
    category: 'Oil & Spices',
    unit: 'liter',
    currentStock: 15,
    minStockAlert: 5,
    unitCost: 280,
    lastRestockedDate: '2026-09-22',
    supplier: 'Radhuni / Teer',
    notes: 'ঝাঁঝালো খাঁটি সরিষার তেল (ভর্তা ও রান্নার কাজে)',
    packSize: 1000,
    subUnit: 'ml',
    hasSubUnits: true
  },
  {
    id: 'raw-43',
    name: 'Cucumber',
    nameBn: 'শসা (Cucumber / সালাদ)',
    category: 'Vegetables',
    subCategory: 'Kg - gm',
    unit: 'kg',
    currentStock: 25,
    minStockAlert: 8,
    unitCost: 50,
    wastagePercentage: 10,
    lastRestockedDate: '2026-09-22',
    supplier: 'Local Green Grocer',
    notes: 'সালাদ ও খাবারের সাথে পরিবেশনের জন্য তাজা শসা',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  },
  {
    id: 'raw-44',
    name: 'Black Salt',
    nameBn: 'বিট লবণ (Black Salt / Bit Lobon)',
    category: 'Oil & Spices',
    subCategory: 'Kg - gm',
    unit: 'kg',
    currentStock: 8,
    minStockAlert: 2,
    unitCost: 120,
    wastagePercentage: 0,
    lastRestockedDate: '2026-09-22',
    supplier: 'Local Grocery / Spices Market',
    notes: 'চটপটি, ফুচকা, হালিম, সালাদ ও লেবু শরবতের বিশেষ বিট লবণ',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  }
];

// Default built-in recipes mapped by name
const DEFAULT_MENU_RECIPES: Record<string, RecipeIngredient[]> = {
  'EGG MUMLET': [
    { rawItemId: 'raw-7', rawItemName: 'Egg', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 20, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-40', rawItemName: 'Black Pepper', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 10, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.002, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 2, unit: 'gm' }
  ],
  'EGG OMELET': [
    { rawItemId: 'raw-7', rawItemName: 'Egg', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 20, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-40', rawItemName: 'Black Pepper', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 10, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.002, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 2, unit: 'gm' }
  ],
  'EGG FRY': [
    { rawItemId: 'raw-7', rawItemName: 'Egg', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-40', rawItemName: 'Black Pepper', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 10, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.002, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 2, unit: 'gm' }
  ],
  'EGG POACH': [
    { rawItemId: 'raw-7', rawItemName: 'Egg', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-40', rawItemName: 'Black Pepper', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 10, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.002, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 2, unit: 'gm' }
  ],
  'BOILED EGG': [
    { rawItemId: 'raw-7', rawItemName: 'Egg', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-40', rawItemName: 'Black Pepper', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.002, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 2, unit: 'gm' }
  ],
  'EGG NOODLES': [
    { rawItemId: 'raw-6', rawItemName: 'Noodles', quantity: 1, unit: 'packet' },
    { rawItemId: 'raw-7', rawItemName: 'Egg', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-18', rawItemName: 'Maggi Masala', quantity: 1, unit: 'packet' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 20, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 15, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.003, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 3, unit: 'gm' }
  ],
  'GREEN TEA': [
    { rawItemId: 'raw-5', rawItemName: 'Tea Bag', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-13', rawItemName: 'Sugar', quantity: 10, unit: 'gm' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.001, unit: 'cylinder' }
  ],
  'HALIM': [
    { rawItemId: 'raw-1', rawItemName: 'Chicken', quantity: 50, unit: 'gm' },
    { rawItemId: 'raw-15', rawItemName: 'Halim Mix', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-3', rawItemName: 'Dal', quantity: 30, unit: 'gm' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 25, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantity: 4, unit: 'gm' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantity: 4, unit: 'gm' },
    { rawItemId: 'raw-31', rawItemName: 'Turmeric Powder', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-32', rawItemName: 'Chili Powder', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-34', rawItemName: 'Cumin Powder', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-35', rawItemName: 'Garam Masala', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 15, unit: 'ml' },
    { rawItemId: 'raw-42', rawItemName: 'Mustard Oil', quantity: 3, unit: 'ml' },
    { rawItemId: 'raw-44', rawItemName: 'Black Salt', quantity: 1, unit: 'gm' },
    { rawItemId: 'raw-28', rawItemName: 'Lemon', quantity: 0.25, unit: 'pcs' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.005, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 3, unit: 'gm' }
  ],
  'LEMON JUICE': [
    { rawItemId: 'raw-28', rawItemName: 'Lemon', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-13', rawItemName: 'Sugar', quantity: 25, unit: 'gm' },
    { rawItemId: 'raw-44', rawItemName: 'Black Salt', quantity: 1, unit: 'gm' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 1, unit: 'gm' },
    { rawItemId: 'raw-9', rawItemName: 'One Time Box', quantity: 1, unit: 'pcs' }
  ],
  'LIQUOR TEA': [
    { rawItemId: 'raw-5', rawItemName: 'Tea Bag', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-13', rawItemName: 'Sugar', quantity: 15, unit: 'gm' },
    { rawItemId: 'raw-28', rawItemName: 'Lemon', quantity: 0.25, unit: 'pcs' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.001, unit: 'cylinder' }
  ],
  'MILK COFFEE': [
    { rawItemId: 'raw-20', rawItemName: 'Coffee', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-4', rawItemName: 'Milk Powder', quantity: 20, unit: 'gm' },
    { rawItemId: 'raw-13', rawItemName: 'Sugar', quantity: 15, unit: 'gm' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.0015, unit: 'cylinder' }
  ],
  'COLD COFFEE': [
    { rawItemId: 'raw-20', rawItemName: 'Coffee', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-4', rawItemName: 'Milk Powder', quantity: 25, unit: 'gm' },
    { rawItemId: 'raw-13', rawItemName: 'Sugar', quantity: 20, unit: 'gm' },
    { rawItemId: 'raw-9', rawItemName: 'One Time Box', quantity: 1, unit: 'pcs' }
  ],
  'MILK TEA': [
    { rawItemId: 'raw-4', rawItemName: 'Milk Powder', quantity: 20, unit: 'gm' },
    { rawItemId: 'raw-5', rawItemName: 'Tea Bag', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-13', rawItemName: 'Sugar', quantity: 15, unit: 'gm' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.0015, unit: 'cylinder' }
  ],
  'NOODLES': [
    { rawItemId: 'raw-6', rawItemName: 'Noodles', quantity: 1, unit: 'packet' },
    { rawItemId: 'raw-18', rawItemName: 'Maggi Masala', quantity: 1, unit: 'packet' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 15, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 10, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.003, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 2, unit: 'gm' }
  ],
  'NORMAL BISCUIT': [
    { rawItemId: 'raw-8', rawItemName: 'Biscuit', quantity: 1, unit: 'packet' }
  ],
  'DRY CAKE': [
    { rawItemId: 'raw-21', rawItemName: 'Dry Cake', quantity: 1, unit: 'packet' }
  ],
  'BUTTER BAN': [
    { rawItemId: 'raw-23', rawItemName: 'Butter Ban', quantity: 1, unit: 'pcs' }
  ],
  'BURGER': [
    { rawItemId: 'raw-25', rawItemName: 'Burger Bun', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-1', rawItemName: 'Chicken', quantity: 60, unit: 'gm' },
    { rawItemId: 'raw-17', rawItemName: 'Tomato Sauce', quantity: 15, unit: 'ml' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 15, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-40', rawItemName: 'Black Pepper', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 10, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.003, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 2, unit: 'gm' }
  ],
  'SANDWITCH': [
    { rawItemId: 'raw-24', rawItemName: 'Sandwich Bread', quantity: 2, unit: 'slice' },
    { rawItemId: 'raw-7', rawItemName: 'Egg', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-17', rawItemName: 'Tomato Sauce', quantity: 10, unit: 'ml' },
    { rawItemId: 'raw-40', rawItemName: 'Black Pepper', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 5, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.002, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 2, unit: 'gm' }
  ],
  'SANDWICH': [
    { rawItemId: 'raw-24', rawItemName: 'Sandwich Bread', quantity: 2, unit: 'slice' },
    { rawItemId: 'raw-7', rawItemName: 'Egg', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-17', rawItemName: 'Tomato Sauce', quantity: 10, unit: 'ml' },
    { rawItemId: 'raw-40', rawItemName: 'Black Pepper', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 5, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.002, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 2, unit: 'gm' }
  ],
  'ONE TIME BOX': [
    { rawItemId: 'raw-9', rawItemName: 'One Time Box', quantity: 1, unit: 'pcs' }
  ],
  'PASTA': [
    { rawItemId: 'raw-10', rawItemName: 'Pasta', quantity: 100, unit: 'gm' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 20, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantity: 3, unit: 'gm' },
    { rawItemId: 'raw-17', rawItemName: 'Tomato Sauce', quantity: 15, unit: 'ml' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 3, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 15, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.003, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 3, unit: 'gm' }
  ],
  'CHICKEN PASTA': [
    { rawItemId: 'raw-1', rawItemName: 'Chicken', quantity: 80, unit: 'gm' },
    { rawItemId: 'raw-10', rawItemName: 'Pasta', quantity: 80, unit: 'gm' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 30, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-17', rawItemName: 'Tomato Sauce', quantity: 15, unit: 'ml' },
    { rawItemId: 'raw-40', rawItemName: 'Black Pepper', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 3, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 15, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.004, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 4, unit: 'gm' }
  ],
  'PORATA': [
    { rawItemId: 'raw-26', rawItemName: 'Hotel Porota', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 10, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.002, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 1, unit: 'gm' }
  ],
  'PORATA (HOTEL)': [
    { rawItemId: 'raw-26', rawItemName: 'Hotel Porota', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 10, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.002, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 1, unit: 'gm' }
  ],
  'PORATA (UNIT)': [
    { rawItemId: 'raw-26', rawItemName: 'Hotel Porota', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 10, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.002, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 1, unit: 'gm' }
  ],
  'CHICKEN BIRIYANI': [
    { rawItemId: 'raw-1', rawItemName: 'Chicken', quantity: 150, unit: 'gm' },
    { rawItemId: 'raw-2', rawItemName: 'Rice', quantity: 150, unit: 'gm' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 40, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantity: 6, unit: 'gm' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantity: 6, unit: 'gm' },
    { rawItemId: 'raw-35', rawItemName: 'Garam Masala', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-36', rawItemName: 'Cardamom', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-37', rawItemName: 'Cinnamon', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-38', rawItemName: 'Cloves', quantity: 0.3, unit: 'gm' },
    { rawItemId: 'raw-39', rawItemName: 'Bay Leaf', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-34', rawItemName: 'Cumin Powder', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-32', rawItemName: 'Chili Powder', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 25, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.006, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 6, unit: 'gm' }
  ],
  'CHICKEN CURRY': [
    { rawItemId: 'raw-1', rawItemName: 'Chicken', quantity: 150, unit: 'gm' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 40, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantity: 8, unit: 'gm' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantity: 6, unit: 'gm' },
    { rawItemId: 'raw-31', rawItemName: 'Turmeric Powder', quantity: 3, unit: 'gm' },
    { rawItemId: 'raw-32', rawItemName: 'Chili Powder', quantity: 3, unit: 'gm' },
    { rawItemId: 'raw-33', rawItemName: 'Coriander Powder', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-34', rawItemName: 'Cumin Powder', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-35', rawItemName: 'Garam Masala', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-36', rawItemName: 'Cardamom', quantity: 0.3, unit: 'gm' },
    { rawItemId: 'raw-37', rawItemName: 'Cinnamon', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-39', rawItemName: 'Bay Leaf', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 20, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.005, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 5, unit: 'gm' }
  ],
  'CHICKEN KHICHURI': [
    { rawItemId: 'raw-1', rawItemName: 'Chicken', quantity: 120, unit: 'gm' },
    { rawItemId: 'raw-2', rawItemName: 'Rice', quantity: 120, unit: 'gm' },
    { rawItemId: 'raw-3', rawItemName: 'Dal', quantity: 30, unit: 'gm' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 30, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantity: 6, unit: 'gm' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-31', rawItemName: 'Turmeric Powder', quantity: 2.5, unit: 'gm' },
    { rawItemId: 'raw-32', rawItemName: 'Chili Powder', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-33', rawItemName: 'Coriander Powder', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-34', rawItemName: 'Cumin Powder', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-35', rawItemName: 'Garam Masala', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-39', rawItemName: 'Bay Leaf', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 20, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.005, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 5, unit: 'gm' }
  ],
  'CHICKEN ONION': [
    { rawItemId: 'raw-1', rawItemName: 'Chicken', quantity: 120, unit: 'gm' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 50, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantity: 6, unit: 'gm' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-31', rawItemName: 'Turmeric Powder', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-32', rawItemName: 'Chili Powder', quantity: 2.5, unit: 'gm' },
    { rawItemId: 'raw-33', rawItemName: 'Coriander Powder', quantity: 1, unit: 'gm' },
    { rawItemId: 'raw-34', rawItemName: 'Cumin Powder', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-35', rawItemName: 'Garam Masala', quantity: 1, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 20, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.004, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 4, unit: 'gm' }
  ],
  'CHICKEN PULAW': [
    { rawItemId: 'raw-1', rawItemName: 'Chicken', quantity: 150, unit: 'gm' },
    { rawItemId: 'raw-2', rawItemName: 'Rice', quantity: 150, unit: 'gm' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 35, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-35', rawItemName: 'Garam Masala', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-36', rawItemName: 'Cardamom', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-37', rawItemName: 'Cinnamon', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-39', rawItemName: 'Bay Leaf', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 25, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.005, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 5, unit: 'gm' }
  ],
  'CHICKEN POLAO': [
    { rawItemId: 'raw-1', rawItemName: 'Chicken', quantity: 150, unit: 'gm' },
    { rawItemId: 'raw-2', rawItemName: 'Rice', quantity: 150, unit: 'gm' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 35, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-35', rawItemName: 'Garam Masala', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-36', rawItemName: 'Cardamom', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-37', rawItemName: 'Cinnamon', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-39', rawItemName: 'Bay Leaf', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 25, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.005, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 5, unit: 'gm' }
  ],
  'EGG KHICURI': [
    { rawItemId: 'raw-7', rawItemName: 'Egg', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-2', rawItemName: 'Rice', quantity: 120, unit: 'gm' },
    { rawItemId: 'raw-3', rawItemName: 'Dal', quantity: 30, unit: 'gm' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 30, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantity: 4, unit: 'gm' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantity: 4, unit: 'gm' },
    { rawItemId: 'raw-31', rawItemName: 'Turmeric Powder', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-32', rawItemName: 'Chili Powder', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-34', rawItemName: 'Cumin Powder', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-39', rawItemName: 'Bay Leaf', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 20, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.004, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 4, unit: 'gm' }
  ],
  'EGG KHICHURI': [
    { rawItemId: 'raw-7', rawItemName: 'Egg', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-2', rawItemName: 'Rice', quantity: 120, unit: 'gm' },
    { rawItemId: 'raw-3', rawItemName: 'Dal', quantity: 30, unit: 'gm' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 30, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantity: 4, unit: 'gm' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantity: 4, unit: 'gm' },
    { rawItemId: 'raw-31', rawItemName: 'Turmeric Powder', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-32', rawItemName: 'Chili Powder', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-34', rawItemName: 'Cumin Powder', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-39', rawItemName: 'Bay Leaf', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 20, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.004, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 4, unit: 'gm' }
  ],
  'CHOTPOTI': [
    { rawItemId: 'raw-3', rawItemName: 'Dal', quantity: 60, unit: 'gm' },
    { rawItemId: 'raw-7', rawItemName: 'Egg', quantity: 0.5, unit: 'pcs' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 20, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 5, unit: 'gm' },
    { rawItemId: 'raw-34', rawItemName: 'Cumin Powder', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-32', rawItemName: 'Chili Powder', quantity: 1, unit: 'gm' },
    { rawItemId: 'raw-44', rawItemName: 'Black Salt', quantity: 1.5, unit: 'gm' },
    { rawItemId: 'raw-28', rawItemName: 'Lemon', quantity: 0.25, unit: 'pcs' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.004, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 2, unit: 'gm' }
  ],
  'SWARMA': [
    { rawItemId: 'raw-22', rawItemName: 'Swarma Bread', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-1', rawItemName: 'Chicken', quantity: 70, unit: 'gm' },
    { rawItemId: 'raw-17', rawItemName: 'Tomato Sauce', quantity: 15, unit: 'ml' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 20, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantity: 3, unit: 'gm' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-35', rawItemName: 'Garam Masala', quantity: 1, unit: 'gm' },
    { rawItemId: 'raw-40', rawItemName: 'Black Pepper', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 10, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.003, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 2, unit: 'gm' }
  ],
  'SHAWARMA': [
    { rawItemId: 'raw-22', rawItemName: 'Swarma Bread', quantity: 1, unit: 'pcs' },
    { rawItemId: 'raw-1', rawItemName: 'Chicken', quantity: 70, unit: 'gm' },
    { rawItemId: 'raw-17', rawItemName: 'Tomato Sauce', quantity: 15, unit: 'ml' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 20, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantity: 3, unit: 'gm' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantity: 2, unit: 'gm' },
    { rawItemId: 'raw-35', rawItemName: 'Garam Masala', quantity: 1, unit: 'gm' },
    { rawItemId: 'raw-40', rawItemName: 'Black Pepper', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantity: 10, unit: 'ml' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantity: 0.003, unit: 'cylinder' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 2, unit: 'gm' }
  ],
  'SOSA': [
    { rawItemId: 'raw-43', rawItemName: 'Cucumber', quantity: 100, unit: 'gm' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 15, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 3, unit: 'gm' },
    { rawItemId: 'raw-28', rawItemName: 'Lemon', quantity: 0.25, unit: 'pcs' },
    { rawItemId: 'raw-44', rawItemName: 'Black Salt', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 1, unit: 'gm' }
  ],
  'SALAD': [
    { rawItemId: 'raw-43', rawItemName: 'Cucumber', quantity: 100, unit: 'gm' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantity: 15, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantity: 3, unit: 'gm' },
    { rawItemId: 'raw-28', rawItemName: 'Lemon', quantity: 0.25, unit: 'pcs' },
    { rawItemId: 'raw-44', rawItemName: 'Black Salt', quantity: 0.5, unit: 'gm' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantity: 1, unit: 'gm' }
  ]
};

const normalizeRawItemName = (name: string): string => {
  const s = (name || '').toLowerCase().trim();
  if (s.includes('black salt') || s.includes('bit lobon') || s.includes('bit laban') || s.includes('বিট লবণ') || s.includes('বিট লবন') || s.includes('beet salt')) return 'black-salt';
  if (s.includes('cucumber') || s.includes('শসা') || s.includes('shosa') || s.includes('sosa')) return 'cucumber';
  if (s.includes('salt') || s.includes('লবণ')) return 'salt';
  if (s.includes('gas') || s.includes('গ্যাস') || s.includes('cylinder') || s.includes('lpg')) return 'gas-cylinder';
  if (s.includes('coffee') || s.includes('কফি')) return 'coffee';
  if (s.includes('dry cake') || s.includes('ড্রাই কেক')) return 'dry-cake';
  if (s.includes('halim') || s.includes('হালিম')) return 'halim-mix';
  if (s.includes('tometo') || s.includes('tomato') || s.includes('টমেটো')) return 'tomato-sauce';
  if (s.includes('maggi') || s.includes('ম্যাগি')) return 'maggi-masala';
  if (s.includes('green chili') || s.includes('কাঁচা মরিচ')) return 'green-chili';
  if (s.includes('garlic') || s.includes('রসুন')) return 'garlic';
  if (s.includes('ginger') || s.includes('আদা')) return 'ginger';
  if (s.includes('turmeric') || s.includes('হলুদ') || s.includes('holud')) return 'turmeric';
  if (s.includes('chili powder') || s.includes('মরিচ গুঁড়া') || s.includes('মরিচের গুঁড়া') || s.includes('morich gura')) return 'chili-powder';
  if (s.includes('coriander') || s.includes('ধনে') || s.includes('ধনিয়া') || s.includes('dhone')) return 'coriander-powder';
  if (s.includes('cumin') || s.includes('jeera') || s.includes('jira') || s.includes('জিরা')) return 'cumin';
  if (s.includes('garam masala') || s.includes('গরম মসলা') || s.includes('গরম মশলা')) return 'garam-masala';
  if (s.includes('cardamom') || s.includes('elachi') || s.includes('elach') || s.includes('এলাচ') || s.includes('এলাচি')) return 'cardamom';
  if (s.includes('cinnamon') || s.includes('daruchini') || s.includes('দারুচিনি')) return 'cinnamon';
  if (s.includes('clove') || s.includes('lobongo') || s.includes('লবঙ্গ')) return 'cloves';
  if (s.includes('bay leaf') || s.includes('bay leaves') || s.includes('tej pata') || s.includes('tejpata') || s.includes('তেজপাতা')) return 'bay-leaf';
  if (s.includes('black pepper') || s.includes('golmorich') || s.includes('গোলমরিচ')) return 'black-pepper';
  if (s.includes('panch phoron') || s.includes('panchforon') || s.includes('পাঁচফোড়ন') || s.includes('পাঁচফোড়ন')) return 'panch-phoron';
  if (s.includes('mustard oil') || s.includes('shorisha') || s.includes('সরিষার তেল')) return 'mustard-oil';
  if (s.includes('swarma') || s.includes('শার্মা') || s.includes('shawarma')) return 'swarma-bread';
  if (s.includes('butter ban') || s.includes('বাটার বন') || s.includes('butter bun')) return 'butter-ban';
  if (s.includes('sandwitch') || s.includes('sandwich') || s.includes('স্যান্ডউইচ')) return 'sandwich-bread';
  if (s.includes('burger') || s.includes('বার্গার')) return 'burger-bun';
  if (s.includes('porota') || s.includes('পরোটা')) return 'porota';
  if (s.includes('lemon') || s.includes('লেবু')) return 'lemon';
  if (s.includes('tea bag') || s.includes('টি ব্যাগ')) return 'tea-bag';
  if (s.includes('chicken') || s.includes('মুরগি')) return 'chicken';
  if (s.includes('rice') || s.includes('চাল')) return 'rice';
  if (s.includes('dal') || s.includes('ডাল')) return 'dal';
  if (s.includes('milk') || s.includes('দুধ')) return 'milk-powder';
  if (s.includes('noodle') || s.includes('নুডলস')) return 'noodles';
  if (s.includes('egg') || s.includes('ডিম')) return 'egg';
  if (s.includes('oil') || s.includes('তেল')) return 'oil';
  if (s.includes('sugar') || s.includes('চিনি')) return 'sugar';
  if (s.includes('onion') || s.includes('পেঁয়াজ') || s.includes('পেয়াজ')) return 'onion';
  if (s.includes('pasta') || s.includes('পাস্তা')) return 'pasta';
  if (s.includes('biscuit') || s.includes('বিস্কুট')) return 'biscuit';
  if (s.includes('box') || s.includes('one time') || s.includes('ওয়ান টাইম')) return 'one-time-box';
  return s.replace(/[^a-z0-9]/g, '');
};

// Helper to encode metadata safely into notes so Supabase doesn't reject columns
const encodeNotesWithMeta = (notes?: string, meta?: any) => {
  let base = (notes || '').replace(/<!--META:[\s\S]*?-->/g, '').trim();
  if (meta && Object.keys(meta).length > 0) {
    base = base ? `${base} <!--META:${JSON.stringify(meta)}-->` : `<!--META:${JSON.stringify(meta)}-->`;
  }
  return base;
};

const deduplicateRawItems = (items: RawInventoryItem[] | any): { deduplicated: RawInventoryItem[]; removedIds: string[] } => {
  const actualItems: RawInventoryItem[] = Array.isArray(items)
    ? items
    : (items && Array.isArray(items.deduplicated) ? items.deduplicated : []);

  const seenKeys = new Map<string, RawInventoryItem>();
  const removedIds: string[] = [];

  for (const item of actualItems) {
    const key = normalizeRawItemName(item.name);
    const u = (item.unit || '').toLowerCase().trim();
    const subCatLower = (item.subCategory || '').toLowerCase().trim();
    const explicitSub = (item.subUnit || '').toLowerCase().trim();

    const isPcs = u === 'pcs' || u === 'pc' || u === 'piece' || u === 'টি' || u === 'টা';
    const isKg = !isPcs && (u === 'kg' || explicitSub === 'gm' || subCatLower.includes('kg'));
    const isLtr = !isPcs && (u === 'liter' || u === 'ltr' || u === 'litre' || u === 'l' || explicitSub === 'ml' || subCatLower.includes('ltr'));
    const isCase = !isPcs && (u === 'case' || u === 'crate' || subCatLower.includes('case') || (key === 'egg'));
    const isPacket = !isPcs && (u === 'packet' || u === 'box' || u === 'pkt' || subCatLower.includes('packet'));

    let subCategory = item.subCategory;
    let subUnit = item.subUnit;
    let packSize = item.packSize;
    let hasSubUnits = Boolean(item.hasSubUnits);

    if (isPcs) {
      subCategory = item.subCategory || 'Pcs';
      subUnit = undefined;
      packSize = 1;
      hasSubUnits = false;
    } else if (isKg) {
      subCategory = item.subCategory || 'Kg - gm';
      subUnit = 'gm';
      packSize = (item.packSize && item.packSize > 1) ? item.packSize : 1000;
      hasSubUnits = true;
    } else if (isLtr) {
      subCategory = item.subCategory || 'Ltr - ml';
      subUnit = 'ml';
      packSize = (item.packSize && item.packSize > 1) ? item.packSize : 1000;
      hasSubUnits = true;
    } else if (isCase || key === 'egg') {
      subCategory = item.subCategory || 'Case - Pcs';
      subUnit = 'pcs';
      packSize = (item.packSize && item.packSize > 1) ? item.packSize : 30;
      hasSubUnits = true;
    } else if (isPacket) {
      subCategory = item.subCategory || 'Packet - Pcs';
      subUnit = (item.subUnit && item.subUnit.toLowerCase().trim() !== u) ? item.subUnit : 'pcs';
      packSize = (item.packSize && item.packSize > 1) ? item.packSize : 24;
      hasSubUnits = true;
    }

    // Safety: unit and subUnit must NEVER be identical
    if (subUnit && subUnit.toLowerCase().trim() === u) {
      hasSubUnits = false;
      packSize = 1;
      subUnit = undefined;
    }

    const normalizedItem: RawInventoryItem = {
      ...item,
      unit: (isCase || key === 'egg') ? 'case' : item.unit,
      subCategory: isPcs ? (item.subCategory || 'Pcs') : subCategory,
      hasSubUnits: isPcs ? false : hasSubUnits,
      packSize: isPcs ? 1 : (packSize || 1),
      subUnit: isPcs ? undefined : subUnit
    };

    if (!seenKeys.has(key)) {
      if (key === 'egg') {
        const wasPcs = u === 'pcs';
        const eggPackSize = (item.packSize && item.packSize > 1) ? item.packSize : 30;
        const currentStock = wasPcs ? Math.round(((item.currentStock || 0) / eggPackSize) * 100) / 100 : (item.currentStock || 10);
        const unitCost = wasPcs ? Math.round((item.unitCost || 12.5) * eggPackSize) : (item.unitCost || 375);
        const minStockAlert = wasPcs ? Math.max(1, Math.round(((item.minStockAlert || 80) / eggPackSize) * 10) / 10) : (item.minStockAlert || 3);

        seenKeys.set(key, {
          ...normalizedItem,
          unit: 'case',
          subCategory: 'Case - Pcs',
          packSize: eggPackSize,
          subUnit: 'pcs',
          hasSubUnits: true,
          currentStock,
          unitCost,
          minStockAlert,
          notes: normalizedItem.notes || 'Daily breakfast and snacks omelet supply (১ কেস = ৩০ পিস ডিম)'
        });
      } else if (key === 'tea-bag') {
        seenKeys.set(key, {
          ...normalizedItem,
          subCategory: 'Packet - Pcs',
          packSize: normalizedItem.packSize && normalizedItem.packSize > 1 ? normalizedItem.packSize : 100,
          subUnit: 'pcs',
          hasSubUnits: true,
          notes: normalizedItem.notes || '১ প্যাকেটে ১০০ টি টি-ব্যাগ থাকে (1 packet = 100 pcs)'
        });
      } else if (key === 'sandwich-bread') {
        seenKeys.set(key, {
          ...normalizedItem,
          subCategory: 'Packet - Pcs',
          packSize: normalizedItem.packSize && normalizedItem.packSize > 1 ? normalizedItem.packSize : 12,
          subUnit: 'slice',
          hasSubUnits: true
        });
      } else if (key === 'cucumber') {
        seenKeys.set(key, {
          ...normalizedItem,
          category: 'Vegetables',
          subCategory: 'Kg - gm',
          unit: 'kg',
          packSize: 1000,
          subUnit: 'gm',
          hasSubUnits: true
        });
      } else if (key === 'black-salt') {
        seenKeys.set(key, {
          ...normalizedItem,
          category: 'Oil & Spices',
          subCategory: 'Kg - gm',
          unit: 'kg',
          packSize: 1000,
          subUnit: 'gm',
          hasSubUnits: true
        });
      } else {
        seenKeys.set(key, normalizedItem);
      }
    } else {
      const existing = seenKeys.get(key)!;
      // Prefer standard raw-1 to raw-28 id over auto-generated IDs
      const currentIsStandard = item.id.startsWith('raw-') && !item.id.startsWith('raw-item-') && !item.id.includes(Date.now().toString().slice(0, 4));
      const existingIsStandard = existing.id.startsWith('raw-') && !existing.id.startsWith('raw-item-') && !existing.id.includes(Date.now().toString().slice(0, 4));

      // Intelligently select the best names and categories without letting default generic names overwrite custom names (e.g. LPG over Gas Cylinder)
      const chooseName = (a: string, b: string) => {
        if (!a) return b;
        if (!b) return a;
        if (b === 'Gas Cylinder' && a && a !== 'Gas Cylinder') return a;
        if (a === 'Gas Cylinder' && b && b !== 'Gas Cylinder') return b;
        return a;
      };

      const preferredName = chooseName(item.name, existing.name);
      const preferredNameBn = chooseName(item.nameBn, existing.nameBn);
      const chosenCategory = item.category || existing.category || 'Packaging & Disposables';
      const chosenSubCategory = normalizedItem.subCategory || existing.subCategory || (key === 'gas-cylinder' ? 'Gas Cylinder' : '');

      if (currentIsStandard && !existingIsStandard) {
        removedIds.push(existing.id);
        const mergedUnit = normalizedItem.unit || existing.unit || 'kg';
        const mergedIsPcs = ['pcs', 'pc', 'piece', 'টি', 'টা'].includes(mergedUnit.toLowerCase().trim());
        seenKeys.set(key, {
          ...existing,
          ...normalizedItem,
          name: preferredName,
          nameBn: preferredNameBn,
          category: chosenCategory,
          subCategory: chosenSubCategory,
          currentStock: Math.max(existing.currentStock, normalizedItem.currentStock),
          packSize: mergedIsPcs ? 1 : (normalizedItem.packSize || existing.packSize || 1),
          subUnit: mergedIsPcs ? undefined : (normalizedItem.subUnit || existing.subUnit),
          hasSubUnits: mergedIsPcs ? false : (normalizedItem.hasSubUnits ?? existing.hasSubUnits)
        });
      } else {
        removedIds.push(item.id);
        const mergedUnit = existing.unit || normalizedItem.unit || 'kg';
        const mergedIsPcs = ['pcs', 'pc', 'piece', 'টি', 'টা'].includes(mergedUnit.toLowerCase().trim());
        seenKeys.set(key, {
          ...normalizedItem,
          ...existing,
          name: preferredName,
          nameBn: preferredNameBn,
          category: chosenCategory,
          subCategory: chosenSubCategory,
          currentStock: Math.max(existing.currentStock, normalizedItem.currentStock),
          packSize: mergedIsPcs ? 1 : (existing.packSize || normalizedItem.packSize || 1),
          subUnit: mergedIsPcs ? undefined : (existing.subUnit || normalizedItem.subUnit),
          hasSubUnits: mergedIsPcs ? false : (existing.hasSubUnits ?? normalizedItem.hasSubUnits)
        });
      }
    }
  }

  const deduplicated = Array.from(seenKeys.values()).map(it => {
    const itUnit = (it.unit || '').toLowerCase().trim();
    const itSub = (it.subUnit || '').toLowerCase().trim();
    const itIsPcs = itUnit === 'pcs' || itUnit === 'pc' || itUnit === 'piece' || itUnit === 'টি' || itUnit === 'টা';
    const isSame = Boolean(itUnit && itSub && itUnit === itSub);

    if (it.id === 'raw-7' || normalizeRawItemName(it.name) === 'egg') {
      const wasPcs = (it.unit || '').toLowerCase().trim() === 'pcs';
      const eggPackSize = (it.packSize && it.packSize > 1) ? it.packSize : 30;
      return {
        ...it,
        unit: 'case',
        subCategory: 'Case - Pcs',
        packSize: eggPackSize,
        subUnit: 'pcs',
        hasSubUnits: true,
        currentStock: wasPcs ? Math.round(((it.currentStock || 0) / eggPackSize) * 100) / 100 : it.currentStock,
        unitCost: wasPcs ? Math.round((it.unitCost || 12.5) * eggPackSize) : it.unitCost,
        minStockAlert: wasPcs ? Math.max(1, Math.round(((it.minStockAlert || 80) / eggPackSize) * 10) / 10) : it.minStockAlert,
        notes: it.notes || 'Daily breakfast and snacks omelet supply (১ কেস = ৩০ পিস ডিম)'
      };
    }

    // STRICT RULE: Unit Pcs has NO sub-unit, and unit and sub-unit can NEVER be identical
    if (itIsPcs || isSame || (it.packSize && it.packSize <= 1)) {
      return {
        ...it,
        hasSubUnits: false,
        packSize: 1,
        subUnit: undefined
      };
    }

    return it;
  });
  return { deduplicated, removedIds };
};

const getRawInventoryItems = (): RawInventoryItem[] => {
  try {
    const stored = localStorage.getItem(RAW_ITEMS_STORAGE_KEY);
    let itemsToProcess: RawInventoryItem[] = INITIAL_RAW_ITEMS;
    let isInitialSeeding = true;
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        itemsToProcess = parsed;
        isInitialSeeding = false;
      }
    }

    const { deduplicated, removedIds } = deduplicateRawItems(itemsToProcess);

    // Merge newly added essential raw items (Garlic, Ginger, Spices, etc.) if missing from inventory
    let hasAdded = false;
    const currentKeys = new Set(deduplicated.map(it => normalizeRawItemName(it.name)));
    for (const init of INITIAL_RAW_ITEMS) {
      const k = normalizeRawItemName(init.name);
      if (!currentKeys.has(k)) {
        deduplicated.push(init);
        currentKeys.add(k);
        hasAdded = true;
      }
    }

    // Always sync clean state back to localStorage if sanitized or modified
    const cleanJson = JSON.stringify(deduplicated);
    if (removedIds.length > 0 || hasAdded || cleanJson !== stored) {
      try {
        localStorage.setItem(RAW_ITEMS_STORAGE_KEY, cleanJson);
        if (removedIds.length > 0) {
          Promise.resolve(supabase.from('Canteen_Inventory').delete().in('id', removedIds))
            .catch(err => console.warn('Cleaned duplicate raw items from DB:', err));
        }
      } catch {}
    }

    return deduplicated;
  } catch (e) {
    console.warn('Failed to load raw items from localStorage:', e);
  }
  return INITIAL_RAW_ITEMS;
};

const saveRawInventoryItems = (items: RawInventoryItem[]): void => {
  try {
    const { deduplicated } = deduplicateRawItems(items);
    localStorage.setItem(RAW_ITEMS_STORAGE_KEY, JSON.stringify(deduplicated));
    window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
    window.dispatchEvent(new Event('storage'));

    if (deduplicated && deduplicated.length > 0) {
      const payload = deduplicated.map(it => ({
        id: it.id,
        name: it.name,
        nameBn: it.nameBn || '',
        unit: it.unit || 'kg',
        "Sub Unit": it.subUnit || (it.unit?.toLowerCase() === 'kg' ? 'gm' : (it.unit?.toLowerCase() === 'liter' ? 'ml' : (it.unit?.toLowerCase() === 'case' || it.unit?.toLowerCase() === 'packet' ? 'pcs' : ''))),
        subUnit: it.subUnit || (it.unit?.toLowerCase() === 'kg' ? 'gm' : (it.unit?.toLowerCase() === 'liter' ? 'ml' : (it.unit?.toLowerCase() === 'case' || it.unit?.toLowerCase() === 'packet' ? 'pcs' : ''))),
        sub_unit: it.subUnit || (it.unit?.toLowerCase() === 'kg' ? 'gm' : (it.unit?.toLowerCase() === 'liter' ? 'ml' : (it.unit?.toLowerCase() === 'case' || it.unit?.toLowerCase() === 'packet' ? 'pcs' : ''))),
        currentStock: it.currentStock ?? 0,
        minStockAlert: it.minStockAlert ?? 5,
        unitCost: it.unitCost ?? 0,
        wastagePercentage: it.wastagePercentage ?? 0,
        lastRestockedDate: it.lastRestockedDate || '',
        supplier: it.supplier || '',
        notes: encodeNotesWithMeta(it.notes, {
          category: it.category,
          subCategory: it.subCategory,
          hasSubUnits: it.hasSubUnits,
          packSize: it.packSize,
          subUnit: it.subUnit
        })
      }));
      Promise.resolve(supabase.from('Canteen_Inventory').upsert(payload, { onConflict: 'id' }))
        .catch(err => console.warn('Supabase Canteen_Inventory upsert note from recipeManager:', err));
    }
  } catch (e) {
    console.warn('Failed to save raw items:', e);
  }
};

const getMenuRecipes = (): MenuRecipeMap => {
  try {
    let stored = localStorage.getItem(RECIPES_STORAGE_KEY);
    if (!stored) {
      stored = localStorage.getItem(LEGACY_RECIPES_STORAGE_KEY);
    }
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        let hasChanges = false;
        const merged: MenuRecipeMap = { ...parsed };

        for (const [key, defaultIngredients] of Object.entries(DEFAULT_MENU_RECIPES)) {
          if (!merged[key] || merged[key].length === 0) {
            merged[key] = defaultIngredients;
            hasChanges = true;
          } else {
            // Check if any essential default ingredient (spices, salt, gas, sauce, etc.) is missing
            const existingIds = new Set(merged[key].map((ing: any) => ing.rawItemId));
            const existingNames = new Set(merged[key].map((ing: any) => (ing.rawItemName || '').toLowerCase().trim()));
            
            const missingItems = defaultIngredients.filter(defIng => {
              const defName = (defIng.rawItemName || '').toLowerCase().trim();
              const hasById = existingIds.has(defIng.rawItemId);
              const hasByName = existingNames.has(defName);
              const isBlackSalt = defIng.rawItemId === 'raw-44' || defName.includes('black') || defName.includes('বিট');
              const isNormalSalt = !isBlackSalt && (defName.includes('salt') || defName.includes('লবণ'));
              const hasBlackSalt = isBlackSalt && (existingIds.has('raw-44') || Array.from(existingNames).some(n => n.includes('black') || n.includes('বিট')));
              const hasNormalSalt = isNormalSalt && Array.from(existingNames).some(n => (n.includes('salt') || n.includes('লবণ')) && !n.includes('black') && !n.includes('বিট'));
              const isGas = defName.includes('gas') || defName.includes('lpg') || defName.includes('cylinder') || defName.includes('গ্যাস');
              const hasGas = isGas && Array.from(existingNames).some(n => n.includes('gas') || n.includes('lpg') || n.includes('cylinder'));
              
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

        // Auto-normalize: If any ingredient is in 'kg' and quantity <= 1, convert to 'gm' (quantity * 1000)
        for (const [recipeKey, ingredients] of Object.entries(merged)) {
          if (Array.isArray(ingredients)) {
            let rowChanged = false;
            const updated = ingredients.map(ing => {
              const u = (ing.unit || '').toLowerCase().trim();
              if (u === 'kg' && ing.quantity <= 1) {
                rowChanged = true;
                return {
                  ...ing,
                  quantity: Math.round(ing.quantity * 1000 * 100) / 100,
                  unit: 'gm'
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
          } catch {}
        }
        return merged;
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

const getRecipeForMenuItem = (menuItemId: string, menuItemName?: string): RecipeIngredient[] => {
  const recipes = getMenuRecipes();
  let found: RecipeIngredient[] = [];
  if (menuItemId && recipes[menuItemId]) {
    found = recipes[menuItemId];
  } else if (menuItemName) {
    const normalized = menuItemName.trim().toUpperCase();
    if (recipes[normalized]) {
      found = recipes[normalized];
    } else {
      // Fuzzy match by key substring
      for (const [key, ings] of Object.entries(recipes)) {
        const kUpper = key.toUpperCase();
        if (normalized.includes(kUpper) || kUpper.includes(normalized)) {
          found = ings;
          break;
        }
      }
      // Bengali common names fallback
      if (!found || found.length === 0) {
        const lower = menuItemName.toLowerCase();
        if ((lower.includes('চটপটি') || lower.includes('chotpoti')) && recipes['CHOTPOTI']) {
          found = recipes['CHOTPOTI'];
        } else if ((lower.includes('হালিম') || lower.includes('halim')) && recipes['HALIM']) {
          found = recipes['HALIM'];
        } else if ((lower.includes('লেবু') || lower.includes('lemon')) && recipes['LEMON JUICE']) {
          found = recipes['LEMON JUICE'];
        } else if ((lower.includes('শসা') || lower.includes('sosa')) && recipes['SOSA']) {
          found = recipes['SOSA'];
        } else if ((lower.includes('সালাদ') || lower.includes('salad')) && recipes['SALAD']) {
          found = recipes['SALAD'];
        }
      }
    }
  }

  if (found.length === 0) return [];

  // Guarantee that ingredients for raw items with sub-units/subcats are returned subcat-wise!
  try {
    const rawItems = getRawInventoryItems();
    const rawMap = new Map<string, RawInventoryItem>();
    rawItems.forEach(r => {
      rawMap.set(r.id, r);
      rawMap.set(r.name.toLowerCase().trim(), r);
    });

    return found.map(ing => {
      const raw = rawMap.get(ing.rawItemId) || (ing.rawItemName ? rawMap.get(ing.rawItemName.toLowerCase().trim()) : undefined);
      if (!raw) return ing;
      const subInfo = getRawItemSubUnitInfo(raw);
      if (subInfo.hasSubUnit && subInfo.subUnit) {
        const currentUnit = (ing.unit || '').toLowerCase().trim();
        const rawUnit = (raw.unit || '').toLowerCase().trim();
        const subUnitLower = subInfo.subUnit.toLowerCase().trim();
        // If entered in parent unit, convert to sub-unit
        if (currentUnit === rawUnit && currentUnit !== subUnitLower) {
          const ratio = subInfo.packSize || 1000;
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

/**
 * Automatically ensures cooking ingredients (Gas Cylinder and Salt) are included
 * for recipes that involve cooking raw items (chicken, meat, egg, rice, dal, pasta, oil, vegetables, etc.)
 */
const ensureCookingIngredients = (
  ingredients: RecipeIngredient[],
  rawItems?: RawInventoryItem[]
): RecipeIngredient[] => {
  if (!ingredients || ingredients.length === 0) return ingredients;

  const allRaw = rawItems && rawItems.length > 0 ? rawItems : getRawInventoryItems();
  
  // Find raw items that indicate cooking
  const cookingIndicatorKeywords = [
    'chicken', 'meat', 'beef', 'egg', 'dim', 'rice', 'dal', 'pasta', 
    'khichuri', 'biriyani', 'curry', 'porota', 'oil', 'onion', 'chili', 'vegetable', 'alu', 'potato'
  ];

  const hasCookedRaw = ingredients.some(ing => {
    const rawName = (ing.rawItemName || '').toLowerCase();
    return cookingIndicatorKeywords.some(kw => rawName.includes(kw));
  });

  if (!hasCookedRaw) {
    return ingredients;
  }

  // Check if gas or salt already present
  const hasGas = ingredients.some(ing => {
    const name = (ing.rawItemName || '').toLowerCase();
    return name.includes('gas') || name.includes('lpg') || name.includes('cylinder') || name.includes('গ্যাস');
  });

  const hasSalt = ingredients.some(ing => {
    const name = (ing.rawItemName || '').toLowerCase();
    return name.includes('salt') || name.includes('লবণ');
  });

  let updated = [...ingredients];

  if (!hasGas) {
    const gasRaw = allRaw.find(r => {
      const lower = r.name.toLowerCase();
      return lower.includes('lpg') || lower.includes('gas') || lower.includes('cylinder') || (r.nameBn && r.nameBn.includes('গ্যাস'));
    }) || {
      id: 'raw-16',
      name: 'LPG',
      unit: 'cylinder',
      unitCost: 1450
    };
    updated.push({
      rawItemId: gasRaw.id,
      rawItemName: gasRaw.name,
      quantity: 0.003,
      unit: gasRaw.unit
    });
  }

  if (!hasSalt) {
    const saltRaw = allRaw.find(r => {
      const lower = r.name.toLowerCase();
      const lowerBn = (r.nameBn || '').toLowerCase();
      const isBlack = lower.includes('black') || lowerBn.includes('বিট');
      return !isBlack && (lower.includes('salt') || lowerBn.includes('লবণ'));
    }) || {
      id: 'raw-27',
      name: 'Salt',
      unit: 'kg',
      unitCost: 42
    };
    updated.push({
      rawItemId: saltRaw.id,
      rawItemName: saltRaw.name,
      quantity: 2,
      unit: 'gm'
    });
  }

  return updated;
};

const saveRecipeForMenuItem = (
  menuItemId: string,
  ingredients: RecipeIngredient[],
  menuItemName?: string
): void => {
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
    window.dispatchEvent(new Event('canteen_menu_recipes_updated'));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.warn('Failed to save menu recipe:', e);
  }
};

interface RawStockDeductionResult {
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

const deductRawStockForSales = (
  soldItems: Array<{ menuItemId?: string; menuItemName?: string; name?: string; qty?: number; quantity?: number }>
): RawStockDeductionResult => {
  const rawItems = getRawInventoryItems();
  const rawItemsMap = new Map<string, RawInventoryItem>();
  rawItems.forEach(item => {
    rawItemsMap.set(item.id, { ...item });
    rawItemsMap.set(item.name.toLowerCase().trim(), item);
  });

  const deductionsMap = new Map<string, { item: RawInventoryItem; totalUsed: number }>();
  const warnings: string[] = [];

  for (const sold of soldItems) {
    const soldQty = Number(sold.qty ?? sold.quantity ?? 0);
    if (soldQty <= 0) continue;
    
    // Find recipe
    const itemName = sold.menuItemName || sold.name || '';
    const recipe = getRecipeForMenuItem(sold.menuItemId || '', itemName);

    if (!recipe || recipe.length === 0) {
      continue;
    }

    for (const ing of recipe) {
      let rawItem = rawItemsMap.get(ing.rawItemId);
      if (!rawItem && ing.rawItemName) {
        rawItem = rawItems.find(r => r.name.toLowerCase() === ing.rawItemName.toLowerCase());
      }

      if (rawItem) {
        const ratio = getIngredientToInventoryRatio(rawItem, ing.unit);
        const amount = (ing.quantity / ratio) * soldQty;

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

    const used = Math.round(entry.totalUsed * 10000) / 10000;
    const prevStock = item.currentStock;
    const newStock = Math.max(0, Math.round((prevStock - used) * 10000) / 10000);

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
      notes: `[AUTO ISSUE - MENU SALE] ${soldItems.map(s => `${s.menuItemName} x${s.qty}`).join(', ')}`,
      recordedBy: 'POS Sale (Auto)'
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
    window.dispatchEvent(new Event('canteen_raw_stock_logs_updated'));
    window.dispatchEvent(new Event('canteen_state_updated'));
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

interface AutoRestockExpenseInput {
  desc: string;
  subdesc?: string;
  category?: string;
  amount: number;
  date?: string;
  rawItemId?: string;
  rawItemQty?: number;
}

/**
 * Automatically restocks a raw inventory item when an expense is recorded in Expenditures
 */
const autoRestockFromExpense = (input: AutoRestockExpenseInput): {
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
      'raw-14': ['onion', 'peyaj', 'peaj', 'পেঁয়াজ', 'পেয়াজ'],
      'raw-15': ['halim', 'halim mix', 'haleem', 'হালিম মিক্স', 'হালিম'],
      'raw-16': ['gas', 'cylinder', 'lpg', 'গ্যাস', 'সিলিন্ডার'],
      'raw-17': ['sos', 'sauce', 'tomato', 'tometo', 'সস', 'টমেটো সস'],
      'raw-18': ['maggi mosla', 'masala', 'mosla', 'ম্যাগি মসলা', 'টেস্টমেকার'],
      'raw-19': ['green chili', 'chili', 'morich', 'কাঁচা মরিচ', 'মরিচ'],
      'raw-20': ['coffee', 'nescafe', 'কফি', 'কফি পাউডার'],
      'raw-21': ['dry cake', 'cake', 'ড্রাই কেক'],
      'raw-22': ['swarma', 'shawarma', 'pita', 'শার্মা', 'শাওয়ার্মা', 'শার্মা ব্রেড'],
      'raw-23': ['butter ban', 'ban', 'bun', 'বাটার বন', 'বনরুটি'],
      'raw-24': ['sandwitch', 'sandwich', 'bread', 'স্যান্ডউইচ', 'স্যান্ডউইচ ব্রেড'],
      'raw-25': ['burger', 'burger bun', 'বার্গার', 'বার্গার বান'],
      'raw-26': ['hotel porota', 'porota', 'paratha', 'হোটেল পরোটা'],
      'raw-44': ['black salt', 'bit lobon', 'bit laban', 'beet salt', 'বিট লবণ', 'বিট লবন'],
      'raw-27': ['salt', 'lobon', 'লবণ', 'নুন'],
      'raw-28': ['lemon', 'lebu', 'লেবু', 'কাগজি লেবু'],
      'raw-29': ['garlic', 'roshun', 'rosun', 'রসুন', 'রসুনের', 'কোয়া রসুন'],
      'raw-30': ['ginger', 'ada', 'আদা', 'আদার', 'আদা বাটা'],
      'raw-31': ['turmeric', 'holud', 'হলুদ', 'হলুদ গুঁড়া', 'হলুদের', 'হলুদ গুড়া'],
      'raw-32': ['chili powder', 'morich gura', 'morich powder', 'মরিচ গুঁড়া', 'মরিচের গুঁড়া', 'মরিচের গুড়া', 'লাল মরিচ'],
      'raw-33': ['coriander', 'dhone', 'dhonia', 'ধনে গুঁড়া', 'ধনিয়া গুঁড়া', 'ধনে গুড়া', 'ধনে'],
      'raw-34': ['cumin', 'jeera', 'jira', 'জিরা', 'জিরা গুঁড়া', 'জিরা গুড়া', 'গোটা জিরা'],
      'raw-35': ['garam masala', 'grom mosla', 'গরম মসলা', 'গরম মশলা', 'গরম মসলা গুঁড়া'],
      'raw-36': ['cardamom', 'elachi', 'elach', 'এলাচ', 'এলাচি', 'সবুজ এলাচ'],
      'raw-37': ['cinnamon', 'daruchini', 'দারুচিনি'],
      'raw-38': ['clove', 'cloves', 'lobongo', 'লবঙ্গ'],
      'raw-39': ['bay leaf', 'bay leaves', 'tej pata', 'tejpata', 'তেজপাতা'],
      'raw-40': ['black pepper', 'gol morich', 'golmorich', 'গোলমরিচ'],
      'raw-41': ['panch phoron', 'panchforon', 'পাঁচফোড়ন', 'পাঁচফোড়ন'],
      'raw-42': ['mustard oil', 'shorisha tel', 'shorishar tel', 'সরিষার তেল'],
      'raw-43': ['cucumber', 'shosa', 'sosa', 'khira', 'শসা', 'সালাদ']
    };

    // Check direct names first (longer names first to avoid 'লবণ' matching before 'বিট লবণ')
    const sortedRawItems = [...rawItems].sort((a, b) => {
      const lenA = (a.nameBn?.length || 0) + a.name.length;
      const lenB = (b.nameBn?.length || 0) + b.name.length;
      return lenB - lenA;
    });

    for (const item of sortedRawItems) {
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
    // Try to extract quantity from desc (e.g. "CHICKEN 10 KG" or "EGG 100 PCS" or "EGG 2 CASE")
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
      const isCaseItem = (matchedItem.unit || '').toLowerCase().trim() === 'case';
      if (isCaseItem && matchedItem.packSize && matchedItem.packSize > 1) {
        qtyToAdd = Math.round((parsedPcs / matchedItem.packSize) * 100) / 100;
      } else {
        qtyToAdd = parsedPcs;
      }
    }
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

  // Check wastage percentage (e.g. Chicken 30% wastage -> net 70% in inventory, 30% in wastage log)
  const wastagePct = Number(matchedItem.wastagePercentage) || 0;
  let netQtyToAdd = qtyToAdd;
  let wastageQty = 0;

  if (wastagePct > 0 && wastagePct < 100) {
    wastageQty = Math.round((qtyToAdd * (wastagePct / 100)) * 1000) / 1000;
    netQtyToAdd = Math.round((qtyToAdd - wastageQty) * 1000) / 1000;
  }

  const prevStock = matchedItem.currentStock;
  const newStock = Math.round((prevStock + netQtyToAdd) * 100) / 100;
  const today = input.date || new Date().toISOString().split('T')[0];

  // Update item
  const updatedItems = rawItems.map(item => {
    if (item.id === matchedItem!.id) {
      const calculatedUnitCost = input.amount > 0 && netQtyToAdd > 0
        ? Math.round(input.amount / netQtyToAdd)
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

  // Prepare logs
  const newLogs: RawStockLog[] = [];

  // 1. RESTOCK Log for Net Stock added
  newLogs.push({
    id: `log-exp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    itemId: matchedItem.id,
    itemName: `${matchedItem.name} (${matchedItem.nameBn})`,
    type: 'RESTOCK',
    quantity: netQtyToAdd,
    unit: matchedItem.unit,
    previousStock: prevStock,
    newStock: newStock,
    cost: input.amount,
    date: today,
    notes: wastagePct > 0 
      ? `[AUTO RESTOCK] Purchased: ${qtyToAdd} ${matchedItem.unit} (Wastage ${wastagePct}% deducted: -${wastageQty} ${matchedItem.unit}, Net: +${netQtyToAdd} ${matchedItem.unit})`
      : `[AUTO RESTOCK - EXPENDITURE] ${input.desc} (৳${input.amount})`,
    recordedBy: 'Expenditure (Auto)'
  });

  // 2. WASTAGE Log if item has wastage percentage
  if (wastageQty > 0) {
    newLogs.push({
      id: `log-waste-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      itemId: matchedItem.id,
      itemName: `${matchedItem.name} (${matchedItem.nameBn})`,
      type: 'WASTAGE',
      quantity: wastageQty,
      unit: matchedItem.unit,
      previousStock: Math.round((prevStock + qtyToAdd) * 100) / 100,
      newStock: newStock,
      cost: input.amount > 0 ? Math.round((input.amount * (wastagePct / 100)) * 10) / 10 : 0,
      date: today,
      notes: `[AUTO WASTAGE] ${wastagePct}% processing loss from ${qtyToAdd} ${matchedItem.unit} purchased (${input.desc})`,
      recordedBy: 'Auto Wastage Calculation'
    });
  }

  try {
    let existingLogs: RawStockLog[] = [];
    const storedLogs = localStorage.getItem(RAW_LOGS_STORAGE_KEY);
    if (storedLogs) {
      existingLogs = JSON.parse(storedLogs);
    }
    const mergedLogs = [...newLogs, ...existingLogs].slice(0, 500);
    localStorage.setItem(RAW_LOGS_STORAGE_KEY, JSON.stringify(mergedLogs));
    window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
    window.dispatchEvent(new Event('canteen_raw_stock_logs_updated'));
    window.dispatchEvent(new Event('canteen_state_updated'));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.warn('Failed to append raw restock log:', e);
  }

  return {
    success: true,
    restockedItem: matchedItem,
    quantity: netQtyToAdd,
    message: wastagePct > 0
      ? `${matchedItem.name}: ${qtyToAdd} ${matchedItem.unit} purchased (${wastagePct}% wastage: -${wastageQty} ${matchedItem.unit}, net +${netQtyToAdd} ${matchedItem.unit} added to stock)`
      : `${matchedItem.name} (+${netQtyToAdd} ${matchedItem.unit}) auto restocked from expenditure!`
  };
};

interface RawStockRestorationResult {
  success: boolean;
  restored: Array<{
    rawItemId: string;
    rawItemName: string;
    qtyRestored: number;
    unit: string;
    previousStock: number;
    newStock: number;
  }>;
}

/**
 * Restores raw material stock when a POS Sale transaction is removed/cancelled from Sales History
 */
const restoreRawStockForSaleCancellation = (
  soldItems: Array<{ menuItemId?: string; menuItemName?: string; name?: string; qty?: number; quantity?: number }>,
  txInfo?: { id?: string | number; memberName?: string; date?: string }
): RawStockRestorationResult => {
  const rawItems = getRawInventoryItems();
  const rawItemsMap = new Map<string, RawInventoryItem>();
  rawItems.forEach(item => {
    rawItemsMap.set(item.id, { ...item });
    rawItemsMap.set(item.name.toLowerCase().trim(), item);
  });

  const restorationsMap = new Map<string, { item: RawInventoryItem; totalToRestore: number }>();

  for (const sold of soldItems) {
    const soldQty = Number(sold.qty ?? sold.quantity ?? 0);
    if (soldQty <= 0) continue;

    // Find recipe
    const itemName = sold.menuItemName || sold.name || '';
    const recipe = getRecipeForMenuItem(sold.menuItemId || '', itemName);

    if (!recipe || recipe.length === 0) {
      continue;
    }

    for (const ing of recipe) {
      let rawItem = rawItemsMap.get(ing.rawItemId);
      if (!rawItem && ing.rawItemName) {
        rawItem = rawItems.find(r => r.name.toLowerCase() === ing.rawItemName.toLowerCase());
      }

      if (rawItem) {
        const ratio = getIngredientToInventoryRatio(rawItem, ing.unit);
        const amount = (ing.quantity / ratio) * soldQty;

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

  const today = new Date().toISOString().split('T')[0];
  const newLogs: RawStockLog[] = [];
  const restoredSummary: RawStockRestorationResult['restored'] = [];

  const updatedItems = rawItems.map(item => {
    const entry = restorationsMap.get(item.id);
    if (!entry) return item;

    const restoreQty = Math.round(entry.totalToRestore * 10000) / 10000;
    const prevStock = item.currentStock;
    const newStock = Math.round((prevStock + restoreQty) * 10000) / 10000;

    restoredSummary.push({
      rawItemId: item.id,
      rawItemName: item.name,
      qtyRestored: restoreQty,
      unit: item.unit,
      previousStock: prevStock,
      newStock
    });

    const memberDesc = txInfo?.memberName ? ` [${txInfo.memberName}]` : '';
    newLogs.push({
      id: `log-restore-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      itemId: item.id,
      itemName: item.name,
      type: 'RESTOCK',
      quantity: restoreQty,
      unit: item.unit,
      previousStock: prevStock,
      newStock,
      cost: Math.round(restoreQty * item.unitCost),
      date: today,
      notes: `[RESTOCK - SALE CANCELLED] POS Sale cancelled${memberDesc}. Returned: ${soldItems.map(s => `${s.menuItemName} x${s.qty}`).join(', ')}`,
      recordedBy: 'POS Sale Cancellation'
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
    window.dispatchEvent(new Event('canteen_raw_stock_logs_updated'));
    window.dispatchEvent(new Event('canteen_state_updated'));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.warn('Failed to append raw stock restoration logs:', e);
  }

  return {
    success: true,
    restored: restoredSummary
  };
};

/**
 * Calculates the effective unit cost of a raw inventory item accounting for wastage percentage.
 * Example: Purchased 1 kg at 230 tk with 30% wastage -> 700 gm usable for 230 tk -> Effective rate = 230 / (1 - 0.3) = 328.57 tk/kg.
 */
const getEffectiveRawUnitCost = (item: RawInventoryItem): number => {
  const baseCost = Number(item.unitCost) || 0;
  const wastage = Number(item.wastagePercentage) || 0;
  if (wastage > 0 && wastage < 100) {
    return Math.round((baseCost / (1 - wastage / 100)) * 100) / 100;
  }
  return baseCost;
};

interface MenuItemCostBreakdown {
  rawItemId: string;
  rawItemName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  effectiveUnitCost: number;
  wastagePercentage: number;
  lineCost: number;
}

interface MenuItemCostResult {
  totalCost: number;
  breakdown: MenuItemCostBreakdown[];
}

/**
 * Computes total production cost of a menu item recipe with wastage adjustments.
 */
const calculateMenuItemCost = (
  ingredients: RecipeIngredient[],
  customRawItems?: RawInventoryItem[]
): MenuItemCostResult => {
  const rawItems = customRawItems && customRawItems.length > 0 ? customRawItems : getRawInventoryItems();
  const rawMap = new Map<string, RawInventoryItem>();
  rawItems.forEach(r => {
    rawMap.set(r.id, r);
    rawMap.set(r.name.toLowerCase().trim(), r);
  });

  const breakdown: MenuItemCostBreakdown[] = [];
  let totalCost = 0;

  for (const ing of ingredients) {
    const raw = rawMap.get(ing.rawItemId) || rawMap.get(ing.rawItemName.toLowerCase().trim());
    const baseCost = raw ? (Number(raw.unitCost) || 0) : 0;
    const wastage = raw ? (Number(raw.wastagePercentage) || 0) : 0;
    const effectiveCost = raw ? getEffectiveRawUnitCost(raw) : baseCost;
    const qty = Number(ing.quantity) || 0;

    let effectiveUnitPrice = effectiveCost;
    let lineCost = 0;

    // Calculate effective unit price based on sub-unit / pack conversion
    if (raw) {
      const ratio = getIngredientToInventoryRatio(raw, ing.unit);
      effectiveUnitPrice = effectiveCost / ratio;
    }

    lineCost = Math.round(qty * effectiveUnitPrice * 100) / 100;

    totalCost += lineCost;
    breakdown.push({
      rawItemId: ing.rawItemId,
      rawItemName: ing.rawItemName || (raw ? raw.name : 'Unknown Raw Item'),
      quantity: qty,
      unit: ing.unit || (raw ? raw.unit : 'pcs'),
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

/**
 * Generates formatted raw item string from recipe ingredients in real-time.
 * e.g. "লেবু (1 pcs), সাদা চিনি (25 gm), Black Salt (1 gm)"
 */
const formatRecipeRawItemsString = (
  recipe: RecipeIngredient[], 
  rawItemsList: RawInventoryItem[]
): string => {
  if (!recipe || recipe.length === 0) return '';
  return recipe
    .map(ing => {
      const raw = rawItemsList.find(r => r.id === ing.rawItemId) || 
                  rawItemsList.find(r => (r.name || '').toLowerCase() === (ing.rawItemName || '').toLowerCase());
      
      let name = '';
      if (raw) {
        if (raw.nameBn && raw.nameBn.trim()) {
          // If nameBn contains English in parens e.g. "কাঁচা লেবু (Lemon)", strip the trailing parens
          const cleanBn = raw.nameBn.replace(/\s*\([a-zA-Z\s\/\-_0-9]+\)\s*$/, '').trim();
          name = cleanBn || raw.nameBn.trim();
        } else {
          name = raw.name || ing.rawItemName || '';
        }
      } else {
        name = ing.rawItemName || '';
      }

      const qty = (ing.quantity !== '' && ing.quantity !== undefined && !isNaN(Number(ing.quantity)))
        ? Number(ing.quantity) 
        : (ing.quantity ?? 0);
      const unit = ing.unit || (raw ? raw.unit : '') || '';

      if (!name) return '';
      return `${name} (${qty} ${unit})`.trim();
    })
    .filter(Boolean)
    .join(', ');
};

