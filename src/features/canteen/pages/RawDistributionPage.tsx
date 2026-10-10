import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChefHat,
  Search,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  CheckCircle2,
  RefreshCw,
  Printer,
  Copy,
  Users,
  UtensilsCrossed,
  Package,
  Calculator,
  Check,
  Sparkles,
  Info,
  Layers,
  ArrowUpDown,
  CheckSquare,
  Square,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { getCanteenMenuCache, fetchCanteenMenuOnce, updateSingleMenuItemInCache, CanteenMenuItem } from '../utils/canteenMenuData';
import {
  getRawInventoryItems,
  RawInventoryItem,
  getMenuRecipes,
  saveMenuRecipes,
  getRecipeForMenuItem,
  MenuRecipeMap,
  RecipeIngredient,
  getRawItemSubUnitInfo,
  getIngredientToInventoryRatio,
  getEffectiveRawUnitCost,
  formatRecipeRawItemsString
} from '../utils/recipeManager';
import { resolveImageUrl } from '../utils/canteenSettings';
import { playCelebrationSound } from '../utils/audioFeedback';
import { pushKeyToCloud, pullKeyFromCloud } from '../utils/canteenCloudSync';
import { saveMenuItemBanglaName, getMenuItemBanglaName } from '../utils/menuBanglaNames';

export interface Recipe20PaxIngredient {
  rawItemId: string;
  rawItemName: string;
  quantityFor20: number; // Exact quantity for 20 portions
  unit: string;
}

export type Recipe20PaxMap = Record<string, Recipe20PaxIngredient[]>;

export const RECIPES_20PAX_STORAGE_KEY = 'canteen_menu_recipes_20pax_v1';

/**
 * Converts 1-person recipe ingredients to a 20-person recipe (20x quantity)
 * and normalizes units (e.g. 1000+ gm -> kg, 1000+ ml -> liter).
 */
export const convert1PaxTo20Pax = (ingredients1Pax: RecipeIngredient[]): Recipe20PaxIngredient[] => {
  if (!Array.isArray(ingredients1Pax)) return [];

  return ingredients1Pax.map((ing) => {
    const rawQty = Number(ing.quantity || 0) * 20;
    let qty20 = Math.round(rawQty * 1000) / 1000;
    let unit = (ing.unit || 'pcs').trim();
    const unitLower = unit.toLowerCase();

    // Clean unit normalization
    if (['gm', 'g', 'gram', 'গ্রাম'].includes(unitLower)) {
      if (qty20 >= 1000) {
        qty20 = Math.round((qty20 / 1000) * 100) / 100;
        unit = 'kg';
      } else {
        unit = 'gm';
      }
    } else if (['ml', 'milli', 'মিলি'].includes(unitLower)) {
      if (qty20 >= 1000) {
        qty20 = Math.round((qty20 / 1000) * 100) / 100;
        unit = 'liter';
      } else {
        unit = 'ml';
      }
    }

    return {
      rawItemId: ing.rawItemId,
      rawItemName: ing.rawItemName,
      quantityFor20: qty20,
      unit
    };
  });
};

/**
 * Generates the full 20-pax recipe mapping from all existing 1-pax menu recipes.
 */
export const buildAll20PaxFrom1Pax = (): Recipe20PaxMap => {
  const onePaxMap = getMenuRecipes();
  const result: Recipe20PaxMap = {};

  Object.entries(onePaxMap).forEach(([dishKey, ingredients]) => {
    if (Array.isArray(ingredients) && ingredients.length > 0) {
      result[dishKey.trim().toUpperCase()] = convert1PaxTo20Pax(ingredients);
    }
  });

  return result;
};

/**
 * Helper: load 20-pax recipes from local storage or initialize from 20x 1-pax recipes.
 */
export const get20PaxRecipes = (): Recipe20PaxMap => {
  const baseFrom1Pax = buildAll20PaxFrom1Pax();

  try {
    const raw = localStorage.getItem(RECIPES_20PAX_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        // Merge so all 1-pax recipes are automatically covered
        return { ...baseFrom1Pax, ...parsed };
      }
    }
  } catch (e) {
    console.warn('Error reading 20-pax recipes:', e);
  }

  return baseFrom1Pax;
};

/**
 * Calculates real-time ready cost per portion for a menu item directly from 20-pax recipe specifications.
 */
export const calculateMenuPortionCostFrom20Pax = (
  menu: { id?: string; name?: string; cost?: number; Cost?: number },
  recipes20PaxMap?: Recipe20PaxMap,
  rawItemsList?: RawInventoryItem[]
): number => {
  const map = recipes20PaxMap || get20PaxRecipes();
  const rawList = rawItemsList || getRawInventoryItems();
  const rawItemMap = new Map<string, RawInventoryItem>();
  rawList.forEach((r) => rawItemMap.set(r.id, r));

  const cleanName = (menu.name || '').trim().toUpperCase();
  const key = menu.name ? menu.name.trim().toUpperCase() : (menu.id || '');
  let ingredients = map[key] || (menu.id ? map[menu.id] : undefined);
  if (!ingredients || ingredients.length === 0) {
    for (const [k, ingList] of Object.entries(map)) {
      if (cleanName && (cleanName.includes(k) || k.includes(cleanName))) {
        ingredients = ingList;
        break;
      }
    }
  }

  if (Array.isArray(ingredients) && ingredients.length > 0) {
    let total20 = 0;
    ingredients.forEach((ing) => {
      const raw = rawItemMap.get(ing.rawItemId);
      if (raw) {
        const ratio = getIngredientToInventoryRatio(raw, ing.unit);
        const effectiveCost = getEffectiveRawUnitCost(raw);
        const effectiveUnitPrice = ratio > 0 ? (effectiveCost / ratio) : effectiveCost;
        total20 += (Number(ing.quantityFor20) || 0) * effectiveUnitPrice;
      }
    });
    if (total20 > 0) {
      return Math.round((total20 / 20) * 100) / 100;
    }
  }

  return Number(menu.Cost ?? menu.cost ?? 0);
};

/**
 * Helper: save 20-pax recipes locally, notify listeners, and sync to cloud.
 */
