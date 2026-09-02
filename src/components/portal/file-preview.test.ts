import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PortalFileType } from "@/domain/portal/document";
import {
  filePreviewPresentationStyle,
  isPortalFilePreviewable,
  PORTAL_FILE_ACCEPT,
  PORTAL_IMAGE_ACCEPT,
  PortalFileTypeIcon,
  portalFilePreviewObjectFit,
  portalFileTypeFromName,
} from "./file-preview";

describe("portal file picker formats", () => {
  test.each([
    ["art.ai", "ai"],
    ["guide.pdf", "pdf"],
    ["notes.txt", "txt"],
    ["README.md", "md"],
    ["README.markdown", "md"],
    ["mockup.psd", "psd"],
    ["large-mockup.psb", "psb"],
    ["logo.eps", "eps"],
    ["template.ait", "ait"],
    ["catalog.indd", "indd"],
    ["catalog-template.indt", "indt"],
    ["catalog.idml", "idml"],
    ["scan.tif", "tiff"],
    ["scan.tiff", "tiff"],
  ])("accepts and classifies %s", (name, type) => {
    const extension = `.${name.split(".").pop()}`;
    expect(PORTAL_FILE_ACCEPT.split(",")).toContain(extension);
    expect(portalFileTypeFromName(name)).toBe(type as PortalFileType);
  });

  test("keeps inline image uploads raster-only while SVG remains downloadable", () => {
    expect(PORTAL_IMAGE_ACCEPT.split(",")).toEqual([
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".gif",
      ".avif",
    ]);
    expect(PORTAL_IMAGE_ACCEPT).not.toContain(".svg");
    expect(PORTAL_FILE_ACCEPT.split(",")).toContain(".svg");
    expect(PORTAL_FILE_ACCEPT.split(",")).toContain(".tif");
    expect(PORTAL_FILE_ACCEPT.split(",")).toContain(".tiff");
  });

  test("previews SVG files with their actual artwork", () => {
    expect(isPortalFilePreviewable("svg")).toBe(true);
    expect(isPortalFilePreviewable("pdf")).toBe(false);
    expect(portalFilePreviewObjectFit("svg")).toBe("object-contain");
  });

  test("applies configurable padding and transparent or colored backgrounds", () => {
    expect(filePreviewPresentationStyle(20, "transparent")).toEqual({
      backgroundColor: "transparent",
      padding: 20,
    });
    expect(filePreviewPresentationStyle(8, "#ffffff")).toEqual({
      backgroundColor: "#ffffff",
      padding: 8,
    });
    expect(filePreviewPresentationStyle()).toEqual({
      backgroundColor: "var(--secondary)",
      padding: 0,
    });
  });

  test("allows compact canonical file icons without changing the preview default", () => {
    const compact = renderToStaticMarkup(
      createElement(PortalFileTypeIcon, {
        className: "size-5",
        fallback: { file: "File", image: "Image" },
        type: "ai",
      }),
    );
    const standard = renderToStaticMarkup(
      createElement(PortalFileTypeIcon, {
        fallback: { file: "File", image: "Image" },
        type: "psd",
      }),
    );

    expect(compact).toContain('class="size-5"');
    expect(compact).not.toContain("size-16");
    expect(standard).toContain('class="size-16"');
  });
});
