"use client";

import {
  IconArrowLeft,
  IconCoinFilled,
  IconExternalLink,
  IconLoader2,
  IconPlus,
  IconSearch,
  IconSortDescending,
  IconSpiral,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { toast } from "sonner";
import { usePortalEditorStore } from "@/application/portal/editor-store";
import {
  WORKSPACE_BOTTOM_TOOLBAR_SURFACE_CLASS,
  WORKSPACE_HEADER_POSITION_CLASS,
  workspaceHeaderClass,
} from "@/components/portal/portal-workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PortalPublicationTarget } from "@/domain/portal/publication-readiness";
import { Link } from "@/i18n/navigation";
import {
  canAffordAiOperation,
  useAiCredits,
} from "@/lib/billing/ai-credits-client";
import {
  focusPortalPublicationTarget,
  PORTAL_OPEN_ADD_SECTION_DIALOG_EVENT,
} from "@/lib/portal/scroll-to-section";
import { cn } from "@/lib/utils";

function dispatchWorkspaceAction(action: "order" | "publish" | "upload") {
  window.dispatchEvent(new CustomEvent(`portal-workspace:${action}`));
}

const EMPTY_PUBLICATION_ISSUES: never[] = [];

function dispatchAddSectionAction() {
  document.dispatchEvent(
    new CustomEvent(PORTAL_OPEN_ADD_SECTION_DIALOG_EVENT, {
      detail: { key: "portal-add-section" },
    }),
  );
}

export function PortalWorkspaceToolbar({
  backHref = "/home",
  contentOnly = false,
  initialHasUnpublishedChanges = true,
  mode = "editor",
  portalId,
  portalSlug,
  searchValue = "",
  onSearchChange,
  searchPlaceholder,
  searchClearLabel,
}: {
  backHref?: string;
  contentOnly?: boolean;
  initialHasUnpublishedChanges?: boolean;
  mode?: "editor" | "home" | "create" | "connect";
  portalId?: string;
  portalSlug?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchClearLabel?: string;
}) {
  const t = useTranslations("PortalEditor");
  const locale = useLocale();
  const { data: creditBalance } = useAiCredits();
  const formattedCredits =
    creditBalance === undefined
      ? "…"
      : new Intl.NumberFormat(locale).format(creditBalance.available);
  const canAddWithAi =
    creditBalance === undefined ||
    canAffordAiOperation(creditBalance.available, "improve-project");
  const openAiUpload = () => {
    if (!canAddWithAi) {
      toast.warning(t("ai.insufficientCredits"));
      return;
    }
    dispatchWorkspaceAction("upload");
  };
  const hasUnpublishedChanges = usePortalEditorStore((state) =>
    portalId ? state.hasUnpublishedChangesByPortalId[portalId] : undefined,
  );
  const canPublish = hasUnpublishedChanges ?? initialHasUnpublishedChanges;
  const isHome = mode === "home" || mode === "connect";
  const isCreate = mode === "create";
  const publishingPortalId = usePortalEditorStore(
    (state) => state.publishingPortalId,
  );
  const isPublishing = publishingPortalId === portalId;
  const publicationIssues =
    usePortalEditorStore(
      (state) => state.publicationIssuesByPortalId[portalId ?? ""],
    ) ?? EMPTY_PUBLICATION_ISSUES;
  const publicationPopoverOpen = usePortalEditorStore(
    (state) => state.publicationPopoverOpenByPortalId[portalId ?? ""] ?? false,
  );
  const setPublicationPopoverOpen = usePortalEditorStore(
    (state) => state.setPublicationPopoverOpen,
  );
  const pendingPublicationTargetRef = useRef<PortalPublicationTarget | null>(
    null,
  );
  const publicationClickRef = useRef(false);

  return (
    <>
      <header
        className={workspaceHeaderClass(
          WORKSPACE_HEADER_POSITION_CLASS.viewport,
        )}
      >
        <div className="flex items-center gap-2">
          {!isHome ? (
            <Button
              aria-label={t("workspace.back")}
              className="hidden lg:inline-flex"
              nativeButton={false}
              render={<Link href={backHref} />}
              size="icon"
              variant="ghost"
            >
              <IconArrowLeft />
            </Button>
          ) : null}
          <SidebarTrigger className="lg:hidden" />
        </div>

        <Button
          aria-label={t("workspace.projects")}
          className="absolute left-1/2 hover:bg-transparent -translate-x-1/2 lg:hidden"
          nativeButton={false}
          render={<Link href="/home" />}
          size="icon-lg"
          variant="ghost"
        >
          <IconSpiral className="size-8" />
        </Button>

        <div className="flex items-center justify-end gap-2">
          <Popover>
            <PopoverTrigger
              render={
                <Badge
                  aria-label={t("workspace.credits.badge", {
                    count: formattedCredits,
                  })}
                  className="hidden cursor-pointer lg:inline-flex"
                  render={<button type="button" />}
                  variant="secondary"
                />
              }
            >
              <IconCoinFilled className="size-4 text-primary" />
              <span>{formattedCredits}</span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <PopoverHeader>
                <PopoverTitle>{t("workspace.credits.title")}</PopoverTitle>
                <PopoverDescription>
                  {t("workspace.credits.description")}
                </PopoverDescription>
              </PopoverHeader>
              <Button
                onClick={() =>
                  window.dispatchEvent(new Event("billing:credits-upgrade"))
                }
                size="sm"
                type="button"
                variant="default"
              >
                {t("workspace.credits.upgrade")}
              </Button>
            </PopoverContent>
          </Popover>
          {contentOnly ? (
            <Button
              aria-label={t("workspace.goToProject")}
              nativeButton={false}
              render={<Link href={backHref} />}
              type="button"
              variant="default"
            >
              {t("workspace.goToProject")}
            </Button>
          ) : isHome ? (
            <Button
              aria-label={t("workspace.createProject")}
              nativeButton={false}
              render={<Link href="/create" />}
              type="button"
              variant="default"
            >
              {t("workspace.createProject")}
            </Button>
          ) : isCreate ? (
            <Button
              aria-label={t("workspace.projects")}
              nativeButton={false}
              render={<Link href="/home" />}
              type="button"
              variant="default"
            >
              {t("workspace.projects")}
            </Button>
          ) : (
            <Popover
              onOpenChange={(open) => {
                if (!open && publicationClickRef.current) return;
                if (open && publicationIssues.length === 0) return;
                setPublicationPopoverOpen(portalId ?? "", open);
              }}
              onOpenChangeComplete={(open) => {
                if (open || !pendingPublicationTargetRef.current) return;
                const target = pendingPublicationTargetRef.current;
                pendingPublicationTargetRef.current = null;
                focusPortalPublicationTarget(target);
              }}
              open={publicationPopoverOpen}
            >
              <PopoverTrigger
                render={
                  <Button
                    disabled={!canPublish || isPublishing}
                    onClick={() => {
                      publicationClickRef.current = true;
                      dispatchWorkspaceAction("publish");
                      queueMicrotask(() => {
                        publicationClickRef.current = false;
                      });
                    }}
                    type="button"
                    variant="default"
                  />
                }
              >
                {isPublishing ? (
                  <IconLoader2
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                {isPublishing
                  ? t("workspace.publishing")
                  : t("workspace.publish")}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <PopoverHeader>
                  <PopoverTitle>
                    {t("workspace.publication.title")}
                  </PopoverTitle>
                  <PopoverDescription>
                    {t("workspace.publication.description")}
                  </PopoverDescription>
                </PopoverHeader>
                <ul className="flex flex-col gap-2">
                  {publicationIssues.map((issue) => (
                    <li
                      className="flex items-center justify-between gap-3 rounded-md border p-2"
                      key={`${issue.code}-${"sectionId" in issue ? issue.sectionId : "portal"}`}
                    >
                      <span className="text-sm">
                        {t(`workspace.publication.issues.${issue.code}`)}
                      </span>
                      <Button
                        onClick={() => {
                          pendingPublicationTargetRef.current = issue.target;
                          setPublicationPopoverOpen(portalId ?? "", false);
                        }}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        {t("workspace.publication.fix")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </header>
      <div aria-hidden="true" className="h-20" />

      {mode === "home" && onSearchChange && searchPlaceholder ? (
        <header className="fixed bottom-6 left-[calc(var(--sidebar-offset)+(100vw-var(--sidebar-offset))/2)] z-50 flex w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 items-center justify-center rounded-3xl border border-border/60 bg-sidebar/70 p-1 shadow-lg backdrop-blur-xl">
          <InputGroup className="border-0 bg-transparent shadow-none ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-0 has-[[data-slot=input-group-control]:focus-visible]:ring-0">
            <InputGroupInput
              aria-label={searchPlaceholder}
              className="border-0 ring-0 focus:border-0 focus:ring-0 focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              value={searchValue}
            />
            <InputGroupAddon className="bg-transparent">
              <IconSearch />
            </InputGroupAddon>
            {searchValue ? (
              <InputGroupAddon align="inline-end" className="bg-transparent">
                <InputGroupButton
                  aria-label={searchClearLabel}
                  className="bg-transparent"
                  onClick={() => onSearchChange("")}
                  size="icon-xs"
                >
                  <IconX />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        </header>
      ) : null}

      <header
        className={
          contentOnly || mode !== "editor"
            ? "hidden"
            : cn(
                "fixed bottom-6 left-1/2 lg:left-[calc(var(--sidebar-offset)+(100vw-var(--sidebar-offset)-var(--portal-right-sidebar-width,0px))/2)]",
                WORKSPACE_BOTTOM_TOOLBAR_SURFACE_CLASS,
              )
        }
      >
        <Button
          aria-label={t("workspace.back")}
          className="hidden lg:inline-flex"
          nativeButton={false}
          render={<Link href="/home" />}
          type="button"
          variant="secondary"
        >
          <IconArrowLeft data-icon="inline-start" />
          {t("workspace.back")}
        </Button>
        <Button
          aria-label={t("workspace.back")}
          className="inline-flex lg:hidden"
          nativeButton={false}
          render={<Link href="/home" />}
          size="icon"
          variant="secondary"
        >
          <IconArrowLeft />
        </Button>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                aria-label={t("sections.order")}
                onClick={() => dispatchWorkspaceAction("order")}
                size="icon"
                type="button"
                variant="ghost"
              >
                <IconSortDescending />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("sections.order")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                aria-label={t("sections.add")}
                onClick={dispatchAddSectionAction}
                size="icon"
                type="button"
                variant="ghost"
              >
                <IconPlus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("sections.add")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                aria-label={t("workspace.openPublished")}
                nativeButton={false}
                render={
                  <Link
                    href={`/p/${encodeURIComponent(portalSlug ?? "")}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  />
                }
                size="icon"
                variant="ghost"
              >
                <IconExternalLink />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("workspace.openPublished")}</TooltipContent>
          </Tooltip>
          <Button
            aria-label={t("ai.addWithAiLabel")}
            className="hidden lg:inline-flex"
            aria-disabled={!canAddWithAi || undefined}
            onClick={openAiUpload}
            type="button"
            variant="default"
          >
            <IconUpload data-icon="inline-start" />
            {t("ai.addWithAiLabel")}
          </Button>
          <Button
            aria-label={t("ai.addWithAiLabel")}
            className="inline-flex lg:hidden"
            aria-disabled={!canAddWithAi || undefined}
            onClick={openAiUpload}
            size="icon"
            type="button"
            variant="default"
          >
            <IconUpload />
          </Button>
        </div>
      </header>
    </>
  );
}
