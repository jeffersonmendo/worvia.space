"use client";

import { IconLoader2, IconTrash } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  deletePortalFromSettings,
  savePrivacySettings,
  updatePortalSettings,
} from "@/app/[locale]/_actions/portals";
import { usePortalPlan } from "@/components/portal/portal-plan-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
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
import { useRouter } from "@/i18n/navigation";
import { workspaceQueryKeys } from "@/infrastructure/portal/workspace-read-models";
import type { Portal, PortalVisibility } from "@/lib/supabase/database.types";

function formSnapshot(form: HTMLFormElement) {
  return JSON.stringify(Array.from(new FormData(form).entries()));
}

function SettingsForm({
  action,
  children,
  dirtyValue,
  submitDisabled = false,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  dirtyValue?: string;
  submitDisabled?: boolean;
}) {
  const t = useTranslations("PortalEditor.common");
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const initialSnapshot = useRef<string | undefined>(undefined);
  const initialDirtyValue = useRef(dirtyValue);

  useEffect(() => {
    if (formRef.current)
      initialSnapshot.current = formSnapshot(formRef.current);
  }, []);

  useEffect(() => {
    if (formRef.current) {
      setDirty(
        formSnapshot(formRef.current) !== initialSnapshot.current ||
          dirtyValue !== initialDirtyValue.current,
      );
    }
  }, [dirtyValue]);

  function handleInput(event: FormEvent<HTMLFormElement>) {
    setDirty(formSnapshot(event.currentTarget) !== initialSnapshot.current);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        await action(formData);
        await queryClient.invalidateQueries({
          queryKey: ["workspace", "home"],
        });
        initialSnapshot.current = formSnapshot(form);
        initialDirtyValue.current = dirtyValue;
        setDirty(false);
        toast.success(t("saved"));
      } catch {
        toast.error(t("saveError"));
      }
    });
  }

  return (
    <form
      className="flex flex-col gap-6"
      onInput={handleInput}
      onSubmit={handleSubmit}
      ref={formRef}
    >
      {children}
      <Button
        className="self-start"
        disabled={pending || !dirty || submitDisabled}
        type="submit"
      >
        {pending ? (
          <IconLoader2 className="animate-spin" data-icon="inline-start" />
        ) : null}
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}

