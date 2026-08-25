import { describe, expect, test } from "bun:test";
import {
  OptimisticUploadRegistry,
  reconcileOptimisticUpload,
  remainingOptimisticUploadSlots,
  rollbackOptimisticFontFile,
} from "./optimistic-uploads";

describe("OptimisticUploadRegistry", () => {
  test("keeps registry methods bound when passed as callbacks", () => {
    const registry = new OptimisticUploadRegistry<{ src: string }>({
      createId: () => "pending-bound",
      createObjectURL: () => "blob:bound",
      revokeObjectURL: () => undefined,
    });
    const add = registry.add;
    const owns = registry.owns;
    const remove = registry.remove;

    const pending = add(new File(["x"], "bound.txt"), ({ previewUrl }) => ({
      src: previewUrl,
    }));
    expect(owns(pending.id)).toBe(true);
    remove(pending.id);
    expect(owns(pending.id)).toBe(false);
  });

  test("publishes a local preview immediately and revokes it after success", () => {
    const revoked: string[] = [];
    const registry = new OptimisticUploadRegistry<{ src: string }>({
      createObjectURL: () => "blob:preview-1",
      createId: () => "pending-1",
      revokeObjectURL: (url) => revoked.push(url),
    });

    const upload = registry.add(
      new File(["image"], "hero.png", { type: "image/png" }),
      ({ previewUrl }) => ({ src: previewUrl }),
    );

    expect(registry.getSnapshot()).toEqual([
      { id: "pending-1", value: { src: "blob:preview-1" } },
    ]);
    registry.remove(upload.id);
    expect(registry.getSnapshot()).toEqual([]);
    expect(revoked).toEqual(["blob:preview-1"]);
  });

  test("isolates concurrent failures and never revokes a URL twice", () => {
    const revoked: string[] = [];
    let sequence = 0;
    const registry = new OptimisticUploadRegistry<string>({
      createObjectURL: () => `blob:${++sequence}`,
      createId: () => `pending-${sequence}`,
      revokeObjectURL: (url) => revoked.push(url),
    });

    const first = registry.add(
      new File(["a"], "a.woff2"),
      ({ previewUrl }) => previewUrl,
    );
    const second = registry.add(
      new File(["b"], "b.woff2"),
      ({ previewUrl }) => previewUrl,
    );

    expect(registry.count()).toBe(2);
    registry.remove(first.id);
    expect(registry.getSnapshot().map(({ id }) => id)).toEqual([second.id]);
    registry.remove(first.id);
    registry.dispose();
    registry.dispose();

    expect(revoked).toEqual(["blob:1", "blob:2"]);
  });

  test("notifies subscribers for add and removal", () => {
    const registry = new OptimisticUploadRegistry<string>({
      createObjectURL: () => "blob:item",
      createId: () => "pending-item",
      revokeObjectURL: () => undefined,
    });
    let notifications = 0;
    const unsubscribe = registry.subscribe(() => notifications++);
    const item = registry.add(
      new File(["x"], "x.txt"),
      ({ previewUrl }) => previewUrl,
    );
    registry.remove(item.id);
    unsubscribe();

    expect(notifications).toBe(2);
  });

  test("invalidates ownership on dispose and discards a late finalized asset", async () => {
    const registry = new OptimisticUploadRegistry<string>({
      createObjectURL: () => "blob:late",
      createId: () => "pending-late",
      revokeObjectURL: () => undefined,
    });
    const pending = registry.add(new File(["x"], "late.png"), () => "preview");
    registry.dispose();
    const committed: string[] = [];
    const discarded: string[] = [];

    const reconciled = await reconcileOptimisticUpload({
      asset: "asset-late",
      commit: (asset) => committed.push(asset),
      discard: async (asset) => discarded.push(asset),
      id: pending.id,
      registry,
    });

    expect(reconciled).toBe(false);
    expect(committed).toEqual([]);
    expect(discarded).toEqual(["asset-late"]);
  });

  test("removes the local preview before committing the finalized asset", async () => {
    const registry = new OptimisticUploadRegistry<string>({
      createObjectURL: () => "blob:local",
      createId: () => "pending-finalized",
      revokeObjectURL: () => undefined,
    });
    const pending = registry.add(
      new File(["x"], "image.png"),
      () => "blob:local",
    );
    let ownsDuringCommit = true;

    await reconcileOptimisticUpload({
      asset: "https://storage.example/finalized.png",
      commit: () => {
        ownsDuringCommit = registry.owns(pending.id);
      },
      discard: async () => undefined,
      id: pending.id,
      registry,
    });

    expect(ownsDuringCommit).toBe(false);
    expect(registry.getSnapshot()).toEqual([]);
  });

  test("counts provisional items against a bounded comparison capacity", () => {
    expect(remainingOptimisticUploadSlots(2, 0, 0)).toBe(2);
    expect(remainingOptimisticUploadSlots(2, 0, 2)).toBe(0);
    expect(remainingOptimisticUploadSlots(2, 1, 1)).toBe(0);
    expect(remainingOptimisticUploadSlots(Number.POSITIVE_INFINITY, 4, 8)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  test("font replacement rollback preserves concurrent metadata edits", () => {
    expect(
      rollbackOptimisticFontFile(
        {
          asset_id: "old-asset",
          file_name: "old.woff2",
          file_url: "https://old",
          font_name: "Original",
          id: "font-1",
          position: 0,
          storage_path: "old/path",
          visible: true,
          weight: 400,
        },
        {
          file_name: "new.woff2",
          file_url: "blob:new",
          font_name: "Edited while uploading",
          id: "pending-1",
          position: 0,
          visible: true,
          weight: 700,
        },
        "pending-1",
      ),
    ).toEqual({
      asset_id: "old-asset",
      file_name: "old.woff2",
      file_url: "https://old",
      font_name: "Edited while uploading",
      id: "font-1",
      position: 0,
      storage_path: "old/path",
      visible: true,
      weight: 700,
    });
  });
});
