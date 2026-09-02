import { describe, expect, mock, test } from "bun:test";
import { isAllowedExportMime } from "@/lib/portal/export-mime";

mock.module("server-only", () => ({}));

const { isPreviewableImageFile } = await import("./server-assets");

describe("server asset export MIME allowlist", () => {
  test.each([
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "application/pdf",
    "application/illustrator",
    "application/x-indesign",
    "application/vnd.adobe.indesign-idml-package",
    "image/tiff",
  ])("allows %s", (mime) => {
    expect(isAllowedExportMime(mime)).toBe(true);
  });

  test("rejects executable and arbitrary binary MIME", () => {
    expect(isAllowedExportMime("text/html")).toBe(false);
    expect(isAllowedExportMime("application/x-executable")).toBe(false);
    expect(isAllowedExportMime("application/octet-stream")).toBe(false);
  });
});

describe("file preview eligibility", () => {
  test("uses an explicit SVG type when the stored filename has no extension", () => {
    expect(
      isPreviewableImageFile({
        allow_download: true,
        file_name: "opaque-storage-key",
        file_type: "svg",
        file_url: "https://example.com/logo.svg",
        id: "logo",
        position: 0,
        visible: true,
      }),
    ).toBe(true);
  });

  test("keeps an explicit non-image type ahead of an image-looking filename", () => {
    expect(
      isPreviewableImageFile({
        allow_download: true,
        file_name: "logo.svg",
        file_type: "pdf",
        file_url: "https://example.com/document.pdf",
        id: "document",
        position: 0,
        visible: true,
      }),
    ).toBe(false);
  });
});
