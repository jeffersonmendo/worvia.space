import { afterEach, expect, mock, test } from "bun:test";

let job: Record<string, unknown> | null = null;
const claimAiOperationJob = mock(
  async (): Promise<Record<string, unknown> | null> => null,
);
const processClaimedAiOperationJob = mock(async () => undefined);
const single = mock(async () => ({ data: job, error: job ? null : {} }));
const eq = mock(() => ({ eq, single }));
const select = mock(() => ({ eq }));
const from = mock(() => ({ select }));

mock.module("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "owner-1" } } }) },
    from,
  }),
}));
mock.module("@/lib/portal/ai-workflow", () => ({
  claimAiOperationJob,
  processClaimedAiOperationJob,
}));

const { POST } = await import("./route");

afterEach(() => {
  job = null;
  claimAiOperationJob.mockReset();
  claimAiOperationJob.mockResolvedValue(null);
  processClaimedAiOperationJob.mockReset();
  from.mockClear();
});

test("rejects processing jobs before they can be claimed", async () => {
  job = {
    id: "job-1",
    kind: "portal-operation",
    status: "processing",
  };

  const response = await POST(new Request("https://example.com"), {
    params: Promise.resolve({ jobId: "job-1" }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ job });
  expect(claimAiOperationJob).not.toHaveBeenCalled();
  expect(processClaimedAiOperationJob).not.toHaveBeenCalled();
});

test("processes a queued operation only after its atomic claim succeeds", async () => {
  job = {
    id: "job-1",
    kind: "portal-operation",
    status: "queued",
  };
  const claimedJob = {
    id: "job-1",
    portal_id: "portal-1",
    request_id: "request-1",
    payload: {},
  };
  claimAiOperationJob.mockResolvedValue(claimedJob);

  await POST(new Request("https://example.com"), {
    params: Promise.resolve({ jobId: "job-1" }),
  });

  expect(claimAiOperationJob).toHaveBeenCalledWith(expect.anything(), "job-1");
  expect(processClaimedAiOperationJob).toHaveBeenCalledWith(
    expect.anything(),
    claimedJob,
  );
});
