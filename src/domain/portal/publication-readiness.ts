import type { PortalDocument } from "@/domain/portal/document";

export type PortalPublicationIssueCode =
  | "portal_name_required"
  | "section_required"
  | "section_title_required"
  | "section_content_required";

export type PortalPublicationTarget =
  | { kind: "portal-name" }
  | { kind: "add-section" }
  | { kind: "section-title"; sectionId: string }
  | { kind: "section-content"; sectionId: string };

export type PortalPublicationIssue =
  | {
      code: "portal_name_required";
      target: { kind: "portal-name" };
    }
  | {
      code: "section_required";
      target: { kind: "add-section" };
    }
  | {
      code: "section_title_required";
      sectionId: string;
      target: { kind: "section-title"; sectionId: string };
    }
  | {
      code: "section_content_required";
      sectionId: string;
      target: { kind: "section-content"; sectionId: string };
    };

function hasSectionContent(section: PortalDocument["sections"][number]) {
  const { content } = section;
  // Text sections are intentionally composed only from their title and
  // description. They do not require a separate content payload.
  if (section.type === "text") return true;
  if (section.type === "image") return Boolean(content.image);
  if (section.type === "gallery") return (content.images?.length ?? 0) > 0;
  if (section.type === "image_comparison")
    return (content.images?.length ?? 0) >= 2;
  if (section.type === "colors") return (content.colors?.length ?? 0) > 0;
  if (section.type === "fonts") return (content.fonts?.length ?? 0) > 0;
  if (section.type === "files") return (content.files?.length ?? 0) > 0;
  return false;
}

export function validatePortalPublicationReadiness(
  document: PortalDocument,
): PortalPublicationIssue[] {
  const issues: PortalPublicationIssue[] = [];

  if (!document.portal.name.trim()) {
    issues.push({
      code: "portal_name_required",
      target: { kind: "portal-name" },
    });
  }

  if (document.sections.length === 0) {
    issues.push({
      code: "section_required",
      target: { kind: "add-section" },
    });
  }

  for (const section of document.sections) {
    if (!section.title.trim()) {
      issues.push({
        code: "section_title_required",
        sectionId: section.id,
        target: { kind: "section-title", sectionId: section.id },
      });
    }
    if (!hasSectionContent(section)) {
      issues.push({
        code: "section_content_required",
        sectionId: section.id,
        target: { kind: "section-content", sectionId: section.id },
      });
    }
  }

  return issues;
}
