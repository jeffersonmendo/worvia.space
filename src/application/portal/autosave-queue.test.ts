import { describe, expect, test } from "bun:test";
import { AutosaveQueue, type AutosaveStatus } from "./autosave-queue";

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

describe("AutosaveQueue", () => {
  test("debounces rapid edits and persists only the latest snapshot", async () => {
    const saved: string[] = [];
    const queue = new AutosaveQueue<string>({
      delay: 15,
      save: async (value) => {
        saved.push(value);
      },
    });

    queue.schedule("first");
    queue.schedule("second");
    queue.schedule("latest");
    await wait(30);

    expect(saved).toEqual(["latest"]);
    expect(queue.status).toBe("saved");
  });

  test("serializes requests and follows an in-flight save with the newest edit", async () => {
    const saved: string[] = [];
    const releases: Array<() => void> = [];
    let concurrent = 0;
    let maxConcurrent = 0;
    const queue = new AutosaveQueue<string>({
      delay: 5,
      save: async (value) => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        saved.push(value);
        await new Promise<void>((resolve) => releases.push(resolve));
        concurrent -= 1;
      },
    });

    queue.schedule("first");
    await wait(10);
    queue.schedule("second");
    queue.schedule("latest");
    await wait(10);

    expect(saved).toEqual(["first"]);
    releases.shift()?.();
    await wait(10);
    expect(saved).toEqual(["first", "latest"]);
    releases.shift()?.();
    await wait(1);
    expect(maxConcurrent).toBe(1);
    expect(queue.status).toBe("saved");
  });

  test("reports an error without discarding a newer pending edit", async () => {
    const statuses: AutosaveStatus[] = [];
    const saved: string[] = [];
    let attempts = 0;
    const queue = new AutosaveQueue<string>({
      delay: 5,
      onStatusChange: (status) => statuses.push(status),
      save: async (value) => {
        attempts += 1;
        if (attempts === 1) {
          queue.schedule("recovered");
          throw new Error("offline");
        }
        saved.push(value);
      },
    });

    queue.schedule("first");
    await wait(25);

    expect(saved).toEqual(["recovered"]);
    expect(statuses).toContain("error");
    expect(queue.status).toBe("saved");
  });

  test("flush bypasses the debounce delay", async () => {
    const saved: string[] = [];
    const queue = new AutosaveQueue<string>({
      delay: 10_000,
      save: async (value) => {
        saved.push(value);
      },
    });

    queue.schedule("on-blur");
    await queue.flush();

    expect(saved).toEqual(["on-blur"]);
  });

  test("retains the last failed snapshot and retries it on the next flush", async () => {
    let attempts = 0;
    const queue = new AutosaveQueue<string>({
      delay: 10_000,
      save: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("offline");
      },
    });

    queue.schedule("latest");
    await expect(queue.flush()).rejects.toThrow("offline");
    expect(queue.status).toBe("error");

    await queue.flush();
    expect(attempts).toBe(2);
    expect(queue.status).toBe("saved");
  });

  test("a conflict preserves the newest blocked successor for explicit recovery", async () => {
    class Conflict extends Error {}
    let attempts = 0;
    let releaseFirst!: () => void;
    const saved: string[] = [];
    const queue = new AutosaveQueue<string>({
      delay: 10_000,
      save: async (value) => {
        attempts += 1;
        if (attempts === 1) {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve;
          });
          throw new Conflict("remote document won");
        }
        saved.push(value);
      },
      shouldRetry: (error) => !(error instanceof Conflict),
    });

    queue.schedule("stale D2");
    const firstFlush = queue.flush();
    await Promise.resolve();
    queue.schedule("newest D3");
    releaseFirst();
    await expect(firstFlush).rejects.toBeInstanceOf(Conflict);
    await expect(queue.flush()).rejects.toBeInstanceOf(Conflict);

    expect(attempts).toBe(1);
    expect(queue.status).toBe("conflict");

    queue.acknowledgeNonRetryableError();
    expect(queue.retryRecovery()).toBe("newest D3");
    await queue.flush();
    expect(saved).toEqual(["newest D3"]);
    expect(queue.status).toBe("saved");
  });

  test("dispose flushes pending work without notifying an unmounted consumer", async () => {
    const statuses: AutosaveStatus[] = [];
    const saved: string[] = [];
    const queue = new AutosaveQueue<string>({
      delay: 10_000,
      onStatusChange: (status) => statuses.push(status),
      save: async (value) => {
        saved.push(value);
      },
    });

    queue.schedule("pending");
    const statusesBeforeDispose = [...statuses];
    await queue.dispose();

    expect(saved).toEqual(["pending"]);
    expect(statuses).toEqual(statusesBeforeDispose);
    queue.schedule("ignored");
    await queue.flush();
    expect(saved).toEqual(["pending"]);
  });

  test("flush remains a barrier when a newer snapshot is scheduled during its save", async () => {
    const saved: string[] = [];
    let releaseFirstSave: (() => void) | undefined;
    const queue = new AutosaveQueue<string>({
      delay: 10_000,
      save: async (value) => {
        saved.push(value);
        if (value === "first") {
          await new Promise<void>((resolve) => {
            releaseFirstSave = resolve;
          });
        }
      },
    });

    queue.schedule("first");
    const flush = queue.flush();
    await Promise.resolve();
    queue.schedule("during-flush");
    releaseFirstSave?.();
    await flush;

    expect(saved).toEqual(["first", "during-flush"]);
    expect(queue.status).toBe("saved");
  });

  test("flush aborts instead of livelocking when writes never stabilize", async () => {
    let attempts = 0;
    let queue: AutosaveQueue<number>;
    queue = new AutosaveQueue<number>({
      delay: 10_000,
      maxFlushPasses: 3,
      save: async () => {
        attempts += 1;
        queue.schedule(attempts);
      },
    });

    queue.schedule(0);
    await expect(queue.flush()).rejects.toThrow("did not stabilize");
    expect(attempts).toBe(3);
  });

  test("dispose returns ownership of a latest snapshot that still cannot persist", async () => {
    const queue = new AutosaveQueue<string>({
      delay: 10_000,
      save: async () => {
        throw new Error("offline");
      },
    });
    queue.schedule("latest");

    const handoff = await queue.dispose();

    expect(handoff?.value).toBe("latest");
    expect(handoff?.error).toBeInstanceOf(Error);
  });

  test("dispose hands off an explicitly blocked conflict recovery draft", async () => {
    class Conflict extends Error {}
    const queue = new AutosaveQueue<string>({
      delay: 10_000,
      save: async () => {
        throw new Conflict("remote won");
      },
      shouldRetry: (error) => !(error instanceof Conflict),
    });
    queue.schedule("recovery D3");
    await expect(queue.flush()).rejects.toBeInstanceOf(Conflict);

    const handoff = await queue.dispose();

    expect(handoff).toMatchObject({
      nonRetryable: true,
      value: "recovery D3",
    });
  });
});
