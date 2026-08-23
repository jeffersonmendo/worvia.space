import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("home summaries project real file formats and document colors", async () => {
  const sql = await readFile(
    "supabase/migrations/20260822120000_home_card_metadata.sql",
    "utf8",
  );

  expect(sql).toContain("'fileTypes'");
  expect(sql).toContain("portal_documents");
  expect(sql).toContain(
    "lower(regexp_replace(file_item->>'file_name', '^.*\\.', ''))",
  );
  expect(sql).toContain("in ('ai','psd','eps','pdf')");
  expect(sql).toContain("'colors'");
  expect(sql).toContain("portal_documents");
  expect(sql).toContain("color_item->>'color_code'");
});

test("purchased summaries only derive metadata from the immutable published snapshot", async () => {
  const sql = await readFile(
    "supabase/migrations/20260822120000_home_card_metadata.sql",
    "utf8",
  );
  const purchasedBranch = sql.slice(
    sql.indexOf("      union all\n      select jsonb_build_object"),
  );

  expect(purchasedBranch).toContain("join portal_publications publication");
  expect(purchasedBranch).toContain("publication.snapshot->'document'");
  expect(purchasedBranch).not.toContain("from portal_assets a");
  expect(purchasedBranch).not.toContain("from portal_documents pd");
});

test("color projection deduplicates case-insensitively before applying its limit", async () => {
  const sql = await readFile(
    "supabase/migrations/20260822120000_home_card_metadata.sql",
    "utf8",
  );

  const firstPalette = sql.slice(
    sql.indexOf("'colors'"),
    sql.indexOf(") palette), '[]'::jsonb)"),
  );
  expect(firstPalette).toContain("partition by lower(color_code)");
  expect(firstPalette.indexOf("duplicate_rank=1")).toBeLessThan(
    firstPalette.indexOf("limit 5"),
  );
});

test("metadata projection treats missing visibility as visible and excludes hidden sections and items", async () => {
  const sql = await readFile(
    "supabase/migrations/20260822120000_home_card_metadata.sql",
    "utf8",
  );
  const ownerBranch = sql.slice(0, sql.indexOf("union all"));
  const purchasedBranch = sql.slice(sql.indexOf("union all"));

  for (const branch of [ownerBranch, purchasedBranch]) {
    expect(branch).toContain(
      "coalesce((section.item->>'visible')::boolean,true)",
    );
    expect(branch).toContain(
      "coalesce((color_item->>'visible')::boolean,true)",
    );
  }
  expect(purchasedBranch).toContain(
    "coalesce((file_item->>'visible')::boolean,true)",
  );
});

test("image previews are visible, capped, and buyer-safe", async () => {
  const sql = await readFile(
    "supabase/migrations/20260822130000_home_card_image_metadata.sql",
    "utf8",
  );
  const purchasedBranch = sql.slice(
    sql.indexOf("      union all\n      select jsonb_build_object"),
  );

  expect(sql.match(/'images', coalesce/g)).toHaveLength(2);
  expect(sql).toContain("image_item->>'image_url'");
  expect(sql).toContain("coalesce((image_item->>'visible')::boolean,true)");
  expect(sql).toContain("limit 5");
  expect(purchasedBranch).toContain("publication.snapshot->'document'");
  expect(purchasedBranch).not.toContain("from portal_documents pd");
});

test("a forward migration updates environments that already recorded the initial card metadata migration", async () => {
  const baseSql = await readFile(
    "supabase/migrations/20260822120000_home_card_metadata.sql",
    "utf8",
  );
  const sql = await readFile(
    "supabase/migrations/20260822130000_home_card_image_metadata.sql",
    "utf8",
  );

  expect(sql).toContain(
    "create or replace function public.get_home_workspace_summary()",
  );
  expect(sql.match(/'images', coalesce/g)).toHaveLength(2);
  expect(baseSql).not.toContain("'images', coalesce");
  expect(baseSql).not.toBe(sql);
});

test("every forward function replacement preserves security and base metadata guarantees", async () => {
  for (const migration of [
    "20260822120000_home_card_metadata.sql",
    "20260822130000_home_card_image_metadata.sql",
    "20260822140000_home_card_image_asset_references.sql",
    "20260822150000_limit_home_card_images.sql",
    "20260822160000_fix_home_card_file_count.sql",
    "20260822170000_home_card_total_image_count.sql",
  ]) {
    const sql = await readFile(`supabase/migrations/${migration}`, "utf8");
    expect(sql).toContain("security definer set search_path = public");
    expect(sql).toContain(
      "revoke all on function public.get_home_workspace_summary() from public, anon",
    );
    expect(sql).toContain(
      "grant execute on function public.get_home_workspace_summary() to authenticated",
    );
    expect(sql).toContain("'fileTypes'");
    expect(sql).toContain("'colors'");
    expect(sql).toContain("publication.snapshot->'document'");
  }
});

test("latest forward migration projects canonical image asset references", async () => {
  const sql = await readFile(
    "supabase/migrations/20260822140000_home_card_image_asset_references.sql",
    "utf8",
  );

  expect(sql.match(/'assetId', image_item->>'asset_id'/g)).toHaveLength(2);
  expect(sql.match(/'storagePath', image_item->>'storage_path'/g)).toHaveLength(
    2,
  );
});

