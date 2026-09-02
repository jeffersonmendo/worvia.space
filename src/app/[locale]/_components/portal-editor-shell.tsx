"use client";

import { Blobatar } from "blobatar/react";
import "blobatar/motion.css";
import {
  IconAdjustmentsFilled,
  IconArrowLeft,
  IconChevronDown,
  IconCoinFilled,
  IconExternalLink,
  IconHomeFilled,
  IconPlus,
  IconSettingsFilled,
  IconSortDescending,
  IconSpiral,
  IconStarFilled,
  IconUpload,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  WORKSPACE_BOTTOM_TOOLBAR_SURFACE_CLASS,
  WORKSPACE_EMBEDDED_HEADER_CANVAS_OFFSET_CLASS,
  WORKSPACE_HEADER_POSITION_CLASS,
  workspaceHeaderClass,
} from "@/components/portal/portal-workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type PortalEditorShellProps = {
  children: ReactNode;
  projectName: string;
  favorites?: string[];
  onAddSection?: () => void;
  onBack?: () => void;
  onPublish?: () => void;
  onUpload?: () => void;
  published?: boolean;
  publishProps?: React.ComponentProps<typeof Button>;
};

const account = {
  email: "jeffer...343@gmail.com",
  name: "Jefferson Lopez Mendoza",
};

/** Local-only composition of the same primitives used by the workspace shell. */
export function PortalEditorShell({
  children,
  favorites = [],
  onAddSection,
  onBack,
  onPublish,
  onUpload,
  publishProps,
  projectName,
  published = false,
}: PortalEditorShellProps) {
  const t = useTranslations("Landing.editorShell");
  const projectLinks = [
    { icon: IconHomeFilled, label: t("projects") },
    { active: true, icon: IconSpiral, label: projectName },
    { icon: IconAdjustmentsFilled, label: t("planUsage") },
    { icon: IconSettingsFilled, label: t("generalSettings") },
  ];

  return (
    <SidebarProvider
      className="relative h-full min-h-0! overflow-hidden rounded-[1.25rem] border border-border/60 bg-background text-left text-foreground shadow-2xl"
      style={{ "--sidebar-width": "19rem" } as React.CSSProperties}
    >
      <Sidebar
        className="absolute! inset-y-0! h-full! [&_[data-slot=sidebar-inner]]:shadow-none"
        collapsible="icon"
        desktopOnly
        variant="floating"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <IconSpiral className="size-8!" />
                <span className="font-semibold">{t("project")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t("project")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {projectLinks.map(({ active, icon: Icon, label }) => (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton isActive={active}>
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>{t("favorites")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {favorites.map((favorite) => (
                  <SidebarMenuItem key={favorite}>
                    <SidebarMenuButton>
                      <IconStarFilled />
                      <span className="truncate">{favorite}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="h-16!" size="lg">
                <Blobatar
                  animate="always"
                  aria-label={account.name}
                  className="size-10! shrink-0"
                  name={account.email}
                  size={40}
                />
                <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{account.name}</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    {account.email}
                  </span>
                </span>
                <IconChevronDown className="ml-auto" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="ml-0! mr-0 h-full min-h-0 min-w-0 overflow-hidden bg-background">
        <header
          className={workspaceHeaderClass(
            WORKSPACE_HEADER_POSITION_CLASS.inset,
          )}
        >
          <div className="flex items-center gap-2">
            <Button
              aria-label={t("back")}
              className="inline-flex"
              onClick={onBack}
              size="icon"
              variant="ghost"
            >
              <IconArrowLeft />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="inline-flex" variant="secondary">
              <IconCoinFilled className="text-primary" />
              <span>58</span>
            </Badge>
            <Button
              className="rounded-full"
              onClick={onPublish}
              type="button"
              variant="default"
              {...publishProps}
            >
              {published ? t("published") : t("publish")}
            </Button>
          </div>
        </header>

        <div
          data-demo-scroll-owner
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            WORKSPACE_EMBEDDED_HEADER_CANVAS_OFFSET_CLASS,
          )}
        >
          {children}
        </div>

        <header
          className={cn(
            "absolute bottom-6 left-1/2",
            WORKSPACE_BOTTOM_TOOLBAR_SURFACE_CLASS,
          )}
        >
          <Button
            className="inline-flex"
            onClick={onBack}
            type="button"
            variant="secondary"
          >
            <IconArrowLeft data-icon="inline-start" />
            {t("back")}
          </Button>
          <Button
            aria-label={t("sortSections")}
            onClick={onAddSection}
            size="icon"
            type="button"
            variant="ghost"
          >
            <IconSortDescending />
          </Button>
          <Button
            aria-label={t("addSection")}
            onClick={onAddSection}
            size="icon"
            type="button"
            variant="ghost"
          >
            <IconPlus />
          </Button>
          <Button
            aria-label={t("openPublication")}
            size="icon"
            type="button"
            variant="ghost"
          >
            <IconExternalLink />
          </Button>
          <Button
            className="inline-flex"
            onClick={onUpload}
            type="button"
            variant="default"
          >
            <IconUpload data-icon="inline-start" />
            {t("addWithAi")}
          </Button>
        </header>
      </SidebarInset>
    </SidebarProvider>
  );
}
