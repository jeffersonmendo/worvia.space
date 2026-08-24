import { IconDownload, IconSpiral } from "@tabler/icons-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PaidUnlockButton } from "./paid-unlock-button";

export function PublicPortalShell({
  children,
  downloadHref,
  downloadLabel,
  purchaseAction,
}: {
  children: ReactNode;
  downloadHref?: string;
  downloadLabel: string;
  purchaseAction?: {
    label: string;
    locale: string;
    portalId: string;
    price: string | null;
    slug: string;
  };
}) {
  // biome-ignore lint/a11y/useAnchorContent: Base UI supplies the Button children while aria-label names the rendered anchor.
  const downloadLink = <a aria-label={downloadLabel} href={downloadHref} />;

  return (
    <div className="min-h-dvh pt-20 [--portal-sidebar-offset:5rem]">
      <header className="fixed top-2 left-1/2 z-40 flex w-[calc(100%-1rem)] max-w-[900px] -translate-x-1/2 items-center justify-between gap-4 rounded-3xl border border-border/50 bg-background/70 px-4 py-3 backdrop-blur-xl">
        <Link
          aria-label="Worvia"
          className="inline-flex items-center"
          href="/"
        >
          <IconSpiral aria-hidden="true" className="size-8 stroke-[1.5]" />
        </Link>
        {purchaseAction ? (
          <PaidUnlockButton
            compact
            label={purchaseAction.label}
            locale={purchaseAction.locale}
            portalId={purchaseAction.portalId}
            price={purchaseAction.price}
            slug={purchaseAction.slug}
          />
        ) : downloadHref ? (
          <Button
            aria-label={downloadLabel}
            nativeButton={false}
            render={downloadLink}
            variant="default"
          >
            <IconDownload data-icon="inline-start" />
            {downloadLabel}
          </Button>
        ) : (
          <Button aria-label={downloadLabel} disabled variant="default">
            <IconDownload data-icon="inline-start" />
            {downloadLabel}
          </Button>
        )}
      </header>
      {children}
    </div>
  );
}
