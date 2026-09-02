"use client";

import type { ReactNode } from "react";
import {
  fontFamilyFor,
  fontWeightLabel,
  groupedFonts,
  representativeFont,
} from "@/application/portal/font-utils";
import type { PortalFontItem } from "@/domain/portal/document";
import { downloadControlClass } from "@/lib/portal/download-ui";
import { cn } from "@/lib/utils";

type PortalTypographyShowcaseProps = {
  alphabetSample: string;
  fonts: PortalFontItem[];
  familiesLabel: string;
  renderActions?: (font: PortalFontItem) => ReactNode;
  sampleLabels: string[];
  undetectedFamily: string;
  weightName: (weight: number) => string;
};

const semanticRoleWeights = [700, 700, 600, 600, 400, 400] as const;
const semanticRoleSizes = [
  "2.25rem",
  "2rem",
  "1.75rem",
  "1.5rem",
  "1.125rem",
  "0.875rem",
] as const;

function closestFontForWeight(fonts: PortalFontItem[], targetWeight: number) {
  return fonts.reduce((closest, font) => {
    const closestDistance = Math.abs((closest.weight ?? 400) - targetWeight);
    const distance = Math.abs((font.weight ?? 400) - targetWeight);
    return distance < closestDistance ? font : closest;
  });
}

const typographyFamilyPositions = new WeakMap<HTMLDetailsElement, number>();

type RevealTypographyFamilyOptions = {
  scrollBy?: (options: ScrollToOptions) => void;
};

export function rememberTypographyFamilyPosition(details: HTMLDetailsElement) {
  const summary = details.querySelector<HTMLElement>("summary");
  if (!summary) return;
  typographyFamilyPositions.set(details, summary.getBoundingClientRect().top);
}

export function revealOpenedTypographyFamily(
  details: HTMLDetailsElement,
  {
    scrollBy = (options) => window.scrollBy(options),
  }: RevealTypographyFamilyOptions = {},
) {
  if (!details.open) {
    typographyFamilyPositions.delete(details);
    return;
  }
  const summary = details.querySelector<HTMLElement>("summary");
  if (!summary) return;

  summary.focus({ preventScroll: true });
  const previousTop = typographyFamilyPositions.get(details);
  typographyFamilyPositions.delete(details);
  if (previousTop === undefined) {
    summary.scrollIntoView({ behavior: "auto", block: "start" });
    return;
  }

  const offset = summary.getBoundingClientRect().top - previousTop;
  if (offset !== 0) {
    scrollBy({
      behavior: "auto",
      top: offset,
    });
  }
}

export function PortalTypographyShowcase({
  alphabetSample,
  fonts,
  familiesLabel,
  renderActions,
  sampleLabels,
  undetectedFamily,
  weightName,
}: PortalTypographyShowcaseProps) {
  const groups = groupedFonts(fonts, undetectedFamily);
  if (!groups.length) return null;

  return (
    <section className="flex flex-col gap-4" aria-label={familiesLabel}>
      {groups.map((group) => {
        const representative = representativeFont(group.items);
        if (!representative) return null;
        const family = fontFamilyFor(representative);
        const seenWeightLabels = new Set<string>();
        const summaryWeights = group.items
          .map((font) => ({
            font,
            label: weightName(font.weight ?? 400).trim(),
          }))
          .filter(({ label }) => {
            const normalizedLabel = label.replace(/\s+/g, " ").toLowerCase();
            if (seenWeightLabels.has(normalizedLabel)) return false;
            seenWeightLabels.add(normalizedLabel);
            return true;
          })
          .slice(0, 5);
        const semanticRows = sampleLabels.map((label, index) => ({
          font: closestFontForWeight(
            group.items,
            semanticRoleWeights[index] ?? 400,
          ),
          label,
        }));
        return (
          <div
            className="group/item relative"
            data-slot="typography-family"
            key={group.family}
          >
            {renderActions ? (
              <div
                className={cn(
                  "absolute top-5 right-1 flex justify-end",
                  downloadControlClass("item"),
                )}
                data-slot="typography-family-actions"
              >
                {renderActions(representative)}
              </div>
            ) : null}
            <details
              className="w-full"
              name="typography-families"
              onToggle={(event) =>
                revealOpenedTypographyFamily(event.currentTarget)
              }
            >
              {/* biome-ignore lint/a11y/noStaticElementInteractions: summary is the native disclosure control; click captures its pre-toggle viewport anchor. */}
              <summary
                className="cursor-pointer list-none px-1 py-5 pr-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:pr-1 group-data-[style-mode=desktop]/portal:pr-1! group-data-[style-mode=mobile]/portal:pr-20! [&::-webkit-details-marker]:hidden"
                onClick={(event) => {
                  const details = event.currentTarget.closest("details");
                  if (details) rememberTypographyFamilyPosition(details);
                }}
              >
                <span className="grid w-full gap-5 sm:grid-cols-[minmax(8rem,0.8fr)_minmax(0,2fr)] group-data-[style-mode=desktop]/portal:grid-cols-[minmax(8rem,0.8fr)_minmax(0,2fr)]! group-data-[style-mode=mobile]/portal:grid-cols-1!">
                  <span
                    aria-hidden="true"
                    className="self-center text-7xl leading-none sm:text-8xl group-data-[style-mode=desktop]/portal:text-8xl! group-data-[style-mode=mobile]/portal:text-7xl!"
                    style={family ? { fontFamily: `"${family}"` } : undefined}
                  >
                    Aa
                  </span>
                  <span
                    className="flex min-w-0 flex-col justify-center gap-4"
                    style={family ? { fontFamily: `"${family}"` } : undefined}
                  >
                    <span className="text-2xl text-foreground">
                      {group.family}
                    </span>
                    <span className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground text-sm">
                      {summaryWeights.map(({ font, label }) => (
                        <span
                          key={font.id}
                          style={{
                            fontFamily: fontFamilyFor(font)
                              ? `"${fontFamilyFor(font)}"`
                              : undefined,
                            fontWeight: font.weight,
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </span>
                    <span className="text-muted-foreground text-base leading-relaxed">
                      {alphabetSample}
                    </span>
                  </span>
                </span>
              </summary>
              <div className="px-1 pb-6" data-slot="typography-family-panel">
                <div className="flex flex-col gap-5">
                  {semanticRows.map(({ font, label }, index) => {
                    const family = fontFamilyFor(font);

                    return (
                      <div
                        className="grid items-baseline gap-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] group-data-[style-mode=desktop]/portal:grid-cols-[minmax(0,1fr)_auto]! group-data-[style-mode=mobile]/portal:grid-cols-1!"
                        data-slot="typography-style-row"
                        key={`${group.family}-${label}`}
                      >
                        <p
                          className="min-w-0 tracking-tight"
                          style={{
                            fontFamily: family ? `"${family}"` : undefined,
                            fontSize:
                              semanticRoleSizes[index] ??
                              semanticRoleSizes.at(-1),
                            fontWeight: font.weight,
                          }}
                        >
                          {label}
                        </p>
                        <span className="text-muted-foreground text-xs uppercase">
                          {fontWeightLabel(
                            font,
                            weightName(font.weight ?? 400),
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
          </div>
        );
      })}
    </section>
  );
}
