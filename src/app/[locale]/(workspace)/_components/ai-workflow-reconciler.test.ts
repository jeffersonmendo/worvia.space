import { describe, expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./ai-workflow-reconciler.tsx", import.meta.url),
).text();
const layoutSource = await Bun.file(
  new URL("../../layout.tsx", import.meta.url),
).text();
const migrationSource = await Bun.file(
  new URL(
    "../../../../../supabase/migrations/20260819100000_enable_ai_workflow_realtime.sql",
    import.meta.url,
  ),
).text();
const sidebarSource = await Bun.file(
  new URL("./workspace-sidebar.tsx", import.meta.url),
).text();

describe("AiWorkflowReconciler", () => {
  test("refreshes the persisted server document instead of replaying completed jobs locally", () => {
    expect(source).toContain("useRef");
    expect(source).toContain("appliedDocumentJobByPortalRef");
    expect(source).toContain("previousStatusesRef");
    expect(source).not.toContain("updateDocument(");
    expect(source).toContain("routerRef.current.refresh()");
    expect(source).toContain("job.result?.document");
    expect(source).toContain("aiCreatingProjectTitle");
    expect(source).toContain("aiImproveWithAiTitle");
    expect(source).toContain("aiAddWithAiTitle");
    expect(source).toContain('"portal-ai-workflow-reconcile"');
    expect(source).toContain("toast.dismiss");
    expect(source).toContain("job.portalId");
    expect(source).not.toContain(
      "const appliedDocumentJobByPortal = new Map<string, string>();",
    );
    expect(source).not.toContain(
      'const previousStatuses = new Map<string, Job["status"]>();',
    );
    expect(source).toContain("canRefreshCompletedDocumentJob(autosave)");
    expect(source).toContain("usePortalEditorStore.subscribe");
  });

  test("uses Supabase Realtime without periodic polling", () => {
    expect(source).toContain("const tRef = useRef(t);");
    expect(source).toContain("const routerRef = useRef(router);");
    expect(source).toContain("const pathnameRef = useRef(pathname);");
    expect(source).toContain('.channel("ai-workflow-jobs")');
    expect(source).toContain('event: "*"');
    expect(source).toContain('table: "ai_workflow_jobs"');
    expect(source).toContain("removeChannel");
    expect(source).not.toContain("window.setInterval");
    expect(source).not.toContain("window.clearInterval");
    expect(source).not.toContain(", router, t, upsertJob]");
    expect(source).toContain("createTrailingReconciler");
    expect(source).toContain("aiJobsRequestInFlight");
    expect(source).toContain('if (status === "SUBSCRIBED") void reconcile()');
  });

  test("declares smooth scrolling for Next.js route transitions", () => {
    expect(layoutSource).toContain('data-scroll-behavior="smooth"');
  });

  test("publishes AI job changes for Supabase Realtime", () => {
    expect(migrationSource).toContain(
      "alter publication supabase_realtime add table public.ai_workflow_jobs;",
    );
  });

  test("keeps active AI workflows visible from every sidebar", () => {
    expect(sidebarSource).not.toContain("currentProjectId === job.portalId");
    expect(sidebarSource).toContain("jobsById");
    expect(sidebarSource).toContain("pathname.match(/\\/create\\/([^/]+)/)");
  });
});
