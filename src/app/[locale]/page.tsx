import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getLandingActionCopyKeys,
  getLandingActionHrefs,
} from "@/lib/landing/actions";
import { getLandingEntryHref } from "@/lib/landing/entry-route";
import { buildHomeMetadata } from "@/lib/public-metadata";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { PortalLanding } from "./_components/portal-landing";

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
  const user = hasSupabaseEnv()
    ? (await (await createClient()).auth.getUser()).data.user
    : null;
  const isAuthenticated = Boolean(user);
  const actionCopyKeys = getLandingActionCopyKeys(isAuthenticated);
  const entryHref = getLandingEntryHref(isAuthenticated);
  const actionHrefs = getLandingActionHrefs(entryHref);

  return (
    <PortalLanding
      buttonLabel={t(actionCopyKeys.primary)}
      description={t("description")}
      details={t.raw("details")}
      entryHref={entryHref}
      heroButtonLabel={t("cta")}
      headerCreateAccountHref={actionHrefs.create}
      headerCreateAccountLabel={t("header.createAccount")}
      headerEntryHref={actionHrefs.enter}
      headerEntryLabel={
        isAuthenticated ? t("header.enter") : t("header.signIn")
      }
      isAuthenticated={isAuthenticated}
      authenticatedUserName={user?.email ?? "Worvia"}
      title={[t("titleLine1"), t("titleLine2")]}
    />
  );
}
