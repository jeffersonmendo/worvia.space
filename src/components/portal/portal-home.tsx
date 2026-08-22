"use client";

import {
  IconCalendarEventFilled,
  IconCalendarFilled,
  IconCreditCard,
  IconCreditCardFilled,
  IconCrownFilled,
  IconExternalLink,
  IconFolderPlus,
  IconKeyFilled,
  IconLoader2,
  IconLockFilled,
  IconSearch,
  IconSettings,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconWorldFilled,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  deletePortalFromHome,
  getHomePortals,
  type HomePortal,
  type HomePortalsResult,
  togglePortalFavorite,
  updatePortalSettings,
} from "@/app/[locale]/_actions/portals";
import { PortalCardActionGroup } from "@/components/portal/portal-card-action-group";
import {
  PortalColorStack,
  PortalFileTypeBadges,
  PortalImageStack,
} from "@/components/portal/portal-card-metadata";
import { PortalWorkspaceToolbar } from "@/components/portal/portal-workspace-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import {
  getCountryFlag,
  STRIPE_CONNECT_COUNTRY_CODES,
} from "@/lib/billing/connect-countries";
import { storagePercent } from "@/lib/billing/portal-plan-client";
import { getHomeErrorEvent } from "@/lib/portal/home-error-event";
import { usePortalHomeStore } from "@/lib/portal/home-store";
import { shouldOpenPortalCardFromKeyDown } from "@/lib/portal/portal-card-keyboard";
import { workspaceQueryKeys } from "@/lib/portal/workspace-read-models";

export type PortalHomeCopy = {
  authRequired: string;
  backendDisabled: {
    description: string;
    title: string;
  };
  create: {
    description: string;
    nameLabel: string;
    namePlaceholder: string;
    visibilityDescription: string;
    visibilityLabel: string;
    visibilityPrivate: string;
    visibilityPublic: string;
    submit: string;
    title: string;
    stepProject: string;
    stepFiles: string;
    stepReview: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    languageLabel: string;
    toneLabel: string;
    toneProfessional: string;
    toneEditorial: string;
    toneMinimal: string;
    colorsLabel: string;
    preferencesLabel: string;
    filesLabel: string;
    filesDescription: string;
    fileDescriptionPlaceholder: string;
    back: string;
    next: string;
    review: string;
  };
  empty: {
    description: string;
    title: string;
  };
  errorGeneric: string;
  header: {
    createPortal: string;
    signOut: string;
  };
  searchPlaceholder: string;
  searchClearLabel: string;
  connect: {
    active: string;
    activeDescription: string;
    accountId: string;
    accountEmail: string;
    detailsSubmitted: string;
    charges: string;
    configure: string;
    country: string;
    countryHelp: string;
    emailRecommendation: string;
    countryRecommended: string;
    countrySearch: string;
    countryNoResults: string;
    inactiveDescription: string;
    inactiveTitle: string;
    edit: string;
    error: string;
    inactive: string;
    loading: string;
    profile: string;
    activeShort: string;
    status: string;
    payouts: string;
    dashboard: string;
    activeTitle: string;
    processing: string;
    needsInformation: string;
    requirementsPending: string;
    verification: string;
    verificationActive: string;
    verificationNeedsInformation: string;
    verificationProcessing: string;
    verificationNotStarted: string;
    continue: string;
    trigger: string;
  };
  portal: {
    favorite: {
      add: string;
      remove: string;
      saveError: string;
    };
    edit: string;
    lastEdited: string;
    fileTypesLabel: string;
    colorsLabel: string;
    noFiles: string;
    noColors: string;
    imagesLabel: string;
    noImages: string;
    view: string;
    usage: string;
    purchasedAt: string;
    plan: {
      free: string;
      starter: string;
      pro: string;
      premium: string;
    };
    visibility: {
      paid: string;
      password: string;
      private: string;
      public: string;
      purchased: string;
    };
  };
  delete: {
    cancel: string;
    confirm: string;
    deleting: string;
    description: string;
    phraseLabel: string;
    phrasePlaceholder: string;
    slugLabel: string;
    slugInstruction: string;
    slugPlaceholder: string;
    title: string;
    trigger: string;
    paidProtected: string;
  };
  settings: {
    description: string;
    nameLabel: string;
    save: string;
    slugLabel: string;
    title: string;
    trigger: string;
  };
};

