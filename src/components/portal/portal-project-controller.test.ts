import { expect, test } from "bun:test";

const controllerSource = await Bun.file(
  new URL("./portal-project-controller.tsx", import.meta.url),
).text();

test("lets the configuration hosts, rather than the portal, constrain drawer scrolling", () => {
  const panelPortal = controllerSource.slice(
    controllerSource.indexOf("? createPortal("),
    controllerSource.indexOf("section={configSection}"),
  );

  expect(panelPortal).toContain("<PanelConfig");
  expect(panelPortal).not.toContain("h-fit max-h-[80dvh]");
  expect(panelPortal).not.toContain("className={");
});

test("resets the configuration scroll owner when the configured target changes", () => {
  expect(controllerSource).toContain(
    'from "@/lib/portal/reset-config-panel-scroll"',
  );
  expect(controllerSource).toContain("configPanelTargetKey(configTarget)");
  expect(controllerSource).toContain("resetConfigPanelScroll(configPanelHost)");
});

test("opens a color creation dialog without creating a color", () => {
  const addColorAction = controllerSource.slice(
    controllerSource.indexOf('id: "add-color"'),
    controllerSource.indexOf(
      "return undefined;",
      controllerSource.indexOf('id: "add-color"'),
    ),
  );

  expect(addColorAction).toContain("setColorCreationSectionId(section.id)");
  expect(addColorAction).not.toContain("updateRenderSection");
});

test("creates the confirmed color with the selected code and trimmed name", () => {
  const dialogStart = controllerSource.indexOf("function ColorCreationDialog(");
  const dialogSource = controllerSource.slice(dialogStart);
  const confirmation = controllerSource.slice(
    controllerSource.indexOf("<ColorCreationDialog"),
    dialogStart,
  );

  expect(dialogSource).toContain(
    '<VisualColorPicker\n              format="hex"',
  );
  expect(dialogSource).toContain("const name = draft.name.trim();");
  expect(dialogSource).toContain(
    "onClick={() => onConfirm({ ...draft, name })}",
  );
  expect(dialogSource).toContain("disabled={!name}");
  expect(confirmation).toContain("code,");
  expect(confirmation).toContain("name,");
  expect(confirmation).toContain('id: createRandomId("color")');
});

test("captures the color name before scheduling its draft update", () => {
  const dialogStart = controllerSource.indexOf("function ColorCreationDialog(");
  const dialogSource = controllerSource.slice(dialogStart);

  expect(dialogSource).toContain(
    "onChange={(event) => {\n                const name = event.currentTarget.value;\n                setDraft((current) => ({ ...current, name }));\n              }}",
  );
  expect(dialogSource).not.toContain("name: event.currentTarget.value");
});

test("delegates post-render section-title focus to the renderer facade", () => {
  expect(controllerSource).toContain("useRef<RenderProjectHandle>(null)");
  expect(controllerSource).toContain(
    "renderProjectRef.current?.focusSectionTitle(editor.focus)",
  );
  expect(controllerSource).toContain("ref={renderProjectRef}");
});

test("recovers invalid asset selections with localized feedback at the controller boundary", () => {
  const rejectedSelection = controllerSource.slice(
    controllerSource.indexOf("if (change.rejectedFileCount)"),
    controllerSource.indexOf("const itemMove = change.itemMove"),
  );
  const assetSelection = controllerSource.slice(
    controllerSource.indexOf("if (change.assets?.length && isEditorMode)"),
    controllerSource.indexOf(
      "if (draftProject) setDraftProject(change.project)",
    ),
  );

  expect(assetSelection).toContain(
    "recoverExpectedPortalAssetUploadRejection({",
  );
  expect(assetSelection).toContain("setDraftProject(null)");
  expect(assetSelection).toContain('toast.error(uploadT("invalidAsset")');
  expect(assetSelection).toContain("throw error");
  expect(rejectedSelection).toContain(
    'uploadT("skippedAssets", { count: change.rejectedFileCount })',
  );
  expect(rejectedSelection).toContain("if (!change.assets?.length) return");
});
