import { cn } from "@/lib/utils";
import { RenderActions } from "./render-actions";
import { RenderCollectionAddTile } from "./render-collection-add-tile";
import { ordered } from "./render-utils";
import type {
  RenderActions as RenderActionsData,
  RenderFontData,
} from "./visual-model";

function cssString(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\a ");
}

function renderedFontFamily(font: RenderFontData) {
  return font.src ? `portal-font-${font.id}` : font.family;
}

function fontFaceFor(font: RenderFontData) {
  if (!font.src) return null;
  return `@font-face { font-family: "${cssString(renderedFontFamily(font))}"; src: url("${cssString(font.src)}"); font-weight: ${font.weight ?? 400}; font-style: normal; font-display: swap; }`;
}

export function RenderFonts({
  actions,
  items,
  tools,
  policy,
  visibility,
  editable,
  addAction,
}: {
  actions?: (font: RenderFontData) => RenderActionsData;
  items: RenderFontData[];
  tools?: import("./visual-model").RenderActionTools;
  policy?: import("./visual-model").RenderActionStyle;
  visibility?: "always" | "hover";
  editable?: boolean;
  addAction?: RenderActionsData[number];
}) {
  const fonts = ordered(items);
  const fontFaces = fonts.map(fontFaceFor).filter(Boolean).join("\n");

  return (
    <div className="flex flex-col gap-4">
      {fontFaces ? <style>{fontFaces}</style> : null}
      {fonts.map((font) => (
        <div
          className={cn(
            "group/item relative",
            editable && !font.visible && "opacity-40",
          )}
          key={font.id}
          style={{
            fontFamily: `"${renderedFontFamily(font)}"`,
            fontWeight: font.weight,
          }}
        >
          <div className="text-2xl">{font.sample || font.family}</div>
          <div className="text-muted-foreground text-sm">
            {font.name || font.family}
          </div>
          <div className="flex flex-wrap gap-2 text-muted-foreground text-xs">
            {[font.provider, font.weights, font.usage]
              .filter(Boolean)
              .map((value) => (
                <span key={value}>{value}</span>
              ))}
          </div>
          <RenderActions
            actions={actions?.(font)}
            policy={policy}
            scope="item"
            tools={tools}
            visibility={visibility}
          />
        </div>
      ))}
      {editable && addAction ? (
        <RenderCollectionAddTile
          action={addAction}
          kind="font"
          tools={tools ?? { pickAssets() {} }}
        />
      ) : null}
    </div>
  );
}
