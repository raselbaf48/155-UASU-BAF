import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Plus, Edit2, Trash2, PackagePlus, AlertTriangle, 
  CheckCircle2, RotateCcw, Layers, ArrowDownRight, ArrowUpRight, 
  History, Filter, ShoppingBag, X, Save, AlertCircle, FileSpreadsheet,
  Boxes, ChefHat, Sparkles, Percent, LayoutGrid, List
} from 'lucide-react';
import { formatMoney, formatNumber } from '../i18n';
import { supabase } from '../../../supabase';
import { 
  RawInventoryItem, 
  RawStockLog, 
  RAW_ITEMS_STORAGE_KEY, 
  RAW_LOGS_STORAGE_KEY,
  getRawInventoryItems,
  saveRawInventoryItems,
  deduplicateRawItems,
  getEffectiveRawUnitCost,
  getRawItemSubUnitInfo
} from '../utils/recipeManager';
import { queuePushKeyToCloud } from '../utils/canteenCloudSync';

export type { RawInventoryItem, RawStockLog };

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
    nameBn: 'গুঁড়া দুধ (Dano/Diploma)',
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
    nameBn: 'কাঁচা পাস্তা (Macaroni/Spiral)',
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
    nameBn: 'ম্যাগি মসলা (Maggi Mosla)',
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
    nameBn: 'কাঁচা মরিচ (Green Chili)',
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
    nameBn: 'কফি পাউডার (Coffee)',
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
    nameBn: 'ড্রাই কেক (Dry Cake)',
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
    nameBn: 'খাবার লবণ (Salt)',
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
    nameBn: 'বিট লবণ (Bit Lobon / Black Salt)',
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

  const [newItemData, setNewItemData] = useState<{
    name?: string;
    nameBn?: string;
    category?: string;
    subCategory?: string;
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
  }>({
    name: '',
    nameBn: '',
    category: 'Fuel & Utilities',
    subCategory: '',
    unit: 'kg',
    currentStock: 10,
    minStockAlert: 5,
    unitCost: 100,
    supplier: '',
    notes: '',
    wastagePercentage: 0,
    hasSubUnits: true,
    packSize: 1000,
    subUnit: 'gm'
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
            return {
              id: String(r.id),
              name: r.name || '',
              nameBn: r.nameBn || r.name_bn || r.name || '',
              category: meta.category || r.category || 'Packaging & Disposables',
              subCategory: meta.subCategory || r.subCategory || r.sub_category || '',
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
              subUnit: rawSubUnit || (isKg ? 'gm' : (isLtr ? 'ml' : (meta.subUnit || r.subUnit || r.sub_unit || 'pcs')))
            };
          });
          setItems(prev => {
            const combined = [...(Array.isArray(prev) ? prev : []), ...mapped];
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

    // Realtime listener for Canteen_Inventory
    const channel = supabase
      .channel('canteen_inventory_realtime')
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
      try {
        window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
      } finally {
        isSelfDispatchingRef.current = false;
      }
    } catch (e) {
      console.warn('Failed to save raw items:', e);
    }

    // Push full rich object to app_settings cloud key for complete persistence
    queuePushKeyToCloud('canteen_raw_inventory_items_v2', items);

    if (items.length > 0) {
      const payload = items.map(it => ({
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
      try {
        window.dispatchEvent(new Event('canteen_raw_stock_logs_updated'));
      } finally {
        isSelfDispatchingRef.current = false;
      }
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

    return {
      totalItems,
      totalValue,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      healthPercent
    };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list.filter(item => {
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
    });
  }, [items, searchTerm, stockStatusFilter]);

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

    setLogs(prev => [...newLogsToAdd, ...prev]);

    setShowRestockModal(false);
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
    setLogs(prev => [newLog, ...prev]);

    setShowIssueModal(false);
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
      setItems(prev => prev.map(i => {
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

          return {
            ...i,
            name: newItemData.name!.trim(),
            nameBn: newItemData.nameBn?.trim() || newItemData.name!.trim(),
            unit: unit,
            currentStock: parsedStock,
            minStockAlert: parsedMinAlert,
            unitCost: parsedUnitCost,
            supplier: newItemData.supplier?.trim(),
            notes: newItemData.notes?.trim(),
            wastagePercentage: parsedWastage,
            hasSubUnits,
            packSize,
            subUnit
          };
        }
        return i;
      }));
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

      const newItem: RawInventoryItem = {
        id: `raw-${Date.now()}`,
        name: newItemData.name!.trim(),
        nameBn: newItemData.nameBn?.trim() || newItemData.name!.trim(),
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
        subUnit
      };
      setItems(prev => [newItem, ...prev]);

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

      setLogs(prev => [...initialLogs, ...prev]);
    }

    setShowAddModal(false);
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
      subUnit: isPcs ? undefined : isKg ? 'gm' : isLtr ? 'ml' : isCase ? 'pcs' : (hasConfiguredSub && item.subUnit && item.subUnit.toLowerCase().trim() !== u ? item.subUnit : (isPkt ? 'pcs' : undefined))
    });
    setShowAddModal(true);
  };

  const handleDeleteItem = async (item: RawInventoryItem) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete ${item.name} (${item.nameBn})?`);
    if (confirmDelete) {
      setItems(prev => prev.filter(i => i.id !== item.id));
      try {
        await supabase.from('Canteen_Inventory').delete().eq('id', item.id);
      } catch (err) {
        console.warn('Delete from Canteen_Inventory table note:', err);
      }
    }
  };

  // Reset to default
  const handleResetToDefault = () => {
    const confirmReset = window.confirm('Reset raw inventory items to original list? This will restore standard items (Chicken, Rice, Dal, Milk Powder, etc.).');
    if (confirmReset) {
      const { deduplicated } = deduplicateRawItems(INITIAL_RAW_ITEMS);
      setItems(deduplicated);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
      
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span>RAW INVENTORY</span>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold uppercase tracking-wider">
                  কাঁচামাল স্টক
                </span>
              </h2>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                Kitchen ingredients, packaging & essential canteen raw stock management
              </p>
            </div>
          </div>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setEditingItem(null);
                setEditModalTab('DETAILS');
                setNewItemData({
                  name: '',
                  nameBn: '',
                  unit: 'kg',
                  currentStock: 10,
                  minStockAlert: 5,
                  unitCost: 100,
                  supplier: '',
                  notes: '',
                  wastagePercentage: 0,
                  hasSubUnits: true,
                  packSize: 1000,
                  subUnit: 'gm'
                });
                setShowAddModal(true);
              }}
              className="flex items-center space-x-2 px-4 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-xs font-black tracking-wider transition-all shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>NEW RAW ITEM</span>
            </button>

            <button
              onClick={() => setShowLogsModal(true)}
              className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
              title="View Stock In / Out Log History"
            >
              <History className="w-4 h-4 text-indigo-400" />
              <span>LOGS / হিস্ট্রি</span>
            </button>
          </div>
        )}
      </div>

      {/* Automated Sync Information Banner */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-indigo-950/30 border border-indigo-500/25 rounded-2xl p-4 flex items-start gap-3.5 text-xs shadow-sm">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <div className="font-extrabold text-white flex items-center gap-2">
            <span>স্বয়ংক্রিয় কাঁচামাল স্টক সিস্টেম সক্রিয়</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              Automated Restock & Issue Active
            </span>
          </div>
          <div className="text-slate-300 leading-relaxed grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
            <div className="flex items-center gap-2 bg-slate-800/40 px-2.5 py-1.5 rounded-lg border border-slate-700/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
              <span><strong>Auto-Restock:</strong> Expenditures এ কেনাকাটার সাথে সাথে স্টক স্বয়ংক্রিয়ভাবে বৃদ্ধি পায়।</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/40 px-2.5 py-1.5 rounded-lg border border-slate-700/40">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
              <span><strong>Auto-Issue:</strong> POS Sales এ মেনু বিক্রি হলে প্রয়োজনীয় কাঁচামাল স্বয়ংক্রিয়ভাবে বিয়োগ হয়।</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Items */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
            Total Raw Items
          </div>
          <div className="text-3xl font-black text-white mt-1">
            {stats.totalItems} <span className="text-xs font-bold text-slate-500 uppercase">Items</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span>Kitchen raw stock items</span>
          </div>
        </div>

        {/* Card 2: Total Stock Value */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
            Total Stock Value
          </div>
          <div className="text-3xl font-black text-emerald-400 mt-1">
            {formatMoney(stats.totalValue, 'en')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Current warehouse valuation</span>
          </div>
        </div>

        {/* Card 3: Low Stock Alerts */}
        <div 
          onClick={() => setStockStatusFilter(stockStatusFilter === 'LOW' ? 'ALL' : 'LOW')}
          className={`bg-slate-900 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all ${
            stats.lowStockCount > 0 
              ? 'border-amber-500/40 bg-amber-950/10 hover:border-amber-400' 
              : 'border-slate-800 hover:border-slate-700'
          } ${stockStatusFilter === 'LOW' ? 'ring-2 ring-amber-500' : ''}`}
        >
          <div className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center justify-between">
            <span>Low Stock Alert</span>
            {stats.lowStockCount > 0 && (
              <span className="animate-pulse flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            )}
          </div>
          <div className="text-3xl font-black text-amber-400 mt-1">
            {stats.lowStockCount} <span className="text-xs font-bold text-slate-500 uppercase">Items</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {stats.lowStockCount > 0 ? 'Click to filter reorder items' : 'All items sufficiently stocked'}
          </div>
        </div>

        {/* Card 4: Inventory Health */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
            Stock Availability
          </div>
          <div className="text-3xl font-black text-indigo-400 mt-1">
            {stats.healthPercent}%
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div 
              className={`h-full rounded-full ${stats.healthPercent > 80 ? 'bg-emerald-500' : stats.healthPercent > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
              style={{ width: `${stats.healthPercent}%` }}
            ></div>
          </div>
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
              placeholder="Search raw items (e.g. Chicken, Rice, Dal, Milk Powder, Oil, Egg)..."
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
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>আইটেমের বক্সে ক্লিক করে সরাসরি তথ্য এডিট বা অপচয় % পরিবর্তন করতে পারেন</span>
            </span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map(item => {
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
                    key={item.id}
                    onClick={() => {
                      if (!readOnly) handleEditItem(item);
                    }}
                    className={`bg-slate-900 border rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all duration-200 relative group flex flex-col justify-between ${
                      !readOnly ? 'cursor-pointer hover:border-indigo-500/70 hover:scale-[1.01] active:scale-[0.99]' : ''
                    } ${
                      isZero
                        ? 'border-rose-500/40 bg-rose-950/10'
                        : isLow
                        ? 'border-amber-500/40 bg-amber-950/10'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Top Row: Icon, Names & Status Badge */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${
                            isZero 
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                              : isLow 
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                              : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                          }`}>
                            {item.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-white text-base truncate flex items-center gap-1.5" title={item.name}>
                              <span>{item.name}</span>
                            </h4>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs text-slate-400 font-medium truncate" title={item.nameBn}>
                                {item.nameBn}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isZero ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Out
                            </span>
                          ) : isLow ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Low
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> OK
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Unit & Wastage Tag Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 border border-slate-700/60 uppercase">
                          {item.unit}
                        </span>

                        {hasSubUnitDisplay && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1" title={`প্রতি ${item.unit}-এ ${subInfo.packSize} ${subInfo.subUnit} থাকে`}>
                            <Boxes className="w-2.5 h-2.5 text-indigo-400" />
                            <span>১ {item.unit} = {subInfo.packSize} {subInfo.subUnit}</span>
                          </span>
                        )}

                        {wastagePct > 0 && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Percent className="w-2.5 h-2.5 text-amber-400" />
                            <span>Wastage: {wastagePct}%</span>
                          </span>
                        )}
                      </div>

                      {/* Stock Level Display & Progress Bar */}
                      <div className="mt-4 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
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
                        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              isZero ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${stockFill}%` }}
                          ></div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mt-1.5">
                          <span>Min: {item.minStockAlert} {item.unit}</span>
                          <span>Value: ৳{Math.round(itemValue).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Details: Unit Cost & Supplier */}
                      <div className="mt-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>কেনা দর:</span>
                          <span className="font-bold text-slate-200">৳{item.unitCost} / {item.unit}</span>
                        </div>
                        {hasSubUnitDisplay && (
                          <div className="flex items-center justify-between text-indigo-300 text-[11px] bg-indigo-950/30 px-2 py-1 rounded-lg border border-indigo-500/25">
                            <span className="font-medium">প্রতি {subInfo.subUnit} দর:</span>
                            <span className="font-black text-indigo-200">
                              ৳{((item.unitCost) / (subInfo.packSize || 1)).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {wastagePct > 0 && (
                          <div className="flex items-center justify-between text-amber-400 text-[11px] bg-amber-950/30 px-2 py-1 rounded-lg border border-amber-500/25">
                            <span className="font-medium">কার্যকর দর ({100 - wastagePct}% টিকে):</span>
                            <span className="font-black text-amber-300">
                              ৳{(Math.round((item.unitCost / (1 - wastagePct / 100)) * 10) / 10).toLocaleString()} / {item.unit}
                            </span>
                          </div>
                        )}
                        {item.supplier && (
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span className="text-slate-500">Supplier:</span>
                            <span className="text-slate-300 truncate max-w-[150px]" title={item.supplier}>
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
              <span className="font-semibold text-slate-300">তথ্য এডিট বা মুছে ফেলতে যে কোনো আইটেমের রো (Row)-তে ক্লিক করুন</span>
              <span className="hidden sm:inline text-slate-500">(Click any row to edit or delete item)</span>
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
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-bold">
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
                  filteredItems.map(item => {
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
                        key={item.id} 
                        onClick={() => {
                          if (!readOnly) handleEditItem(item);
                        }}
                        className={`hover:bg-slate-800/60 transition-colors ${!readOnly ? 'cursor-pointer' : ''} ${
                          isLow ? 'bg-amber-500/[0.02]' : ''
                        }`}
                        title={!readOnly ? "Click this row to edit item details / তথ্য এডিট করতে ক্লিক করুন" : undefined}
                      >
                        {/* Item Name & Details */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center space-x-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${
                              isZero 
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                                : isLow 
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                : 'bg-slate-800 text-indigo-400 border border-slate-700'
                            }`}>
                              {item.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-extrabold text-white text-sm flex items-center gap-2">
                                <span>{item.name}</span>
                                {isLow && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold">
                                    <AlertTriangle className="w-2.5 h-2.5" /> Low
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 flex-wrap">
                                <span>{item.nameBn}</span>
                                {hasSubUnitDisplay && (
                                  <span className="text-[10px] font-black px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded inline-flex items-center gap-1" title={`১ ${item.unit} = ${subInfo.packSize} ${subInfo.subUnit}`}>
                                    <Boxes className="w-2.5 h-2.5" />
                                    <span>{subInfo.packSize} {subInfo.subUnit} / {item.unit}</span>
                                  </span>
                                )}
                              </div>
                            </div>
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
                            <div className="text-[10px] text-amber-300 font-bold" title="অপচয় বাদ দিয়ে নিট কার্যকর দর">
                              নিট: ৳{Math.round((item.unitCost / (1 - wastagePct / 100)) * 10) / 10}
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
                      placeholder="যেমন: মুরগির মাংস, মিনিকেট চাল"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Unit of Measure (পরিমাপের মূল একক)</label>
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
                    <option value="kg">kg (Kilogram / কেজি) — সাব-ইউনিট: gm (১ কেজি = ১০০০ গ্রাম)</option>
                    <option value="liter">liter (Liter / লিটার) — সাব-ইউনিট: ml (১ লিটার = ১০০০ মিলি)</option>
                    <option value="case">case (Case / কেস / খাঁচি) — সাব-ইউনিট: pcs (১ কেস = ৩০ পিস)</option>
                    <option value="packet">packet (Packet / প্যাকেট) — সাব-ইউনিট: pcs (পিস / প্যাকেট সাইজ)</option>
                    <option value="pcs">pcs (Pieces / পিস) — কোনো সাব-ইউনিট নেই (একক গণনা)</option>
                    <option value="cylinder">cylinder (Cylinder / সিলিন্ডার)</option>
                    <option value="gm">gm (Gram / গ্রাম)</option>
                    <option value="box">box (Box / বক্স)</option>
                    <option value="bag">bag (Sack/Bag / বস্তা)</option>
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
                        <span>Wastage % (অপচয়)</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">যেমন: মুরগি ৩০%</span>
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
                    <p className="text-[10px] text-slate-500 mt-1">
                      কেনার সময় এই % বাদ দিয়ে নিট স্টক ইনভেন্টরিতে ঢুকবে এবং অপচয় লগে যাবে
                    </p>
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
                              <span>একক গণনা (Pcs Unit)</span>
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                                {newItemData.unit || 'pcs'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              এটি সাধারণ পিস/সংখ্যা ভিত্তিক পণ্য। এর কোনো সাব-ইউনিট প্রয়োজন নেই (১টি = ১ পিস)।
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const availableSubUnits = [
                    { val: 'pcs', label: 'pcs (পিস / ব্যাগ)' },
                    { val: 'slice', label: 'slice (স্লাইস)' },
                    { val: 'cup', label: 'cup (কাপ)' },
                    { val: 'sheet', label: 'sheet (শিট)' },
                    { val: 'gm', label: 'gm (গ্রাম)' },
                    { val: 'ml', label: 'ml (মিলি)' }
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
                            <span>প্যাকেজিং ও সাব-ইউনিট কনফিগারেশন (Sub-Units)</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            প্যাকেটের ভেতরে নির্দিষ্ট সাব-ইউনিট থাকলে (যেমন: ১ প্যাকেট = ১০০ PCS, ১ কেজি = ১০০০ GM)
                          </p>
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
                                প্রতি {newItemData.unit || 'প্যাকেটে'} মোট সংখ্যা (Pack Size) *
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
                              <p className="text-[10px] text-slate-500 mt-1">যেমন: ১ বক্সে ১০০ টি টি-ব্যাগ</p>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                সাব-ইউনিটের নাম (Sub-unit)
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
                              <p className="text-[10px] text-slate-500 mt-1">রেসিপিতে এই এককে ব্যবহার হবে (মূল এককের থেকে ভিন্ন হতে হবে)</p>
                            </div>
                          </div>

                          {/* Live Calculation Preview */}
                          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between text-indigo-300 font-bold">
                              <span>প্যাকেজিং অনুপাত:</span>
                              <span className="font-mono text-white">
                                ১ {newItemData.unit || 'packet'} = {newItemData.packSize || 100} {activeSub}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-indigo-200">
                              <span>প্রতি {activeSub} খরচ (Unit Cost):</span>
                              <span className="font-black text-amber-300 text-sm">
                                ৳{((Number(newItemData.unitCost) || 0) / Math.max(1, (Number(newItemData.packSize) || 1))).toFixed(2)}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 pt-1">
                              মেন্যু বিক্রির সময় প্রতি সার্ভিংয়ে ১ {activeSub} খরচ ধরবে এবং ইনভেন্টরি থেকে {(1 / Math.max(1, (Number(newItemData.packSize) || 1))).toFixed(4)} {newItemData.unit || 'packet'} কমে যাবে।
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Supplier / Vendor</label>
                  <input
                    type="text"
                    value={newItemData.supplier || ''}
                    onChange={(e) => setNewItemData({ ...newItemData, supplier: e.target.value })}
                    placeholder="e.g. Base Depot, Kawran Bazar, Aarong Dairy"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Notes / Description</label>
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
                        setShowAddModal(false);
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
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-indigo-500/20 flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{editingItem ? 'Update Item' : 'Save Item'}</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* TAB: History (With Restock, Issue & Wastage) */
              <div className="pt-4 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                    <History className="w-4 h-4 text-indigo-400" />
                    <span>Transaction History (তালিকায় Wastage সহ তারিখ অনুযায়ী)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        handleOpenRestock(editingItem);
                      }}
                      className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-[11px] font-bold transition-colors border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
                    >
                      <PackagePlus className="w-3 h-3" />
                      <span>+ Restock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        handleOpenIssue(editingItem);
                      }}
                      className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white rounded-lg text-[11px] font-bold transition-colors border border-amber-500/30 flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowDownRight className="w-3 h-3" />
                      <span>- Issue</span>
                    </button>
                  </div>
                </div>

                {/* History Log List */}
                <div className="overflow-y-auto flex-1 max-h-[50vh] space-y-2 pr-1 divide-y divide-slate-800/40">
                  {logs.filter(l => l.itemId === editingItem.id).length === 0 ? (
                    <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-2xl">
                      <History className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-60" />
                      <p className="text-slate-400 text-xs font-semibold">এই আইটেমের এখনো কোনো হিস্ট্রি (Restock, Issue বা Wastage) নেই</p>
                      <p className="text-slate-500 text-[11px] mt-1">রেস্টক, ইস্যু বা অপচয় হলে স্বয়ংক্রিয়ভাবে তারিখসহ এখানে হিস্ট্রি যুক্ত হবে।</p>
                    </div>
                  ) : (
                    logs
                      .filter(l => l.itemId === editingItem.id)
                      .map(log => {
                        const isRestock = log.type === 'RESTOCK';
                        const isIssue = log.type === 'ISSUE';
                        const isWastage = log.type === 'WASTAGE';

                        return (
                          <div 
                            key={log.id} 
                            className="pt-2 pb-2.5 px-3 rounded-xl bg-slate-950/30 border border-slate-800/60 flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black shrink-0 mt-0.5 ${
                                isRestock 
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : isIssue
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}>
                                {isRestock && <ArrowUpRight className="w-4 h-4" />}
                                {isIssue && <ArrowDownRight className="w-4 h-4" />}
                                {isWastage && <Percent className="w-4 h-4" />}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`font-black text-xs uppercase px-2 py-0.5 rounded-md ${
                                    isRestock 
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                      : isIssue
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  }`}>
                                    {log.type}
                                  </span>
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    {log.date}
                                  </span>
                                </div>

                                <div className="mt-1 text-slate-300 text-xs font-semibold">
                                  {isRestock && (
                                    <span className="text-emerald-400 font-black mr-1">+{log.quantity} {log.unit}</span>
                                  )}
                                  {isIssue && (
                                    <span className="text-amber-400 font-black mr-1">-{log.quantity} {log.unit}</span>
                                  )}
                                  {isWastage && (
                                    <span className="text-rose-400 font-black mr-1">-{log.quantity} {log.unit} (Wastage)</span>
                                  )}
                                  <span className="text-slate-400 font-normal">
                                    (Stock: {log.previousStock} → {log.newStock} {log.unit})
                                  </span>
                                </div>

                                {log.notes && (
                                  <p className="text-[11px] text-slate-400 mt-0.5 italic">
                                    Note: {log.notes}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {log.cost ? (
                                <div className="font-mono font-bold text-slate-200 text-xs">
                                  ৳{Math.round(log.cost).toLocaleString()}
                                </div>
                              ) : null}
                              {log.recordedBy && (
                                <div className="text-[10px] text-slate-500 font-medium">
                                  by {log.recordedBy}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                  )}
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
                      Restock Raw Item (স্টক যোগ)
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
                    {items.map(it => (
                      <option key={it.id} value={it.id}>
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
                          {mainUnit} (মূল)
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestockUnitMode('SUB')}
                          className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                            restockUnitMode === 'SUB' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {subUnit} (সাব)
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
                      ≈ {equivalentInOther} (১ {mainUnit} = {pSize} {subUnit})
                    </p>
                  )}
                </div>

                {/* Unit Cost & Supplier */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      কেনা দর (৳ per {mainUnit}) *
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
                        প্রতি {subUnit}: ৳{((parseFloat(restockCost) || 0) / pSize).toFixed(2)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Supplier / সরবরাহকারী</label>
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
                  <label className="block text-xs font-bold text-slate-400 mb-1">Notes / রেফারেন্স (Optional)</label>
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
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-emerald-500/20 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>Confirm Restock</span>
                  </button>
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
                      Issue / Usage (রান্নাঘরে স্টক প্রদান)
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
                    {items.map(it => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.nameBn}) — Stock: {it.currentStock} {it.unit}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Issue Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Issue Category / ধরণ</label>
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
                      <span>Kitchen Issue (রান্না)</span>
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
                      <span>Wastage (নষ্ট / অপচয়)</span>
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
                          {mainUnit} (মূল)
                        </button>
                        <button
                          type="button"
                          onClick={() => setIssueUnitMode('SUB')}
                          className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                            issueUnitMode === 'SUB' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {subUnit} (সাব)
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
                        বাকি স্টক থাকবে: <strong className="text-white">{remainingStock.toFixed(2)} {mainUnit}</strong>
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
                  <label className="block text-xs font-bold text-slate-400 mb-1">Notes / বিবরণ</label>
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
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-amber-500/20 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    <span>Confirm Deduction</span>
                  </button>
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
                    <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                      স্টক আদান-প্রদান হিস্ট্রি
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    খরচ (Expenditure) থেকে স্বয়ংক্রিয় রিস্টক ও সেল (POS Sales) থেকে স্বয়ংক্রিয় কাঁচামাল ইস্যুর লগ রেকর্ড
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
                  সকল লগ ({logs.length})
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
                মোট সংরক্ষিত: <span className="font-bold text-white">{logs.length}</span> টি লেনদেন
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
                      <p>কোনো স্টক লগ পাওয়া যায়নি (No logs found)</p>
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
                                <span>পূর্ববর্তী: <strong className="text-slate-300">{log.previousStock} {log.unit}</strong></span>
                                <span>→</span>
                                <span>নতুন ব্যালেন্স: <strong className={isRestock ? 'text-emerald-400' : 'text-amber-400'}>{log.newStock} {log.unit}</strong></span>
                                {log.cost ? (
                                  <span>• খরচ: <strong className="text-emerald-400">৳ {Math.round(log.cost).toLocaleString()}</strong></span>
                                ) : null}
                              </div>

                              <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3">
                                <span>রেফারেন্স: {log.notes || log.type}</span>
                                <span>• বাই: {log.recordedBy || 'System Auto'}</span>
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
                স্বয়ংক্রিয় স্টক লগিং সক্রিয়
              </span>
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                বন্ধ করুন (Close)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