export const save20PaxRecipes = async (recipes: Recipe20PaxMap): Promise<void> => {
  try {
    localStorage.setItem(RECIPES_20PAX_STORAGE_KEY, JSON.stringify(recipes));
    window.dispatchEvent(new CustomEvent('canteen_recipes_20pax_updated', { detail: recipes }));
    window.dispatchEvent(new Event('storage'));

    // Instant cloud persistence to Supabase app_settings (0ms delay)
    pushKeyToCloud(RECIPES_20PAX_STORAGE_KEY, recipes).catch((err) =>
      console.warn('Supabase app_settings save note for 20-pax recipes:', err)
    );

    // Also auto-sync 1-person recipes into canteen_menu_recipes_v3 for POS deduction & other views
    try {
      const current1Pax = getMenuRecipes();
      const updated1Pax: MenuRecipeMap = { ...current1Pax };
      Object.entries(recipes).forEach(([menuKey, ingredients]) => {
        if (Array.isArray(ingredients)) {
          updated1Pax[menuKey] = ingredients.map((ing) => {
            let q1 = ing.quantityFor20 / 20;
            let u1 = ing.unit;
            if (u1.toLowerCase() === 'kg' && q1 < 0.2) {
              q1 = Math.round(q1 * 1000);
              u1 = 'gm';
            }
            return {
              rawItemId: ing.rawItemId,
              rawItemName: ing.rawItemName,
              quantity: Math.round(q1 * 1000) / 1000,
              unit: u1
            };
          });
        }
      });
      saveMenuRecipes(updated1Pax);
      pushKeyToCloud('canteen_menu_recipes_v3', updated1Pax).catch(() => {});
      window.dispatchEvent(new Event('canteen_menu_recipes_updated'));
    } catch (e) {
      console.warn('Auto sync 1-pax recipe error:', e);
    }
  } catch (e) {
    console.warn('Error saving 20-pax recipes:', e);
  }
};

