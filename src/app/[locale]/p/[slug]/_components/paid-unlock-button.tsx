"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PaidUnlockButton({
  locale,
  compact = false,
  label,
  portalId,
  price,
  slug,
}: {
  compact?: boolean;
  label?: string;
  locale: string;
  portalId: string;
  price: string | null;
  slug: string;
}) {
  const t = useTranslations("PublicPortal.preview");
  const [pending, setPending] = useState(false);
  return (
    <Button
      className={cn(
        compact
          ? "min-h-9 w-auto gap-1.5 px-2.5"
          : "min-h-12 w-full gap-2 px-5 py-3",
      )}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const response = await fetch("/api/billing/portal-purchase/checkout", {
          body: JSON.stringify({ locale, portalId }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }).catch(() => null);
        if (response?.status === 401) {
          window.location.assign(
            `/${locale}/auth/sign-in?next=${encodeURIComponent(`/${locale}/p/${slug}`)}`,
          );
          return;
        }
        const result = (await response?.json().catch(() => null)) as {
          checkoutUrl?: string;
        } | null;
        if (!response?.ok || !result?.checkoutUrl) {
          toast.error(t("checkoutUnavailable"));
          setPending(false);
          return;
        }
        window.location.assign(result.checkoutUrl);
      }}
      type="button"
    >
      {pending
        ? t("processing")
        : label || (
            <>
              <span>{t("unlock")}</span>
              <span aria-hidden="true">·</span>
              <span>{price || "—"}</span>
            </>
          )}
    </Button>
  );
}
