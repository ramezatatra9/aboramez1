-- ====================================================================
-- مَعْرِض أَبُو رَامِز لِلأَجْهِزَة الكَهْرَبَائِيّة
-- Supabase Schema Migration: إعداد قاعدة البيانات الدائمة للإنتاج
-- Migration: 001_permanent_schema.sql
-- ====================================================================

-- 1. جدول المنتجات (products): إضافة الحقول المفقودة والتأكد من الفهارس
CREATE TABLE IF NOT EXISTS public.products (
  id text PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  category text DEFAULT 'أجهزة كهربائية كبيرة',
  subcategory text DEFAULT 'عام',
  "costPrice" numeric DEFAULT 0,
  "sellPrice" numeric DEFAULT 0,
  stock integer DEFAULT 0,
  unit text DEFAULT 'قطعة',
  image text DEFAULT '',
  description text DEFAULT '',
  "lastStockUpdate" timestamptz,
  "lastStockEditor" text,
  "createdAt" timestamptz DEFAULT now()
);

-- إضافة الأعمدة الناقصة لجدول products في حال كان موجوداً مسبقاً
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode text DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "isSuspended" boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand text DEFAULT 'أخرى';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "brandAr" text DEFAULT 'أخرى / عام';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz DEFAULT now();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "lastSyncAt" timestamptz;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb;

-- إنشاء قيد الفرادة (Unique Constraint) على كود الصنف لمنع التكرار نهائياً
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_code_unique'
  ) THEN
    -- تنظيف أي فراغات قبل إنشاء القيد
    UPDATE public.products SET code = TRIM(code);
    ALTER TABLE public.products ADD CONSTRAINT products_code_unique UNIQUE (code);
  END IF;
EXCEPTION
  WHEN others THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code ON public.products (code);
END $$;

CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products (barcode);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products (brand);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category, subcategory);

-- 2. جدول الإعدادات العامة واللقطات (settings)
CREATE TABLE IF NOT EXISTS public.settings (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  "updatedAt" timestamptz DEFAULT now()
);

-- 3. جدول الزبائن الدائم (customers)
CREATE TABLE IF NOT EXISTS public.customers (
  id text PRIMARY KEY,
  "systemNumber" text UNIQUE,
  "shamelCode" text,
  name text NOT NULL,
  phone text DEFAULT '',
  balance numeric DEFAULT 0,
  "shamelBalance" numeric DEFAULT 0,
  notes text DEFAULT '',
  "accountType" text DEFAULT 'customer',
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now(),
  "lastSyncAt" timestamptz
);

CREATE INDEX IF NOT EXISTS idx_customers_sysnum ON public.customers ("systemNumber");
CREATE INDEX IF NOT EXISTS idx_customers_shamel ON public.customers ("shamelCode");

-- 4. جدول الموردين الدائم (suppliers)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id text PRIMARY KEY,
  "shamelCode" text UNIQUE,
  name text NOT NULL,
  phone text DEFAULT '',
  balance numeric DEFAULT 0,
  "shamelBalance" numeric DEFAULT 0,
  notes text DEFAULT '',
  "accountType" text DEFAULT 'supplier',
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now(),
  "lastSyncAt" timestamptz
);

CREATE INDEX IF NOT EXISTS idx_suppliers_shamel ON public.suppliers ("shamelCode");

-- 5. جدول الفواتير (invoices)
CREATE TABLE IF NOT EXISTS public.invoices (
  id text PRIMARY KEY,
  "invoiceNumber" integer,
  "createdAt" timestamptz DEFAULT now(),
  "employeeName" text,
  "customerName" text,
  "customerPhone" text,
  notes text,
  items jsonb DEFAULT '[]'::jsonb,
  summary jsonb,
  "paymentMethod" text,
  "installmentDetails" jsonb,
  "telegramStatus" jsonb
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices ("invoiceNumber");

-- 6. جدول سندات القبض (receipts)
CREATE TABLE IF NOT EXISTS public.receipts (
  id text PRIMARY KEY,
  "receiptNumber" integer,
  "createdAt" timestamptz DEFAULT now(),
  "employeeName" text,
  "customerName" text,
  "customerPhone" text,
  amount numeric DEFAULT 0,
  description text,
  notes text,
  "paymentMethod" text
);

CREATE INDEX IF NOT EXISTS idx_receipts_number ON public.receipts ("receiptNumber");

-- 7. جدول الضمانات (warranties)
CREATE TABLE IF NOT EXISTS public.warranties (
  id text PRIMARY KEY,
  "warrantyNumber" integer,
  "invoiceId" text DEFAULT '',
  "invoiceNumber" integer,
  "createdAt" timestamptz DEFAULT now(),
  "purchaseDate" timestamptz,
  "durationMonths" integer DEFAULT 12,
  "expiryDate" timestamptz,
  "customerName" text,
  "customerPhone" text,
  "customerAddress" text,
  items jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_warranties_number ON public.warranties ("warrantyNumber");

-- ====================================================================
-- سياسات الأمان (Row Level Security - RLS)
-- تتيح القراءة والكتابة الكاملة للتطبيق الآمن عبر السيرفر
-- ====================================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_read_policy" ON public.products;
DROP POLICY IF EXISTS "products_write_policy" ON public.products;
DROP POLICY IF EXISTS "products_full_access" ON public.products;
CREATE POLICY "products_full_access" ON public.products FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_full_access" ON public.settings;
CREATE POLICY "settings_full_access" ON public.settings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_full_access" ON public.customers;
CREATE POLICY "customers_full_access" ON public.customers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_full_access" ON public.suppliers;
CREATE POLICY "suppliers_full_access" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_full_access" ON public.invoices;
CREATE POLICY "invoices_full_access" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receipts_full_access" ON public.receipts;
CREATE POLICY "receipts_full_access" ON public.receipts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warranties_full_access" ON public.warranties;
CREATE POLICY "warranties_full_access" ON public.warranties FOR ALL USING (true) WITH CHECK (true);

-- تأكيد انتهاء المايجريشن
COMMENT ON TABLE public.products IS 'معرض أبو رامز - الأصناف والمخزون الدائم المحدث من الشامل لايت';
