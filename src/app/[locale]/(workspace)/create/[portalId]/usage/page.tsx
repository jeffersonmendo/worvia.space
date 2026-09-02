import { setRequestLocale } from "next-intl/server";
import { PortalPlanProvider } from "@/components/portal/portal-plan-provider";
import { getPortalUsageSummary } from "@/infrastructure/portal/workspace-read-models";
import type { PortalPlan } from "@/lib/billing/portal-policy";
import { PORTAL_PLANS } from "@/lib/billing/portal-policy";
import { createClient } from "@/lib/supabase/server";
import { PortalWorkspaceToolbar } from "../../../_components/portal-workspace-toolbar";
import { WorkspaceProjectRegistration } from "../../../_components/workspace-sidebar";
import { UsageView } from "./_components/usage-view";

export default async function PortalUsageRoute({
  params,
}: {
  params: Promise<{ locale: string; portalId: string }>;
}) {
  const { locale, portalId } = await params;
  setRequestLocale(locale);
  const supabase = await createClient();
  const summary = (await getPortalUsageSummary(supabase, portalId)) as Record<
    string,
    unknown
  >;
  const portal = summary.portal as { id: string; name: string; slug: string };
  const plan: PortalPlan =
    summary.plan === "starter" ||
    summary.plan === "pro" ||
    summary.plan === "premium"
      ? summary.plan
      : "free";
  const canPurchase = summary.canPurchase === true || summary.isOwner === true;
  const initialSnapshot = {
    available: true,
    canPurchase,
    entitlementStatus: null,
    plan,
    policy: PORTAL_PLANS[plan],
    storageUsedBytes: Number(summary.storageUsedBytes ?? 0),
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
        <UsageView summary={summary} />
      </main>
    </PortalPlanProvider>
  );
}
