import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Plus, Edit2, Trash2, PackagePlus, AlertTriangle, 
  CheckCircle2, RotateCcw, Layers, ArrowDownRight, ArrowUpRight, 
  History, Filter, ShoppingBag, X, Save, AlertCircle, FileSpreadsheet,
  Boxes, ChefHat, Sparkles, Percent, LayoutGrid, List,
  Upload, Image as ImageIcon, Camera, Loader2
} from 'lucide-react';
import { processGalleryImage } from '../utils/imageUpload';
import { formatMoney, formatNumber } from '../i18n';
import { supabase } from '../../../supabase';
import { 
  RawInventoryItem, 
  RawStockLog, 
  InventoryItemType,
  RAW_ITEMS_STORAGE_KEY, 
  RAW_LOGS_STORAGE_KEY,
  getRawInventoryItems,
  saveRawInventoryItems,
  deduplicateRawItems,
  getEffectiveRawUnitCost,
  getRawItemSubUnitInfo,
  getRecipeForMenuItem,
  isReadymadeItem,
  cleanPureBanglaName,
  markRawItemAsDeleted,
  unmarkRawItemAsDeleted,
  DELETED_RAW_ITEMS_STORAGE_KEY
} from '../utils/recipeManager';
import { queuePushKeyToCloud } from '../utils/canteenCloudSync';
import { SaveButton } from '../components/SaveButton';
import { formatCanteenDate } from '../utils/dateUtils';
import { getCanteenConfig, getItemDisplayName, CanteenConfig } from '../utils/canteenSettings';
import { ImportStockModal } from '../components/ImportStockModal';

export type { RawInventoryItem, RawStockLog, InventoryItemType };

const INITIAL_RAW_ITEMS: RawInventoryItem[] = [
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
    notes: 'Fresh broiler chicken for daily dishes',
    wastagePercentage: 30,
    hasSubUnits: true,
    packSize: 1000,
    subUnit: 'gm'
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
    notes: 'Premium Miniket rice 50kg sacks',
    hasSubUnits: true,
    packSize: 1000,
    subUnit: 'gm'
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
    notes: 'Red split lentils',
    hasSubUnits: true,
    packSize: 1000,
    subUnit: 'gm'
  },
  {
    id: 'raw-4',
    name: 'Milk Powder',
    nameBn: 'গুঁড়া দুধ',
    category: 'Dairy & Beverages',
    unit: 'kg',
    currentStock: 18,
    minStockAlert: 6,
    unitCost: 880,
    lastRestockedDate: '2026-09-17',
    supplier: 'City Super Store',
    notes: 'For canteen milk tea and coffee preparation',
    hasSubUnits: true,
    packSize: 1000,
    subUnit: 'gm'
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
    notes: '১ প্যাকেটে ১০০ টি টি-ব্যাগ থাকে (1 packet = 100 pcs)',
    packSize: 100,
    subUnit: 'pcs',
    hasSubUnits: true
  },
  {
    id: 'raw-6',
    name: 'Noodles',
    nameBn: 'কাঁচা নুডলস',
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
    nameBn: 'কাঁচা পাস্তা',
    category: 'Dry Food & Snacks',
    unit: 'kg',
    currentStock: 22,
    minStockAlert: 8,
    unitCost: 145,
    lastRestockedDate: '2026-09-15',
    supplier: 'City Grocery',
    notes: 'Evening snacks pasta preparation',
    hasSubUnits: true,
    packSize: 1000,
    subUnit: 'gm'
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
    notes: 'For tea, coffee and desserts',
    hasSubUnits: true,
    packSize: 1000,
    subUnit: 'gm'
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
    notes: 'Daily kitchen staple',
    hasSubUnits: true,
    packSize: 1000,
    subUnit: 'gm'
  },
  {
    id: 'raw-15',
    name: 'Halim Mix',
    nameBn: 'হালিম মিক্স মসলা ও ডাল',
    category: 'Oil & Spices',
    unit: 'packet',
    currentStock: 30,
    minStockAlert: 10,
    unitCost: 65,
    lastRestockedDate: '2026-09-21',
    supplier: 'Radhuni / Pran',
    notes: 'Halim mix pulses & spices packet for special halim'
  },
  {
    id: 'raw-16',
    name: 'LPG',
    nameBn: 'এলপিজি গ্যাস',
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
    nameBn: 'টমেটো সস',
    category: 'Oil & Spices',
    unit: 'bottle',
    currentStock: 25,
    minStockAlert: 8,
    unitCost: 110,
    lastRestockedDate: '2026-09-21',
    supplier: 'Pran / Ahmed',
    notes: 'Tomato sauce / ketchup for shawarma, snacks & fast food'
  },
  {
    id: 'raw-18',
    name: 'Maggi Masala',
    nameBn: 'ম্যাগি মসলা',
    category: 'Oil & Spices',
    unit: 'packet',
    currentStock: 120,
    minStockAlert: 30,
    unitCost: 8,
    lastRestockedDate: '2026-09-21',
    supplier: 'Nestle Wholesale',
    notes: 'Maggi taste-maker seasoning sachets'
  },
  {
    id: 'raw-19',
    name: 'Green Chili',
    nameBn: 'কাঁচা মরিচ',
    category: 'Vegetables',
    unit: 'kg',
    currentStock: 15,
    minStockAlert: 5,
    unitCost: 180,
    wastagePercentage: 10,
    lastRestockedDate: '2026-09-22',
    supplier: 'Local Bazar',
    notes: 'Fresh green chili for omelet, noodles & snacks',
    hasSubUnits: true,
    packSize: 1000,
    subUnit: 'gm'
  },
  {
    id: 'raw-20',
    name: 'Coffee',
    nameBn: 'কফি পাউডার',
    category: 'Dairy & Beverages',
    unit: 'packet',
    currentStock: 40,
    minStockAlert: 12,
    unitCost: 320,
    lastRestockedDate: '2026-09-20',
    supplier: 'City Super Store',
    notes: 'Nescafe instant coffee powder for milk & cold coffee'
  },
  {
    id: 'raw-21',
    name: 'Dry Cake',
    nameBn: 'ড্রাই কেক',
    category: 'Dry Food & Snacks',
    unit: 'packet',
    currentStock: 60,
    minStockAlert: 20,
    unitCost: 12,
    lastRestockedDate: '2026-09-21',
    supplier: 'Olympic / Dan Cake',
    notes: 'Crispy dry cake for counter sales'
  },
  {
    id: 'raw-22',
    name: 'Swarma Bread',
    nameBn: 'শার্মা ব্রেড / রুটি',
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
    nameBn: 'বাটার বন',
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
    nameBn: 'স্যান্ডউইচ ব্রেড',
    category: 'Dry Food & Snacks',
    unit: 'packet',
    currentStock: 45,
    minStockAlert: 15,
    unitCost: 45,
    lastRestockedDate: '2026-09-21',
    supplier: 'City Bakery',
    notes: '১ প্যাকেটে ১২ স্লাইস থাকে (1 loaf = 12 slices)',
    packSize: 12,
    subUnit: 'slice',
    hasSubUnits: true
  },
  {
    id: 'raw-25',
    name: 'Burger Bun',
    nameBn: 'বার্গার বান',
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
    nameBn: 'হোটেল পরোটা',
    category: 'Frozen Foods',
    unit: 'pcs',
    currentStock: 120,
    minStockAlert: 40,
    unitCost: 8,
    lastRestockedDate: '2026-09-22',
    supplier: 'Hotel Paratha Supply',
    notes: 'Handmade flaky paratha for breakfast & snacks'
  },
  {
    id: 'raw-27',
    name: 'Salt',
    nameBn: 'খাবার লবণ',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 50,
    minStockAlert: 15,
    unitCost: 40,
    lastRestockedDate: '2026-09-18',
    supplier: 'Molla / ACI Salt',
    notes: 'Iodized cooking salt for all kitchen dishes',
    hasSubUnits: true,
    packSize: 1000,
    subUnit: 'gm'
  },
  {
    id: 'raw-28',
    name: 'Lemon',
    nameBn: 'কাঁচা লেবু',
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
    nameBn: 'রসুন',
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
    nameBn: 'আদা',
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
    nameBn: 'হলুদ গুঁড়া',
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
    nameBn: 'মরিচের গুঁড়া',
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
    nameBn: 'ধনে গুঁড়া',
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
    nameBn: 'জিরা গুঁড়া ও গোটা জিরা',
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
    nameBn: 'গরম মসলা গুঁড়া',
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
    nameBn: 'সবুজ এলাচ',
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
    nameBn: 'দারুচিনি',
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
    nameBn: 'লবঙ্গ',
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
    nameBn: 'তেজপাতা',
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
    nameBn: 'গোলমরিচ',
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
    nameBn: 'পাঁচফোড়ন',
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
    nameBn: 'সরিষার তেল',
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
    nameBn: 'শসা',
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
    nameBn: 'বিট লবণ',
    category: 'Oil & Spices',
    subCategory: 'Kg - gm',
    unit: 'kg',
    currentStock: 8,
    minStockAlert: 2,
    unitCost: 120,
    lastRestockedDate: '2026-09-22',
    supplier: 'Local Spices Market',
    notes: 'চটপটি, ফুচকা, হালিম, সালাদ ও লেবু শরবতের বিশেষ বিট লবণ',
    packSize: 1000,
    subUnit: 'gm',
    hasSubUnits: true
  }
];

const INITIAL_RAW_STOCK_LOGS: RawStockLog[] = [
  {
    id: 'log-seed-chicken-restock-1',
    itemId: 'raw-1',
    itemName: 'Chicken (ব্রয়লার মুরগির মাংস)',
    type: 'RESTOCK',
    quantity: 0.7,
    unit: 'kg',
    previousStock: 35,
    newStock: 35.7,
    cost: 230,
    date: '22 Sep 26, 12:40 PM',
    notes: 'Purchased 1 kg (30% Wastage deducted: -0.3 kg, Net stock: +0.7 kg)',
    recordedBy: 'Canteen Expenditure'
  },
  {
    id: 'log-seed-chicken-waste-1',
    itemId: 'raw-1',
    itemName: 'Chicken (ব্রয়লার মুরগির মাংস)',
    type: 'WASTAGE',
    quantity: 0.3,
    unit: 'kg',
    previousStock: 36,
    newStock: 35.7,
    cost: 69,
    date: '22 Sep 26, 12:40 PM',
    notes: '30% processing loss from 1 kg purchased (Wastage Log)',
    recordedBy: 'Auto Wastage Calculation'
  }
];

const STORAGE_KEY = 'canteen_raw_inventory_items_v2';
const LOGS_STORAGE_KEY = 'canteen_raw_stock_logs_v2';

// Helper to encode metadata safely into notes so Supabase schema cache doesn't reject with 'column not found'
const encodeNotesWithMeta = (notes?: string, meta?: any) => {
  let base = (notes || '').replace(/<!--META:[\s\S]*?-->/g, '').trim();
  if (meta && Object.keys(meta).length > 0) {
    base = base ? `${base} <!--META:${JSON.stringify(meta)}-->` : `<!--META:${JSON.stringify(meta)}-->`;
  }
  return base;
};

const decodeNotesMeta = (notes?: string) => {
  if (!notes) return {};
  const match = notes.match(/<!--META:([\s\S]*?)-->/);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch {}
  }
  return {};
};

