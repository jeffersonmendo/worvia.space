"use client";

import {
  type ComponentProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { DemoPlayer, type DemoStatus, demo, demoTarget } from "uitodemo";
import { armContainedDemoOverlayDismissal } from "@/application/portal/local-editor";
import { PortalProjectController } from "@/components/portal";
import type { Button } from "@/components/ui/button";
import type { PortalDocument } from "@/domain/portal/document";
import { LANDING_EDITOR_DEMO_SEQUENCE } from "./landing-editor-demo-contract";
import {
  applyLandingEditorDemoAction,
  createLandingDemoReplayController,
  createLandingEditorDemoState,
} from "./landing-editor-demo-state";
import { PortalEditorShell } from "./portal-editor-shell";

const [
  projectDescription,
  colorsSection,
  addColor,
  colorCode,
  saveColor,
  gallerySection,
  firstImageSettings,
  firstImageName,
  firstImageDownload,
  firstImagePicker,
  firstImageBlack,
  popoverDismissArm,
  editorCanvas,
  publish,
] = LANDING_EDITOR_DEMO_SEQUENCE;

const DEMO_TIMING = {
  initial: 900,
  reveal: 700,
  settle: 500,
  overlayOpen: 750,
  scroll: 900,
  beforePublish: 800,
  completedHold: 1800,
} as const;
const revealHover = {
  cursor: "pointer" as const,
  delay: DEMO_TIMING.reveal,
  hover: true,
};

const steps = demo()
  .wait(DEMO_TIMING.initial)
  .click(projectDescription, { cursor: "text", hover: true })
  .wait(DEMO_TIMING.settle)
  .type(projectDescription, "Logos de martpos", {
    delay: 90,
    cursor: "text",
  })
  .wait(DEMO_TIMING.settle)
  .scroll(colorsSection, { align: "center", delay: DEMO_TIMING.scroll })
  .wait(DEMO_TIMING.settle)
  .click(addColor, { cursor: "pointer", hover: true })
  .wait(DEMO_TIMING.overlayOpen)
  .type(colorCode, "000000", { delay: 80, cursor: "text" })
  .wait(DEMO_TIMING.settle)
  .click(saveColor, { cursor: "pointer", hover: true })
  .wait(DEMO_TIMING.overlayOpen)
  .scroll(gallerySection, { align: "center", delay: DEMO_TIMING.scroll })
  .wait(DEMO_TIMING.settle)
  .highlight("first-image-card", revealHover)
  .wait(DEMO_TIMING.settle)
  .highlight("first-image-settings", revealHover)
  .wait(DEMO_TIMING.settle)
  .click(firstImageSettings, { cursor: "pointer", hover: true })
  .wait(DEMO_TIMING.overlayOpen)
  .click(firstImageName, { cursor: "text", hover: true })
  .type(firstImageName, "Logo principal", {
    delay: 90,
    cursor: "text",
  })
  .click(firstImageDownload, { cursor: "pointer", hover: true })
  .wait(DEMO_TIMING.settle)
  .highlight("first-image-picker", revealHover)
  .wait(DEMO_TIMING.settle)
  .click(firstImagePicker, { cursor: "pointer", hover: true })
  .wait(DEMO_TIMING.overlayOpen)
  .highlight("first-image-black", revealHover)
  .wait(DEMO_TIMING.settle)
  .click(firstImageBlack, { cursor: "pointer", hover: true })
  .wait(DEMO_TIMING.settle)
  .click(popoverDismissArm, { hover: true })
  .click(editorCanvas, { hover: true })
  .wait(DEMO_TIMING.beforePublish)
  .click(publish, { cursor: "pointer", hover: true })
  .build();

function attachDemoTarget(root: HTMLElement, selector: string, target: string) {
  root.querySelector(selector)?.setAttribute("demo-id", target);
}

function LandingEditor() {
  const [demoState, setDemoState] = useState(createLandingEditorDemoState);
  const { document, published } = demoState;
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = viewport;
    if (!root) return;
    const instrument = () => {
      attachDemoTarget(root, "[data-demo-scroll-owner]", "popover-dismiss-arm");
      attachDemoTarget(root, "[data-portal-name]", "project-title");
      attachDemoTarget(
        root,
        "[data-portal-description]",
        "project-description",
      );
      for (const element of root.querySelectorAll<HTMLElement>(
        "[data-portal-demo-target]",
      )) {
        const target = element.dataset.portalDemoTarget;
        if (target) element.setAttribute("demo-id", target);
      }
    };
    instrument();
    const observer = new MutationObserver(instrument);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [viewport]);

  function updateLocalDocument(nextDocument: PortalDocument) {
    setDemoState((state) =>
      applyLandingEditorDemoAction(state, {
        document: nextDocument,
        type: "sync-document",
      }),
    );
  }

  return (
    <div
      {...demoTarget(editorCanvas)}
      className="group/portal relative isolate h-full overflow-hidden bg-transparent"
      data-style-mode="desktop"
      data-demo-overlay-host
      onClickCapture={(event) => {
        if (
          !event.nativeEvent.isTrusted &&
          event.target instanceof Element &&
          event.target.closest('[demo-id="popover-dismiss-arm"]')
        ) {
          armContainedDemoOverlayDismissal(event.currentTarget);
        }
      }}
      ref={setViewport}
    >
      <PortalEditorShell
        favorites={["Mi proyecto", "Vercel Design", document.portal.name]}
        onPublish={() =>
          setDemoState((state) =>
            applyLandingEditorDemoAction(state, { type: "publish" }),
          )
        }
        projectName={document.portal.name}
        published={published}
        publishProps={
          demoTarget("publish") as unknown as ComponentProps<typeof Button>
        }
      >
        <PortalProjectController
          mode="demo"
          className="min-h-0"
          contentClassName="pb-28"
          document={document}
          styleMode="desktop"
          localEditor={{
            allowUploads: false,
            onDocumentChange: updateLocalDocument,
            overlayContainer: viewport,
            portalId: "landing-demo",
            showControls: true,
            slug: "martpos.app",
          }}
        />
      </PortalEditorShell>
    </div>
  );
}

export function LandingEditorDemo() {
  const [iteration, setIteration] = useState(0);
  const [playbackActive, setPlaybackActive] = useState(true);
  const replayController = useRef<ReturnType<
    typeof createLandingDemoReplayController
  > | null>(null);

  useEffect(() => {
    replayController.current = createLandingDemoReplayController({
      clearTimer: (timer) => window.clearTimeout(timer as number),
      holdMs: DEMO_TIMING.completedHold,
      onActivate: () => setPlaybackActive(true),
      onDeactivate: () => setPlaybackActive(false),
      onReset: () => setIteration((value) => value + 1),
      setTimer: (run, delay) => window.setTimeout(run, delay),
    });
    return () => replayController.current?.dispose();
  }, []);

  const handleStatusChange = useCallback((status: DemoStatus) => {
    replayController.current?.onStatus(status);
  }, []);

  return (
    <DemoPlayer
      baseHeight={750}
      cursor={{
        enabled: true,
        hideNativeCursor: false,
        mobileSize: "xl",
        size: "xl",
      }}
      frameBorderRadius="xl"
      isActive={playbackActive}
      onStatusChange={handleStatusChange}
      padded={false}
      showCenterOverlayButton={true}
      showControls={false}
      steps={steps}
    >
      <LandingEditor key={iteration} />
    </DemoPlayer>
  );
}
