import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getConnectStatusSummary } from "@/infrastructure/portal/workspace-read-models";
import { isStripeConnectCountry } from "@/lib/billing/connect-countries";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  ConnectAccountDialog,
  type PortalHomeCopy,
} from "../_components/portal-home";
import { PortalWorkspaceToolbar } from "../_components/portal-workspace-toolbar";

export default async function StripeConnectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasSupabaseEnv()) redirect(`/${locale}/home`);

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/${locale}/auth/sign-in`);
  const persistedStatus = (await getConnectStatusSummary(supabase)) as Record<
    string,
    unknown
  >;
  const initialStatus = {
    accountExists: persistedStatus.accountExists === true,
    accountId:
      typeof persistedStatus.accountId === "string"
        ? persistedStatus.accountId
        : undefined,
    chargesEnabled: persistedStatus.chargesEnabled === true,
    connected: persistedStatus.connected === true,
    accountEmail:
      typeof persistedStatus.accountEmail === "string"
        ? persistedStatus.accountEmail
        : null,
    detailsSubmitted: persistedStatus.detailsSubmitted === true,
    country:
      typeof persistedStatus.country === "string"
        ? persistedStatus.country
        : null,
    displayName:
      typeof persistedStatus.displayName === "string"
        ? persistedStatus.displayName
        : null,
    requirementsPending:
      typeof persistedStatus.requirementsPending === "number"
        ? persistedStatus.requirementsPending
        : 0,
    payoutsEnabled: persistedStatus.payoutsEnabled === true,
    verificationState: persistedStatus.verificationState as
      | "active"
      | "needs_information"
      | "not_started"
      | "processing",
    lastSyncedAt:
      typeof persistedStatus.lastSyncedAt === "string"
        ? persistedStatus.lastSyncedAt
        : null,
    needsSync: persistedStatus.needsSync === true,
  };

  const vercelCountry = (await headers()).get("x-vercel-ip-country");
  const recommendedCountry = vercelCountry?.toUpperCase();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Home" });
  const copy: PortalHomeCopy["connect"] = {
    active: t("connect.active"),
    activeDescription: t("connect.activeDescription"),
    accountId: t("connect.accountId"),
    accountEmail: t("connect.accountEmail"),
    detailsSubmitted: t("connect.detailsSubmitted"),
    charges: t("connect.charges"),
    configure: t("connect.configure"),
    country: t("connect.country"),
    countryHelp: t("connect.countryHelp"),
    emailRecommendation: t("connect.emailRecommendation"),
    countryRecommended: t("connect.countryRecommended"),
    countrySearch: t("connect.countrySearch"),
    countryNoResults: t("connect.countryNoResults"),
    inactiveDescription: t("connect.inactiveDescription"),
    inactiveTitle: t("connect.inactiveTitle"),
    edit: t("connect.edit"),
    error: t("connect.error"),
    inactive: t("connect.inactive"),
    profile: t("connect.profile"),
    activeShort: t("connect.activeShort"),
    status: t("connect.status"),
    payouts: t("connect.payouts"),
    dashboard: t("connect.dashboard"),
    activeTitle: t("connect.activeTitle"),
    processing: t("connect.processing"),
    needsInformation: t("connect.needsInformation"),
    requirementsPending: t.raw("connect.requirementsPending") as string,
    verification: t("connect.verification"),
    verificationActive: t("connect.verificationActive"),
    verificationNeedsInformation: t("connect.verificationNeedsInformation"),
    verificationProcessing: t("connect.verificationProcessing"),
    verificationNotStarted: t("connect.verificationNotStarted"),
    continue: t("connect.continue"),
    loading: t("connect.loading"),
    trigger: t("connect.trigger"),
  };

  return (
    <div className="min-h-dvh bg-background">
      <PortalWorkspaceToolbar mode="connect" />
      <main className="mx-auto flex min-w-0 w-full max-w-[calc(900px-240px-2rem)] px-4 pb-24 md:px-6">
        <Card className="min-w-0 w-full overflow-visible border-0 bg-transparent shadow-none ring-0">
          <CardHeader className="px-0">
            <CardTitle>{t("connect.trigger")}</CardTitle>
            <CardDescription>
              {t("connect.inactiveDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ConnectAccountDialog
              copy={copy}
              locale={locale}
              portalId={null}
              recommendedCountry={
                recommendedCountry && isStripeConnectCountry(recommendedCountry)
                  ? recommendedCountry
                  : null
              }
              shouldOpen={false}
              standalone
              initialStatus={initialStatus}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
