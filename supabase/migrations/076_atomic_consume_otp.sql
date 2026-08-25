-- 076_atomic_consume_otp.sql
-- Atomic OTP verification to close two concurrency holes in verify-otp:
--
--  (1) Attempt-cap bypass: the route read otp.attempts, checked `>= MAX`, then
--     later UPDATEd attempts = attempts + 1. N concurrent guesses for one phone
--     all read the same attempts value, all pass the cap, and each increments
--     from the stale value — so far more than MAX guesses land per code,
--     brute-forcing the 6-digit (1e6) keyspace into a customer account takeover.
--  (2) Burn race: the correct-code path UPDATEd consumed_at with no conditional,
--     so two concurrent requests with the same valid code both minted a session.
--
-- This function does it all under a single FOR UPDATE row lock, so concurrent
-- attempts on the same code serialize: each increments attempts atomically, and
-- the winner that matches burns the code (the lock + `consumed_at IS NULL` in the
-- locked SELECT guarantee exactly one success). Returns a status string the
-- route maps to a response. Called only by the server's service-role client.

CREATE OR REPLACE FUNCTION public.consume_otp(p_phone text, p_code_hash text, p_max int)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
  v_hash text;
  v_attempts int;
BEGIN
  -- Newest live code for this phone, locked for the duration of this call.
  SELECT id, code_hash, attempts
    INTO v_id, v_hash, v_attempts
  FROM public.otp_codes
  WHERE phone = p_phone
    AND consumed_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';   -- no live code (or already consumed/expired)
  END IF;

  -- Atomic attempt increment under the lock.
  UPDATE public.otp_codes SET attempts = v_attempts + 1 WHERE id = v_id;

  IF v_attempts + 1 > p_max THEN
    RETURN 'too_many';
  END IF;

  IF v_hash IS DISTINCT FROM p_code_hash THEN
    RETURN 'wrong';
  END IF;

  -- Correct and within budget: burn it so it can never yield a second session.
  UPDATE public.otp_codes SET consumed_at = now() WHERE id = v_id;
  RETURN 'ok';
END;
$$;

-- Server-only: must not be callable with the public anon/authenticated keys
-- (that would bypass the route's rate-limit + Turnstile).
REVOKE ALL ON FUNCTION public.consume_otp(text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_otp(text, text, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_otp(text, text, int) TO service_role;
