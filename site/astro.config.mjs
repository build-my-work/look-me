import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://lookme.anme.cc",
  output: "static",
  trailingSlash: "always",
  integrations: [sitemap()],
});
