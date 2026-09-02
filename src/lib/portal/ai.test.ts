import { describe, expect, it } from "bun:test";
import { createImageItem } from "@/domain/portal/document";
import {
  type AssetAnalysisInput,
  analyzeImageAsset,
  applyAiImageAnalysis,
  constrainImageAspectRatio,
  unifyImagePresentation,
} from "@/lib/portal/ai";

const asset: AssetAnalysisInput = {
  id: "logo",
  name: "brand-logo.png",
  mimeType: "image/png",
  width: 1200,
  height: 400,
  hasTransparency: true,
};

describe("portal AI asset analysis", () => {
  it("detects transparent logos and recommends contain", () => {
    expect(analyzeImageAsset(asset)).toMatchObject({
      backgroundColor: "secondary",
      contentType: "logo",
      containerPadding: 16,
      fit: "contain",
      aspectRatio: "21/9",
      orientation: "landscape",
    });
  });

  it("never replaces manually edited image fields", () => {
    const image = {
      ...createImageItem("logo", 0),
      fit: "cover" as const,
      aspect_ratio: "1/1" as const,
      field_origins: {
        background_color: "manual" as const,
        container_padding: "manual" as const,
        fit: "manual" as const,
        aspect_ratio: "manual" as const,
      },
      background_color: "#111111",
      container_padding: 4,
    };
    const next = applyAiImageAnalysis(image, analyzeImageAsset(asset));
    expect(next.fit).toBe("cover");
    expect(next.aspect_ratio).toBe("1/1");
    expect(next.background_color).toBe("#111111");
    expect(next.container_padding).toBe(4);
  });

  it("does not allow a non-square image to become a square", () => {
    expect(constrainImageAspectRatio(1600, 900, "1/1")).toBe("16/9");
    expect(constrainImageAspectRatio(800, 1400, "1/1")).toBe("auto");
    expect(constrainImageAspectRatio(1000, 1000, "1/1")).toBe("1/1");
  });

  it("uses the dominant aspect ratio for image collections", () => {
    const images = [
      { ...createImageItem("one", 0), width: 1600, height: 900 },
      { ...createImageItem("two", 1), width: 1600, height: 900 },
      { ...createImageItem("three", 2), width: 800, height: 1200 },
    ];
    expect(
      unifyImagePresentation(images).map((image) => image.aspect_ratio),
    ).toEqual(["16/9", "16/9", "16/9"]);
  });
});
