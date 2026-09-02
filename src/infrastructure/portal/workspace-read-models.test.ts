import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("workspace read models are authenticated, minimal, and reservation-aware", async () => {
  const sql = await readFile(
    "supabase/migrations/20260817140000_workspace_read_models.sql",
    "utf8",
  );
  expect(sql).toContain("auth.uid() is null");
  expect(sql).toContain("set search_path = public");
  expect(sql).toContain("reservation_expires_at > now()");
  expect(sql).toContain("'canPurchase', p.owner_id = auth.uid()");
  expect(sql).toContain("'isOwner', p.owner_id = auth.uid()");
  expect(sql).toContain(
    "p.visibility='paid' and exists(select 1 from paid_portal_purchases",
  );
  expect(sql).toContain(
    "if auth.uid() is null then raise exception 'Authentication required'; end if;",
  );
  expect(sql).toContain(
    "grant execute on function public.get_home_workspace_summary() to authenticated",
  );
  expect(sql).toContain(
    "revoke all on function public.get_connect_status_summary() from public, anon",
  );
  expect(sql).not.toContain("password_hash");
  expect(sql).toContain("'accountEmail', a.account_email");
  expect(sql).toContain("'country', a.country");
  expect(sql).toContain("'displayName', a.display_name");
  expect(sql).toContain("'requirementsPending', a.requirements_pending");
  expect(sql).toContain("'verificationState', a.verification_state");
});

test("the forward migration preserves profile data for capability-only updates", async () => {
  const sql = await readFile(
    "supabase/migrations/20260817150000_stripe_connect_safe_projection.sql",
    "utf8",
  );
  expect(sql).not.toContain("alter table public.creator_stripe_accounts");
  expect(sql).toContain(
    "create or replace function public.upsert_creator_stripe_account(",
  );
  expect(sql).toContain("account_last_synced_at timestamptz default null");
  expect(sql).toContain(
    "revoke all on function public.upsert_creator_stripe_account",
  );
  expect(sql).toContain(
    "grant execute on function public.upsert_creator_stripe_account",
  );
  expect(sql).toContain(
    "create or replace function public.upsert_creator_stripe_account_projection(",
  );
  expect(sql).not.toContain(
    "create or replace function public.upsert_creator_stripe_account(\n  account_id text,\n  account_onboarding_status public.creator_stripe_onboarding_status,\n  account_details_submitted boolean default false,\n  account_charges_enabled boolean default false,\n  account_payouts_enabled boolean default false,\n  account_email",
  );
  expect(sql).toContain(
    "drop function if exists public.upsert_creator_stripe_account(\n  text, public.creator_stripe_onboarding_status, boolean, boolean, boolean,",
  );
  const legacyFunction = sql.slice(
    sql.indexOf(
      "create or replace function public.upsert_creator_stripe_account(",
    ),
    sql.indexOf(
      "create or replace function public.upsert_creator_stripe_account_projection(",
    ),
  );
  expect(legacyFunction).not.toContain(
    "account_email = excluded.account_email",
  );
});

test("migration ordering creates Stripe projection columns before read-model functions reference them", async () => {
  const readModels = await Bun.file(
    new URL(
      "../../../supabase/migrations/20260817140000_workspace_read_models.sql",
      import.meta.url,
    ),
  ).text();
  const projection = await Bun.file(
    new URL(
      "../../../supabase/migrations/20260817150000_stripe_connect_safe_projection.sql",
      import.meta.url,
    ),
  ).text();

  expect(
    readModels.indexOf("add column if not exists account_email text"),
  ).toBeGreaterThanOrEqual(0);
  expect(
    readModels.indexOf("add column if not exists account_email text"),
  ).toBeLessThan(
    readModels.indexOf(
      "create or replace function public.get_home_workspace_summary()",
    ),
  );
  expect(projection).not.toContain(
    "alter table public.creator_stripe_accounts",
  );
});

test("extended Stripe callers use the distinct projection RPC while onboarding keeps the legacy RPC", async () => {
  const complete = await Bun.file(
    new URL("../../app/api/billing/connect/complete/route.ts", import.meta.url),
  ).text();
  const status = await Bun.file(
    new URL("../../app/api/billing/connect/status/route.ts", import.meta.url),
  ).text();
  const onboarding = await Bun.file(
    new URL(
      "../../app/api/billing/connect/onboarding/route.ts",
      import.meta.url,
    ),
  ).text();

  expect(complete).toMatch(
    /rpc\(\s*["']upsert_creator_stripe_account_projection["']/,
  );
  expect(status).toMatch(
    /rpc\(\s*["']upsert_creator_stripe_account_projection["']/,
  );
  expect(onboarding).toMatch(/rpc\(\s*["']upsert_creator_stripe_account["']/);
});

test("settings seeds the plan provider instead of mounting an uninitialized plan query", async () => {
  const source = await Bun.file(
    new URL(
      "../../app/[locale]/(workspace)/create/[portalId]/settings/page.tsx",
      import.meta.url,
    ),
  ).text();
  expect(source).toContain("initialSnapshot");
  expect(source).toContain("canPurchase");
  expect(source).toContain("plan");
  expect(source).not.toMatch(/<PortalPlanProvider locale=/);
});

test("usage snapshots preserve owner-only purchase authorization", async () => {
  const source = await Bun.file(
    new URL(
      "../../app/[locale]/(workspace)/create/[portalId]/usage/page.tsx",
      import.meta.url,
    ),
  ).text();
  expect(source).toContain("summary.canPurchase === true");
  expect(source).toContain("summary.isOwner === true");
  expect(source).not.toContain('canPurchase: plan === "free"');
});

test("workspace queries keep home, usage, and connect caches distinct", async () => {
  const { workspaceQueryKeys } = await import("./workspace-read-models");
  expect(workspaceQueryKeys.home("en")).toEqual(["workspace", "home", "en"]);
  expect(workspaceQueryKeys.usage("portal-1")).toEqual([
    "workspace",
    "usage",
    "portal-1",
  ]);
  expect(workspaceQueryKeys.connect()).toEqual([
    "billing",
    "connect",
    "summary",
    "unresolved",
  ]);
  expect(workspaceQueryKeys.connect("acct_123")).not.toEqual(
    workspaceQueryKeys.connect(),
  );
});
