"use client";

import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { useCallback, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RenderActions } from "./render-actions";
import { RenderCollectionAddTile } from "./render-collection-add-tile";
import { RenderColors } from "./render-colors";
import { RenderFiles } from "./render-files";
import { RenderFonts } from "./render-fonts";
import { RenderGallery } from "./render-gallery";
import { RenderImage } from "./render-image";
import { RenderSection } from "./render-section";
import { RenderText } from "./render-text";
import type {
  RenderAction,
  RenderActionTools,
  RenderProjectData,
  RenderProjectItemMove,
  RenderProjectProps,
  RenderSectionData,
  SelectedAsset,
} from "./visual-model";

function hasContent(section: RenderSectionData) {
  const c = section.content;
  return Boolean(
    c.body?.trim() ||
      c.image?.src.trim() ||
      c.images?.some((i) => i.src.trim()) ||
      c.colors?.length ||
      c.fonts?.length ||
      c.files?.length,
  );
}
function actionsFor<T>(
  factory: ((context: T) => RenderAction[]) | undefined,
  context: T,
) {
  return factory?.(context) ?? [];
}
function withContext<T>(actions: RenderAction[], context: T): RenderAction[] {
  return actions.map((action) => ({
    ...action,
    onClick: action.onClick
      ? (invocation) => action.onClick?.({ ...invocation, context })
      : undefined,
  }));
}
function collectionActionFor<T>(
  factory: ((context: T) => RenderAction | undefined) | undefined,
  context: T,
) {
  const action = factory?.(context);
  return action ? withContext([action], context)[0] : undefined;
}
function updateSection(
  project: RenderProjectData,
  id: string,
  update: (section: RenderSectionData) => RenderSectionData,
) {
  return {
    ...project,
    sections: project.sections.map((s) => (s.id === id ? update(s) : s)),
  };
}

