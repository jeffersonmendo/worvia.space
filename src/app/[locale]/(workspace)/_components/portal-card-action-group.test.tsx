import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PortalCardActionGroup } from "./portal-card-action-group";

test("renders the plan badge before the favorite button", () => {
  const markup = renderToStaticMarkup(
    <PortalCardActionGroup
      badge={<span data-action="plan">Plan</span>}
      favoriteAction={
        <button data-action="favorite" type="button">
          Favorite
        </button>
      }
    />,
  );

  expect(markup.indexOf('data-action="plan"')).toBeLessThan(
    markup.indexOf('data-action="favorite"'),
  );
});
