import { setRequestLocale } from "next-intl/server";
import { PortalPlanProvider } from "@/components/portal/portal-plan-provider";
import type { PortalPlan } from "@/lib/billing/portal-policy";
import { PORTAL_PLANS } from "@/lib/billing/portal-policy";
import { getWorkspacePortal } from "@/lib/portal/workspace-portal";
import { PortalWorkspaceToolbar } from "../../../_components/portal-workspace-toolbar";
import { WorkspaceProjectRegistration } from "../../../_components/workspace-sidebar";
import { SettingsView } from "./_components/settings-view";

export default async function PortalSettingsRoute({
  params,
}: {
  params: Promise<{ locale: string; portalId: string }>;
}) {
  const { locale, portalId } = await params;
  setRequestLocale(locale);
  const {
    canPurchase,
    connectStatus,
    hasPortalPurchase,
    paidPriceCents,
    plan,
    portal,
  } = await getWorkspacePortal(locale, portalId);
  const normalizedPlan: PortalPlan =
    plan === "starter" || plan === "pro" || plan === "premium" ? plan : "free";
  const initialSnapshot = {
    available: true,
    canPurchase,
    entitlementStatus: normalizedPlan === "free" ? null : ("active" as const),
    plan: normalizedPlan,
    policy: PORTAL_PLANS[normalizedPlan],
    storageUsedBytes: 0,
  };
  return (
    <PortalPlanProvider
      initialSnapshot={initialSnapshot}
      locale={locale}
      portalId={portal.id}
    >
      <WorkspaceProjectRegistration
        project={{ id: portal.id, name: portal.name }}
      />
      <PortalWorkspaceToolbar
        backHref={`/create/${portal.id}`}
        contentOnly
        portalSlug={portal.slug}
      />
      <main className="mx-auto flex min-w-0 w-full max-w-[calc(900px-240px-2rem)] px-4 pb-24 md:px-6">
        <SettingsView
          initialConnectReady={connectStatus.connected}
          initialPaidPriceCents={paidPriceCents}
          hasPortalPurchase={hasPortalPurchase}
          locale={locale}
          portal={portal}
        />
      </main>
    </PortalPlanProvider>
  );
}
