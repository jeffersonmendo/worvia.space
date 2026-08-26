export const PORTAL_LANDING_LAYOUT = {
  viewport: "min-h-dvh bg-background text-foreground",
  heroTrack: "relative h-[calc(100dvh+240px)] bg-background",
  hero: "sticky top-0 isolate h-dvh overflow-hidden bg-background [@media(max-height:500px)]:h-dvh!",
  frame: "relative isolate h-full overflow-hidden bg-background",
  portalStage: "pointer-events-none absolute inset-0 grid place-items-center",
  portal:
    "relative h-[min(56dvh,400px)] w-[min(70vw,37.33dvh,267px)] [@media(max-height:500px)]:h-[min(58dvh,260px)] [@media(max-height:500px)]:w-[min(42vw,38.67dvh,174px)]",
  portalFrame: "portal-obsidian-frame absolute inset-0",
  portalInterior: "absolute inset-0 overflow-hidden bg-background",
  gradientPlane:
    "absolute left-1/2 top-1/2 h-dvh w-screen -translate-x-1/2 -translate-y-1/2",
  ignitionLayer: "absolute inset-0",
  content:
    "relative z-10 flex h-full select-none flex-col items-center justify-center px-5 text-center [@media(max-height:500px)]:px-3!",
  fallback: "portal-landing-fallback pointer-events-none absolute inset-0",
  header:
    "fixed inset-x-0 top-0 z-30 h-16 bg-brand-surface-strong backdrop-blur-xl",
  initialHeader: "absolute inset-x-0 top-0 z-20 h-16",
  heroCopy: "contents",
  title:
    "max-w-5xl text-balance text-5xl font-medium leading-[0.94] tracking-[-0.055em] text-white sm:text-6xl md:text-7xl lg:text-8xl [@media(max-height:500px)]:text-4xl!",
  description:
    "mt-7 max-w-lg text-balance text-sm leading-relaxed text-white/80 sm:text-base [@media(max-height:500px)]:mt-3! [@media(max-height:500px)]:max-w-xl! [@media(max-height:500px)]:text-xs! [@media(max-height:500px)]:leading-snug!",
  cta: "mt-9 [@media(max-height:500px)]:mt-4!",
  details: "relative z-20 px-5 py-24 sm:px-8 sm:py-32 lg:py-40",
  finalCta: "relative z-20 pb-24 pt-8 sm:pb-32 sm:pt-12 lg:pb-40",
} as const;

export const PORTAL_LANDING_SCROLL = {
  contentOffset: 68,
  distance: 240,
  headerRevealEnd: 460,
  headerRevealStart: 400,
  inset: 24,
  radius: 20,
} as const;

export const PORTAL_LANDING_ENTRY = {
  frameDelay: 0.12,
  frameDuration: 0.32,
  ignitionDelay: 0.52,
  ignitionDuration: 0.38,
  expansionDelay: 0.92,
  expansionDuration: 0.82,
  frameFadeProgress: 0.42,
  initialWidth: "min(70vw, 37.33dvh, 267px)",
  initialHeight: "min(56dvh, 400px)",
  expandedWidth: "100%",
  expandedHeight: "100dvh",
  titleDelay: 1.76,
  titleStagger: 0.035,
  descriptionDelay: 1.82,
  descriptionStagger: 0.01,
  textRevealDuration: 0.9,
  ctaDelay: 2.04,
  contentDuration: 0.6,
} as const;

export const PORTAL_SHADER_PRESENTATION = {
  className: "absolute inset-0 opacity-90",
  speed: 0.52,
} as const;
