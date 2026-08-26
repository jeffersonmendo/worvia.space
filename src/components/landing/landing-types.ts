export type LandingPlan = {
  cta: string;
  description: string;
  features: string[];
  name: string;
  price: string;
  pricing: string;
};

export type LandingDetails = {
  navigation: Array<{ href: string; label: string }>;
  heroSecondary: string;
  demo: {
    description: string;
    editorLabel: string;
    projectDescription: string;
    projectTitle: string;
    publishedLabel: string;
    sections: string[];
    title: string;
  };
  steps: ContentListSection;
  journeys: {
    eyebrow: string;
    items: Array<{ action: string; description: string; title: string }>;
    title: string;
  };
  monetization: {
    commissionTitle: string;
    description: string;
    examples: string[];
    eyebrow: string;
    stripe: string;
    tiers: string[];
    title: string;
  };
  buyer: {
    description: string;
    eyebrow: string;
    items: string[];
    title: string;
  };
  ai: {
    credits: string[];
    description: string;
    eyebrow: string;
    title: string;
  };
  security: {
    eyebrow: string;
    items: Array<{ description: string; title: string }>;
    note: string;
    title: string;
  };
  plans: {
    description: string;
    free: LandingPlan;
    perPortal: string;
    premium: LandingPlan;
    pro: LandingPlan;
    starter: LandingPlan;
    title: string;
  };
  faq: {
    eyebrow: string;
    items: Array<{ answer: string; question: string }>;
    title: string;
  };
  ctaDescription: string;
  ctaLabel: string;
  ctaTitle: string;
};

type ContentListSection = {
  description?: string;
  eyebrow: string;
  items: Array<{ description: string; title: string }>;
  title: string;
};