export function RenderProject({
  mode,
  collectionAvailability,
  project,
  ui = {},
  actions,
  onChange,
}: RenderProjectProps) {
  const editor = mode === "editor";
  const inputRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<Parameters<RenderActionTools["pickAssets"]>[0] | null>(
    null,
  );
  const urlsRef = useRef(new Map<string, string>());
  const emit = useCallback(
    (
      next: RenderProjectData,
      kind:
        | "project"
        | "section"
        | "section-order"
        | "item-order"
        | "asset-selection",
      assets?: SelectedAsset[],
    ) => {
      void onChange?.({ project: next, kind, assets });
    },
    [onChange],
  );
  useEffect(
    () => () => {
      for (const url of urlsRef.current.values()) URL.revokeObjectURL(url);
    },
    [],
  );
  useEffect(() => {
    const retained = new Set(
      project.sections.flatMap((s) =>
        [
          s.content.image,
          ...(s.content.images ?? []),
          ...(s.content.files ?? []),
          ...(s.content.fonts ?? []),
        ]
          .filter(Boolean)
          .map((i) => i?.draftId)
          .filter(Boolean),
      ),
    );
    for (const [id, url] of urlsRef.current)
      if (!retained.has(id)) {
        URL.revokeObjectURL(url);
        urlsRef.current.delete(id);
      }
  }, [project]);
  const tools: RenderActionTools = {
    pickAssets(options) {
      if (!editor) return;
      pickRef.current = options;
      const input = inputRef.current;
      if (input) {
        input.accept =
          options.accept ??
          (options.kind === "image"
            ? "image/*"
            : options.kind === "font"
              ? ".ttf,.otf,.woff,.woff2"
              : "*/*");
        input.multiple = options.multiple ?? true;
        input.click();
      }
    },
  };
  const onAssets = (event: React.ChangeEvent<HTMLInputElement>) => {
    const request = pickRef.current;
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!request || !files.length) return;
    const selected: SelectedAsset[] = [];
    let next = project;
    for (const file of files) {
      const draftId = `draft-${crypto.randomUUID()}`;
      const preview = URL.createObjectURL(file);
      urlsRef.current.set(draftId, preview);
      selected.push({
        draftId,
        sectionId: request.sectionId,
        kind: request.kind,
        file,
      });
      next = updateSection(next, request.sectionId, (s) => {
        if (request.kind === "image") {
          const image = {
            alt: file.name,
            aspectRatio: "auto" as const,
            displayName: file.name,
            draftId,
            fit: "contain" as const,
            id: draftId,
            position: s.content.images?.length ?? 0,
            src: preview,
            status: "pending" as const,
            visible: true,
          };
          return s.type === "image"
            ? { ...s, content: { ...s.content, image } }
            : {
                ...s,
                content: {
                  ...s.content,
                  images: [...(s.content.images ?? []), image],
                },
              };
        }
        if (request.kind === "file") {
          const item = {
            aspectRatio: "1/1" as const,
            draftId,
            fileName: file.name,
            fit: "contain" as const,
            id: draftId,
            position: s.content.files?.length ?? 0,
            src: preview,
            status: "pending" as const,
            visible: true,
          };
          return {
            ...s,
            content: {
              ...s.content,
              files: [...(s.content.files ?? []), item],
            },
          };
        }
        const item = {
          draftId,
          family: file.name,
          id: draftId,
          name: file.name,
          position: s.content.fonts?.length ?? 0,
          src: preview,
          status: "pending" as const,
          visible: true,
        };
        return {
          ...s,
          content: { ...s.content, fonts: [...(s.content.fonts ?? []), item] },
        };
      });
    }
    emit(next, "asset-selection", selected);
  };
  const onItemDragEnd = (event: DragEndEvent) => {
    const source = event.operation.source;
    if (event.canceled || !event.operation.target || !isSortable(source)) {
      return;
    }

    const data = source.data as Partial<
      Pick<RenderProjectItemMove, "itemId" | "kind">
    >;
    const sourceSectionId = source.initialGroup;
    const targetSectionId = source.group;
    if (
      typeof data.itemId !== "string" ||
      (data.kind !== "image" &&
        data.kind !== "color" &&
        data.kind !== "file") ||
      typeof sourceSectionId !== "string" ||
      typeof targetSectionId !== "string" ||
      (sourceSectionId === targetSectionId &&
        source.initialIndex === source.index)
    ) {
      return;
    }

    void onChange?.({
      itemMove: {
        itemId: data.itemId,
        kind: data.kind,
        sourceSectionId,
        targetIndex: source.index,
        targetSectionId,
      },
      kind: "item-order",
      project,
    });
  };
  const visibility = ui.visibility;
  const itemVisibility = editor
    ? "always"
    : (ui.actions?.item?.visibility ?? "hover");
  const sectionVisibility = editor
    ? "always"
    : (ui.actions?.section?.visibility ?? "hover");
  const projectPolicy = {
    variant: ui.actions?.project?.variant ?? ("ghost" as const),
    radius: ui.actions?.project?.radius ?? ("rounded-full" as const),
    position: "top-right" as const,
    visibility: "always" as const,
    ...(editor ? {} : ui.actions?.project),
  };
  const sectionPolicy = {
    variant: ui.actions?.section?.variant ?? ("ghost" as const),
    radius: ui.actions?.section?.radius ?? ("rounded-full" as const),
    position: "top-right" as const,
    visibility: sectionVisibility,
    ...(editor ? {} : ui.actions?.section),
  };
  const itemPolicy = {
    variant: ui.actions?.item?.variant ?? ("ghost" as const),
    radius: ui.actions?.item?.radius ?? ("rounded-full" as const),
    position: "top-right" as const,
    visibility: itemVisibility,
    ...(editor ? {} : ui.actions?.item),
  };
  const renderContent = (section: RenderSectionData) => {
    const sectionContext = { project, section };
    const collectionAction = (kind: "image" | "color" | "font" | "file") =>
      editor && collectionAvailability?.[section.id]?.[kind] !== false
        ? collectionActionFor(actions?.collection, {
            ...sectionContext,
            kind,
          })
        : undefined;
    if (section.type === "text")
      return (
        <RenderText
          body={section.content.body}
          editable={editor}
          layout={section.layout}
          onChange={(body) =>
            emit(
              updateSection(project, section.id, (current) => ({
                ...current,
                content: { ...current.content, body },
              })),
              "section",
            )
          }
        />
      );
    if (section.type === "image") {
      const image = section.content.image;
      const addImageAction = collectionAction("image");
      return (
        <div className="w-full">
          {image ? (
            <RenderImage
              editable={editor}
              actions={withContext(
                actionsFor(actions?.image, {
                  ...sectionContext,
                  item: image,
                }),
                { ...sectionContext, item: image },
              )}
              image={image}
              onDescriptionChange={(description) =>
                emit(
                  updateSection(project, section.id, (current) => ({
                    ...current,
                    content: {
                      ...current.content,
                      image: current.content.image
                        ? { ...current.content.image, alt: description }
                        : null,
                    },
                  })),
                  "section",
                )
              }
              previewable={!editor}
              showDescription
              tools={tools}
              policy={itemPolicy}
              visibility={itemVisibility}
            />
          ) : null}
          {editor && !image && addImageAction ? (
            <RenderCollectionAddTile
              action={addImageAction}
              kind="image"
              tools={tools}
            />
          ) : null}
        </div>
      );
    }
    if (section.type === "gallery" || section.type === "image_comparison")
      return (
        <RenderGallery
          editable={editor}
          addAction={collectionAction("image")}
          previewable={!editor}
          items={section.content.images ?? []}
          onItemDescriptionChange={(itemId, description) =>
            emit(
              updateSection(project, section.id, (current) => ({
                ...current,
                content: {
                  ...current.content,
                  images: (current.content.images ?? []).map((image) =>
                    image.id === itemId
                      ? { ...image, alt: description }
                      : image,
                  ),
                },
              })),
              "section",
            )
          }
          sectionId={section.id}
          actions={(image) =>
            withContext(
              actionsFor(actions?.image, { ...sectionContext, item: image }),
              { ...sectionContext, item: image },
            )
          }
          layout={{
            ...section.layout,
            mode:
              section.type === "image_comparison"
                ? "comparison"
                : section.layout?.mode,
          }}
          tools={tools}
          policy={itemPolicy}
          visibility={itemVisibility}
        />
      );
    if (section.type === "colors")
      return (
        <RenderColors
          items={section.content.colors ?? []}
          editable={editor}
          addAction={collectionAction("color")}
          actions={(item) =>
            withContext(
              actionsFor(actions?.color, { ...sectionContext, item }),
              { ...sectionContext, item },
            )
          }
          layout={section.layout}
          tools={tools}
          policy={itemPolicy}
          sectionId={section.id}
          visibility={itemVisibility}
        />
      );
    if (section.type === "fonts")
      return (
        <RenderFonts
          items={section.content.fonts ?? []}
          editable={editor}
          addAction={collectionAction("font")}
          actions={(item) =>
            withContext(
              actionsFor(actions?.font, { ...sectionContext, item }),
              { ...sectionContext, item },
            )
          }
          tools={tools}
          policy={itemPolicy}
          visibility={itemVisibility}
        />
      );
    if (section.type === "files")
      return (
        <RenderFiles
          items={section.content.files ?? []}
          editable={editor}
          addAction={collectionAction("file")}
          actions={(item) =>
            withContext(
              actionsFor(actions?.file, { ...sectionContext, item }),
              { ...sectionContext, item },
            )
          }
          layout={section.layout}
          tools={tools}
          policy={itemPolicy}
          sectionId={section.id}
          visibility={itemVisibility}
        />
      );
    return null;
  };
  const content = (
    <article
      className={cn(
        "group/project flex max-w-145 flex-col gap-8 space-y-20",
        ui.className,
      )}
      data-project-id={project.id}
      data-render-mode={mode}
      data-style-mode={ui.styleMode ?? "auto"}
    >
      {editor ? (
        <input
          className="sr-only"
          data-render-asset-picker
          onChange={onAssets}
          ref={inputRef}
          type="file"
        />
      ) : null}
      <header className="relative flex flex-col gap-2">
        <div
          className="flex items-start justify-between gap-2"
          data-render-project-heading
        >
          {editor ? (
            <Textarea
              aria-label={ui.labels?.nameLabel ?? "Project name"}
              className="min-w-0 flex-1 bg-transparent! text-wrap rounded-none! border-0 p-0! ring-0 focus-visible:ring-0! text-2xl! resize-none"
              data-portal-editor-field
              data-portal-name
              onChange={(e) =>
                emit({ ...project, name: e.currentTarget.value }, "project")
              }
              placeholder={ui.labels?.namePlaceholder}
              value={project.name}
            />
          ) : (
            <h1 className="min-w-0 flex-1 text-2xl text-wrap">
              {project.name}
            </h1>
          )}
          {actions?.project ? (
            <RenderActions
              actions={withContext(actionsFor(actions.project, { project }), {
                project,
              })}
              layout="inline"
              tools={tools}
              policy={projectPolicy}
              visibility="always"
            />
          ) : null}
        </div>
        {editor ? (
          <Textarea
            aria-label={ui.labels?.descriptionLabel ?? "Project description"}
            className="bg-transparent! text-balance rounded-none! border-0 p-0! ring-0 focus-visible:ring-0! text-base! text-muted-foreground resize-none"
            data-portal-editor-field
            data-portal-description
            onChange={(e) =>
              emit(
                { ...project, description: e.currentTarget.value },
                "project",
              )
            }
            placeholder={ui.labels?.descriptionPlaceholder}
            value={project.description}
          />
        ) : (
          <p className="text-muted-foreground text-balance">
            {project.description}
          </p>
        )}
      </header>
      <div
        className={cn("flex flex-col gap-8 space-y-20", ui.contentClassName)}
      >
        {[...project.sections]
          .sort((a, b) => a.position - b.position)
          .filter(
            (s) =>
              (visibility?.showHiddenSections || s.visible) &&
              (visibility?.showEmptySections || s.type !== "empty") &&
              (!visibility?.requireContent || hasContent(s)),
          )
          .map((section) => {
            const context = { project, section };
            return (
              <RenderSection
                actions={withContext(
                  actionsFor(actions?.section, context),
                  context,
                )}
                actionTools={tools}
                actionPolicy={sectionPolicy}
                actionVisibility={sectionVisibility}
                description={section.description}
                editable={editor}
                id={section.id}
                key={section.id}
                layout={section.layout}
                onChange={(change) => {
                  if (
                    change.field === "title" ||
                    change.field === "description"
                  )
                    emit(
                      updateSection(project, section.id, (s) => ({
                        ...s,
                        [change.field]: change.value,
                      })),
                      "section",
                    );
                }}
                title={section.title}
              >
                {renderContent(section)}
              </RenderSection>
            );
          })}
      </div>
    </article>
  );

  return editor ? (
    <DragDropProvider onDragEnd={onItemDragEnd}>{content}</DragDropProvider>
  ) : (
    content
  );
}
