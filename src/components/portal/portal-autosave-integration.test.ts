import { expect, test } from "bun:test";

const publishSource = await Bun.file(
  new URL(
    "../../app/[locale]/(workspace)/create/[portalId]/_components/publish-portal-button.tsx",
    import.meta.url,
  ),
).text();
const rendererSource = (
  await Promise.all([
    Bun.file(
      new URL("./portal-project-controller.tsx", import.meta.url),
    ).text(),
    Bun.file(
      new URL("./use-portal-editor-persistence.ts", import.meta.url),
    ).text(),
  ])
).join("\n");

test("publishing flushes autosave before invoking the publish action", () => {
  const flushIndex = publishSource.indexOf(
    "await flushPortalAutosave(portalId)",
  );
  const revisionIndex = publishSource.indexOf("documentRevisionByPortalId");
  const publishIndex = publishSource.indexOf("await publishPortalById");
  expect(flushIndex).toBeLessThan(revisionIndex);
  expect(revisionIndex).toBeLessThan(publishIndex);
  expect(publishSource).toContain("markPublishedIfRevision");
});

test("the autosave generation is acquired before server hydration evaluates stale status", () => {
  const acquireIndex = rendererSource.indexOf("ensurePortalAutosave(");
  const hydrateIndex = rendererSource.indexOf("hydrateDocument(");

  expect(acquireIndex).toBeGreaterThan(-1);
  expect(hydrateIndex).toBeGreaterThan(acquireIndex);
});
