import { describe, expect, test } from "bun:test";
import {
  containsPortalAssetReference,
  editorPortalImagePreviewUrl,
  stablePortalAssetPreviewUrl,
  stablePortalImagePreviewUrl,
  withStablePortalAssetPreviews,
} from "./asset-preview-reference";

describe("portal asset preview references", () => {
  test("preserves a signed URL returned by a fresh upload without a stable reference", () => {
    const signedUrl =
      "https://signed.example/storage/v1/object/sign/portal-assets/fresh.png?token=abc";

    expect(
      editorPortalImagePreviewUrl(
        {
          asset_id: "asset-fresh",
          image_url: signedUrl,
          storage_path: "owner/portal/fresh.png",
        },
        "portal",
      ),
    ).toBe(signedUrl);
  });

  test("preserves an authorized preview route URL in the editor", () => {
    const previewUrl = "/api/portal-assets/preview?slug=portal&assetId=asset-1";

    expect(
      editorPortalImagePreviewUrl({ image_url: previewUrl }, "portal"),
    ).toBe(previewUrl);
  });

  test("keeps legacy storage URLs usable in the editor", () => {
    const signedUrl =
      "https://supabase.test/storage/v1/object/sign/portal-assets/owner%2Fportal%2Flegacy.png?token=abc";

    expect(
      editorPortalImagePreviewUrl({ image_url: signedUrl }, "portal"),
    ).toBe(signedUrl);
  });

  test("recognizes canonical asset id references", () => {
    expect(
      containsPortalAssetReference(
        { image_url: "portal-asset:asset-1" },
        "asset-1",
        null,
      ),
    ).toBe(true);
  });

  test("recognizes canonical storage path references", () => {
    expect(
      containsPortalAssetReference(
        { file_url: "portal-asset-path:owner/portal/file.svg" },
        null,
        "owner/portal/file.svg",
      ),
    ).toBe(true);
  });

  test("builds a stable preview URL from an asset id", () => {
    expect(stablePortalAssetPreviewUrl("my portal", "asset-1")).toBe(
      "/api/portal-assets/preview?slug=my+portal&assetId=asset-1",
    );
  });

  test("resolves canonical image pseudo URLs through the authorized preview route", () => {
    expect(stablePortalImagePreviewUrl("brand", "portal-asset:asset-1")).toBe(
      "/api/portal-assets/preview?slug=brand&assetId=asset-1",
    );
    expect(
      stablePortalImagePreviewUrl(
        "brand",
        "portal-asset-path:owner/portal/image.png",
      ),
    ).toBe(
      "/api/portal-assets/preview?slug=brand&path=owner%2Fportal%2Fimage.png",
    );
    expect(stablePortalImagePreviewUrl("brand", "https://cdn.test/a.png")).toBe(
      "https://cdn.test/a.png",
    );
  });

  test("normalizes every editable asset collection before client rendering", () => {
    const document = {
      portal: {
        description: "",
        name: "Portal",
        theme: "light" as const,
      },
      sections: [
        {
          allow_download: true,
          content: {
            files: [
              {
                allow_download: true,
                file_name: "mark.svg",
                file_url: "https://signed.example/mark.svg",
                id: "file-1",
                position: 0,
                asset_id: "asset-1",
                visible: true,
              },
            ],
          },
          description: "",
          id: "section-1",
          layout: {},
          position: 0,
          title: "Files",
          type: "files" as const,
          visible: true,
        },
      ],
      version: 1 as const,
    };

    expect(
      withStablePortalAssetPreviews(document, "portal").sections[0]?.content
        .files?.[0]?.file_url,
    ).toBe("/api/portal-assets/preview?slug=portal&assetId=asset-1");
  });
});
