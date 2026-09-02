import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PortalStyleMode } from "./portal-project-types";

export function PortalShell({
  children,
  className,
  sidebar,
  styleMode = "auto",
}: {
  children: ReactNode;
  className?: string;
  sidebar?: ReactNode;
  styleMode?: PortalStyleMode;
}) {
  return (
    <main
      className={cn(
        "group/portal flex justify-center min-h-0 bg-background text-foreground",
        className,
      )}
      data-style-mode={styleMode}
    >
      <div
        className={cn(
          "mx-auto flex flex-col items-center justify-center w-full gap-8 px-6 py-8",
          sidebar
            ? cn(
                "max-w-225",
                styleMode === "auto" &&
                  "lg:grid lg:grid-cols-[240px_1fr] lg:justify-items-center",
                styleMode === "desktop" &&
                  "grid grid-cols-[240px_1fr] justify-items-center",
              )
            : cn(
                "max-w-225",
                styleMode === "auto" &&
                  "lg:max-w-[calc(900px-240px-2rem)] flex justify-center",
                styleMode === "desktop" && "max-w-[calc(900px-240px-2rem)]",
              ),
        )}
      >
        {sidebar ? (
          <aside
            className={cn(
              "min-h-0",
              styleMode === "auto" && "hidden lg:block",
              styleMode === "desktop" ? "block" : "hidden",
            )}
          >
            <div className="fixed top-[calc(var(--portal-sidebar-offset,2rem)+2rem)] bottom-8 left-[max(1.5rem,calc((100vw-900px)/2))] w-60">
              {sidebar}
            </div>
          </aside>
        ) : null}
        {children}
      </div>
    </main>
  );
}
