import { expect, test } from "bun:test";

const publish = await Bun.file(
  new URL(
    "../../app/[locale]/(workspace)/create/[portalId]/_components/publish-portal-button.tsx",
    import.meta.url,
  ),
).text();
const renderer = (
  await Promise.all([
    Bun.file(new URL("../render/render-project.tsx", import.meta.url)).text(),
    Bun.file(
      new URL("./portal-project-controller.tsx", import.meta.url),
    ).text(),
    Bun.file(
      new URL(
        "../../app/[locale]/(workspace)/_components/portal-workspace-toolbar.tsx",
        import.meta.url,
      ),
    ).text(),
    Bun.file(
      new URL("./portal-workspace-controls.tsx", import.meta.url),
    ).text(),
    Bun.file(new URL("../render/render-section.tsx", import.meta.url)).text(),
    Bun.file(
      new URL(
        "../../app/[locale]/(workspace)/create/[portalId]/_components/portal-section-order-popover.tsx",
        import.meta.url,
      ),
    ).text(),
  ])
).join("\n");

test("publish validates readiness before flushing and invoking the server action", () => {
  const validationIndex = publish.indexOf("validatePortalPublicationReadiness");
  const flushIndex = publish.indexOf("flushPortalAutosave(portalId)");
  const publishIndex = publish.indexOf("await publishPortalById");

  expect(validationIndex).toBeGreaterThan(-1);
  expect(validationIndex).toBeLessThan(flushIndex);
  expect(flushIndex).toBeLessThan(publishIndex);
  expect(publish).toContain("setPublicationIssues(portalId, issues)");
  expect(publish).toContain("setPublicationPopoverOpen(portalId, true)");
  expect(publish).toContain(
    'if (action.kind === "publish") attemptPublication()',
  );
  expect(publish).not.toContain(
    'if (action.kind === "publish") publishMutation.mutate()',
  );
});

test("the adjacent floating popover renders actionable publication issues", () => {
  expect(renderer).toContain('publicationIssuesByPortalId[portalId ?? ""]');
  // Zustand selectors must not return a fresh [] each snapshot (infinite loop).
  expect(renderer).not.toContain("publicationIssuesByPortalId[portalId] ?? []");
  expect(renderer).toContain("EMPTY_PUBLICATION_ISSUES");
  expect(renderer).toContain("focusPortalPublicationTarget(target)");
  expect(renderer).toContain("workspace.publication.issues.");
  expect(renderer).toContain("issue.code");
  expect(renderer).toContain('t("workspace.publication.fix")');
  expect(renderer).toContain(
    'publicationPopoverOpenByPortalId[portalId ?? ""]',
  );
});

test("the editable portal fields expose stable focus targets", () => {
  expect(renderer).toContain("data-portal-name");
  expect(renderer).toContain("data-portal-add-section");
  expect(renderer).toContain("data-portal-section-title");
});
