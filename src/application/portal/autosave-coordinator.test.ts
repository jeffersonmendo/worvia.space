import { expect, test } from "bun:test";
import {
  acknowledgePortalAutosaveConflict,
  ensurePortalAutosave,
  flushPortalAutosave,
  releasePortalAutosave,
  retryPortalAutosaveConflict,
  schedulePortalAutosave,
} from "./autosave-coordinator";
import { AutosaveQueue } from "./autosave-queue";

test("flushes a scheduled snapshot before a dependent publish operation", async () => {
  const events: string[] = [];
  const queue = new AutosaveQueue<string>({
    delay: 10_000,
    save: async (snapshot) => {
      events.push(`save:${snapshot}`);
    },
  });
  ensurePortalAutosave("publish-test", () => queue);

  schedulePortalAutosave("publish-test", "latest");
  await flushPortalAutosave("publish-test");
  events.push("publish");

  expect(events).toEqual(["save:latest", "publish"]);
  releasePortalAutosave("publish-test");
});

test("propagates autosave failure so publishing can abort", async () => {
  const queue = new AutosaveQueue<string>({
    delay: 10_000,
    save: async () => {
      throw new Error("save failed");
    },
  });
  ensurePortalAutosave("failure-test", () => queue);

  schedulePortalAutosave("failure-test", "latest");
  await expect(flushPortalAutosave("failure-test")).rejects.toThrow(
    "save failed",
  );
  releasePortalAutosave("failure-test");
});

test("cancels deferred disposal on remount and disposes after final unmount", async () => {
  let disposals = 0;
  const handle = {
    dispose: async () => {
      disposals += 1;
      return undefined;
    },
    flush: async () => {},
    schedule: (_value: string) => {},
  };

  expect(ensurePortalAutosave("lifecycle-test", () => handle)).toBe(handle);
  releasePortalAutosave("lifecycle-test");
  expect(ensurePortalAutosave("lifecycle-test", () => handle)).toBe(handle);
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(disposals).toBe(0);

  releasePortalAutosave("lifecycle-test");
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(disposals).toBe(1);
});

test("a remount after disposal starts receives a fresh active handle", async () => {
  let finishDispose: (() => void) | undefined;
  let disposalStarted = false;
  const first = {
    dispose: async () => {
      disposalStarted = true;
      await new Promise<void>((resolve) => {
        finishDispose = resolve;
      });
      return undefined;
    },
    flush: async () => {},
    schedule: (_value: string) => {},
  };
  const second = {
    flush: async () => {},
    schedule: (_value: string) => {},
  };

  ensurePortalAutosave("disposing-remount-test", () => first);
  releasePortalAutosave("disposing-remount-test");
  await new Promise((resolve) => setTimeout(resolve, 1));
  expect(disposalStarted).toBe(true);

  expect(ensurePortalAutosave("disposing-remount-test", () => second)).not.toBe(
    first,
  );
  finishDispose?.();
  await Promise.resolve();
  await flushPortalAutosave("disposing-remount-test");
  releasePortalAutosave("disposing-remount-test");
});

test("serializes a new generation behind disposal and forwards only its newest snapshot", async () => {
  const events: string[] = [];
  const scheduled: string[] = [];
  let finishOld: (() => void) | undefined;
  const oldHandle = {
    dispose: async () => {
      events.push("old:start");
      await new Promise<void>((resolve) => {
        finishOld = resolve;
      });
      events.push("old:finish");
      return undefined;
    },
    flush: async () => {},
    schedule: (_value: string) => {},
  };
  const newHandle = {
    flush: async () => {
      events.push("new:finish");
    },
    schedule: (value: string) => {
      scheduled.push(value);
      events.push("new:start");
    },
  };

  ensurePortalAutosave("generation-test", () => oldHandle);
  releasePortalAutosave("generation-test");
  await new Promise((resolve) => setTimeout(resolve, 1));
  ensurePortalAutosave("generation-test", () => newHandle);
  schedulePortalAutosave("generation-test", "D2");
  schedulePortalAutosave("generation-test", "D3");
  await Promise.resolve();
  expect(events).toEqual(["old:start"]);

  finishOld?.();
  await flushPortalAutosave("generation-test");
  expect(events).toEqual([
    "old:start",
    "old:finish",
    "new:start",
    "new:finish",
  ]);
  expect(scheduled).toEqual(["D3"]);
  releasePortalAutosave("generation-test");
});

