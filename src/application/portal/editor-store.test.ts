import { expect, test } from "bun:test";
import type { PortalDocument } from "@/domain/portal/document";
import { usePortalEditorStore } from "./editor-store";

function portalDocument(name: string): PortalDocument {
  return {
    portal: { description: "", name, theme: "auto" },
    sections: [],
    version: 1,
  };
}

test("server hydration never overwrites a newer dirty portal draft", () => {
  const portalId = "hydration-test";
  const store = usePortalEditorStore.getState();

  store.hydrateDocument(portalId, portalDocument("server D1"));
  store.updateDocument(portalId, (current) => ({
    ...current,
    portal: { ...current.portal, name: "local D2" },
  }));
  store.hydrateDocument(portalId, portalDocument("stale server D1"));

  expect(
    usePortalEditorStore.getState().documentsByPortalId[portalId].portal.name,
  ).toBe("local D2");
});

test("server hydration replaces a stale settled draft from a previous editor mount", () => {
  const portalId = "settled-remount-test";
  const store = usePortalEditorStore.getState();

  store.hydrateDocument(portalId, portalDocument("stale client draft"));
  store.setHasUnpublishedChanges(portalId, true);
  store.setAutosaveState(portalId, { error: null, status: "saved" });
  store.hydrateDocument(portalId, portalDocument("authoritative server draft"));

  expect(
    usePortalEditorStore.getState().documentsByPortalId[portalId].portal.name,
  ).toBe("authoritative server draft");
});

test("a deferred stale RSC payload cannot overwrite a newer persisted local revision", () => {
  const portalId = "deferred-rsc-test";
  const store = usePortalEditorStore.getState();

  store.hydrateDocument(portalId, portalDocument("D1"), 1);
  store.updateDocument(portalId, () => portalDocument("D2"));
  store.markDocumentPersisted(portalId, 2);
  store.hydrateDocument(portalId, portalDocument("stale D1"), 1);

  expect(
    usePortalEditorStore.getState().documentsByPortalId[portalId].portal.name,
  ).toBe("D2");
});

test("a newer server revision is accepted after local autosave settles", () => {
  const portalId = "newer-server-revision-test";
  const store = usePortalEditorStore.getState();

  store.hydrateDocument(portalId, portalDocument("D1"), 1);
  store.markDocumentPersisted(portalId, 2);
  store.hydrateDocument(portalId, portalDocument("D3 from another device"), 3);

  expect(
    usePortalEditorStore.getState().documentsByPortalId[portalId].portal.name,
  ).toBe("D3 from another device");
});

test("monotonic revisions distinguish writes that share a PostgreSQL millisecond", () => {
  const portalId = "same-millisecond-revision-test";
  const store = usePortalEditorStore.getState();

  store.hydrateDocument(portalId, portalDocument("D1"), 41);
  store.markDocumentPersisted(portalId, 42);
  store.hydrateDocument(portalId, portalDocument("stale D1"), 41);

  expect(
    usePortalEditorStore.getState().documentsByPortalId[portalId].portal.name,
  ).toBe("D1");
  expect(
    usePortalEditorStore.getState().documentServerRevisionByPortalId[portalId],
  ).toBe(42);
});

test("hydrates a backfilled revision zero instead of treating it as missing", () => {
  const portalId = "backfilled-zero-revision-test";
  const store = usePortalEditorStore.getState();

  store.hydrateDocument(portalId, portalDocument("existing legacy row"), 0);

  expect(
    usePortalEditorStore.getState().documentServerRevisionByPortalId[portalId],
  ).toBe(0);
});

test("a rejected stale document hydration cannot apply its publication flag", () => {
  const portalId = "coupled-publication-hydration-test";
  const store = usePortalEditorStore.getState();

  store.hydrateDocument(portalId, portalDocument("D2"), 2, true);
  store.hydrateDocument(portalId, portalDocument("stale D1"), 1, false);

  const state = usePortalEditorStore.getState();
  expect(state.documentsByPortalId[portalId].portal.name).toBe("D2");
  expect(state.hasUnpublishedChangesByPortalId[portalId]).toBe(true);
});

test("accepted same-revision hydration produces an observable server ack", () => {
  const portalId = "same-revision-hydration-ack-test";
  const store = usePortalEditorStore.getState();

  store.hydrateDocument(portalId, portalDocument("server R2"), 2);
  const firstGeneration =
    usePortalEditorStore.getState().serverHydrationGenerationByPortalId[
      portalId
    ];
  store.hydrateDocument(portalId, portalDocument("server R2"), 2);

  expect(
    usePortalEditorStore.getState().serverHydrationGenerationByPortalId[
      portalId
    ],
  ).toBe((firstGeneration ?? 0) + 1);
});

