import { expect, test } from "bun:test";
import { AutosaveQueue } from "@/application/portal/autosave-queue";
import {
  PortalDocumentConflictError,
  persistPortalDocumentAtLatestRevision,
  type RevisionedPortalSaveResult,
} from "./revisioned-autosave";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("a queued successor resolves its expected revision when its save starts", async () => {
  let revision: number | null = 1;
  const firstSave = deferred<RevisionedPortalSaveResult>();
  const expectedRevisions: Array<number | null> = [];
  let calls = 0;
  const queue = new AutosaveQueue<string>({
    delay: 0,
    save: async (document) => {
      await persistPortalDocumentAtLatestRevision({
        acknowledge: (nextRevision) => {
          revision = nextRevision;
        },
        document,
        getExpectedRevision: () => revision,
        persist: async (_value, expectedRevision) => {
          expectedRevisions.push(expectedRevision);
          calls += 1;
          if (calls === 1) return await firstSave.promise;
          return { kind: "saved", revision: 3 };
        },
        reconcileConflict: () => {},
      });
    },
  });

  queue.schedule("D2");
  const flushing = queue.flush();
  await Promise.resolve();
  queue.schedule("D3");
  firstSave.resolve({ kind: "saved", revision: 2 });
  await flushing;

  expect(expectedRevisions).toEqual([1, 2]);
});

test("a conflict reconciles authoritative state and rejects the dependent flush", async () => {
  let reconciliations = 0;
  let attempts = 0;
  const statuses: string[] = [];
  const queue = new AutosaveQueue<string>({
    delay: 0,
    onStatusChange: (status) => statuses.push(status),
    shouldRetry: (error) => !(error instanceof PortalDocumentConflictError),
    save: async (document) => {
      await persistPortalDocumentAtLatestRevision({
        acknowledge: () => {
          throw new Error("a conflict must not advance the local revision");
        },
        document,
        getExpectedRevision: () => 1,
        persist: async () => {
          attempts += 1;
          return { kind: "conflict" };
        },
        reconcileConflict: () => {
          reconciliations += 1;
        },
      });
    },
  });

  queue.schedule("stale local D2");
  await expect(queue.flush()).rejects.toBeInstanceOf(
    PortalDocumentConflictError,
  );
  await expect(queue.flush()).rejects.toBeInstanceOf(
    PortalDocumentConflictError,
  );

  expect(attempts).toBe(1);
  expect(reconciliations).toBe(1);
  expect(statuses.at(-1)).toBe("conflict");
});