test("hands a failed final snapshot to the successor and blocks flush until recovery", async () => {
  let finishDispose: (() => void) | undefined;
  const oldHandle = {
    dispose: async () => {
      await new Promise<void>((resolve) => {
        finishDispose = resolve;
      });
      return { error: new Error("offline"), value: "latest" };
    },
    flush: async () => {},
    schedule: (_value: string) => {},
  };
  let attempts = 0;
  const persisted: string[] = [];
  const successor = new AutosaveQueue<string>({
    delay: 10_000,
    save: async (value) => {
      attempts += 1;
      if (attempts === 1) throw new Error("still offline");
      persisted.push(value);
    },
  });

  ensurePortalAutosave("handoff-test", () => oldHandle);
  releasePortalAutosave("handoff-test");
  await new Promise((resolve) => setTimeout(resolve, 1));
  ensurePortalAutosave("handoff-test", () => successor);
  finishDispose?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(successor.status).toBe("error");

  const firstFlush = flushPortalAutosave("handoff-test");
  await expect(firstFlush).rejects.toThrow("still offline");
  expect(successor.status).toBe("error");
  await flushPortalAutosave("handoff-test");
  expect(persisted).toEqual(["latest"]);
  releasePortalAutosave("handoff-test");
});

test("a newer successor snapshot supersedes an older failed handoff", async () => {
  let finishDispose: (() => void) | undefined;
  const oldHandle = {
    dispose: async () => {
      await new Promise<void>((resolve) => {
        finishDispose = resolve;
      });
      return { error: new Error("old failed"), value: "D1" };
    },
    flush: async () => {},
    schedule: (_value: string) => {},
  };
  const persisted: string[] = [];
  const successor = new AutosaveQueue<string>({
    delay: 10_000,
    save: async (value) => {
      persisted.push(value);
    },
  });

  ensurePortalAutosave("handoff-latest-test", () => oldHandle);
  releasePortalAutosave("handoff-latest-test");
  await new Promise((resolve) => setTimeout(resolve, 1));
  ensurePortalAutosave("handoff-latest-test", () => successor);
  schedulePortalAutosave("handoff-latest-test", "D2");
  finishDispose?.();
  await flushPortalAutosave("handoff-latest-test");

  expect(persisted).toEqual(["D2"]);
  releasePortalAutosave("handoff-latest-test");
});

test("retains a failed handoff when remount happens after disposal completed", async () => {
  const oldHandle = {
    dispose: async () => ({ error: new Error("offline"), value: "latest" }),
    flush: async () => {},
    schedule: (_value: string) => {},
  };
  const persisted: string[] = [];
  const successor = new AutosaveQueue<string>({
    delay: 10_000,
    save: async (value) => {
      persisted.push(value);
    },
  });

  ensurePortalAutosave("completed-handoff-test", () => oldHandle);
  releasePortalAutosave("completed-handoff-test");
  await new Promise((resolve) => setTimeout(resolve, 5));
  ensurePortalAutosave("completed-handoff-test", () => successor);
  await flushPortalAutosave("completed-handoff-test");

  expect(persisted).toEqual(["latest"]);
  releasePortalAutosave("completed-handoff-test");
});

test("stages an authoritative ack that arrives before a conflict handoff", async () => {
  const oldHandle = {
    dispose: async () => ({
      error: new Error("remote won"),
      nonRetryable: true as const,
      value: "recovery D3",
    }),
    flush: async () => {},
    schedule: (_value: string) => {},
  };
  const successor = new AutosaveQueue<string>({
    delay: 10_000,
    save: async () => {},
  });

  ensurePortalAutosave("early-conflict-ack-test", () => oldHandle);
  releasePortalAutosave("early-conflict-ack-test");
  await new Promise((resolve) => setTimeout(resolve, 0));
  ensurePortalAutosave("early-conflict-ack-test", () => successor);

  expect(acknowledgePortalAutosaveConflict("early-conflict-ack-test")).toBe(
    true,
  );
  await Promise.resolve();
  await Promise.resolve();

  expect(successor.status).toBe("conflict");
  expect(retryPortalAutosaveConflict<string>("early-conflict-ack-test")).toBe(
    "recovery D3",
  );
  releasePortalAutosave("early-conflict-ack-test");
});
