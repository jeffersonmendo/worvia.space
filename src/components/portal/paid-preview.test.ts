import { describe, expect, test } from "bun:test";
import {
  isPaidPreviewDecision,
  projectPaidPreview,
} from "./paid-preview-projection";

const paidPreviewSource = await Bun.file(
  new URL("./paid-preview.tsx", import.meta.url),
).text();

describe("projectPaidPreview", () => {
  test("keeps the paid preview content within the public portal width", () => {
    expect(paidPreviewSource).toContain("max-w-[900px]");
    expect(paidPreviewSource).not.toContain("max-w-6xl");
  });

  test("uses the full preview width without oversized responsive padding", () => {
    expect(paidPreviewSource).toContain("px-2 py-2");
    expect(paidPreviewSource).toContain(
      'className="text-2xl font-semibold tracking-[-0.03em] sm:text-4xl"',
    );
    expect(paidPreviewSource).toContain(
      "grid w-full min-w-0 gap-8 lg:grid-cols-2",
    );
    expect(paidPreviewSource).toContain('className="min-w-0 p-1"');
    expect(paidPreviewSource).not.toContain("sm:p-12");
    expect(paidPreviewSource).not.toContain("lg:p-16");
  });

  test("lets each responsive column use the complete available width", () => {
    expect(paidPreviewSource).not.toContain("max-w-2xl");
    expect(paidPreviewSource).not.toContain("max-w-xl");
    expect(paidPreviewSource).not.toContain("max-w-md");
  });

  test("renders compact file, color, size, and update metadata", () => {
    expect(paidPreviewSource).toContain("PortalFileTypeBadges");
    expect(paidPreviewSource).toContain("PortalColorStack");
    expect(paidPreviewSource).toContain('t("totalSize")');
    expect(paidPreviewSource).toContain('t("updatedAt")');
    expect(paidPreviewSource).toContain('t("totalImages")');
    expect(paidPreviewSource).toContain("IconPhotoFilled");
    expect(paidPreviewSource).toContain("IconDatabaseFilled");
    expect(paidPreviewSource).not.toContain('t("createdAt")');
    expect(paidPreviewSource).not.toContain('t("previewLabel")');
    expect(paidPreviewSource).not.toContain('t("previewDescription")');
    expect(paidPreviewSource).not.toContain("IconLock");
    expect(paidPreviewSource).not.toContain("grid grid-cols-5");
    expect(paidPreviewSource).toContain(
      'normalizedType.includes("illustrator")',
    );
    expect(paidPreviewSource).toContain('candidate === "postscript"');
  });

  test("renders additional preview images in a horizontal scroll", () => {
    expect(paidPreviewSource).toContain("preview.previewImages.slice(1, 5)");
    expect(paidPreviewSource).toContain('className="scroll-fade flex w-full');
    expect(paidPreviewSource).toContain("size-[100px] shrink-0");
    expect(paidPreviewSource).toContain("rounded-lg bg-secondary");
    expect(paidPreviewSource).toContain('className="size-full object-contain"');
    expect(paidPreviewSource).toContain(
      'className="aspect-[16/10] w-full object-contain"',
    );
    expect(paidPreviewSource).toContain('t("moreImages"');
  });

  test("orders metadata as files, colors, images, size, and dates", () => {
    const files = paidPreviewSource.indexOf("<PortalFileTypeBadges");
    const colors = paidPreviewSource.indexOf("<PortalColorStack");
    const images = paidPreviewSource.indexOf("<IconPhotoFilled");
    const size = paidPreviewSource.indexOf("<IconDatabaseFilled");
    const date = paidPreviewSource.indexOf("<IconCalendarEventFilled");

    expect(files).toBeLessThan(colors);
    expect(colors).toBeLessThan(images);
    expect(images).toBeLessThan(size);
    expect(size).toBeLessThan(date);
  });

  test("shows the premium badge before the metadata list", () => {
    const premium = paidPreviewSource.indexOf('t("premium")');
    const files = paidPreviewSource.indexOf("<PortalFileTypeBadges");

    expect(paidPreviewSource).toContain("IconCrownFilled");
    expect(paidPreviewSource).toContain("<Badge");
    expect(paidPreviewSource).toContain("border-0 bg-amber-400/15");
    expect(paidPreviewSource).not.toContain("border-amber-400/30");
    expect(premium).toBeGreaterThan(-1);
    expect(premium).toBeLessThan(files);
  });

  test("shows the complete included benefits list", () => {
    expect(paidPreviewSource).toContain('t("oneTimePayment")');
    expect(paidPreviewSource).toContain('t("fullAccess")');
    expect(paidPreviewSource).toContain('t("originalImages")');
    expect(paidPreviewSource).toContain('t("privateAccess")');
    expect(paidPreviewSource).toContain('t("lifetimeUpdates")');
  });

  test("keeps the purchase action only in the floating header", () => {
    expect(paidPreviewSource).not.toContain("PaidUnlockButton");
    expect(paidPreviewSource).not.toContain('t("unlock")');
    expect(paidPreviewSource).not.toContain(
      "Purchase access to unlock all resources.",
    );
  });

  test("recognizes only the preview access states", () => {
    expect(isPaidPreviewDecision("preview_required")).toBe(true);
    expect(isPaidPreviewDecision("paid-not-purchased")).toBe(true);
    expect(isPaidPreviewDecision("allowed")).toBe(false);
    expect(isPaidPreviewDecision("not_found")).toBe(false);
  });

  test("projects safe portal and asset summary fields without document content", () => {
    const result = projectPaidPreview({
      assetSummary: [
        { assetType: "image", count: 3, totalBytes: 12_345 },
        { assetType: "pdf", count: 1, totalBytes: 67_890 },
      ],
      colors: ["#111111", "#ffffff"],
      description: "A concise project description.",
      name: "Northstar",
      previewImages: [
        { alt: "Selected cover", src: "https://cdn.test/cover.jpg" },
      ],
      sampleFiles: [{ assetType: "pdf" }],
      price: "$19.99",
      totalBytes: 80_235,
      totalFiles: 4,
      totalImages: 3,
    });

    expect(result).toEqual({
      assetSummary: [
        { assetType: "image", count: 3, totalBytes: 12_345 },
        { assetType: "pdf", count: 1, totalBytes: 67_890 },
      ],
      colors: ["#111111", "#ffffff"],
      description: "A concise project description.",
      name: "Northstar",
      previewImages: [
        { alt: "Selected cover", src: "https://cdn.test/cover.jpg" },
      ],
      sampleFiles: [{ assetType: "pdf" }],
      price: "$19.99",
      totalBytes: 80_235,
      totalFiles: 4,
      totalImages: 3,
    });
    expect(result).not.toHaveProperty("document");
    expect(result).not.toHaveProperty("downloadUrl");
  });

  test("drops invalid image and summary values instead of fabricating data", () => {
    expect(
      projectPaidPreview({
        assetSummary: [
          { assetType: "image", count: 0, totalBytes: 10 },
          { assetType: "pdf", count: 2, totalBytes: -1 },
        ],
        description: null,
        name: "Northstar",
        previewImages: [
          { alt: "", src: "" },
          { alt: "Safe", src: "https://cdn.test/safe.jpg" },
        ],
        sampleFiles: [{ assetType: "pdf" }, { assetType: "" }],
      }),
    ).toEqual({
      assetSummary: [],
      colors: [],
      description: null,
      name: "Northstar",
      previewImages: [{ alt: "Safe", src: "https://cdn.test/safe.jpg" }],
      sampleFiles: [{ assetType: "pdf" }],
      price: null,
      totalBytes: 0,
      totalFiles: 0,
      totalImages: 0,
    });
  });
});
