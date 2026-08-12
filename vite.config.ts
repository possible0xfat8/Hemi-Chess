import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  optimizeDeps: {
    include: ['@walletconnect/ethereum-provider'],
  },
});
