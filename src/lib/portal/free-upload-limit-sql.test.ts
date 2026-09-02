import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../../../supabase/migrations/20260810120000_multi_plan_billing.sql",
  import.meta.url,
);
const reservationCleanupMigration = new URL(
  "../../../supabase/migrations/20260808150000_ignore_expired_asset_reservations.sql",
  import.meta.url,
);

describe("Free portal upload limit migration", () => {
  test("persists and validates the server-owned checkout transition", async () => {
    const sql = await Bun.file(migration).text();
    expect(sql).toContain("amount_total");
    expect(sql).toContain("current_plan");
    expect(sql).toContain("target_upgrade_from");
    expect(sql).toContain("current_plan <> target_upgrade_from");
  });

  test("protects repurchases from stale payment intents and matches one attempt", async () => {
    const sql = await Bun.file(migration).text();
    expect(sql).toContain("portal_payment_states");
    expect(sql).toContain(
      "stripe_payment_intent_id <> event_payment_intent_id",
    );
    expect(sql).toContain(
      "attempt_upgrade_from is distinct from current_entitlement_plan",
    );
    expect(sql).toContain("event_checkout_attempt_key");
    expect(sql).toContain("idempotency_key::text=event_checkout_attempt_key");
    expect(sql).not.toContain("where portal_id=event_portal_id;");
  });

  test("removes vulnerable legacy checkout function overloads", async () => {
    const sql = await Bun.file(migration).text();

    expect(sql).toContain(
      "drop function if exists public.begin_portal_checkout(uuid);",
    );
    expect(sql).toContain(
      "drop function if exists public.apply_portal_entitlement_event(text,text,public.portal_entitlement_status,uuid,uuid,text,text,integer,text);",
    );
    expect(sql).toContain(
      "drop function if exists public.apply_portal_entitlement_event(text,text,public.portal_entitlement_status,uuid,uuid,text,text,integer,text,bigint);",
    );
  });

  test("allows same-payment-intent dispute recovery to reactivate entitlement", async () => {
    const sql = await Bun.file(migration).text();

    expect(sql).toContain(
      "event_type='charge.dispute.closed' and event_status='active'",
    );
    expect(sql).toContain(
      "where stripe_payment_intent_id=event_payment_intent_id",
    );
    expect(sql).toContain("revoked_at=null");
  });
  test("keeps the storage bucket at the shared 500 MiB upload ceiling", async () => {
    const sql = await Bun.file(migration).text();

    expect(sql).toContain(
      "update storage.buckets set file_size_limit = 524288000",
    );
    expect(sql).toContain("where id = 'portal-assets'");
  });

  test("enforces 500 MiB consistently when reserving and finalizing", async () => {
    const sql = await Bun.file(migration).text();

    expect(sql).toContain("reserve_portal_asset");
    expect(sql).toContain("finalize_portal_asset");
    expect(sql.match(/> 524288000/g)).toHaveLength(2);
  });

  test("uses portal-scoped quotas for every plan", async () => {
    const sql = await Bun.file(migration).text();

    expect(sql).toContain("case plan when 'starter' then 524288000");
    expect(sql).toContain("where portal_id=target_portal_id");
    expect(sql).toContain("where portal_id=saved.portal_id");
    expect(sql).toContain("where portal_id=target_portal_id");
  });

  test("retains trusted finalization permissions", async () => {
    const sql = await Bun.file(migration).text();

    expect(sql).toContain(
      "revoke all on function public.finalize_portal_asset(uuid,bigint,text) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.finalize_portal_asset(uuid,bigint,text) to service_role",
    );
  });

  test("does not charge quota for expired reservations", async () => {
    const sql = await Bun.file(reservationCleanupMigration).text();

    expect(sql).toContain("state='reserved' and reservation_expires_at>now()");
    expect(sql).toContain(
      "a.state='reserved' and a.reservation_expires_at>now()",
    );
  });
});
