import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: {
    // Cloudflare Pages build output (Pages Git integration deploys this dir).
    preset: "cloudflare_pages",
  },
});
