import { expect, test } from "bun:test";

const page = await Bun.file(
  new URL(
    "../../app/[locale]/(workspace)/create/[portalId]/page.tsx",
    import.meta.url,
  ),
).text();
const controls = await Bun.file(
  new URL("./portal-workspace-controls.tsx", import.meta.url),
).text();
const settings = await Bun.file(
  new URL(
    "../../app/[locale]/(workspace)/create/[portalId]/_components/portal-settings-dialog.tsx",
    import.meta.url,
  ),
).text();
const renderer = (
  await Promise.all([
    Bun.file(
      new URL("./portal-project-controller.tsx", import.meta.url),
    ).text(),
    Bun.file(
      new URL(
        "../../application/portal/portal-asset-lifecycle.ts",
        import.meta.url,
      ),
    ).text(),
    Bun.file(
      new URL("./use-portal-editor-persistence.ts", import.meta.url),
    ).text(),
    Bun.file(
      new URL("../../application/portal/editor-store.ts", import.meta.url),
    ).text(),
    Bun.file(
      new URL(
        "../../app/[locale]/p/[slug]/_components/portal-public-actions.ts",
        import.meta.url,
      ),
    ).text(),
  ])
).join("\n");
const provider = await Bun.file(
  new URL("./portal-plan-provider.tsx", import.meta.url),
).text();
const workspaceControls = await Bun.file(
  new URL("./portal-workspace-controls.tsx", import.meta.url),
).text();
const publicSidebar = await Bun.file(
  new URL(
    "../../app/[locale]/p/[slug]/_components/document-sidebar.tsx",
    import.meta.url,
  ),
).text();
const publicPage = await Bun.file(
  new URL("../../app/[locale]/p/[slug]/page.tsx", import.meta.url),
).text();
const optimisticUploads = await Bun.file(
  new URL("../../lib/portal/optimistic-uploads.ts", import.meta.url),
).text();

test("the editor has one global plan provider and all document writes use its gate", () => {
  expect(page).toContain("PortalPlanProvider");
  expect(renderer).toContain("guardDocumentChange");
  expect(page).toContain("PortalPlanStatus");
});

test("direct public uploads are removed from the editor", () => {
  expect(controls).not.toContain(".upload(");
  expect(controls).not.toContain("getPublicUrl");
  expect(controls).toContain("uploadManagedPortalAsset");
  expect(renderer).toContain("deleteManagedPortalAsset");
});

test("successful uploads flush the document before reporting completion", () => {
  expect(controls).toContain(
    "const reconciled = await reconcileOptimisticUpload",
  );
  expect(controls).toContain("await flushPortalAutosave(portalId);");
  expect(controls).toContain("releaseManagedPortalAsset(asset.assetId)");
  expect(controls).toContain("finalized.sizeBytes");
});

test("fresh signed image previews are not normalized before autosave authorizes the stable route", () => {
  expect(renderer).toContain(
    'withStablePortalAssetPreviews(document, slug ?? "")',
  );
  expect(renderer).toContain(
    'withStablePortalAssetPreviews(document, slug ?? "")',
  );
  expect(renderer).toContain("orderDocumentItemsForRender(document)");
  expect(renderer).not.toContain(
    "orderDocumentItemsForRender(\n        withStablePortalAssetPreviews(activeDocument",
  );
});

test("optimistic upload callbacks keep their registry context", () => {
  expect(optimisticUploads).toContain("this.add = this.add.bind(this)");
  expect(optimisticUploads).toContain("this.owns = this.owns.bind(this)");
  expect(optimisticUploads).toContain(
    "this.subscribe = this.subscribe.bind(this)",
  );
});

test("pending uploads expose a pulsing busy visual state", () => {
  expect(controls).toContain("pending &&");
  expect(controls).toContain('"animate-pulse"');
  expect(controls).toContain('"animate-pulse opacity-60"');
  expect(controls).toContain('"animate-pulse opacity-60"');
  expect(controls).toContain('aria-busy="true"');
});

test("comparison galleries do not render a textual image-limit tile", () => {
  const gallery = controls.slice(
    controls.indexOf("function GalleryEditor("),
    controls.indexOf("function ColorDialog("),
  );

  expect(gallery).toContain("imageLimitReached && !isComparison");
  expect(gallery).toContain("const isComparison");
});

test("image upload affordance stays hidden while an optimistic upload is pending", () => {
  const imageTile = controls.slice(
    controls.indexOf("function AddImageTile("),
    controls.indexOf("function ImageEditor("),
  );

  expect(imageTile).toContain("availableSlots === 0 ? null :");
});

test("editor quota violations use an actionable toast before opening the plan dialog", () => {
  expect(provider).toContain('toast.warning(t("limitTitle"');
  expect(provider).toContain('action: { label: t("viewPlans")');
  expect(provider).toContain("openUpgradeDialog");
});

test("plan refreshes cannot let an older quota response overwrite a newer one", () => {
  expect(provider).toContain("const refreshSequence = useRef(0)");
  expect(provider).toContain(
    "const requestSequence = ++refreshSequence.current",
  );
  expect(provider).toContain(
    "if (requestSequence !== refreshSequence.current) return null",
  );
});

test("storage progress keeps the last ready percentage visible while refreshing", () => {
  expect(provider).toContain("const [lastReadyPercent, setLastReadyPercent]");
  expect(provider).toContain('if (status === "ready")');
  expect(provider).toContain("{lastReadyPercent ??");
  expect(provider).toContain('(status === "ready" ? Math.round(percent) : 0)}');
});

test("password visibility is available before a password can be entered", () => {
  expect(settings).toContain("guardPassword");
  expect(settings).not.toContain('disabled={plan !== "premium"}');
});

