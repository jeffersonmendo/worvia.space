"use client";

import { IconMoon, IconPackageExport } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import type { PortalDocument } from "@/domain/portal/document";
import { PortalSidebarView } from "./portal-sidebar-view";

export function PortalDocumentSidebarReadOnly({
  exportHref,
  sectionIds,
  sections,
}: {
  exportHref?: string;
  sectionIds: string[];
  sections: PortalDocument["sections"];
}) {
  const t = useTranslations("PortalViewer.sidebar");
  const { resolvedTheme, setTheme } = useTheme();
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <PortalSidebarView
      sectionIds={sectionIds}
      sections={sections}
      footer={
        <>
          <button
            className="flex items-center gap-2 rounded-md py-1.5 hover:text-foreground"
            onClick={() => setTheme(nextTheme)}
            type="button"
          >
            <div className="flex items-center">
              <span className="ml-3 flex shrink-0 items-center justify-center">
                <IconMoon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 truncate px-2 first-letter:uppercase">
                {t("theme")}
              </div>
            </div>
          </button>
          {exportHref ? (
            <a
              className="flex items-center gap-2 rounded-md py-1.5 hover:text-foreground"
              download
              href={exportHref}
            >
              <div className="flex items-center">
                <span className="ml-3 flex shrink-0 items-center justify-center">
                  <IconPackageExport className="size-4" />
                </span>
                <div className="min-w-0 flex-1 truncate px-2 first-letter:uppercase">
                  {t("exportAssets")}
                </div>
              </div>
            </a>
          ) : null}
        </>
      }
    />
  );
}
