import { describe, expect, test } from "bun:test";

const demoSource = await Bun.file(
  new URL("./landing-editor-demo.tsx", import.meta.url),
).text();
const fixture = await Bun.file(
  new URL("./landing-editor-demo.fixture.json", import.meta.url),
).json();
const editorControlsSource = await Bun.file(
  new URL(
    "../../../components/portal/portal-workspace-controls.tsx",
    import.meta.url,
  ),
).text();
const dialogSource = await Bun.file(
  new URL("../../../components/ui/dialog.tsx", import.meta.url),
).text();
const popoverSource = await Bun.file(
  new URL("../../../components/ui/popover.tsx", import.meta.url),
).text();
const downloadUiSource = await Bun.file(
  new URL("../../../lib/portal/download-ui.ts", import.meta.url),
).text();

describe("LandingEditorDemo", () => {
  test("forces the renderer into desktop presentation without changing its default", () => {
    expect(demoSource).toContain('styleMode="desktop"');
  });

  test("reuses the production portal renderer instead of duplicating asset cards", () => {
    expect(demoSource).toContain("<PortalProjectController");
    expect(demoSource).toContain('mode="demo"');
    expect(demoSource).not.toContain("section.content.images?.map");
    expect(demoSource).not.toContain("extraImages");
  });

  test("declares a local editor that cannot expose managed upload controls", () => {
    expect(demoSource).toContain("allowUploads: false");
  });

  test("shows the same two local assets as the real Mart POS project", () => {
    expect(fixture.sections[0].content.images).toHaveLength(2);
    expect(
      fixture.sections[0].content.images.map(
        (image: { display_name?: string }) => image.display_name,
      ),
    ).toEqual(["Light brand logo", ""]);
    expect(
      fixture.sections[0].content.images.map(
        (image: { background_color?: string; container_padding?: number }) => ({
          background_color: image.background_color,
          container_padding: image.container_padding,
        }),
      ),
    ).toEqual([
      { background_color: "#000000", container_padding: 30 },
      { background_color: "secondary", container_padding: 30 },
    ]);
    expect(fixture.sections[1].content.colors).toEqual([
      expect.objectContaining({ color_code: "#FFFFFF" }),
    ]);
  });

  test("starts from visibly unfinished portal and image metadata", () => {
    expect(fixture.portal.description).toBe("");
    const firstImage = fixture.sections[0].content.images.toSorted(
      (left: { position: number }, right: { position: number }) =>
        left.position - right.position,
    )[0];
    expect(firstImage.display_name).toBe("");
    expect(firstImage.allow_download).toBe(false);
    expect(firstImage.background_color).not.toBe("#000000");
  });

  test("keeps image settings text inputs controlled across synced image props", () => {
    const popoverStart = editorControlsSource.indexOf(
      "function ImageSettingsPopover",
    );
    const popoverEnd = editorControlsSource.indexOf(
      "function ImageTile",
      popoverStart,
    );
    const popover = editorControlsSource.slice(popoverStart, popoverEnd);
    expect(popover).not.toContain("defaultValue=");
    expect(popover).toContain("value={nameDraft.draft}");
    expect(popover).toContain("value={downloadNameDraft.draft}");
  });

  test("builds the walkthrough from the typed target contract", () => {
    expect(demoSource).toContain("LANDING_EDITOR_DEMO_SEQUENCE");
    for (const token of [
      ".click(projectDescription",
      ".scroll(colorsSection",
      ".click(addColor",
      ".scroll(gallerySection",
      ".click(firstImageSettings",
      ".click(firstImageDownload",
      ".click(popoverDismissArm",
      ".click(editorCanvas",
      ".click(publish",
    ]) {
      expect(demoSource).toContain(token);
    }
  });

  test("keeps editor actions local while exposing real presentation controls", () => {
    expect(demoSource).toContain("showControls: true");
    expect(demoSource).toContain("allowUploads: false");
    expect(demoSource).toContain("overlayContainer: viewport");
  });

  test("declares every dynamic walkthrough target on the real editor controls", () => {
    expect(editorControlsSource).toContain(
      'data-portal-demo-target="add-color"',
    );
    expect(editorControlsSource).toContain('"color-code"');
    expect(editorControlsSource).toContain('"save-color"');
    expect(editorControlsSource).toContain("demoTargetPrefix}-settings");
    expect(editorControlsSource).toContain("targetPrefix}-picker");
    expect(editorControlsSource).toContain("targetPrefix}-black");
  });

  test("preserves the required plan provider for production galleries", () => {
    expect(editorControlsSource).toContain("function ManagedGalleryEditor");
    expect(editorControlsSource).toContain(
      "const { requestUpgrade, snapshot, status } = usePortalPlan();",
    );
    expect(editorControlsSource).not.toContain("useOptionalPortalPlan");
  });

  test("contains demo overlays without changing production defaults", () => {
    expect(demoSource).toContain("data-demo-overlay-host");
    expect(demoSource).toContain("relative isolate");
    expect(demoSource).toContain("h-full overflow-hidden");
    expect(dialogSource).toContain('contained ? "absolute" : "fixed"');
    expect(editorControlsSource).toContain(
      "contained={Boolean(overlayContainer)}",
    );
    expect(popoverSource).toContain("positionMethod={positionMethod}");
    expect(editorControlsSource).toContain(
      'positionMethod={overlayContainer ? "absolute" : "fixed"}',
    );
    expect(editorControlsSource).toContain(
      "modal={overlayContainer ? false : undefined}",
    );
    expect(editorControlsSource).toContain(
      "disablePointerDismissal={Boolean(overlayContainer)}",
    );
    expect(editorControlsSource).toContain(
      "applyContainedDemoOverlayOpenChange",
    );
    expect(demoSource).toContain("demoTarget(editorCanvas)");
    expect(demoSource).toContain('"popover-dismiss-arm"');
    expect(demoSource).toContain("armContainedDemoOverlayDismissal");
    expect(editorControlsSource).not.toContain("demoTargetPrefix}-close");
  });

  test("reveals image actions before using the contracted image controls", () => {
    const card = demoSource.indexOf(
      '.highlight("first-image-card", revealHover)',
    );
    const settingsReveal = demoSource.indexOf(
      '.highlight("first-image-settings", revealHover)',
    );
    const settingsClick = demoSource.indexOf(".click(firstImageSettings");
    const pickerClick = demoSource.indexOf(".click(firstImagePicker");
    const blackClick = demoSource.indexOf(".click(firstImageBlack");
    const armClick = demoSource.indexOf(".click(popoverDismissArm");
    const closeClick = demoSource.indexOf(".click(editorCanvas");
    expect(card).toBeGreaterThan(-1);
    expect(settingsReveal).toBeGreaterThan(card);
    expect(settingsClick).toBeGreaterThan(settingsReveal);
    expect(pickerClick).toBeGreaterThan(settingsClick);
    expect(blackClick).toBeGreaterThan(pickerClick);
    expect(armClick).toBeGreaterThan(blackClick);
    expect(closeClick).toBeGreaterThan(armClick);
    expect(downloadUiSource).toContain(
      "[&:has([data-demo-hovered=true])]:opacity-100",
    );
  });

  test("uses readable pacing with no transition wait below 500ms", () => {
    for (const [name, minimum] of [
      ["initial", 900],
      ["reveal", 700],
      ["settle", 500],
      ["overlayOpen", 750],
      ["scroll", 900],
      ["beforePublish", 800],
    ] as const) {
      expect(demoSource).toContain(`${name}: ${minimum}`);
    }
    expect(demoSource).not.toMatch(/\.wait\(\d+\)/);
  });

  test("uses semantic editor surfaces", () => {
    expect(demoSource).not.toContain("bg-white");
    expect(demoSource).not.toContain("bg-black");
  });

  test("uses a viewport height rather than sizing the frame to portal content", () => {
    expect(demoSource).toContain("baseHeight={750}");
    expect(demoSource).not.toContain("baseHeight={1120}");
  });
});
