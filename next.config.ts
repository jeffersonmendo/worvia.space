import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: [
    "10.0.0.213",
    "127.0.0.1",
    "jeffersons-macbook-pro.taila04655.ts.net",
  ],
};

const withNextIntl = createNextIntlPlugin();

export default withWorkflow(withNextIntl(nextConfig));
