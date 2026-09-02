import type {
  RenderCollectionAvailability,
  RenderProjectData,
} from "@/components/render/visual-model";
import type { PortalPlanPolicy } from "@/lib/billing/portal-policy";

export function collectionAvailabilityFor(
  project: RenderProjectData,
  policy: PortalPlanPolicy | undefined,
): RenderCollectionAvailability | undefined {
  if (!policy) return undefined;

  return Object.fromEntries(
    project.sections.map((section) => {
      const imageLimit =
        section.type === "gallery" || section.type === "image_comparison"
          ? policy.sections.gallery?.items
          : undefined;
      const availableBelow = (count: number, limit: number | undefined) =>
        limit === undefined ? undefined : count < limit;

      return [
        section.id,
        {
          image: availableBelow(
            section.content.images?.length ?? 0,
            imageLimit,
          ),
          color:
            section.type === "colors"
              ? availableBelow(
                  section.content.colors?.length ?? 0,
                  policy.sections.colors?.items,
                )
              : undefined,
          font:
            section.type === "fonts"
              ? availableBelow(
                  section.content.fonts?.length ?? 0,
                  policy.sections.fonts?.items,
                )
              : undefined,
          file:
            section.type === "files"
              ? availableBelow(
                  section.content.files?.length ?? 0,
                  policy.sections.files?.items,
                )
              : undefined,
        },
      ];
    }),
  );
}
