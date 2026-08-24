import { createFileRoute } from "@tanstack/react-router";
import { ProfileClient } from "@/components/game/ProfileClient";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — HemiChess Stats & Match History" },
      {
        name: "description",
        content:
          "Track your HemiChess ELO rating, win rate, HELO token balance and recent match history.",
      },
      { property: "og:title", content: "Your Profile — HemiChess Stats & Match History" },
      {
        property: "og:description",
        content: "ELO rating, win rate and recent games for your HemiChess account.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfileClient,
});
