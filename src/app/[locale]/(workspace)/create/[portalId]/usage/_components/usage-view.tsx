"use client";

import { IconPlus } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { usePortalPlan } from "@/components/portal/portal-plan-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PortalSectionType } from "@/domain/portal/document";
import {
  storagePercent,
  storageUsageState,
} from "@/lib/billing/portal-plan-client";

const sectionTypes = [
  "text",
  "image",
  "gallery",
  "colors",
  "fonts",
  "files",
] as const satisfies readonly PortalSectionType[];

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes ? 1 : 0)} MB`;
}

export function UsageView({ summary }: { summary: Record<string, unknown> }) {
  const t = useTranslations("PortalEditor.plan");
  const { plan, requestUpgrade, snapshot, status } = usePortalPlan();
  const percent = storagePercent(
    snapshot.storageUsedBytes,
    snapshot.policy.storageBytes,
  );
  const state = storageUsageState(percent);
  const used = formatBytes(snapshot.storageUsedBytes);
  const limit = formatBytes(snapshot.policy.storageBytes);
  const sectionUsage = (summary.sections ?? {}) as Record<
    string,
    { sections?: number; items?: number }
  >;
  const totalSections = Number(
    (sectionUsage as Record<string, unknown>).total ?? 0,
  );
  const totalSectionsLimit = snapshot.policy.totalSections;
  const totalSectionsLabel = Number.isFinite(totalSectionsLimit)
    ? String(totalSectionsLimit)
    : t("unlimited");
  const passwordAllowed = plan !== "free";

  return (
    <div className="flex w-full min-w-0 flex-col gap-10">
      <Card className="min-w-0 w-full overflow-visible border-0 bg-transparent shadow-none ring-0">
        <CardHeader className="px-0">
          <CardTitle>{t("usageTitle")}</CardTitle>
          <CardDescription>{t("usageDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-sm">
              {t("currentPlan")}
            </span>
            <Badge>{t(plan)}</Badge>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {t(`storageLabels.${plan}`)}
            </span>
            <span className="font-medium tabular-nums">
              {used} / {limit}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {t(`usageStates.${state}`)}
            </span>
            <span className="font-medium tabular-nums">
              {status === "ready" ? `${Math.round(percent)}%` : t("loading")}
            </span>
          </div>
          {plan === "free" ? (
            <Button
              className="self-start"
              onClick={() => requestUpgrade("upgrade_info")}
              type="button"
              variant="default"
            >
              <IconPlus data-icon="inline-start" />
              {t("upgradeAction")}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="min-w-0 w-full overflow-visible border-0 bg-transparent shadow-none ring-0">
        <CardHeader className="px-0">
          <CardTitle>{t("limitsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 px-0">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{t("totalSections")}</span>
            <span className="font-medium tabular-nums">
              {Number.isFinite(totalSectionsLimit)
                ? `${totalSections} / ${totalSectionsLabel}`
                : totalSections}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{t("maxUpload")}</span>
            <span className="font-medium tabular-nums">
              {formatBytes(snapshot.policy.maxUploadBytes)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {t("passwordProtection")}
            </span>
            <Badge variant={passwordAllowed ? "default" : "secondary"}>
              {passwordAllowed ? t("allowed") : t("notAllowed")}
            </Badge>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="font-medium text-sm">{t("sectionUsage")}</h3>
            <div className="flex flex-col gap-2">
              {sectionTypes.map((type) => {
                const sectionLimit = snapshot.policy.sections[type];
                const count = Number(sectionUsage[type]?.sections ?? 0);
                const items = sectionLimit?.items;
                const itemUsage =
                  items === undefined
                    ? null
                    : Number(sectionUsage[type]?.items ?? 0);

                return (
                  <div
                    className="flex items-center justify-between gap-3 text-sm"
                    key={type}
                  >
                    <span className="text-muted-foreground">
                      {t(`sectionTypes.${type}`)}
                    </span>
                    <span className="text-right font-medium tabular-nums">
                      {sectionLimit
                        ? `${count} / ${sectionLimit.sections} ${t("sections")}${
                            itemUsage === null
                              ? ""
                              : ` · ${itemUsage} / ${items} ${t("items")}`
                          }`
                        : t("notAvailable")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
