"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { PortalFontItem } from "@/domain/portal/document";
import { createRandomId } from "@/lib/random-id";

export type OptimisticUpload<T> = {
  id: string;
  value: T;
};

type RegistryDependencies = {
  createId?: () => string;
  createObjectURL?: (file: File) => string;
  revokeObjectURL?: (url: string) => void;
};

export class OptimisticUploadRegistry<T> {
  private readonly createId: () => string;
  private readonly createObjectURL: (file: File) => string;
  private readonly revokeObjectURL: (url: string) => void;
  private readonly listeners = new Set<() => void>();
  private readonly objectUrls = new Map<string, string>();
  private ownerKey: string | undefined;
  private snapshot: OptimisticUpload<T>[] = [];

  constructor(dependencies: RegistryDependencies = {}) {
    this.createId = dependencies.createId ?? (() => createRandomId("pending"));
    this.createObjectURL =
      dependencies.createObjectURL ?? ((file) => URL.createObjectURL(file));
    this.revokeObjectURL =
      dependencies.revokeObjectURL ?? ((url) => URL.revokeObjectURL(url));
    this.add = this.add.bind(this);
    this.claimOwner = this.claimOwner.bind(this);
    this.dispose = this.dispose.bind(this);
    this.owns = this.owns.bind(this);
    this.remove = this.remove.bind(this);
    this.subscribe = this.subscribe.bind(this);
  }

  add(
    file: File,
    createValue: (context: { id: string; previewUrl: string }) => T,
  ) {
    const id = this.createId();
    const previewUrl = this.createObjectURL(file);
    const upload = { id, value: createValue({ id, previewUrl }) };
    this.objectUrls.set(id, previewUrl);
    this.snapshot = [...this.snapshot, upload];
    this.emit();
    return upload;
  }

  getSnapshot = () => this.snapshot;

  count = () => this.snapshot.length;

  claimOwner = (ownerKey: string) => {
    if (this.ownerKey !== undefined && this.ownerKey !== ownerKey) {
      this.dispose();
    }
    this.ownerKey = ownerKey;
  };

  owns = (id: string) => this.objectUrls.has(id);

  remove = (id: string) => {
    const objectUrl = this.objectUrls.get(id);
    if (!objectUrl) return;
    this.objectUrls.delete(id);
    this.revokeObjectURL(objectUrl);
    this.snapshot = this.snapshot.filter((upload) => upload.id !== id);
    this.emit();
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  dispose = () => {
    for (const objectUrl of this.objectUrls.values()) {
      this.revokeObjectURL(objectUrl);
    }
    if (this.objectUrls.size) {
      this.objectUrls.clear();
      this.snapshot = [];
      this.emit();
    }
  };

  private emit() {
    for (const listener of this.listeners) listener();
  }
}

export async function reconcileOptimisticUpload<T>({
  asset,
  commit,
  discard,
  id,
  registry,
}: {
  asset: T;
  commit: (asset: T) => void;
  discard: (asset: T) => Promise<unknown>;
  id: string;
  registry: Pick<OptimisticUploadRegistry<unknown>, "owns" | "remove">;
}) {
  if (!registry.owns(id)) {
    await discard(asset);
    return false;
  }
  try {
    // Remove the local preview before publishing the finalized asset. This
    // keeps the optimistic item from surviving a synchronous render/store
    // update triggered by commit and makes the transition one-way: the
    // document can only receive the server-backed asset now.
    registry.remove(id);
    commit(asset);
    return true;
  } catch (error) {
    await discard(asset);
    throw error;
  }
}

export function remainingOptimisticUploadSlots(
  capacity: number,
  persisted: number,
  pending: number,
) {
  if (!Number.isFinite(capacity)) return Number.POSITIVE_INFINITY;
  return Math.max(0, capacity - persisted - pending);
}

export function rollbackOptimisticFontFile(
  previous: PortalFontItem,
  current: PortalFontItem,
  pendingId: string,
) {
  if (current.id !== pendingId) return current;
  return {
    ...current,
    asset_id: previous.asset_id,
    file_name: previous.file_name,
    file_url: previous.file_url,
    id: previous.id,
    storage_path: previous.storage_path,
  };
}

export function useOptimisticUploads<T>() {
  const [registry] = useState(() => new OptimisticUploadRegistry<T>());
  const uploads = useSyncExternalStore(
    registry.subscribe,
    registry.getSnapshot,
    registry.getSnapshot,
  );

  useEffect(() => () => registry.dispose(), [registry]);

  return {
    add: registry.add.bind(registry),
    claimOwner: registry.claimOwner,
    count: registry.count,
    invalidate: registry.dispose,
    owns: registry.owns,
    pending: uploads,
    remove: registry.remove,
  };
}
