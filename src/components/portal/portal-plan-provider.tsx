"use client";

import {
  IconCloud,
  IconLayoutGrid,
  IconLoader2,
  IconLock,
  IconPhoto,
} from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PortalDocument } from "@/domain/portal/document";
import {
  fetchPortalPlan,
  isSafePendingPortalAction,
  type PortalPlanSnapshot,
  type SafePendingPortalAction,
  storagePercent,
  storageUsageState,
} from "@/lib/billing/portal-plan-client";
import {
  PORTAL_PLANS,
  type PortalPlan,
  type PortalUpgradeReason,
  planUpgradePriceCents,
  upgradeDescriptionKey,
  validatePortalDocumentChange,
  validatePortalPublication,
  validatePortalVisibility,
} from "@/lib/billing/portal-policy";
import { subscribePortalAssetUsageChanges } from "@/lib/portal/asset-usage-events";
import { cn } from "@/lib/utils";

export const PORTAL_PLAN_RETRY_EVENT = "portal-plan-retry";

type PortalUpgradeDetails = {
  fileSizeBytes?: number;
};

type PortalPlanContextValue = {
  guardDocumentChange: (
    previous: PortalDocument,
    next: PortalDocument,
    retry?: SafePendingPortalAction,
  ) => boolean;
  guardPassword: () => boolean;
  guardPublication: (document: PortalDocument) => boolean;
  plan: PortalPlan;
  refresh: () => Promise<PortalPlanSnapshot | null>;
  requestUpgrade: (
    code: PortalUpgradeReason,
    retry?: SafePendingPortalAction,
    details?: PortalUpgradeDetails,
  ) => void;
  snapshot: PortalPlanSnapshot;
  status: "error" | "loading" | "ready";
};

const fallbackSnapshot: PortalPlanSnapshot = {
  available: false,
  canPurchase: false,
  entitlementStatus: null,
  plan: "free",
  policy: PORTAL_PLANS.free,
  storageUsedBytes: 0,
};

const PortalPlanContext = createContext<PortalPlanContextValue | null>(null);

const fallbackContext: PortalPlanContextValue = {
  guardDocumentChange: () => true,
  guardPassword: () => false,
  guardPublication: () => true,
  plan: "free",
  refresh: async () => null,
  requestUpgrade: () => undefined,
  snapshot: fallbackSnapshot,
  status: "error",
};

export function usePortalPlan() {
  return useContext(PortalPlanContext) ?? fallbackContext;
}

export function useOptionalPortalPlan() {
  return useContext(PortalPlanContext);
}

