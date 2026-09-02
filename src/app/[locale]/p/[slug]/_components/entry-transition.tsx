"use client";

import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useState } from "react";
import { PORTAL_ENTRY_TIMING } from "./entry-transition.config";

type PortalEntryTransitionProps = {
  children: ReactNode;
  iconUrl: string | null;
  name: string;
};

export function PortalEntryTransition({
  children,
  iconUrl,
  name,
}: PortalEntryTransitionProps) {
  const reducedMotion = useReducedMotion();
  const [hasIconError, setHasIconError] = useState(false);
  const [isEntryActive, setIsEntryActive] = useState(true);
  const portalInitial = name.trim().charAt(0).toLocaleUpperCase() || "P";

  return (
    <>
      <div inert={isEntryActive}>{children}</div>
      {isEntryActive ? (
        <motion.div
          animate={{ opacity: 0 }}
          aria-hidden="true"
          className="fixed inset-0 flex items-center justify-center bg-background"
          initial={reducedMotion ? false : { opacity: 1 }}
          onAnimationComplete={() => setIsEntryActive(false)}
          transition={
            reducedMotion
              ? { duration: 0 }
              : {
                  delay: PORTAL_ENTRY_TIMING.fadeDelay,
                  duration: PORTAL_ENTRY_TIMING.fadeDuration,
                  ease: "easeOut",
                }
          }
        >
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            className="flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-muted text-3xl font-medium text-foreground shadow-sm"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.92 }}
            transition={{
              delay: reducedMotion ? 0 : PORTAL_ENTRY_TIMING.identityDelay,
              duration: reducedMotion ? 0 : 0.2,
            }}
          >
            {iconUrl && !hasIconError ? (
              // biome-ignore lint/performance/noImgElement: portal icons can be private signed URLs.
              <img
                alt=""
                className="size-full object-cover"
                onError={() => setHasIconError(true)}
                src={iconUrl}
              />
            ) : (
              <span>{portalInitial}</span>
            )}
          </motion.div>
          <motion.div
            animate={{ opacity: 0.12, scale: 1 }}
            className="absolute size-52 rounded-full bg-primary blur-3xl"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }}
            transition={{
              delay: reducedMotion ? 0 : PORTAL_ENTRY_TIMING.surfaceDelay,
              duration: reducedMotion ? 0 : 0.25,
            }}
          />
        </motion.div>
      ) : null}
    </>
  );
}
