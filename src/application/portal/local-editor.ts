import type { PortalDocument } from "@/domain/portal/document";

const containedDemoOverlayDismissal = Symbol(
  "contained-demo-overlay-dismissal",
);
type ContainedDemoOverlayHost = HTMLElement & {
  [containedDemoOverlayDismissal]?: true;
};

export function armContainedDemoOverlayDismissal(container: HTMLElement) {
  (container as ContainedDemoOverlayHost)[containedDemoOverlayDismissal] = true;
}

function consumeContainedDemoOverlayDismissal(container?: HTMLElement | null) {
  if (!container) return false;
  const host = container as ContainedDemoOverlayHost;
  if (!host[containedDemoOverlayDismissal]) return false;
  delete host[containedDemoOverlayDismissal];
  return true;
}

export function applyLocalDocumentUpdate(
  current: { current: PortalDocument },
  onChange: (document: PortalDocument) => void,
  update: (document: PortalDocument) => PortalDocument,
) {
  const next = update(current.current);
  current.current = next;
  onChange(next);
}

export function applyContainedDemoOverlayOpenChange(
  contained: boolean,
  nextOpen: boolean,
  onOpenChange: (open: boolean) => void,
  details?: {
    container?: HTMLElement | null;
    event: { isTrusted: boolean };
    reason: string;
  },
) {
  const isAutomatedOutsidePress =
    details?.reason === "outside-press" &&
    details.event.isTrusted === false &&
    consumeContainedDemoOverlayDismissal(details.container);
  if (!contained || nextOpen || isAutomatedOutsidePress) {
    onOpenChange(nextOpen);
  }
}
