import { describe, expect, test } from "bun:test";
import type { PortalDocument, PortalSection } from "@/domain/portal/document";
import { validatePortalPublicationReadiness } from "./publication-readiness";

function section(id: string, title: string): PortalSection {
  return {
    allow_download: true,
    content: {},
    description: "",
    id,
    layout: { mode: "single" },
    position: 0,
    title,
    type: "text",
    visible: true,
  };
}

function document(name: string, sections: PortalSection[]): PortalDocument {
  return {
    portal: { description: "", name, theme: "auto" },
    sections,
    version: 1,
  };
}

describe("portal publication readiness", () => {
  test("accepts a named portal with at least one titled section", () => {
    expect(
      validatePortalPublicationReadiness(
        document("Brand portal", [section("section-1", "Logos")]),
      ),
    ).toEqual([]);
  });

  test("returns every actionable issue in a stable order", () => {
    expect(
      validatePortalPublicationReadiness(
        document("   ", [
          section("section-1", ""),
          section("section-2", "   "),
        ]),
      ),
    ).toEqual([
      { code: "portal_name_required", target: { kind: "portal-name" } },
      {
        code: "section_title_required",
        sectionId: "section-1",
        target: { kind: "section-title", sectionId: "section-1" },
      },
      {
        code: "section_title_required",
        sectionId: "section-2",
        target: { kind: "section-title", sectionId: "section-2" },
      },
    ]);
  });

  test("requires a section without treating the incomplete draft as invalid to save", () => {
    expect(validatePortalPublicationReadiness(document("Portal", []))).toEqual([
      { code: "section_required", target: { kind: "add-section" } },
    ]);
  });

  test("requires content for each section type", () => {
    const emptyImage = section("image-1", "Image");
    emptyImage.type = "image";
    emptyImage.content = { image: null };
    expect(
      validatePortalPublicationReadiness(document("Portal", [emptyImage])),
    ).toEqual([
      {
        code: "section_content_required",
        sectionId: "image-1",
        target: { kind: "section-content", sectionId: "image-1" },
      },
    ]);
  });
});
