"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

export default function PublicPortalLoading() {
  const t = useTranslations("PublicPortal.loading");

  return (
    <output
      aria-labelledby="public-portal-loading-label"
      className="flex min-h-dvh items-center justify-center bg-background"
    >
      <span className="sr-only" id="public-portal-loading-label">
        {t("label")}
      </span>
      <div className="flex w-full max-w-[900px] flex-col items-center gap-4 px-6">
        <Skeleton className="size-20 rounded-2xl" />
        <Skeleton className="h-5 w-36" />
      </div>
    </output>
  );
}
