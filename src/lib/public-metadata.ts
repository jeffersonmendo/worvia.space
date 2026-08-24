import type { Metadata } from "next";
import type { PortalAccessDecision } from "@/lib/portal/access";

export const SITE_NAME = "Worvia";
export const OPEN_GRAPH_SIZE = { height: 630, width: 1200 } as const;

type PortalSharePresentation = {
  description: string;
  indexable: boolean;
  title: string;
};

export function resolvePortalSharePresentation({
  decision,
  fallback,
  portal,
}: {
  decision: PortalAccessDecision;
  fallback: Omit<PortalSharePresentation, "indexable">;
  portal?: {
    description: string | null;
    fallbackDescription: string;
    name: string;
  } | null;
}): PortalSharePresentation {
  if (decision === "preview_required" && portal) {
    return {
      description: portal.description || portal.fallbackDescription,
      indexable: false,
      title: portal.name,
    };
  }

  if (decision !== "allowed" || !portal) {
    return { ...fallback, indexable: false };
  }

  return {
    description: portal.description || portal.fallbackDescription,
    indexable: true,
    title: portal.name,
  };
}

type HomeMetadataInput = {
  description: string;
  locale: string;
  title: string;
};

type PortalMetadataInput = {
  description: string;
  locale: string;
  name: string;
  slug: string;
};

function socialLocale(locale: string) {
  return locale === "es" ? "es_ES" : "en_US";
}

function buildMetadata({
  description,
  image,
  locale,
  path,
  title,
}: {
  description: string;
  image: string;
  locale: string;
  path: string;
  title: string;
}): Metadata {
  const images = [
    {
      alt: title,
      ...OPEN_GRAPH_SIZE,
      url: image,
    },
  ];

  return {
    alternates: { canonical: path },
    description,
    openGraph: {
      description,
      images,
      locale: socialLocale(locale),
      siteName: SITE_NAME,
      title,
      type: "website",
      url: path,
    },
    title,
    twitter: {
      card: "summary_large_image",
      description,
      images: [image],
      title,
    },
  };
}

export function getSiteUrl(configuredUrl?: string) {
  const value = configuredUrl?.trim();
  if (!value) return new URL("http://localhost:3000");
  return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
}

export function buildHomeMetadata({
  description,
  locale,
  title,
}: HomeMetadataInput): Metadata {
  const socialTitle = `${title} | ${SITE_NAME}`;
  const path = `/${locale}`;
  return buildMetadata({
    description,
    image: `${path}/opengraph-image`,
    locale,
    path,
    title: socialTitle,
  });
}

export function buildPortalMetadata({
  description,
  locale,
  name,
  slug,
}: PortalMetadataInput): Metadata {
  const title = `${name} | ${SITE_NAME}`;
  const path = `/${locale}/p/${encodeURIComponent(slug)}`;
  return buildMetadata({
    description,
    image: `${path}/opengraph-image`,
    locale,
    path,
    title,
  });
}
