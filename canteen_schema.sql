-- ==============================================================================
-- 155 UASU BAF CANTEEN MANAGEMENT SYSTEM - MASTER SCHEMA
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Canteen_Menu" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    name_bn TEXT,
    category TEXT DEFAULT 'SNACKS',
    price NUMERIC(10,2) DEFAULT 0.00,
    "Cost" NUMERIC(10,2) DEFAULT 0.00,
    "Raw Item" TEXT,
    "DP" TEXT,
    stock NUMERIC(10,2) DEFAULT 50.00,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Canteen_Inventory" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    "nameBn" TEXT,
    unit TEXT DEFAULT 'kg',
    "Sub Unit" TEXT,
    "packSize" NUMERIC(10,2) DEFAULT 1.00,
    "hasSubUnits" BOOLEAN DEFAULT false,
    "currentStock" NUMERIC(12,2) DEFAULT 0.00,
    "minStockAlert" NUMERIC(10,2) DEFAULT 5.00,
    "unitCost" NUMERIC(10,2) DEFAULT 0.00,
    "wastagePercentage" NUMERIC(5,2) DEFAULT 0.00,
    "lastRestockedDate" TEXT,
    supplier TEXT DEFAULT '',
    category TEXT DEFAULT 'GROCERY',
    "subCategory" TEXT,
    "itemType" TEXT DEFAULT 'RAW',
    "DP" TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Canteen_Member" (
    airman_id TEXT PRIMARY KEY,
    "BD No" TEXT NOT NULL,
    "Rank" TEXT DEFAULT 'LAC',
    "Surname" TEXT NOT NULL,
    "Contact" TEXT DEFAULT '',
    "Due" NUMERIC(12,2) DEFAULT 0.00,
    "Role" TEXT DEFAULT 'Member',
    "DP" TEXT,
    "Seniority" INTEGER DEFAULT 999,
    "Flight" TEXT DEFAULT 'Admin',
    "Trade" TEXT DEFAULT '',
    "Name_BN" TEXT DEFAULT '',
    "Rank_BN" TEXT DEFAULT '',
    "Address" TEXT DEFAULT '',
    is_officer BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Canteen_Transactions" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    airman_id TEXT NOT NULL,
    bd_no TEXT,
    member_name TEXT,
    rank TEXT,
    date TEXT NOT NULL,
    month_key TEXT,
    items TEXT,
    sold_items JSONB DEFAULT '[]'::jsonb,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    type TEXT DEFAULT 'SALE',
    bill_type TEXT DEFAULT 'CANTEEN',
    gateway TEXT DEFAULT 'DUE',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Canteen_Expenses" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    subdesc TEXT,
    category TEXT DEFAULT 'GROCERY',
    payment_method TEXT DEFAULT 'Cash',
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    qty NUMERIC(10,2),
    unit TEXT,
    unit_price NUMERIC(10,2),
    detailed_person TEXT,
    is_custom BOOLEAN DEFAULT false,
    raw_item_id TEXT,
    advance_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Canteen_Bazar_Advances" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    person TEXT NOT NULL,
    advance_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_method TEXT DEFAULT 'Cash',
    purpose TEXT,
    bazar_total_amount NUMERIC(12,2) DEFAULT 0.00,
    remaining_amount NUMERIC(12,2) DEFAULT 0.00,
    status TEXT DEFAULT 'PENDING_BAZAR',
    return_amount NUMERIC(12,2) DEFAULT 0.00,
    return_method TEXT DEFAULT 'Cash',
    return_date TEXT,
    notes TEXT,
    bazar_items_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- DISABLE RLS GLOBALLY
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', t.tablename);
    END LOOP;
END $$;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
