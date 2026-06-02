-- Phase: financial back-office.
--
-- Customer invoices (with VAT/QQS) and multi-currency expenses (incl. CNY
-- supplier payments, normalized to USD on entry). Feeds the P&L + VAT report.
-- Service-role only (RLS on, no policies) — money data.
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_usd NUMERIC(14, 2) NOT NULL DEFAULT 0,
  vat_pct NUMERIC(5, 2) NOT NULL DEFAULT 12,
  vat_usd NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_usd NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  issued_at DATE NOT NULL DEFAULT (now()::date),
  due_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN (
    'supplier_payment', 'freight', 'customs', 'logistics', 'certification',
    'marketing', 'salary', 'office', 'other'
  )),
  description TEXT,
  amount NUMERIC(16, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'UZS', 'CNY')),
  amount_usd NUMERIC(14, 2) NOT NULL,        -- normalized at entry time
  supplier TEXT,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  spent_on DATE NOT NULL DEFAULT (now()::date),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_period ON public.expenses (spent_on DESC, category);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.