export function SettingsView({
  initialConnectReady,
  hasPortalPurchase,
  initialPaidPriceCents,
  locale,
  portal,
}: {
  initialConnectReady: boolean;
  hasPortalPurchase: boolean;
  initialPaidPriceCents: number | null;
  locale: string;
  portal: Portal;
}) {
  const t = useTranslations("PortalEditor.settings");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { guardPassword } = usePortalPlan();
  const [visibility, setVisibility] = useState<PortalVisibility>(
    portal.visibility,
  );
  const [slug, setSlug] = useState(portal.slug);
  const [designerName, setDesignerName] = useState(portal.designer_name ?? "");
  const [website, setWebsite] = useState(portal.designer_website_url ?? "");
  const [contentLanguage, setContentLanguage] = useState<"en" | "es">(
    portal.content_language === "es" ? "es" : "en",
  );
  const [password, setPassword] = useState("");
  const [paidPrice, setPaidPrice] = useState(
    initialPaidPriceCents === null
      ? ""
      : (initialPaidPriceCents / 100).toFixed(2),
  );
  const [connectReady] = useState(initialConnectReady);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmationSlug, setConfirmationSlug] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const visibilityItems: { label: string; value: PortalVisibility }[] = [
    { label: t("public"), value: "public" },
    { label: t("private"), value: "private" },
    { label: t("password"), value: "password" },
    { label: t("paid"), value: "paid" },
  ];

  async function handleDelete() {
    setDeletePending(true);
    try {
      const result = await deletePortalFromSettings({
        confirmationSlug,
        locale,
        portalId: portal.id,
      });
      if (result.error) {
        toast.error(t(`deleteErrors.${result.error}` as never));
        return;
      }
      toast.success(t("deleteSuccess"));
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.home(locale),
      });
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.favorites(locale),
      });
      router.replace("/home");
      router.refresh();
    } catch {
      toast.error(t("deleteErrors.deletePortalFailed"));
    } finally {
      setDeletePending(false);
    }
  }

  async function handleCopySlug() {
    try {
      await navigator.clipboard.writeText(portal.slug);
      toast.success(t("deleteSlugCopied"));
    } catch {
      toast.error(t("deleteSlugCopyFailed"));
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-10">
      <Card className="min-w-0 w-full overflow-visible border-0 bg-transparent shadow-none ring-0">
        <CardHeader className="px-0">
          <CardTitle>{t("generalTitle")}</CardTitle>
          <CardDescription>{t("generalDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <SettingsForm
            action={updatePortalSettings}
            dirtyValue={contentLanguage}
          >
            <input name="locale" type="hidden" value={locale} />
            <input name="portal_id" type="hidden" value={portal.id} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="portal-settings-slug">
                  {t("slug")}
                </FieldLabel>
                <Input
                  id="portal-settings-slug"
                  name="slug"
                  onChange={(event) => setSlug(event.target.value)}
                  required
                  value={slug}
                />
              </Field>
              <Field>
                <FieldLabel>{t("designerName")}</FieldLabel>
                <Input
                  name="designer_name"
                  onChange={(event) => setDesignerName(event.target.value)}
                  placeholder={t("designerPlaceholder")}
                  value={designerName}
                />
              </Field>
              <Field>
                <FieldLabel>{t("website")}</FieldLabel>
                <Input
                  name="designer_website_url"
                  onChange={(event) => setWebsite(event.target.value)}
                  placeholder={t("websitePlaceholder")}
                  value={website}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="portal-settings-ai-language">
                  {t("aiLanguage")}
                </FieldLabel>
                <Select
                  name="content_language"
                  onValueChange={(value) =>
                    setContentLanguage(value as "en" | "es")
                  }
                  value={contentLanguage}
                >
                  <SelectTrigger id="portal-settings-ai-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="es">{t("spanish")}</SelectItem>
                      <SelectItem value="en">{t("english")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {t("aiLanguageDescription")}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </SettingsForm>
        </CardContent>
      </Card>

      <Card className="min-w-0 w-full overflow-visible border-0 bg-transparent shadow-none ring-0">
        <CardHeader className="px-0">
          <CardTitle>{t("securityTab")}</CardTitle>
          <CardDescription>{t("privacyDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <SettingsForm
            action={savePrivacySettings}
            dirtyValue={visibility}
            submitDisabled={visibility === "paid" && connectReady !== true}
          >
            <input name="locale" type="hidden" value={locale} />
            <input name="portal_id" type="hidden" value={portal.id} />
            <FieldGroup>
              <Field>
                <FieldLabel>{t("privacy")}</FieldLabel>
                {portal.visibility === "paid" ? (
                  <>
                    <input name="visibility" type="hidden" value="paid" />
                    <FieldDescription>{t("paidImmutable")}</FieldDescription>
                  </>
                ) : (
                  <Select
                    items={visibilityItems}
                    name="visibility"
                    onValueChange={(value) => {
                      if (value === "password" && !guardPassword()) return;
                      setVisibility(value as PortalVisibility);
                    }}
                    value={visibility}
                  >
                    <SelectTrigger>
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
                )}
                {portal.visibility !== "paid" ? (
                  <FieldDescription>
                    {visibility === "paid"
                      ? t("paidHelp")
                      : visibility === "public"
                        ? t("publicHelp")
                        : visibility === "private"
                          ? t("privateHelp")
                          : t("passwordHelp")}
                  </FieldDescription>
                ) : null}
              </Field>
              {visibility === "paid" ? (
                <Field>
                  {connectReady === null ? (
                    <FieldDescription>{t("connectChecking")}</FieldDescription>
                  ) : connectReady ? (
                    <>
                      <FieldLabel htmlFor="portal-paid-price">
                        {t("paidPriceLabel")}
                      </FieldLabel>
                      <Input
                        id="portal-paid-price"
                        inputMode="decimal"
                        max={500}
                        min={4.35}
                        name="price"
                        onChange={(event) => setPaidPrice(event.target.value)}
                        placeholder="19.99"
                        required
                        step="0.01"
                        type="number"
                        value={paidPrice}
                      />
                      <input name="preview_metadata" type="hidden" value="{}" />
                      <FieldDescription>{t("paidPriceHelp")}</FieldDescription>
                    </>
                  ) : (
                    <>
                      <FieldDescription>
                        {t("connectRequiredForPaid")}
                      </FieldDescription>
                      <Button
                        onClick={() =>
                          window.location.assign(
                            `/${locale}/home?connect=onboarding&portalId=${encodeURIComponent(portal.id)}`,
                          )
                        }
                        type="button"
                        variant="outline"
                      >
                        {t("configureConnect")}
                      </Button>
                    </>
                  )}
                </Field>
              ) : null}
              {visibility === "password" ? (
                <Field>
                  <FieldLabel htmlFor="portal-settings-password">
                    {portal.visibility === "password"
                      ? t("changePassword")
                      : t("passwordLabel")}
                  </FieldLabel>
                  <Input
                    id="portal-settings-password"
                    minLength={8}
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    required={portal.visibility !== "password"}
                    type="password"
                    value={password}
                  />
                  <FieldDescription>
                    {portal.visibility === "password"
                      ? t("keepPassword")
                      : t("passwordRules")}
                  </FieldDescription>
                </Field>
              ) : null}
            </FieldGroup>
          </SettingsForm>
        </CardContent>
      </Card>

      <Card className="min-w-0 w-full overflow-visible border-0 bg-transparent shadow-none ring-0">
        <CardHeader className="px-0">
          <CardTitle>{t("deleteTitle")}</CardTitle>
          <CardDescription>{t("deleteDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Button
            onClick={() => setDeleteOpen(true)}
            type="button"
            variant="destructive"
          >
            <IconTrash data-icon="inline-start" />
            {t("deleteTrigger")}
          </Button>
        </CardContent>
      </Card>

      <Dialog
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setConfirmationSlug("");
        }}
        open={deleteOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteModalTitle")}</DialogTitle>
            <DialogDescription>
              {hasPortalPurchase ? (
                t("deleteBlockedDescription")
              ) : (
                <>
                  {t("deleteModalDescription")}
                  <Button
                    className="h-auto p-0 font-semibold underline underline-offset-4"
                    onClick={handleCopySlug}
                    type="button"
                    variant="link"
                  >
                    {portal.slug}
                  </Button>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {hasPortalPurchase ? (
            <DialogFooter>
              <Button onClick={() => setDeleteOpen(false)} type="button">
                {t("deleteUnderstand")}
              </Button>
            </DialogFooter>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="delete-project-slug">
                  {t("deleteSlugLabel")}
                </FieldLabel>
                <Input
                  autoComplete="off"
                  id="delete-project-slug"
                  onChange={(event) => setConfirmationSlug(event.target.value)}
                  placeholder={portal.slug}
                  value={confirmationSlug}
                />
              </Field>
              <DialogFooter>
                <Button
                  disabled={deletePending}
                  onClick={() => setDeleteOpen(false)}
                  type="button"
                  variant="outline"
                >
                  {t("deleteCancel")}
                </Button>
                <Button
                  disabled={deletePending || confirmationSlug !== portal.slug}
                  onClick={handleDelete}
                  type="button"
                  variant="destructive"
                >
                  {deletePending ? (
                    <IconLoader2
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  ) : null}
                  {deletePending ? t("deleteDeleting") : t("deleteConfirm")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
