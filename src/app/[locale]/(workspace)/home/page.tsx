import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isStripeConnectCountry } from "@/lib/billing/connect-countries";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getHomePortals } from "../../_actions/portals";
import { PortalHome } from "../_components/portal-home";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ connect?: string; portalId?: string }>;
};

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  const portalId =
    query?.portalId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      query.portalId,
    )
      ? query.portalId
      : null;
  const vercelCountry = (await headers()).get("x-vercel-ip-country");
  const recommendedCountry = vercelCountry?.toUpperCase();
  const backendEnabled = hasSupabaseEnv();

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Home" });
  const initialResult = backendEnabled
    ? await getHomePortals(locale)
    : { error: null, portals: [] };

  return (
    <PortalHome
      backendEnabled={backendEnabled}
      copy={{
        authRequired: t("authRequired"),
        backendDisabled: {
          description: t("backendDisabled.description"),
          title: t("backendDisabled.title"),
        },
        create: {
          description: t("create.description"),
          nameLabel: t("create.nameLabel"),
          namePlaceholder: t("create.namePlaceholder"),
          visibilityDescription: t("create.visibilityDescription"),
          visibilityLabel: t("create.visibilityLabel"),
          visibilityPrivate: t("create.visibilityPrivate"),
          visibilityPublic: t("create.visibilityPublic"),
          submit: t("create.submit"),
          title: t("create.title"),
          stepProject: t("create.stepProject"),
          stepFiles: t("create.stepFiles"),
          stepReview: t("create.stepReview"),
          descriptionLabel: t("create.descriptionLabel"),
          descriptionPlaceholder: t("create.descriptionPlaceholder"),
          languageLabel: t("create.languageLabel"),
          toneLabel: t("create.toneLabel"),
          toneProfessional: t("create.toneProfessional"),
          toneEditorial: t("create.toneEditorial"),
          toneMinimal: t("create.toneMinimal"),
          colorsLabel: t("create.colorsLabel"),
          preferencesLabel: t("create.preferencesLabel"),
          filesLabel: t("create.filesLabel"),
          filesDescription: t("create.filesDescription"),
          fileDescriptionPlaceholder: t("create.fileDescriptionPlaceholder"),
          back: t("create.back"),
          next: t("create.next"),
          review: t("create.review"),
        },
        connect: {
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
          verificationNeedsInformation: t(
            "connect.verificationNeedsInformation",
          ),
          verificationProcessing: t("connect.verificationProcessing"),
          verificationNotStarted: t("connect.verificationNotStarted"),
          continue: t("connect.continue"),
          loading: t("connect.loading"),
          trigger: t("connect.trigger"),
        },
        delete: {
          cancel: t("delete.cancel"),
          confirm: t("delete.confirm"),
          deleting: t("delete.deleting"),
          description: t.raw("delete.description") as string,
          paidProtected: t("delete.paidProtected"),
          phraseLabel: t("delete.phraseLabel"),
          phrasePlaceholder: t("delete.phrasePlaceholder"),
          slugLabel: t("delete.slugLabel"),
          slugInstruction: t.raw("delete.slugInstruction") as string,
          slugPlaceholder: t("delete.slugPlaceholder"),
          title: t.raw("delete.title") as string,
          trigger: t.raw("delete.trigger") as string,
        },
        empty: {
          description: t("empty.description"),
          title: t("empty.title"),
        },
        errorGeneric: t("errorGeneric"),
        header: {
          createPortal: t("header.createPortal"),
          signOut: t("header.signOut"),
        },
        searchPlaceholder: t("searchPlaceholder"),
        searchClearLabel: t("searchClearLabel"),
        portal: {
          favorite: {
            add: t("portal.favorite.add"),
            remove: t("portal.favorite.remove"),
            saveError: t("portal.favorite.saveError"),
          },
          edit: t("portal.edit"),
          lastEdited: t("portal.lastEdited"),
          fileTypesLabel: t("portal.fileTypesLabel"),
          colorsLabel: t("portal.colorsLabel"),
          noFiles: t("portal.noFiles"),
          noColors: t("portal.noColors"),
          imagesLabel: t("portal.imagesLabel"),
          noImages: t("portal.noImages"),
          usage: t("portal.usage"),
          view: t("portal.view"),
          purchasedAt: t("portal.purchasedAt"),
          plan: {
            free: t("portal.plan.free"),
            starter: t("portal.plan.starter"),
            pro: t("portal.plan.pro"),
            premium: t("portal.plan.premium"),
          },
          visibility: {
            paid: t("portal.visibility.paid"),
            password: t("portal.visibility.password"),
            private: t("portal.visibility.private"),
            public: t("portal.visibility.public"),
            purchased: t("portal.visibility.purchased"),
          },
        },
        settings: {
          description: t("settings.description"),
          nameLabel: t("settings.nameLabel"),
          save: t("settings.save"),
          slugLabel: t("settings.slugLabel"),
          title: t.raw("settings.title") as string,
          trigger: t.raw("settings.trigger") as string,
        },
      }}
      connectIntent={{
        open: query?.connect === "onboarding",
        portalId,
      }}
      initialError={initialResult.error ? t("errorGeneric") : null}
      initialPortals={initialResult.portals}
      locale={locale}
      recommendedCountry={
        recommendedCountry && isStripeConnectCountry(recommendedCountry)
          ? recommendedCountry
          : null
      }
    />
  );
}
