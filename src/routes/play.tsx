import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ClientOnly } from "@/components/ClientOnly";

const Web3Provider = lazy(() =>
  import("@/lib/web3/Web3Provider").then((m) => ({ default: m.Web3Provider })),
);
const PlayClient = lazy(() =>
  import("@/components/game/PlayClient").then((m) => ({ default: m.PlayClient })),
);

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
  component: PlayPage,
});

function PlayPage() {
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-[#0B0E14]" />}>
      <Web3Provider>
        <PlayClient />
      </Web3Provider>
    </ClientOnly>
  );
}
