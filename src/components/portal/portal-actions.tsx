import {
  type Icon,
  IconCheck,
  IconCopy,
  IconDownload,
  IconEdit,
  IconExternalLink,
  IconLayersIntersect,
  IconLock,
  IconPackageExport,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconX,
} from "@tabler/icons-react";
import { type ComponentProps, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadControlClass } from "@/lib/portal/download-ui";
import { cn } from "@/lib/utils";
import type { PortalAction, PortalActionIcon } from "./portal-project-types";

export type PortalItemActionsPosition =
  | "top-0-right"
  | "top-2-right"
  | "top-3-right";

const actionIcons: Record<PortalActionIcon, Icon> = {
  copy: IconCopy,
  download: IconDownload,
  edit: IconEdit,
  export: IconPackageExport,
  layers: IconLayersIntersect,
  lock: IconLock,
  open: IconExternalLink,
  plus: IconPlus,
  refresh: IconRefresh,
  remove: IconX,
  settings: IconSettings,
};

const itemActionPositions: Record<PortalItemActionsPosition, string> = {
  "top-0-right": "absolute top-0 right-0 flex gap-2",
  "top-2-right": "absolute top-2 right-2 flex gap-2",
  "top-3-right": "absolute top-3 right-3 flex gap-2",
};

export function shouldUseDownloadAttribute(action: PortalAction) {
  return Boolean(
    action.download && action.href && !action.href.startsWith("/api/"),
  );
}

function PortalActionButton({ action }: { action: PortalAction }) {
  const [feedbackActive, setFeedbackActive] = useState(false);
  const Icon = feedbackActive ? IconCheck : actionIcons[action.icon];
  const label =
    feedbackActive && action.feedbackLabel
      ? action.feedbackLabel
      : action.label;
  const content = (
    <>
      <Icon data-icon="inline-start" />
      <span className="sr-only">{label}</span>
    </>
  );

  if (action.href) {
    return (
      <Button
        aria-label={label}
        className="rounded-full"
        {...action.attributes}
        disabled={action.disabled}
        nativeButton={false}
        render={
          <a download={shouldUseDownloadAttribute(action)} href={action.href}>
            {content}
          </a>
        }
        size={action.size ?? "icon-sm"}
        variant={action.variant ?? "secondary"}
      />
    );
  }

  return (
    <Button
      aria-label={label}
      className="rounded-full"
      {...action.attributes}
      disabled={action.disabled}
      onClick={() => {
        action.onClick?.();
        if (!action.feedbackLabel) return;
        setFeedbackActive(true);
        window.setTimeout(() => setFeedbackActive(false), 1500);
      }}
      size={action.size ?? "icon-sm"}
      type="button"
      variant={action.variant ?? "secondary"}
    >
      {content}
    </Button>
  );
}

type PortalActionTriggerButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "size" | "variant"
> &
  Pick<PortalAction, "icon" | "label" | "size" | "variant">;

export function PortalActionTriggerButton({
  className,
  icon,
  label,
  size = "icon-sm",
  type = "button",
  variant = "secondary",
  ...props
}: PortalActionTriggerButtonProps) {
  const Icon = actionIcons[icon];

  return (
    <Button
      aria-label={label}
      className={cn("rounded-full", className)}
      size={size}
      type={type}
      variant={variant}
      {...props}
    >
      <Icon data-icon="inline-start" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

export function PortalActionButtons({ actions }: { actions: PortalAction[] }) {
  return actions.map((action) => (
    <PortalActionButton action={action} key={action.id} />
  ));
}

export function PortalItemActionButtonsOverlay({
  actions,
  className,
  forceVisible = false,
  position = "top-3-right",
}: {
  actions: PortalAction[] | undefined;
  className?: string;
  forceVisible?: boolean;
  position?: PortalItemActionsPosition;
}) {
  const visibleActions = (actions ?? []).filter(Boolean);
  if (!visibleActions.length) return null;

  return (
    <PortalItemActionsOverlay
      className={className}
      forceVisible={forceVisible}
      position={position}
    >
      <PortalActionButtons actions={visibleActions} />
    </PortalItemActionsOverlay>
  );
}

export function PortalItemActionsOverlay({
  children,
  className,
  forceVisible = false,
  position = "top-3-right",
}: {
  children: ReactNode;
  className?: string;
  forceVisible?: boolean;
  position?: PortalItemActionsPosition;
}) {
  return (
    <div
      className={cn(
        itemActionPositions[position],
        downloadControlClass("item"),
        forceVisible &&
          "sm:opacity-100 group-data-[style-mode=desktop]/portal:opacity-100! group-data-[style-mode=mobile]/portal:opacity-100!",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PortalSectionActionsToolbar({
  children,
  className,
  forceVisible = false,
}: {
  children: ReactNode;
  className?: string;
  forceVisible?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-end gap-2",
        downloadControlClass("section"),
        forceVisible &&
          "sm:opacity-100 group-data-[style-mode=desktop]/portal:opacity-100! group-data-[style-mode=mobile]/portal:opacity-100!",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PortalGlobalActionsOverlay({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute top-0 right-0 flex gap-2",
        downloadControlClass("always"),
        className,
      )}
    >
      {children}
    </div>
  );
}
