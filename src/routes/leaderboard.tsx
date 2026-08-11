import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ClientOnly } from "@/components/ClientOnly";

const Web3Provider = lazy(() =>
  import("@/lib/web3/Web3Provider").then((m) => ({ default: m.Web3Provider })),
);
const Navbar = lazy(() =>
  import("@/components/Navbar").then((m) => ({ default: m.Navbar })),
);
const Leaderboard = lazy(() =>
  import("@/components/Leaderboard").then((m) => ({ default: m.Leaderboard })),
);

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Top Players on HemiChess" },
      {
        name: "description",
        content:
          "View the global leaderboard and see the top-ranked chess players on HemiChess by ELO rating.",
      },
      { property: "og:title", content: "Leaderboard — Top Players on HemiChess" },
      {
        property: "og:description",
        content: "Compete with players worldwide and climb the ranks in HemiChess.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-canvas" />}>
      <Web3Provider>
        <div className="min-h-screen bg-canvas">
          <Navbar />

          <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
            <div className="mb-4 sm:mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Leaderboard
              </h1>
            </div>

            <Leaderboard />
          </main>
        </div>
      </Web3Provider>
    </ClientOnly>
  );
}
