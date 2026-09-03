import { expect, test } from "bun:test";

const source = (
  await Promise.all([
    Bun.file(
      new URL("./portal-workspace-controls.tsx", import.meta.url),
    ).text(),
    Bun.file(
      new URL(
        "../../app/[locale]/(workspace)/create/[portalId]/_components/portal-settings-dialog.tsx",
        import.meta.url,
      ),
    ).text(),
    Bun.file(new URL("./visual-color-picker.tsx", import.meta.url)).text(),
  ])
).join("\n");
const pageSource = await Bun.file(
  new URL(
    "../../app/[locale]/(workspace)/create/[portalId]/page.tsx",
    import.meta.url,
  ),
).text();
const renderSource = await Bun.file(
  new URL("./portal-project-controller.tsx", import.meta.url),
).text();
const sectionOrderSource = await Bun.file(
  new URL(
    "../../app/[locale]/(workspace)/create/[portalId]/_components/portal-section-order-popover.tsx",
    import.meta.url,
  ),
).text();

test("preserves locale and portal intent when opening Connect from create", () => {
  expect(source).toContain("function ConnectStripeButton({");
  expect(source).toContain("portalId: string;");
  expect(source).toContain("connect=onboarding");
  expect(source).toContain("portalId");
  expect(source).toContain("/home?");
});

test("renders a small centered loader inside each pending asset", () => {
  expect(source).toContain('<IconLoader2 className="size-4 animate-spin" />');
  expect(source).toContain("text-muted-foreground");
  expect(source).toContain('className="text-sm"');
  expect(source).toContain('t("uploading")');
  expect(source).not.toContain('from "react-dom"');
  expect(pageSource).not.toContain("PortalUploadLoadingOverlay");
});

test("renders the canonical gallery array order without a second CSS order", () => {
  expect(source).not.toContain("style={{ order: image.position }}");
  expect(source).not.toContain("const addTileOrder =");
  expect(source).not.toContain("order={addTileOrder}");
  expect(source).not.toContain("{ order }");
});

test("uses matching horizontal and vertical gaps in the Files editor grid", () => {
  const filesEditorStart = source.indexOf("function FilesEditor({");
  const filesEditorEnd = source.indexOf(
    "export function SectionContentEditor({",
    filesEditorStart,
  );
  const filesEditorSource = source.slice(filesEditorStart, filesEditorEnd);

  expect(filesEditorSource).toContain('"grid gap-x-4 gap-y-4"');
});

test("flushes discrete section configuration changes after scheduling them", () => {
  const updateSectionStart = renderSource.indexOf(
    "function updateRenderSection(",
  );
  const updateSectionEnd = renderSource.indexOf(
    "function removeRenderItem(",
    updateSectionStart,
  );
  const updateSectionSource = renderSource.slice(
    updateSectionStart,
    updateSectionEnd,
  );

  expect(updateSectionSource).toContain("flush: true");
  expect(renderSource).toContain(
    "schedulePortalAutosave(editor.portalId, next)",
  );
  expect(renderSource).toContain("flushPortalAutosave(editor.portalId)");
});

test("keeps section creation outside the RenderProject editor facade", () => {
  for (const factory of ["section:", "image:", "color:", "font:", "file:"]) {
    expect(renderSource).toContain(factory);
  }
  for (const action of [
    "configure-image",
    "configure-color",
    "configure-font",
    "configure-file",
  ]) {
    expect(renderSource).toContain(action);
  }
  expect(renderSource).toContain("tools.pickAssets");
  expect(renderSource).toContain("removeRenderItem");
  expect(renderSource).not.toContain("add-text-section");
  expect(renderSource).not.toContain("add-image-section");
  expect(renderSource).not.toContain("project: () =>");
});

test("creates sections from the external picker through the RenderProject helper", () => {
  expect(sectionOrderSource).toContain("appendRenderProjectSection");
  expect(sectionOrderSource).toContain("portalDocumentToRenderProject");
  expect(sectionOrderSource).toContain("applyRenderProjectDocument");
  expect(sectionOrderSource).not.toContain("createPortalSection");
});

test("marks the triggerless section picker as a non-native button trigger", () => {
  expect(source).toContain(
    "<DialogTrigger nativeButton={triggerNativeButton} render={trigger} />",
  );
  expect(sectionOrderSource).toContain(
    'trigger={<span aria-hidden="true" />}\n        triggerNativeButton={false}',
  );
});

test("uses the shared visual color picker and shadcn slider for image presentation", () => {
  expect(source).toContain('import { Slider } from "@/components/ui/slider"');
  expect(source).toContain("<VisualColorPicker");
  expect(source).toContain('className="w-full justify-start rounded-md"');
  expect(source).toContain("<Slider");
  expect(source).not.toContain('type="color"');
  expect(source).not.toContain('type="range"');
  expect(source).toContain('"EyeDropper" in window');
  expect(source).toContain("await eyeDropper.open()");
  expect(source).toContain('t("pickFromScreen")');
  expect(source).toContain('t("hexCode")');
  expect(source).toContain("portalQuickColors(document)");
  expect(source).toContain("quickColors.map((swatch)");
  expect(source).toContain(
    "file.file_type ?? portalFileTypeFromName(file.file_name)",
  );
});

test("submits the controlled privacy selection explicitly", () => {
  const privacyFormStart = source.indexOf("action={savePrivacySettings}");
  const privacyFormEnd = source.indexOf("</SettingsTabForm>", privacyFormStart);
  const privacyForm = source.slice(privacyFormStart, privacyFormEnd);

  expect(privacyForm).toContain(
    '<input\n                        name="visibility"\n                        type="hidden"\n                        value={visibility}\n                      />',
  );
  expect(privacyForm).not.toContain(
    'items={visibilityItems}\n                        name="visibility"',
  );
});

test("uses a controller-owned side configuration panel instead of a dialog", () => {
  expect(renderSource).toContain("<PanelConfig");
  expect(renderSource).toContain("changePanelConfiguration");
  expect(renderSource).toContain("onDelete={() => {");
  expect(renderSource).toContain("useOptionalWorkspaceConfigSidebar");
  expect(renderSource).toContain("createPortal");
  expect(renderSource).toContain("setConfigTarget");
  expect(renderSource).not.toContain("EditorConfigurationDialog");
  expect(renderSource).not.toContain("window.prompt");
});
