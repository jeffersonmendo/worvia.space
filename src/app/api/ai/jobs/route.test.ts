import { afterEach, expect, mock, test } from "bun:test";

let authenticated = true;
let jobs: Array<Record<string, unknown>> = [];
const statusFilter = mock(() => ({
  order: () => ({ limit: async () => ({ data: jobs, error: null }) }),
}));
const jobsSelect = mock(() => ({ in: statusFilter }));
const portalIds = mock(async () => ({ data: [], error: null }));
const portalsSelect = mock(() => ({ in: portalIds }));
const from = mock((table: string) => ({
  select: table === "ai_workflow_jobs" ? jobsSelect : portalsSelect,
}));

mock.module("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: authenticated ? { id: "owner-1" } : null },
      }),
    },
    from,
  }),
}));

const { GET } = await import("./route");

afterEach(() => {
  authenticated = true;
  jobs = [];
  from.mockClear();
  statusFilter.mockClear();
});

test("requires authentication before listing AI jobs", async () => {
  authenticated = false;

  const response = await GET(new Request("https://example.com/api/ai/jobs"));

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "authentication_required" });
  expect(from).not.toHaveBeenCalled();
});

test("returns only lightweight active jobs", async () => {
  jobs = [
    {
      id: "job-1",
      portal_id: "portal-1",
      kind: "portal-operation",
      status: "queued",
      request_id: "request-1",
      operation: "generate",
      auto_apply: false,
      progress: "applying",
      progress_detail: { batch: 1, total: 2 },
      error_code: null,
      updated_at: "2026-09-02T12:00:00.000Z",
    },
  ];

  const response = await GET(new Request("https://example.com/api/ai/jobs"));

  expect(statusFilter).toHaveBeenCalledWith("status", ["queued", "processing"]);
  expect(await response.json()).toEqual({
    jobs: [
      {
        ...jobs[0],
        autoApply: false,
        portal_name: null,
        progressDetail: { batch: 1, total: 2 },
      },
    ],
  });
});
