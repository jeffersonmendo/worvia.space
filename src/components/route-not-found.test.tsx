import { describe, expect, test } from "bun:test";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { RouteNotFound } from "./route-not-found";

describe("RouteNotFound", () => {
  test("offers a path back to the project list and home", () => {
    const markup = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={{}}>
        <RouteNotFound
          description="This portal is private or has not been published."
          goHomeLabel="Go to Worvia"
          title="Project not found"
          viewProjectsLabel="View my projects"
        />
      </NextIntlClientProvider>,
    );

    expect(markup).toContain('href="/en/home"');
    expect(markup).toContain('href="/en"');
    expect(markup).toContain("View my projects");
    expect(markup).toContain("Go to Worvia");
  });
});
