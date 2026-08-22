import { describe, expect, test } from "bun:test";
import {
  normalizePortalCardColorCount,
  normalizePortalCardColors,
  normalizePortalCardFileCount,
  normalizePortalCardFileTypes,
  normalizePortalCardImageCount,
  normalizePortalCardImages,
} from "./portal-card-metadata";

describe("portal card metadata", () => {
  test("keeps supported design formats unique and ordered", () => {
    expect(
      normalizePortalCardFileTypes(["PDF", ".ai", "psd", "ai", "svg"]),
    ).toEqual(["ai", "psd", "pdf"]);
  });

  test("normalizes the total visible file count", () => {
    expect(normalizePortalCardFileCount(12.8)).toBe(12);
    expect(normalizePortalCardFileCount(-2)).toBe(0);
    expect(normalizePortalCardFileCount(Number.NaN)).toBe(0);
    expect(normalizePortalCardFileCount("12")).toBe(0);
  });

  test("normalizes the total unique visible image count", () => {
    expect(normalizePortalCardImageCount(20)).toBe(20);
    expect(normalizePortalCardImageCount(Number.NaN)).toBe(0);
  });

  test("keeps only the first unique valid image in source order", () => {
    expect(
      normalizePortalCardImages(
        [
          { url: "https://cdn.test/a.png", alt: "A", width: 400, height: 200 },
          { url: "https://cdn.test/a.png", alt: "duplicate" },
          { url: "", alt: "invalid" },
          ...Array.from({ length: 6 }, (_, index) => ({
            url: `https://cdn.test/${index}.png`,
          })),
        ],
        "brand",
      ),
    ).toEqual([
      {
        url: "https://cdn.test/a.png",
        alt: "A",
        backgroundColor: "secondary",
        containerPadding: 0,
        width: 400,
        height: 200,
      },
    ]);
  });

  test("routes image asset references through the authorized preview endpoint", () => {
    expect(
      normalizePortalCardImages(
        [{ url: "portal-asset:asset-1" }],
        "my portal",
      )[0]?.url,
    ).toBe("/api/portal-assets/preview?slug=my+portal&assetId=asset-1");
    expect(
      normalizePortalCardImages(
        [{ url: "portal-asset-path:owner/portal/image.png" }],
        "my portal",
      )[0]?.url,
    ).toBe(
      "/api/portal-assets/preview?slug=my+portal&path=owner%2Fportal%2Fimage.png",
    );
  });

  test("replaces stale signed URLs when canonical asset metadata is available", () => {
    expect(
      normalizePortalCardImages(
        [{ url: "https://signed.test/expired.png", assetId: "asset-1" }],
        "brand",
      )[0]?.url,
    ).toBe("/api/portal-assets/preview?slug=brand&assetId=asset-1");
  });

  test("keeps the first image presentation metadata used by the portal renderer", () => {
    expect(
      normalizePortalCardImages(
        [
          {
            url: "https://cdn.test/logo.png",
            alt: "Logo",
            background_color: "#123456",
            container_padding: 24,
          },
        ],
        "brand",
      ),
    ).toEqual([
      {
        url: "https://cdn.test/logo.png",
        alt: "Logo",
        width: undefined,
        height: undefined,
        backgroundColor: "#123456",
        containerPadding: 10,
      },
    ]);
  });

  test("caps home card image padding without changing the canonical document", () => {
    for (const [padding, expected] of [
      [0, 0],
      [10, 10],
      [14, 10],
      [15, 10],
      [20, 10],
      [-1, 0],
      [Number.NaN, 0],
    ] as const) {
      expect(
        normalizePortalCardImages(
          [{ url: "https://cdn.test/logo.png", container_padding: padding }],
          "brand",
        )[0]?.containerPadding,
      ).toBe(expected);
    }
  });

  test("keeps only valid unique hex colors and caps the visual stack at four", () => {
    expect(
      normalizePortalCardColors([
        "#FF0000",
        "#00ff00",
        "not-a-color",
        "#ff0000",
        "#123",
        "#0000ff",
        "#ffffff",
        "#111111",
      ]),
    ).toEqual(["#FF0000", "#00ff00", "#123", "#0000ff"]);
    expect(
      normalizePortalCardColorCount([
        "#FF0000",
        "#00ff00",
        "not-a-color",
        "#ff0000",
        "#123",
        "#0000ff",
        "#ffffff",
        "#111111",
      ]),
    ).toBe(6);
  });
});
