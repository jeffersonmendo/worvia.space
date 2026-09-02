"use client";

import type { IconHome } from "@tabler/icons-react";
import {
  IconAdjustmentsFilled,
  IconBrandStripeFilled,
  IconHomeFilled,
  IconLoader2,
  IconPlusFilled,
  IconSettingsFilled,
  IconSpiral,
  IconStarFilled,
  IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useShallow } from "zustand/react/shallow";
import { signOut } from "@/app/[locale]/_actions/auth";
import { getRecentWorkspaceFavorites } from "@/app/[locale]/_actions/portals";
import type { WorkspaceSidebarUser } from "@/app/[locale]/(workspace)/_components/workspace-sidebar-user";
import { WorkspaceSidebarUser as WorkspaceSidebarUserMenu } from "@/app/[locale]/(workspace)/_components/workspace-sidebar-user";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";
import { workspaceQueryKeys } from "@/infrastructure/portal/workspace-read-models";
import { useAiWorkflowStore } from "@/lib/portal/ai-workflow-store";
import { cn } from "@/lib/utils";

type ProjectMeta = { id: string; name: string };
type ConfigDrawerHeader = { description: string; title: string };
type WorkspaceSidebarContextValue = {
  closeConfigDrawer: () => void;
  configDrawerCloseVersion: number;
  configDrawerHeader: ConfigDrawerHeader | null;
  configDrawerHost: HTMLDivElement | null;
  configSidebarHost: HTMLDivElement | null;
  configSidebarOpen: boolean;
  project: ProjectMeta | null;
  setConfigDrawerHost: (host: HTMLDivElement | null) => void;
  setConfigDrawerHeader: (header: ConfigDrawerHeader | null) => void;
  setConfigSidebarHost: (host: HTMLDivElement | null) => void;
  setConfigSidebarOpen: (open: boolean) => void;
  setProject: (project: ProjectMeta | null) => void;
};

const WorkspaceSidebarContext =
  createContext<WorkspaceSidebarContextValue | null>(null);

export function WorkspaceSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [configSidebarOpen, setConfigSidebarOpen] = useState(false);
  const [configSidebarHost, setConfigSidebarHost] =
    useState<HTMLDivElement | null>(null);
  const [configDrawerHost, setConfigDrawerHost] =
    useState<HTMLDivElement | null>(null);
  const [configDrawerCloseVersion, setConfigDrawerCloseVersion] = useState(0);
  const [configDrawerHeader, setConfigDrawerHeader] =
    useState<ConfigDrawerHeader | null>(null);
  const closeConfigDrawer = useCallback(() => {
    setConfigSidebarOpen(false);
    setConfigDrawerCloseVersion((version) => version + 1);
  }, []);
  const value = useMemo(
    () => ({
      closeConfigDrawer,
      configDrawerCloseVersion,
      configDrawerHeader,
      configDrawerHost,
      configSidebarHost,
      configSidebarOpen,
      project,
      setConfigDrawerHost,
      setConfigDrawerHeader,
      setConfigSidebarHost,
      setConfigSidebarOpen,
      setProject,
    }),
    [
      closeConfigDrawer,
      configDrawerCloseVersion,
      configDrawerHeader,
      configDrawerHost,
      configSidebarHost,
      configSidebarOpen,
      project,
    ],
  );
  return (
    <WorkspaceSidebarContext.Provider value={value}>
      {children}
    </WorkspaceSidebarContext.Provider>
  );
}

export function useWorkspaceConfigSidebar() {
  const context = useContext(WorkspaceSidebarContext);
  if (!context) {
    throw new Error(
      "useWorkspaceConfigSidebar must be used within WorkspaceSidebarProvider.",
    );
  }
  return context;
}

export function useOptionalWorkspaceConfigSidebar() {
  return useContext(WorkspaceSidebarContext);
}

export function WorkspaceConfigSidebar() {
  const isMobile = useIsMobileConfigViewport();
  const { configSidebarOpen, setConfigSidebarHost } =
    useWorkspaceConfigSidebar();
  const [configSidebarMounted, setConfigSidebarMounted] =
    useState(configSidebarOpen);

  useEffect(() => {
    if (configSidebarOpen) setConfigSidebarMounted(true);
  }, [configSidebarOpen]);

  if (!configSidebarMounted || isMobile) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "hidden shrink-0 transition-[width] duration-300 ease-out md:block",
          configSidebarOpen ? "w-(--sidebar-width)" : "w-0",
        )}
      />
      <Sidebar
        collapsible="none"
        className={cn(
          "fixed inset-y-0 right-0 hidden h-svh w-(--sidebar-width) bg-transparent p-2 backdrop-blur-none md:flex",
          configSidebarOpen
            ? "animate-in fade-in-0 slide-in-from-right-8 duration-300 ease-out"
            : "animate-out fade-out-0 slide-out-to-right-8 duration-200 ease-in",
        )}
        onAnimationEnd={(event) => {
          if (event.currentTarget !== event.target) return;
          if (!configSidebarOpen) setConfigSidebarMounted(false);
        }}
        side="right"
      >
        <div className="flex h-full flex-col rounded-3xl bg-sidebar/50 ring-1 ring-sidebar-border backdrop-blur-xl">
          <SidebarContent
            className="min-h-0 flex-1 overflow-y-auto p-2"
            ref={setConfigSidebarHost}
          />
        </div>
      </Sidebar>
    </>
  );
}

function useIsMobileConfigViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isMobile;
}

export function WorkspaceConfigDrawer() {
  const isMobile = useIsMobileConfigViewport();
  const {
    closeConfigDrawer,
    configDrawerHeader,
    configSidebarOpen,
    setConfigDrawerHost,
  } = useWorkspaceConfigSidebar();

  if (!isMobile) return null;

  return (
    <Drawer
      open={configSidebarOpen}
      onOpenChange={(open) => {
        if (!open) closeConfigDrawer();
      }}
      showSwipeHandle
      swipeDirection="down"
    >
      <DrawerContent className="h-[80dvh] overflow-hidden rounded-t-2xl p-0">
        {configDrawerHeader ? (
          <DrawerHeader className="border-b px-4 py-3">
            <DrawerTitle>{configDrawerHeader.title}</DrawerTitle>
            <DrawerDescription>
              {configDrawerHeader.description}
            </DrawerDescription>
          </DrawerHeader>
        ) : null}
        <div
          className="min-h-0 flex-1 overflow-y-auto"
          ref={setConfigDrawerHost}
        />
      </DrawerContent>
    </Drawer>
  );
}

export function useWorkspaceSidebarTitle() {
  const pathname = usePathname();
  const t = useTranslations("PortalEditor");
  const workspace = useContext(WorkspaceSidebarContext);
  const project = pathname.match(/^\/create\/([^/]+)/);
  return project
    ? (workspace?.project?.name ?? t("workspace.project"))
    : pathname === "/create"
      ? t("workspace.createProject")
      : t("workspace.projects");
}

export function WorkspaceMobileTitle() {
  return (
    <span className="text-sm font-medium">{useWorkspaceSidebarTitle()}</span>
  );
}

export function WorkspaceProjectRegistration({
  project,
}: {
  project: ProjectMeta;
}) {
  const context = useContext(WorkspaceSidebarContext);
  useEffect(() => {
    context?.setProject(project);
    return () => context?.setProject(null);
  }, [context, project]);
  return null;
}

