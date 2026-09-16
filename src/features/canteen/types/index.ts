// Canteen System Types
// These represent the Supabase Database Schema

export type CanteenRole = 'employee' | 'manager' | 'admin';
export type DemandStatus = 'pending' | 'confirmed' | 'served' | 'cancelled';
export type StockTransactionType = 'in' | 'out' | 'wastage' | 'adjustment';
export type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid';
export type LanguageChoice = 'bn' | 'en';

export interface CanteenSettings {
  id: string;
  cutoff_times: Record<string, string>; // e.g. { breakfast: "08:00" }
  service_charge: number;
  subsidy_percent: number;
  active: boolean;
  updated_at: string;
}

export interface MealType {
  id: string;
  name_bn: string;
  name_en?: string;
  sort_order: number;
  cutoff_time: string; // HH:mm format
  active: boolean;
}

export interface InventoryCategory {
  id: string;
  name_bn: string;
  name_en?: string;
}

export interface InventoryItem {
  id: string;
  category_id: string | null;
  name_bn: string;
  name_en?: string;
  unit_bn: string;
  unit_en?: string;
  current_stock: number;
  reorder_level: number;
  last_purchase_price: number;
  active: boolean;
}

export interface StockTransaction {
  id: string;
  item_id: string;
  transaction_type: StockTransactionType;
  quantity: number;
  unit_price: number;
  reason?: string;
  created_by: string;
  created_at: string;
}

export interface MenuItem {
  id: string;
  name_bn: string;
  name_en?: string;
  description_bn?: string;
  description_en?: string;
  meal_type_id: string;
  price: number;
  image_url?: string;
  active: boolean;
}

export interface DailyMenu {
  id: string;
  menu_date: string;
  meal_type_id: string;
  menu_item_id: string;
  price_override?: number;
  max_quantity?: number;
  available_quantity?: number;
  published_by?: string;
  published_at: string;
}

export interface Demand {
  id: string;
  user_id: string;
  daily_menu_id: string;
  quantity: number;
  status: DemandStatus;
  note?: string;
  cancelled_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  month: number;
  year: number;
  invoice_no: string;
  subtotal: number;
  service_charge: number;
  previous_due: number;
  grand_total: number;
  paid_amount: number;
  status: InvoiceStatus;
  locked: boolean;
  generated_at: string;
}

export interface BillingLedger {
  id: string;
  user_id: string;
  demand_id?: string;
  invoice_id?: string;
  bill_date: string;
  description_bn: string;
  description_en?: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  paid_on: string;
  method: string;
  note?: string;
  received_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data?: any;
  new_data?: any;
  performed_by?: string;
  performed_at: string;
}
