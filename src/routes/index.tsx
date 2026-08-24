import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/HomePage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HemiChess — Play Online Chess on Hemi Network" },
      {
        name: "description",
        content:
          "Real-time PvP chess with ELO ratings, wallet login and on-chain rewards on the Hemi Network.",
      },
      { property: "og:title", content: "HemiChess — Play Online Chess on Hemi Network" },
      {
        property: "og:description",
        content: "Real-time PvP chess with ELO ratings and Web3 wallet login on Hemi Network.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});
