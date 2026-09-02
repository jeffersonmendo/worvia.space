import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  configPanelTargetKey,
  resetConfigPanelScroll,
} from "../../../../lib/portal/reset-config-panel-scroll";

const source = readFileSync(
  join(
    process.cwd(),
    "src/app/[locale]/(workspace)/_components/workspace-sidebar.tsx",
  ),
  "utf8",
);
const globalsSource = readFileSync(
  join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

describe("workspace AI workflow progress", () => {
  it("shows the current analysis batch in the sidebar", () => {
    expect(source).toContain("progressDetail");
    expect(source).toContain("aiBatchLabel");
  });

  it("exposes a cancel action for active AI workflows", () => {
    expect(source).toContain("SidebarMenuAction");
    expect(source).toContain("portal-ai-workflow-cancel");
    expect(source).toContain("aiCancelAction");
    expect(source).toContain('className="h-auto min-h-8 py-3"');
    expect(source).toContain('className="top-1/2! -translate-y-1/2!"');
  });
});

describe("workspace configuration sidebar", () => {
  it("distinguishes item configuration targets within the same section", () => {
    expect(
      configPanelTargetKey({
        itemId: "image-a",
        kind: "image",
        sectionId: "gallery-1",
      }),
    ).not.toBe(
      configPanelTargetKey({
        itemId: "image-b",
        kind: "image",
        sectionId: "gallery-1",
      }),
    );
  });

  it("uses a stable key for a section configuration target", () => {
    expect(
      configPanelTargetKey({ kind: "section", sectionId: "colors-1" }),
    ).toBe("section:colors-1");
  });

  it("resets the configuration scroll owner when a panel is opened or retargeted", () => {
    const scrollOwner = { scrollTop: 640 };

    resetConfigPanelScroll(scrollOwner);

    expect(scrollOwner.scrollTop).toBe(0);
  });

  it("does not require a mounted scroll owner while the configuration surface changes", () => {
    expect(() => resetConfigPanelScroll(null)).not.toThrow();
  });

  it("uses the official Base UI drawer primitive for mobile configuration", () => {
    expect(source).toContain('from "@/components/ui/drawer"');
    expect(source).toContain("<Drawer");
    expect(source).toContain('swipeDirection="down"');
    expect(source).toContain("showSwipeHandle");
    expect(source).toContain("<DrawerContent");
    expect(source).not.toContain('from "@/components/ui/sheet"');
    expect(globalsSource).toMatch(/body\s*\{[^}]*position:\s*relative;/);
  });

  it("pins the desktop surface to the viewport while reserving its layout width", () => {
    expect(source).toContain('collapsible="none"');
    expect(source).toContain(
      '"hidden shrink-0 transition-[width] duration-300 ease-out md:block"',
    );
    expect(source).toContain(
      'configSidebarOpen ? "w-(--sidebar-width)" : "w-0"',
    );
    expect(source).toContain(
      '"fixed inset-y-0 right-0 hidden h-svh w-(--sidebar-width) bg-transparent p-2 backdrop-blur-none md:flex"',
    );
    expect(source).not.toContain("sticky top-0");
    expect(source).toContain(
      'className="flex h-full flex-col rounded-3xl bg-sidebar/50 ring-1 ring-sidebar-border backdrop-blur-xl"',
    );
  });

  it("animates the desktop configuration surface on entry and exit", () => {
    expect(source).toContain(
      "const [configSidebarMounted, setConfigSidebarMounted] =",
    );
    expect(source).toContain("useState(configSidebarOpen)");
    expect(source).toContain(
      "if (configSidebarOpen) setConfigSidebarMounted(true)",
    );
    expect(source).toContain('"animate-in fade-in-0 slide-in-from-right-8');
    expect(source).toContain('"animate-out fade-out-0 slide-out-to-right-8');
    expect(source).toContain(
      "if (!configSidebarOpen) setConfigSidebarMounted(false)",
    );
    expect(source).not.toContain(
      "if (!configSidebarOpen || isMobile) return null;",
    );
  });

  it("makes each configuration surface host its own single scroll path", () => {
    expect(source).toContain(
      '<SidebarContent\n            className="min-h-0 flex-1 overflow-y-auto p-2"\n            ref={setConfigSidebarHost}',
    );
    expect(source).not.toContain('className="h-full min-h-0 overflow-hidden"');
    expect(source).toContain(
      'className="min-h-0 flex-1 overflow-y-auto"\n          ref={setConfigDrawerHost}',
    );
    expect(source).toContain(
      'className="h-[80dvh] overflow-hidden rounded-t-2xl p-0"',
    );
    expect(source).not.toContain('className="h-fit max-h-[80dvh]');
  });
});
