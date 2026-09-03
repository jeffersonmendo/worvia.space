import { beforeEach, describe, expect, mock, test } from "bun:test";

type RealtimeHandler = (payload: { new: unknown }) => void;
type FetchMock = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

let realtimeHandler: RealtimeHandler | null = null;
let jobsById: Record<string, Record<string, unknown>> = {};
let effectCleanups: Array<() => void> = [];
const fetchMock = mock<FetchMock>(() => Promise.resolve(new Response()));

mock.module("react", () => ({
  useEffect: (effect: () => (() => void) | undefined) => {
    const cleanup = effect();
    if (cleanup) effectCleanups.push(cleanup);
  },
  useRef: <T>(current: T) => ({ current }),
  useState: <T>(initial: T) => [initial, () => undefined],
}));

mock.module("react/jsx-dev-runtime", () => ({
  Fragment: Symbol.for("react.fragment"),
  jsxDEV: () => null,
}));

mock.module("react/jsx-runtime", () => ({
  Fragment: Symbol.for("react.fragment"),
  jsx: () => null,
  jsxs: () => null,
}));

mock.module("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

mock.module("sonner", () => ({
  toast: {
    dismiss: () => undefined,
    error: () => undefined,
    info: () => undefined,
    loading: () => undefined,
    success: () => undefined,
  },
}));

mock.module("@/components/ui/button", () => ({
  Button: () => null,
}));

mock.module("@/components/ui/dialog", () => ({
  Dialog: () => null,
  DialogContent: () => null,
  DialogDescription: () => null,
  DialogFooter: () => null,
  DialogHeader: () => null,
  DialogTitle: () => null,
}));

mock.module("@/i18n/navigation", () => ({
  usePathname: () => "/create/portal-1",
  useRouter: () => ({ refresh: () => undefined }),
}));

mock.module("@/application/portal/editor-store", () => ({
  usePortalEditorStore: {
    getState: () => ({
      autosaveByPortalId: {},
      documentServerRevisionByPortalId: {},
      serverHydrationGenerationByPortalId: {},
    }),
    subscribe: () => () => undefined,
  },
}));

mock.module("@/lib/portal/ai-workflow-store", () => {
  const state = {
    get jobsById() {
      return jobsById;
    },
    removeJob: (id: string) => {
      const next = { ...jobsById };
      delete next[id];
      jobsById = next;
    },
    upsertJob: (job: Record<string, unknown>) => {
      jobsById = { ...jobsById, [job.id as string]: job };
    },
  };
  const useAiWorkflowStore = <T>(selector: (value: typeof state) => T) =>
    selector(state);
  useAiWorkflowStore.getState = () => state;
  return { useAiWorkflowStore };
});

mock.module("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    channel: () => ({
      on: (_event: string, _config: unknown, handler: RealtimeHandler) => {
        realtimeHandler = handler;
        return {
          subscribe: () => ({}),
        };
      },
    }),
    removeChannel: () => Promise.resolve(),
  }),
}));

const { AiWorkflowReconciler } = await import("./ai-workflow-reconciler");

async function settle() {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await Bun.sleep(0);
  }
}

function mount() {
  AiWorkflowReconciler();
}

beforeEach(() => {
  for (const cleanup of effectCleanups) cleanup();
  effectCleanups = [];
  fetchMock.mockClear();
  realtimeHandler = null;
  jobsById = {};
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  globalThis.window = {
    addEventListener: () => undefined,
    dispatchEvent: () => true,
    removeEventListener: () => undefined,
  } as unknown as Window & typeof globalThis;
});

describe("AiWorkflowReconciler", () => {
  test("recovers a persisted loading job missing from active jobs through one bounded detail request", async () => {
    jobsById = {
      "persisted-job": {
        id: "persisted-job",
        kind: "portal-operation",
        portalId: "portal-1",
        requestId: "request-1",
        status: "loading",
      },
    };
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/ai/jobs")
        return Promise.resolve(Response.json({ jobs: [] }));
      if (url === "/api/ai/jobs/persisted-job")
        return Promise.resolve(
          Response.json({
            job: {
              error_code: null,
              id: "persisted-job",
              kind: "portal-operation",
              portal_id: "portal-1",
              portal_name: "Portal",
              request_id: "request-1",
              status: "error",
              updated_at: "2026-09-02T10:00:00.000Z",
            },
          }),
        );
      throw new Error(`Unexpected request: ${url}`);
    });

    mount();
    await settle();

    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/ai/jobs/persisted-job",
      ),
    ).toHaveLength(1);
    expect(jobsById["persisted-job"]?.status).toBe("error");
  });

  test("does not process a Realtime processing event and still processes a queued operation", async () => {
    let activeJobStatus: "processing" | "queued" | null = null;
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/ai/jobs")
          return Promise.resolve(
            Response.json({
              jobs: activeJobStatus
                ? [
                    {
                      error_code: null,
                      id: "operation-job",
                      kind: "portal-operation",
                      portal_id: "portal-1",
                      portal_name: "Portal",
                      request_id: "request-1",
                      status: activeJobStatus,
                      updated_at: "2026-09-02T10:00:00.000Z",
                    },
                  ]
                : [],
            }),
          );
        if (
          url === "/api/ai/jobs/operation-job/process" &&
          init?.method === "POST"
        )
          return Promise.resolve(new Response());
        throw new Error(`Unexpected request: ${url}`);
      },
    );

    mount();
    await settle();
    fetchMock.mockClear();
    expect(realtimeHandler).not.toBeNull();

    activeJobStatus = "processing";
    realtimeHandler?.({ new: { id: "operation-job", status: "processing" } });
    await settle();

    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) =>
          url === "/api/ai/jobs/operation-job/process" &&
          (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toHaveLength(0);

    activeJobStatus = "queued";
    realtimeHandler?.({ new: { id: "operation-job", status: "queued" } });
    await settle();

    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) =>
          url === "/api/ai/jobs/operation-job/process" &&
          (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toHaveLength(1);
  });
});
