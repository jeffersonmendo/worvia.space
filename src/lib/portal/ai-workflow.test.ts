import { expect, test } from "bun:test";
import { claimAiOperationJob } from "./ai-workflow";

test("claims an operation only when its durable status is queued", async () => {
  let queuedOnly = false;
  const claimedJob = {
    id: "job-1",
    payload: {},
    portal_id: "portal-1",
    request_id: "request-1",
  };
  const claimQuery = {
    eq: (column: string, value: string) => {
      if (column === "status" && value === "queued") queuedOnly = true;
      return claimQuery;
    },
    select: () => ({
      maybeSingle: async () => ({
        data: queuedOnly ? claimedJob : null,
        error: null,
      }),
    }),
  };
  const client = {
    from: () => ({
      update: () => claimQuery,
    }),
  };

  await expect(claimAiOperationJob(client as never, "job-1")).resolves.toEqual(
    claimedJob,
  );
  expect(queuedOnly).toBe(true);
});