export function PortalPlanProvider({
  children,
  locale,
  portalId,
  initialSnapshot,
}: {
  children: ReactNode;
  locale: string;
  portalId: string;
  initialSnapshot?: PortalPlanSnapshot;
}) {
  const t = useTranslations("PortalEditor.plan");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState(initialSnapshot ?? fallbackSnapshot);
  const [status, setStatus] = useState<"error" | "loading" | "ready">(
    initialSnapshot ? "ready" : "loading",
  );
  const [violation, setViolation] = useState<PortalUpgradeReason | null>(null);
  const [violationDetails, setViolationDetails] =
    useState<PortalUpgradeDetails | null>(null);
  const [checkoutPendingPlan, setCheckoutPendingPlan] = useState<Exclude<
    PortalPlan,
    "free"
  > | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Exclude<
    PortalPlan,
    "free"
  > | null>(null);
  const pendingActionRef = useRef<SafePendingPortalAction | null>(null);
  const refreshSequence = useRef(0);
  const snapshotRef = useRef(snapshot);
  const statusRef = useRef(status);
  const checkoutResult = searchParams.get("premium");
  const pendingActionKey = `portal-premium-pending:${portalId}`;

  const refresh = useCallback(async () => {
    const requestSequence = ++refreshSequence.current;
    // Once a plan has been verified, refreshes are background revalidations
    // (for example after an upload). Do not temporarily lock the editor while
    // that request is in flight.
    const hasUsableSnapshot =
      statusRef.current === "ready" && snapshotRef.current.available !== false;
    if (!hasUsableSnapshot) {
      statusRef.current = "loading";
      setStatus("loading");
    }
    try {
      const next = await fetchPortalPlan(portalId);
      if (requestSequence !== refreshSequence.current) return null;
      snapshotRef.current = next;
      setSnapshot(next);
      statusRef.current = "ready";
      setStatus("ready");
      toast.dismiss(`portal-plan-error:${portalId}`);
      return next;
    } catch (error) {
      if (requestSequence !== refreshSequence.current) return null;
      console.error("Portal plan refresh failed", { error, portalId });
      if (hasUsableSnapshot) {
        // The last verified policy is safer than blocking every keystroke on
        // a transient plan endpoint failure. The next revalidation can heal
        // the snapshot without interrupting the editor.
        statusRef.current = "ready";
        setStatus("ready");
      } else {
        statusRef.current = "error";
        setStatus("error");
        toast.error(t("unavailable"), {
          id: `portal-plan-error:${portalId}`,
        });
      }
      return null;
    }
  }, [portalId, t]);

  useEffect(() => {
    if (initialSnapshot) return;
    void refresh();
  }, [initialSnapshot, refresh]);

  useEffect(
    () =>
      subscribePortalAssetUsageChanges(portalId, () => {
        void refresh();
      }),
    [portalId, refresh],
  );

  useEffect(() => {
    if (checkoutResult !== "success") return;
    let cancelled = false;
    let attempt = 0;
    const poll = async () => {
      const next = await refresh();
      if (cancelled) return;
      if (next && next.plan !== "free") {
        let pending: unknown = pendingActionRef.current;
        try {
          pending = JSON.parse(
            window.sessionStorage.getItem(pendingActionKey) ?? "null",
          );
        } catch {
          pending = null;
        }
        pendingActionRef.current = null;
        window.sessionStorage.removeItem(pendingActionKey);
        if (isSafePendingPortalAction(pending)) {
          window.dispatchEvent(
            new CustomEvent(PORTAL_PLAN_RETRY_EVENT, { detail: pending }),
          );
        }
        router.replace(pathname, { scroll: false });
        return;
      }
      attempt += 1;
      if (attempt < 10) window.setTimeout(poll, 1500);
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [checkoutResult, pathname, pendingActionKey, refresh, router]);

  const requestUpgrade = useCallback(
    (
      code: PortalUpgradeReason,
      retry?: SafePendingPortalAction,
      details?: PortalUpgradeDetails,
    ) => {
      const openUpgradeDialog = () => {
        setViolation(code);
        setViolationDetails(details ?? null);
        setSelectedPlan(
          snapshot.plan === "free"
            ? "starter"
            : snapshot.plan === "starter"
              ? "pro"
              : "premium",
        );
        pendingActionRef.current =
          retry && isSafePendingPortalAction(retry) ? retry : null;
        if (pendingActionRef.current) {
          window.sessionStorage.setItem(
            pendingActionKey,
            JSON.stringify(pendingActionRef.current),
          );
        } else {
          window.sessionStorage.removeItem(pendingActionKey);
        }
      };

      if (code === "upgrade_info") {
        openUpgradeDialog();
        return;
      }

      const description =
        code === "storage_bytes"
          ? t("violations.storage_bytes_detail", {
              available: formatBytes(
                Math.max(
                  0,
                  snapshot.policy.storageBytes - snapshot.storageUsedBytes,
                ),
              ),
              limit: formatBytes(snapshot.policy.storageBytes),
              requested: formatBytes(details?.fileSizeBytes ?? 0),
              used: formatBytes(snapshot.storageUsedBytes),
            })
          : code === "upload_bytes"
            ? t("violations.upload_bytes_detail", {
                maximum: formatBytes(snapshot.policy.maxUploadBytes),
                requested: formatBytes(details?.fileSizeBytes ?? 0),
              })
            : t(upgradeDescriptionKey(code));

      toast.warning(t("limitTitle"), {
        action: { label: t("viewPlans"), onClick: openUpgradeDialog },
        description,
        id: `portal-plan-limit:${portalId}`,
      });
    },
    [pendingActionKey, portalId, snapshot, t],
  );

  const guardDocumentChange = useCallback(
    (
      previous: PortalDocument,
      next: PortalDocument,
      retry?: SafePendingPortalAction,
    ) => {
      if (status !== "ready") {
        requestUpgrade("plan_unavailable");
        return false;
      }
      const result = validatePortalDocumentChange(
        previous,
        next,
        snapshot.plan,
      );
      if (result.ok) return true;
      requestUpgrade(result.code, retry);
      return false;
    },
    [requestUpgrade, snapshot.plan, status],
  );

  const guardPublication = useCallback(
    (document: PortalDocument) => {
      if (status !== "ready") {
        requestUpgrade("plan_unavailable");
        return false;
      }
      const result = validatePortalPublication(document, snapshot.plan);
      if (result.ok) return true;
      requestUpgrade(result.code, { kind: "publish" });
      return false;
    },
    [requestUpgrade, snapshot.plan, status],
  );

  const guardPassword = useCallback(() => {
    if (status !== "ready") {
      requestUpgrade("plan_unavailable");
      return false;
    }
    const result = validatePortalVisibility("password", snapshot.plan);
    if (result.ok) return true;
    requestUpgrade(result.code);
    return false;
  }, [requestUpgrade, snapshot.plan, status]);

  const value = useMemo<PortalPlanContextValue>(
    () => ({
      guardDocumentChange,
      guardPassword,
      guardPublication,
      plan: snapshot.plan,
      refresh,
      requestUpgrade,
      snapshot,
      status,
    }),
    [
      guardDocumentChange,
      guardPassword,
      guardPublication,
      refresh,
      requestUpgrade,
      snapshot,
      status,
    ],
  );

  async function checkout(plan: Exclude<PortalPlan, "free">) {
    setSelectedPlan(plan);
    setCheckoutPendingPlan(plan);
    try {
      const response = await fetch("/api/billing/portal-premium/checkout", {
        body: JSON.stringify({ locale, plan, portalId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as {
        checkoutUrl?: string;
        details?: string;
        error?: string;
        reason?: string;
      } | null;
      if (!response.ok || !body?.checkoutUrl) {
        const details = [body?.reason, body?.details ?? body?.error].filter(
          Boolean,
        );
        throw new Error(
          details.join(": ") || `checkout_http_${response.status}`,
        );
      }
      window.location.assign(body.checkoutUrl);
    } catch (error) {
      console.error("Portal plan checkout failed", { error, plan, portalId });
      setCheckoutPendingPlan(null);
      toast.error(
        t("checkoutUnavailable", {
          reason: error instanceof Error ? error.message : "unknown_error",
        }),
        { id: `portal-checkout-error:${portalId}` },
      );
    }
  }

  const eligiblePlans = (["starter", "pro", "premium"] as const).filter(
    (candidate) => planUpgradePriceCents(snapshot.plan, candidate) > 0,
  );
  const activePlan =
    selectedPlan && eligiblePlans.includes(selectedPlan)
      ? selectedPlan
      : (eligiblePlans[0] ?? null);

  return (
    <PortalPlanContext.Provider value={value}>
      {children}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setViolation(null);
            setViolationDetails(null);
            setSelectedPlan(null);
          }
        }}
        open={Boolean(violation)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {snapshot.plan === "premium"
                ? t("limitTitle")
                : t("upgradeTitle", {
                    plan: activePlan ? t(activePlan) : t("aPlan"),
                  })}
            </DialogTitle>
            <DialogDescription>
              {violation === "storage_bytes"
                ? t("violations.storage_bytes_detail", {
                    available: formatBytes(
                      Math.max(
                        0,
                        snapshot.policy.storageBytes -
                          snapshot.storageUsedBytes,
                      ),
                    ),
                    limit: formatBytes(snapshot.policy.storageBytes),
                    requested: formatBytes(
                      violationDetails?.fileSizeBytes ?? 0,
                    ),
                    used: formatBytes(snapshot.storageUsedBytes),
                  })
                : violation === "upload_bytes"
                  ? t("violations.upload_bytes_detail", {
                      maximum: formatBytes(snapshot.policy.maxUploadBytes),
                      requested: formatBytes(
                        violationDetails?.fileSizeBytes ?? 0,
                      ),
                    })
                  : violation
                    ? t(upgradeDescriptionKey(violation))
                    : t("compareDescription")}
            </DialogDescription>
          </DialogHeader>
          {status === "loading" ? (
            <DialogFooter>
              <Button disabled type="button">
                <IconLoader2
                  className="animate-spin"
                  data-icon="inline-start"
                />
                {t("loading")}
              </Button>
            </DialogFooter>
          ) : status === "error" ? (
            <DialogFooter>
              <Button
                onClick={() => void refresh()}
                type="button"
                variant="outline"
              >
                {t("retry")}
              </Button>
            </DialogFooter>
          ) : status === "ready" && snapshot.canPurchase && activePlan ? (
            <Tabs
              className="w-full"
              onValueChange={(value) =>
                setSelectedPlan(value as Exclude<PortalPlan, "free">)
              }
              value={activePlan}
            >
              <TabsList
                className={cn(
                  "grid h-auto w-full",
                  eligiblePlans.length === 1 && "grid-cols-1",
                  eligiblePlans.length === 2 && "grid-cols-2",
                  eligiblePlans.length === 3 && "grid-cols-3",
                )}
                variant="default"
              >
                {eligiblePlans.map((candidate) => (
                  <TabsTrigger key={candidate} value={candidate}>
                    {t(candidate)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {eligiblePlans.map((candidate) => {
                const plan = PORTAL_PLANS[candidate];
                const benefits = [
                  { icon: IconLock, text: t("benefits.password") },
                  {
                    icon: IconCloud,
                    text: t("benefits.storage", {
                      storage: formatBytes(plan.storageBytes),
                    }),
                  },
                  {
                    icon: IconLayoutGrid,
                    text: t("benefits.sections", {
                      sections: plan.totalSections,
                    }),
                  },
                  {
                    icon: IconPhoto,
                    text: t("benefits.gallery", {
                      gallery: plan.sections.gallery?.items ?? 0,
                    }),
                  },
                ];
                return (
                  <TabsContent
                    className="flex flex-col gap-4 pt-4"
                    key={candidate}
                    value={candidate}
                  >
                    <ul
                      aria-label={t("benefits.title", { plan: t(candidate) })}
                      className="m-0 flex list-none flex-col gap-3 p-0"
                    >
                      {benefits.map(({ icon: Icon, text }) => (
                        <li className="flex items-center gap-3" key={text}>
                          <span className="shrink-0 text-primary">
                            <Icon className="size-4" />
                          </span>
                          <span>{text}</span>
                        </li>
                      ))}
                    </ul>
                    <DialogFooter>
                      <Button
                        aria-label={t("buyAccessible", {
                          plan: t(candidate),
                          price: `$${(planUpgradePriceCents(snapshot.plan, candidate) / 100).toFixed(2)}`,
                        })}
                        disabled={checkoutPendingPlan !== null}
                        onClick={() => void checkout(candidate)}
                        type="button"
                      >
                        {checkoutPendingPlan === candidate ? (
                          <IconLoader2
                            className="animate-spin"
                            data-icon="inline-start"
                          />
                        ) : null}
                        {t("buy", {
                          plan: t(candidate),
                          price: `$${(planUpgradePriceCents(snapshot.plan, candidate) / 100).toFixed(2)}`,
                        })}
                      </Button>
                    </DialogFooter>
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : snapshot.plan === "free" ? (
            <p className="text-muted-foreground text-sm">
              {t("ownerRequired")}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
      {checkoutResult === "cancelled" ? (
        <span aria-live="polite" className="sr-only">
          {t("cancelled")}
        </span>
      ) : null}
    </PortalPlanContext.Provider>
  );
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes ? 1 : 0)} MB`;
}

export function PortalPlanStatus({
  triggerless = false,
}: {
  triggerless?: boolean;
}) {
  const t = useTranslations("PortalEditor.plan");
  const { plan, refresh, requestUpgrade, snapshot, status } = usePortalPlan();
  const percent = storagePercent(
    snapshot.storageUsedBytes,
    snapshot.policy.storageBytes,
  );
  const [lastReadyPercent, setLastReadyPercent] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!triggerless) return;
    const openPlan = () => setOpen(true);
    window.addEventListener("portal-workspace:plan", openPlan);
    return () => window.removeEventListener("portal-workspace:plan", openPlan);
  }, [triggerless]);
  useEffect(() => {
    if (status === "ready") setLastReadyPercent(Math.round(percent));
  }, [percent, status]);
  const usageState = storageUsageState(percent);
  const used = formatBytes(snapshot.storageUsedBytes);
  const limit = formatBytes(snapshot.policy.storageBytes);
  const storageLabel = t(`storageLabels.${plan}`);
  const label =
    status === "loading"
      ? t("loading")
      : status === "error"
        ? t("unavailable")
        : t(`storageSummaries.${plan}`, {
            limit,
            percent: Math.round(percent),
            used,
          });

  return (
    <Popover onOpenChange={setOpen} open={open}>
      {!triggerless ? (
        <PopoverTrigger
          render={
            <Button
              aria-label={label}
              aria-disabled={status === "loading" || plan === "premium"}
              className="rounded-full hover:bg-transparent dark:hover:bg-transparent"
              onClick={() => {
                if (status === "error") void refresh();
              }}
              size="icon-lg"
              type="button"
              variant="ghost"
            />
          }
        >
          <span className="relative size-7">
            <svg
              aria-label={storageLabel}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={percent}
              className="size-full -rotate-90"
              role="progressbar"
              viewBox="0 0 36 36"
            >
              <circle
                className="fill-none stroke-muted"
                cx="18"
                cy="18"
                pathLength="100"
                r="15"
                strokeWidth="4"
              />
              <circle
                className={cn(
                  "fill-none transition-[stroke-dashoffset,stroke] duration-300",
                  usageState === "empty" && "stroke-muted-foreground/40",
                  usageState === "normal" && "stroke-chart-2",
                  usageState === "warning" && "stroke-warning",
                  usageState === "exhausted" && "stroke-destructive",
                )}
                cx="18"
                cy="18"
                pathLength="100"
                r="15"
                strokeDasharray="100"
                strokeDashoffset={100 - percent}
                strokeLinecap="round"
                strokeWidth="4"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-medium text-[9px] tabular-nums">
              {lastReadyPercent ??
                (status === "ready" ? Math.round(percent) : 0)}
            </span>
          </span>
          <span className="sr-only">{label}</span>
        </PopoverTrigger>
      ) : null}
      <PopoverContent className="w-72" side="top">
        {status === "ready" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs">
                {t("currentPlan")}
              </span>
              <Badge variant={plan === "premium" ? "default" : "secondary"}>
                {t(plan)}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{storageLabel}</span>
              <span className="font-medium tabular-nums">
                {used} / {limit}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">
                {t(`usageStates.${usageState}`)}
              </span>
              <span className="font-medium tabular-nums">
                {Math.round(percent)}%
              </span>
            </div>
            {plan === "free" ? (
              <Button
                className="w-full"
                onClick={() => requestUpgrade("upgrade_info")}
                type="button"
              >
                {t("upgrade")}
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{label}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
