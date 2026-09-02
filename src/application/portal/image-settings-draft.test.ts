import { describe, expect, test } from "bun:test";
import {
  createSyncedTextDraft,
  editSyncedTextDraft,
  handleSyncedTextDraftChange,
  syncTextDraftSource,
} from "./image-settings-draft";

describe("synced image settings text draft", () => {
  test("preserves edits across unrelated rerenders and syncs a real prop change", () => {
    let state = createSyncedTextDraft("original");
    state = editSyncedTextDraft(state, "latest draft");
    expect(syncTextDraftSource(state, "original")).toBe(state);

    state = syncTextDraftSource(state, "server replacement");
    expect(state).toEqual({
      draft: "server replacement",
      source: "server replacement",
    });
  });

  test("exposes the latest controlled draft for blur persistence", () => {
    const state = editSyncedTextDraft(
      createSyncedTextDraft("old"),
      " latest value ",
    );
    expect(state.draft.trim()).toBe("latest value");
  });

  test("snapshots the input value before React releases currentTarget", () => {
    let deferredUpdate:
      | ((
          state: ReturnType<typeof createSyncedTextDraft>,
        ) => ReturnType<typeof createSyncedTextDraft>)
      | undefined;
    const event = {
      currentTarget: { value: "captured now" } as { value: string } | null,
    };

    handleSyncedTextDraftChange(
      (update) => {
        deferredUpdate = update;
      },
      event as { currentTarget: { value: string } },
    );
    event.currentTarget = null;

    expect(deferredUpdate?.(createSyncedTextDraft("old")).draft).toBe(
      "captured now",
    );
  });
});
