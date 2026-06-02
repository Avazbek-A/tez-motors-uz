-- Phase: FX-driven UZS auto-reprice.
--
-- The rates cron refreshes USD/UZS daily; this function lets it re-sync every
-- car's stored price_uzs in one bulk statement so the displayed sum prices
-- never drift from the live rate. Called via rpc() by the service-role cron.
CREATE OR REPLACE FUNCTION public.resync_car_uzs(p_rate NUMERIC)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF p_rate IS NULL OR p_rate <= 0 THEN
    RETURN 0;
  END IF;
  UPDATE public.cars
    SET price_uzs = ROUND(price_usd * p_rate), updated_at = now()
    WHERE price_usd IS NOT NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
