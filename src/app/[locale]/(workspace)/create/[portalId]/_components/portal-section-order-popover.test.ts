import { describe, expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./portal-section-order-popover.tsx", import.meta.url),
).text();

describe("PortalSectionOrderPopover section creation", () => {
  test("connects the external add-section request to its triggerless picker", () => {
    expect(source).toContain(
      '<SectionTypeDialog\n        onSelect={addSection}\n        onSelectComplete={completeSectionSelection}\n        openRequestKey="portal-add-section"',
    );
  });

  test("waits for both overlays to close before revealing a created section", () => {
    expect(source).toContain("pendingSectionIdRef.current = section.id");
    expect(source).toContain("function completeSectionSelection()");
    expect(source).toContain("if (open) return setOpen(false)");
    expect(source).toContain("onOpenChangeComplete={(isOpen) => {");
    expect(source).toContain("scrollToPortalSection(sectionId)");
    expect(source).toContain("focusPortalSectionTitle(sectionId)");
  });
});
