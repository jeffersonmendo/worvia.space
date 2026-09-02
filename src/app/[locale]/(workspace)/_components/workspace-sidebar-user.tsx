"use client";

import { Blobatar } from "blobatar/react";
import "blobatar/motion.css";
import {
  IconChevronDown,
  IconCoins,
  IconLanguage,
  IconLogout,
  IconMessage2,
  IconPalette,
  IconWorld,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAiCredits } from "@/lib/billing/ai-credits-client";

export type WorkspaceSidebarUser = {
  name: string;
  email: string;
};

// Fallback until a product feedback route or provider is configured.
const feedbackHref =
  "mailto:feedback@example.com?subject=Portals%20Design%20feedback";

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;

  if (localPart.length <= 9) return email;

  return `${localPart.slice(0, 6)}...${localPart.slice(-3)}@${domain}`;
}

export function WorkspaceSidebarUser({
  locale,
  user,
  onSignOut,
}: {
  locale: string;
  user: WorkspaceSidebarUser;
  onSignOut: () => void;
}) {
  const { isMobile } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("PortalEditor.workspace");
  const { data: credits } = useAiCredits();
  const { theme = "system", setTheme } = useTheme();
  const maskedEmail = maskEmail(user.email);

  const changeLocale = (nextLocale: string) => {
    if (nextLocale !== locale) router.replace(pathname, { locale: nextLocale });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="h-16! data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <Blobatar
              name={user.email}
              size={40}
              animate="always"
              aria-label={user.name}
              className="size-10! shrink-0"
            />
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-sidebar-foreground/70">
                {maskedEmail}
              </span>
            </div>
            <IconChevronDown className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Blobatar
                    name={user.email}
                    size={40}
                    animate="always"
                    aria-label={user.name}
                    className="size-10 shrink-0"
                  />
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {maskedEmail}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/" />}>
                <IconWorld />
                {t("startPage")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <IconCoins />
                {t("credits.available", { count: credits?.available ?? "—" })}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  window.location.href = feedbackHref;
                }}
              >
                <IconMessage2 />
                {t("feedback")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <IconLanguage />
                  {t("language")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={locale}
                    onValueChange={changeLocale}
                  >
                    <DropdownMenuRadioItem value="en">
                      {t("english")}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="es">
                      {t("spanish")}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <IconPalette />
                  {t("theme")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={theme}
                    onValueChange={setTheme}
                  >
                    <DropdownMenuRadioItem value="system">
                      {t("themeSystem")}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="light">
                      {t("themeLight")}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                      {t("themeDark")}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} variant="destructive">
              <IconLogout />
              {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
