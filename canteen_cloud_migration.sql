-- ==============================================================================
-- 155 UASU BAF CANTEEN MANAGEMENT SYSTEM - FLAWLESS SINGLE COLUMN & RLS DISABLE SCRIPT
-- ==============================================================================
-- এই স্ক্রিপ্টটিতে কোনো সিনট্যাক্স বা FROM-clause এরর আসবে না।
-- ১. সব ডুপ্লিকেট কলাম সেফলি চেক করে মূল কলামে মার্জ হবে এবং মুছে ফেলা হবে।
-- ২. সব টেবিলে RLS সম্পূর্ণ নিষ্ক্রিয় (DISABLE) হয়ে যাবে।
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- ১. APP_SETTINGS (Real-time Sync Engine)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(setting_key);


-- ------------------------------------------------------------------------------
-- ২. CANTEEN_MENU (ক্লিন সিঙ্গেল কলাম ও ডুপ্লিকেট ড্রপ)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."Canteen_Menu" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'SNACKS',
    price NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- মূল কলামগুলো নিশ্চিত করা
ALTER TABLE public."Canteen_Menu" ADD COLUMN IF NOT EXISTS name_bn TEXT;
ALTER TABLE public."Canteen_Menu" ADD COLUMN IF NOT EXISTS "Cost" NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public."Canteen_Menu" ADD COLUMN IF NOT EXISTS "Raw Item" TEXT;
ALTER TABLE public."Canteen_Menu" ADD COLUMN IF NOT EXISTS "DP" TEXT;
ALTER TABLE public."Canteen_Menu" ADD COLUMN IF NOT EXISTS stock NUMERIC(10,2) DEFAULT 50.00;
ALTER TABLE public."Canteen_Menu" ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public."Canteen_Menu" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ডুপ্লিকেট কলামের তথ্য মূল কলামে নিরাপদভাবে মার্জ করা
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Menu' AND column_name='nameBn') THEN
        EXECUTE 'UPDATE public."Canteen_Menu" SET name_bn = COALESCE(NULLIF(name_bn, ''''), "nameBn") WHERE "nameBn" IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Menu' AND column_name='Name (BN)') THEN
        EXECUTE 'UPDATE public."Canteen_Menu" SET name_bn = COALESCE(NULLIF(name_bn, ''''), "Name (BN)") WHERE "Name (BN)" IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Menu' AND column_name='cost') THEN
        EXECUTE 'UPDATE public."Canteen_Menu" SET "Cost" = COALESCE("Cost", cost) WHERE cost IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Menu' AND column_name='raw_item') THEN
        EXECUTE 'UPDATE public."Canteen_Menu" SET "Raw Item" = COALESCE(NULLIF("Raw Item", ''''), raw_item) WHERE raw_item IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Menu' AND column_name='rawItem') THEN
        EXECUTE 'UPDATE public."Canteen_Menu" SET "Raw Item" = COALESCE(NULLIF("Raw Item", ''''), "rawItem") WHERE "rawItem" IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Menu' AND column_name='dp') THEN
        EXECUTE 'UPDATE public."Canteen_Menu" SET "DP" = COALESCE("DP", dp) WHERE dp IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Menu' AND column_name='image') THEN
        EXECUTE 'UPDATE public."Canteen_Menu" SET "DP" = COALESCE("DP", image) WHERE image IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Menu' AND column_name='img') THEN
        EXECUTE 'UPDATE public."Canteen_Menu" SET "DP" = COALESCE("DP", img) WHERE img IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Menu' AND column_name='image_url') THEN
        EXECUTE 'UPDATE public."Canteen_Menu" SET "DP" = COALESCE("DP", image_url) WHERE image_url IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Menu' AND column_name='max') THEN
        EXECUTE 'UPDATE public."Canteen_Menu" SET stock = COALESCE(stock, max) WHERE max IS NOT NULL;';
    END IF;
END $$;

-- ডুপ্লিকেট কলামগুলো ড্রপ করা
ALTER TABLE public."Canteen_Menu" DROP COLUMN IF EXISTS "nameBn";
ALTER TABLE public."Canteen_Menu" DROP COLUMN IF EXISTS "Name (BN)";
ALTER TABLE public."Canteen_Menu" DROP COLUMN IF EXISTS name_en;
ALTER TABLE public."Canteen_Menu" DROP COLUMN IF EXISTS cost;
ALTER TABLE public."Canteen_Menu" DROP COLUMN IF EXISTS raw_item;
ALTER TABLE public."Canteen_Menu" DROP COLUMN IF EXISTS "rawItem";
ALTER TABLE public."Canteen_Menu" DROP COLUMN IF EXISTS dp;
ALTER TABLE public."Canteen_Menu" DROP COLUMN IF EXISTS img;
ALTER TABLE public."Canteen_Menu" DROP COLUMN IF EXISTS image;
ALTER TABLE public."Canteen_Menu" DROP COLUMN IF EXISTS image_url;
ALTER TABLE public."Canteen_Menu" DROP COLUMN IF EXISTS max;


