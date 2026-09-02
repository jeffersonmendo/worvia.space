import type { PortalFontItem } from "@/domain/portal/document";

export function fontFamilyFor(font: PortalFontItem) {
  return font.file_url ? `portal-font-${font.id}` : undefined;
}

export function fontFaceFor(font: PortalFontItem) {
  const family = fontFamilyFor(font);
  if (!family || !font.file_url) return null;
  const weight = font.weight ?? 400;
  return `@font-face { font-family: "${family}"; src: url("${font.file_url}"); font-weight: ${weight}; font-style: normal; font-display: swap; }`;
}

export function fontWeightLabel(font: PortalFontItem, fallback: string) {
  const persistedWeight = Number.parseInt(font.weights ?? "", 10);
  const weight =
    font.weight ?? (Number.isNaN(persistedWeight) ? 400 : persistedWeight);
  return `${weight} ${fallback}`;
}

export function fontWeightSpec(font: PortalFontItem, fallback: string) {
  return fontWeightLabel(font, fallback).toUpperCase();
}

const fontWeightMessageKeys = {
  100: "weights.100",
  200: "weights.200",
  300: "weights.300",
  400: "weights.400",
  500: "weights.500",
  600: "weights.600",
  700: "weights.700",
  800: "weights.800",
  900: "weights.900",
} as const;

export function fontWeightMessageKey(weight: number) {
  return fontWeightMessageKeys[weight as keyof typeof fontWeightMessageKeys];
}

export function groupedFonts(
  fonts: PortalFontItem[],
  undetectedFamily: string,
) {
  const groups = new Map<string, PortalFontItem[]>();
  for (const font of fonts.filter((item) => item.visible)) {
    const key = font.font_name || undetectedFamily;
    groups.set(key, [...(groups.get(key) ?? []), font]);
  }

  return Array.from(groups.entries())
    .map(([family, items]) => ({
      family,
      items: [...items].sort((a, b) => (b.weight ?? 400) - (a.weight ?? 400)),
    }))
    .sort((a, b) => a.family.localeCompare(b.family));
}

export function representativeFont(fonts: PortalFontItem[]) {
  return (
    fonts.find((font) => (font.weight ?? 400) === 400) ??
    [...fonts].sort((a, b) => (b.weight ?? 400) - (a.weight ?? 400))[0]
  );
}