test("image limit forward migration caps both owner and buyer projections at one", async () => {
  const sql = await readFile(
    "supabase/migrations/20260822150000_limit_home_card_images.sql",
    "utf8",
  );

  expect(
    sql.match(
      /unique_images where duplicate_rank=1 order by section_position, image_position limit 1/g,
    ),
  ).toHaveLength(2);
  expect(
    sql.match(/'backgroundColor', image_item->>'background_color'/g),
  ).toHaveLength(2);
  expect(
    sql.match(/'containerPadding', image_item->'container_padding'/g),
  ).toHaveLength(2);
});

test("latest home summary counts every visible file for owners and buyers", async () => {
  const sql = await readFile(
    "supabase/migrations/20260822160000_fix_home_card_file_count.sql",
    "utf8",
  );

  const ownerBranch = sql.slice(0, sql.indexOf("      union all\n"));
  const buyerBranch = sql.slice(sql.indexOf("      union all\n"));
  const totalFileCountBlock = (branch: string) =>
    branch.slice(
      branch.indexOf("'totalFileCount'"),
      branch.indexOf("'colors'", branch.indexOf("'totalFileCount'")),
    );
  const ownerCount = totalFileCountBlock(ownerBranch);
  const buyerCount = totalFileCountBlock(buyerBranch);

  expect(ownerCount).toContain("select count(*)");
  expect(ownerCount).toContain("from portal_documents pd");
  expect(ownerCount).toContain("where pd.portal_id=p.id");
  expect(ownerCount).not.toContain("publication.snapshot");

  expect(buyerCount).toContain("select count(*)");
  expect(buyerCount).toContain("publication.snapshot->'document'");
  expect(buyerCount).not.toContain("from portal_documents pd");

  for (const countBlock of [ownerCount, buyerCount]) {
    expect(countBlock).toContain("section.item->>'type'='files'");
    expect(countBlock).toContain(
      "coalesce((section.item->>'visible')::boolean,true)",
    );
    expect(countBlock).toContain(
      "coalesce((file_item->>'visible')::boolean,true)",
    );
    expect(countBlock).not.toContain("regexp_replace");
    expect(countBlock).not.toContain("in ('ai','psd','eps','pdf')");
  }
});

test("file count ships in a new forward migration after the image limit migration", async () => {
  const previous = await readFile(
    "supabase/migrations/20260822150000_limit_home_card_images.sql",
    "utf8",
  );
  const forward = await readFile(
    "supabase/migrations/20260822160000_fix_home_card_file_count.sql",
    "utf8",
  );

  expect(forward).toContain(
    "create or replace function public.get_home_workspace_summary()",
  );
  expect(forward.match(/'totalFileCount'/g)).toHaveLength(2);
  expect(
    forward.match(
      /unique_images where duplicate_rank=1 order by section_position, image_position limit 1/g,
    ),
  ).toHaveLength(2);
  expect(
    forward.match(/'backgroundColor', image_item->>'background_color'/g),
  ).toHaveLength(2);
  expect(
    forward.match(/'containerPadding', image_item->'container_padding'/g),
  ).toHaveLength(2);
  expect(forward).toContain(
    "revoke all on function public.get_home_workspace_summary() from public, anon",
  );
  expect(forward).toContain(
    "grant execute on function public.get_home_workspace_summary() to authenticated",
  );
  expect(forward).not.toBe(previous);
});

test("a new forward migration counts all unique visible images without expanding previews", async () => {
  const sql = await readFile(
    "supabase/migrations/20260822170000_home_card_total_image_count.sql",
    "utf8",
  );
  const ownerBranch = sql.slice(0, sql.indexOf("      union all\n"));
  const buyerBranch = sql.slice(sql.indexOf("      union all\n"));
  const imageCountBlock = (branch: string) =>
    branch.slice(
      branch.indexOf("'totalImageCount'"),
      branch.indexOf(
        "\n        'images',",
        branch.indexOf("'totalImageCount'"),
      ),
    );

  for (const block of [
    imageCountBlock(ownerBranch),
    imageCountBlock(buyerBranch),
  ]) {
    expect(block).toContain("count(distinct image_url)");
    expect(block).toContain(
      "coalesce(image_item->>'image_url', image_item->>'asset_id', image_item->>'storage_path')",
    );
    expect(block).toContain("coalesce((image_item->>'visible')::boolean,true)");
    expect(block).toContain("image_url <> ''");
  }
  expect(imageCountBlock(ownerBranch)).toContain("from portal_documents pd");
  expect(imageCountBlock(ownerBranch)).not.toContain("publication.snapshot");
  expect(imageCountBlock(buyerBranch)).toContain(
    "publication.snapshot->'document'",
  );
  expect(imageCountBlock(buyerBranch)).not.toContain(
    "from portal_documents pd",
  );
  expect(
    sql.match(
      /unique_images where duplicate_rank=1 order by section_position, image_position limit 1/g,
    ),
  ).toHaveLength(2);
});

test("latest forward migration preserves all colors for the remaining count", async () => {
  const sql = await readFile(
    "supabase/migrations/20260823090000_fix_home_card_color_count.sql",
    "utf8",
  );
  const ownerBranch = sql.slice(0, sql.indexOf("      union all\n"));
  const buyerBranch = sql.slice(sql.indexOf("      union all\n"));

  for (const branch of [ownerBranch, buyerBranch]) {
    const palette = branch.slice(
      branch.indexOf("'colors'"),
      branch.indexOf(") palette), '[]'::jsonb)"),
    );
    expect(palette).toContain("duplicate_rank=1");
    expect(palette).not.toContain("limit 5");
  }
  expect(
    sql.match(
      /unique_images where duplicate_rank=1 order by section_position, image_position limit 1/g,
    ),
  ).toHaveLength(2);
});