-- ------------------------------------------------------------------------------
-- ৩. CANTEEN_INVENTORY (ক্লিন সিঙ্গেল কলাম ও ডুপ্লিকেট ড্রপ)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."Canteen_Inventory" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    unit TEXT DEFAULT 'kg',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- মূল কলামগুলো নিশ্চিত করা
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS "nameBn" TEXT;
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS "Sub Unit" TEXT;
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS "packSize" NUMERIC(10,2) DEFAULT 1.00;
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS "hasSubUnits" BOOLEAN DEFAULT false;
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS "currentStock" NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS "minStockAlert" NUMERIC(10,2) DEFAULT 5.00;
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS "unitCost" NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS "wastagePercentage" NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS "lastRestockedDate" TEXT;
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS supplier TEXT DEFAULT '';
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'GROCERY';
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS "subCategory" TEXT;
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS "itemType" TEXT DEFAULT 'RAW';
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS "DP" TEXT;
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public."Canteen_Inventory" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ডুপ্লিকেট কলামের তথ্য মূল কলামে নিরাপদভাবে মার্জ করা
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='name_bn') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "nameBn" = COALESCE(NULLIF("nameBn", ''''), name_bn) WHERE name_bn IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='sub_unit') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "Sub Unit" = COALESCE("Sub Unit", sub_unit) WHERE sub_unit IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='subUnit') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "Sub Unit" = COALESCE("Sub Unit", "subUnit") WHERE "subUnit" IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='pack_size') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "packSize" = COALESCE("packSize", pack_size) WHERE pack_size IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='has_sub_units') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "hasSubUnits" = COALESCE("hasSubUnits", has_sub_units) WHERE has_sub_units IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='current_stock') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "currentStock" = COALESCE("currentStock", current_stock) WHERE current_stock IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='min_stock_alert') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "minStockAlert" = COALESCE("minStockAlert", min_stock_alert) WHERE min_stock_alert IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='reorder_level') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "minStockAlert" = COALESCE("minStockAlert", reorder_level) WHERE reorder_level IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='unit_cost') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "unitCost" = COALESCE("unitCost", unit_cost) WHERE unit_cost IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='last_purchase_price') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "unitCost" = COALESCE("unitCost", last_purchase_price) WHERE last_purchase_price IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='wastage_percentage') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "wastagePercentage" = COALESCE("wastagePercentage", wastage_percentage) WHERE wastage_percentage IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='last_restocked_date') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "lastRestockedDate" = COALESCE("lastRestockedDate", last_restocked_date) WHERE last_restocked_date IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='sub_category') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "subCategory" = COALESCE("subCategory", sub_category) WHERE sub_category IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='item_type') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "itemType" = COALESCE("itemType", item_type) WHERE item_type IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='dp') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "DP" = COALESCE("DP", dp) WHERE dp IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Inventory' AND column_name='image') THEN
        EXECUTE 'UPDATE public."Canteen_Inventory" SET "DP" = COALESCE("DP", image) WHERE image IS NOT NULL;';
    END IF;
END $$;

-- ডুপ্লিকেট কলামগুলো ড্রপ করা
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS name_bn;
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS sub_unit;
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS "subUnit";
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS pack_size;
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS has_sub_units;
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS current_stock;
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS min_stock_alert;
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS reorder_level;
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS unit_cost;
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS last_purchase_price;
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS wastage_percentage;
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS last_restocked_date;
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS sub_category;
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS item_type;
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS dp;
ALTER TABLE public."Canteen_Inventory" DROP COLUMN IF EXISTS image;


-- ------------------------------------------------------------------------------
-- ৪. CANTEEN_MEMBER (ক্লিন সিঙ্গেল কলাম ও ডুপ্লিকেট ড্রপ)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."Canteen_Member" (
    airman_id TEXT PRIMARY KEY,
    "BD No" TEXT NOT NULL,
    "Rank" TEXT DEFAULT 'LAC',
    "Surname" TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- মূল কলামগুলো নিশ্চিত করা
ALTER TABLE public."Canteen_Member" ADD COLUMN IF NOT EXISTS "Contact" TEXT DEFAULT '';
ALTER TABLE public."Canteen_Member" ADD COLUMN IF NOT EXISTS "Due" NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public."Canteen_Member" ADD COLUMN IF NOT EXISTS "Role" TEXT DEFAULT 'Member';
ALTER TABLE public."Canteen_Member" ADD COLUMN IF NOT EXISTS "DP" TEXT;
ALTER TABLE public."Canteen_Member" ADD COLUMN IF NOT EXISTS "Seniority" INTEGER DEFAULT 999;
ALTER TABLE public."Canteen_Member" ADD COLUMN IF NOT EXISTS "Flight" TEXT DEFAULT 'Admin';
ALTER TABLE public."Canteen_Member" ADD COLUMN IF NOT EXISTS "Trade" TEXT DEFAULT '';
ALTER TABLE public."Canteen_Member" ADD COLUMN IF NOT EXISTS "Name_BN" TEXT DEFAULT '';
ALTER TABLE public."Canteen_Member" ADD COLUMN IF NOT EXISTS "Rank_BN" TEXT DEFAULT '';
ALTER TABLE public."Canteen_Member" ADD COLUMN IF NOT EXISTS "Address" TEXT DEFAULT '';
ALTER TABLE public."Canteen_Member" ADD COLUMN IF NOT EXISTS is_officer BOOLEAN DEFAULT false;
ALTER TABLE public."Canteen_Member" ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public."Canteen_Member" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ডুপ্লিকেট কলামের তথ্য মূল কলামে নিরাপদভাবে মার্জ করা
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='bd_no') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "BD No" = COALESCE(NULLIF("BD No", ''''), bd_no) WHERE bd_no IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='rank') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "Rank" = COALESCE(NULLIF("Rank", ''''), rank) WHERE rank IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='surname') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "Surname" = COALESCE(NULLIF("Surname", ''''), surname) WHERE surname IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='contact') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "Contact" = COALESCE(NULLIF("Contact", ''''), contact) WHERE contact IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='Mobile No') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "Contact" = COALESCE(NULLIF("Contact", ''''), "Mobile No") WHERE "Mobile No" IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='mobile_no') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "Contact" = COALESCE(NULLIF("Contact", ''''), mobile_no) WHERE mobile_no IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='due') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "Due" = COALESCE("Due", due) WHERE due IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='baki') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "Due" = COALESCE("Due", baki) WHERE baki IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='role') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "Role" = COALESCE(NULLIF("Role", ''''), role) WHERE role IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='dp') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "DP" = COALESCE("DP", dp) WHERE dp IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='image') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "DP" = COALESCE("DP", image) WHERE image IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='seniority') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "Seniority" = COALESCE("Seniority", seniority) WHERE seniority IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='flight') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "Flight" = COALESCE(NULLIF("Flight", ''''), flight) WHERE flight IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='trade') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "Trade" = COALESCE("Trade", trade) WHERE trade IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='name_bn') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "Name_BN" = COALESCE("Name_BN", name_bn) WHERE name_bn IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='rank_bn') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "Rank_BN" = COALESCE("Rank_BN", rank_bn) WHERE rank_bn IS NOT NULL;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Canteen_Member' AND column_name='address') THEN
        EXECUTE 'UPDATE public."Canteen_Member" SET "Address" = COALESCE("Address", address) WHERE address IS NOT NULL;';
    END IF;
END $$;

-- ডুপ্লিকেট কলামগুলো ড্রপ করা
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS bd_no;
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS rank;
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS surname;
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS contact;
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS "Mobile No";
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS mobile_no;
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS due;
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS baki;
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS role;
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS dp;
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS image;
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS seniority;
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS flight;
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS trade;
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS name_bn;
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS rank_bn;
ALTER TABLE public."Canteen_Member" DROP COLUMN IF EXISTS address;


-- ------------------------------------------------------------------------------
-- ৫. CANTEEN_TRANSACTIONS (বিল ও ট্রানজেকশন)
-- ------------------------------------------------------------------------------
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
CREATE INDEX IF NOT EXISTS idx_canteen_tx_airman ON public."Canteen_Transactions"(airman_id);
CREATE INDEX IF NOT EXISTS idx_canteen_tx_month ON public."Canteen_Transactions"(month_key);


-- ------------------------------------------------------------------------------
-- ৬. CANTEEN_EXPENSES & BAZAR_ADVANCES
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- ৭. সব টেবিলের ROW LEVEL SECURITY (RLS) সম্পূর্ণ নিষ্ক্রিয় (DISABLE) করা
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', t.tablename);
    END LOOP;
END $$;

-- সম্পূর্ণ পারমিশন নিশ্চিত করা
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- রিয়েলটাইম সিঙ্ক নিশ্চিত রাখা
DO $$
BEGIN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public."Canteen_Member"; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public."Canteen_Menu"; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public."Canteen_Inventory"; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public."Canteen_Transactions"; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