type ConnectStatus = {
  accountExists?: boolean;
  accountId?: string;
  accountEmail?: string | null;
  detailsSubmitted?: boolean;
  chargesEnabled?: boolean;
  connected: boolean;
  country?: string | null;
  payoutsEnabled?: boolean;
  requirementsPending?: number;
  verificationState?:
    | "active"
    | "needs_information"
    | "not_started"
    | "processing";
  displayName?: string | null;
  lastSyncedAt?: string | null;
  needsSync?: boolean;
};

export function ConnectAccountDialog({
  copy,
  locale,
  portalId,
  shouldOpen,
  recommendedCountry,
  hideTrigger = false,
  standalone = false,
  initialStatus,
}: {
  copy: PortalHomeCopy["connect"];
  hideTrigger?: boolean;
  locale: string;
  portalId: string | null;
  shouldOpen: boolean;
  recommendedCountry: string | null;
  standalone?: boolean;
  initialStatus?: ConnectStatus;
}) {
  const [open, setOpen] = useState(standalone);
  const [country, setCountry] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const initialStatusNeedsSync = Boolean(
    initialStatus &&
      (initialStatus.needsSync === true ||
        !initialStatus.accountEmail ||
        !initialStatus.country ||
        !initialStatus.displayName ||
        !initialStatus.lastSyncedAt),
  );
  const statusQuery = useQuery({
    enabled: open,
    initialData: initialStatus,
    initialDataUpdatedAt: initialStatus ? Date.now() : undefined,
    queryFn: async () => {
      const query = portalId ? `?portalId=${encodeURIComponent(portalId)}` : "";
      const response = await fetch(`/api/billing/connect/status${query}`);
      if (!response.ok) throw new Error("Unable to load Stripe Connect status");
      const refreshed = (await response.json()) as ConnectStatus;
      // Never turn a server-provided existing account into onboarding because
      // a stale route/cache response temporarily omitted the row.
      if (initialStatus?.accountExists && refreshed.accountExists !== true) {
        return {
          ...initialStatus,
          ...refreshed,
          accountExists: true,
          accountId: refreshed.accountId ?? initialStatus.accountId,
        };
      }
      return refreshed;
    },
    queryKey: workspaceQueryKeys.connect(initialStatus?.accountId),
    staleTime: initialStatusNeedsSync
      ? 0
      : initialStatus
        ? Number.POSITIVE_INFINITY
        : 0,
  });
  const status =
    statusQuery.data ??
    (statusQuery.isError ? (initialStatus ?? { connected: false }) : null);
  const countryNames = new Intl.DisplayNames([locale], { type: "region" });
  const countryOptions = STRIPE_CONNECT_COUNTRY_CODES.map((code) => ({
    code,
    label: countryNames.of(code) ?? code,
  }));
  useEffect(() => {
    if (shouldOpen) setOpen(true);
  }, [shouldOpen]);

  async function openStripe(mode: "onboarding" | "update") {
    setPending(true);
    try {
      const response = await fetch("/api/billing/connect/onboarding", {
        body: JSON.stringify({ country, locale, mode, portalId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        details?: string;
        url?: string;
      };
      if (!response.ok || !result.url) {
        throw new Error(result.details ?? copy.error);
      }
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.error);
      setPending(false);
    }
  }

  async function openDashboard() {
    setPending(true);
    try {
      const response = await fetch("/api/billing/connect/dashboard", {
        body: null,
        method: "POST",
      });
      const result = (await response.json()) as { url?: string };
      if (!response.ok || !result.url) {
        throw new Error(copy.error);
      }
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.error);
      setPending(false);
    }
  }

  const connected = status?.connected === true;
  const verificationLabel =
    status?.verificationState === "active"
      ? copy.verificationActive
      : status?.verificationState === "needs_information"
        ? copy.verificationNeedsInformation
        : status?.verificationState === "processing"
          ? copy.verificationProcessing
          : copy.verificationNotStarted;
  const content = (
    <>
      {standalone ? null : (
        <DialogHeader>
          <DialogTitle>
            {connected ? copy.activeTitle : copy.inactiveTitle}
          </DialogTitle>
          <DialogDescription>
            {connected ? copy.activeDescription : copy.inactiveDescription}
          </DialogDescription>
        </DialogHeader>
      )}
      {status === null ? (
        <FieldGroup>
          <FieldDescription>{copy.loading}</FieldDescription>
        </FieldGroup>
      ) : connected ? (
        <FieldGroup>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{copy.status}</span>
              <Badge className="bg-green-500/10 text-green-700 dark:text-green-300">
                {copy.activeShort}
              </Badge>
            </div>
            {status.accountEmail ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  {copy.accountEmail}
                </span>
                <span className="font-medium text-right">
                  {maskEmail(status.accountEmail)}
                </span>
              </div>
            ) : null}
            {status.displayName ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{copy.profile}</span>
                <span className="font-medium text-right">
                  {status.displayName}
                </span>
              </div>
            ) : null}
            {status.country ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{copy.country}</span>
                <span className="font-medium text-right">
                  {countryNames.of(status.country) ?? status.country}
                </span>
              </div>
            ) : null}
            {status.accountId ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{copy.accountId}</span>
                <span className="font-medium break-all text-right">
                  {status.accountId}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{copy.verification}</span>
              <Badge variant="secondary">{verificationLabel}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {copy.detailsSubmitted}
              </span>
              <span className="font-medium text-right">
                {status.detailsSubmitted ? copy.activeShort : copy.inactive}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{copy.charges}</span>
              {status.chargesEnabled ? (
                <Badge className="bg-green-500/10 text-green-700 dark:text-green-300">
                  {copy.activeShort}
                </Badge>
              ) : (
                <span className="font-medium text-right">{copy.inactive}</span>
              )}
            </div>
            {status.requirementsPending ? (
              <FieldDescription>
                {copy.requirementsPending.replace(
                  "{count}",
                  String(status.requirementsPending),
                )}
              </FieldDescription>
            ) : null}
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{copy.payouts}</span>
              {status.payoutsEnabled ? (
                <Badge className="bg-green-500/10 text-green-700 dark:text-green-300">
                  {copy.activeShort}
                </Badge>
              ) : (
                <span className="font-medium text-right">{copy.inactive}</span>
              )}
            </div>
          </div>
          <DialogFooter
            className={standalone ? "items-start sm:justify-start" : undefined}
          >
            <Button
              className="rounded-full"
              disabled={pending}
              onClick={() => openStripe("update")}
              type="button"
            >
              {copy.edit}
            </Button>
            <Button
              className="rounded-full"
              disabled={pending}
              onClick={openDashboard}
              type="button"
              variant="link"
            >
              <IconExternalLink data-icon="inline-start" />
              {copy.dashboard}
            </Button>
          </DialogFooter>
        </FieldGroup>
      ) : status.accountExists ? (
        <FieldGroup>
          <FieldDescription>
            {status.verificationState === "needs_information"
              ? copy.needsInformation
              : copy.processing}
          </FieldDescription>
          {status.requirementsPending ? (
            <FieldDescription>
              {copy.requirementsPending.replace(
                "{count}",
                String(status.requirementsPending),
              )}
            </FieldDescription>
          ) : null}
          <DialogFooter
            className={standalone ? "items-start sm:justify-start" : undefined}
          >
            <Button
              className="rounded-full"
              disabled={pending}
              onClick={() => openStripe("update")}
              type="button"
            >
              {copy.continue}
            </Button>
          </DialogFooter>
        </FieldGroup>
      ) : (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="connect-country">{copy.country}</FieldLabel>
            <FieldDescription>{copy.countryHelp}</FieldDescription>
            <Combobox
              items={countryOptions}
              itemToStringValue={(item) => item.label}
              onValueChange={(item) => setCountry(item?.code ?? null)}
              value={
                country
                  ? countryOptions.find((item) => item.code === country)
                  : null
              }
            >
              <ComboboxInput
                aria-label={copy.country}
                id="connect-country"
                placeholder={copy.country}
              />
              <ComboboxContent>
                <ComboboxEmpty>{copy.countryNoResults}</ComboboxEmpty>
                <ComboboxList>
                  {(item) => (
                    <ComboboxItem key={item.code} value={item}>
                      <span aria-hidden="true" className="text-lg leading-none">
                        {getCountryFlag(item.code)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.code}
                      </span>
                      {recommendedCountry === item.code ? (
                        <Badge variant="secondary">
                          {copy.countryRecommended}
                        </Badge>
                      ) : null}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
          <FieldDescription>{copy.emailRecommendation}</FieldDescription>
          <DialogFooter className={standalone ? "items-end" : undefined}>
            <Button
              className="rounded-full"
              disabled={pending || !country}
              onClick={() => openStripe("onboarding")}
              type="button"
            >
              {copy.configure}
            </Button>
          </DialogFooter>
        </FieldGroup>
      )}
    </>
  );

  if (standalone) return <div className="flex flex-col gap-6">{content}</div>;

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      {hideTrigger ? null : (
        <DialogTrigger
          render={
            <Button
              className="rounded-full"
              size="lg"
              type="button"
              variant="outline"
            />
          }
        >
          <IconCreditCard data-icon="inline-start" />
          {copy.trigger}
        </DialogTrigger>
      )}
      <DialogContent>{content}</DialogContent>
    </Dialog>
  );
}

