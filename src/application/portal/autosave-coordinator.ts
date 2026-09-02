import type { AutosaveHandoff } from "@/application/portal/autosave-queue";

type PortalAutosaveHandle<T> = {
  acceptHandoff?: (handoff: AutosaveHandoff<T>) => void;
  acknowledgeNonRetryableError?: () => boolean;
  completePredecessor?: (handoff?: AutosaveHandoff<T>) => void;
  dispose?: () => Promise<AutosaveHandoff<T> | undefined>;
  flush: () => Promise<void>;
  retryRecovery?: () => T | false;
  schedule: (value: T) => void;
};

type AutosaveRecord = {
  completion: Promise<AutosaveHandoff<unknown> | undefined> | null;
  handle: PortalAutosaveHandle<unknown>;
  references: number;
  releaseTimer: ReturnType<typeof setTimeout> | null;
  state: "active" | "blocked" | "disposing";
};

const records = new Map<string, AutosaveRecord>();

function serializeBehind<T>(
  handle: PortalAutosaveHandle<T>,
  predecessor: Promise<AutosaveHandoff<unknown> | undefined>,
): PortalAutosaveHandle<T> {
  let active = false;
  let acknowledgeRequested = false;
  let hasStagedValue = false;
  let stagedValue: T | undefined;
  const ready = predecessor.then((handoff) => {
    active = true;
    if (hasStagedValue) {
      hasStagedValue = false;
      const value = stagedValue as T;
      stagedValue = undefined;
      if (handoff?.nonRetryable && handle.acceptHandoff) {
        handle.acceptHandoff({ ...handoff, value } as AutosaveHandoff<T>);
      } else {
        handle.schedule(value);
      }
    } else {
      const typedHandoff = handoff as AutosaveHandoff<T> | undefined;
      if (handle.completePredecessor) {
        handle.completePredecessor(typedHandoff);
      } else if (typedHandoff) {
        if (handle.acceptHandoff) handle.acceptHandoff(typedHandoff);
        else handle.schedule(typedHandoff.value);
      }
    }
    if (acknowledgeRequested) {
      acknowledgeRequested = false;
      handle.acknowledgeNonRetryableError?.();
    }
  });

  return {
    acknowledgeNonRetryableError: () => {
      if (!active) {
        acknowledgeRequested = true;
        return true;
      }
      return handle.acknowledgeNonRetryableError?.() ?? false;
    },
    dispose: async () => {
      await ready;
      return await handle.dispose?.();
    },
    flush: async () => {
      await ready;
      await handle.flush();
    },
    retryRecovery: () => handle.retryRecovery?.() ?? false,
    schedule: (value) => {
      if (active) {
        handle.schedule(value);
        return;
      }
      stagedValue = value;
      hasStagedValue = true;
    },
  };
}

export function ensurePortalAutosave<T>(
  portalId: string,
  createHandle: (context: {
    hasPredecessor: boolean;
  }) => PortalAutosaveHandle<T>,
) {
  const existing = records.get(portalId);
  if (existing?.state === "active") {
    if (existing.releaseTimer) clearTimeout(existing.releaseTimer);
    existing.releaseTimer = null;
    existing.references += 1;
    return existing.handle as PortalAutosaveHandle<T>;
  }

  const hasPredecessor =
    existing?.state === "disposing" || existing?.state === "blocked";
  const createdHandle = createHandle({ hasPredecessor });
  const handle =
    hasPredecessor && existing?.completion
      ? serializeBehind(createdHandle, existing.completion)
      : createdHandle;
  records.set(portalId, {
    completion: null,
    handle: handle as PortalAutosaveHandle<unknown>,
    references: 1,
    releaseTimer: null,
    state: "active",
  });
  return handle;
}

export function releasePortalAutosave(portalId: string) {
  const record = records.get(portalId);
  if (!record || record.state !== "active") return;
  record.references = Math.max(0, record.references - 1);
  if (record.references > 0) return;

  record.releaseTimer = setTimeout(() => {
    if (
      records.get(portalId) !== record ||
      record.references > 0 ||
      record.state !== "active"
    ) {
      return;
    }
    record.releaseTimer = null;
    record.state = "disposing";
    const completion = record.handle.dispose?.() ?? Promise.resolve(undefined);
    record.completion = completion;
    void completion.then(
      (handoff) => {
        if (records.get(portalId) !== record) return;
        if (handoff) record.state = "blocked";
        else records.delete(portalId);
      },
      () => {
        if (records.get(portalId) === record) record.state = "blocked";
      },
    );
  }, 0);
}

export function schedulePortalAutosave<T>(portalId: string, value: T) {
  const record = records.get(portalId);
  if (!record || record.state !== "active") {
    throw new Error("Portal autosave is not ready");
  }
  record.handle.schedule(value);
}

export async function flushPortalAutosave(portalId: string) {
  const record = records.get(portalId);
  if (!record || record.state !== "active") {
    throw new Error("Portal autosave is not ready");
  }
  await record.handle.flush();
}

export function acknowledgePortalAutosaveConflict(portalId: string) {
  const record = records.get(portalId);
  if (!record || record.state !== "active") return false;
  return record.handle.acknowledgeNonRetryableError?.() ?? false;
}

export function retryPortalAutosaveConflict<T>(portalId: string) {
  const record = records.get(portalId);
  if (!record || record.state !== "active") return false;
  return (record.handle.retryRecovery?.() as T | false | undefined) ?? false;
}
