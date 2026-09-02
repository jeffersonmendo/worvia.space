"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import type { PortalDocument } from "@/domain/portal/document";
import { cn } from "@/lib/utils";

export function PortalSidebarView({
  footer,
  sectionIds,
  sections,
}: {
  footer?: ReactNode;
  sectionIds: string[];
  sections: PortalDocument["sections"];
}) {
  const t = useTranslations("PortalViewer.sectionTypes");
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top) -
              Math.abs(b.boundingClientRect.top),
          )[0];
        if (visibleEntry?.target.id) setActiveId(visibleEntry.target.id);
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 },
    );

    for (const id of sectionIds) {
      const element = window.document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [sectionIds]);

  return (
    <nav className="flex h-full min-h-0 flex-col gap-1 text-muted-foreground text-sm">
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {sections.map((section) => (
          <a
            className={cn(
              "flex items-center gap-2 rounded-md py-1.5 hover:text-foreground",
              activeId === section.id && "text-primary",
            )}
            href={`#${section.id}`}
            key={section.id}
          >
            <div className="flex items-center">
              <div className="min-w-0 flex-1 truncate px-2 first-letter:uppercase">
                {section.title || t(section.type)}
              </div>
            </div>
          </a>
        ))}
      </div>
      {footer ? (
        <div className="mt-auto flex flex-col gap-1">{footer}</div>
      ) : null}
    </nav>
  );
}