test("loading and fetch errors never present an editor as a non-owner", () => {
  expect(provider).toContain('useState<"error" | "loading" | "ready">');
  expect(provider).toContain('"loading",');
  expect(provider).toContain('status === "error"');
  expect(provider).toContain('status === "ready" &&');
  expect(provider).toContain("snapshot.canPurchase && activePlan");
});

test("upgrade modal presents eligible paid plans as tabs with one active purchase action", () => {
  expect(provider).toContain('from "@/components/ui/tabs"');
  expect(provider).toContain("<Tabs");
  expect(provider).toContain("<TabsList");
  expect(provider).toContain("<TabsTrigger");
  expect(provider).toContain("<TabsContent");
  expect(provider).toContain("setSelectedPlan");
  expect(provider).toContain(
    "planUpgradePriceCents(snapshot.plan, candidate) > 0",
  );
  expect(provider).toContain("checkout(candidate)");
  expect(provider).toContain("eligiblePlans.includes(selectedPlan)");
  expect(provider).toContain("PORTAL_PLANS[candidate]");
  expect(provider).toContain('activePlan ? t(activePlan) : t("aPlan")');
});

test("upgrade modal keeps checkout loading scoped to the selected plan", () => {
  expect(provider).toContain("checkoutPendingPlan");
  expect(provider).toContain("checkoutPendingPlan === candidate");
  expect(provider).toContain("disabled={checkoutPendingPlan !== null}");
  expect(provider).toContain('aria-label={t("buyAccessible"');
  expect(provider).toContain('t("buy", {');
  expect(provider).toContain('t("compareDescription")');
  expect(provider).not.toContain("IconCrown");
});

test("sidebar export uses the portal ZIP action instead of depending on Files", () => {
  expect(page).not.toContain("assetsSectionId");
  expect(publicSidebar).toContain("exportHref");
  expect(publicSidebar).not.toContain(
    'sections.find((section) => section.type === "files")',
  );
  expect(publicPage).toContain("portalExportHref(slug, exportSource)");
  expect(publicPage).toContain("portal.allow_downloads");
  expect(renderer).toContain("portalExportHref(slug, exportSource)");
});

test("public exports explicitly use the published document snapshot", () => {
  expect(publicPage).toContain("const exportSource =");
  expect(publicPage).toContain("portalExportHref(slug, exportSource)");
  expect(publicPage).toContain('const exportSource = "published" as const');
  expect(renderer).toContain("exportSource");
});

test("storage status opens a usage popover with an upgrade action", () => {
  const status = provider.slice(
    provider.indexOf("export function PortalPlanStatus()"),
  );
  const trigger = status.slice(
    status.indexOf("<PopoverTrigger"),
    status.indexOf("<PopoverContent"),
  );

  expect(provider).toContain("<Popover ");
  expect(provider).toContain("<PopoverContent");
  expect(provider).toContain('t("upgrade")');
  expect(provider).toContain('role="progressbar"');
  expect(provider).toContain("aria-valuenow={percent}");
  expect(provider).toContain("storageUsageState(percent)");
  expect(provider).toContain('requestUpgrade("upgrade_info")');
  expect(trigger).not.toContain('requestUpgrade("upgrade_info")');
  expect(provider).toContain('plan === "free"');
  expect(provider).not.toContain('requestUpgrade("total_sections")');
  expect(provider).toContain("rounded-full hover:bg-transparent");
  expect(provider).not.toContain('className="hidden min-w-36');
});

test("storage status selects copy that explains the quota scope", () => {
  expect(provider).toContain("t(`storageSummaries.$" + "{plan}`");
  expect(provider).toContain("t(`storageLabels.$" + "{plan}`)");
  expect(provider).not.toContain('t("storageSummary"');
  expect(provider).not.toContain('t("storage")');
});

test("upgrade dialog explains selected plan benefits with icon-led copy", () => {
  expect(provider).toContain("const benefits = [");
  expect(provider).toContain('text: t("benefits.password")');
  expect(provider).not.toContain('candidate === "premium"');
  expect(provider).toContain('t("benefits.password")');
  expect(provider).toContain('t("benefits.storage",');
  expect(provider).toContain('t("benefits.sections",');
  expect(provider).toContain('t("benefits.gallery",');
  expect(provider).toContain("IconLock");
  expect(provider).toContain("IconCloud");
  expect(provider).toContain("IconLayoutGrid");
  expect(provider).toContain("IconPhoto");
  expect(provider).toContain('<Icon className="size-4" />');
});

test("font upload dialog closes and clears staged files after saving", () => {
  const fontDialog = workspaceControls.slice(
    workspaceControls.indexOf("function FontDialog("),
    workspaceControls.indexOf("function FontFamilyDialog("),
  );

  expect(fontDialog).toContain("const [open, setOpen] = useState(false)");
  expect(fontDialog).toContain("onOpenChange={setOpen} open={open}");
  expect(fontDialog).toContain("setUploadedFonts([])");
  expect(fontDialog).toContain("setOpen(false)");
});

test("successful asset mutations refresh storage usage without a reload", () => {
  expect(provider).toContain("subscribePortalAssetUsageChanges");
  expect(provider).toContain("void refresh()");
  expect(renderer).toContain(
    "deleteManagedPortalAsset(assetId, fetch, portalId)",
  );
});

test("removed managed assets are deleted only after their document snapshot persists", () => {
  expect(renderer).toContain("acknowledge: (revision) => {");
  expect(renderer).toContain(
    "flushPersistedAssetDeletions(portalId, nextDocument)",
  );
  expect(renderer).toContain("queueAssetDeletions(");
  expect(renderer).not.toContain(
    "schedulePortalAutosave(editor.portalId, next);\n    removeAssetIds(",
  );
});