test("hydrates nested assets in their persisted position order", () => {
  const portalId = "ordered-hydration-test";
  const store = usePortalEditorStore.getState();
  const document: PortalDocument = {
    portal: { description: "", name: "Portal", theme: "auto" },
    sections: [
      {
        allow_download: true,
        content: {
          images: [
            {
              allow_download: true,
              alt_text: "Second",
              aspect_ratio: "auto",
              fit: "cover",
              id: "image-2",
              image_url: "/second.png",
              position: 1,
              visible: true,
            },
            {
              allow_download: true,
              alt_text: "First",
              aspect_ratio: "auto",
              fit: "cover",
              id: "image-1",
              image_url: "/first.png",
              position: 0,
              visible: true,
            },
          ],
        },
        description: "",
        id: "section-1",
        layout: { columns: 3, mode: "grid" },
        position: 0,
        title: "Gallery",
        type: "gallery",
        visible: true,
      },
    ],
    version: 1,
  };

  store.hydrateDocument(portalId, document);

  expect(
    usePortalEditorStore
      .getState()
      .documentsByPortalId[portalId].sections[0]?.content.images?.map(
        (image) => image.id,
      ),
  ).toEqual(["image-1", "image-2"]);
});

test("initial unpublished state does not reset a local change still being saved", () => {
  const portalId = "dirty-test";
  const store = usePortalEditorStore.getState();
  store.setHasUnpublishedChanges(portalId, true);
  store.setAutosaveState(portalId, { error: null, status: "saving" });
  store.initializeHasUnpublishedChanges(portalId, false);
  expect(
    usePortalEditorStore.getState().hasUnpublishedChangesByPortalId[portalId],
  ).toBe(true);
});

test("an accepted settled hydration applies its authoritative publication state", () => {
  const portalId = "publication-remount-test";
  const store = usePortalEditorStore.getState();

  store.setHasUnpublishedChanges(portalId, true);
  store.setAutosaveState(portalId, { error: null, status: "saved" });
  store.hydrateDocument(portalId, portalDocument("authoritative"), 1, false);

  expect(
    usePortalEditorStore.getState().hasUnpublishedChangesByPortalId[portalId],
  ).toBe(false);
});

test("server publication state cannot clear a change that is still saving", () => {
  const portalId = "publication-saving-test";
  const store = usePortalEditorStore.getState();

  store.setHasUnpublishedChanges(portalId, true);
  store.setAutosaveState(portalId, { error: null, status: "saving" });
  store.initializeHasUnpublishedChanges(portalId, false);

  expect(
    usePortalEditorStore.getState().hasUnpublishedChangesByPortalId[portalId],
  ).toBe(true);
});

test("hydrates an initial draft even when the server marks it unpublished", () => {
  const portalId = "initial-dirty-test";
  const store = usePortalEditorStore.getState();
  store.initializeHasUnpublishedChanges(portalId, true);
  store.hydrateDocument(portalId, portalDocument("server draft"));
  expect(
    usePortalEditorStore.getState().documentsByPortalId[portalId].portal.name,
  ).toBe("server draft");
});

test("resetAutosaveState clears a stale terminal or saving state on acquisition", () => {
  const portalId = "autosave-reset-test";
  const store = usePortalEditorStore.getState();
  store.setAutosaveState(portalId, { error: "offline", status: "error" });
  store.resetAutosaveState(portalId);
  expect(usePortalEditorStore.getState().autosaveByPortalId[portalId]).toEqual({
    error: null,
    status: "idle",
  });
});

test("an edit during publish keeps D2 dirty and rejects stale RSC hydration", () => {
  const portalId = "publish-revision-test";
  const store = usePortalEditorStore.getState();
  store.hydrateDocument(portalId, portalDocument("D0"));
  store.updateDocument(portalId, () => portalDocument("D1"));
  const publishedRevision =
    usePortalEditorStore.getState().documentRevisionByPortalId[portalId];

  store.updateDocument(portalId, () => portalDocument("D2"));
  expect(
    usePortalEditorStore.getState().autosaveByPortalId[portalId].status,
  ).toBe("saving");
  expect(store.markPublishedIfRevision(portalId, publishedRevision)).toBe(
    false,
  );
  store.hydrateDocument(portalId, portalDocument("published D1"));

  const state = usePortalEditorStore.getState();
  expect(state.documentsByPortalId[portalId].portal.name).toBe("D2");
  expect(state.hasUnpublishedChangesByPortalId[portalId]).toBe(true);
});

test("publication issues never block incomplete drafts from being saved locally", () => {
  const portalId = "publication-draft-test";
  const store = usePortalEditorStore.getState();
  store.hydrateDocument(portalId, portalDocument("Portal"));
  store.setPublicationIssues(portalId, []);

  const incompleteDraft = store.updateDocument(portalId, (current) => ({
    ...current,
    portal: { ...current.portal, name: "   " },
  }));

  expect(incompleteDraft?.portal.name).toBe("   ");
  expect(
    usePortalEditorStore.getState().publicationIssuesByPortalId[portalId],
  ).toEqual([
    { code: "portal_name_required", target: { kind: "portal-name" } },
    { code: "section_required", target: { kind: "add-section" } },
  ]);
});
