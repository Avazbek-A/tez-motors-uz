-- Phase: shipment & logistics command center.
--
-- Tracks an imported batch from supplier payment → shipping → customs → arrival
-- → delivery, with a milestone timeline and attached documents. Optionally
-- linked to a purchase_order. Service-role only (RLS on, no policies).
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  supplier TEXT,
  mode TEXT NOT NULL DEFAULT 'rail' CHECK (mode IN ('sea', 'rail', 'road', 'air', 'multimodal')),
  container_no TEXT,
  origin TEXT,
  destination TEXT DEFAULT 'Tashkent',
  qty INTEGER,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN (
    'created', 'supplier_paid', 'in_production', 'shipped',
    'in_transit', 'at_customs', 'cleared', 'arrived', 'delivered'
  )),
  eta_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only milestone timeline (mirrors order_events).
CREATE TABLE IF NOT EXISTS public.shipment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  milestone TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents attached to a shipment (invoice, customs declaration, etc.).
CREATE TABLE IF NOT EXISTS public.shipment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN (
    'invoice', 'packing_list', 'bill_of_lading', 'customs_declaration', 'certificate', 'other'
  )),
  url TEXT NOT NULL,
  filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments (status, eta_date);
CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment ON public.shipment_events (shipment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_shipment_documents_shipment ON public.shipment_documents (shipment_id);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_documents ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.
