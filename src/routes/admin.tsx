import { createFileRoute } from "@tanstack/react-router";
import { AdminClient } from "@/components/game/AdminClient";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — HemiChess Server Monitoring" },
      {
        name: "description",
        content:
          "Wallet-gated admin console for HemiChess: live server health, matchmaking queue and active game management.",
      },
      { property: "og:title", content: "Admin Console — HemiChess" },
      {
        property: "og:description",
        content: "Live server health, queue size and active game management for HemiChess.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminClient,
});
