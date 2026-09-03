import { expect, test } from "bun:test";
import {
  canRefreshCompletedDocumentJob,
  getTerminalRecoveryJobIds,
  hasAuthoritativeDocumentAck,
  shouldRequestDocumentRefresh,
} from "./ai-job-reconciliation";

test("completed AI jobs wait for pending or failed local autosave ownership", () => {
  expect(canRefreshCompletedDocumentJob(undefined)).toBe(true);
  expect(canRefreshCompletedDocumentJob({ error: null, status: "idle" })).toBe(
    true,
  );
  expect(canRefreshCompletedDocumentJob({ error: null, status: "saved" })).toBe(
    true,
  );
  expect(
    canRefreshCompletedDocumentJob({ error: null, status: "saving" }),
  ).toBe(false);
  expect(
    canRefreshCompletedDocumentJob({ error: "offline", status: "error" }),
  ).toBe(false);
});

test("a completed job version requests only one refresh while awaiting hydration", () => {
  expect(shouldRequestDocumentRefresh(undefined, "job-1", "v1")).toBe(true);
  expect(
    shouldRequestDocumentRefresh(
      {
        baselineHydrationGeneration: 7,
        baselineRevision: 1,
        jobId: "job-1",
        jobVersion: "v1",
      },
      "job-1",
      "v1",
    ),
  ).toBe(false);
  expect(
    shouldRequestDocumentRefresh(
      {
        baselineHydrationGeneration: 7,
        baselineRevision: 1,
        jobId: "job-1",
        jobVersion: "v1",
      },
      "job-1",
      "v2",
    ),
  ).toBe(true);
});

test("completed AI work is acknowledged after an authoritative server hydration", () => {
  const pending = {
    baselineHydrationGeneration: 7,
    baselineRevision: 1,
    jobId: "job-1",
    jobVersion: "v1",
  };

  expect(hasAuthoritativeDocumentAck(pending, 7, 1)).toBe(false);
  expect(hasAuthoritativeDocumentAck(pending, undefined, 1)).toBe(false);
  // A completed job can first be discovered after its persisted revision has
  // already hydrated. The forced RSC refresh is still authoritative even when
  // it confirms that same revision; requiring a strictly newer revision would
  // refresh forever.
  expect(hasAuthoritativeDocumentAck(pending, 8, 1)).toBe(true);
  expect(hasAuthoritativeDocumentAck(pending, 8, 2)).toBe(true);
});

test("recovers persisted loading jobs missing from the active-job response", () => {
  expect(
    getTerminalRecoveryJobIds(
      {
        active: { status: "loading", updatedAt: "2026-09-02T12:00:00.000Z" },
        newest: { status: "loading", updatedAt: "2026-09-02T11:00:00.000Z" },
        completed: {
          status: "completed",
          updatedAt: "2026-09-02T10:00:00.000Z",
        },
        oldest: { status: "loading", updatedAt: "2026-09-02T09:00:00.000Z" },
      },
      new Set(["active"]),
      1,
    ),
  ).toEqual(["newest"]);
});
