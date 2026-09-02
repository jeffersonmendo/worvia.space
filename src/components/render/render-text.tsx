import { Textarea } from "@/components/ui/textarea";
import type { RenderLayout } from "./visual-model";

export function RenderText({
  body,
  editable = false,
  layout = {},
  onChange,
}: {
  body?: string;
  editable?: boolean;
  layout?: RenderLayout;
  onChange?: (body: string) => void;
}) {
  if (editable)
    return (
      <Textarea
        aria-label="Section text"
        className="min-h-32 resize-y bg-transparent"
        data-portal-section-body
        onChange={(event) => onChange?.(event.currentTarget.value)}
        style={{ background: layout.background, padding: layout.padding }}
        value={body ?? ""}
      />
    );
  return body ? (
    <div
      className="prose max-w-none whitespace-pre-wrap"
      style={{ background: layout.background, padding: layout.padding }}
    >
      {body}
    </div>
  ) : null;
}
