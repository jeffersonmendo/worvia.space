import { describe, expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./portal-editor-shell.tsx", import.meta.url),
).text();
const chromeSource = await Bun.file(
  new URL(
    "../../../components/portal/portal-workspace-chrome.ts",
    import.meta.url,
  ),
).text();
const sidebarPrimitiveSource = await Bun.file(
  new URL("../../../components/ui/sidebar.tsx", import.meta.url),
).text();
const productionToolbarSource = await Bun.file(
  new URL(
    "../(workspace)/_components/portal-workspace-toolbar.tsx",
    import.meta.url,
  ),
).text();

describe("PortalEditorShell", () => {
  test("uses a desktop-only composition with no responsive mobile branches", () => {
    expect(source).not.toMatch(/(?:sm|md|lg|xl):/);
    expect(source).not.toContain("<SidebarTrigger");
    expect(source).toContain('collapsible="icon"');
    expect(source).toContain("desktopOnly");
  });

  test("composes the production sidebar primitives including its footer", () => {
    expect(source).toContain("<SidebarProvider");
    expect(source).toContain('variant="floating"');
    expect(source).toContain("<SidebarMenuButton");
    expect(source).toContain("<SidebarFooter>");
    expect(source).toContain("Jefferson Lopez Mendoza");
    expect(source).toContain('collapsible="icon"');
    expect(source).toContain("desktopOnly");
  });

  test("uses the shared header geometry for viewport and inset containing blocks", () => {
    expect(chromeSource).toContain("WORKSPACE_HEADER_POSITION_CLASS");
    expect(chromeSource).toContain("viewport:");
    expect(chromeSource).toContain(
      '"fixed top-2 right-[var(--portal-right-sidebar-width,0.5rem)] left-2 pl-2 lg:left-[calc(var(--sidebar-offset))]"',
    );
    expect(chromeSource).toContain('inset: "absolute top-2 right-2 left-0"');
    expect(productionToolbarSource).toContain(
      "WORKSPACE_HEADER_POSITION_CLASS.viewport",
    );
    expect(productionToolbarSource).not.toContain(
      'right: "calc(var(--portal-right-sidebar-width, 0px) + 0.5rem)"',
    );
    expect(source).toContain("WORKSPACE_HEADER_POSITION_CLASS.inset");
    expect(source).not.toContain("absolute top-2 right-2 left-2");
    expect(source).toContain("WORKSPACE_EMBEDDED_HEADER_CANVAS_OFFSET_CLASS");
    expect(chromeSource).toContain(
      'WORKSPACE_EMBEDDED_HEADER_CANVAS_OFFSET_CLASS = "pt-20"',
    );
    expect(source).toContain('"absolute bottom-6 left-1/2"');
  });

  test("keeps editor chrome aligned to the sidebar inset", () => {
    expect(source).toContain("<SidebarInset");
    expect(source).toContain("ml-0!");
    expect(source).not.toContain("ml-[var(--sidebar-width)]!");
    expect(source).toContain("WORKSPACE_HEADER_POSITION_CLASS.inset");
    expect(chromeSource).toContain('inset: "absolute top-2 right-2 left-0"');
    expect(source).not.toContain("<SidebarTrigger");
    expect(source).toContain("workspaceHeaderClass");
    expect(chromeSource).toContain("bg-sidebar/70");
  });

  test("reuses the production floating sidebar geometry without divergent shell tokens", () => {
    expect(source).toContain('variant="floating"');
    expect(source).toContain('className="absolute! inset-y-0! h-full!');
    expect(source).toContain("[&_[data-slot=sidebar-inner]]:shadow-none");
    expect(source).not.toContain(
      "border-sidebar-border bg-sidebar/50 shadow-sm",
    );
    expect(sidebarPrimitiveSource).toContain(
      'variant === "floating" || variant === "inset"',
    );
    expect(sidebarPrimitiveSource).toContain(
      "group-data-[variant=floating]:rounded-3xl",
    );
    expect(sidebarPrimitiveSource).toContain(
      "group-data-[variant=floating]:ring-sidebar-border",
    );
  });

  test("bounds the chrome to the demo viewport while only portal content scrolls", () => {
    expect(source).toContain(
      'className="relative h-full min-h-0! overflow-hidden',
    );
    expect(source).toContain(
      '<SidebarInset className="ml-0! mr-0 h-full min-h-0 min-w-0 overflow-hidden bg-background">',
    );
    expect(source).toContain('"min-h-0 flex-1 overflow-y-auto"');
    expect(source).toContain("WORKSPACE_EMBEDDED_HEADER_CANVAS_OFFSET_CLASS");
  });

  test("matches the production credit, publish, and bottom toolbar controls", () => {
    expect(source).toContain("<IconCoinFilled");
    expect(source).toContain("<Badge");
    expect(source).toContain("rounded-full");
    expect(source).toContain('aria-label={t("openPublication")}');
    expect(source).toContain("IconExternalLink");
    expect(source).toContain("WORKSPACE_BOTTOM_TOOLBAR_SURFACE_CLASS");
    expect(source).toContain("bottom-6");
    expect(source).not.toMatch(/(?:sm|md|lg|xl):/);
  });
});