function MenuLink({
  active,
  children,
  href,
  icon: Icon,
}: {
  active?: boolean;
  children: React.ReactNode;
  href: string;
  icon: typeof IconHome;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        onClick={() => {
          if (isMobile) setOpenMobile(false);
        }}
        render={<Link href={href} />}
      >
        <Icon />
        <span>{children}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function WorkspaceSidebar({
  locale,
  user,
}: {
  locale: string;
  user: WorkspaceSidebarUser | null;
}) {
  const pathname = usePathname();
  const t = useTranslations("PortalEditor");
  const projectMatch = pathname.match(/\/create\/([^/]+)/);
  const inProject = Boolean(projectMatch?.[1]);
  const title = useWorkspaceSidebarTitle();
  const sidebarHeaderLabel =
    pathname === "/home" ? t("workspace.all") : t("workspace.portal");
  const signOutFormRef = useRef<HTMLFormElement>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const activeAiJobs = useAiWorkflowStore(
    useShallow((state) =>
      Object.values(state.jobsById).filter(
        (job) =>
          job.status === "loading" &&
          !(
            job.kind === "portal-operation" && job.requestId.endsWith(":apply")
          ),
      ),
    ),
  );
  const aiWorkflowTitle = (job: (typeof activeAiJobs)[number]) => {
    if (job.operation === "generate")
      return t("workspace.aiCreatingProjectTitle");
    if (job.operation === "refine-copy")
      return t("workspace.aiImproveWithAiTitle");
    return t("workspace.aiAddWithAiTitle");
  };
  const aiWorkflowProgress = (job: (typeof activeAiJobs)[number]) => {
    if (job.progress === "analyzing-assets" && job.progressDetail?.batch) {
      return t("workspace.aiBatchLabel", {
        batch: job.progressDetail.batch,
        total: job.progressDetail.total,
      });
    }
    if (job.progress === "generating-copy")
      return t("workspace.aiGeneratingCopy");
    if (job.progress === "generating-structure")
      return t("workspace.aiGeneratingStructure");
    if (job.progress === "applying") return t("workspace.aiApplying");
    return t("workspace.aiPreparing");
  };
  const favoritesQuery = useQuery({
    enabled: Boolean(user),
    queryKey: workspaceQueryKeys.favorites(locale),
    queryFn: async () => {
      const rows = await getRecentWorkspaceFavorites(locale);
      return rows.flatMap((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return [];
        const item = row as Record<string, unknown>;
        return typeof item.id === "string" &&
          typeof item.portalId === "string" &&
          typeof item.name === "string"
          ? [{ id: item.id, portalId: item.portalId, name: item.name }]
          : [];
      });
    },
    staleTime: 30_000,
  });

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/home" />} size="lg">
              <IconSpiral className="size-8!" />
              <span className="font-semibold">{sidebarHeaderLabel}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {inProject ? (
          <SidebarGroup>
            <SidebarGroupLabel>{t("workspace.project")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <MenuLink
                  active={pathname === "/home"}
                  href="/home"
                  icon={IconHomeFilled}
                >
                  {t("workspace.projects")}
                </MenuLink>
                <MenuLink
                  active={pathname === `/create/${projectMatch?.[1]}`}
                  href={`/create/${projectMatch?.[1]}`}
                  icon={IconSpiral}
                >
                  {title}
                </MenuLink>
                <MenuLink
                  active={pathname === `/create/${projectMatch?.[1]}/usage`}
                  href={`/create/${projectMatch?.[1]}/usage`}
                  icon={IconAdjustmentsFilled}
                >
                  {t("plan.usageTitle")}
                </MenuLink>
                <MenuLink
                  active={pathname === `/create/${projectMatch?.[1]}/settings`}
                  href={`/create/${projectMatch?.[1]}/settings`}
                  icon={IconSettingsFilled}
                >
                  {t("settings.generalTitle")}
                </MenuLink>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>{t("workspace.workspace")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <MenuLink
                  active={pathname === "/home"}
                  href="/home"
                  icon={IconHomeFilled}
                >
                  {t("workspace.projects")}
                </MenuLink>
                <MenuLink href="/create" icon={IconPlusFilled}>
                  {t("workspace.createProject")}
                </MenuLink>
                <MenuLink href="/stripe-connect" icon={IconBrandStripeFilled}>
                  {t("workspace.connectStripe")}
                </MenuLink>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {activeAiJobs.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>{t("workspace.aiWorkflows")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {activeAiJobs.map((job) => (
                  <SidebarMenuItem key={job.id}>
                    <SidebarMenuButton
                      className="h-auto min-h-8 py-3"
                      render={<Link href={`/create/${job.portalId}`} />}
                    >
                      <IconLoader2 className="animate-spin" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">
                          {job.portalName ?? t("workspace.aiUntitledProject")}
                        </span>
                        <span className="truncate text-xs font-normal text-sidebar-foreground/70">
                          {aiWorkflowTitle(job)} · {aiWorkflowProgress(job)}
                        </span>
                      </span>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      aria-label={t("workspace.aiCancelAction")}
                      className="top-1/2! -translate-y-1/2!"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        window.dispatchEvent(
                          new CustomEvent("portal-ai-workflow-cancel", {
                            detail: job.id,
                          }),
                        );
                      }}
                      title={t("workspace.aiCancelAction")}
                    >
                      <IconX />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
        <SidebarGroup>
          <SidebarGroupLabel>{t("workspace.favorites")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {favoritesQuery.data?.length ? (
                favoritesQuery.data.map((favorite) => (
                  <SidebarMenuItem key={favorite.id}>
                    <SidebarMenuButton
                      render={<Link href={`/create/${favorite.portalId}`} />}
                    >
                      <IconStarFilled />
                      <span className="truncate">{favorite.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <SidebarMenuItem>
                  <span className="px-2 text-xs text-sidebar-foreground/70">
                    {t("workspace.noFavorites")}
                  </span>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user ? (
          <>
            <form action={signOut} className="hidden" ref={signOutFormRef}>
              <input name="locale" type="hidden" value={locale} />
            </form>
            <WorkspaceSidebarUserMenu
              locale={locale}
              onSignOut={() => setSignOutOpen(true)}
              user={user}
            />
          </>
        ) : null}
      </SidebarFooter>
      <Dialog onOpenChange={setSignOutOpen} open={signOutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workspace.signOutTitle")}</DialogTitle>
            <DialogDescription>
              {t("workspace.signOutDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("workspace.cancel")}
            </DialogClose>
            <Button
              onClick={() => signOutFormRef.current?.requestSubmit()}
              type="button"
            >
              {t("workspace.signOutConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
