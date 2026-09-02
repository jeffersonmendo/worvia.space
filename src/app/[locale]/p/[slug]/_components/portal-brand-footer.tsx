"use client";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function PortalBrandFooter({
  brand,
  credit,
  styleMode = "auto",
}: {
  brand: string;
  credit: string;
  styleMode?: "auto" | "desktop" | "mobile";
}) {
  return (
    <footer
      className={cn(
        "flex justify-center",
        styleMode === "auto" && "lg:col-start-2",
        styleMode === "desktop" && "col-start-2",
      )}
    >
      <p className="text-sm text-muted-foreground">
        {credit}{" "}
        <Link
          className="underline underline-offset-4 transition-colors hover:text-blue-600"
          href="/"
        >
          {brand}
        </Link>
      </p>
    </footer>
  );
}