export const RawInventoryManagement: React.FC<{ readOnly?: boolean }> = ({ readOnly = false }) => {
  const [items, setItems] = useState<RawInventoryItem[]>(() => {
    return getRawInventoryItems();
  });

  const [canteenConfig, setCanteenConfig] = useState<CanteenConfig>(() => getCanteenConfig());

  useEffect(() => {
    const handleCfgUpdate = (e: any) => {
      setCanteenConfig(e.detail || getCanteenConfig());
    };
    window.addEventListener('canteen_settings_updated', handleCfgUpdate);
    window.addEventListener('storage', handleCfgUpdate);
    return () => {
      window.removeEventListener('canteen_settings_updated', handleCfgUpdate);
      window.removeEventListener('storage', handleCfgUpdate);
    };
  }, []);

  const [logs, setLogs] = useState<RawStockLog[]>(() => {
    try {
      const stored = localStorage.getItem(LOGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // If logs are present but don't have wastage log for chicken, merge initial seed
          const hasWastage = parsed.some(l => l.type === 'WASTAGE');
          if (!hasWastage) {
            return [...parsed, ...INITIAL_RAW_STOCK_LOGS];
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load raw stock logs:', e);
    }
    return INITIAL_RAW_STOCK_LOGS;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState<'ALL' | 'RAW' | 'READY_MADE'>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'LOW' | 'NORMAL'>('ALL');
  const [logFilter, setLogFilter] = useState<'ALL' | 'RESTOCK' | 'ISSUE' | 'WASTAGE'>('ALL');
  const [viewMode, setViewMode] = useState<'BOX' | 'TABLE'>('BOX');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [editingItem, setEditingItem] = useState<RawInventoryItem | null>(null);
  const [editModalTab, setEditModalTab] = useState<'DETAILS' | 'HISTORY'>('DETAILS');

  // Form states
  const [selectedItemId, setSelectedItemId] = useState('');
  const [restockQty, setRestockQty] = useState('');
  const [restockUnitMode, setRestockUnitMode] = useState<'MAIN' | 'SUB'>('MAIN');
  const [restockCost, setRestockCost] = useState('');
  const [restockSupplier, setRestockSupplier] = useState('');
  const [restockNotes, setRestockNotes] = useState('');

  const [issueQty, setIssueQty] = useState('');
  const [issueUnitMode, setIssueUnitMode] = useState<'MAIN' | 'SUB'>('MAIN');
  const [issueType, setIssueType] = useState<'ISSUE' | 'WASTAGE'>('ISSUE');
  const [issueNotes, setIssueNotes] = useState('');
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isSavedItem, setIsSavedItem] = useState(false);
  const [isSavingRestock, setIsSavingRestock] = useState(false);
  const [isSavedRestock, setIsSavedRestock] = useState(false);
  const [isSavingIssue, setIsSavingIssue] = useState(false);
  const [isSavedIssue, setIsSavedIssue] = useState(false);

  // Quick DP Photo Edit modal state
  const [quickDpItem, setQuickDpItem] = useState<RawInventoryItem | null>(null);
  const [quickDpInput, setQuickDpInput] = useState('');
  const [isUpdatingDp, setIsUpdatingDp] = useState(false);
  const [quickDpToast, setQuickDpToast] = useState<string | null>(null);

  // Delete Confirmation Modal state (Replaces blocked window.confirm)
  const [itemToDelete, setItemToDelete] = useState<RawInventoryItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [newItemData, setNewItemData] = useState<{
    name?: string;
    nameBn?: string;
    category?: string;
    subCategory?: string;
    itemType?: InventoryItemType;
    unit?: string;
    currentStock?: number | string;
    minStockAlert?: number | string;
    unitCost?: number | string;
    supplier?: string;
    notes?: string;
    wastagePercentage?: number | string;
    hasSubUnits?: boolean;
    packSize?: number | string;
    subUnit?: string;
    dp?: string;
  }>({
    name: '',
    nameBn: '',
    category: 'Fuel & Utilities',
    subCategory: '',
    itemType: 'RAW',
    unit: 'kg',
    currentStock: 10,
    minStockAlert: 5,
    unitCost: 100,
    supplier: '',
    notes: '',
    wastagePercentage: 0,
    hasSubUnits: true,
    packSize: 1000,
    subUnit: 'gm',
    dp: ''
  });

  // Keep track of serialized state to avoid infinite re-render loops and redundant dispatches
  const lastSavedItemsJsonRef = useRef<string>('');
  const lastSavedLogsJsonRef = useRef<string>('');
  const isSelfDispatchingRef = useRef<boolean>(false);

  // Initialize cached strings
  if (!lastSavedItemsJsonRef.current && items && items.length > 0) {
    lastSavedItemsJsonRef.current = JSON.stringify(items);
  }
  if (!lastSavedLogsJsonRef.current && logs && logs.length > 0) {
    lastSavedLogsJsonRef.current = JSON.stringify(logs);
  }

  // Fetch raw inventory from Supabase Canteen_Inventory table
  useEffect(() => {
    const fetchFromDb = async () => {
      try {
        const { data, error } = await supabase.from('Canteen_Inventory').select('*');
        if (!error && data && data.length > 0) {
          const mapped: RawInventoryItem[] = data.map((r: any) => {
            const meta = decodeNotesMeta(r.notes);
            const cleanNotes = (r.notes || '').replace(/<!--META:[\s\S]*?-->/g, '').trim();
            const unit = r.unit || 'kg';
            const isKg = unit.toLowerCase().trim() === 'kg';
            const isLtr = unit.toLowerCase().trim() === 'liter';
            const rawSubUnit = r['Sub Unit'] ?? r.subUnit ?? r.sub_unit ?? meta.subUnit;
            const itemDp = r.DP || r.dp || meta.dp || r.image || r.image_url || undefined;
            const rawType = meta.itemType || r.itemType || r.item_type;
            const itemType: InventoryItemType = (rawType === 'READY_MADE' || rawType === 'RAW')
              ? rawType
              : (isReadymadeItem({ ...r, notes: cleanNotes }) ? 'READY_MADE' : 'RAW');

            return {
              id: String(r.id),
              name: r.name || '',
              nameBn: cleanPureBanglaName(r.nameBn || r.name_bn || '') || r.name || '',
              category: meta.category || r.category || 'Packaging & Disposables',
              subCategory: meta.subCategory || r.subCategory || r.sub_category || '',
              itemType,
              unit: unit,
              currentStock: Number(r.currentStock ?? r.current_stock ?? 0),
              minStockAlert: Number(r.minStockAlert ?? r.min_stock_alert ?? 5),
              unitCost: Number(r.unitCost ?? r.unit_cost ?? 0),
              wastagePercentage: Number(r.wastagePercentage ?? r.wastage_percentage ?? 0),
              lastRestockedDate: r.lastRestockedDate || r.last_restocked_date || '',
              supplier: r.supplier || '',
              notes: cleanNotes,
              hasSubUnits: isKg ? true : Boolean(meta.hasSubUnits ?? r.hasSubUnits ?? r.has_sub_units ?? Boolean(rawSubUnit) ?? (Number(r.packSize ?? r.pack_size) > 1)),
              packSize: isKg ? (Number(meta.packSize ?? r.packSize ?? r.pack_size) > 1 ? Number(meta.packSize ?? r.packSize ?? r.pack_size) : 1000) : Number(meta.packSize ?? r.packSize ?? r.pack_size ?? 1),
              subUnit: rawSubUnit || (isKg ? 'gm' : (isLtr ? 'ml' : (meta.subUnit || r.subUnit || r.sub_unit || 'pcs'))),
              dp: itemDp,
              DP: itemDp,
              image: itemDp
            };
          });
          setItems(prev => {
            const currentMap = new Map((Array.isArray(prev) ? prev : []).map(p => [p.id, p]));
            const resolvedMapped = mapped.map(m => {
              const current = currentMap.get(m.id);
              if (current && (current.itemType === 'RAW' || current.itemType === 'READY_MADE')) {
                return {
                  ...m,
                  itemType: current.itemType
                };
              }
              return m;
            });
            const combined = [...(Array.isArray(prev) ? prev : []), ...resolvedMapped];
            const { deduplicated } = deduplicateRawItems(combined);
            const dedupJson = JSON.stringify(deduplicated);
            if (dedupJson === lastSavedItemsJsonRef.current) {
              return prev;
            }
            lastSavedItemsJsonRef.current = dedupJson;
            try {
              localStorage.setItem(STORAGE_KEY, dedupJson);
            } catch {}
            return deduplicated;
          });
        }
      } catch (err) {
        console.warn('Canteen_Inventory DB fetch note:', err);
      }
    };
    fetchFromDb();

    // Realtime listener for Canteen_Inventory with unique channel name
    const channelName = `raw_inventory_realtime_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Canteen_Inventory' }, () => {
        fetchFromDb();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Save changes to localStorage, app_settings Cloud, and Supabase Canteen_Inventory table
  useEffect(() => {
    if (!Array.isArray(items)) return;
    const jsonStr = JSON.stringify(items);
    if (jsonStr === lastSavedItemsJsonRef.current) {
      return;
    }
    lastSavedItemsJsonRef.current = jsonStr;

    try {
      localStorage.setItem(STORAGE_KEY, jsonStr);
      isSelfDispatchingRef.current = true;
      setTimeout(() => {
        try {
          window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
        } finally {
          isSelfDispatchingRef.current = false;
        }
      }, 0);
    } catch (e) {
      console.warn('Failed to save raw items:', e);
    }

    // Push full rich object to app_settings cloud key for complete persistence
    queuePushKeyToCloud('canteen_raw_inventory_items_v2', items);

    if (items.length > 0) {
      const payload = items.map(it => {
        const resolvedType = it.itemType || (isReadymadeItem(it) ? 'READY_MADE' : 'RAW');
        return {
          id: it.id,
          name: it.name,
          nameBn: it.nameBn || '',
          unit: it.unit || 'kg',
          "Sub Unit": it.subUnit || (it.unit?.toLowerCase() === 'kg' ? 'gm' : (it.unit?.toLowerCase() === 'liter' ? 'ml' : (it.unit?.toLowerCase() === 'case' || it.unit?.toLowerCase() === 'packet' ? 'pcs' : null))),
          currentStock: it.currentStock ?? 0,
          minStockAlert: it.minStockAlert ?? 5,
          unitCost: it.unitCost ?? 0,
          wastagePercentage: it.wastagePercentage ?? 0,
          lastRestockedDate: it.lastRestockedDate || '',
          supplier: it.supplier || '',
          DP: it.dp || it.DP || it.image || null,
          itemType: resolvedType,
          notes: encodeNotesWithMeta(it.notes, {
            category: it.category,
            subCategory: it.subCategory,
            hasSubUnits: it.hasSubUnits,
            packSize: it.packSize,
            subUnit: it.subUnit,
            dp: it.dp || it.DP || it.image,
            itemType: resolvedType
          })
        };
      });
      Promise.resolve(supabase.from('Canteen_Inventory').upsert(payload, { onConflict: 'id' }))
        .catch(err => console.warn('Supabase Canteen_Inventory upsert note:', err));
    }
  }, [items]);

  useEffect(() => {
    if (!Array.isArray(logs)) return;
    const jsonStr = JSON.stringify(logs);
    if (jsonStr === lastSavedLogsJsonRef.current) {
      return;
    }
    lastSavedLogsJsonRef.current = jsonStr;

    try {
      localStorage.setItem(LOGS_STORAGE_KEY, jsonStr);
      isSelfDispatchingRef.current = true;
      setTimeout(() => {
        try {
          window.dispatchEvent(new Event('canteen_raw_stock_logs_updated'));
        } finally {
          isSelfDispatchingRef.current = false;
        }
      }, 0);
    } catch (e) {
      console.warn('Failed to save raw stock logs:', e);
    }
  }, [logs]);

  // Real-time synchronization when raw inventory is updated (e.g. from POS sales or other tabs)
  useEffect(() => {
    const handleSync = () => {
      // Ignore if triggered by this component's own save action
      if (isSelfDispatchingRef.current) return;

      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && stored !== lastSavedItemsJsonRef.current) {
          let parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.deduplicated)) {
            parsed = parsed.deduplicated;
          }
          if (Array.isArray(parsed) && parsed.length > 0) {
            lastSavedItemsJsonRef.current = stored;
            setItems(parsed);
          }
        }
      } catch (e) {}

      try {
        const storedLogs = localStorage.getItem(LOGS_STORAGE_KEY);
        if (storedLogs && storedLogs !== lastSavedLogsJsonRef.current) {
          const parsedLogs = JSON.parse(storedLogs);
          if (Array.isArray(parsedLogs)) {
            lastSavedLogsJsonRef.current = storedLogs;
            setLogs(parsedLogs);
          }
        }
      } catch (e) {}
    };

    window.addEventListener('canteen_raw_inventory_updated', handleSync);
    window.addEventListener('canteen_raw_stock_logs_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('canteen_raw_inventory_updated', handleSync);
      window.removeEventListener('canteen_raw_stock_logs_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Statistics calculation
  const stats = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    const totalItems = list.length;
    const totalValue = list.reduce((sum, item) => sum + (item.currentStock * item.unitCost), 0);
    const lowStockItems = list.filter(item => item.currentStock <= item.minStockAlert);
    const outOfStockItems = list.filter(item => item.currentStock <= 0);
    const healthyCount = list.filter(item => item.currentStock > item.minStockAlert).length;
    const healthPercent = totalItems > 0 ? Math.round((healthyCount / totalItems) * 100) : 100;
    const rawItemsCount = list.filter(item => !isReadymadeItem(item)).length;
    const readymadeItemsCount = list.filter(item => isReadymadeItem(item)).length;

    return {
      totalItems,
      totalValue,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      healthPercent,
      rawItemsCount,
      readymadeItemsCount
    };
  }, [items]);

  // Filtered items (A-Z sorted & inventory type categorized)
  const filteredItems = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list
      .filter(item => {
        // Inventory Type Filter: Raw Item vs Readymate Item
        if (inventoryTypeFilter === 'RAW') {
          if (isReadymadeItem(item)) return false;
        } else if (inventoryTypeFilter === 'READY_MADE') {
          if (!isReadymadeItem(item)) return false;
        }

        // Search
        const q = searchTerm.trim().toLowerCase();
        if (q) {
          const matchesName = item.name.toLowerCase().includes(q);
          const matchesNameBn = item.nameBn.toLowerCase().includes(q);
          const matchesSupplier = item.supplier?.toLowerCase().includes(q) || false;
          if (!matchesName && !matchesNameBn && !matchesSupplier) {
            return false;
          }
        }

        // Stock status filter
        if (stockStatusFilter === 'LOW') {
          if (item.currentStock > item.minStockAlert) return false;
        } else if (stockStatusFilter === 'NORMAL') {
          if (item.currentStock <= item.minStockAlert) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const nameA = getItemDisplayName(a, 'inventory', canteenConfig).primary;
        const nameB = getItemDisplayName(b, 'inventory', canteenConfig).primary;
        return nameA.localeCompare(nameB);
      });
  }, [items, inventoryTypeFilter, searchTerm, stockStatusFilter, canteenConfig]);

  // Open Restock Modal for specific item
  const handleOpenRestock = (item?: RawInventoryItem) => {
    if (item) {
      setSelectedItemId(item.id);
      setRestockCost(String(item.unitCost));
      setRestockSupplier(item.supplier || '');
    } else if (items.length > 0) {
      setSelectedItemId(items[0].id);
      setRestockCost(String(items[0].unitCost));
      setRestockSupplier(items[0].supplier || '');
    }
    setRestockQty('');
    setRestockUnitMode('MAIN');
    setRestockNotes('');
    setShowRestockModal(true);
  };

  // Open Issue / Kitchen usage Modal
  const handleOpenIssue = (item?: RawInventoryItem) => {
    if (item) {
      setSelectedItemId(item.id);
    } else if (items.length > 0) {
      setSelectedItemId(items[0].id);
    }
    setIssueQty('');
    setIssueUnitMode('MAIN');
    setIssueType('ISSUE');
    setIssueNotes('');
    setShowIssueModal(true);
  };

  // Submit Restock
  const handleSaveRestock = (e: React.FormEvent) => {
    e.preventDefault();
    const rawInputQty = parseFloat(restockQty);
    if (isNaN(rawInputQty) || rawInputQty <= 0) {
      alert('Please enter a valid restock quantity');
      return;
    }

    const item = items.find(i => i.id === selectedItemId);
    if (!item) return;

    // Convert from sub-unit to main unit if entered in sub-unit
    const qty = (restockUnitMode === 'SUB' && item.packSize && item.packSize > 1)
      ? Math.round((rawInputQty / item.packSize) * 1000) / 1000
      : rawInputQty;

    const wastagePct = Number(item.wastagePercentage) || 0;
    let netQty = qty;
    let wasteQty = 0;
    if (wastagePct > 0 && wastagePct < 100) {
      wasteQty = Math.round((qty * (wastagePct / 100)) * 1000) / 1000;
      netQty = Math.round((qty - wasteQty) * 1000) / 1000;
    }

    const prevStock = item.currentStock;
    const newStock = Math.round((prevStock + netQty) * 100) / 100;
    const today = new Date().toISOString().split('T')[0];
    const cost = parseFloat(restockCost) || item.unitCost;

    // Update item
    setItems(prev => prev.map(i => {
      if (i.id === item.id) {
        return {
          ...i,
          currentStock: newStock,
          unitCost: cost,
          lastRestockedDate: today,
          supplier: restockSupplier || i.supplier
        };
      }
      return i;
    }));

    // Add logs
    const newLogsToAdd: RawStockLog[] = [];
    const unitLabel = restockUnitMode === 'SUB' ? `${rawInputQty} ${item.subUnit || 'pcs'} (≈ ${qty} ${item.unit})` : `${qty} ${item.unit}`;
    newLogsToAdd.push({
      id: `log-${Date.now()}`,
      itemId: item.id,
      itemName: `${item.name} (${item.nameBn})`,
      type: 'RESTOCK',
      quantity: netQty,
      unit: item.unit,
      previousStock: prevStock,
      newStock,
      cost: qty * cost,
      date: new Date().toLocaleString(),
      notes: wastagePct > 0 
        ? `Purchased: ${unitLabel} (${wastagePct}% Wastage deducted: -${wasteQty} ${item.unit}, Net: +${netQty} ${item.unit})${restockNotes ? ` • ${restockNotes}` : ''}`
        : `${restockNotes ? `${restockNotes} • ` : ''}${unitLabel}${restockSupplier ? ` (Supplier: ${restockSupplier})` : ''}`,
      recordedBy: 'Canteen Manager'
    });

    if (wasteQty > 0) {
      newLogsToAdd.push({
        id: `log-waste-${Date.now()}`,
        itemId: item.id,
        itemName: `${item.name} (${item.nameBn})`,
        type: 'WASTAGE',
        quantity: wasteQty,
        unit: item.unit,
        previousStock: Math.round((prevStock + qty) * 100) / 100,
        newStock,
        cost: (qty * cost) * (wastagePct / 100),
        date: new Date().toLocaleString(),
        notes: `${wastagePct}% processing loss from ${qty} ${item.unit} purchased`,
        recordedBy: 'Auto Wastage Calculation'
      });
    }

    setIsSavingRestock(true);
    setLogs(prev => [...newLogsToAdd, ...prev]);
    setIsSavedRestock(true);
    setTimeout(() => {
      setIsSavedRestock(false);
      setIsSavingRestock(false);
      setShowRestockModal(false);
    }, 1050);
  };

  // Submit Issue / Kitchen Usage
  const handleSaveIssue = (e: React.FormEvent) => {
    e.preventDefault();
    const rawInputQty = parseFloat(issueQty);
    if (isNaN(rawInputQty) || rawInputQty <= 0) {
      alert('Please enter a valid quantity');
      return;
    }

    const item = items.find(i => i.id === selectedItemId);
    if (!item) return;

    // Convert from sub-unit to main unit if entered in sub-unit
    const qty = (issueUnitMode === 'SUB' && item.packSize && item.packSize > 1)
      ? Math.round((rawInputQty / item.packSize) * 1000) / 1000
      : rawInputQty;

    if (qty > item.currentStock) {
      const confirmProceed = window.confirm(
        `Quantity (${qty} ${item.unit}) exceeds current available stock (${item.currentStock} ${item.unit}). Do you still want to record this deduction?`
      );
      if (!confirmProceed) return;
    }

    const prevStock = item.currentStock;
    const newStock = Math.max(0, prevStock - qty);

    // Update item
    setItems(prev => prev.map(i => {
      if (i.id === item.id) {
        return {
          ...i,
          currentStock: Math.round(newStock * 100) / 100
        };
      }
      return i;
    }));

    // Add log
    const unitLabel = issueUnitMode === 'SUB' ? `${rawInputQty} ${item.subUnit || 'pcs'} (≈ ${qty} ${item.unit})` : `${qty} ${item.unit}`;
    const newLog: RawStockLog = {
      id: `log-${Date.now()}`,
      itemId: item.id,
      itemName: `${item.name} (${item.nameBn})`,
      type: issueType,
      quantity: Math.round(qty * 100) / 100,
      unit: item.unit,
      previousStock: prevStock,
      newStock: Math.round(newStock * 100) / 100,
      date: new Date().toLocaleString(),
      notes: `${issueNotes ? `${issueNotes} • ` : ''}${unitLabel} (${issueType === 'WASTAGE' ? 'Damaged / Wastage' : 'Kitchen Daily Preparation'})`,
      recordedBy: 'Canteen Manager'
    };
    setIsSavingIssue(true);
    setLogs(prev => [newLog, ...prev]);
    setIsSavedIssue(true);
    setTimeout(() => {
      setIsSavedIssue(false);
      setIsSavingIssue(false);
      setShowIssueModal(false);
    }, 1050);
  };

  // Add / Edit Item
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemData.name || !newItemData.name?.trim()) {
      alert('Item English name is required');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    if (editingItem) {
      // Edit mode
      setItems(prev => {
        const updatedList = prev.map(i => {
          if (i.id === editingItem.id) {
          const unit = newItemData.unit || i.unit || 'kg';
          const u = unit.toLowerCase().trim();
          const isPcs = ['pcs', 'pc', 'piece', 'টি', 'টা'].includes(u);
          const isKg = !isPcs && u === 'kg';
          const isLtr = !isPcs && ['liter', 'ltr', 'litre'].includes(u);
          const isCase = !isPcs && ['case', 'crate'].includes(u);
          const rawSub = (newItemData.subUnit || '').toLowerCase().trim();
          const isSameUnit = Boolean(u && rawSub && u === rawSub);

          const hasSubUnits = (isPcs || isSameUnit) 
            ? false 
            : (isKg || isLtr || isCase) 
            ? true 
            : Boolean(newItemData.hasSubUnits);

          const packSize = (isPcs || isSameUnit || !hasSubUnits)
            ? 1
            : (isKg || isLtr) 
            ? (Number(newItemData.packSize) > 1 ? Number(newItemData.packSize) : 1000) 
            : isCase
            ? (Number(newItemData.packSize) > 1 ? Number(newItemData.packSize) : 30)
            : (Number(newItemData.packSize) > 1 ? Number(newItemData.packSize) : 1);

          const subUnit = (isPcs || isSameUnit || !hasSubUnits)
            ? undefined
            : isKg ? 'gm' : isLtr ? 'ml' : isCase ? 'pcs' : (newItemData.subUnit ? newItemData.subUnit.trim() : undefined);

          const parsedStock = (newItemData.currentStock !== '' && newItemData.currentStock !== undefined && !isNaN(Number(newItemData.currentStock)))
            ? Number(newItemData.currentStock)
            : 0;
          const parsedMinAlert = (newItemData.minStockAlert !== '' && newItemData.minStockAlert !== undefined && !isNaN(Number(newItemData.minStockAlert)))
            ? Number(newItemData.minStockAlert)
            : 0;
          const parsedUnitCost = (newItemData.unitCost !== '' && newItemData.unitCost !== undefined && !isNaN(Number(newItemData.unitCost)))
            ? Number(newItemData.unitCost)
            : 0;
          const parsedWastage = (newItemData.wastagePercentage !== '' && newItemData.wastagePercentage !== undefined && !isNaN(Number(newItemData.wastagePercentage)))
            ? Number(newItemData.wastagePercentage)
            : 0;

          const effectiveDp = newItemData.dp?.trim() || undefined;
          const resolvedItemType: InventoryItemType = newItemData.itemType || (isReadymadeItem(i) ? 'READY_MADE' : 'RAW');

          const updated: RawInventoryItem = {
            ...i,
            name: newItemData.name!.trim(),
            nameBn: newItemData.nameBn?.trim() || newItemData.name!.trim(),
            itemType: resolvedItemType,
            unit: unit,
            currentStock: parsedStock,
            minStockAlert: parsedMinAlert,
            unitCost: parsedUnitCost,
            supplier: newItemData.supplier?.trim(),
            notes: newItemData.notes?.trim(),
            wastagePercentage: parsedWastage,
            hasSubUnits,
            packSize,
            subUnit,
            dp: effectiveDp,
            DP: effectiveDp,
            image: effectiveDp
          };

          // Directly sync to Supabase Canteen_Inventory table
          const dbItem = {
            id: updated.id,
            name: updated.name,
            nameBn: updated.nameBn || '',
            unit: updated.unit,
            "Sub Unit": updated.subUnit || (updated.unit?.toLowerCase() === 'kg' ? 'gm' : (updated.unit?.toLowerCase() === 'liter' ? 'ml' : (updated.unit?.toLowerCase() === 'case' || updated.unit?.toLowerCase() === 'packet' ? 'pcs' : null))),
            currentStock: updated.currentStock,
            minStockAlert: updated.minStockAlert,
            unitCost: updated.unitCost,
            wastagePercentage: updated.wastagePercentage ?? 0,
            lastRestockedDate: updated.lastRestockedDate || '',
            supplier: updated.supplier || '',
            DP: effectiveDp || null,
            itemType: resolvedItemType,
            notes: encodeNotesWithMeta(updated.notes, {
              category: updated.category,
              subCategory: updated.subCategory,
              hasSubUnits: updated.hasSubUnits,
              packSize: updated.packSize,
              subUnit: updated.subUnit,
              dp: effectiveDp,
              itemType: resolvedItemType
            })
          };
          supabase.from('Canteen_Inventory').upsert([dbItem], { onConflict: 'id' })
            .then(({ error }) => {
              if (error) console.error('Failed to sync updated item to Canteen_Inventory:', error);
            });

          return updated;
        }
        return i;
      });
      lastSavedItemsJsonRef.current = JSON.stringify(updatedList);
      saveRawInventoryItems(updatedList);
      return updatedList;
    });
    setEditingItem(null);
    } else {
      // Add new
      const parsedStock = (newItemData.currentStock !== '' && newItemData.currentStock !== undefined && !isNaN(Number(newItemData.currentStock)))
        ? Number(newItemData.currentStock)
        : 0;
      const parsedMinAlert = (newItemData.minStockAlert !== '' && newItemData.minStockAlert !== undefined && !isNaN(Number(newItemData.minStockAlert)))
        ? Number(newItemData.minStockAlert)
        : 0;
      const parsedUnitCost = (newItemData.unitCost !== '' && newItemData.unitCost !== undefined && !isNaN(Number(newItemData.unitCost)))
        ? Number(newItemData.unitCost)
        : 0;
      const parsedWastage = (newItemData.wastagePercentage !== '' && newItemData.wastagePercentage !== undefined && !isNaN(Number(newItemData.wastagePercentage)))
        ? Number(newItemData.wastagePercentage)
        : 0;

      const inputStock = parsedStock;
      const wastagePct = parsedWastage;
      let effectiveStock = inputStock;
      let wasteQty = 0;

      if (inputStock > 0 && wastagePct > 0 && wastagePct < 100) {
        wasteQty = Math.round((inputStock * (wastagePct / 100)) * 1000) / 1000;
        effectiveStock = Math.round((inputStock - wasteQty) * 1000) / 1000;
      }

      const unit = newItemData.unit || 'kg';
      const u = unit.toLowerCase().trim();
      const isPcs = ['pcs', 'pc', 'piece', 'টি', 'টা'].includes(u);
      const isKg = !isPcs && u === 'kg';
      const isLtr = !isPcs && ['liter', 'ltr', 'litre'].includes(u);
      const isCase = !isPcs && ['case', 'crate'].includes(u);
      const rawSub = (newItemData.subUnit || '').toLowerCase().trim();
      const isSameUnit = Boolean(u && rawSub && u === rawSub);

      const hasSubUnits = (isPcs || isSameUnit) 
        ? false 
        : (isKg || isLtr || isCase) 
        ? true 
        : Boolean(newItemData.hasSubUnits);

      const packSize = (isPcs || isSameUnit || !hasSubUnits)
        ? 1
        : (isKg || isLtr) 
        ? (Number(newItemData.packSize) > 1 ? Number(newItemData.packSize) : 1000) 
        : isCase
        ? (Number(newItemData.packSize) > 1 ? Number(newItemData.packSize) : 30)
        : (Number(newItemData.packSize) > 1 ? Number(newItemData.packSize) : 1);

      const subUnit = (isPcs || isSameUnit || !hasSubUnits)
        ? undefined
        : isKg ? 'gm' : isLtr ? 'ml' : isCase ? 'pcs' : (newItemData.subUnit ? newItemData.subUnit.trim() : undefined);

      const effectiveDp = newItemData.dp?.trim() || undefined;
      const resolvedItemType: InventoryItemType = newItemData.itemType || (inventoryTypeFilter === 'READY_MADE' ? 'READY_MADE' : 'RAW');

      const newItem: RawInventoryItem = {
        id: `raw-${Date.now()}`,
        name: newItemData.name!.trim(),
        nameBn: newItemData.nameBn?.trim() || newItemData.name!.trim(),
        itemType: resolvedItemType,
        unit: unit,
        currentStock: effectiveStock,
        minStockAlert: parsedMinAlert,
        unitCost: parsedUnitCost,
        lastRestockedDate: today,
        supplier: newItemData.supplier?.trim(),
        notes: newItemData.notes?.trim(),
        wastagePercentage: wastagePct,
        hasSubUnits,
        packSize,
        subUnit,
        dp: effectiveDp,
        DP: effectiveDp,
        image: effectiveDp
      };
      unmarkRawItemAsDeleted(newItem);
      setItems(prev => {
        const next = [newItem, ...prev.filter(i => i.id !== newItem.id)];
        saveRawInventoryItems(next);
        return next;
      });

      // Directly sync new item to Supabase Canteen_Inventory table
      const newDbItem = {
        id: newItem.id,
        name: newItem.name,
        nameBn: newItem.nameBn || '',
        unit: newItem.unit,
        "Sub Unit": newItem.subUnit || (newItem.unit?.toLowerCase() === 'kg' ? 'gm' : (newItem.unit?.toLowerCase() === 'liter' ? 'ml' : (newItem.unit?.toLowerCase() === 'case' || newItem.unit?.toLowerCase() === 'packet' ? 'pcs' : null))),
        currentStock: newItem.currentStock,
        minStockAlert: newItem.minStockAlert,
        unitCost: newItem.unitCost,
        wastagePercentage: newItem.wastagePercentage ?? 0,
        lastRestockedDate: newItem.lastRestockedDate || '',
        supplier: newItem.supplier || '',
        DP: effectiveDp || null,
        itemType: resolvedItemType,
        notes: encodeNotesWithMeta(newItem.notes, {
          category: newItem.category,
          subCategory: newItem.subCategory,
          hasSubUnits: newItem.hasSubUnits,
          packSize: newItem.packSize,
          subUnit: newItem.subUnit,
          dp: effectiveDp,
          itemType: resolvedItemType
        })
      };
      supabase.from('Canteen_Inventory').upsert([newDbItem], { onConflict: 'id' })
        .then(({ error }) => {
          if (error) console.error('Failed to sync new item to Canteen_Inventory:', error);
        });

      // Add log
      const initialLogs: RawStockLog[] = [];
      initialLogs.push({
        id: `log-${Date.now()}`,
        itemId: newItem.id,
        itemName: `${newItem.name} (${newItem.nameBn})`,
        type: 'RESTOCK',
        quantity: effectiveStock,
        unit: newItem.unit,
        previousStock: 0,
        newStock: effectiveStock,
        cost: inputStock * newItem.unitCost,
        date: new Date().toLocaleString(),
        notes: wastagePct > 0 
          ? `Initial Stock: ${inputStock} ${newItem.unit} (${wastagePct}% Wastage deducted: -${wasteQty} ${newItem.unit}, Net: +${effectiveStock} ${newItem.unit})`
          : 'Initial Stock Registration',
        recordedBy: 'Canteen Manager'
      });

      if (wasteQty > 0) {
        initialLogs.push({
          id: `log-waste-${Date.now()}`,
          itemId: newItem.id,
          itemName: `${newItem.name} (${newItem.nameBn})`,
          type: 'WASTAGE',
          quantity: wasteQty,
          unit: newItem.unit,
          previousStock: inputStock,
          newStock: effectiveStock,
          cost: (inputStock * newItem.unitCost) * (wastagePct / 100),
          date: new Date().toLocaleString(),
          notes: `${wastagePct}% initial processing loss from ${inputStock} ${newItem.unit}`,
          recordedBy: 'Auto Wastage Calculation'
        });
      }

      setIsSavingItem(true);
      setLogs(prev => [...initialLogs, ...prev]);
    }

    setIsSavedItem(true);
    setTimeout(() => {
      setIsSavedItem(false);
      setIsSavingItem(false);
      setShowAddModal(false);
    }, 1050);
  };

  // Direct toggle handler for classification (Raw Item <-> Readymate Item)
  const handleToggleClassification = async (item: RawInventoryItem, targetType?: InventoryItemType) => {
    const nextType: InventoryItemType = targetType || (item.itemType === 'READY_MADE' ? 'RAW' : 'READY_MADE');
    const updatedNotes = encodeNotesWithMeta(item.notes, {
      category: item.category,
      subCategory: item.subCategory,
      hasSubUnits: item.hasSubUnits,
      packSize: item.packSize,
      subUnit: item.subUnit,
      dp: item.dp || item.DP || item.image,
      itemType: nextType
    });

    const updatedItem: RawInventoryItem = {
      ...item,
      itemType: nextType,
      notes: updatedNotes
    };

    setItems(prev => {
      const updatedList = prev.map(i => i.id === item.id ? updatedItem : i);
      lastSavedItemsJsonRef.current = JSON.stringify(updatedList);
      saveRawInventoryItems(updatedList);
      return updatedList;
    });

    try {
      await supabase.from('Canteen_Inventory').upsert([{
        id: updatedItem.id,
        name: updatedItem.name,
        nameBn: updatedItem.nameBn || '',
        unit: updatedItem.unit,
        "Sub Unit": updatedItem.subUnit || null,
        currentStock: updatedItem.currentStock,
        minStockAlert: updatedItem.minStockAlert,
        unitCost: updatedItem.unitCost,
        wastagePercentage: updatedItem.wastagePercentage ?? 0,
        lastRestockedDate: updatedItem.lastRestockedDate || '',
        supplier: updatedItem.supplier || '',
        DP: updatedItem.dp || updatedItem.DP || null,
        itemType: nextType,
        notes: updatedNotes
      }], { onConflict: 'id' });
    } catch (e) {
      console.warn('Direct classification toggle sync error:', e);
    }
  };

  const handleEditItem = (item: RawInventoryItem) => {
    setEditingItem(item);
    setEditModalTab('DETAILS');
    const u = (item.unit || '').toLowerCase().trim();
    const isPcs = ['pcs', 'pc', 'piece', 'টি', 'টা'].includes(u);
    const isKg = !isPcs && u === 'kg';
    const isLtr = !isPcs && ['liter', 'ltr', 'litre'].includes(u);
    const isCase = !isPcs && ['case', 'crate'].includes(u);
    const isPkt = !isPcs && ['packet', 'pkt', 'box'].includes(u);
    const hasConfiguredSub = !isPcs && Boolean(
      (isKg || isLtr || isPkt || isCase) ||
      (item.hasSubUnits && item.subUnit && item.subUnit.toLowerCase().trim() !== u && item.packSize && item.packSize > 1)
    );

    setNewItemData({
      name: item.name,
      nameBn: item.nameBn,
      unit: item.unit,
      currentStock: item.currentStock,
      minStockAlert: item.minStockAlert,
      unitCost: item.unitCost,
      supplier: item.supplier || '',
      notes: item.notes || '',
      wastagePercentage: item.wastagePercentage || 0,
      hasSubUnits: hasConfiguredSub,
      packSize: isPcs ? 1 : isKg ? (item.packSize && item.packSize > 1 ? item.packSize : 1000) 
        : isLtr ? (item.packSize && item.packSize > 1 ? item.packSize : 1000) 
        : isCase ? (item.packSize && item.packSize > 1 ? item.packSize : 30)
        : (item.packSize && item.packSize > 1 ? item.packSize : (isPkt ? 24 : 1)),
      subUnit: isPcs ? undefined : isKg ? 'gm' : isLtr ? 'ml' : isCase ? 'pcs' : (hasConfiguredSub && item.subUnit && item.subUnit.toLowerCase().trim() !== u ? item.subUnit : (isPkt ? 'pcs' : undefined)),
      itemType: item.itemType || (isReadymadeItem(item) ? 'READY_MADE' : 'RAW'),
      dp: item.dp || item.DP || item.image || ''
    });
    setShowAddModal(true);
  };

  const handleDeleteItem = (item: RawInventoryItem) => {
    setItemToDelete(item);
  };

  const confirmAndDeleteItem = async () => {
    if (!itemToDelete) return;
    const target = itemToDelete;
    setIsDeletingItem(true);
    try {
      // Mark as deleted in persistent blacklist to prevent re-seeding from initial items
      markRawItemAsDeleted(target);

      const remainingItems = items.filter(i => i.id !== target.id);
      setItems(remainingItems);
      lastSavedItemsJsonRef.current = JSON.stringify(remainingItems);
      saveRawInventoryItems(remainingItems);

      try {
        await supabase.from('Canteen_Inventory').delete().eq('id', target.id);
      } catch (err) {
        console.warn('Delete from Canteen_Inventory table note:', err);
      }

      queuePushKeyToCloud('canteen_raw_inventory_items_v2', remainingItems);
      
      // Dispatch update event safely so recipes and menu recalculate without blocking render
      setTimeout(() => {
        window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
      }, 0);
      setItemToDelete(null);
      setShowAddModal(false);
      setEditingItem(null);
    } catch (err) {
      console.error('Error deleting raw item:', err);
    } finally {
      setIsDeletingItem(false);
    }
  };

  // Reset to default
  const handleResetToDefault = () => {
    setShowResetConfirmModal(true);
  };

  const confirmResetToDefault = () => {
    try {
      localStorage.removeItem(DELETED_RAW_ITEMS_STORAGE_KEY);
    } catch {}
    const { deduplicated } = deduplicateRawItems(INITIAL_RAW_ITEMS);
    setItems(deduplicated);
    lastSavedItemsJsonRef.current = JSON.stringify(deduplicated);
    saveRawInventoryItems(deduplicated);
    setTimeout(() => {
      window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
    }, 0);
    setShowResetConfirmModal(false);
  };

  // Quick DP Photo Update Handler (Instantly syncs to Supabase Canteen_Inventory DP column)
  const handleQuickUpdateDp = async (itemId: string, newDp: string) => {
    try {
      setIsUpdatingDp(true);
      const cleanDp = newDp.trim();
      // Optimistic local state update
      setItems(prev => prev.map(it => {
        if (it.id === itemId) {
          return {
            ...it,
            dp: cleanDp || undefined,
            DP: cleanDp || undefined,
            image: cleanDp || undefined
          };
        }
        return it;
      }));

      // Directly update Supabase Canteen_Inventory table DP column
      const { error } = await supabase
        .from('Canteen_Inventory')
        .update({ 'DP': cleanDp || null })
        .eq('id', itemId);

      if (error) {
        console.warn('Direct DP update to Supabase Canteen_Inventory failed:', error);
      }

      setQuickDpToast('আইটেমের ছবি (DP) ক্লাউডে সফলভাবে সংরক্ষিত হয়েছে!');
      setTimeout(() => setQuickDpToast(null), 3500);
      setTimeout(() => {
        window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
      }, 0);
    } catch (e) {
      console.error('Failed to quick update DP:', e);
    } finally {
      setIsUpdatingDp(false);
      setQuickDpItem(null);
      setQuickDpInput('');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
      
      {/* Toast Notification for DP / Cloud Updates */}
      {quickDpToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400 flex items-center gap-3 animate-in slide-in-from-bottom duration-300 font-bold text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-100" />
          <span>{quickDpToast}</span>
        </div>
      )}

      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span>CANTEEN INVENTORY</span>
              </h2>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                Kitchen raw materials, readymade resale items & Cloud DP synchronization
              </p>
            </div>
          </div>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                const defaultType: InventoryItemType = inventoryTypeFilter === 'READY_MADE' ? 'READY_MADE' : 'RAW';
                const isReady = defaultType === 'READY_MADE';
                setEditingItem(null);
                setEditModalTab('DETAILS');
                setNewItemData({
                  name: '',
                  nameBn: '',
                  category: isReady ? 'Dry Food & Snacks' : 'Fuel & Utilities',
                  subCategory: '',
                  itemType: defaultType,
                  unit: isReady ? 'pcs' : 'kg',
                  currentStock: isReady ? 50 : 10,
                  minStockAlert: isReady ? 15 : 5,
                  unitCost: isReady ? 20 : 100,
                  supplier: '',
                  notes: '',
                  wastagePercentage: 0,
                  hasSubUnits: !isReady,
                  packSize: isReady ? 1 : 1000,
                  subUnit: isReady ? undefined : 'gm',
                  dp: ''
                });
                setShowAddModal(true);
              }}
              className="flex items-center space-x-2 px-4 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-xs font-black tracking-wider transition-all shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {inventoryTypeFilter === 'READY_MADE' ? 'NEW READYMADE ITEM' : inventoryTypeFilter === 'RAW' ? 'NEW RAW ITEM' : 'NEW INVENTORY ITEM'}
              </span>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black tracking-wider transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
              title="Import & Update Stock via Excel / CSV"
            >
              <Upload className="w-4 h-4" />
              <span>IMPORT STOCK</span>
            </button>

            <button
              onClick={() => setShowLogsModal(true)}
              className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
              title="View Stock In / Out Log History"
            >
              <History className="w-4 h-4 text-indigo-400" />
              <span>STOCK LOGS</span>
            </button>
          </div>
        )}
      </div>

      {/* 3-Option Main Inventory Switcher: Raw Item, Readymate Item, All */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Option 1: RAW Item */}
          <button
            type="button"
            onClick={() => setInventoryTypeFilter('RAW')}
            className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all text-left cursor-pointer ${
              inventoryTypeFilter === 'RAW'
                ? 'bg-gradient-to-r from-blue-950/80 via-indigo-950/70 to-slate-900 border-blue-500 shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/40'
                : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                inventoryTypeFilter === 'RAW'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-800 text-blue-400'
              }`}>
                🌾
              </div>
              <span className="font-black text-white text-base tracking-wide">Raw Item</span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-500/40">
              {stats.rawItemsCount}
            </span>
          </button>

          {/* Option 2: Readymate Item */}
          <button
            type="button"
            onClick={() => setInventoryTypeFilter('READY_MADE')}
            className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all text-left cursor-pointer ${
              inventoryTypeFilter === 'READY_MADE'
                ? 'bg-gradient-to-r from-emerald-950/80 via-teal-950/70 to-slate-900 border-emerald-500 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/40'
                : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                inventoryTypeFilter === 'READY_MADE'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 text-emerald-400'
              }`}>
                🥐
              </div>
              <span className="font-black text-white text-base tracking-wide">Readymate Item</span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              {stats.readymadeItemsCount}
            </span>
          </button>

          {/* Option 3: All */}
          <button
            type="button"
            onClick={() => setInventoryTypeFilter('ALL')}
            className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all text-left cursor-pointer ${
              inventoryTypeFilter === 'ALL'
                ? 'bg-gradient-to-r from-indigo-950/80 via-purple-950/70 to-slate-900 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400/40'
                : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                inventoryTypeFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800 text-indigo-400'
              }`}>
                📦
              </div>
              <span className="font-black text-white text-base tracking-wide">All</span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              {stats.totalItems}
            </span>
          </button>
        </div>
      </div>

      {/* Search, Filter Tabs & Reset */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search raw inventory..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick status filters */}
          <div className="flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 shrink-0">
            <button
              onClick={() => setStockStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                stockStatusFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setStockStatusFilter('LOW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                stockStatusFilter === 'LOW'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-400 hover:bg-slate-700/50'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Low ({stats.lowStockCount})</span>
            </button>
            <button
              onClick={() => setStockStatusFilter('NORMAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                stockStatusFilter === 'NORMAL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-400 hover:bg-slate-700/50'
              }`}
            >
              Normal ({items.length - stats.lowStockCount})
            </button>
          </div>

          {/* View Mode Toggle: Box vs Table */}
          <div className="flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 shrink-0">
            <button
              onClick={() => setViewMode('BOX')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'BOX'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Box / Card View (Member DB style)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Box View</span>
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'TABLE'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Classic Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          {!readOnly && (
            <button
              onClick={handleResetToDefault}
              className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl transition-colors flex items-center space-x-1.5"
              title="Reset default raw ingredients list"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Reset Defaults</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Inventory Content: Box View or Table View */}
      {viewMode === 'BOX' ? (
        /* Box / Card Grid View (Like Member DB) */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-semibold text-slate-300">Raw Items Catalog</span>
            <span className="font-mono text-slate-500">Showing {filteredItems.length} items</span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 font-bold">
              <Boxes className="w-10 h-10 mx-auto text-slate-600 mb-3 opacity-60" />
              <p className="text-base text-slate-400">No raw items found matching your criteria</p>
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="mt-3 px-4 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-xl text-xs font-bold transition-colors inline-block"
                >
                  Clear search filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map((item, idx) => {
                const isLow = item.currentStock <= item.minStockAlert;
                const isZero = item.currentStock <= 0;
                const itemValue = item.currentStock * item.unitCost;
                const ratio = item.minStockAlert > 0 ? (item.currentStock / (item.minStockAlert * 2)) * 100 : 100;
                const stockFill = Math.min(100, Math.max(5, ratio));
                const wastagePct = Number(item.wastagePercentage) || 0;
                const subInfo = getRawItemSubUnitInfo(item);
                const hasSubUnitDisplay = subInfo.hasSubUnit && Boolean(subInfo.subUnit) && subInfo.subUnit.toLowerCase() !== (item.unit || '').toLowerCase();

                return (
                  <div
                    key={`${item.id}_${idx}`}
                    onClick={() => {
                      if (!readOnly) handleEditItem(item);
                    }}
                    className={`relative bg-gradient-to-b from-slate-800/90 via-slate-900 to-slate-950 rounded-3xl p-5 border-t border-t-slate-600/60 border-x border-x-slate-700/60 border-b-4 border-b-slate-950 shadow-[0_12px_24px_-4px_rgba(0,0,0,0.65),0_4px_8px_-2px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.12),inset_0_-2px_4px_0_rgba(0,0,0,0.4)] hover:-translate-y-1.5 hover:shadow-[0_20px_35px_-6px_rgba(0,0,0,0.8),0_0_22px_0_rgba(79,70,229,0.3),inset_0_1px_0_0_rgba(255,255,255,0.2)] hover:border-b-indigo-900 transition-all duration-300 relative group flex flex-col justify-between ${
                      !readOnly ? 'cursor-pointer' : ''
                    } ${
                      isZero
                        ? '!border-t-rose-500/50 !border-x-rose-500/30 !border-b-rose-950 !bg-gradient-to-b !from-rose-950/30 !via-slate-900 !to-slate-950'
                        : isLow
                        ? '!border-t-amber-500/50 !border-x-amber-500/30 !border-b-amber-950 !bg-gradient-to-b !from-amber-950/30 !via-slate-900 !to-slate-950'
                        : ''
                    }`}
                  >
                    {/* Top Row: Icon, Names & Status Badge */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="relative group/dp shrink-0">
                            <div className={`w-13 h-13 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border border-slate-700/70 overflow-hidden shadow-[inset_0_2px_5px_rgba(0,0,0,0.8),0_3px_8px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-300 ${
                              isZero 
                                ? 'bg-rose-950/80 text-rose-400 !border-rose-500/40' 
                                : isLow 
                                ? 'bg-amber-950/80 text-amber-400 !border-amber-500/40' 
                                : 'bg-slate-950 text-indigo-400'
                            }`}>
                              {(item.dp || item.DP || item.image) ? (
                                <img src={item.dp || item.DP || item.image} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-base font-black tracking-wider">{item.name.slice(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQuickDpItem(item);
                                  setQuickDpInput(item.dp || item.DP || item.image || '');
                                }}
                                className="absolute -bottom-1 -right-1 p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-md border border-slate-900 transition-all opacity-85 group-hover/dp:opacity-100 hover:scale-110 active:scale-95 cursor-pointer"
                                title="Set / Change DP (ছবি যুক্ত বা পরিবর্তন করুন)"
                              >
                                <Camera className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="min-w-0">
                            {(() => {
                              const nameDisplay = getItemDisplayName(item, 'inventory', canteenConfig);
                              return (
                                <>
                                  <h4 className="font-extrabold text-white text-base truncate flex items-center gap-1.5 group-hover:text-indigo-300 transition-colors" title={nameDisplay.full}>
                                    <span>{nameDisplay.primary}</span>
                                  </h4>
                                  {Boolean(nameDisplay.secondary) && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="text-xs text-slate-400 font-medium truncate" title={nameDisplay.secondary}>
                                        {nameDisplay.secondary}
                                      </p>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Status Badge & Quick Actions */}
                        <div className="shrink-0 flex items-center gap-1.5">
                          {isZero ? (
                            <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-rose-500/20 text-rose-300 border-t border-rose-400/40 border-b-2 border-rose-950 inline-flex items-center gap-1 shadow-sm">
                              <AlertCircle className="w-3 h-3" /> Out
                            </span>
                          ) : isLow ? (
                            <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-500/20 text-amber-300 border-t border-amber-400/40 border-b-2 border-amber-950 inline-flex items-center gap-1 shadow-sm">
                              <AlertTriangle className="w-3 h-3" /> Low
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-500/20 text-emerald-300 border-t border-emerald-400/40 border-b-2 border-emerald-950 inline-flex items-center gap-1 shadow-sm">
                              <CheckCircle2 className="w-3 h-3" /> OK
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Unit, Type & Wastage Tag Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {/* RAW vs Readymate Badge */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!readOnly) handleToggleClassification(item);
                          }}
                          title={readOnly ? undefined : "Click to toggle between Raw Item & Readymate"}
                          className={`${readOnly ? '' : 'cursor-pointer hover:scale-105 active:scale-95 transition-all'}`}
                        >
                          {(item.itemType === 'READY_MADE' || isReadymadeItem(item)) ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border-t border-emerald-400/30 border-b-2 border-emerald-950 shadow-sm flex items-center gap-1">
                              <span>🥐 Readymate</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border-t border-blue-400/30 border-b-2 border-blue-950 shadow-sm flex items-center gap-1">
                              <span>🌾 Raw Item</span>
                            </span>
                          )}
                        </button>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800/90 text-indigo-300 border-t border-slate-600/40 border-b-2 border-slate-950 shadow-sm uppercase">
                          {item.unit}
                        </span>

                        {hasSubUnitDisplay && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border-t border-indigo-400/30 border-b-2 border-indigo-950 shadow-sm flex items-center gap-1">
                            <Boxes className="w-2.5 h-2.5 text-indigo-400" />
                            <span>1 {item.unit} = {subInfo.packSize} {subInfo.subUnit}</span>
                          </span>
                        )}

                        {wastagePct > 0 && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border-t border-amber-400/30 border-b-2 border-amber-950 shadow-sm flex items-center gap-1">
                            <Percent className="w-2.5 h-2.5 text-amber-400" />
                            <span>Wastage: {wastagePct}%</span>
                          </span>
                        )}
                      </div>

                      {/* Stock Level Display & Progress Bar */}
                      <div className="mt-4 bg-slate-950/80 border-t border-slate-800 border-x border-slate-900 border-b-2 border-slate-950 rounded-2xl p-3.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Available Stock
                          </span>
                          <div>
                            <span className={`text-xl font-black ${
                              isZero ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
                            }`}>
                              {item.currentStock}
                            </span>
                            <span className="text-xs font-bold text-slate-400 ml-1 uppercase">
                              {item.unit}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-900 h-2 rounded-full mt-2.5 overflow-hidden border border-slate-800/60 shadow-inner">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              isZero ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${stockFill}%` }}
                          ></div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mt-2 font-mono">
                          <span>Min: {item.minStockAlert} {item.unit}</span>
                          <span>Value: ৳{Math.round(itemValue).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Details: Unit Cost & Supplier */}
                      <div className="mt-3.5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-400 bg-slate-950/40 px-2.5 py-1.5 rounded-xl border border-slate-800/60">
                          <span className="text-slate-500 font-bold text-[11px]">Cost:</span>
                          <span className="font-bold text-slate-200 font-mono">৳{item.unitCost} / {item.unit}</span>
                        </div>
                        {hasSubUnitDisplay && (
                          <div className="flex items-center justify-between text-indigo-300 text-[11px] bg-indigo-950/30 px-2.5 py-1.5 rounded-xl border border-indigo-500/25">
                            <span className="font-medium">Per {subInfo.subUnit}:</span>
                            <span className="font-black text-indigo-200 font-mono">
                              ৳{((item.unitCost) / (subInfo.packSize || 1)).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {wastagePct > 0 && (
                          <div className="flex items-center justify-between text-amber-400 text-[11px] bg-amber-950/30 px-2.5 py-1.5 rounded-xl border border-amber-500/25">
                            <span className="font-medium">Effective Cost:</span>
                            <span className="font-black text-amber-300 font-mono">
                              ৳{(Math.round((item.unitCost / (1 - wastagePct / 100)) * 10) / 10).toLocaleString()} / {item.unit}
                            </span>
                          </div>
                        )}
                        {item.supplier && (
                          <div className="flex items-center justify-between text-slate-400 text-[11px] px-1 pt-0.5">
                            <span className="text-slate-500">Supplier:</span>
                            <span className="text-slate-300 truncate max-w-[150px] font-medium" title={item.supplier}>
                              {item.supplier}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Classic Table View */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Edit2 className="w-3 h-3 text-indigo-400" />
              <span className="font-medium text-slate-300">Click any row to view or edit details</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Total: {filteredItems.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-800/70 border-b border-slate-800 text-slate-400 text-xs font-black uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-4">Item & Details</th>
                  <th className="px-3 py-4 text-center">Sub Unit</th>
                  <th className="px-4 py-4 text-center">Current Stock</th>
                  <th className="px-4 py-4 text-center">Wastage %</th>
                  <th className="px-4 py-4 text-center">Min Threshold</th>
                  <th className="px-4 py-4 text-right">Unit Cost</th>
                  <th className="px-4 py-4 text-right">Total Value</th>
                  <th className="px-4 py-4 text-center">Stock Status</th>
                  <th className="px-4 py-4 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500 font-bold">
                      <Boxes className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-60" />
                      <p>No raw items found matching your criteria</p>
                      {searchTerm && (
                        <button 
                          onClick={() => setSearchTerm('')} 
                          className="mt-2 text-xs text-indigo-400 hover:underline"
                        >
                          Clear search filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const isLow = item.currentStock <= item.minStockAlert;
                    const isZero = item.currentStock <= 0;
                    const itemValue = item.currentStock * item.unitCost;
                    const ratio = item.minStockAlert > 0 ? (item.currentStock / (item.minStockAlert * 2)) * 100 : 100;
                    const stockFill = Math.min(100, Math.max(5, ratio));
                    const wastagePct = Number(item.wastagePercentage) || 0;
                    const subInfo = getRawItemSubUnitInfo(item);
                    const hasSubUnitDisplay = subInfo.hasSubUnit && Boolean(subInfo.subUnit) && subInfo.subUnit.toLowerCase() !== (item.unit || '').toLowerCase();

                    return (
                      <tr 
                        key={`${item.id}_${idx}`} 
                        onClick={() => {
                          if (!readOnly) handleEditItem(item);
                        }}
                        className={`hover:bg-slate-800/60 transition-colors ${!readOnly ? 'cursor-pointer' : ''} ${
                          isLow ? 'bg-amber-500/[0.02]' : ''
                        }`}
                        title={!readOnly ? "Click row to edit details" : undefined}
                      >
                        {/* Item Name & Details */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center space-x-3">
                            <div className="relative group/dp shrink-0">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 overflow-hidden shadow-inner ${
                                isZero 
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                                  : isLow 
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                  : 'bg-slate-800 text-indigo-400 border border-slate-700'
                              }`}>
                                {(item.dp || item.DP || item.image) ? (
                                  <img src={item.dp || item.DP || item.image} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                  item.name.slice(0, 2).toUpperCase()
                                )}
                              </div>
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setQuickDpItem(item);
                                    setQuickDpInput(item.dp || item.DP || item.image || '');
                                  }}
                                  className="absolute -bottom-1 -right-1 p-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md shadow border border-slate-900 opacity-80 group-hover/dp:opacity-100 hover:scale-110 active:scale-95 cursor-pointer"
                                  title="Set / Change DP (ছবি যুক্ত বা পরিবর্তন করুন)"
                                >
                                  <Camera className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                            {(() => {
                              const nameDisplay = getItemDisplayName(item, 'inventory', canteenConfig);
                              return (
                                <div>
                                  <div className="font-extrabold text-white text-sm flex items-center gap-2">
                                    <span>{nameDisplay.primary}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!readOnly) handleToggleClassification(item);
                                      }}
                                      title={readOnly ? undefined : "Click to toggle between Raw Item & Readymate"}
                                      className={`${readOnly ? '' : 'cursor-pointer hover:scale-105 active:scale-95 transition-all'}`}
                                    >
                                      {(item.itemType === 'READY_MADE' || isReadymadeItem(item)) ? (
                                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                          🥐 Readymate
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                          🌾 Raw Item
                                        </span>
                                      )}
                                    </button>
                                    {isLow && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold">
                                        <AlertTriangle className="w-2.5 h-2.5" /> Low
                                      </span>
                                    )}
                                  </div>
                                  {Boolean(nameDisplay.secondary) && (
                                    <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 flex-wrap">
                                      <span>{nameDisplay.secondary}</span>
                                      {hasSubUnitDisplay && (
                                        <span className="text-[10px] font-black px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded inline-flex items-center gap-1" title={`১ ${item.unit} = ${subInfo.packSize} ${subInfo.subUnit}`}>
                                          <Boxes className="w-2.5 h-2.5" />
                                          <span>{subInfo.packSize} {subInfo.subUnit} / {item.unit}</span>
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {!nameDisplay.secondary && hasSubUnitDisplay && (
                                    <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 flex-wrap mt-0.5">
                                      <span className="text-[10px] font-black px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded inline-flex items-center gap-1" title={`১ ${item.unit} = ${subInfo.packSize} ${subInfo.subUnit}`}>
                                        <Boxes className="w-2.5 h-2.5" />
                                        <span>{subInfo.packSize} {subInfo.subUnit} / {item.unit}</span>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </td>

                        {/* Sub Unit */}
                        <td className="px-3 py-3.5 text-center">
                          {item.subUnit ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider inline-flex items-center gap-1" title={`Sub-unit: ${item.subUnit}`}>
                              <Boxes className="w-2.5 h-2.5" />
                              <span>{item.subUnit}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </td>

                        {/* Current Stock */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="inline-block text-center">
                            <span className={`text-base font-black ${
                              isZero ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
                            }`}>
                              {item.currentStock}
                            </span>
                            <span className="text-xs font-bold text-slate-400 ml-1 uppercase">
                              {item.unit}
                            </span>
                            {hasSubUnitDisplay && (
                              <div className="text-[10px] text-indigo-300/90 font-bold">
                                ≈ {Math.round(item.currentStock * (subInfo.packSize || 1))} {subInfo.subUnit}
                              </div>
                            )}
                            <div className="w-20 bg-slate-800 h-1.5 rounded-full mt-1 mx-auto overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                   isZero ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${stockFill}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        {/* Wastage % */}
                        <td className="px-4 py-3.5 text-center">
                          {wastagePct > 0 ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-0.5">
                              {wastagePct}%
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </td>

                        {/* Min Threshold */}
                        <td className="px-4 py-3.5 text-center text-xs font-bold text-slate-400">
                          {item.minStockAlert} {item.unit}
                        </td>

                        {/* Unit Cost */}
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-300 text-xs">
                          <div>৳ {item.unitCost} / {item.unit}</div>
                          {hasSubUnitDisplay && (
                            <div className="text-[10px] text-indigo-300 font-bold">
                              ৳{((item.unitCost) / (subInfo.packSize || 1)).toFixed(2)} / {subInfo.subUnit}
                            </div>
                          )}
                          {wastagePct > 0 && (
                            <div className="text-[10px] text-amber-300 font-bold" title="Effective cost after wastage">
                              Eff: ৳{Math.round((item.unitCost / (1 - wastagePct / 100)) * 10) / 10}
                            </div>
                          )}
                        </td>

                        {/* Total Value */}
                        <td className="px-4 py-3.5 text-right font-black text-slate-100 text-xs">
                          ৳ {Math.round(itemValue).toLocaleString()}
                        </td>

                        {/* Stock Status Badge */}
                        <td className="px-4 py-3.5 text-center">
                          {isZero ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Stock Out
                            </span>
                          ) : isLow ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Reorder
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> In Stock
                            </span>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="px-4 py-3.5 text-center">
                          {!readOnly ? (
                            <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleEditItem(item)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer shadow-sm"
                                title="Edit Item (সম্পাদনা করুন)"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setItemToDelete(item)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 transition-all cursor-pointer shadow-sm active:scale-95"
                                title="Delete Item (আইটেম ডিলিট করুন)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer info */}
          <div className="p-3 bg-slate-850 border-t border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 px-5">
            <span>Showing {filteredItems.length} of {items.length} raw inventory records</span>
            <span className="text-[11px] text-slate-500 font-medium">Automatic balance check & threshold alerting active</span>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Raw Item */}
      {showAddModal && (
        <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    {editingItem ? 'Edit Raw Item' : 'Add New Raw Item'}
                  </h3>
                  {editingItem && (
                    <p className="text-xs text-slate-400">
                      {editingItem.name} <span className="text-slate-500">({editingItem.nameBn})</span>
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If editing item, show Tabs for Details vs Transaction History */}
            {editingItem && (
              <div className="flex items-center gap-2 pt-3 pb-1 border-b border-slate-800/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditModalTab('DETAILS')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    editModalTab === 'DETAILS'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Item Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditModalTab('HISTORY')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    editModalTab === 'HISTORY'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>History</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    editModalTab === 'HISTORY' ? 'bg-indigo-700 text-white' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {logs.filter(l => l.itemId === editingItem.id).length}
                  </span>
                </button>
              </div>
            )}

            {/* TAB CONTENT */}
            {(!editingItem || editModalTab === 'DETAILS') ? (
              <form onSubmit={handleSaveItem} className="space-y-4 pt-4 overflow-y-auto pr-1">
                {/* Item Display Picture (DP) */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Item Photo (DP) — Cloud Sync</label>
                  <div className="flex items-center gap-3.5 p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl">
                    <div className="relative w-18 h-18 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                      {newItemData.dp ? (
                        <img src={newItemData.dp} alt="Item DP" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500 p-2 text-center">
                          <ImageIcon className="w-6 h-6 opacity-60" />
                          <span className="text-[9px] font-bold uppercase mt-0.5 text-slate-500">No Photo</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload File / Camera</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const base64 = await processGalleryImage(file);
                                  setNewItemData(prev => ({ ...prev, dp: base64 }));
                                } catch (err) {
                                  console.error("Failed to load image from gallery:", err);
                                }
                              }
                            }}
                          />
                        </label>

                        {newItemData.dp && (
                          <button
                            type="button"
                            onClick={() => setNewItemData(prev => ({ ...prev, dp: '' }))}
                            className="inline-flex items-center gap-1 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            title="Remove photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Or paste image URL (https://...)"
                          value={newItemData.dp?.startsWith('data:') ? '' : (newItemData.dp || '')}
                          onChange={(e) => setNewItemData(prev => ({ ...prev, dp: e.target.value }))}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2 Options for Inventory Items */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    আইটেমের ধরণ / Inventory Classification *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Option 1: RAW Item */}
                    <div
                      onClick={() => setNewItemData(prev => ({ ...prev, itemType: 'RAW' }))}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                        (newItemData.itemType || 'RAW') === 'RAW'
                          ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-400/40'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="itemTypeOption"
                        checked={(newItemData.itemType || 'RAW') === 'RAW'}
                        onChange={() => setNewItemData(prev => ({ ...prev, itemType: 'RAW' }))}
                        className="mt-1 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="min-w-0">
                        <div className="font-black text-sm text-white flex items-center gap-1.5">
                          <span>🌾 1. RAW Item</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">কাঁচামাল</span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                          যা দিয়ে প্রসেস করে Menu Ready করা হয় (রান্নার উপাদান: চাল, ডাল, তেল, মুরগি, গুঁড়া দুধ, মসলা ইত্যাদি)
                        </p>
                      </div>
                    </div>

                    {/* Option 2: Readymate Items */}
                    <div
                      onClick={() => setNewItemData(prev => ({ 
                        ...prev, 
                        itemType: 'READY_MADE',
                        unit: (prev.unit === 'kg' || prev.unit === 'liter') ? 'pcs' : (prev.unit || 'pcs'),
                        wastagePercentage: 0,
                        hasSubUnits: false
                      }))}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                        newItemData.itemType === 'READY_MADE'
                          ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-400/40'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="itemTypeOption"
                        checked={newItemData.itemType === 'READY_MADE'}
                        onChange={() => setNewItemData(prev => ({ 
                          ...prev, 
                          itemType: 'READY_MADE',
                          unit: (prev.unit === 'kg' || prev.unit === 'liter') ? 'pcs' : (prev.unit || 'pcs'),
                          wastagePercentage: 0,
                          hasSubUnits: false
                        }))}
                        className="mt-1 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="min-w-0">
                        <div className="font-black text-sm text-white flex items-center gap-1.5">
                          <span>🥐 2. Readymate Items</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">রেডিমেট পণ্য</span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                          যা সরাসরি বাহিরে কোথাও থেকে কিনে এনে কোনো প্রসেস ছাড়াই Sell দেওয়া যায় (যেমন: Butter Ban, Sandwich, Swarma, Normal Biscuit, Dry Cake, Singara, Puri, Hotel Porota, Hotel Banana)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Item Name (English) *</label>
                    <input
                      type="text"
                      required
                      value={newItemData.name || ''}
                      onChange={(e) => setNewItemData({ ...newItemData, name: e.target.value })}
                      placeholder="e.g. Chicken, Rice, Dal"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Item Name (বাংলা)</label>
                    <input
                      type="text"
                      value={newItemData.nameBn || ''}
                      onChange={(e) => setNewItemData({ ...newItemData, nameBn: e.target.value })}
                      placeholder="বাংলা নাম (ঐচ্ছিক)"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Unit of Measure</label>
                  <select
                    value={newItemData.unit || 'kg'}
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      const u = newUnit.toLowerCase().trim();
                      const isPcs = ['pcs', 'pc', 'piece', 'টি', 'টা'].includes(u);
                      const isKg = !isPcs && u === 'kg';
                      const isLtr = !isPcs && ['liter', 'ltr', 'litre'].includes(u);
                      const isCase = !isPcs && ['case', 'crate'].includes(u);
                      const isPkt = !isPcs && ['packet', 'pkt', 'box'].includes(u);

                      setNewItemData({
                        ...newItemData,
                        unit: newUnit,
                        ...(isPcs ? {
                          hasSubUnits: false,
                          packSize: 1,
                          subUnit: undefined
                        } : isKg ? {
                          hasSubUnits: true,
                          packSize: 1000,
                          subUnit: 'gm'
                        } : isLtr ? {
                          hasSubUnits: true,
                          packSize: 1000,
                          subUnit: 'ml'
                        } : isCase ? {
                          hasSubUnits: true,
                          packSize: newItemData.packSize && newItemData.packSize > 1 ? newItemData.packSize : 30,
                          subUnit: 'pcs'
                        } : isPkt ? {
                          hasSubUnits: true,
                          packSize: newItemData.packSize && newItemData.packSize > 1 ? newItemData.packSize : 24,
                          subUnit: (newItemData.subUnit && newItemData.subUnit !== newUnit) ? newItemData.subUnit : 'pcs'
                        } : {
                          hasSubUnits: false,
                          packSize: 1,
                          subUnit: undefined
                        })
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="liter">liter (Liter)</option>
                    <option value="case">case (Case)</option>
                    <option value="packet">packet (Packet)</option>
                    <option value="pcs">pcs (Pieces)</option>
                    <option value="cylinder">cylinder (Cylinder)</option>
                    <option value="gm">gm (Gram)</option>
                    <option value="box">box (Box)</option>
                    <option value="bag">bag (Bag)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Current Stock *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newItemData.currentStock ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewItemData(prev => ({ ...prev, currentStock: val }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = newItemData.currentStock;
                          if (val === '' || val === null || val === undefined || isNaN(Number(val))) {
                            e.preventDefault();
                            setNewItemData(prev => ({ ...prev, currentStock: 0 }));
                          }
                        }
                      }}
                      onBlur={() => {
                        const val = newItemData.currentStock;
                        if (val === '' || val === null || val === undefined || isNaN(Number(val))) {
                          setNewItemData(prev => ({ ...prev, currentStock: 0 }));
                        } else {
                          setNewItemData(prev => ({ ...prev, currentStock: Number(val) }));
                        }
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Min Alert Level *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newItemData.minStockAlert ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewItemData(prev => ({ ...prev, minStockAlert: val }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = newItemData.minStockAlert;
                          if (val === '' || val === null || val === undefined || isNaN(Number(val))) {
                            e.preventDefault();
                            setNewItemData(prev => ({ ...prev, minStockAlert: 0 }));
                          }
                        }
                      }}
                      onBlur={() => {
                        const val = newItemData.minStockAlert;
                        if (val === '' || val === null || val === undefined || isNaN(Number(val))) {
                          setNewItemData(prev => ({ ...prev, minStockAlert: 0 }));
                        } else {
                          setNewItemData(prev => ({ ...prev, minStockAlert: Number(val) }));
                        }
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Unit Cost (৳) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newItemData.unitCost ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewItemData(prev => ({ ...prev, unitCost: val }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = newItemData.unitCost;
                          if (val === '' || val === null || val === undefined || isNaN(Number(val))) {
                            e.preventDefault();
                            setNewItemData(prev => ({ ...prev, unitCost: 0 }));
                          }
                        }
                      }}
                      onBlur={() => {
                        const val = newItemData.unitCost;
                        if (val === '' || val === null || val === undefined || isNaN(Number(val))) {
                          setNewItemData(prev => ({ ...prev, unitCost: 0 }));
                        } else {
                          setNewItemData(prev => ({ ...prev, unitCost: Number(val) }));
                        }
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-400 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Percent className="w-3.5 h-3.5 text-amber-400" />
                        <span>Wastage %</span>
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max="99"
                        value={newItemData.wastagePercentage ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewItemData(prev => ({ ...prev, wastagePercentage: val }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = newItemData.wastagePercentage;
                            if (val === '' || val === null || val === undefined || isNaN(Number(val))) {
                              e.preventDefault();
                              setNewItemData(prev => ({ ...prev, wastagePercentage: 0 }));
                            }
                          }
                        }}
                        onBlur={() => {
                          const val = newItemData.wastagePercentage;
                          if (val === '' || val === null || val === undefined || isNaN(Number(val))) {
                            setNewItemData(prev => ({ ...prev, wastagePercentage: 0 }));
                          } else {
                            setNewItemData(prev => ({ ...prev, wastagePercentage: Number(val) }));
                          }
                        }}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-slate-800 border border-amber-500/40 rounded-xl text-amber-300 font-bold text-sm focus:outline-none focus:border-amber-400 pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400/80">%</span>
                    </div>
                  </div>
                </div>

                {/* Packaging & Sub-Units Configuration */}
                {(() => {
                  const currentSelectedUnit = (newItemData.unit || '').toLowerCase().trim();
                  const isUnitPcs = ['pcs', 'pc', 'piece', 'টি', 'টা'].includes(currentSelectedUnit);

                  if (isUnitPcs) {
                    return (
                      <div className="bg-slate-950/70 border border-slate-800/90 p-3.5 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>Standard Unit (Pieces)</span>
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                                {newItemData.unit || 'pcs'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Count-based item. No sub-units required.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const availableSubUnits = [
                    { val: 'pcs', label: 'pcs (Pieces)' },
                    { val: 'slice', label: 'slice (Slice)' },
                    { val: 'cup', label: 'cup (Cup)' },
                    { val: 'sheet', label: 'sheet (Sheet)' },
                    { val: 'gm', label: 'gm (Gram)' },
                    { val: 'ml', label: 'ml (Milli-liter)' }
                  ].filter(opt => opt.val !== currentSelectedUnit);

                  const defaultSub = availableSubUnits[0]?.val || 'pcs';
                  const activeSub = (newItemData.subUnit && newItemData.subUnit !== currentSelectedUnit)
                    ? newItemData.subUnit
                    : defaultSub;

                  return (
                    <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-black text-white flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Sub-Units Configuration</span>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={Boolean(newItemData.hasSubUnits)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setNewItemData({
                                ...newItemData,
                                hasSubUnits: checked,
                                packSize: checked ? (newItemData.packSize && newItemData.packSize > 1 ? newItemData.packSize : 100) : 1,
                                subUnit: checked ? activeSub : undefined
                              });
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      {newItemData.hasSubUnits && (
                        <div className="pt-2 border-t border-slate-800/80 space-y-3 animate-in fade-in duration-200">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Pack Size ({newItemData.unit || 'pack'}) *
                              </label>
                              <input
                                type="number"
                                min="2"
                                step="1"
                                value={newItemData.packSize ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setNewItemData(prev => ({ ...prev, packSize: val }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = newItemData.packSize;
                                    if (val === '' || val === null || val === undefined || isNaN(Number(val)) || Number(val) < 2) {
                                      e.preventDefault();
                                      setNewItemData(prev => ({ ...prev, packSize: 100 }));
                                    }
                                  }
                                }}
                                onBlur={() => {
                                  const val = newItemData.packSize;
                                  if (val === '' || val === null || val === undefined || isNaN(Number(val)) || Number(val) < 2) {
                                    setNewItemData(prev => ({ ...prev, packSize: 100 }));
                                  } else {
                                    setNewItemData(prev => ({ ...prev, packSize: Math.max(2, parseInt(String(val)) || 2) }));
                                  }
                                }}
                                placeholder="e.g. 100"
                                className="w-full px-3 py-2 bg-slate-900 border border-indigo-500/40 rounded-xl text-white font-black text-sm focus:outline-none focus:border-indigo-400"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Sub-Unit Name
                              </label>
                              <select
                                value={activeSub}
                                onChange={(e) => setNewItemData({ ...newItemData, subUnit: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm font-bold focus:outline-none focus:border-indigo-500"
                              >
                                {availableSubUnits.map(opt => (
                                  <option key={opt.val} value={opt.val}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Live Calculation Preview */}
                          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between text-indigo-300 font-bold">
                              <span>Ratio:</span>
                              <span className="font-mono text-white">
                                1 {newItemData.unit || 'packet'} = {newItemData.packSize || 100} {activeSub}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-indigo-200">
                              <span>Unit Cost per {activeSub}:</span>
                              <span className="font-black text-amber-300 text-sm">
                                ৳{((Number(newItemData.unitCost) || 0) / Math.max(1, (Number(newItemData.packSize) || 1))).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Supplier</label>
                  <input
                    type="text"
                    value={newItemData.supplier || ''}
                    onChange={(e) => setNewItemData({ ...newItemData, supplier: e.target.value })}
                    placeholder="e.g. Local Market / Vendor"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={newItemData.notes || ''}
                    onChange={(e) => setNewItemData({ ...newItemData, notes: e.target.value })}
                    placeholder="Optional notes or specifications..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  ></textarea>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  {editingItem ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteItem(editingItem);
                      }}
                      className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl text-xs font-bold transition-colors border border-rose-500/20 flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Item</span>
                    </button>
                  ) : (
                    <div></div>
                  )}
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <SaveButton
                      type="submit"
                      isSaving={isSavingItem}
                      isSaved={isSavedItem}
                      idleText={editingItem ? 'Update Item' : 'Save Item'}
                      savingText="Saving..."
                      savedText={editingItem ? 'ITEM UPDATED! ✓' : 'ITEM SAVED! ✓'}
                      className="px-5 py-2"
                    />
                  </div>
                </div>
              </form>
            ) : (
              /* TAB: History */
              <div className="pt-4 flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-1.5 mb-3 text-xs text-slate-300 font-bold">
                  <History className="w-4 h-4 text-indigo-400" />
                  <span>Transaction History</span>
                </div>

                {/* History Log Table */}
                <div className="flex-1 flex flex-col min-h-0 bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
                  <div className="overflow-x-auto flex-1 flex flex-col min-h-0">
                    <div className="min-w-[480px] flex-1 flex flex-col min-h-0">
                      {/* Fixed Table Heading Row */}
                      <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 text-[11px] font-black text-slate-300 uppercase tracking-wider shrink-0 select-none items-center">
                        <div className="col-span-3 text-left">Date</div>
                        <div className="col-span-4 text-left">Menu</div>
                        <div className="col-span-2 text-right">Qty</div>
                        <div className="col-span-3 text-right">Available</div>
                      </div>

                      {/* Scrollable Table Rows (Newest on top) */}
                      <div className="overflow-y-auto flex-1 divide-y divide-slate-800/60 max-h-[48vh]">
                        {logs.filter(l => l.itemId === editingItem.id).length === 0 ? (
                          <div className="p-10 text-center text-slate-500">
                            <History className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-600" />
                            <p className="text-xs font-semibold">No transaction history recorded yet.</p>
                          </div>
                        ) : (
                          logs
                            .filter(l => l.itemId === editingItem.id)
                            .slice()
                            .sort((a, b) => {
                              const timeA = new Date(a.date).getTime() || 0;
                              const timeB = new Date(b.date).getTime() || 0;
                              if (timeA !== timeB) return timeB - timeA;
                              return (b.id || '').localeCompare(a.id || '');
                            })
                            .map(log => {
                              const isRestock = log.type === 'RESTOCK';

                              // Extract clean Menu / Item description
                              let menuDesc = '-';
                              if (log.notes) {
                                let clean = log.notes
                                  .replace(/\[AUTO ISSUE - MENU SALE\]/gi, '')
                                  .replace(/\[AUTO RESTOCK - EXPENDITURE\]/gi, '')
                                  .replace(/\[AUTO ISSUE - ORDER\]/gi, '')
                                  .replace(/^Restocked via:?/i, '')
                                  .replace(/^Restocked from:?/i, '')
                                  .replace(/^Auto restock from:?/i, '')
                                  .trim();
                                if (clean.startsWith(':')) clean = clean.substring(1).trim();
                                
                                // If clean contains multiple items separated by comma, filter down to only ones that actually use this raw item
                                if (clean.includes(',')) {
                                  const parts = clean.split(',').map(p => p.trim()).filter(Boolean);
                                  const matchedParts = parts.filter(part => {
                                    const pureName = part.replace(/\s*x\s*\d+(\.\d+)?$/i, '').trim();
                                    const recipe = getRecipeForMenuItem('', pureName);
                                    return recipe && recipe.some(ing => 
                                      ing.rawItemId === editingItem.id ||
                                      (ing.rawItemName && ing.rawItemName.toLowerCase() === editingItem.name.toLowerCase())
                                    );
                                  });
                                  if (matchedParts.length > 0) {
                                    clean = matchedParts.join(', ');
                                  }
                                }
                                if (clean) menuDesc = clean;
                              }
                              if (menuDesc === '-' && log.recordedBy) {
                                menuDesc = log.recordedBy;
                              }

                              return (
                                <div 
                                  key={log.id} 
                                  className="grid grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-slate-900/40 transition-colors text-xs"
                                >
                                  {/* 1. Date */}
                                  <div className="col-span-3 font-mono font-medium text-slate-300 text-[11px] whitespace-nowrap" title={formatCanteenDate(log.date)}>
                                    {formatCanteenDate(log.date)}
                                  </div>

                                  {/* 2. Menu */}
                                  <div className="col-span-4 font-bold text-white text-xs break-words pr-1 leading-snug" title={menuDesc}>
                                    {menuDesc}
                                  </div>

                                  {/* 3. Qty */}
                                  <div className="col-span-2 text-right whitespace-nowrap">
                                    <span className={`font-black font-mono text-xs ${isRestock ? 'text-emerald-400' : 'text-amber-400'}`}>
                                      {isRestock ? '+' : '-'}{log.quantity}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                                      {log.unit}
                                    </span>
                                  </div>

                                  {/* 4. Available */}
                                  <div className="col-span-3 text-right whitespace-nowrap">
                                    <span className="font-mono font-bold text-slate-100 text-xs">
                                      {log.newStock}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                                      {log.unit}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Restock Item */}
      {showRestockModal && (() => {
        const currentItem = items.find(i => i.id === selectedItemId) || items[0];
        const mainUnit = currentItem?.unit || 'pcs';
        const subInfo = getRawItemSubUnitInfo(currentItem);
        const hasSub = subInfo.hasSubUnit && Boolean(subInfo.subUnit) && subInfo.subUnit.toLowerCase() !== mainUnit.toLowerCase();
        const pSize = subInfo.packSize || 1;
        const subUnit = subInfo.subUnit || 'pcs';
        const parsedQty = parseFloat(restockQty) || 0;
        const equivalentInOther = restockUnitMode === 'SUB' 
          ? `${(parsedQty / pSize).toFixed(2)} ${mainUnit}`
          : `${Math.round(parsedQty * pSize)} ${subUnit}`;

        return (
          <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center pb-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <PackagePlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">
                      Restock Raw Item
                    </h3>
                    {currentItem && (
                      <p className="text-xs text-slate-400">
                        {currentItem.name} <span className="text-slate-500">({currentItem.nameBn})</span>
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => setShowRestockModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRestock} className="space-y-4 pt-4 overflow-y-auto pr-1">
                {/* Item Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Select Item *</label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedItemId(id);
                      const it = items.find(i => i.id === id);
                      if (it) {
                        setRestockCost(String(it.unitCost));
                        setRestockSupplier(it.supplier || '');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    {items.map((it, itIdx) => (
                      <option key={`${it.id}_${itIdx}`} value={it.id}>
                        {it.name} ({it.nameBn}) — Stock: {it.currentStock} {it.unit}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity Input with Unit Toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-400">
                      Restock Quantity ({restockUnitMode === 'SUB' ? subUnit : mainUnit}) *
                    </label>
                    {hasSub && (
                      <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setRestockUnitMode('MAIN')}
                          className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                            restockUnitMode === 'MAIN' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {mainUnit}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestockUnitMode('SUB')}
                          className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                            restockUnitMode === 'SUB' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {subUnit}
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    required
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value)}
                    placeholder={`e.g. ${restockUnitMode === 'SUB' ? 30 : 1}`}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-base font-bold focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                  {hasSub && parsedQty > 0 && (
                    <p className="text-[11px] text-emerald-400 font-semibold mt-1">
                      ≈ {equivalentInOther} (1 {mainUnit} = {pSize} {subUnit})
                    </p>
                  )}
                </div>

                {/* Unit Cost & Supplier */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Purchase Rate (৳ per {mainUnit}) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={restockCost}
                      onChange={(e) => setRestockCost(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                    {hasSub && currentItem && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        Per {subUnit}: ৳{((parseFloat(restockCost) || 0) / pSize).toFixed(2)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Supplier</label>
                    <input
                      type="text"
                      value={restockSupplier}
                      onChange={(e) => setRestockSupplier(e.target.value)}
                      placeholder="e.g. Poultry Farm / Local Market"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={restockNotes}
                    onChange={(e) => setRestockNotes(e.target.value)}
                    placeholder="e.g. Daily morning egg purchase"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Modal Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowRestockModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <SaveButton
                    type="submit"
                    variant="emerald"
                    isSaving={isSavingRestock}
                    isSaved={isSavedRestock}
                    icon={<PackagePlus className="w-4 h-4" />}
                    idleText="Confirm Restock"
                    savingText="Restocking..."
                    savedText="RESTOCKED SUCCESSFULLY! ✓"
                    className="px-5 py-2"
                  />
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Issue / Kitchen Usage */}
      {showIssueModal && (() => {
        const currentItem = items.find(i => i.id === selectedItemId) || items[0];
        const mainUnit = currentItem?.unit || 'pcs';
        const subInfo = getRawItemSubUnitInfo(currentItem);
        const hasSub = subInfo.hasSubUnit && Boolean(subInfo.subUnit) && subInfo.subUnit.toLowerCase() !== mainUnit.toLowerCase();
        const pSize = subInfo.packSize || 1;
        const subUnit = subInfo.subUnit || 'pcs';
        const parsedQty = parseFloat(issueQty) || 0;
        const qtyInMain = (issueUnitMode === 'SUB' && pSize > 1) ? parsedQty / pSize : parsedQty;
        const remainingStock = Math.max(0, (currentItem?.currentStock || 0) - qtyInMain);

        return (
          <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center pb-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <ArrowDownRight className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">
                      Issue / Usage
                    </h3>
                    {currentItem && (
                      <p className="text-xs text-slate-400">
                        {currentItem.name} <span className="text-slate-500">({currentItem.nameBn})</span> • Current: <strong className="text-emerald-400">{currentItem.currentStock} {mainUnit}</strong>
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveIssue} className="space-y-4 pt-4 overflow-y-auto pr-1">
                {/* Item Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Select Item *</label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    {items.map((it, itIdx) => (
                      <option key={`${it.id}_${itIdx}`} value={it.id}>
                        {it.name} ({it.nameBn}) — Stock: {it.currentStock} {it.unit}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Issue Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Issue Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIssueType('ISSUE')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                        issueType === 'ISSUE'
                          ? 'bg-amber-600/30 border-amber-500 text-amber-300 shadow-xs'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      <span>Kitchen Issue</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIssueType('WASTAGE')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                        issueType === 'WASTAGE'
                          ? 'bg-rose-600/30 border-rose-500 text-rose-300 shadow-xs'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Percent className="w-3.5 h-3.5" />
                      <span>Wastage</span>
                    </button>
                  </div>
                </div>

                {/* Quantity Input with Unit Toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-400">
                      Quantity ({issueUnitMode === 'SUB' ? subUnit : mainUnit}) *
                    </label>
                    {hasSub && (
                      <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setIssueUnitMode('MAIN')}
                          className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                            issueUnitMode === 'MAIN' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {mainUnit}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIssueUnitMode('SUB')}
                          className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                            issueUnitMode === 'SUB' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {subUnit}
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    required
                    value={issueQty}
                    onChange={(e) => setIssueQty(e.target.value)}
                    placeholder={`e.g. ${issueUnitMode === 'SUB' ? 10 : 1}`}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-base font-bold focus:outline-none focus:border-amber-500"
                    autoFocus
                  />
                  {parsedQty > 0 && currentItem && (
                    <div className="mt-1 text-[11px] flex items-center justify-between text-slate-400">
                      <span>
                        Remaining Stock: <strong className="text-white">{remainingStock.toFixed(2)} {mainUnit}</strong>
                        {hasSub && <span> (≈ {Math.round(remainingStock * pSize)} {subUnit})</span>}
                      </span>
                      {hasSub && issueUnitMode === 'SUB' && (
                        <span className="text-amber-400 font-semibold">
                          = {(parsedQty / pSize).toFixed(2)} {mainUnit}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Notes</label>
                  <input
                    type="text"
                    value={issueNotes}
                    onChange={(e) => setIssueNotes(e.target.value)}
                    placeholder="e.g. Breakfast omelet preparation"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Modal Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <SaveButton
                    type="submit"
                    variant="amber"
                    isSaving={isSavingIssue}
                    isSaved={isSavedIssue}
                    icon={<ArrowDownRight className="w-4 h-4" />}
                    idleText="Confirm Deduction"
                    savingText="Deducting..."
                    savedText="DEDUCTION RECORDED! ✓"
                    className="px-5 py-2"
                  />
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Stock Transaction Logs */}
      {showLogsModal && (
        <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-4xl shadow-2xl animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <span>Raw Stock Movement Logs</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Expenditures restock & POS sales item deduction history
                  </p>
                </div>
              </div>
              <button onClick={() => setShowLogsModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter buttons */}
            <div className="py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 shrink-0">
              <div className="flex items-center space-x-1.5 overflow-x-auto">
                <button
                  onClick={() => setLogFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    logFilter === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  All Logs ({logs.length})
                </button>
                <button
                  onClick={() => setLogFilter('RESTOCK')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    logFilter === 'RESTOCK'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-800 text-emerald-400 hover:text-white'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Auto Restock ({logs.filter(l => l.type === 'RESTOCK').length})</span>
                </button>
                <button
                  onClick={() => setLogFilter('ISSUE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    logFilter === 'ISSUE'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-800 text-amber-400 hover:text-white'
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Auto Issue ({logs.filter(l => l.type === 'ISSUE').length})</span>
                </button>
                <button
                  onClick={() => setLogFilter('WASTAGE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    logFilter === 'WASTAGE'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-800 text-rose-400 hover:text-white'
                  }`}
                >
                  Wastage ({logs.filter(l => l.type === 'WASTAGE').length})
                </button>
              </div>

              <div className="text-[11px] text-slate-400">
                Total Logs: <span className="font-bold text-white">{logs.length}</span>
              </div>
            </div>

            {/* Logs List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
              {(() => {
                const filteredLogs = logs.filter(l => {
                  if (logFilter === 'ALL') return true;
                  return l.type === logFilter;
                });

                if (filteredLogs.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-500 font-bold">
                      <Boxes className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                      <p>No movement logs found</p>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-slate-800/60">
                    {filteredLogs.map(log => {
                      const isRestock = log.type === 'RESTOCK';
                      const isAutoRestock = log.notes?.includes('AUTO RESTOCK') || log.notes?.includes('Expenditure') || log.recordedBy?.includes('Expenditure');
                      const isAutoIssue = log.notes?.includes('AUTO ISSUE') || log.notes?.includes('POS') || log.recordedBy?.includes('POS');

                      return (
                        <div key={log.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 px-3 rounded-xl transition-colors">
                          <div className="flex items-start space-x-3 min-w-0">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              isRestock 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : log.type === 'WASTAGE' 
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {isRestock ? (
                                <ArrowUpRight className="w-5 h-5" />
                              ) : (
                                <ArrowDownRight className="w-5 h-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className="font-extrabold text-sm text-white">
                                  {log.itemName}
                                </span>
                                {isAutoRestock && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    [AUTO RESTOCK - EXPENDITURE]
                                  </span>
                                )}
                                {isAutoIssue && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    [AUTO ISSUE - MENU SALE]
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>Previous: <strong className="text-slate-300">{log.previousStock} {log.unit}</strong></span>
                                <span>→</span>
                                <span>New Balance: <strong className={isRestock ? 'text-emerald-400' : 'text-amber-400'}>{log.newStock} {log.unit}</strong></span>
                                {log.cost ? (
                                  <span>• Cost: <strong className="text-emerald-400">৳ {Math.round(log.cost).toLocaleString()}</strong></span>
                                ) : null}
                              </div>

                              <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3">
                                <span>Ref: {log.notes || log.type}</span>
                                <span>• By: {log.recordedBy || 'System Auto'}</span>
                                <span>• {log.date}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0 sm:self-center pl-12 sm:pl-0">
                            <div className={`font-black text-base ${
                              isRestock ? 'text-emerald-400' : 'text-amber-400'
                            }`}>
                              {isRestock ? '+' : '-'}{log.quantity} <span className="text-xs uppercase">{log.unit}</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              Bal: {log.newStock} {log.unit}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="pt-3 border-t border-slate-800 shrink-0 flex justify-between items-center">
              <span className="text-xs text-slate-400">
                Auto Stock Logging Active
              </span>
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK DP PHOTO MODAL: Instantly set or upload image synced to Supabase DP column */}
      {quickDpItem && (
        <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    Set Item Photo (DP)
                  </h3>
                  <p className="text-xs text-slate-400 font-medium truncate max-w-[220px]">
                    {quickDpItem.name} {quickDpItem.nameBn ? `(${quickDpItem.nameBn})` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuickDpItem(null);
                  setQuickDpInput('');
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview Box */}
            <div className="flex flex-col items-center justify-center gap-3 p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
              <div className="relative w-28 h-28 rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden shadow-inner flex items-center justify-center">
                {quickDpInput ? (
                  <img src={quickDpInput} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 p-2 text-center">
                    <ImageIcon className="w-10 h-10 opacity-50" />
                    <span className="text-[10px] font-bold uppercase mt-1">No Image</span>
                  </div>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                {quickDpInput ? 'Photo ready to save to Supabase Cloud' : 'Select a picture or paste image link'}
              </span>
            </div>

            {/* Action buttons: Upload File & URL */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95">
                  <Upload className="w-4 h-4" />
                  <span>Choose from Gallery / Camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const base64 = await processGalleryImage(file);
                          setQuickDpInput(base64);
                        } catch (err) {
                          console.error("Failed to process image:", err);
                        }
                      }
                    }}
                  />
                </label>

                {quickDpInput && (
                  <button
                    type="button"
                    onClick={() => setQuickDpInput('')}
                    className="px-3 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    title="Clear Image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Or Paste Image URL (https://...)</label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  value={quickDpInput.startsWith('data:') ? '' : quickDpInput}
                  onChange={(e) => setQuickDpInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setQuickDpItem(null);
                  setQuickDpInput('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingDp}
                onClick={() => handleQuickUpdateDp(quickDpItem.id, quickDpInput)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                {isUpdatingDp ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to Cloud...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save DP to Cloud</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Popup Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[350] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                <Trash2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-white">কাঁচামাল ডিলিট নিশ্চিতকরণ</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                আপনি কি নিশ্চিত যে আপনি এই কাঁচামালটি ইনভেন্টরি থেকে স্থায়ীভাবে মুছে ফেলতে চান?
              </p>
            </div>

            {/* Target Item Summary Box */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                {(itemToDelete.dp || itemToDelete.DP || itemToDelete.image) ? (
                  <img src={itemToDelete.dp || itemToDelete.DP || itemToDelete.image} alt={itemToDelete.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-black text-indigo-400">{itemToDelete.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-black text-white truncate">{itemToDelete.name}</h4>
                <p className="text-xs text-slate-400 truncate">{itemToDelete.nameBn}</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] font-mono">
                  <span className="text-emerald-400 font-bold">স্টক: {itemToDelete.currentStock} {itemToDelete.unit}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-indigo-300 font-bold">৳{itemToDelete.unitCost}/{itemToDelete.unit}</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                এটি মুছে ফেললে এই আইটেমটি ইনভেন্টরি ও ক্লাউড ডাটাবেজ থেকে স্থায়ীভাবে বাদ পড়বে এবং সংশ্লিষ্ট মেনু রেসিপির মজুদ হিসাব স্বয়ংক্রিয়ভাবে পরিবর্তিত হবে।
              </span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingItem}
                onClick={() => setItemToDelete(null)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="button"
                disabled={isDeletingItem}
                onClick={confirmAndDeleteItem}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                {isDeletingItem ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>মুছে ফেলা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>হ্যাঁ, মুছে ফেলুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Defaults Confirmation Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
                <RotateCcw className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-white">রিসেট কনফার্মেশন</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                কাঁচামালের তালিকা কি ডিফল্ট তালিকায় রিসেট করতে চান? (Chicken, Rice, Dal, Milk Powder ইত্যাদি প্রাথমিক আইটেমগুলো পুনরায় সেট হবে)।
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="button"
                onClick={confirmResetToDefault}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>হ্যাঁ, রিসেট করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import & Update Stock Modal */}
      <ImportStockModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        items={items}
        onStockUpdated={async (updatedItems, newLogs) => {
          setItems(updatedItems);
          saveRawInventoryItems(updatedItems);
          if (newLogs && newLogs.length > 0) {
            setLogs(prev => {
              const merged = [...newLogs, ...(Array.isArray(prev) ? prev : [])];
              try {
                localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(merged));
              } catch {}
              queuePushKeyToCloud('canteen_raw_stock_logs', merged);
              return merged;
            });
          }
          queuePushKeyToCloud('canteen_raw_inventory_items_v2', updatedItems);
          setTimeout(() => {
            window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
            window.dispatchEvent(new Event('canteen_raw_stock_logs_updated'));
          }, 0);
        }}
      />
    </div>
  );
};
