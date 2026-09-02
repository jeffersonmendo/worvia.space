import { describe, expect, test } from "bun:test";

const creation = await Bun.file(
  new URL(
    "../../app/[locale]/(workspace)/create/_components/portal-creation-questionnaire.tsx",
    import.meta.url,
  ),
).text();
const dialog = await Bun.file(
  new URL(
    "../../app/[locale]/(workspace)/create/[portalId]/_components/portal-ai-dialog.tsx",
    import.meta.url,
  ),
).text();
const controls = await Bun.file(
  new URL("./portal-workspace-controls.tsx", import.meta.url),
).text();
const proposalsRoute = await Bun.file(
  new URL("../../app/api/ai/portal-proposals/route.ts", import.meta.url),
).text();
const contentRoute = await Bun.file(
  new URL("../../app/api/ai/portal-content/route.ts", import.meta.url),
).text();
const creationSource = creation;

describe("AI credit gating", () => {
  test("reserves credits before proposal processing", () => {
    expect(proposalsRoute).toContain('"reserve_ai_credits"');
    expect(proposalsRoute).toContain("insufficient_credits");
    expect(creation).toContain("useAiCredits");
    expect(creation).toContain("aiCreditsQueryKey");
    expect(creation).toContain("invalidateQueries");
    expect(dialog).toContain("useAiCredits");
    expect(dialog).toContain("invalidateQueries");
    expect(dialog).toContain("waitForAiWorkflowJob");
    expect(dialog).not.toContain("setTimeout(resolve, 1000)");
  });

  test("reserves refine-copy credits before starting content AI", () => {
    expect(contentRoute).toContain('"reserve_ai_credits"');
    expect(controls).toContain("useAiCredits");
    expect(controls).toContain("canAffordRefineCopy");
    expect(controls).toContain('t("insufficientCredits")');
    expect(controls).toContain("invalidateQueries");
    expect(controls).toContain('workspaceT("credits.upgrade")');
    expect(controls).toContain("billing:credits-upgrade");
  });

  test("uses button loading and queued toasts instead of a full creation loading screen", () => {
    expect(creationSource).toContain("mutation.isPending");
    expect(creationSource).toContain('toast.success(t("aiQueued"))');
    expect(creationSource).not.toContain("if (mutation.isPending) {");
    expect(dialog).toContain('toast.success(t("jobQueued"))');
    expect(dialog).toContain('workspaceT("aiAddWithAiTitle")');
    expect(dialog).not.toContain("<Progress");
    expect(dialog).not.toContain("absolute inset-0 z-10");
    expect(controls).toContain('toast.success(t("jobQueued"))');
    expect(controls).toContain(
      'toast.loading(workspaceT("aiImproveWithAiTitle")',
    );
  });

  test("prevents duplicate AI work for the same project or target", () => {
    expect(dialog).toContain("hasActiveProjectJob");
    expect(controls).toContain("hasActiveTargetJob");
    expect(controls).toContain("job.targetKey === targetKey");
    expect(proposalsRoute).toContain('"ai_workflow_in_progress"');
    expect(contentRoute).toContain('"ai_workflow_in_progress"');
    expect(dialog).toContain('t("alreadyInProgress")');
    expect(controls).toContain('t("alreadyInProgress")');
  });
});
