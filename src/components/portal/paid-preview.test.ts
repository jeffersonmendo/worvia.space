import { describe, expect, test } from "bun:test";
import {
  isPaidPreviewDecision,
  projectPaidPreview,
} from "./paid-preview-projection";

const paidPreviewSource = await Bun.file(
  new URL("./paid-preview.tsx", import.meta.url),
).text();
const paidPreviewCarouselSource = await Bun.file(
  new URL("./paid-preview-carousel.tsx", import.meta.url),
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
      "grid w-full min-w-0 gap-4 min-[800px]:gap-8 min-[800px]:flex",
    );
    expect(paidPreviewSource).toContain("min-w-0 p-1");
    expect(paidPreviewSource).not.toContain("sm:p-12");
    expect(paidPreviewSource).not.toContain("lg:p-16");
  });

  test("lets each responsive column use the complete available width", () => {
    expect(paidPreviewSource).not.toContain("max-w-2xl");
    expect(paidPreviewSource).not.toContain("max-w-xl");
    expect(paidPreviewSource).not.toContain("max-w-md");
  });

  test("places the image block between the description and metadata on mobile", () => {
    expect(paidPreviewSource).toContain("order-1");
    expect(paidPreviewSource).toContain("order-2");
    expect(paidPreviewSource).toContain("order-3");
    expect(paidPreviewSource).toContain("order-4");
    expect(paidPreviewSource).toContain("order-5");
    expect(paidPreviewSource).toContain("min-[800px]:w-1/2");
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
    expect(paidPreviewSource).toContain("preview.previewImages.slice(1, 6)");
    expect(paidPreviewSource).toContain("PaidPreviewCarousel");
    expect(paidPreviewCarouselSource).toContain("<Carousel");
    expect(paidPreviewCarouselSource).toContain("<CarouselContent");
    expect(paidPreviewCarouselSource).toContain("loop: true");
    expect(paidPreviewCarouselSource).toContain("containScroll: false");
    expect(paidPreviewCarouselSource).toContain("slidesToScroll: 1");
    expect(paidPreviewCarouselSource).toContain(
      "images.length > 1 && images.length < 6 ? [...images, ...images] : images",
    );
    expect(paidPreviewCarouselSource).toContain("Autoplay({ delay: 3000");
    expect(paidPreviewCarouselSource).toContain(
      'className="left-2 shadow-md disabled:opacity-70"',
    );
    expect(paidPreviewCarouselSource).toContain('variant="secondary"');
    expect(paidPreviewCarouselSource).toContain(
      'className="right-2 shadow-md disabled:opacity-70"',
    );
    expect(paidPreviewCarouselSource).toContain('className="basis-1/3"');
    expect(paidPreviewCarouselSource).toContain(
      'className="aspect-square overflow-hidden rounded-lg"',
    );
    expect(paidPreviewCarouselSource).toContain(
      'className="size-full select-none object-contain"',
    );
    expect(paidPreviewSource).toContain(
      'className="aspect-[16/10] w-full select-none object-contain"',
    );
    expect(paidPreviewSource).not.toContain("rounded-lg bg-secondary");
    expect(paidPreviewCarouselSource).toContain(
      "Math.min(Math.max(image.containerPadding ?? 0, 0), 10)",
    );
    expect(paidPreviewCarouselSource).toContain(
      "style={imagePresentationStyle(image)}",
    );
    expect(paidPreviewSource).toContain(
      "style={imagePresentationStyle(previewImage)}",
    );
    expect(paidPreviewSource).toContain("select-none object-contain");
    expect(paidPreviewSource).toContain("draggable={false}");
    expect(paidPreviewSource).not.toContain("bg-accent");
  });

  test("reads image presentation from the published document snapshot", async () => {
    const serverAccessSource = await Bun.file(
      new URL("../../lib/portal/server-access.ts", import.meta.url),
    ).text();

    expect(serverAccessSource).toContain("jsonRecord(root?.document) ?? root");
    expect(serverAccessSource).toContain("imageRecord.background_color");
    expect(serverAccessSource).toContain("imageRecord.container_padding");
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
        {
          alt: "Selected cover",
          backgroundColor: "#ffffff",
          containerPadding: 12,
          src: "https://cdn.test/cover.jpg",
        },
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
        {
          alt: "Selected cover",
          backgroundColor: "#ffffff",
          containerPadding: 12,
          src: "https://cdn.test/cover.jpg",
        },
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
