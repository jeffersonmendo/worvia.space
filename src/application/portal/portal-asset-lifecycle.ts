import type { PortalDocument } from "@/domain/portal/document";
import { deleteManagedPortalAsset } from "@/infrastructure/portal/portal-assets-client";

export function portalAssetIds(document: PortalDocument) {
  const ids = new Set<string>();
  for (const section of document.sections) {
    const items = [
      section.content.image,
      ...(section.content.images ?? []),
      ...(section.content.fonts ?? []),
      ...(section.content.files ?? []),
    ];
    for (const item of items) {
      if (item?.asset_id) ids.add(item.asset_id);
    }
  }
  return ids;
}

export function removePortalAssetIds(ids: Iterable<string>, portalId: string) {
  for (const assetId of ids) {
    void deleteManagedPortalAsset(assetId, fetch, portalId).catch(() => {
      // Server reconciliation remains the fallback if immediate cleanup fails.
    });
  }
}
