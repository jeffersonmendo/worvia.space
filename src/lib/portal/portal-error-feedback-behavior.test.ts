import { beforeEach, describe, expect, mock, test } from "bun:test";

const toastError = mock(() => undefined);
const toastDismiss = mock(() => undefined);

mock.module("sonner", () => ({
  toast: {
    dismiss: toastDismiss,
    error: toastError,
  },
}));

const {
  dismissPortalAutosaveError,
  showPortalAutosaveError,
  showPortalPublishError,
} = await import("./portal-error-feedback");
const { PortalPublishFailure, publishPortalAfterAutosave } = await import(
  "@/application/portal/publish-flow"
);
const { AutosaveQueue } = await import("@/application/portal/autosave-queue");
const { PortalDocumentConflictError, persistPortalDocumentAtLatestRevision } =
  await import("./revisioned-autosave");

beforeEach(() => {
  toastDismiss.mockClear();
  toastError.mockClear();
});

describe("portal error toasts", () => {
  test("shows one persistent autosave toast with retry and returns its cleanup", () => {
    const retry = mock(() => undefined);
    const cleanup = showPortalAutosaveError({
      description: "Draft retained",
      message: "Could not save",
      portalId: "portal-1",
      retry,
      retryLabel: "Retry",
    });

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("Could not save", {
      action: { label: "Retry", onClick: retry },
      description: "Draft retained",
      duration: Number.POSITIVE_INFINITY,
      id: "portal-autosave-error:portal-1",
    });

    cleanup();
    expect(toastDismiss).toHaveBeenCalledWith("portal-autosave-error:portal-1");
  });

  test("dismisses only the autosave toast for the requested portal", () => {
    dismissPortalAutosaveError("portal-2");
    expect(toastDismiss).toHaveBeenCalledWith("portal-autosave-error:portal-2");
  });

  test("deduplicates publication errors independently", () => {
    showPortalPublishError("portal-3", "Could not publish");
    expect(toastError).toHaveBeenCalledWith("Could not publish", {
      id: "portal-publish-error:portal-3",
    });
  });
});

describe("publication stages", () => {
  test("does not publish or report success when autosave discovers a remote conflict", async () => {
    const publish = mock(async () => 42);
    const showSuccess = mock(() => {});
    const queue = new AutosaveQueue<string>({
      delay: 10_000,
      save: async (document) => {
        await persistPortalDocumentAtLatestRevision({
          acknowledge: () => {},
          document,
          getExpectedRevision: () => 1,
          persist: async () => ({ kind: "conflict" as const }),
          reconcileConflict: () => {},
        });
      },
      shouldRetry: (error) => !(error instanceof PortalDocumentConflictError),
    });
    queue.schedule("local D2");

    await expect(
      publishPortalAfterAutosave(
        () => queue.flush(),
        async () => {
          const result = await publish();
          showSuccess();
          return result;
        },
      ),
    ).rejects.toMatchObject({ stage: "autosave" });

    expect(publish).not.toHaveBeenCalled();
    expect(showSuccess).not.toHaveBeenCalled();
    await expect(
      publishPortalAfterAutosave(() => queue.flush(), publish),
    ).rejects.toMatchObject({ stage: "autosave" });
    expect(publish).not.toHaveBeenCalled();
  });

  test("does not run publication when autosave flush fails", async () => {
    const autosaveError = new Error("autosave_failed");
    const publish = mock(async () => 42);

    try {
      await publishPortalAfterAutosave(async () => {
        throw autosaveError;
      }, publish);
      throw new Error("Expected the publish flow to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PortalPublishFailure);
      expect((error as InstanceType<typeof PortalPublishFailure>).stage).toBe(
        "autosave",
      );
      expect((error as InstanceType<typeof PortalPublishFailure>).cause).toBe(
        autosaveError,
      );
    }

    expect(publish).not.toHaveBeenCalled();
  });

  test("marks failures after a successful flush as publication errors", async () => {
    const publishError = new Error("publish_failed");

    await expect(
      publishPortalAfterAutosave(
        async () => undefined,
        async () => {
          throw publishError;
        },
      ),
    ).rejects.toMatchObject({ cause: publishError, stage: "publish" });
  });
});
