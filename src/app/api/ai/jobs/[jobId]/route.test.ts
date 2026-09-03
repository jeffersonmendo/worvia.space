import { afterEach, expect, mock, test } from "bun:test";

let authenticated = true;
let job: Record<string, unknown> | null = null;
const jobSingle = mock(async () => ({ data: job, error: job ? null : {} }));
const jobEq = mock(() => ({ single: jobSingle }));
const jobsSelect = mock(() => ({ eq: jobEq }));
const portalMaybeSingle = mock(async () => ({ data: { name: "Portal name" } }));
const portalEq = mock(() => ({ maybeSingle: portalMaybeSingle }));
const portalsSelect = mock(() => ({ eq: portalEq }));
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
  job = null;
  from.mockClear();
});

test("requires authentication before reading a terminal job", async () => {
  authenticated = false;

  const response = await GET(new Request("https://example.com"), {
    params: Promise.resolve({ jobId: "job-1" }),
  });

  expect(response.status).toBe(401);
  expect(from).not.toHaveBeenCalled();
});

test("returns a known terminal job with the metadata needed for recovery", async () => {
  job = {
    id: "job-1",
    portal_id: "portal-1",
    kind: "portal-proposal",
    status: "completed",
    request_id: "request-1",
    result: { proposal: { summary: "Ready" } },
    operation: "improve-project",
    auto_apply: false,
    progress: "applying",
    progress_detail: { batch: 1, total: 1 },
    error_code: null,
    updated_at: "2026-09-02T12:00:00.000Z",
  };

  const response = await GET(new Request("https://example.com"), {
    params: Promise.resolve({ jobId: "job-1" }),
  });

  expect(await response.json()).toEqual({
    job: {
      ...job,
      autoApply: false,
      portal_name: "Portal name",
      progressDetail: { batch: 1, total: 1 },
    },
  });
});
