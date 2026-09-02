"use client";

import { IconDeviceFloppy, IconSettings } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import type { FormEvent, ReactElement, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  checkPortalSlugAvailability,
  savePrivacySettings,
  updatePortalSettings,
} from "@/app/[locale]/_actions/portals";
import { usePortalEditorStore } from "@/application/portal/editor-store";
import { usePortalPlan } from "@/components/portal/portal-plan-provider";
import { Button } from "@/components/ui/button";
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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Portal, PortalVisibility } from "@/lib/supabase/database.types";

function SettingsDialogTrigger({
  icon,
  label,
}: {
  icon: ReactElement;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <DialogTrigger
          render={
            <Button
              aria-label={label}
              className="rounded-full"
              size="icon-lg"
              type="button"
              variant="ghost"
            />
          }
        >
          {icon}
          <span className="sr-only">{label}</span>
        </DialogTrigger>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SettingsTabForm({
  action = updatePortalSettings,
  children,
  locale,
  onSaved,
  onPaidConfirmationClose,
  paidConfirmation,
  portal,
}: {
  action?: (formData: FormData) => Promise<void>;
  children: ReactNode;
  locale: string;
  onSaved: () => void;
  onPaidConfirmationClose?: () => void;
  paidConfirmation?: {
    cancel: string;
    confirm: string;
    description: string;
    title: string;
  };
  portal: Portal;
}) {
  const t = useTranslations("PortalEditor.common");
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const setHasUnpublishedChanges = usePortalEditorStore(
    (state) => state.setHasUnpublishedChanges,
  );

  async function submitAction(formData: FormData) {
    await action(formData);
    setHasUnpublishedChanges(portal.id, true);
    onSaved();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (
      paidConfirmation &&
      portal.visibility !== "paid" &&
      new FormData(event.currentTarget).get("visibility") === "paid"
    ) {
      event.preventDefault();
      setPendingFormData(new FormData(event.currentTarget));
      setConfirmationOpen(true);
    }
  }

  return (
    <form action={submitAction} onSubmit={handleSubmit}>
      <input name="locale" type="hidden" value={locale} />
      <input name="portal_id" type="hidden" value={portal.id} />
      {children}
      <DialogFooter className="pt-6">
        <Button type="submit">
          <IconDeviceFloppy data-icon="inline-start" />
          {t("saveSettings")}
        </Button>
      </DialogFooter>
      {paidConfirmation ? (
        <Dialog
          onOpenChange={(open) => {
            setConfirmationOpen(open);
            if (!open) {
              setPendingFormData(null);
              onPaidConfirmationClose?.();
            }
          }}
          open={confirmationOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{paidConfirmation.title}</DialogTitle>
              <DialogDescription>
                {paidConfirmation.description}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => {
                  setConfirmationOpen(false);
                  setPendingFormData(null);
                  onPaidConfirmationClose?.();
                }}
                type="button"
                variant="outline"
              >
                {paidConfirmation.cancel}
              </Button>
              <Button
                onClick={() => {
                  if (!pendingFormData) return;
                  const formData = pendingFormData;
                  setPendingFormData(null);
                  setConfirmationOpen(false);
                  void submitAction(formData);
                }}
                type="button"
              >
                {paidConfirmation.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </form>
  );
}

function SlugAvailabilityField({
  locale,
  portal,
}: {
  locale: string;
  portal: Portal;
}) {
  const t = useTranslations("PortalEditor.settings");
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(portal.slug);
  const [edited, setEdited] = useState(false);
  const [status, setStatus] = useState<
    "checking" | "available" | "unavailable" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!edited) return;
    let current = true;
    setStatus("checking");
    setMessage(t("checkingSlug"));
    const timer = window.setTimeout(async () => {
      const result = await checkPortalSlugAvailability(
        value,
        portal.id,
        locale,
      );
      if (!current) return;
      setStatus(result.available ? "available" : "unavailable");
      setMessage(result.available ? t("slugAvailable") : result.error);
    }, 350);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [edited, locale, portal.id, value, t]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(
      status === "unavailable" ? (message ?? t("slugUnavailable")) : "",
    );
  }, [message, status, t]);

  const invalid = edited && status === "unavailable";
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor="portal-slug">{t("slug")}</FieldLabel>
      <Input
        aria-invalid={invalid || undefined}
        autoComplete="off"
        id="portal-slug"
        maxLength={80}
        name="slug"
        onChange={(event) => {
          setEdited(true);
          setValue(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
        }}
        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        placeholder={t("slugPlaceholder")}
        ref={inputRef}
        required
        value={value}
      />
      {edited && invalid ? <FieldError>{message}</FieldError> : null}
      {edited && !invalid && message ? (
        <FieldDescription aria-live="polite">{message}</FieldDescription>
      ) : null}
    </Field>
  );
}

function ConnectStripeButton({
  locale,
  portalId,
}: {
  locale: string;
  portalId: string;
}) {
  const t = useTranslations("PortalEditor.settings");
  return (
    <Button
      onClick={() =>
        window.location.assign(
          `/${locale}/home?connect=onboarding&portalId=${encodeURIComponent(portalId)}`,
        )
      }
      type="button"
      variant="outline"
    >
      {t("configureConnect")}
    </Button>
  );
}

export function SettingsDialog({
  initialConnectReady,
  initialPaidPriceCents,
  locale,
  portal,
  triggerless = false,
}: {
  initialConnectReady: boolean;
  initialPaidPriceCents: number | null;
  locale: string;
  portal: Portal;
  triggerless?: boolean;
}) {
  const t = useTranslations("PortalEditor.settings");
  const { guardPassword } = usePortalPlan();
  const [activeTab, setActiveTab] = useState("general");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!triggerless) return;
    const openSettings = () => setOpen(true);
    window.addEventListener("portal-workspace:settings", openSettings);
    return () =>
      window.removeEventListener("portal-workspace:settings", openSettings);
  }, [triggerless]);
  const [visibility, setVisibility] = useState<PortalVisibility>(
    portal.visibility,
  );
  const [paidPrice, setPaidPrice] = useState(() =>
    initialPaidPriceCents === null
      ? ""
      : (initialPaidPriceCents / 100).toFixed(2),
  );
  const [connectReady] = useState(initialConnectReady);
  useEffect(() => {
    if (!open) {
      setPaidPrice(
        initialPaidPriceCents === null
          ? ""
          : (initialPaidPriceCents / 100).toFixed(2),
      );
    }
  }, [initialPaidPriceCents, open]);
  const visibilityItems: { label: string; value: PortalVisibility }[] = [
    { label: t("public"), value: "public" },
    { label: t("private"), value: "private" },
    { label: t("password"), value: "password" },
    { label: t("paid"), value: "paid" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!triggerless ? (
        <SettingsDialogTrigger
          icon={<IconSettings data-icon="inline-start" />}
          label={t("generalTitle")}
        />
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("generalTitle")}</DialogTitle>
          <DialogDescription>
            {activeTab === "security"
              ? t("privacyDescription")
              : t("generalDescription")}
          </DialogDescription>
        </DialogHeader>
        <Tabs onValueChange={setActiveTab} value={activeTab}>
          <TabsList>
            <TabsTrigger value="general">{t("generalTab")}</TabsTrigger>
            <TabsTrigger value="security">{t("securityTab")}</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <SettingsTabForm
              locale={locale}
              onSaved={() => setOpen(false)}
              portal={portal}
            >
              <FieldGroup>
                <SlugAvailabilityField locale={locale} portal={portal} />
                <Field>
                  <FieldLabel>{t("designerName")}</FieldLabel>
                  <Input
                    name="designer_name"
                    defaultValue={portal.designer_name ?? ""}
                    placeholder={t("designerPlaceholder")}
                    maxLength={80}
                    pattern="(?:\\S+\\s+){0,7}\\S*"
                    title={t("designerLimit")}
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("website")}</FieldLabel>
                  <Input
                    name="designer_website_url"
                    defaultValue={portal.designer_website_url ?? ""}
                    placeholder={t("websitePlaceholder")}
                    inputMode="url"
                  />
                </Field>
              </FieldGroup>
            </SettingsTabForm>
          </TabsContent>
          <TabsContent value="security">
            <SettingsTabForm
              action={savePrivacySettings}
              locale={locale}
              onSaved={() => setOpen(false)}
              paidConfirmation={
                portal.visibility === "paid"
                  ? undefined
                  : {
                      cancel: t("paidConfirmationCancel"),
                      confirm: t("paidConfirmationConfirm"),
                      description: t("paidConfirmationDescription"),
                      title: t("paidConfirmationTitle"),
                    }
              }
              onPaidConfirmationClose={() => setVisibility(portal.visibility)}
              portal={portal}
            >
              <FieldGroup>
                <Field>
                  {portal.visibility === "paid" ? (
                    <output
                      aria-labelledby="paid-visibility-label"
                      id="paid-visibility-state"
                    >
                      <span
                        className="text-sm font-medium"
                        id="paid-visibility-label"
                      >
                        {t("privacy")}
                      </span>
                      <span className="block text-sm">{t("paid")}</span>
                      <input
                        aria-hidden="true"
                        name="visibility"
                        type="hidden"
                        value="paid"
                      />
                    </output>
                  ) : (
                    <>
                      <FieldLabel>{t("privacy")}</FieldLabel>
                      <input
                        name="visibility"
                        type="hidden"
                        value={visibility}
                      />
                      <Select
                        items={visibilityItems}
                        onValueChange={(value) => {
                          if (!value) return;
                          if (value === "password" && !guardPassword()) return;
                          setVisibility(value as PortalVisibility);
                        }}
                        value={visibility}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("privacyPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {visibilityItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  {visibility === "paid" ? (
                    <FieldDescription>
                      {portal.visibility === "paid"
                        ? t("paidImmutable")
                        : t("paidHelp")}
                    </FieldDescription>
                  ) : (
                    <FieldDescription>
                      {visibility === "public" && t("publicHelp")}
                      {visibility === "private" && t("privateHelp")}
                      {visibility === "password" && t("passwordHelp")}
                    </FieldDescription>
                  )}
                </Field>
                {visibility === "paid" ? (
                  <Field>
                    {connectReady === null ? (
                      <FieldDescription>
                        {t("connectChecking")}
                      </FieldDescription>
                    ) : connectReady ? (
                      <>
                        <FieldLabel htmlFor="portal-paid-price">
                          {t("paidPriceLabel")}
                        </FieldLabel>
                        <Input
                          id="portal-paid-price"
                          inputMode="decimal"
                          onChange={(event) => setPaidPrice(event.target.value)}
                          max={500}
                          min={4.35}
                          name="price"
                          placeholder="19.99"
                          required
                          step="0.01"
                          type="number"
                          value={paidPrice}
                        />
                        <input
                          name="preview_metadata"
                          type="hidden"
                          value="{}"
                        />
                        <FieldDescription>
                          {t("paidPriceHelp")}
                        </FieldDescription>
                      </>
                    ) : (
                      <>
                        <FieldDescription>
                          {t("connectRequiredForPaid")}
                        </FieldDescription>
                        <ConnectStripeButton
                          locale={locale}
                          portalId={portal.id}
                        />
                      </>
                    )}
                  </Field>
                ) : null}
                {visibility === "password" ? (
                  <Field>
                    <FieldLabel htmlFor="portal-new-password">
                      {portal.visibility === "password"
                        ? t("changePassword")
                        : t("passwordLabel")}
                    </FieldLabel>
                    <Input
                      autoComplete="new-password"
                      id="portal-new-password"
                      maxLength={128}
                      minLength={8}
                      name="password"
                      placeholder={t("passwordPlaceholder")}
                      required={portal.visibility !== "password"}
                      type="password"
                    />
                    <FieldDescription>
                      {portal.visibility === "password"
                        ? t("keepPassword")
                        : t("passwordRules")}
                    </FieldDescription>
                  </Field>
                ) : null}
              </FieldGroup>
            </SettingsTabForm>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
