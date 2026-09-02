import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260814100000_ai_portal_credits.sql",
  ),
  "utf8",
);
const costMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260817180000_portal_content_language_and_ai_costs.sql",
  ),
  "utf8",
);

describe("AI credits migration", () => {
  it("stores account-level monthly credits and an idempotent ledger", () => {
    expect(migration).toContain("create table public.ai_credit_accounts");
    expect(migration).toContain("create table public.ai_credit_ledger");
    expect(migration).toContain("unique (owner_id, request_id)");
    expect(migration).toContain("auth.uid()");
  });

  it("reserves the documented operation costs atomically", () => {
    expect(migration).toContain("when 'generate' then 3");
    expect(costMigration).toContain("when 'improve-project' then 2");
    expect(migration).toContain("when 'refine-copy' then 1");
    expect(migration).toContain("for update");
  });

  it("keeps portal content language in the existing settings RPC", async () => {
    const settingsMigration = await Bun.file(
      "supabase/migrations/20260817210000_extend_portal_settings_language.sql",
    ).text();
    expect(settingsMigration).toContain(
      "portal_content_language text default 'en'",
    );
    expect(settingsMigration).toContain(
      "drop function if exists public.set_portal_content_language(uuid, text)",
    );
    expect(settingsMigration).toContain(
      "content_language = portal_content_language",
    );
  });
});
