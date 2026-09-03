import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  focusPortalAddSection,
  focusPortalName,
  focusPortalPublicationTarget,
  focusPortalSectionTitle,
  scrollToPortalSection,
} from "./scroll-to-section";

describe("scrollToPortalSection", () => {
  test("scrolls the requested section into view", () => {
    const calls: ScrollIntoViewOptions[] = [];
    const section = {
      scrollIntoView: (options: ScrollIntoViewOptions) => calls.push(options),
    };
    const document = {
      getElementById: (id: string) => (id === "sec_new" ? section : null),
    };

    assert.equal(scrollToPortalSection("sec_new", document), true);
    assert.deepEqual(calls, [{ behavior: "smooth", block: "start" }]);
  });

  test("does nothing when the section is not mounted", () => {
    const document = { getElementById: () => null };

    assert.equal(scrollToPortalSection("sec_missing", document), false);
  });

  test("focuses the title without changing the scroll position", () => {
    const calls: FocusOptions[] = [];
    const title = {
      focus: (options: FocusOptions) => calls.push(options),
    };
    const section = {
      querySelector: (selector: string) =>
        selector === "[data-portal-section-title]" ? title : null,
    };
    const document = {
      getElementById: (id: string) => (id === "sec_new" ? section : null),
    };

    assert.equal(focusPortalSectionTitle("sec_new", document), true);
    assert.deepEqual(calls, [{ preventScroll: true }]);
  });

  test("does not focus when the section title is not mounted", () => {
    const document = { getElementById: () => null };

    assert.equal(focusPortalSectionTitle("sec_missing", document), false);
  });
});

describe("publication target focus", () => {
  test("focuses and reveals the portal name", () => {
    const calls: string[] = [];
    const field = {
      focus: (options: FocusOptions) =>
        calls.push(`focus:${String(options.preventScroll)}`),
      scrollIntoView: () => calls.push("scroll"),
    };
    const document = {
      getElementById: () => null,
      querySelector: (selector: string) =>
        selector === "[data-portal-name]" ? field : null,
    };

    assert.equal(focusPortalName(document), true);
    assert.deepEqual(calls, ["scroll", "focus:true"]);
  });

  test("focuses the add-section trigger when no section exists", () => {
    let focused = false;
    const document = {
      querySelector: (selector: string) =>
        selector === "[data-portal-add-section]"
          ? {
              focus: () => {
                focused = true;
              },
            }
          : null,
    };

    assert.equal(focusPortalAddSection(document), true);
    assert.equal(focused, true);
  });

  test("requests the add-section dialog after focusing its trigger", () => {
    const events: Event[] = [];
    const document = {
      getElementById: () => null,
      querySelector: (selector: string) =>
        selector === "[data-portal-add-section]"
          ? { focus: () => undefined }
          : null,
      dispatchEvent: (event: Event) => {
        events.push(event);
        return true;
      },
    };

    assert.equal(
      focusPortalPublicationTarget({ kind: "add-section" }, document),
      true,
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "portal-open-add-section-dialog");
  });

  test("routes a section-title issue through the existing section helper", () => {
    let focused = false;
    const document = {
      getElementById: (id: string) =>
        id === "section-1"
          ? {
              querySelector: () => ({
                focus: () => {
                  focused = true;
                },
              }),
              scrollIntoView: () => undefined,
            }
          : null,
      querySelector: () => null,
    };

    assert.equal(
      focusPortalPublicationTarget(
        { kind: "section-title", sectionId: "section-1" },
        document,
      ),
      true,
    );
    assert.equal(focused, true);
  });

  test("scrolls the exact section before focusing its title input", () => {
    const calls: string[] = [];
    const title = {
      focus: () => calls.push("focus-title"),
    };
    const document = {
      getElementById: (id: string) =>
        id === "section-invalid"
          ? {
              querySelector: (selector: string) =>
                selector === "[data-portal-section-title]" ? title : null,
              scrollIntoView: () => calls.push("scroll-section"),
            }
          : null,
      querySelector: () => null,
    };

    assert.equal(
      focusPortalPublicationTarget(
        { kind: "section-title", sectionId: "section-invalid" },
        document,
      ),
      true,
    );
    assert.deepEqual(calls, ["scroll-section", "focus-title"]);
  });
});
