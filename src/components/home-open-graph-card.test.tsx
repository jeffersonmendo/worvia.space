import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeOpenGraphCard } from "./home-open-graph-card";

describe("HomeOpenGraphCard", () => {
  test("renders only the centered brand over an ambient purple background", () => {
    const markup = renderToStaticMarkup(<HomeOpenGraphCard />);
    const visibleCopy = markup.replace(/<[^>]+>/g, "").trim();
    const containerCount = markup.match(/<div/g)?.length ?? 0;

    expect(visibleCopy).toBe("Worvia");
    expect(markup).toContain('aria-label="Worvia"');
    expect(markup).toContain("background-color:#050507");
    expect(markup).toContain("radial-gradient");
    expect(markup).toContain("<svg");
    expect(containerCount).toBe(2);
    expect(markup).not.toContain("border-radius");
    expect(markup).not.toContain("linear-gradient");
  });
});
