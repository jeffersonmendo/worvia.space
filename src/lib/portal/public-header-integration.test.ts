import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("public portal header integration", () => {
  test("uses the published export URL and wraps every portal view", () => {
    const accessSource = readFileSync(
      new URL("../../infrastructure/portal/server-access.ts", import.meta.url),
      "utf8",
    );
    const pageSource = readFileSync(
      new URL("../../app/[locale]/p/[slug]/page.tsx", import.meta.url),
      "utf8",
    );

    expect(accessSource).not.toContain('.from("profiles")');
    expect(accessSource).not.toContain("creatorName");
    expect(pageSource).toContain("<PublicPortalShell");
    expect(pageSource.match(/<PublicPortalShell/g)).toHaveLength(3);
    expect(pageSource).toMatch(
      /downloadHref=\{\s*portal\.allow_downloads\s*\? portalExportHref\(slug, exportSource\)\s*: undefined\s*\}/,
    );
    expect(pageSource).toContain("purchaseAction={{");
    expect(pageSource).toContain('headerT("buy"');
    expect(accessSource).toContain("assetType({");
    expect(accessSource).toContain("stringValue(file?.file_type)");
    expect(accessSource).toContain("orderedPreviewImageAssets.slice(0, 6)");
    expect(accessSource).toContain("orderedPreviewImageAssets.slice(0, 6)");
    expect(accessSource).not.toContain("...imageAssets.filter(");
    expect(accessSource).toContain("orderedPreviewImageAssets.length > 0");
    expect(accessSource).toContain("asset_id=");
    expect(accessSource).toContain('.order("position", { ascending: true })');
  });
});
