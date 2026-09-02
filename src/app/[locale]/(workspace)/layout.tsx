import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { AiWorkflowReconciler } from "./_components/ai-workflow-reconciler";
import {
  WorkspaceConfigDrawer,
  WorkspaceConfigSidebar,
  WorkspaceSidebar,
  WorkspaceSidebarProvider,
} from "./_components/workspace-sidebar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = hasSupabaseEnv()
    ? (await (await createClient()).auth.getUser()).data.user
    : null;

  return (
    <WorkspaceSidebarProvider>
      <SidebarProvider>
        <AiWorkflowReconciler />
        <WorkspaceSidebar
          locale={locale}
          user={
            user
              ? {
                  email: user.email ?? "",
                  name:
                    typeof user.user_metadata.full_name === "string" &&
                    user.user_metadata.full_name.trim()
                      ? user.user_metadata.full_name.trim()
                      : (user.email ?? ""),
                }
              : null
          }
        />
        <SidebarInset>{children}</SidebarInset>
        <WorkspaceConfigSidebar />
        <WorkspaceConfigDrawer />
      </SidebarProvider>
    </WorkspaceSidebarProvider>
  );
}
