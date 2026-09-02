import { describe, expect, test } from "bun:test";

const actions = await Bun.file(
  new URL("../../app/[locale]/_actions/portals.ts", import.meta.url),
).text();
const portalHome = await Bun.file(
  new URL(
    "../../app/[locale]/(workspace)/_components/portal-home.tsx",
    import.meta.url,
  ),
).text();
const englishMessages = await Bun.file(
  new URL("../../../messages/en.json", import.meta.url),
).text();
const spanishMessages = await Bun.file(
  new URL("../../../messages/es.json", import.meta.url),
).text();

const migration = await Bun.file(
  new URL(
    "../../../supabase/migrations/20260819110000_portal_social_interactions.sql",
    import.meta.url,
  ),
).text();

describe("portal social interactions migration", () => {
  test("protects private relationships behind RLS and RPCs", () => {
    expect(migration).toContain("create table public.portal_favorites");
    expect(migration).toContain("create table public.portal_likes");
    expect(migration).toContain("create table public.portal_library_items");
    expect(migration).toContain("primary key (user_id, portal_id)");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table");
    expect(migration).toContain("grant select on table");
    expect(migration).toContain("set search_path = public");
    expect(migration).toContain("auth.uid()");
  });

  test("keeps purchased library items and limits the recent read model", () => {
    expect(migration).toContain("status = 'paid'");
    expect(migration).toContain("source = 'purchased'");
    expect(migration).toContain("Purchased library items cannot be removed");
    expect(migration).toContain(
      "least(greatest(coalesce(target_limit, 5), 1), 5)",
    );
    expect(migration).toContain("order by f.created_at desc");
    expect(migration).toContain(
      "from public.paid_portal_access_grants g\nwhere g.status = 'paid'",
    );
    expect(migration).toContain(
      "on conflict (user_id, portal_id) do update\n  set source = 'purchased'",
    );
    expect(migration).toContain(
      "after insert or update of status on public.paid_portal_access_grants",
    );
  });

  test("normalizes favorite state and rolls back explicit action errors", () => {
    expect(actions).toContain("isFavorite: boolean;");
    expect(actions).toContain("isFavorite: portal.isFavorite === true");
    expect(portalHome).toContain(
      "onSuccess: async (result, _variables, context)",
    );
    expect(portalHome).toContain(
      "queryClient.setQueryData(portalsQueryKey(locale), context.previous)",
    );
    expect(portalHome).toContain("copy.portal.favorite.saveError");
  });

  test("defines a localized favorite save error", () => {
    expect(englishMessages).toContain(
      '"saveError": "Favorite could not be saved"',
    );
    expect(spanishMessages).toContain(
      '"saveError": "No se pudo guardar el favorito"',
    );
  });
});
