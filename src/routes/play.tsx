import { createFileRoute } from "@tanstack/react-router";
import { PlayClient } from "@/components/game/PlayClient";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Play — HemiChess" },
      {
        name: "description",
        content:
          "Play real-time chess matches on Hemi Network with ELO ratings and on-chain rewards.",
      },
    ],
  }),
  component: PlayClient,
});
