import type { ReactNode } from "react";
import { CardAction } from "@/components/ui/card";

export function PortalCardActionGroup({
  badge,
  favoriteAction,
}: {
  badge: ReactNode;
  favoriteAction: ReactNode;
}) {
  return (
    <CardAction className="flex items-center gap-1">
      {badge}
      {favoriteAction}
    </CardAction>
  );
}