export const RawDistributionPage: React.FC = () => {
  const [menuItems, setMenuItems] = useState<CanteenMenuItem[]>(() => getCanteenMenuCache());
  const [rawItems, setRawItems] = useState<RawInventoryItem[]>(() => getRawInventoryItems());
  const [recipes20Pax, setRecipes20Pax] = useState<Recipe20PaxMap>(() => get20PaxRecipes());

  // View Layout: 'TABLE' or 'CARDS'
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIGURED' | 'PENDING'>('ALL');

  // Recipe Editor Modal State
  const [activeEditingMenu, setActiveEditingMenu] = useState<CanteenMenuItem | null>(null);
  const [editingDishName, setEditingDishName] = useState<string>('');
  const [editingDishNameBn, setEditingDishNameBn] = useState<string>('');
  const [editingIngredients, setEditingIngredients] = useState<Recipe20PaxIngredient[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Raw Item Multi-Select Picker Modal State (Styled like POS Sales Member Select)
  const [isRawPickerOpen, setIsRawPickerOpen] = useState(false);
  const [rawPickerSearch, setRawPickerSearch] = useState('');
  const [rawPickerCategory, setRawPickerCategory] = useState<string>('ALL');
  const [selectedRawIds, setSelectedRawIds] = useState<Set<string>>(new Set());

  // Menu Multi-Select Picker Modal State (For selecting multiple dishes into view/formula)
  const [isMenuPickerOpen, setIsMenuPickerOpen] = useState(false);
  const [menuPickerSearch, setMenuPickerSearch] = useState('');
  const [menuPickerCategory, setMenuPickerCategory] = useState<string>('ALL');
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<string>>(new Set());

  // Scaler / Batch Calculator Modal State
  const [scalerMenu, setScalerMenu] = useState<CanteenMenuItem | null>(null);
  const [scalerPaxCount, setScalerPaxCount] = useState<number>(20);
  const [copiedMarketList, setCopiedMarketList] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Dynamic Total Meal formulation scale state
  const [totalMeals, setTotalMeals] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('canteen_recipe_formulation_meal_count');
      return saved ? Math.max(1, parseInt(saved, 10) || 20) : 20;
    } catch {
      return 20;
    }
  });

  const handleUpdateTotalMeals = (count: number) => {
    const valid = Math.max(1, isNaN(count) ? 20 : count);
    setTotalMeals(valid);
    try {
      localStorage.setItem('canteen_recipe_formulation_meal_count', String(valid));
    } catch {}
  };

  useEffect(() => {
    fetchCanteenMenuOnce().then((items) => {
      if (items && items.length > 0) setMenuItems(items);
    });

    // Cloud pull for 20-pax recipes using proper setting_key
    pullKeyFromCloud(RECIPES_20PAX_STORAGE_KEY)
      .then((cloudData) => {
        if (cloudData && typeof cloudData === 'object') {
          const merged = { ...buildAll20PaxFrom1Pax(), ...cloudData };
          setRecipes20Pax(merged);
          localStorage.setItem(RECIPES_20PAX_STORAGE_KEY, JSON.stringify(merged));
        }
      })
      .catch(() => {});

    const handleMenuUpdate = (e: any) => {
      if (e?.detail) setMenuItems(e.detail);
      else setMenuItems(getCanteenMenuCache());
    };
    const handleRawUpdate = () => {
      setRawItems(getRawInventoryItems());
    };
    const handleRecipes20Update = (e?: any) => {
      if (e?.detail && typeof e.detail === 'object') {
        setRecipes20Pax(e.detail);
      } else {
        setRecipes20Pax(get20PaxRecipes());
      }
    };

    window.addEventListener('canteen_menu_updated', handleMenuUpdate);
    window.addEventListener('canteen_raw_inventory_updated', handleRawUpdate);
    window.addEventListener('canteen_recipes_20pax_updated', handleRecipes20Update);
    window.addEventListener('canteen_menu_recipes_updated', handleRecipes20Update);
    window.addEventListener('storage', handleRawUpdate);

    return () => {
      window.removeEventListener('canteen_menu_updated', handleMenuUpdate);
      window.removeEventListener('canteen_raw_inventory_updated', handleRawUpdate);
      window.removeEventListener('canteen_recipes_20pax_updated', handleRecipes20Update);
      window.removeEventListener('canteen_menu_recipes_updated', handleRecipes20Update);
      window.removeEventListener('storage', handleRawUpdate);
    };
  }, []);

  // Map of raw items by ID for instant O(1) lookups
  const rawItemMap = useMemo(() => {
    const map = new Map<string, RawInventoryItem>();
    rawItems.forEach((r) => map.set(r.id, r));
    return map;
  }, [rawItems]);

  // Categories list for Menu
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((m) => {
      if (m.category) set.add(m.category.toUpperCase().trim());
    });
    return ['ALL', ...Array.from(set)];
  }, [menuItems]);

  // Raw Item Categories for Picker Modal
  const rawCategories = useMemo(() => {
    const set = new Set<string>();
    rawItems.forEach((r) => {
      if (r.category) set.add(r.category.toUpperCase().trim());
    });
    return ['ALL', ...Array.from(set)];
  }, [rawItems]);

  // Key generator for menu items
  const getRecipeKey = (menu: CanteenMenuItem): string => {
    return menu.name ? menu.name.trim().toUpperCase() : menu.id;
  };

  // Get or resolve 20-pax ingredients for a menu item
  const getIngredientsForMenu = (menu: CanteenMenuItem): Recipe20PaxIngredient[] => {
    const key = getRecipeKey(menu);
    if (recipes20Pax[key] && recipes20Pax[key].length > 0) {
      return recipes20Pax[key];
    }
    if (recipes20Pax[menu.id] && recipes20Pax[menu.id].length > 0) {
      return recipes20Pax[menu.id];
    }
    const cleanName = (menu.name || '').trim().toUpperCase();
    for (const [k, ingList] of Object.entries(recipes20Pax)) {
      if (cleanName.includes(k) || k.includes(cleanName)) {
        return ingList as Recipe20PaxIngredient[];
      }
    }

    // Auto fallback: Check if 1-person recipe exists and multiply 20x
    const onePax = getRecipeForMenuItem(menu.id, menu.name);
    if (onePax && onePax.length > 0) {
      return convert1PaxTo20Pax(onePax);
    }

    return [];
  };

  // Calculate Ready Cost for a single ingredient row using exact Menu Ingredient unit ratio
  const calculateIngredientRowCost = (ing: Recipe20PaxIngredient): { unitCost: number; rowCost: number; currentUnit: string; unitOptions: string[] } => {
    const raw = rawItemMap.get(ing.rawItemId);
    if (!raw) {
      return { unitCost: 0, rowCost: 0, currentUnit: ing.unit || 'pcs', unitOptions: [ing.unit || 'pcs'] };
    }

    const subInfo = getRawItemSubUnitInfo(raw);
    const unitOptions: string[] = [];
    if (subInfo && subInfo.hasSubUnit && subInfo.subUnit) {
      unitOptions.push(subInfo.subUnit);
    }
    if (raw.unit && !unitOptions.includes(raw.unit)) {
      unitOptions.push(raw.unit);
    }
    if (unitOptions.length === 0) {
      unitOptions.push(ing.unit || 'pcs');
    }

    const currentUnit = (unitOptions.some((u) => u.toLowerCase() === (ing.unit || '').toLowerCase()))
      ? ing.unit
      : (subInfo && subInfo.hasSubUnit && subInfo.subUnit ? subInfo.subUnit : (raw.unit || 'pcs'));

    const ratio = getIngredientToInventoryRatio(raw, currentUnit);
    const effectiveCost = getEffectiveRawUnitCost(raw);
    const effectiveUnitPrice = ratio > 0 ? (effectiveCost / ratio) : effectiveCost;
    const qty = Number(ing.quantityFor20) || 0;
    const rowCost = Math.round(qty * effectiveUnitPrice * 100) / 100;

    return {
      unitCost: Math.round(effectiveCost * 100) / 100,
      rowCost,
      currentUnit,
      unitOptions
    };
  };

  // Calculate Total Ready Cost for 20 persons
  const calculateCostFor20 = (ingredients: Recipe20PaxIngredient[]): number => {
    let total = 0;
    ingredients.forEach((ing) => {
      const { rowCost } = calculateIngredientRowCost(ing);
      total += rowCost;
    });
    return Math.round(total * 100) / 100;
  };

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((m) => {
      if (selectedCategory !== 'ALL' && m.category?.toUpperCase().trim() !== selectedCategory) {
        return false;
      }
      const ings = getIngredientsForMenu(m);
      const isConfigured = ings.length > 0;
      if (statusFilter === 'CONFIGURED' && !isConfigured) return false;
      if (statusFilter === 'PENDING' && isConfigured) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const nameEn = (m.name || m.name_en || '').toLowerCase();
      const nameBn = (m.name_bn || m.nameBn || '').toLowerCase();
      const cat = (m.category || '').toLowerCase();
      return nameEn.includes(term) || nameBn.includes(term) || cat.includes(term);
    });
  }, [menuItems, selectedCategory, statusFilter, searchTerm, recipes20Pax, rawItemMap]);

  // Overall Statistics
  const stats = useMemo(() => {
    let configuredCount = 0;
    menuItems.forEach((m) => {
      if (getIngredientsForMenu(m).length > 0) configuredCount++;
    });
    return {
      totalMenu: menuItems.length,
      configuredCount,
      pendingCount: menuItems.length - configuredCount,
      totalRawItems: rawItems.length
    };
  }, [menuItems, recipes20Pax, rawItems]);

  // Auto-sync all menu items from 1-pax recipes (20x multiplier)
  const handleAutoSyncAllFrom1Pax = async () => {
    const updatedMap: Recipe20PaxMap = { ...recipes20Pax };
    let syncedCount = 0;

    menuItems.forEach((menu) => {
      const onePax = getRecipeForMenuItem(menu.id, menu.name);
      if (onePax && onePax.length > 0) {
        const ingredients20 = convert1PaxTo20Pax(onePax);
        const key = getRecipeKey(menu);
        updatedMap[key] = ingredients20;
        updatedMap[menu.id] = ingredients20;
        syncedCount++;
      }
    });

    setRecipes20Pax(updatedMap);
    await save20PaxRecipes(updatedMap);
    playCelebrationSound();

    setSyncToast(`Successfully applied 20x formula to ${syncedCount} menu dishes!`);
    setTimeout(() => setSyncToast(null), 4000);
  };

  // Open Recipe Editor Modal
  const handleOpenEditor = (menu: CanteenMenuItem) => {
    setActiveEditingMenu(menu);
    setEditingDishName(menu.name || '');
    setEditingDishNameBn(menu.name_bn || menu.nameBn || getMenuItemBanglaName(menu) || '');
    const existing = getIngredientsForMenu(menu);
    if (existing.length > 0) {
      setEditingIngredients([...existing]);
    } else {
      const onePax = getRecipeForMenuItem(menu.id, menu.name);
      if (onePax && onePax.length > 0) {
        setEditingIngredients(convert1PaxTo20Pax(onePax));
      } else {
        setEditingIngredients([]);
      }
    }
    setSaveSuccessMsg(null);
  };

  // In-place quantity update
  const handleUpdateIngredientQuantity = (index: number, newQty: number) => {
    if (isNaN(newQty) || newQty < 0) return;
    setEditingIngredients((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantityFor20: newQty };
      return updated;
    });
  };

  // Unit Change Handler using Menu Ingredient Subunit rules
  const handleUpdateIngredientUnit = (index: number, newUnit: string) => {
    setEditingIngredients((prev) => {
      const updated = [...prev];
      const target = { ...updated[index] };
      const raw = rawItemMap.get(target.rawItemId);

      // Auto unit scaling if switching between kg and gm
      const oldU = (target.unit || '').toLowerCase().trim();
      const nextU = (newUnit || '').toLowerCase().trim();
      let newQty = target.quantityFor20;

      if (['gm', 'g'].includes(oldU) && ['kg'].includes(nextU)) {
        newQty = Math.round((newQty / 1000) * 100) / 100;
      } else if (['kg'].includes(oldU) && ['gm', 'g'].includes(nextU)) {
        newQty = Math.round(newQty * 1000);
      } else if (['ml'].includes(oldU) && ['liter', 'ltr'].includes(nextU)) {
        newQty = Math.round((newQty / 1000) * 100) / 100;
      } else if (['liter', 'ltr'].includes(oldU) && ['ml'].includes(nextU)) {
        newQty = Math.round(newQty * 1000);
      }

      target.unit = newUnit;
      target.quantityFor20 = newQty;
      updated[index] = target;
      return updated;
    });
  };

  // Remove ingredient row
  const handleRemoveIngredient = (index: number) => {
    setEditingIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  // Save Recipe Formula & Dish Specifications
  const handleSaveRecipe = async () => {
    if (!activeEditingMenu) return;

    const oldName = (activeEditingMenu.name || '').trim().toUpperCase();
    const cleanNewName = (editingDishName || '').trim();
    const newNameUpper = cleanNewName.toUpperCase();
    const cleanNewNameBn = (editingDishNameBn || '').trim();

    // 1. Calculate updated recipe cost and formatted raw items string for the menu item
    const rawList = rawItems.length > 0 ? rawItems : getRawInventoryItems();
    const costFor20 = calculateCostFor20(editingIngredients);
    const portionCost = Math.round((costFor20 / 20) * 100) / 100;
    const onePaxIngs = editingIngredients.map((ing) => {
      let q1 = ing.quantityFor20 / 20;
      let u1 = ing.unit;
      if (u1.toLowerCase() === 'kg' && q1 < 0.2) {
        q1 = Math.round(q1 * 1000);
        u1 = 'gm';
      }
      return {
        rawItemId: ing.rawItemId,
        rawItemName: ing.rawItemName,
        quantity: Math.round(q1 * 1000) / 1000,
        unit: u1
      };
    });
    const rawItemValue = formatRecipeRawItemsString(onePaxIngs, rawList);

    // 2. Build updated 20-pax recipe map, migrating keys if name changed
    const updatedMap: Recipe20PaxMap = { ...recipes20Pax };
    if (oldName && newNameUpper && oldName !== newNameUpper) {
      delete updatedMap[oldName];
    }
    const finalKey = newNameUpper || getRecipeKey(activeEditingMenu);
    updatedMap[finalKey] = editingIngredients;
    updatedMap[activeEditingMenu.id] = editingIngredients;

    setRecipes20Pax(updatedMap);
    await save20PaxRecipes(updatedMap);

    // 3. If dish name or Bengali name changed, update Bengali dictionary & 1-pax recipe
    if (cleanNewNameBn) {
      saveMenuItemBanglaName(
        { id: activeEditingMenu.id, name: cleanNewName || activeEditingMenu.name },
        cleanNewNameBn
      );
    }

    // 4. Update menu item in local state and cache immediately (0ms delay!)
    const finalDishName = cleanNewName || activeEditingMenu.name;
    const updatedMenuItem: CanteenMenuItem = {
      ...activeEditingMenu,
      name: finalDishName,
      name_en: finalDishName,
      name_bn: cleanNewNameBn || activeEditingMenu.name_bn,
      nameBn: cleanNewNameBn || activeEditingMenu.nameBn,
      Cost: portionCost,
      cost: portionCost,
      rawItem: rawItemValue,
      'Raw Item': rawItemValue,
      updated_at: new Date().toISOString()
    };

    setMenuItems((prev) => prev.map((m) => (m.id === activeEditingMenu.id ? updatedMenuItem : m)));
    updateSingleMenuItemInCache(updatedMenuItem);

    // 5. Update Supabase Canteen_Menu table immediately
    const updatePayload: any = {
      Cost: portionCost,
      'Raw Item': rawItemValue,
      updated_at: new Date().toISOString()
    };
    if (cleanNewName) updatePayload.name = cleanNewName;
    if (cleanNewNameBn) updatePayload.name_bn = cleanNewNameBn;

    Promise.resolve(
      supabase
        .from('Canteen_Menu')
        .update(updatePayload)
        .eq('id', activeEditingMenu.id)
    ).then(({ error }: any) => {
      if (error) console.warn('Supabase menu update warning:', error);
    }).catch((err) => console.warn('Supabase menu update warning:', err));

    playCelebrationSound();
    setSaveSuccessMsg('Recipe formulation saved successfully.');
    setTimeout(() => {
      setActiveEditingMenu(null);
    }, 400);
  };

  // Filtered raw items for the Multi-Select Picker Modal
  const filteredRawItems = useMemo(() => {
    return rawItems.filter((item) => {
      if (rawPickerCategory !== 'ALL' && item.category?.toUpperCase().trim() !== rawPickerCategory) {
        return false;
      }
      if (!rawPickerSearch.trim()) return true;
      const term = rawPickerSearch.toLowerCase().trim();
      const nEn = (item.name || '').toLowerCase();
      const nBn = (item.nameBn || '').toLowerCase();
      const c = (item.category || '').toLowerCase();
      return nEn.includes(term) || nBn.includes(term) || c.includes(term);
    });
  }, [rawItems, rawPickerCategory, rawPickerSearch]);

  // Open Raw Material Multi-Select Picker
  const handleOpenRawPicker = () => {
    const currentIds = new Set(editingIngredients.map((i) => i.rawItemId));
    setSelectedRawIds(currentIds);
    setRawPickerSearch('');
    setRawPickerCategory('ALL');
    setIsRawPickerOpen(true);
  };

  // Toggle selection in Raw Picker
  const handleToggleRawSelect = (id: string) => {
    setSelectedRawIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all filtered in Raw Picker
  const handleSelectAllFilteredRaw = () => {
    setSelectedRawIds((prev) => {
      const next = new Set(prev);
      filteredRawItems.forEach((r) => next.add(r.id));
      return next;
    });
  };

  // Clear selection in Raw Picker
  const handleClearRawSelection = () => {
    setSelectedRawIds(new Set());
  };

  // Confirm selection from Raw Picker: Add newly selected items at the TOP of Formula table
  const handleConfirmRawSelection = () => {
    const existingMap = new Map(editingIngredients.map((i) => [i.rawItemId, i]));
    const newItems: Recipe20PaxIngredient[] = [];
    const retainedItems: Recipe20PaxIngredient[] = [];

    // Keep existing items that remain selected
    editingIngredients.forEach((ing) => {
      if (selectedRawIds.has(ing.rawItemId)) {
        retainedItems.push(ing);
      }
    });

    // Newly added items (prepend at the TOP as requested)
    selectedRawIds.forEach((id) => {
      if (!existingMap.has(id)) {
        const raw = rawItemMap.get(id);
        if (raw) {
          const subInfo = getRawItemSubUnitInfo(raw);
          const initialUnit = subInfo.hasSubUnit && subInfo.subUnit ? subInfo.subUnit : (raw.unit || 'pcs');
          const defaultQty = ['gm', 'g', 'ml'].includes(initialUnit.toLowerCase()) ? 100 : 1;

          newItems.push({
            rawItemId: raw.id,
            rawItemName: raw.name,
            quantityFor20: defaultQty,
            unit: initialUnit
          });
        }
      }
    });

    // New items at the top of the Formula table!
    setEditingIngredients([...newItems, ...retainedItems]);
    setIsRawPickerOpen(false);
  };

  // Filtered menu items for the Menu Picker Modal
  const filteredPickerMenuItems = useMemo(() => {
    return menuItems.filter((m) => {
      if (menuPickerCategory !== 'ALL' && m.category?.toUpperCase().trim() !== menuPickerCategory) {
        return false;
      }
      if (!menuPickerSearch.trim()) return true;
      const term = menuPickerSearch.toLowerCase().trim();
      const n = (m.name || '').toLowerCase();
      const nb = (m.name_bn || m.nameBn || '').toLowerCase();
      return n.includes(term) || nb.includes(term);
    });
  }, [menuItems, menuPickerCategory, menuPickerSearch]);

  // Open Menu Picker
  const handleOpenMenuPicker = () => {
    setSelectedMenuIds(new Set());
    setMenuPickerSearch('');
    setMenuPickerCategory('ALL');
    setIsMenuPickerOpen(true);
  };

  // Confirm Menu Picker: If 1 is picked, open editor for it; if multiple, filter down to them
  const handleConfirmMenuPicker = () => {
    if (selectedMenuIds.size === 1) {
      const id = Array.from(selectedMenuIds)[0];
      const m = menuItems.find((it) => it.id === id);
      if (m) handleOpenEditor(m);
    }
    setIsMenuPickerOpen(false);
  };

  // Open Scaler Modal
  const handleOpenScaler = (menu: CanteenMenuItem) => {
    setScalerMenu(menu);
    setScalerPaxCount(20);
    setCopiedMarketList(false);
  };

  // Scaled calculations for Scaler Modal
  const scaledIngredients = useMemo(() => {
    if (!scalerMenu) return [];
    const baseIngredients = getIngredientsForMenu(scalerMenu);
    const ratio = scalerPaxCount / 20;

    return baseIngredients.map((ing) => {
      const rawQty = ing.quantityFor20 * ratio;
      const scaledQty = Math.round(rawQty * 100) / 100;
      const raw = rawItemMap.get(ing.rawItemId);
      const subInfo = raw ? getRawItemSubUnitInfo(raw) : null;
      const currentUnit = ing.unit || (subInfo?.subUnit) || raw?.unit || 'pcs';
      const unitRatio = raw ? getIngredientToInventoryRatio(raw, currentUnit) : 1;
      const effectiveCost = raw ? getEffectiveRawUnitCost(raw) : 0;
      const effectiveUnitPrice = unitRatio > 0 ? (effectiveCost / unitRatio) : effectiveCost;
      const totalCost = Math.round(scaledQty * effectiveUnitPrice);

      return {
        ...ing,
        scaledQty,
        totalCost,
        unit: currentUnit
      };
    });
  }, [scalerMenu, scalerPaxCount, recipes20Pax, rawItemMap]);

  const totalScaledCost = useMemo(() => {
    return scaledIngredients.reduce((sum, item) => sum + item.totalCost, 0);
  }, [scaledIngredients]);

  // Copy Scaled Requisition text
  const handleCopyMarketList = () => {
    if (!scalerMenu) return;
    const lines = [
      `📋 *Kitchen Production Requisition*`,
      `🏢 CAFE UAV (155 UASU BAF)`,
      `🍲 *Menu Dish:* ${scalerMenu.name}`,
      `👥 *Batch Size:* ${scalerPaxCount} Persons`,
      `📅 *Date:* ${new Date().toLocaleDateString('en-GB')}`,
      `----------------------------------------`,
      `*Required Raw Materials:*`,
      ...scaledIngredients.map(
        (it, idx) => `${idx + 1}. ${it.rawItemName} : *${it.scaledQty} ${it.unit}*`
      ),
      `----------------------------------------`,
      `💰 *Estimated Ready Cost:* ৳${totalScaledCost.toLocaleString()}`,
      `👤 *Ready Cost per Meal:* ৳${Math.round(totalScaledCost / (scalerPaxCount || 1))}`,
      `\n_Prepared by: Canteen Management_`
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedMarketList(true);
    setTimeout(() => setCopiedMarketList(false), 3000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans text-slate-100">
      {/* Toast Notification */}
      <AnimatePresence>
        {syncToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[250] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 text-xs font-bold"
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>{syncToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner / Header (Clean, Professional English) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-400 text-[11px] font-bold uppercase tracking-wider">
              <ChefHat className="w-3.5 h-3.5" />
              <span>Production Matrix • Standard Batch Size: {totalMeals} Meals</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center space-x-3">
              <span>Recipe Formulation</span>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {totalMeals} Meals Standard
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Standardized raw material requirements to cook {totalMeals} meals per dish. Automatically calculates true kitchen production ready costs.
            </p>
          </div>

          {/* Dynamic Total Meal Scaler Controller */}
          <div className="bg-slate-950/90 border border-indigo-500/30 rounded-2xl p-2 sm:p-2.5 flex items-center gap-3 shadow-lg shadow-indigo-950/40 self-stretch sm:self-auto">
            <div className="flex items-center space-x-2 pl-1.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black shrink-0">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block leading-tight">
                  Total Meal
                </span>
                <span className="text-[10px] font-mono font-bold text-indigo-300">
                  মোট মিল সংখ্যা
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1">
              <button
                type="button"
                onClick={() => handleUpdateTotalMeals(totalMeals - (totalMeals > 20 ? 10 : 5))}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-black transition-colors cursor-pointer select-none active:scale-95"
                title="Decrease Meal Count"
              >
                -
              </button>

              <div className="relative flex items-center">
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={totalMeals}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    handleUpdateTotalMeals(val);
                  }}
                  className="w-16 sm:w-20 bg-slate-950 border border-slate-700 text-white font-mono font-black text-center text-sm sm:text-base py-1 px-1 rounded-lg focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[11px] font-bold text-slate-400 ml-1.5 mr-1 hidden sm:inline">
                  Meals
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleUpdateTotalMeals(totalMeals + (totalMeals >= 20 ? 10 : 5))}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-black transition-colors cursor-pointer select-none active:scale-95"
                title="Increase Meal Count"
              >
                +
              </button>
            </div>

            {/* Quick preset buttons */}
            <div className="hidden md:flex items-center space-x-1">
              {[10, 20, 50, 100].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => handleUpdateTotalMeals(cnt)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    totalMeals === cnt
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Menu Items</p>
              <p className="text-lg font-black font-mono text-white">{stats.totalMenu}</p>
            </div>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Formulated</p>
              <p className="text-lg font-black font-mono text-emerald-400">{stats.configuredCount}</p>
            </div>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Raw Catalog</p>
              <p className="text-lg font-black font-mono text-amber-300">{stats.totalRawItems} Items</p>
            </div>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Batch Standard</p>
              <p className="text-lg font-black font-mono text-purple-300">{totalMeals} Meals</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and View Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-md">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search dishes by name (e.g. Chicken Curry, Khichuri, Rice, Tea)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-medium"
            />
          </div>

          {/* Status Tabs & View Mode Switcher */}
          <div className="flex items-center space-x-2 self-end sm:self-auto">
            {/* Status Tabs */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 shrink-0">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({menuItems.length})
              </button>
              <button
                onClick={() => setStatusFilter('CONFIGURED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  statusFilter === 'CONFIGURED'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Set ({stats.configuredCount})
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  statusFilter === 'PENDING'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pending ({stats.pendingCount})
              </button>
            </div>

            {/* View Mode Toggle: Table or Cards */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 shrink-0">
              <button
                onClick={() => setViewMode('TABLE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold tracking-wider transition-all cursor-pointer ${
                  viewMode === 'TABLE' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="Table View"
              >
                Table View
              </button>
              <button
                onClick={() => setViewMode('CARDS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold tracking-wider transition-all cursor-pointer ${
                  viewMode === 'CARDS' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="Card Grid View"
              >
                Cards View
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white bg-slate-950 border border-slate-800'
              }`}
            >
              {cat === 'ALL' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: TABLE VIEW OR CARDS VIEW */}
      {filteredMenuItems.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <UtensilsCrossed className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-slate-400 font-bold text-sm">No matching menu dishes found.</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('ALL');
              setStatusFilter('ALL');
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'TABLE' ? (
        /* ======================================================== */
        /* MASTER TABLE VIEW (Ser No as 1st Column, Clean English)  */
        /* ======================================================== */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[10px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3.5 text-center w-16">Ser No</th>
                  <th className="px-4 py-3.5">Menu Dish</th>
                  <th className="px-3 py-3.5">Category</th>
                  <th className="px-3 py-3.5 text-center">Ingredients ({totalMeals} Meals)</th>
                  <th className="px-4 py-3.5 text-right">Ready Cost ({totalMeals} Meals)</th>
                  <th className="px-4 py-3.5 text-right">Cost / Meal</th>
                  <th className="px-4 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-medium">
                {filteredMenuItems.map((menu, idx) => {
                  const ingredients = getIngredientsForMenu(menu);
                  const isConfigured = ingredients.length > 0;
                  const costFor20 = calculateCostFor20(ingredients);
                  const portionCost = Math.round((costFor20 / 20) * 100) / 100;
                  const scaledCost = Math.round(((costFor20 / 20) * totalMeals) * 100) / 100;
                  const menuImg = resolveImageUrl(menu.DP || menu.img || menu.image);

                  return (
                    <tr key={menu.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Column 1: Ser No */}
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Column 2: Dish Name & Thumb */}
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                            {menuImg ? (
                              <img
                                src={menuImg}
                                alt={menu.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <UtensilsCrossed className="w-4 h-4 text-indigo-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-white text-xs">{menu.name}</p>
                            {menu.name_bn && (
                              <p className="text-[10px] text-slate-400">{menu.name_bn}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Category */}
                      <td className="px-3 py-3">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/60 inline-block">
                          {menu.category || 'MENU'}
                        </span>
                      </td>

                      {/* Column 4: Ingredients Preview */}
                      <td className="px-3 py-3 text-center">
                        {isConfigured ? (
                          <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-bold">
                            <span>{ingredients.length} items</span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Column 5: Ready Cost for Total Meals */}
                      <td className="px-4 py-3 text-right font-mono font-black text-sm text-emerald-400">
                        {isConfigured ? `৳ ${scaledCost.toLocaleString()}` : '—'}
                      </td>

                      {/* Column 6: Ready Cost Per Meal */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-xs text-slate-300">
                        {isConfigured ? `৳ ${portionCost.toFixed(2)}` : '—'}
                      </td>

                      {/* Column 7: Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            onClick={() => handleOpenEditor(menu)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-1 transition-all cursor-pointer shadow-sm active:scale-95"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>{isConfigured ? 'Edit Formula' : 'Set Formula'}</span>
                          </button>

                          <button
                            onClick={() => handleOpenScaler(menu)}
                            disabled={!isConfigured}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700"
                            title="Batch Scaler & Requisition"
                          >
                            <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ======================================================== */
        /* CARDS GRID VIEW                                          */
        /* ======================================================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMenuItems.map((menu) => {
            const ingredients = getIngredientsForMenu(menu);
            const isConfigured = ingredients.length > 0;
            const costFor20 = calculateCostFor20(ingredients);
            const portionCost = Math.round((costFor20 / 20) * 100) / 100;
            const scaledCost = Math.round(((costFor20 / 20) * totalMeals) * 100) / 100;
            const menuImg = resolveImageUrl(menu.DP || menu.img || menu.image);

            return (
              <div
                key={menu.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-lg transition-all flex flex-col justify-between group"
              >
                {/* Top Info */}
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                        {menuImg ? (
                          <img
                            src={menuImg}
                            alt={menu.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <UtensilsCrossed className="w-5 h-5 text-indigo-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/60 inline-block mb-1">
                          {menu.category || 'MENU'}
                        </span>
                        <h3 className="text-sm font-bold text-white truncate leading-snug">
                          {menu.name}
                        </h3>
                        {menu.name_bn && (
                          <p className="text-[11px] text-slate-400 truncate">
                            {menu.name_bn}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider shrink-0 border ${
                        isConfigured
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {isConfigured ? `${ingredients.length} Items` : 'Pending'}
                    </span>
                  </div>

                  {/* Ready Cost Box */}
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Ready Cost ({totalMeals} Meals)
                      </p>
                      <p className="text-lg font-black font-mono text-emerald-400">
                        {isConfigured ? `৳ ${scaledCost.toLocaleString()}` : '—'}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Per Meal
                      </p>
                      <p className="text-xs font-mono font-bold text-slate-300">
                        {isConfigured ? `৳ ${portionCost.toFixed(2)}` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Raw Ingredients Preview */}
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Formula Specifications ({totalMeals} Meals):
                    </p>

                    {isConfigured ? (
                      <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-2.5 max-h-32 overflow-y-auto space-y-1 text-xs">
                        {ingredients.slice(0, 4).map((ing, idx) => {
                          const scaledQty = Math.round(((ing.quantityFor20 / 20) * totalMeals) * 1000) / 1000;
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-slate-300 py-0.5"
                            >
                              <span className="truncate pr-2 font-medium">
                                • {ing.rawItemName}
                              </span>
                              <span className="font-mono font-bold text-emerald-400 shrink-0">
                                {scaledQty} {ing.unit}
                              </span>
                            </div>
                          );
                        })}
                        {ingredients.length > 4 && (
                          <p className="text-[10px] font-bold text-indigo-400 text-center pt-1">
                            + {ingredients.length - 4} more raw materials
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl p-3 text-center text-xs text-slate-500">
                        No recipe specifications set yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 mt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleOpenEditor(menu)}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{isConfigured ? 'Edit Formula' : 'Set Formula'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenScaler(menu)}
                    disabled={!isConfigured}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                    title="Calculate batch requisition for any number of persons"
                  >
                    <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Batch Scaler</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. RECIPE EDITOR MODAL (NO SIDE BOXES! CLEAN TABLE)      */}
      {/* ======================================================== */}
      <AnimatePresence>
        {activeEditingMenu && (
          <div
            onClick={() => setActiveEditingMenu(null)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-3 sm:p-4"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Recipe Specification (20 Pax)
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs text-indigo-300 font-bold">Dish:</span>
                      <input
                        type="text"
                        value={editingDishName}
                        onChange={(e) => setEditingDishName(e.target.value)}
                        placeholder="Item Name (English)"
                        className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white font-bold focus:outline-none focus:border-indigo-500 w-36 sm:w-48"
                        title="Edit Dish Name in English"
                      />
                      <input
                        type="text"
                        value={editingDishNameBn}
                        onChange={(e) => setEditingDishNameBn(e.target.value)}
                        placeholder="বাংলা নাম"
                        className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-emerald-400 font-bold focus:outline-none focus:border-indigo-500 w-32 sm:w-40"
                        title="Edit Dish Name in Bangla"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveEditingMenu(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Success Notification */}
              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-950/80 border-b border-emerald-500/30 text-emerald-200 text-xs font-bold flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
                {/* 20-Pax Spec Note */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-400">
                  <div className="flex items-center space-x-2.5">
                    <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>
                      Standardized production formula for <strong>20 meals</strong>. Ready cost calculates dynamically from current inventory unit prices.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const onePax = getRecipeForMenuItem(activeEditingMenu.id, activeEditingMenu.name);
                      if (onePax && onePax.length > 0) {
                        setEditingIngredients(convert1PaxTo20Pax(onePax));
                      }
                    }}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 shrink-0 cursor-pointer flex items-center space-x-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Reload 20x from Menu</span>
                  </button>
                </div>

                {/* Formula Header & Clean Add Button (NO SIDE BOXES!) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
                      Formula Ingredients ({editingIngredients.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Click below to select and add raw ingredients directly into this formula.
                    </p>
                  </div>

                  {/* Clean Add Button without any horizontal side-boxes! */}
                  <button
                    type="button"
                    onClick={handleOpenRawPicker}
                    className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/25 active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add Raw Materials</span>
                  </button>
                </div>

                {/* Ingredients List Table: 1st column is Ser No! Unit system identical to Menu Ingredients */}
                {editingIngredients.length === 0 ? (
                  <div className="p-10 bg-slate-950 rounded-2xl border border-dashed border-slate-800 text-center space-y-3">
                    <Package className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400 font-bold">No raw materials in this formula yet.</p>
                    <button
                      type="button"
                      onClick={handleOpenRawPicker}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      + Add Raw Materials
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-inner">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 text-[10px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-800">
                        <tr>
                          {/* 1st Column: Ser No */}
                          <th className="px-3 py-3 text-center w-14">Ser No</th>
                          <th className="px-4 py-3">Raw Material</th>
                          <th className="px-3 py-3 text-center">Qty (20 Pax)</th>
                          <th className="px-3 py-3 text-center">Unit</th>
                          <th className="px-3 py-3 text-right">Unit Rate</th>
                          <th className="px-3 py-3 text-right">Ready Cost</th>
                          <th className="px-3 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {editingIngredients.map((ing, idx) => {
                          const { unitCost, rowCost, currentUnit, unitOptions } = calculateIngredientRowCost(ing);

                          return (
                            <tr key={`${ing.rawItemId}_${idx}`} className="hover:bg-slate-900/50 transition-colors">
                              {/* 1st Column: Ser No */}
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-400">
                                {idx + 1}
                              </td>

                              {/* 2nd Column: Raw Item Name */}
                              <td className="px-4 py-2.5 font-bold text-white">
                                {ing.rawItemName}
                              </td>

                              {/* 3rd Column: Qty (for 20 Pax) */}
                              <td className="px-3 py-2.5 text-center">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={ing.quantityFor20}
                                  onChange={(e) =>
                                    handleUpdateIngredientQuantity(idx, parseFloat(e.target.value) || 0)
                                  }
                                  className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-mono font-bold text-emerald-400 focus:outline-none focus:border-indigo-500"
                                />
                              </td>

                              {/* 4th Column: Unit (Identical system to Menu Ingredient!) */}
                              <td className="px-3 py-2.5 text-center">
                                {unitOptions.length <= 1 ? (
                                  <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-indigo-300">
                                    {currentUnit}
                                  </span>
                                ) : (
                                  <select
                                    value={currentUnit}
                                    onChange={(e) => handleUpdateIngredientUnit(idx, e.target.value)}
                                    className="bg-slate-900 border border-indigo-500/40 text-xs font-mono font-bold text-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                  >
                                    {unitOptions.map((u) => (
                                      <option key={u} value={u} className="bg-slate-900 text-white font-mono">
                                        {u}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>

                              {/* 5th Column: Unit Rate */}
                              <td className="px-3 py-2.5 text-right font-mono text-slate-400">
                                ৳{unitCost}
                              </td>

                              {/* 6th Column: Ready Cost */}
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-400">
                                ৳{rowCost.toLocaleString()}
                              </td>

                              {/* 7th Column: Action (Delete) */}
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveIngredient(idx)}
                                  className="p-1 text-slate-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                  title="Remove ingredient"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Ready Cost Financial Summary (STRICTLY READY COST ONLY - NO SALES PRICE / NO MARGIN) */}
                {editingIngredients.length > 0 && (
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 grid grid-cols-2 gap-3 text-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Total Ready Cost (20 Pax)
                      </p>
                      <p className="text-xl font-black font-mono text-emerald-400">
                        ৳ {calculateCostFor20(editingIngredients).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Ready Cost Per Meal
                      </p>
                      <p className="text-xl font-black font-mono text-indigo-300">
                        ৳ {(Math.round((calculateCostFor20(editingIngredients) / 20) * 100) / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveEditingMenu(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveRecipe}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/30 flex items-center space-x-2 cursor-pointer transition-all active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Specification</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 2. RAW MATERIAL MULTI-SELECT PICKER MODAL                */}
      {/* (STYLED EXACTLY LIKE POS SALES MEMBER SELECTION)         */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isRawPickerOpen && (
          <div
            onClick={() => setIsRawPickerOpen(false)}
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[200] flex items-center justify-center p-3 sm:p-4"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      Select Raw Materials
                    </h3>
                    <p className="text-xs text-slate-400">
                      Choose materials to add into the formula table
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono">
                    {selectedRawIds.size} Selected
                  </span>
                  <button
                    onClick={() => setIsRawPickerOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Search & Category Filter (POS Sales Style) */}
              <div className="p-4 bg-slate-950/80 border-b border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={rawPickerSearch}
                      onChange={(e) => setRawPickerSearch(e.target.value)}
                      placeholder="Search raw items by name (e.g. Chicken, Onion, Oil, Spices)..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    {rawPickerSearch && (
                      <button
                        onClick={() => setRawPickerSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold p-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Bulk Select Buttons */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAllFilteredRaw}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 border border-slate-700 transition-all cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Select All ({filteredRawItems.length})</span>
                    </button>
                    {selectedRawIds.size > 0 && (
                      <button
                        type="button"
                        onClick={handleClearRawSelection}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-rose-300 text-xs font-bold flex items-center space-x-1.5 border border-slate-700 transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  {rawCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setRawPickerCategory(cat)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all shrink-0 cursor-pointer ${
                        rawPickerCategory === cat
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {cat === 'ALL' ? 'All Items' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Grid (Multi-Select Cards) */}
              <div className="p-4 overflow-y-auto space-y-2 flex-1 max-h-[55vh]">
                {filteredRawItems.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-950/60 rounded-2xl border border-dashed border-slate-800">
                    No matching raw materials found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {filteredRawItems.map((item) => {
                      const isSelected = selectedRawIds.has(item.id);
                      const subInfo = getRawItemSubUnitInfo(item);
                      const displayUnit = subInfo.hasSubUnit && subInfo.subUnit ? subInfo.subUnit : item.unit;

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleToggleRawSelect(item.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between ${
                            isSelected
                              ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-900/20'
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs font-bold text-white truncate">{item.name}</p>
                            {item.nameBn && item.nameBn !== item.name && (
                              <p className="text-[10px] text-slate-400 truncate">{item.nameBn}</p>
                            )}
                            <div className="flex items-center space-x-1.5 mt-1">
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                ৳{item.unitCost}/{item.unit}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase">
                                {item.category || 'RAW'}
                              </span>
                            </div>
                          </div>

                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'border-slate-700 bg-slate-900 text-transparent'
                          }`}>
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsRawPickerOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmRawSelection}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Add Selected ({selectedRawIds.size}) to Formula</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 3. MENU MULTI-SELECT PICKER MODAL                        */}
      {/* (STYLED EXACTLY LIKE POS SALES MEMBER SELECTION)         */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isMenuPickerOpen && (
          <div
            onClick={() => setIsMenuPickerOpen(false)}
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[200] flex items-center justify-center p-3 sm:p-4"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <UtensilsCrossed className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      Select Menu Dishes
                    </h3>
                    <p className="text-xs text-slate-400">
                      Choose menu items to formulate or inspect
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-xs font-bold font-mono">
                    {selectedMenuIds.size} Selected
                  </span>
                  <button
                    onClick={() => setIsMenuPickerOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Search & Category Filter */}
              <div className="p-4 bg-slate-950/80 border-b border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={menuPickerSearch}
                      onChange={(e) => setMenuPickerSearch(e.target.value)}
                      placeholder="Search menu dishes..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    {menuPickerSearch && (
                      <button
                        onClick={() => setMenuPickerSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold p-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Bulk Select Buttons */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const all = new Set(filteredPickerMenuItems.map((m) => m.id));
                        setSelectedMenuIds(all);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 border border-slate-700 transition-all cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Select All ({filteredPickerMenuItems.length})</span>
                    </button>
                    {selectedMenuIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedMenuIds(new Set())}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-rose-300 text-xs font-bold flex items-center space-x-1.5 border border-slate-700 transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Category Pills */}
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setMenuPickerCategory(cat)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all shrink-0 cursor-pointer ${
                        menuPickerCategory === cat
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {cat === 'ALL' ? 'All Dishes' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid of Dishes */}
              <div className="p-4 overflow-y-auto space-y-2 flex-1 max-h-[55vh]">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {filteredPickerMenuItems.map((menu) => {
                    const isSelected = selectedMenuIds.has(menu.id);
                    const ings = getIngredientsForMenu(menu);

                    return (
                      <div
                        key={menu.id}
                        onClick={() => {
                          setSelectedMenuIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(menu.id)) next.delete(menu.id);
                            else next.add(menu.id);
                            return next;
                          });
                        }}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-900/20'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-xs font-bold text-white truncate">{menu.name}</p>
                          <div className="flex items-center space-x-1.5 mt-1">
                            <span className="text-[10px] font-mono text-emerald-400 font-bold">
                              {ings.length > 0 ? `${ings.length} raw items` : 'Not configured'}
                            </span>
                          </div>
                        </div>

                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'border-slate-700 bg-slate-900 text-transparent'
                        }`}>
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsMenuPickerOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmMenuPicker}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Done</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 4. BATCH SCALER / REQUISITION MODAL                      */}
      {/* ======================================================== */}
      <AnimatePresence>
        {scalerMenu && (
          <div
            onClick={() => setScalerMenu(null)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-3 sm:p-4"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Batch Scaler & Requisition
                    </h2>
                    <p className="text-xs text-slate-400">
                      Dish: <span className="font-bold text-white">{scalerMenu.name}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setScalerMenu(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
                {/* Person Count Slider */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase text-slate-300 tracking-wider">
                      Target Batch Size (Meals)
                    </label>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-2xl font-black font-mono text-emerald-400">
                        {scalerPaxCount}
                      </span>
                      <span className="text-xs font-bold text-slate-400">Persons</span>
                    </div>
                  </div>

                  {/* Slider */}
                  <input
                    type="range"
                    min="5"
                    max="300"
                    step="5"
                    value={scalerPaxCount}
                    onChange={(e) => setScalerPaxCount(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />

                  {/* Quick Select Buttons */}
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    {[10, 20, 30, 50, 75, 100, 150, 200, 300].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setScalerPaxCount(num)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                          scalerPaxCount === num
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {num} Pax
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scaled Ingredients Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
                      Requisition Requirements ({scalerPaxCount} Pax)
                    </h4>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      Estimated Ready Cost: ৳ {totalScaledCost.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 text-[10px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="px-3 py-2.5 text-center w-14">Ser No</th>
                          <th className="px-3 py-2.5">Raw Material</th>
                          <th className="px-3 py-2.5 text-center">20-Pax Spec</th>
                          <th className="px-3 py-2.5 text-center font-bold text-emerald-400">
                            Required ({scalerPaxCount} Pax)
                          </th>
                          <th className="px-4 py-2.5 text-right">Ready Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 font-medium">
                        {scaledIngredients.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="px-3 py-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="px-3 py-2 font-bold text-white">{it.rawItemName}</td>
                            <td className="px-3 py-2 text-center text-slate-400 font-mono">
                              {it.quantityFor20} {it.unit}
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-black text-emerald-400 text-sm">
                              {it.scaledQty} {it.unit}
                            </td>
                            <td className="px-4 py-2 text-right font-mono font-bold text-slate-300">
                              ৳ {it.totalCost.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setScalerMenu(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Close
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCopyMarketList}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    {copiedMarketList ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Requisition</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Requisition</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
