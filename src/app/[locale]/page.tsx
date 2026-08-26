import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PortalLanding } from "@/components/landing/portal-landing";
import { getLandingActionCopyKeys } from "@/lib/landing/actions";
import { getLandingEntryHref } from "@/lib/landing/entry-route";
import { buildHomeMetadata } from "@/lib/public-metadata";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Landing" });

  return buildHomeMetadata({
    description: t("description"),
    locale,
    title: `${t("titleLine1")} ${t("titleLine2")}`,
  });
}

export default async function Home({ params }: Props) {
  const { locale } = await params;

  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "Landing" });
  const isAuthenticated = hasSupabaseEnv()
    ? Boolean((await (await createClient()).auth.getUser()).data.user)
    : false;
  const actionCopyKeys = getLandingActionCopyKeys(isAuthenticated);

  return (
    <PortalLanding
      buttonLabel={t(actionCopyKeys.primary)}
      description={t("description")}
      details={t.raw("details")}
      entryHref={getLandingEntryHref(isAuthenticated)}
      heroButtonLabel={t("cta")}
      headerCreateAccountLabel={t("header.createAccount")}
      headerEntryLabel={t("header.signIn")}
      title={[t("titleLine1"), t("titleLine2")]}
    />
  );
}
