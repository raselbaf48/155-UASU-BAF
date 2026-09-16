-- Canteen Management System - Initial Schema Migration
-- Run this in your Supabase SQL Editor

-- 1. Extend existing profiles table (assuming it exists)
-- DO NOT RUN THIS IF PROFILES DOES NOT EXIST YET. Assuming standard Supabase setup.
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS canteen_role TEXT DEFAULT 'employee'; -- 'employee', 'manager', 'admin'
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'bn'; -- 'bn', 'en'

-- 2. Settings & Basic Lookups
CREATE TABLE IF NOT EXISTS canteen_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cutoff_times JSONB NOT NULL DEFAULT '{"breakfast": "08:00", "lunch": "11:00", "snacks": "15:00", "dinner": "19:00"}',
    service_charge NUMERIC(5,2) DEFAULT 0.00,
    subsidy_percent NUMERIC(5,2) DEFAULT 0.00,
    active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meal_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_bn TEXT NOT NULL,
    name_en TEXT,
    sort_order INTEGER DEFAULT 0,
    cutoff_time TIME NOT NULL,
    active BOOLEAN DEFAULT true
);

-- 3. Inventory System
CREATE TABLE IF NOT EXISTS inventory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_bn TEXT NOT NULL,
    name_en TEXT
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
    name_bn TEXT NOT NULL,
    name_en TEXT,
    unit_bn TEXT NOT NULL,
    unit_en TEXT,
    current_stock NUMERIC(10,2) DEFAULT 0,
    reorder_level NUMERIC(10,2) DEFAULT 0,
    last_purchase_price NUMERIC(10,2) DEFAULT 0,
    active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES inventory_items(id) ON DELETE RESTRICT,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('in', 'out', 'wastage', 'adjustment')),
    quantity NUMERIC(10,2) NOT NULL,
    unit_price NUMERIC(10,2) DEFAULT 0,
    reason TEXT,
    created_by UUID NOT NULL, -- references auth.uid() or profiles.id
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Menus
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_bn TEXT NOT NULL,
    name_en TEXT,
    description_bn TEXT,
    description_en TEXT,
    meal_type_id UUID REFERENCES meal_types(id) ON DELETE RESTRICT,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    image_url TEXT,
    active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS daily_menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_date DATE NOT NULL,
    meal_type_id UUID REFERENCES meal_types(id) ON DELETE RESTRICT,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE RESTRICT,
    price_override NUMERIC(10,2),
    max_quantity INTEGER,
    available_quantity INTEGER,
    published_by UUID,
    published_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(menu_date, meal_type_id, menu_item_id)
);

-- 5. Demands (Orders)
CREATE TABLE IF NOT EXISTS demands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- references profiles.id
    daily_menu_id UUID REFERENCES daily_menus(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'served', 'cancelled')),
    note TEXT,
    cancelled_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Billing
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    invoice_no TEXT UNIQUE NOT NULL,
    subtotal NUMERIC(10,2) DEFAULT 0,
    service_charge NUMERIC(10,2) DEFAULT 0,
    previous_due NUMERIC(10,2) DEFAULT 0,
    grand_total NUMERIC(10,2) DEFAULT 0,
    paid_amount NUMERIC(10,2) DEFAULT 0,
    status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid')),
    locked BOOLEAN DEFAULT false,
    generated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, month, year)
);

CREATE TABLE IF NOT EXISTS billing_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    demand_id UUID REFERENCES demands(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    bill_date DATE NOT NULL,
    description_bn TEXT NOT NULL,
    description_en TEXT,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE RESTRICT,
    amount NUMERIC(10,2) NOT NULL,
    paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
    method TEXT NOT NULL,
    note TEXT,
    received_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Accountability
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    performed_by UUID,
    performed_at TIMESTAMPTZ DEFAULT now()
);

-- VIEWS
CREATE OR REPLACE VIEW v_daily_demand_summary AS
SELECT 
    d.menu_date,
    mt.name_bn AS meal_type_bn,
    mi.name_bn AS item_bn,
    SUM(dem.quantity) AS total_demanded,
    COUNT(dem.id) AS total_users
FROM demands dem
JOIN daily_menus d ON dem.daily_menu_id = d.id
JOIN meal_types mt ON d.meal_type_id = mt.id
JOIN menu_items mi ON d.menu_item_id = mi.id
WHERE dem.status != 'cancelled'
GROUP BY d.menu_date, mt.name_bn, mi.name_bn;

CREATE OR REPLACE VIEW v_low_stock_items AS
SELECT 
    id, name_bn, name_en, current_stock, reorder_level, unit_bn, unit_en
FROM inventory_items
WHERE current_stock <= reorder_level AND active = true;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE demands, inventory_items, daily_menus;

-- Basic RLS Policies (Draft)
-- In a real setup, you would strict these based on auth.uid() and user role
-- For this prototype, we'll enable RLS but allow authenticated access
-- (You should replace these with proper role checks later)
/*
ALTER TABLE demands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own demands" ON demands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own demands" ON demands FOR INSERT WITH CHECK (auth.uid() = user_id);
-- ... additional policies ...
*/