const portalsQueryKey = workspaceQueryKeys.home;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  if (localPart.length <= 9) return email;
  return `${localPart.slice(0, 6)}...${localPart.slice(-3)}@${domain}`;
}

function withPortalName(template: string, portalName: string) {
  return template.replace("{name}", portalName);
}

function PortalSettingsDialog({
  copy,
  locale,
  portal,
}: {
  copy: Pick<PortalHomeCopy, "errorGeneric" | "settings">;
  locale: string;
  portal: HomePortal;
}) {
  const queryClient = useQueryClient();
  const openPortalId = usePortalHomeStore((state) => state.settingsPortalId);
  const setOpen = usePortalHomeStore((state) => state.setSettingsDialogOpen);
  const mutation = useMutation({
    mutationFn: async (formData: FormData) => {
      formData.set("locale", locale);
      formData.set("portal_id", portal.id);
      await updatePortalSettings(formData);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: portalsQueryKey(locale),
      });
      setOpen(portal.id, false);
    },
  });

  return (
    <Dialog
      onOpenChange={(open) => setOpen(portal.id, open)}
      open={openPortalId === portal.id}
    >
      <DialogTrigger
        render={
          <Button
            aria-label={withPortalName(copy.settings.trigger, portal.name)}
            className="rounded-full"
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <IconSettings data-icon="inline-start" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {withPortalName(copy.settings.title, portal.name)}
          </DialogTitle>
          <DialogDescription>{copy.settings.description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(new FormData(event.currentTarget));
          }}
        >
          <FieldGroup>
            <Field data-invalid={mutation.isError || undefined}>
              <FieldLabel htmlFor={`portal-name-${portal.id}`}>
                {copy.settings.nameLabel}
              </FieldLabel>
              <Input
                aria-invalid={mutation.isError || undefined}
                defaultValue={portal.name}
                id={`portal-name-${portal.id}`}
                maxLength={120}
                name="name"
                required
              />
            </Field>
            <Field data-invalid={mutation.isError || undefined}>
              <FieldLabel htmlFor={`portal-slug-${portal.id}`}>
                {copy.settings.slugLabel}
              </FieldLabel>
              <Input
                aria-invalid={mutation.isError || undefined}
                defaultValue={portal.slug}
                id={`portal-slug-${portal.id}`}
                maxLength={80}
                name="slug"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
              {mutation.isError ? (
                <FieldError>
                  {errorMessage(mutation.error, copy.errorGeneric)}
                </FieldError>
              ) : null}
            </Field>
            <DialogFooter>
              <Button
                className="rounded-full"
                disabled={mutation.isPending}
                type="submit"
              >
                {mutation.isPending ? (
                  <IconLoader2
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                {copy.settings.save}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeletePortalDialog({
  copy,
  locale,
  portal,
}: {
  copy: Pick<PortalHomeCopy, "authRequired" | "delete" | "errorGeneric">;
  locale: string;
  portal: HomePortal;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [confirmationSlug, setConfirmationSlug] = useState("");
  const expectedPhrase = copy.delete.phrasePlaceholder;
  const canDelete =
    confirmationSlug === portal.slug && confirmationPhrase === expectedPhrase;
  const mutation = useMutation({
    mutationFn: () =>
      deletePortalFromHome({
        confirmationPhrase,
        confirmationSlug,
        locale,
        portalId: portal.id,
      }),
    onSuccess: async (result) => {
      if (result.error === "authenticationRequired") {
        toast.error(copy.authRequired);
        return;
      }

      if (result.error) {
        toast.error(copy.errorGeneric);
        return;
      }

      queryClient.setQueryData<HomePortalsResult>(
        portalsQueryKey(locale),
        (current) =>
          current
            ? {
                ...current,
                portals: current.portals.filter(
                  (item) => item.id !== portal.id,
                ),
              }
            : current,
      );
      await queryClient.invalidateQueries({
        queryKey: portalsQueryKey(locale),
      });
      router.refresh();
      setOpen(false);
      setConfirmationPhrase("");
      setConfirmationSlug("");
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setConfirmationPhrase("");
      setConfirmationSlug("");
      mutation.reset();
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={
          <Button
            aria-label={
              portal.canDelete
                ? withPortalName(copy.delete.trigger, portal.name)
                : copy.delete.paidProtected
            }
            className="rounded-full"
            disabled={!portal.canDelete}
            size="icon-sm"
            title={portal.canDelete ? undefined : copy.delete.paidProtected}
            onClick={(event) => event.stopPropagation()}
            type="button"
            variant="ghost"
          />
        }
      >
        <IconTrash data-icon="inline-start" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {withPortalName(copy.delete.title, portal.name)}
          </DialogTitle>
          <DialogDescription>
            {withPortalName(copy.delete.description, portal.name)}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`delete-slug-${portal.id}`}>
              {copy.delete.slugLabel}
            </FieldLabel>
            <FieldDescription>
              {copy.delete.slugInstruction.replace("{slug}", portal.slug)}
            </FieldDescription>
            <Input
              autoComplete="off"
              id={`delete-slug-${portal.id}`}
              onChange={(event) => setConfirmationSlug(event.target.value)}
              placeholder={copy.delete.slugPlaceholder}
              value={confirmationSlug}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`delete-phrase-${portal.id}`}>
              {copy.delete.phraseLabel}
            </FieldLabel>
            <Input
              autoComplete="off"
              id={`delete-phrase-${portal.id}`}
              onChange={(event) => setConfirmationPhrase(event.target.value)}
              placeholder={copy.delete.phrasePlaceholder}
              value={confirmationPhrase}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            className="rounded-full"
            disabled={mutation.isPending}
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {copy.delete.cancel}
          </Button>
          <Button
            className="rounded-full"
            disabled={mutation.isPending || !canDelete}
            onClick={() => mutation.mutate()}
            type="button"
            variant="destructive"
          >
            {mutation.isPending ? copy.delete.deleting : copy.delete.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UsageCircle({ percent }: { percent: number }) {
  const circumference = 2 * Math.PI * 8;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg
      aria-hidden="true"
      className="size-4 -rotate-90 text-chart-2"
      viewBox="0 0 20 20"
    >
      <circle
        className="text-chart-2/15"
        cx="10"
        cy="10"
        fill="none"
        r="8"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle
        cx="10"
        cy="10"
        fill="none"
        r="8"
        stroke="currentColor"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function PortalCard({
  copy,
  locale,
  portal,
}: {
  copy: Pick<PortalHomeCopy, "portal" | "authRequired" | "errorGeneric">;
  locale: string;
  portal: HomePortal;
}) {
  const portalTranslations = useTranslations("Home.portal");
  const router = useRouter();
  const queryClient = useQueryClient();
  const favoriteMutation = useMutation({
    mutationFn: () =>
      togglePortalFavorite({
        isFavorite: portal.isFavorite === true,
        locale,
        portalId: portal.id,
      }),
    onMutate: async () => {
      const queryKey = portalsQueryKey(locale);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<HomePortalsResult>(queryKey);
      queryClient.setQueryData<HomePortalsResult>(queryKey, (current) =>
        current
          ? {
              ...current,
              portals: current.portals.map((item) =>
                item.id === portal.id
                  ? { ...item, isFavorite: item.isFavorite !== true }
                  : item,
              ),
            }
          : current,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(portalsQueryKey(locale), context.previous);
      }
      toast.error(copy.errorGeneric);
    },
    onSuccess: async (result, _variables, context) => {
      if (result.error) {
        if (context?.previous) {
          queryClient.setQueryData(portalsQueryKey(locale), context.previous);
        }
        toast.error(copy.portal.favorite.saveError);
      }
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.favorites(locale),
      });
      await queryClient.invalidateQueries({
        queryKey: portalsQueryKey(locale),
      });
    },
  });
  const purchasedDate = portal.purchasedAt
    ? new Date(portal.purchasedAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  const updatedDate = new Date(portal.updated_at).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );
  const plan = portal.plan ?? "free";
  const storageLimit =
    {
      free: 100,
      starter: 500,
      pro: 1024,
      premium: 2048,
    }[plan] *
    1024 *
    1024;
  const usagePercent = Math.round(
    storagePercent(portal.storageUsedBytes ?? 0, storageLimit),
  );
  const visibility =
    portal.visibility === "paid"
      ? {
          icon: <IconCreditCardFilled className="size-4" />,
          label: "paid" as const,
        }
      : portal.visibility === "password"
        ? {
            icon: <IconKeyFilled className="size-4" />,
            label: "password" as const,
          }
        : portal.visibility === "public"
          ? {
              icon: <IconWorldFilled className="size-4" />,
              label: "public" as const,
            }
          : {
              icon: <IconLockFilled className="size-4" />,
              label: "private" as const,
            };

  const openCard = () =>
    router.push(
      portal.isPurchased
        ? `/p/${encodeURIComponent(portal.slug)}`
        : `/create/${portal.id}`,
    );

  return (
    <Card
      className="h-fit cursor-pointer bg-card/75 transition-colors hover:bg-card"
      onClick={openCard}
      onKeyDown={(event) => {
        if (shouldOpenPortalCardFromKeyDown(event)) {
          event.preventDefault();
          openCard();
        }
      }}
      size="sm"
      tabIndex={0}
    >
      <CardHeader>
        <CardTitle className="pr-8 text-lg">{portal.name}</CardTitle>
        <CardDescription className="truncate">
          <Link
            className="hover:underline"
            href={`/p/${encodeURIComponent(portal.slug)}`}
            onClick={(event) => event.stopPropagation()}
            target="_blank"
          >
            /{portal.slug}
          </Link>
        </CardDescription>
        {portal.isPurchased ? (
          <PortalCardActionGroup
            badge={
              <Badge className="bg-amber-400/20 text-amber-700 dark:text-amber-300">
                <IconCrownFilled className="size-4" />
                {copy.portal.visibility.purchased}
              </Badge>
            }
            favoriteAction={
              <Button
                aria-label={
                  portal.isFavorite === true
                    ? copy.portal.favorite.remove
                    : copy.portal.favorite.add
                }
                aria-pressed={portal.isFavorite === true}
                disabled={favoriteMutation.isPending}
                onClick={(event) => {
                  event.stopPropagation();
                  favoriteMutation.mutate();
                }}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                {portal.isFavorite === true ? <IconStarFilled /> : <IconStar />}
              </Button>
            }
          />
        ) : (
          <PortalCardActionGroup
            badge={
              <Badge
                className={
                  plan === "free"
                    ? undefined
                    : "bg-green-500/10 text-green-700 dark:text-green-300"
                }
                variant={plan === "free" ? "default" : "secondary"}
              >
                {copy.portal.plan[plan]}
              </Badge>
            }
            favoriteAction={
              <Button
                aria-label={
                  portal.isFavorite === true
                    ? copy.portal.favorite.remove
                    : copy.portal.favorite.add
                }
                aria-pressed={portal.isFavorite === true}
                disabled={favoriteMutation.isPending}
                onClick={(event) => {
                  event.stopPropagation();
                  favoriteMutation.mutate();
                }}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                {portal.isFavorite === true ? <IconStarFilled /> : <IconStar />}
              </Button>
            }
          />
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 pt-0 text-sm sm:grid-cols-2">
        <div className="flex min-w-0 flex-col items-start gap-2">
          {portal.isPurchased ? (
            <>
              <div className="flex items-center gap-2 text-muted-foreground">
                <IconCalendarFilled className="size-4" />
                {copy.portal.purchasedAt} · {purchasedDate ?? "—"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <IconCalendarEventFilled className="size-4" />
                {copy.portal.lastEdited} · {updatedDate}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-primary">
                <UsageCircle percent={usagePercent} />
                <span>
                  {copy.portal.usage} {usagePercent}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                {visibility.icon}
                <span>{copy.portal.visibility[visibility.label]}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-col items-start gap-2">
          <PortalFileTypeBadges
            emptyLabel={copy.portal.noFiles}
            fileCountLabel={
              (portal.totalFileCount ?? 0) > (portal.fileTypes?.length ?? 0)
                ? portalTranslations("filesCount", {
                    count:
                      (portal.totalFileCount ?? 0) -
                      (portal.fileTypes?.length ?? 0),
                  })
                : undefined
            }
            fileTypes={portal.fileTypes ?? []}
            label={copy.portal.fileTypesLabel}
            totalFileCount={portal.totalFileCount ?? 0}
          />
          <PortalColorStack
            colorCountLabel={
              (portal.totalColorCount ?? 0) > (portal.colors?.length ?? 0)
                ? portalTranslations("colorsCount", {
                    count:
                      (portal.totalColorCount ?? 0) -
                      (portal.colors?.length ?? 0),
                  })
                : undefined
            }
            colors={portal.colors ?? []}
            emptyLabel={copy.portal.noColors}
            label={copy.portal.colorsLabel}
          />
        </div>
        <div className="col-span-full min-w-0">
          <PortalImageStack
            emptyLabel={copy.portal.noImages}
            imageCountLabel={
              (portal.totalImageCount ?? 0) > (portal.images?.length ?? 0)
                ? portalTranslations("imagesCount", {
                    count:
                      (portal.totalImageCount ?? 0) -
                      (portal.images?.length ?? 0),
                  })
                : undefined
            }
            images={portal.images ?? []}
            label={copy.portal.imagesLabel}
            totalImageCount={portal.totalImageCount ?? 0}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function PortalHome({
  backendEnabled,
  copy,
  connectIntent,
  initialError,
  initialPortals,
  locale,
  recommendedCountry,
}: {
  backendEnabled: boolean;
  copy: PortalHomeCopy;
  connectIntent: { open: boolean; portalId: string | null };
  initialError: string | null;
  initialPortals: HomePortal[];
  locale: string;
  recommendedCountry: string | null;
}) {
  const [search, setSearch] = useState("");
  const portalsQuery = useQuery({
    enabled: backendEnabled,
    initialData: {
      error: initialError ? ("loadFailed" as const) : null,
      portals: initialPortals,
    },
    initialDataUpdatedAt: initialError ? 0 : Date.now(),
    queryFn: () => getHomePortals(locale),
    queryKey: portalsQueryKey(locale),
    staleTime: 30_000,
  });
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredPortals = portalsQuery.data.portals.filter((portal) => {
    if (!normalizedSearch) return true;
    return `${portal.name} ${portal.slug}`
      .toLocaleLowerCase()
      .includes(normalizedSearch);
  });
  const homeErrorEvent = getHomeErrorEvent({
    controlledError: Boolean(portalsQuery.data.error),
    dataUpdatedAt: portalsQuery.dataUpdatedAt,
    errorUpdatedAt: portalsQuery.errorUpdatedAt,
    queryError: portalsQuery.error,
  });

  useEffect(() => {
    if (homeErrorEvent) {
      toast.error(copy.errorGeneric, { id: "home-portals-error" });
    }
  }, [copy.errorGeneric, homeErrorEvent]);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <PortalWorkspaceToolbar
        mode="home"
        onSearchChange={setSearch}
        searchPlaceholder={copy.searchPlaceholder}
        searchClearLabel={copy.searchClearLabel}
        searchValue={search}
      />
      {backendEnabled ? (
        <ConnectAccountDialog
          copy={copy.connect}
          hideTrigger
          locale={locale}
          portalId={connectIntent.portalId}
          recommendedCountry={recommendedCountry}
          shouldOpen={connectIntent.open}
        />
      ) : null}

      <div className="relative flex w-full flex-col gap-10 p-2">
        <section>
          {!backendEnabled ? (
            <Empty className="min-h-80 border border-border/60 bg-card/50">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconFolderPlus />
                </EmptyMedia>
                <EmptyTitle>{copy.backendDisabled.title}</EmptyTitle>
                <EmptyDescription>
                  {copy.backendDisabled.description}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : filteredPortals.length === 0 ? (
            <Empty className="min-h-80 border-0 bg-transparent">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconSearch />
                </EmptyMedia>
                <EmptyTitle>{copy.empty.title}</EmptyTitle>
                <EmptyDescription>{copy.empty.description}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {filteredPortals.map((portal) => (
                <PortalCard
                  copy={copy}
                  key={portal.id}
                  locale={locale}
                  portal={portal}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
